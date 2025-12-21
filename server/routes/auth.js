import express from 'express'
import pool from '../config/database.js'
import jwt from 'jsonwebtoken'

const router = express.Router()

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

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body

    if (!phoneNumber) {
      return res.status(400).json({ error: '휴대폰 번호가 필요합니다' })
    }

    // 숫자만 추출
    const phone = phoneNumber.replace(/[^\d]/g, '')

    // 회원 조회 또는 생성
    let result = await pool.query(
      'SELECT * FROM members WHERE phone_number = $1',
      [phone]
    )

    let member
    if (result.rows.length === 0) {
      // 회원이 없으면 생성
      try {
        const customerId = await generateCustomerId('비사업자')
        const insertResult = await pool.query(
          `INSERT INTO members (customer_id, phone_number, member_type, signup_method) 
           VALUES ($1, $2, $3, $4) 
           RETURNING *`,
          [customerId, phone, '비사업자', '회원 직접 가입']
        )
        member = insertResult.rows[0]
      } catch (insertError) {
        console.error('회원 생성 오류:', insertError)
        throw insertError
      }
    } else {
      member = result.rows[0]
      // 기존 회원에 customer_id가 없으면 생성
      if (!member.customer_id) {
        try {
          const createdDate = member.created_at ? new Date(member.created_at) : new Date()
          const customerId = await generateCustomerId(member.member_type || '비사업자', createdDate)
          const updateResult = await pool.query(
            'UPDATE members SET customer_id = $1 WHERE id = $2 RETURNING *',
            [customerId, member.id]
          )
          member = updateResult.rows[0]
        } catch (updateError) {
          console.error('고객 ID 업데이트 오류:', updateError)
          // 고객 ID 업데이트 실패해도 로그인은 진행
        }
      }
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: member.id, phone: phone },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      token,
      member: {
        id: member.id,
        phoneNumber: member.phone_number,
        memberType: member.member_type
      }
    })
  } catch (error) {
    console.error('로그인 오류:', error)
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다' })
  }
})

// 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { phoneNumber, memberType, memberData } = req.body

    if (!phoneNumber || !memberType) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다' })
    }

    const phone = phoneNumber.replace(/[^\d]/g, '')

    // 고객 ID 생성 (회원 유형과 현재 날짜 사용)
    const customerId = await generateCustomerId(memberType)

    // 회원 정보 저장
    const result = await pool.query(
      `INSERT INTO members (
        customer_id, phone_number, member_type, name, business_name, 
        representative_name, business_number, industry, 
        business_type, address, start_date, gender, resident_number,
        signup_method, has_info_input
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        customerId,
        phone,
        memberType,
        memberData?.name || memberData?.representativeName,
        memberData?.businessName,
        memberData?.representativeName,
        memberData?.businessNumber,
        memberData?.industry,
        memberData?.businessType,
        memberData?.address,
        memberData?.startDate,
        memberData?.gender,
        memberData?.residentNumber,
        '회원 직접 가입',
        true
      ]
    )

    const member = result.rows[0]

    // 회원 유형 추가
    await pool.query(
      'INSERT INTO member_types (member_id, member_type, is_active) VALUES ($1, $2, $3)',
      [member.id, memberType, true]
    )

    const token = jwt.sign(
      { id: member.id, phone: phone },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      token,
      member: {
        id: member.id,
        phoneNumber: member.phone_number,
        memberType: member.member_type
      }
    })
  } catch (error) {
    console.error('회원가입 오류:', error)
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다' })
  }
})

export default router

