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
router.post('/toss/confirm', async (req, res) => {
  try {
    const { paymentKey, orderId, amount } = req.body || {}

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

    // Basic 인증 헤더: "{secretKey}:" 를 base64 인코딩
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
      // Toss 가 내려준 에러를 그대로 전달 (code/message)
      console.error('Toss 결제 승인 실패:', tossData)
      return res.status(tossRes.status).json({
        success: false,
        error: tossData?.message || '결제 승인에 실패했습니다',
        code: tossData?.code || null,
      })
    }

    // amount 위·변조 방지: Toss 응답 금액과 요청 금액이 다르면 즉시 실패 처리
    if (Number(tossData.totalAmount) !== Number(amount)) {
      console.error('Toss 결제 금액 불일치:', {
        requested: amount,
        confirmed: tossData.totalAmount,
      })
      return res.status(400).json({
        success: false,
        error: '결제 금액이 일치하지 않습니다',
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

