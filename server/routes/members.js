import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// 모든 회원 조회 (관리자)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortOrder = '등록일시순',
      startDate,
      endDate,
      searchType,
      searchKeyword,
      memberTypes,
      signupMethods
    } = req.query

    let query = 'SELECT * FROM members WHERE deleted = false'
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate && endDate) {
      query += ` AND created_at >= $${paramIndex} AND created_at <= $${paramIndex + 1}`
      params.push(startDate, endDate)
      paramIndex += 2
    }

    // 검색 필터
    if (searchKeyword) {
      if (searchType === '회원명') {
        query += ` AND (name ILIKE $${paramIndex} OR business_name ILIKE $${paramIndex})`
      } else if (searchType === '연락처') {
        query += ` AND phone_number ILIKE $${paramIndex}`
      }
      params.push(`%${searchKeyword}%`)
      paramIndex++
    }

    // 회원 유형 필터
    if (memberTypes) {
      const types = Array.isArray(memberTypes) ? memberTypes : [memberTypes]
      if (types.length > 0) {
        query += ` AND member_type = ANY($${paramIndex})`
        params.push(types)
        paramIndex++
      }
    }

    // 가입 방식 필터
    if (signupMethods) {
      const methods = Array.isArray(signupMethods) ? signupMethods : [signupMethods]
      if (methods.length > 0) {
        query += ` AND signup_method = ANY($${paramIndex})`
        params.push(methods)
        paramIndex++
      }
    }

    // 정렬
    if (sortOrder === '등록일시 역순') {
      query += ' ORDER BY created_at DESC'
    } else {
      query += ' ORDER BY created_at ASC'
    }

    // 페이지네이션
    const offset = (page - 1) * limit
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await pool.query(query, params)

    // 총 개수 조회
    const countQuery = query.replace(/SELECT \*/, 'SELECT COUNT(*)').replace(/ORDER BY.*$/, '').replace(/LIMIT.*$/, '')
    const countResult = await pool.query(countQuery, params.slice(0, -2))
    const total = parseInt(countResult.rows[0].count)

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('회원 조회 오류:', error)
    res.status(500).json({ error: '회원 조회 중 오류가 발생했습니다' })
  }
})

