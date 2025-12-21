import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// 주문 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.query

    let query = `
      SELECT o.*, p.name as product_name, p.code as product_code,
             pc.name as category_name
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (memberId) {
      query += ` AND o.member_id = $${paramIndex}`
      params.push(memberId)
      paramIndex++
    }

    query += ' ORDER BY o.created_at DESC'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('주문 조회 오류:', error)
    res.status(500).json({ error: '주문 조회 중 오류가 발생했습니다' })
  }
})

// 주문 생성
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, productId, paymentAmount } = req.body

    // 주문 코드 생성
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const orderCode = `ORD${timestamp}${random}`.toUpperCase()

    const result = await pool.query(
      `INSERT INTO orders (member_id, product_id, order_code, payment_amount, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [memberId, productId, orderCode, paymentAmount, '결제 완료']
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('주문 생성 오류:', error)
    res.status(500).json({ error: '주문 생성 중 오류가 발생했습니다' })
  }
})

// 주문 상태 변경
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('주문 상태 변경 오류:', error)
    res.status(500).json({ error: '주문 상태 변경 중 오류가 발생했습니다' })
  }
})

export default router

