import express from 'express'
import pool from '../config/database.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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

// 휴대폰 번호 정규화
const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '')
const isValidKoreanPhone = (phone) => /^01\d{8,9}$/.test(phone)
const isValidPassword = (password) => /^[A-Za-z0-9]{6,20}$/.test(String(password || ''))
const SMS_CODE_TTL_MS = 5 * 60 * 1000 // 5분
const SMS_VERIFY_WINDOW_MS = 30 * 60 * 1000 // 인증 완료 후 30분 내 signup 유효

// SMS 인증 코드 발급
router.post('/sms/request', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phoneNumber)
    if (!phone || !isValidKoreanPhone(phone)) {
      return res.status(400).json({ error: '유효한 휴대폰 번호를 입력해 주세요' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MS)

    await pool.query(
      `INSERT INTO sms_verifications (phone_number, code, expires_at)
       VALUES ($1, $2, $3)`,
      [phone, code, expiresAt]
    )

    // TODO: 실제 SMS 발송 연동 (현재는 개발 환경에서 콘솔 출력 및 응답에 code 포함)
    console.log(`[SMS 인증] ${phone} → ${code} (만료 ${expiresAt.toISOString()})`)

    const payload = {
      success: true,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: Math.floor(SMS_CODE_TTL_MS / 1000),
    }
    if (process.env.NODE_ENV !== 'production') {
      payload.devCode = code
    }
    res.json(payload)
  } catch (error) {
    console.error('SMS 발송 오류:', error)
    res.status(500).json({ error: 'SMS 인증 요청 처리 중 오류가 발생했습니다' })
  }
})

// SMS 인증 코드 확인
router.post('/sms/verify', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phoneNumber)
    const code = String(req.body?.code || '').trim()

    if (!phone || !isValidKoreanPhone(phone)) {
      return res.status(400).json({ error: '유효한 휴대폰 번호를 입력해 주세요' })
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '6자리 숫자 인증코드를 입력해 주세요' })
    }

    const latest = await pool.query(
      `SELECT id, code, expires_at, attempts, verified
       FROM sms_verifications
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    )

    if (latest.rows.length === 0) {
      return res.status(400).json({ error: '인증 요청 이력이 없습니다. 인증번호 받기를 먼저 진행해 주세요' })
    }

    const record = latest.rows[0]

    if (record.verified) {
      return res.json({ success: true, verified: true })
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: '인증시간이 만료되었습니다. 다시 요청해 주세요' })
    }
    if ((record.attempts || 0) >= 5) {
      return res.status(429).json({ error: '인증 시도 횟수를 초과했습니다. 다시 요청해 주세요' })
    }

    if (record.code !== code) {
      await pool.query(
        'UPDATE sms_verifications SET attempts = attempts + 1 WHERE id = $1',
        [record.id]
      )
      return res.status(400).json({ error: '인증번호가 일치하지 않습니다' })
    }

    await pool.query(
      `UPDATE sms_verifications
       SET verified = true, verified_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [record.id]
    )

    res.json({ success: true, verified: true })
  } catch (error) {
    console.error('SMS 인증 오류:', error)
    res.status(500).json({ error: 'SMS 인증 처리 중 오류가 발생했습니다' })
  }
})

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body

    if (!phoneNumber) {
      return res.status(400).json({ error: '휴대폰 번호가 필요합니다' })
    }
    if (!password) {
      return res.status(400).json({ error: '비밀번호가 필요합니다' })
    }

    // 숫자만 추출
    const phone = phoneNumber.replace(/[^\d]/g, '')

    const result = await pool.query(
      'SELECT * FROM members WHERE phone_number = $1 AND deleted = false',
      [phone]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '등록되지 않은 회원입니다. 회원가입을 먼저 진행해 주세요' })
    }

    let member = result.rows[0]

    if (member.password_hash) {
      const ok = await bcrypt.compare(password, member.password_hash)
      if (!ok) {
        return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' })
      }
    } else {
      // 이전 버전으로 가입되어 비밀번호가 없는 회원: 첫 로그인 시 해당 비밀번호로 설정
      const hashed = await bcrypt.hash(password, 10)
      const upd = await pool.query(
        'UPDATE members SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [hashed, member.id]
      )
      member = upd.rows[0]
    }

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
      }
    }

    const token = jwt.sign(
      { id: member.id, phone },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      token,
      member: {
        id: member.id,
        phoneNumber: member.phone_number,
        memberType: member.member_type,
      },
    })
  } catch (error) {
    console.error('로그인 오류:', error)
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다' })
  }
})

