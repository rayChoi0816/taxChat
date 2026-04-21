import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// SMS 템플릿 조회
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { usageStatus } = req.query

    let query = 'SELECT * FROM sms_templates WHERE deleted = false'
    const params = []

    if (usageStatus) {
      query += ' AND usage_status = $1'
      params.push(usageStatus)
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('SMS 템플릿 조회 오류:', error)
    res.status(500).json({ error: 'SMS 템플릿 조회 중 오류가 발생했습니다' })
  }
})

// SMS 템플릿 등록
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const { name, content } = req.body

    if (!name || !content) {
      return res.status(400).json({ error: '템플릿명과 내용은 필수입니다' })
    }

    const result = await pool.query(
      `INSERT INTO sms_templates (name, content, usage_status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, content, '미사용']
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('SMS 템플릿 등록 오류:', error)
    res.status(500).json({ error: 'SMS 템플릿 등록 중 오류가 발생했습니다' })
  }
})

// SMS 템플릿 수정
router.put('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, content } = req.body

    if (!name || !content) {
      return res.status(400).json({ error: '템플릿명과 내용은 필수입니다' })
    }

    const result = await pool.query(
      `UPDATE sms_templates SET name = $1, content = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, content, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('SMS 템플릿 수정 오류:', error)
    res.status(500).json({ error: 'SMS 템플릿 수정 중 오류가 발생했습니다' })
  }
})

// SMS 템플릿 사용 여부 변경
router.patch('/templates/:id/usage', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { usageStatus } = req.body

    const result = await pool.query(
      `UPDATE sms_templates SET usage_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [usageStatus, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('SMS 템플릿 사용 여부 변경 오류:', error)
    res.status(500).json({ error: 'SMS 템플릿 사용 여부 변경 중 오류가 발생했습니다' })
  }
})

// SMS 템플릿 삭제
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `UPDATE sms_templates SET deleted = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '템플릿을 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      message: '템플릿이 삭제되었습니다'
    })
  } catch (error) {
    console.error('SMS 템플릿 삭제 오류:', error)
    res.status(500).json({ error: 'SMS 템플릿 삭제 중 오류가 발생했습니다' })
  }
})

// SMS 전송 이력 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      smsType,
      recipient,
      successStatus,
      sortOrder = '발송일시 역순'
    } = req.query

    let query = 'SELECT * FROM sms_messages WHERE 1=1'
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate && endDate) {
      query += ` AND sent_at >= $${paramIndex} AND sent_at <= $${paramIndex + 1}`
      params.push(startDate, endDate)
      paramIndex += 2
    }

    // SMS 유형 필터
    if (smsType) {
      const types = Array.isArray(smsType) ? smsType : [smsType]
      if (types.length > 0) {
        query += ` AND sms_type = ANY($${paramIndex})`
        params.push(types)
        paramIndex++
      }
    }

    // 수신인 필터
    if (recipient) {
      query += ` AND (recipient_name ILIKE $${paramIndex} OR recipient_phone ILIKE $${paramIndex})`
      params.push(`%${recipient}%`)
      paramIndex++
    }

    // 성공 여부 필터
    if (successStatus) {
      const statuses = Array.isArray(successStatus) ? successStatus : [successStatus]
      if (statuses.length > 0) {
        query += ` AND success_status = ANY($${paramIndex})`
        params.push(statuses)
        paramIndex++
      }
    }

    // 정렬
    if (sortOrder === '발송일시 역순') {
      query += ' ORDER BY sent_at DESC'
    } else {
      query += ' ORDER BY sent_at ASC'
    }

    // 페이지네이션
    const offset = (parseInt(page) - 1) * parseInt(limit)
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(limit), offset)

    // 전체 개수 조회를 위한 쿼리 생성 (LIMIT, OFFSET 제외)
    let countQuery = 'SELECT COUNT(*) as count FROM sms_messages WHERE 1=1'
    const countParams = []
    let countParamIndex = 1

    // 날짜 필터
    if (startDate && endDate) {
      countQuery += ` AND sent_at >= $${countParamIndex} AND sent_at <= $${countParamIndex + 1}`
      countParams.push(startDate, endDate)
      countParamIndex += 2
    }

    // SMS 유형 필터
    if (smsType) {
      const types = Array.isArray(smsType) ? smsType : [smsType]
      if (types.length > 0) {
        countQuery += ` AND sms_type = ANY($${countParamIndex})`
        countParams.push(types)
        countParamIndex++
      }
    }

    // 수신인 필터
    if (recipient) {
      countQuery += ` AND (recipient_name ILIKE $${countParamIndex} OR recipient_phone ILIKE $${countParamIndex})`
      countParams.push(`%${recipient}%`)
      countParamIndex++
    }

    // 성공 여부 필터
    if (successStatus) {
      const statuses = Array.isArray(successStatus) ? successStatus : [successStatus]
      if (statuses.length > 0) {
        countQuery += ` AND success_status = ANY($${countParamIndex})`
        countParams.push(statuses)
        countParamIndex++
      }
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ])

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
    console.error('SMS 전송 이력 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: 'SMS 전송 이력 조회 중 오류가 발생했습니다',
      details: error.message
    })
    res.status(500).json({ error: 'SMS 전송 이력 조회 중 오류가 발생했습니다' })
  }
})

