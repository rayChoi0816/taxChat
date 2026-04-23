import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// 상품 카테고리 조회
router.get('/categories', async (req, res) => {
  try {
    const { displayStatus } = req.query

    let query = 'SELECT * FROM product_categories WHERE deleted = false'
    const params = []

    if (displayStatus) {
      query += ' AND display_status = $1'
      params.push(displayStatus)
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('상품 카테고리 조회 오류:', error)
    res.status(500).json({ error: '상품 카테고리 조회 중 오류가 발생했습니다' })
  }
})

// 상품 카테고리 등록 (관리자)
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, briefDescription, detailedDescription } = req.body

    // 코드 생성
    const countResult = await pool.query('SELECT COUNT(*) FROM product_categories')
    const count = parseInt(countResult.rows[0].count) + 1
    const randomChars = Math.random().toString(36).substring(2, 4)
    const code = `cate${String(count).padStart(2, '0')}${randomChars}`

    const result = await pool.query(
      `INSERT INTO product_categories (code, name, brief_description, detailed_description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [code, name, briefDescription, detailedDescription]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('상품 카테고리 등록 오류:', error)
    res.status(500).json({ error: '상품 카테고리 등록 중 오류가 발생했습니다' })
  }
})

// 상품 카테고리 수정 (관리자)
router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, briefDescription, detailedDescription } = req.body

    const result = await pool.query(
      `UPDATE product_categories SET
        name = $1, brief_description = $2, detailed_description = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *`,
      [name, briefDescription, detailedDescription, id]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('상품 카테고리 수정 오류:', error)
    res.status(500).json({ error: '상품 카테고리 수정 중 오류가 발생했습니다' })
  }
})

// 상품 카테고리 진열 상태 변경
router.patch('/categories/:id/display', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { displayStatus } = req.body

    const result = await pool.query(
      `UPDATE product_categories SET display_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [displayStatus, id]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('상품 카테고리 진열 상태 변경 오류:', error)
    res.status(500).json({ error: '상품 카테고리 진열 상태 변경 중 오류가 발생했습니다' })
  }
})

// 상품 조회
router.get('/', async (req, res) => {
  try {
    const { categoryId, displayStatus, memberType, startDate, endDate, searchType, searchKeyword, sortOrder = '등록일시순' } = req.query

    let query = `
      SELECT p.*, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.deleted = false
    `
    const params = []
    let paramIndex = 1

    // 날짜 필터 (등록일시 기준)
    if (startDate && endDate && startDate === endDate) {
      // 오늘처럼 시작일과 종료일이 같으면 해당 날짜만 검색
      query += ` AND p.created_at::date = $${paramIndex}::date`
      params.push(startDate)
      paramIndex++
    } else {
      if (startDate) {
        query += ` AND p.created_at >= $${paramIndex}`
        params.push(startDate)
        paramIndex++
      }
      if (endDate) {
        query += ` AND p.created_at <= $${paramIndex}::date + INTERVAL '1 day'`
        params.push(endDate)
        paramIndex++
      }
    }

    // 검색 필터
    if (searchKeyword && searchType) {
      if (searchType === '상품 카테고리명') {
        query += ` AND pc.name ILIKE $${paramIndex}`
        params.push(`%${searchKeyword}%`)
        paramIndex++
      } else if (searchType === '상품명') {
        query += ` AND p.name ILIKE $${paramIndex}`
        params.push(`%${searchKeyword}%`)
        paramIndex++
      } else if (searchType === '상품코드') {
        query += ` AND p.code ILIKE $${paramIndex}`
        params.push(`%${searchKeyword}%`)
        paramIndex++
      }
    }

    if (categoryId) {
      query += ` AND p.category_id = $${paramIndex}`
      params.push(categoryId)
      paramIndex++
    }

    if (displayStatus) {
      query += ` AND p.display_status = $${paramIndex}`
      params.push(displayStatus)
      paramIndex++
    }

    if (memberType) {
      if (memberType === '비사업자') {
        query += ` AND p.available_for_non_business = true`
      } else if (memberType === '개인 사업자') {
        query += ` AND p.available_for_individual_business = true`
      } else if (memberType === '법인 사업자') {
        query += ` AND p.available_for_corporate_business = true`
      }
    }

    // 정렬
    if (sortOrder === '등록일시순') {
      query += ' ORDER BY p.created_at ASC'
    } else if (sortOrder === '등록일시 역순') {
      query += ' ORDER BY p.created_at DESC'
    } else {
      query += ' ORDER BY p.created_at DESC'
    }

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('상품 조회 오류:', error)
    res.status(500).json({ error: '상품 조회 중 오류가 발생했습니다' })
  }
})

