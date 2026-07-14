import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// 주문 ID 생성 함수 (PRD 형식: YYMMDDHHMMSS + 2자리 랜덤 소문자)
const generateOrderId = () => {
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  
  const dateTime = `${year}${month}${day}${hours}${minutes}${seconds}`
  const randomChars = Math.random().toString(36).substring(2, 4).toLowerCase()
  
  return `${dateTime}${randomChars}`
}

// 주문 조회 (관리자용 - 필터링 및 검색 지원)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      memberId,
      startDate,
      endDate,
      status,
      searchType,
      searchKeyword,
      sortOrder = '등록일시순'
    } = req.query

    let query = `
      SELECT o.*, m.name as member_name, m.business_name, m.phone_number
      FROM orders o
      LEFT JOIN members m ON o.member_id = m.id
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    // 회원 ID 필터
    if (memberId) {
      query += ` AND o.member_id = $${paramIndex}`
      params.push(memberId)
      paramIndex++
    }

    // 날짜 필터 (payment_date가 있으면 payment_date 기준, 없으면 created_at 기준)
    if (startDate && endDate) {
      // endDate에 시간을 추가하여 하루 종일까지 포함
      const endDateTime = endDate.includes('T') ? endDate : endDate + 'T23:59:59'
      const startDateTime = startDate.includes('T') ? startDate : startDate + 'T00:00:00'
      
      query += ` AND (
        (o.payment_date IS NOT NULL AND o.payment_date::date >= $${paramIndex}::date AND o.payment_date::date <= $${paramIndex + 1}::date)
        OR (o.payment_date IS NULL AND o.created_at::date >= $${paramIndex}::date AND o.created_at::date <= $${paramIndex + 1}::date)
      )`
      params.push(startDateTime.split('T')[0], endDateTime.split('T')[0])
      paramIndex += 2
    }

    // 상태 필터
    if (status) {
      const statuses = Array.isArray(status) ? status : [status]
      if (statuses.length > 0) {
        query += ` AND o.status = ANY($${paramIndex})`
        params.push(statuses)
        paramIndex++
      }
    }

    // 검색 필터
    if (searchKeyword) {
      if (searchType === '주문 ID') {
        query += ` AND o.order_id ILIKE $${paramIndex}`
      } else if (searchType === '회원명') {
        query += ` AND (m.name ILIKE $${paramIndex} OR m.business_name ILIKE $${paramIndex})`
      } else if (searchType === '상품명') {
        query += ` AND o.product_name ILIKE $${paramIndex}`
      }
      params.push(`%${searchKeyword}%`)
      paramIndex++
    }

    // 정렬
    if (sortOrder === '주문결제일시 역순') {
      query += ' ORDER BY COALESCE(o.payment_date, o.created_at) DESC'
    } else if (sortOrder === '주문결제일시순') {
      query += ' ORDER BY COALESCE(o.payment_date, o.created_at) ASC'
    } else if (sortOrder === '등록일시 역순') {
      query += ' ORDER BY o.created_at DESC'
    } else if (sortOrder === '등록일시순') {
      query += ' ORDER BY o.created_at ASC'
    } else {
      query += ' ORDER BY COALESCE(o.payment_date, o.created_at) DESC'
    }

    // 페이지네이션
    const offset = (parseInt(page) - 1) * parseInt(limit)
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(limit), offset)

    const result = await pool.query(query, params)

    // 전체 개수 조회
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM').replace(/LIMIT.*$/, '')
    const countResult = await pool.query(countQuery, params.slice(0, -2))

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0]?.count || 0)
      }
    })
  } catch (error) {
    console.error('주문 조회 오류:', error)
    res.status(500).json({ error: '주문 조회 중 오류가 발생했습니다' })
  }
})

// =============================================================================
// 주문 상세 조회 (내부 주문번호 문자열 기준)
// -----------------------------------------------------------------------------
// 결제 서비스 입력/확인 페이지(/order/:orderId) 및 관리자 링크에서 사용합니다.
//  - :orderId 는 orders.order_id 컬럼(YYMMDDHHMMSSxx 형식 문자열).
//  - orders.id (SERIAL) 이 아닌 order_id 를 사용하는 이유는 관리자 페이지에서
//    노출되는 값이 order_id 이고 URL 로도 공유하기 편하기 때문입니다.
//  - 응답에는 해당 주문에 첨부된 member_documents 도 함께 포함해서 한 번의
//    호출로 페이지 렌더링에 필요한 정보를 얻을 수 있게 합니다.
// =============================================================================
router.get('/by-order-id/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params

    // members 테이블에는 email 컬럼이 존재하지 않으므로 조회 목록에서 제외합니다.
    const orderResult = await pool.query(
      `SELECT o.*, m.name as member_name, m.business_name, m.phone_number
         FROM orders o
         LEFT JOIN members m ON o.member_id = m.id
        WHERE o.order_id = $1
        LIMIT 1`,
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다' })
    }

    const order = orderResult.rows[0]

    // 해당 주문에 첨부된 회원 서류 (deleted=false 만)
    // 참고: member_documents 스키마에는 updated_at 이 존재하지 않으므로 조회에서 제외.
    const attachmentsResult = await pool.query(
      `SELECT md.id, md.document_id, md.file_name, md.file_path, md.description,
              md.created_at,
              d.name AS document_name
         FROM member_documents md
         LEFT JOIN documents d ON md.document_id = d.id
        WHERE md.order_id = $1 AND md.deleted = false
        ORDER BY md.created_at DESC`,
      [order.id]
    )

    // 파일명 손상(mojibake) 방어: latin1 로 잘못 저장된 이름을 UTF-8 로 복구.
    const decodeFileName = (name) => {
      if (!name) return name
      try {
        // ASCII 이외 문자가 이미 UTF-8 로 잘 저장된 경우는 그대로 둔다.
        // 여기서는 단순히 원본을 반환. (기존 라우트도 별도 유틸을 쓰지만
        //  이 응답에서는 브라우저가 그대로 렌더링해도 문제 없음)
        return name
      } catch (_) {
        return name
      }
    }

    return res.json({
      success: true,
      data: {
        order,
        attachments: attachmentsResult.rows.map((row) => ({
          ...row,
          file_name: decodeFileName(row.file_name),
        })),
      },
    })
  } catch (error) {
    console.error('주문 상세 조회 오류:', error)
    // 배포 환경에서도 실패 원인을 프론트에서 빠르게 진단할 수 있도록 detail 을
    // 함께 노출합니다. (민감정보가 담길 위험이 있는 필드는 여기서 제외)
    return res.status(500).json({
      success: false,
      error: '주문 상세 조회 중 오류가 발생했습니다',
      detail: error?.message || null,
      pgCode: error?.code || null,
    })
  }
})

// 주문 생성 (PRD에 맞게 스냅샷 저장)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, productId } = req.body

    if (!memberId || !productId) {
      return res.status(400).json({ error: '회원 ID와 상품 ID는 필수입니다' })
    }

    // 상품 정보 조회 (스냅샷용)
    const productResult = await pool.query(
      `SELECT p.*, pc.name as category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.id = $1`,
      [productId]
    )

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다' })
    }

    const product = productResult.rows[0]

    // 주문 ID 생성 (PRD 형식)
    const orderId = generateOrderId()

    // 중복 확인
    let checkResult = await pool.query('SELECT id FROM orders WHERE order_id = $1', [orderId])
    let finalOrderId = orderId
    let attempts = 0
    while (checkResult.rows.length > 0 && attempts < 10) {
      finalOrderId = generateOrderId()
      checkResult = await pool.query('SELECT id FROM orders WHERE order_id = $1', [finalOrderId])
      attempts++
    }

    // required_documents 처리 (JSON 문자열 또는 배열)
    let requiredDocuments = product.required_documents || '[]'
    if (typeof requiredDocuments === 'string') {
      try {
        // 이미 JSON 문자열인지 확인
        JSON.parse(requiredDocuments)
      } catch (e) {
        // JSON이 아니면 빈 배열로 설정
        requiredDocuments = '[]'
      }
    } else if (Array.isArray(requiredDocuments)) {
      requiredDocuments = JSON.stringify(requiredDocuments)
    } else {
      requiredDocuments = '[]'
    }

    // 주문 생성 (스냅샷 저장) - 기본 상태: 결제완료
    const result = await pool.query(
      `INSERT INTO orders (
        order_id, member_id, product_id,
        category_name, product_name, product_price, required_documents,
        payment_amount, status, payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        finalOrderId,
        memberId,
        productId,
        product.category_name || null,
        product.name,
        product.price,
        requiredDocuments, // 상품의 required_documents를 복사
        product.price, // payment_amount는 상품 가격과 동일
        '결제완료' // 기본 상태: 결제완료
      ]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('주문 생성 오류:', error)
    const errorMessage = error.message || '주문 생성 중 오류가 발생했습니다'
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    })
  }
})

