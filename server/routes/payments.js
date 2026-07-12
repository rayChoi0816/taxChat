import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// ===========================================================================
// TossPayments 결제 승인 (PG 연동)
// ---------------------------------------------------------------------------
// 프론트(브라우저)는 TossPayments SDK 로 결제창만 띄우고,
// 결제 성공 후 success URL 로 돌아온 paymentKey / orderId / amount 를 들고
// 이 엔드포인트를 호출합니다. 실제 결제 "승인(confirm)" 은 시크릿 키가
// 필요하므로 반드시 서버에서만 처리합니다.
//
//  - 시크릿 키는 환경변수 TOSS_SECRET_KEY 에서만 읽고 응답에 노출하지 않습니다.
//  - 브라우저에서 위·변조한 amount 가 그대로 승인되지 않도록 Toss API 응답의
//    amount 가 요청 amount 와 일치하는지 한 번 더 검증합니다.
//  - 인증 토큰이 없어도 결제 흐름이 끊기지 않도록 authenticateToken 은 붙이지 않고,
//    대신 orderId(UUID) 와 paymentKey 로 멱등 처리합니다.
// ===========================================================================
// 내부 주문번호 생성기: YYMMDDHHMMSS + 소문자 2자리 (기존 orders.js 와 동일 규칙)
const generateInternalOrderId = () => {
  const now = new Date()
  const y = String(now.getFullYear()).slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const H = String(now.getHours()).padStart(2, '0')
  const M = String(now.getMinutes()).padStart(2, '0')
  const S = String(now.getSeconds()).padStart(2, '0')
  const rnd = Math.random().toString(36).substring(2, 4).toLowerCase()
  return `${y}${m}${d}${H}${M}${S}${rnd}`
}