// 고객 ID 생성 함수
const generateCustomerId = async (memberType, signupDate = new Date()) => {
  try {
    // 회원 유형 코드 매핑
    const typeCodeMap = {
      '비사업자': '01',
      '개인 사업자': '02',
      '법인 사업자': '03'
    }
    
    const typeCode = typeCodeMap[memberType] || '01'
    
    // 날짜 형식: YYMMDD
    const date = new Date(signupDate)
    const year = String(date.getFullYear()).slice(-2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    
    // 해당 날짜에 가입한 회원 수 조회 (DATE 형식으로 변환)
    const dateOnly = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM members 
       WHERE created_at::date = $1::date
       AND member_type = $2`,
      [dateOnly, memberType]
    )
    
    const sequence = parseInt(countResult.rows[0].count) + 1
    const sequenceStr = String(sequence).padStart(3, '0')
    
    // 소문자 알파벳 임의 한 글자 생성
    const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
    
    let customerId = `${typeCode}${dateStr}${sequenceStr}${randomChar}`
    
    // 중복 확인 (혹시 모를 경우를 대비)
    let checkResult = await pool.query(
      'SELECT id FROM members WHERE customer_id = $1',
      [customerId]
    )
    
    if (checkResult.rows.length > 0) {
      // 중복이면 다른 알파벳으로 재시도
      const usedChars = new Set([randomChar])
      let attempts = 0
      
      while (attempts < 26) {
        let newRandomChar
        do {
          newRandomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
        } while (usedChars.has(newRandomChar) && usedChars.size < 26)
        
        usedChars.add(newRandomChar)
        customerId = `${typeCode}${dateStr}${sequenceStr}${newRandomChar}`
        
        checkResult = await pool.query(
          'SELECT id FROM members WHERE customer_id = $1',
          [customerId]
        )
        
        if (checkResult.rows.length === 0) {
          return customerId
        }
        
        attempts++
      }
      
      // 모든 알파벳을 시도했는데도 중복이면 순번 증가
      const newSequence = sequence + 1
      const newSequenceStr = String(newSequence).padStart(3, '0')
      customerId = `${typeCode}${dateStr}${newSequenceStr}${randomChar}`
    }
    
    return customerId
  } catch (error) {
    console.error('고객 ID 생성 오류:', error)
    throw error
  }
}

// 회원 등록 (관리자)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const memberData = req.body

    // 필수 필드 검증
    if (!memberData.memberType) {
      return res.status(400).json({ error: '회원 유형이 필요합니다' })
    }

    if (!memberData.phoneNumber) {
      return res.status(400).json({ error: '휴대폰 번호가 필요합니다' })
    }

    // 고객 ID 생성 (회원 유형과 현재 날짜 사용)
    const customerId = await generateCustomerId(memberData.memberType || '비사업자')

    // 전화번호 정규화
    const phoneNumber = memberData.phoneNumber?.replace(/[^\d]/g, '') || ''

    const result = await pool.query(
      `INSERT INTO members (
        customer_id, phone_number, member_type, name, business_name,
        representative_name, business_number, industry,
        business_type, address, start_date, signup_method, has_info_input
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        customerId,
        phoneNumber,
        memberData.memberType,
        memberData.name || memberData.representativeName || null,
        memberData.businessName || null,
        memberData.representativeName || null,
        memberData.businessNumber || null,
        memberData.industry || null,
        memberData.businessType || null,
        memberData.address || null,
        memberData.startDate || null,
        '관리자가 등록',
        true
      ]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('회원 등록 오류:', error)
    console.error('오류 상세:', error.message)
    console.error('오류 스택:', error.stack)
    
    // PostgreSQL 오류 메시지 추출
    let errorMessage = '회원 등록 중 오류가 발생했습니다'
    if (error.code === '23505') {
      errorMessage = '이미 등록된 휴대폰 번호입니다'
    } else if (error.code === '23502') {
      errorMessage = '필수 필드가 누락되었습니다'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    res.status(500).json({ error: errorMessage })
  }
})

// 회원 정보 수정
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const memberData = req.body

    const result = await pool.query(
      `UPDATE members SET
        name = $1, business_name = $2, representative_name = $3,
        business_number = $4, industry = $5, business_type = $6,
        address = $7, start_date = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *`,
      [
        memberData.name || memberData.representativeName,
        memberData.businessName,
        memberData.representativeName,
        memberData.businessNumber,
        memberData.industry,
        memberData.businessType,
        memberData.address,
        memberData.startDate,
        id
      ]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('회원 수정 오류:', error)
    res.status(500).json({ error: '회원 수정 중 오류가 발생했습니다' })
  }
})

// 회원 삭제 (출력만 제외)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    await pool.query(
      'UPDATE members SET deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('회원 삭제 오류:', error)
    res.status(500).json({ error: '회원 삭제 중 오류가 발생했습니다' })
  }
})

// 메모 조회
router.get('/:id/memos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      'SELECT * FROM memos WHERE member_id = $1 ORDER BY created_at DESC',
      [id]
    )

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('메모 조회 오류:', error)
    res.status(500).json({ error: '메모 조회 중 오류가 발생했습니다' })
  }
})

// 메모 추가
router.post('/:id/memos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body

    const result = await pool.query(
      'INSERT INTO memos (member_id, content) VALUES ($1, $2) RETURNING *',
      [id, content]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('메모 추가 오류:', error)
    res.status(500).json({ error: '메모 추가 중 오류가 발생했습니다' })
  }
})

// 메모 삭제
router.delete('/:id/memos/:memoId', authenticateToken, async (req, res) => {
  try {
    const { memoId } = req.params

    await pool.query('DELETE FROM memos WHERE id = $1', [memoId])

    res.json({ success: true })
  } catch (error) {
    console.error('메모 삭제 오류:', error)
    res.status(500).json({ error: '메모 삭제 중 오류가 발생했습니다' })
  }
})

export default router

