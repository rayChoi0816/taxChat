import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

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