router.post('/toss/confirm', async (req, res) => {
  try {
    const {
      paymentKey,
      orderId,      // TossPayments 에 넘겼던 orderId (UUID)
      amount,
      memberId,     // 우리 시스템의 회원 ID (프론트에서 함께 전달)
      productId,    // 결제 대상 상품 ID (프론트에서 함께 전달)
    } = req.body || {}

    if (!paymentKey || !orderId || amount == null) {
      return res.status(400).json({
        success: false,
        error: 'paymentKey, orderId, amount 는 필수입니다',
      })
    }

    const secretKey = process.env.TOSS_SECRET_KEY
    if (!secretKey) {
      console.error('TOSS_SECRET_KEY 가 설정되어 있지 않습니다.')
      return res.status(500).json({
        success: false,
        error: '결제 서버 설정 오류 (시크릿 키 누락)',
      })
    }

    // === (0) 멱등성 체크 ===
    //  - 브라우저 새로고침, Toss 재요청 등으로 confirm 이 여러 번 들어와도
    //    payments.pg_transaction_id (paymentKey) 로 중복 저장을 방지합니다.
    try {
      const existing = await pool.query(
        'SELECT p.*, o.order_id as internal_order_id, o.product_name FROM payments p LEFT JOIN orders o ON p.order_id = o.id WHERE p.pg_transaction_id = $1 LIMIT 1',
        [paymentKey]
      )
      if (existing.rows.length > 0) {
        const row = existing.rows[0]
        console.log('[Toss] 이미 처리된 결제(멱등 응답):', paymentKey)
        return res.json({
          success: true,
          alreadyProcessed: true,
          data: {
            paymentKey,
            orderId,
            orderName: row.product_name || '',
            method: row.payment_method,
            totalAmount: row.payment_amount,
            status: row.payment_status,
            approvedAt: row.payment_completed_at,
            internalOrderId: row.internal_order_id,
          },
        })
      }
    } catch (e) {
      console.warn('[Toss] 멱등성 사전조회 실패 (계속 진행):', e.message)
    }

    // === (1) Toss 결제 승인 API 호출 ===
    const authHeader =
      'Basic ' + Buffer.from(`${secretKey}:`, 'utf8').toString('base64')

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount),
      }),
    })

    const tossData = await tossRes.json().catch(() => ({}))

    if (!tossRes.ok) {
      const keyHint = secretKey ? `${secretKey.slice(0, 12)}…(len=${secretKey.length})` : 'EMPTY'
      console.error('[Toss] 결제 승인 실패:', {
        status: tossRes.status,
        code: tossData?.code,
        message: tossData?.message,
        secretKeyHint: keyHint,
        orderId,
      })
      return res.status(tossRes.status).json({
        success: false,
        error: tossData?.message || '결제 승인에 실패했습니다',
        code: tossData?.code || null,
      })
    }

    // amount 위·변조 방지
    if (Number(tossData.totalAmount) !== Number(amount)) {
      console.error('[Toss] 결제 금액 불일치:', {
        requested: amount,
        confirmed: tossData.totalAmount,
      })
      return res.status(400).json({
        success: false,
        error: '결제 금액이 일치하지 않습니다',
      })
    }

    // === (2) 승인 성공 → orders + payments 저장 ===
    // 관리자 "주문 결제 관리" 페이지와 마이페이지 "서비스 이용 내역" 이
    // orders 테이블을 조회하므로 반드시 orders 도 함께 INSERT 합니다.
    let internalOrderId = null
    let ordersRowId = null
    let productSnapshot = null

    if (memberId && productId) {
      try {
        // 상품 스냅샷 조회 (주문 시점의 이름/가격/카테고리/필수서류 기록)
        const productResult = await pool.query(
          `SELECT p.*, pc.name AS category_name
             FROM products p
             LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.id = $1`,
          [productId]
        )
        productSnapshot = productResult.rows[0] || null

        // 우리 내부 주문번호(짧은 형식) — Toss orderId(UUID) 와는 별도
        internalOrderId = generateInternalOrderId()

        // 중복 확인
        let dup = await pool.query('SELECT id FROM orders WHERE order_id = $1', [internalOrderId])
        let attempts = 0
        while (dup.rows.length > 0 && attempts < 10) {
          internalOrderId = generateInternalOrderId()
          dup = await pool.query('SELECT id FROM orders WHERE order_id = $1', [internalOrderId])
          attempts += 1
        }

        // required_documents 는 상품 스냅샷을 JSON 문자열로 유지 (orders.js 규칙과 동일)
        let requiredDocs = productSnapshot?.required_documents || '[]'
        if (typeof requiredDocs !== 'string') {
          try {
            requiredDocs = JSON.stringify(requiredDocs)
          } catch (_) {
            requiredDocs = '[]'
          }
        } else {
          try {
            JSON.parse(requiredDocs)
          } catch (_) {
            requiredDocs = '[]'
          }
        }

        const orderInsert = await pool.query(
          `INSERT INTO orders (
             order_id, member_id, product_id,
             category_name, product_name, product_price, required_documents,
             payment_amount, status, payment_date
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
           RETURNING id, order_id`,
          [
            internalOrderId,
            memberId,
            productId,
            productSnapshot?.category_name || null,
            productSnapshot?.name || tossData.orderName || null,
            productSnapshot?.price || tossData.totalAmount,
            requiredDocs,
            tossData.totalAmount,
            '결제완료',
          ]
        )
        ordersRowId = orderInsert.rows[0].id

        // payments 테이블에도 함께 INSERT (결제 이력 관리용)
        await pool.query(
          `INSERT INTO payments (
             order_id, payment_method, pg_transaction_id,
             payment_amount, payment_status, payment_completed_at
           ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            ordersRowId,
            tossData.method || '카드',
            paymentKey,
            tossData.totalAmount,
            '결제완료',
          ]
        )

        console.log('[Toss] 결제 완료 → orders/payments 저장 성공:', {
          internalOrderId,
          ordersRowId,
          paymentKey,
          memberId,
          productId,
        })
      } catch (dbErr) {
        // ⚠️ 결제 승인 자체는 성공한 뒤이므로 사용자에게는 성공을 반환하되,
        //     서버 로그에는 반드시 남겨서 수동 리커버리 가능하게 합니다.
        console.error('[Toss] 승인 성공 후 DB 저장 실패:', dbErr, {
          paymentKey,
          orderId,
          memberId,
          productId,
        })
      }
    } else {
      console.warn('[Toss] memberId/productId 미전달 — orders/payments 저장 건너뜀:', {
        paymentKey,
        memberId,
        productId,
      })
    }

    return res.json({
      success: true,
      data: {
        paymentKey: tossData.paymentKey,
        orderId: tossData.orderId,
        orderName: tossData.orderName,
        method: tossData.method,
        totalAmount: tossData.totalAmount,
        status: tossData.status,
        approvedAt: tossData.approvedAt,
        receiptUrl: tossData.receipt?.url || null,
        internalOrderId, // 우리 내부 주문번호 (있으면)
      },
    })
  } catch (error) {
    console.error('Toss 결제 승인 처리 오류:', error)
    return res.status(500).json({
      success: false,
      error: '결제 승인 처리 중 오류가 발생했습니다',
    })
  }
})

// 프론트가 클라이언트 키를 환경변수 없이 받아갈 수 있도록 노출하는 보조 엔드포인트.
// (시크릿 키는 절대 내려보내지 않습니다.)
router.get('/toss/config', (req, res) => {
  res.json({
    success: true,
    data: {
      clientKey: process.env.TOSS_CLIENT_KEY || null,
    },
  })
})

// 결제 정보 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { orderId, status } = req.query

    let query = 'SELECT * FROM payments WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (orderId) {
      query += ` AND order_id = $${paramIndex}`
      params.push(orderId)
      paramIndex++
    }

    if (status) {
      query += ` AND payment_status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('결제 정보 조회 오류:', error)
    res.status(500).json({ error: '결제 정보 조회 중 오류가 발생했습니다' })
  }
})