// 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { phoneNumber, memberType, memberData, password } = req.body

    if (!phoneNumber || !memberType) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다' })
    }

    const phone = phoneNumber.replace(/[^\d]/g, '')

    // 기존 회원 확인
    const existingMember = await pool.query(
      'SELECT * FROM members WHERE phone_number = $1 AND deleted = false',
      [phone]
    )

    // 신규 회원가입이면 비밀번호 + SMS 인증 필수
    const isNewMember = existingMember.rows.length === 0
    let passwordHash = null

    if (isNewMember) {
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: '비밀번호는 6~20자의 영문 또는 숫자로 입력해 주세요' })
      }

      const verified = await pool.query(
        `SELECT id FROM sms_verifications
         WHERE phone_number = $1
           AND verified = true
           AND verified_at > NOW() - INTERVAL '30 minutes'
         ORDER BY verified_at DESC
         LIMIT 1`,
        [phone]
      )
      if (verified.rows.length === 0) {
        return res.status(400).json({ error: 'SMS 인증이 완료되지 않았습니다' })
      }

      passwordHash = await bcrypt.hash(password, 10)
    }

    if (existingMember.rows.length > 0) {
      // 기존 회원이 있는 경우, 새로운 회원 유형으로 추가
      const existingMemberRow = existingMember.rows[0]
      
      // 고객 ID 생성 (회원 유형과 현재 날짜 사용)
      const customerId = await generateCustomerId(memberType)

      // 기존 회원 정보 업데이트 (회원 유형별 정보 추가)
      const updateFields = []
      const updateValues = []
      let paramIndex = 1

      if (memberType === '비사업자') {
        if (memberData?.name) {
          updateFields.push(`name = $${paramIndex}`)
          updateValues.push(memberData.name)
          paramIndex++
        }
        if (memberData?.gender) {
          updateFields.push(`gender = $${paramIndex}`)
          updateValues.push(memberData.gender)
          paramIndex++
        }
        if (memberData?.residentNumber) {
          updateFields.push(`resident_number = $${paramIndex}`)
          updateValues.push(memberData.residentNumber)
          paramIndex++
        }
      } else {
        if (memberData?.businessName) {
          updateFields.push(`business_name = $${paramIndex}`)
          updateValues.push(memberData.businessName)
          paramIndex++
        }
        if (memberData?.representativeName) {
          updateFields.push(`representative_name = $${paramIndex}`)
          updateValues.push(memberData.representativeName)
          paramIndex++
        }
        if (memberData?.businessNumber) {
          updateFields.push(`business_number = $${paramIndex}`)
          updateValues.push(memberData.businessNumber)
          paramIndex++
        }
        if (memberData?.industry) {
          updateFields.push(`industry = $${paramIndex}`)
          updateValues.push(memberData.industry)
          paramIndex++
        }
        if (memberData?.businessType) {
          updateFields.push(`business_type = $${paramIndex}`)
          updateValues.push(memberData.businessType)
          paramIndex++
        }
        if (memberData?.startDate) {
          updateFields.push(`start_date = $${paramIndex}`)
          updateValues.push(memberData.startDate)
          paramIndex++
        }
      }

      if (memberData?.baseAddress !== undefined) {
        updateFields.push(`base_address = $${paramIndex}`)
        updateValues.push(memberData.baseAddress)
        paramIndex++
      }

      if (memberData?.detailAddress !== undefined) {
        updateFields.push(`detail_address = $${paramIndex}`)
        updateValues.push(memberData.detailAddress)
        paramIndex++
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
        updateValues.push(existingMemberRow.id)
        
        await pool.query(
          `UPDATE members SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        )
      }

      // member_types 테이블에 회원 유형 추가 (중복 체크)
      const existingMemberType = await pool.query(
        'SELECT * FROM member_types WHERE member_id = $1 AND member_type = $2',
        [existingMemberRow.id, memberType]
      )

      if (existingMemberType.rows.length === 0) {
        await pool.query(
          'INSERT INTO member_types (member_id, member_type, is_active) VALUES ($1, $2, $3)',
          [existingMemberRow.id, memberType, true]
        )
      }

      res.json({
        success: true,
        member: {
          id: existingMemberRow.id,
          phoneNumber: existingMemberRow.phone_number,
          memberType: memberType
        }
      })
    } else {
      // 신규 회원 가입
      // 고객 ID 생성 (회원 유형과 현재 날짜 사용)
      const customerId = await generateCustomerId(memberType)

      // 회원 정보 저장
      const result = await pool.query(
        `INSERT INTO members (
          customer_id, phone_number, member_type, name, business_name, 
          representative_name, business_number, industry, 
          business_type, base_address, detail_address, start_date, gender, resident_number,
          signup_method, has_info_input, password_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id, customer_id, phone_number, member_type, name, business_name,
          representative_name, business_number, industry, business_type, 
          base_address, detail_address, 
          TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
          signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted`,
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
          memberData?.baseAddress,
          memberData?.detailAddress,
          memberData?.startDate,
          memberData?.gender,
          memberData?.residentNumber,
          '회원 직접 가입',
          true,
          passwordHash,
        ]
      )

      // 날짜 필드는 이미 문자열로 변환됨
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
    }
  } catch (error) {
    console.error('회원가입 오류:', error)
    // UNIQUE 제약 조건 오류 처리
    if (error.code === '23505') {
      // phone_number가 이미 존재하는 경우 (이미 처리했지만 혹시 모를 경우)
      res.status(400).json({ error: '이미 등록된 전화번호입니다' })
    } else {
      res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다' })
    }
  }
})

export default router