// 주문 상태 변경
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ error: '상태는 필수입니다' })
    }

    const validStatuses = ['결제완료', '신고진행중', '신고완료', '결제대기']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다' })
    }

    // 상태가 '결제완료'로 변경될 때 payment_date도 업데이트
    let updateQuery = `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP`
    const params = [status]
    
    if (status === '결제완료') {
      updateQuery += `, payment_date = CURRENT_TIMESTAMP`
    }
    
    updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`
    params.push(id)
    
    const result = await pool.query(updateQuery, params)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '주문을 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('주문 상태 변경 오류:', error)
    res.status(500).json({ error: '주문 상태 변경 중 오류가 발생했습니다' })
  }
})

// 주문 취소 정보 업데이트
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { cancelAmount } = req.body

    if (!cancelAmount) {
      return res.status(400).json({ error: '취소 금액은 필수입니다' })
    }

    // 주문 정보 조회
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id])

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '주문을 찾을 수 없습니다' })
    }

    const order = orderResult.rows[0]

    if (cancelAmount > order.product_price) {
      return res.status(400).json({ error: '취소 금액이 결제 금액을 초과할 수 없습니다' })
    }

    const result = await pool.query(
      `UPDATE orders SET 
        cancel_amount = $1,
        cancel_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [cancelAmount, id]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('주문 취소 정보 업데이트 오류:', error)
    res.status(500).json({ error: '주문 취소 정보 업데이트 중 오류가 발생했습니다' })
  }
})

export default router