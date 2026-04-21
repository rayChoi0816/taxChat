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

    let query = `SELECT id, customer_id, phone_number, member_type, name, business_name,
        representative_name, business_number, industry, business_type, 
        base_address, detail_address, 
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted
      FROM members WHERE deleted = false`
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
      // 쿼리 파라미터가 배열로 전달되거나 문자열로 전달될 수 있음
      let types = []
      if (Array.isArray(memberTypes)) {
        types = memberTypes
      } else if (typeof memberTypes === 'string') {
        // 쉼표로 구분된 문자열인 경우
        types = memberTypes.split(',').map(t => t.trim()).filter(t => t)
      } else {
        types = [memberTypes]
      }
      
      if (types.length > 0) {
        query += ` AND member_type = ANY($${paramIndex})`
        params.push(types)
        paramIndex++
      }
    }

    // 가입 방식 필터
    if (signupMethods) {
      // 쿼리 파라미터가 배열로 전달되거나 문자열로 전달될 수 있음
      let methods = []
      if (Array.isArray(signupMethods)) {
        methods = signupMethods
      } else if (typeof signupMethods === 'string') {
        // 쉼표로 구분된 문자열인 경우
        methods = signupMethods.split(',').map(m => m.trim()).filter(m => m)
      } else {
        methods = [signupMethods]
      }
      
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

    // 총 개수 조회 - WHERE 절과 파라미터만 사용하여 카운트
    let countQuery = `SELECT COUNT(*) as count FROM members WHERE deleted = false`
    const countParams = []
    let countParamIndex = 1

    // 날짜 필터
    if (startDate && endDate) {
      countQuery += ` AND created_at >= $${countParamIndex} AND created_at <= $${countParamIndex + 1}`
      countParams.push(startDate, endDate)
      countParamIndex += 2
    }

    // 검색 필터
    if (searchKeyword) {
      if (searchType === '회원명') {
        countQuery += ` AND (name ILIKE $${countParamIndex} OR business_name ILIKE $${countParamIndex})`
      } else if (searchType === '연락처') {
        countQuery += ` AND phone_number ILIKE $${countParamIndex}`
      }
      countParams.push(`%${searchKeyword}%`)
      countParamIndex++
    }

    // 회원 유형 필터
    if (memberTypes) {
      let types = []
      if (Array.isArray(memberTypes)) {
        types = memberTypes
      } else if (typeof memberTypes === 'string') {
        types = memberTypes.split(',').map(t => t.trim()).filter(t => t)
      } else {
        types = [memberTypes]
      }
      
      if (types.length > 0) {
        countQuery += ` AND member_type = ANY($${countParamIndex})`
        countParams.push(types)
        countParamIndex++
      }
    }

    // 가입 방식 필터
    if (signupMethods) {
      let methods = []
      if (Array.isArray(signupMethods)) {
        methods = signupMethods
      } else if (typeof signupMethods === 'string') {
        methods = signupMethods.split(',').map(m => m.trim()).filter(m => m)
      } else {
        methods = [signupMethods]
      }
      
      if (methods.length > 0) {
        countQuery += ` AND signup_method = ANY($${countParamIndex})`
        countParams.push(methods)
        countParamIndex++
      }
    }

    const countResult = await pool.query(countQuery, countParams)
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
    console.error('오류 상세:', error.message)
    console.error('오류 스택:', error.stack)
    res.status(500).json({ 
      error: '회원 조회 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
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
        business_type, base_address, detail_address, start_date, signup_method, has_info_input
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, customer_id, phone_number, member_type, name, business_name,
        representative_name, business_number, industry, business_type, 
        base_address, detail_address, 
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted`,
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
        memberData.baseAddress || null,
        memberData.detailAddress || null,
        memberData.startDate || null,
        '관리자가 등록',
        true
      ]
    )

    // 날짜 필드는 이미 문자열로 변환됨
    const member = result.rows[0]

    res.json({
      success: true,
      data: member
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

    // 업데이트할 필드와 값 동적 생성
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (memberData.memberType !== undefined) {
      updateFields.push(`member_type = $${paramIndex}`)
      updateValues.push(memberData.memberType)
      paramIndex++
    }

    if (memberData.name !== undefined || memberData.representativeName !== undefined) {
      updateFields.push(`name = $${paramIndex}`)
      updateValues.push(memberData.name || memberData.representativeName)
      paramIndex++
    }

    if (memberData.businessName !== undefined) {
      updateFields.push(`business_name = $${paramIndex}`)
      updateValues.push(memberData.businessName)
      paramIndex++
    }

    if (memberData.representativeName !== undefined) {
      updateFields.push(`representative_name = $${paramIndex}`)
      updateValues.push(memberData.representativeName)
      paramIndex++
    }

    if (memberData.businessNumber !== undefined) {
      updateFields.push(`business_number = $${paramIndex}`)
      updateValues.push(memberData.businessNumber)
      paramIndex++
    }

    if (memberData.industry !== undefined) {
      updateFields.push(`industry = $${paramIndex}`)
      updateValues.push(memberData.industry)
      paramIndex++
    }

    if (memberData.businessType !== undefined) {
      updateFields.push(`business_type = $${paramIndex}`)
      updateValues.push(memberData.businessType)
      paramIndex++
    }

    if (memberData.baseAddress !== undefined) {
      updateFields.push(`base_address = $${paramIndex}`)
      updateValues.push(memberData.baseAddress)
      paramIndex++
    }

    if (memberData.detailAddress !== undefined) {
      updateFields.push(`detail_address = $${paramIndex}`)
      updateValues.push(memberData.detailAddress)
      paramIndex++
    }

    if (memberData.startDate !== undefined) {
      updateFields.push(`start_date = $${paramIndex}`)
      updateValues.push(memberData.startDate)
      paramIndex++
    }

    if (memberData.gender !== undefined) {
      updateFields.push(`gender = $${paramIndex}`)
      updateValues.push(memberData.gender)
      paramIndex++
    }

    if (memberData.residentNumber !== undefined) {
      updateFields.push(`resident_number = $${paramIndex}`)
      updateValues.push(memberData.residentNumber)
      paramIndex++
    }

    if (memberData.phoneNumber !== undefined) {
      updateFields.push(`phone_number = $${paramIndex}`)
      updateValues.push(memberData.phoneNumber.replace(/[^\d]/g, ''))
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 정보가 없습니다' })
    }

    // updated_at 항상 업데이트
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(id)

    const query = `
      UPDATE members SET
        ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, customer_id, phone_number, member_type, name, business_name,
        representative_name, business_number, industry, business_type, 
        base_address, detail_address, 
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted
    `

    const result = await pool.query(query, updateValues)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '회원을 찾을 수 없습니다' })
    }

    // 날짜 필드는 이미 문자열로 변환됨
    const member = result.rows[0]

    res.json({
      success: true,
      data: member
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

// 특정 회원의 회원 유형 목록 조회
router.get('/:id/member-types', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // 먼저 회원 정보 조회
    const memberResult = await pool.query(
      `SELECT id, customer_id, phone_number, member_type, name, business_name,
        representative_name, business_number, industry, business_type, 
        base_address, detail_address, 
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted
      FROM members WHERE id = $1 AND deleted = false`,
      [id]
    )

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: '회원을 찾을 수 없습니다' })
    }

    const member = memberResult.rows[0]

    // member_types 테이블에서 해당 회원의 모든 회원 유형 조회
    const result = await pool.query(
      `SELECT 
        mt.member_type,
        mt.is_active,
        mt.created_at
      FROM member_types mt
      WHERE mt.member_id = $1
      ORDER BY mt.created_at ASC`,
      [id]
    )

    // 각 회원 유형에 대한 정보를 members 테이블에서 조회
    // 같은 phone_number로 여러 회원 유형을 가질 수 있으므로, 
    // member_types 테이블의 member_type을 기준으로 members 테이블에서 정보 조회
    const memberTypes = []
    
    for (const row of result.rows) {
      // 같은 phone_number와 member_type을 가진 회원 정보 조회
      const memberInfoResult = await pool.query(
        `SELECT 
          m.id,
          m.customer_id,
          m.name,
          m.business_name,
          m.representative_name,
          m.base_address,
          m.detail_address,
          TO_CHAR(m.start_date, 'YYYY-MM-DD') as start_date,
          m.gender,
          m.resident_number
        FROM members m
        WHERE m.phone_number = $1 AND m.member_type = $2 AND m.deleted = false
        LIMIT 1`,
        [member.phone_number, row.member_type]
      )

      const memberInfo = memberInfoResult.rows[0] || member
      
      // 날짜 필드는 이미 문자열로 변환됨
      const startDate = memberInfo.start_date
      
      memberTypes.push({
        id: memberInfo.id,
        customerId: memberInfo.customer_id,
        phoneNumber: member.phone_number,
        type: row.member_type,
        isActive: row.is_active,
        name: row.member_type === '비사업자' 
          ? (memberInfo.name || '회원') 
          : (memberInfo.business_name || memberInfo.representative_name || '회원'),
        businessName: memberInfo.business_name,
        representativeName: memberInfo.representative_name,
        baseAddress: memberInfo.base_address,
        detailAddress: memberInfo.detail_address,
        startDate: startDate,
        gender: memberInfo.gender,
        residentNumber: memberInfo.resident_number,
        createdAt: row.created_at
      })
    }

    res.json({
      success: true,
      data: memberTypes
    })
  } catch (error) {
    console.error('회원 유형 목록 조회 오류:', error)
    res.status(500).json({ error: '회원 유형 목록 조회 중 오류가 발생했습니다' })
  }
})

// 특정 회원 조회 (memos 라우트보다 뒤에 정의해야 함)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `SELECT id, customer_id, phone_number, member_type, name, business_name,
        representative_name, business_number, industry, business_type, 
        base_address, detail_address, 
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted
      FROM members WHERE id = $1 AND deleted = false`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '회원을 찾을 수 없습니다' })
    }

    // 날짜 필드는 이미 문자열로 변환됨
    const member = result.rows[0]

    res.json({
      success: true,
      data: member
    })
  } catch (error) {
    console.error('회원 조회 오류:', error)
    res.status(500).json({ error: '회원 조회 중 오류가 발생했습니다' })
  }
})

export default router