// SMS 전송
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const {
      recipientName,
      recipientPhone,
      smsType,
      templateId,
      content,
      paymentAmount,
      productId,
      productPaymentLink
    } = req.body

    if (!recipientPhone || !smsType) {
      return res.status(400).json({ error: '수신인 전화번호와 SMS 유형은 필수입니다' })
    }

    // 템플릿이 선택된 경우 템플릿 내용 가져오기
    let finalContent = content
    if (smsType === '템플릿' && templateId) {
      const templateResult = await pool.query(
        'SELECT content FROM sms_templates WHERE id = $1 AND usage_status = $2',
        [templateId, '사용']
      )
      if (templateResult.rows.length > 0) {
        finalContent = templateResult.rows[0].content
      }
    }

    // 실제 SMS 발송은 외부 서비스 연동 필요 (현재는 DB에만 저장)
    // TODO: 실제 SMS 서비스 연동

    const result = await pool.query(
      `INSERT INTO sms_messages (
        recipient_name, recipient_phone, sms_type, template_id,
        content, payment_amount, product_id, product_payment_link,
        success_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        recipientName || null,
        recipientPhone,
        smsType,
        templateId || null,
        finalContent,
        paymentAmount || null,
        productId || null,
        productPaymentLink || null,
        '성공' // 실제 SMS 서비스 연동 시 결과에 따라 변경
      ]
    )

    res.json({
      success: true,
      data: result.rows[0],
      message: 'SMS가 발송되었습니다'
    })
  } catch (error) {
    console.error('SMS 전송 오류:', error)
    res.status(500).json({ error: 'SMS 전송 중 오류가 발생했습니다' })
  }
})

// SMS 재발송
router.post('/:id/resend', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // 기존 SMS 정보 조회
    const smsResult = await pool.query('SELECT * FROM sms_messages WHERE id = $1', [id])

    if (smsResult.rows.length === 0) {
      return res.status(404).json({ error: 'SMS를 찾을 수 없습니다' })
    }

    const originalSMS = smsResult.rows[0]

    // 재발송
    const result = await pool.query(
      `INSERT INTO sms_messages (
        recipient_name, recipient_phone, sms_type, template_id,
        content, payment_amount, product_id, product_payment_link,
        success_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        originalSMS.recipient_name,
        originalSMS.recipient_phone,
        originalSMS.sms_type,
        originalSMS.template_id,
        originalSMS.content,
        originalSMS.payment_amount,
        originalSMS.product_id,
        originalSMS.product_payment_link,
        '성공'
      ]
    )

    res.json({
      success: true,
      data: result.rows[0],
      message: 'SMS가 재발송되었습니다'
    })
  } catch (error) {
    console.error('SMS 재발송 오류:', error)
    res.status(500).json({ error: 'SMS 재발송 중 오류가 발생했습니다' })
  }
})

export default router