// 결제 생성 (결제 시도)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      paymentMethod,
      paymentAmount,
      pgTransactionId
    } = req.body

    if (!orderId || !paymentMethod || !paymentAmount) {
      return res.status(400).json({ error: '주문 ID, 결제 수단, 결제 금액은 필수입니다' })
    }

    // 결제 정보 저장 (초기 상태: 입금대기)
    const result = await pool.query(
      `INSERT INTO payments (
        order_id, payment_method, payment_amount, pg_transaction_id, payment_status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [orderId, paymentMethod, paymentAmount, pgTransactionId || null, '입금대기']
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('결제 생성 오류:', error)
    res.status(500).json({ error: '결제 생성 중 오류가 발생했습니다' })
  }
})

// 결제 상태 업데이트 (PG사 콜백)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { paymentStatus, pgTransactionId } = req.body

    if (!paymentStatus) {
      return res.status(400).json({ error: '결제 상태는 필수입니다' })
    }

    const updateData = {
      payment_status: paymentStatus,
      updated_at: 'CURRENT_TIMESTAMP'
    }

    if (paymentStatus === '결제완료') {
      updateData.payment_completed_at = 'CURRENT_TIMESTAMP'
    }

    if (pgTransactionId) {
      updateData.pg_transaction_id = pgTransactionId
    }

    const setClause = Object.keys(updateData)
      .map((key, index) => {
        if (updateData[key] === 'CURRENT_TIMESTAMP') {
          return `${key} = CURRENT_TIMESTAMP`
        }
        return `${key} = $${index + 1}`
      })
      .join(', ')

    const values = Object.values(updateData).filter(v => v !== 'CURRENT_TIMESTAMP')
    values.push(id)

    const result = await pool.query(
      `UPDATE payments SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다' })
    }

    // 결제 완료 시 주문 상태 업데이트
    if (paymentStatus === '결제완료') {
      await pool.query(
        `UPDATE orders SET 
          status = $1, 
          payment_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        ['결제완료', result.rows[0].order_id]
      )
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('결제 상태 업데이트 오류:', error)
    res.status(500).json({ error: '결제 상태 업데이트 중 오류가 발생했습니다' })
  }
})

// 결제 취소
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { cancelAmount } = req.body

    // 결제 정보 조회
    const paymentResult = await pool.query('SELECT * FROM payments WHERE id = $1', [id])

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다' })
    }

    const payment = paymentResult.rows[0]

    if (payment.payment_status !== '결제완료') {
      return res.status(400).json({ error: '결제 완료된 건만 취소할 수 있습니다' })
    }

    if (cancelAmount > payment.payment_amount) {
      return res.status(400).json({ error: '취소 금액이 결제 금액을 초과할 수 없습니다' })
    }

    // 결제 취소 처리
    const result = await pool.query(
      `UPDATE payments SET 
        payment_status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      ['환불', id]
    )

    // 주문에 취소 정보 업데이트
    await pool.query(
      `UPDATE orders SET 
        cancel_amount = $1,
        cancel_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`,
      [cancelAmount, payment.order_id]
    )

    res.json({
      success: true,
      data: result.rows[0],
      message: '결제가 취소되었습니다'
    })
  } catch (error) {
    console.error('결제 취소 오류:', error)
    res.status(500).json({ error: '결제 취소 중 오류가 발생했습니다' })
  }
})

export default router