// 상품 등록 (관리자)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { categoryId, products } = req.body

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: '상품 정보가 필요합니다' })
    }

    const insertedProducts = []

    for (const product of products) {
      // 상품 코드 생성
      const countResult = await pool.query('SELECT COUNT(*) FROM products WHERE category_id = $1', [categoryId])
      const count = parseInt(countResult.rows[0].count) + 1
      const categoryResult = await pool.query('SELECT code FROM product_categories WHERE id = $1', [categoryId])
      const categoryCode = categoryResult.rows[0]?.code || 'cate01'
      const code = `${categoryCode}_${String(count).padStart(2, '0')}`

      // 첨부 서류를 JSON 배열로 저장
      const requiredDocuments = product.requiredDocuments && Array.isArray(product.requiredDocuments)
        ? JSON.stringify(product.requiredDocuments)
        : (product.requiredDocuments || null)

      const result = await pool.query(
        `INSERT INTO products (
          category_id, code, name, price, description, payment_description, required_documents,
          available_for_non_business, available_for_individual_business,
          available_for_corporate_business, display_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          categoryId,
          code,
          product.name,
          product.price,
          product.description,
          product.paymentDescription || null,
          requiredDocuments,
          product.availableForNonBusiness || false,
          product.availableForIndividualBusiness || false,
          product.availableForCorporateBusiness || false,
          '진열' // 기본값을 '진열'로 설정
        ]
      )

      insertedProducts.push(result.rows[0])
    }

    res.json({
      success: true,
      data: insertedProducts
    })
  } catch (error) {
    console.error('상품 등록 오류:', error)
    res.status(500).json({ error: '상품 등록 중 오류가 발생했습니다' })
  }
})

// 상품 수정
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { categoryId, name, price, description, paymentDescription, requiredDocuments, availableForNonBusiness, availableForIndividualBusiness, availableForCorporateBusiness } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '상품명이 필요합니다' })
    }

    const requiredDocumentsJson = requiredDocuments && Array.isArray(requiredDocuments)
      ? JSON.stringify(requiredDocuments)
      : (requiredDocuments || null)

    const result = await pool.query(
      `UPDATE products SET
        category_id = $1,
        name = $2,
        price = $3,
        description = $4,
        payment_description = $5,
        required_documents = $6,
        available_for_non_business = $7,
        available_for_individual_business = $8,
        available_for_corporate_business = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
      [
        categoryId,
        name.trim(),
        price || 0,
        description || null,
        paymentDescription || null,
        requiredDocumentsJson,
        availableForNonBusiness || false,
        availableForIndividualBusiness || false,
        availableForCorporateBusiness || false,
        id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('상품 수정 오류:', error)
    res.status(500).json({ error: '상품 수정 중 오류가 발생했습니다' })
  }
})

// 상품 진열 상태 변경
router.patch('/:id/display', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { displayStatus } = req.body

    const result = await pool.query(
      `UPDATE products SET display_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [displayStatus, id]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('상품 진열 상태 변경 오류:', error)
    res.status(500).json({ error: '상품 진열 상태 변경 중 오류가 발생했습니다' })
  }
})

export default router

