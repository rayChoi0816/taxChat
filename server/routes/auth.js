import express from 'express'
import pool from '../config/database.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import {
  sendSms,
  sendLms,
  sendAlimtalk,
  buildVerificationMessage,
  buildSignupAdminAlimtalkRequest,
} from '../services/sms.js'
import { getConfiguredTestPhoneDigits, getTestModeFromDB } from '../services/testModeService.js'

// 회원가입 알림(카카오 알림톡)을 받을 관리자 번호.
// 콤마(,) 로 여러 번호 등록 가능. 비어 있으면 알림 발송 생략.
const getAdminNotifyPhones = () => {
  return String(process.env.ADMIN_NOTIFY_PHONE || '')
    .split(',')
    .map((s) => s.replace(/[^\d]/g, ''))
    .filter(Boolean)
}

// 회원가입 직후 비동기로 관리자에게 알림톡 발송.
// 실패해도 회원가입 응답에는 영향을 주지 않는다(알림은 보조 기능).
// - 운영: ADMIN_NOTIFY_PHONE 목록으로 발송 (여러 건 가능).
// - 테스트 모드(DB/관리자 설정): 목록과 관계없이 테스트 수신 번호로 1건만 발송
//   (ADMIN_NOTIFY 가 비어 있어도 테스트 번호로 발송되도록 처리).
const notifyAdminSignup = (payload) => {
  void (async () => {
    let phones = getAdminNotifyPhones()
    let testModeActive = false
    try {
      const isTestMode = await getTestModeFromDB()
      testModeActive = isTestMode
      if (isTestMode) {
        const testPhone = await getConfiguredTestPhoneDigits()
        phones = [testPhone]
        console.log(
          `[회원가입 알림] 테스트 모드: 관리자 알림만 ${testPhone} 로 라우팅(뿌리오 실호출·모의발송 아님). 카카오는 앱 「알림톡」함·채널 상태를 확인하세요.`
        )
      } else if (phones.length === 0) {
        console.warn(
          '[회원가입 알림] 수신 번호 미설정: .env 에 ADMIN_NOTIFY_PHONE(숫자만, 콤마 구분)을 넣어야 알림톡/LMS가 발송됩니다.'
        )
        return
      }
    } catch (err) {
      console.error('[회원가입 알림] 테스트 모드/번호 조회 실패:', err.message || err)
      phones = getAdminNotifyPhones()
      if (phones.length === 0) {
        console.warn(
          '[회원가입 알림] 수신 번호 미설정으로 발송을 건넜습니다. ADMIN_NOTIFY_PHONE 또는 테스트 모드를 확인하세요.'
        )
        return
      }
    }

    const textPayload = buildSignupAdminAlimtalkRequest(payload)

    const parallelLmsInTest =
      testModeActive &&
      ['1', 'true', 'yes', 'y', 'on'].includes(
        String(process.env.ADMIN_SIGNUP_PARALLEL_LMS_IN_TESTMODE || '')
          .trim()
          .toLowerCase()
      )

    if (testModeActive && !parallelLmsInTest) {
      console.log(
        '[회원가입 알림] 알림톡이 code=1000 으로 성공하면 문자(LMS 대체)는 가지 않는 것이 정상입니다. 테스트 중 문자도 받으려면 환경변수 ADMIN_SIGNUP_PARALLEL_LMS_IN_TESTMODE=true 를 켜세요.'
      )
    }

    console.log(`[회원가입 알림] 수신처 ${phones.length}건 발송 시도`)
    const subjectSignup = '[택스챗] 신규 회원가입'
    for (const to of phones) {
      sendAlimtalk({
        to,
        text: textPayload.text,
        subject: subjectSignup,
        changeWord: textPayload.changeWord,
        ppurioIsResend: textPayload.ppurioIsResend,
        lmsFallbackBody: textPayload.plainText,
      })
        .then(async (r) => {
          console.log(`[회원가입 알림] 요청수신=${to} 결과채널=${r.channel}`)
          if (parallelLmsInTest && r.channel === 'ALT' && textPayload.plainText) {
            try {
              await sendLms({
                to,
                subject: subjectSignup.slice(0, 30),
                text: textPayload.plainText,
              })
              console.log(
                '[회원가입 알림] 테스트 모드 LMS 병행 발송 완료(ADMIN_SIGNUP_PARALLEL_LMS_IN_TESTMODE)'
              )
            } catch (err) {
              console.warn('[회원가입 알림] 테스트 모드 LMS 병행 실패:', err.message || err)
            }
          }
        })
        .catch((err) =>
          console.error('[회원가입 알림 실패]', err.message, err.detail || '')
        )
    }
  })()
}

const router = express.Router()

// 고객 ID 생성 함수
const generateCustomerId = async (memberType, signupDate = new Date()) => {
  try {
    // 회원 유형 코드 매핑
    const typeCodeMap = {
      '비사업자': '01',
      '개인 사업자': '02',
      '법인 사업자': '03',
      '개인사업자': '02',
      '법인사업자': '03',
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

// 관리자 로그인 (비밀번호만)
router.post('/admin-login', (req, res) => {
  try {
    const { password } = req.body || {}
    const expected = process.env.ADMIN_PASSWORD || '6369'

    if (String(password || '') !== String(expected)) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' })
    }

    const token = jwt.sign(
      { role: 'admin', isAdmin: true },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    )

    res.json({ success: true, token })
  } catch (error) {
    console.error('관리자 로그인 오류:', error)
    res.status(500).json({ error: '관리자 로그인 처리 중 오류가 발생했습니다' })
  }
})

// ============================================================================
// 휴대폰 SMS 인증 (회원가입용)
// ----------------------------------------------------------------------------
// ★ 보안 원칙
//   - 뿌리오 API 키(PPURIO_*)는 절대 브라우저로 내려가지 않습니다.
//   - 브라우저 → (이 Express 서버) → 뿌리오 순서로만 호출이 흐릅니다.
//   - 따라서 SMS 발송에 관련된 모든 외부 호출(axios)은 services/sms.js
//     안에서만 일어나고, 프론트 코드는 우리 서버 API(/api/auth/send,
//     /api/auth/verify) 두 개만 호출하도록 약속합니다.
//
// ★ 흐름
//   1) 사용자가 휴대폰 번호를 입력 → POST /api/auth/send  { phone }
//      → 서버가 6자리 인증번호 만들고 DB에 저장 + 뿌리오로 문자 발송
//   2) 사용자가 받은 6자리 숫자를 입력 → POST /api/auth/verify  { phone, code }
//      → 서버가 DB의 코드/만료시간과 비교해서 맞으면 verified=true 로 업데이트
//   3) 위에서 verified 로 저장된 전화번호만 회원가입(/signup) 성공
// ============================================================================

// 휴대폰 번호에서 숫자만 뽑아내기 (010-1234-5678 → 01012345678)
const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '')
// 010 / 011 ... 같은 한국 휴대폰 형식 체크
const isValidKoreanPhone = (phone) => /^01\d{8,9}$/.test(phone)
// 비밀번호 규칙: 영문 또는 숫자 또는 특수문자 6~20자
//  - 공백을 제외한 ASCII 출력 가능 문자(0x21~0x7E) 만 허용합니다.
const isValidPassword = (password) => /^[\x21-\x7E]{6,20}$/.test(String(password || ''))

// 인증번호는 "발송 후 3분" 까지만 유효합니다. (요구사항)
const SMS_CODE_TTL_MS = 3 * 60 * 1000
// 인증 성공 후에는 "30분 안에" 회원가입까지 끝내야 해요.
const SMS_VERIFY_WINDOW_MINUTES = 30
// 인증번호 입력 시도 최대 횟수 (무차별 대입 방지)
const SMS_MAX_ATTEMPTS = 5

/**
 * [POST /api/auth/send] 인증번호 발송
 *   - body: { phone }
 *   - 동작:
 *     1) phone 유효성 검사
 *     2) 6자리 코드 생성
 *     3) sms_verifications 테이블에 (phone, code, expires_at, verified=false) 저장
 *     4) services/sms.js 의 sendSms() 가 axios 로 뿌리오 호출 → 실제 문자 발송
 *     5) 발송 실패 시 방금 저장한 레코드는 DELETE 해서 더미 데이터를 남기지 않음
 *
 * 구버전 호환을 위해 phoneNumber 키도 받지만, 신규 클라이언트는 phone 만 사용.
 */
const handleSendSmsCode = async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone ?? req.body?.phoneNumber)
    if (!phone || !isValidKoreanPhone(phone)) {
      return res.status(400).json({ error: '유효한 휴대폰 번호를 입력해 주세요' })
    }

    // 활동 중인(탈퇴하지 않은) 회원이 이미 쓰는 번호면 SMS 발송 차단 — 탈퇴 회원 번호는 재인증 허용
    const dupActive = await pool.query(
      'SELECT id FROM members WHERE phone_number = $1 AND deleted = false',
      [phone]
    )
    if (dupActive.rows.length > 0) {
      return res.status(409).json({ error: '이미 가입된 휴대폰번호입니다.' })
    }

    // 100000 ~ 999999 사이의 6자리 랜덤 숫자
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MS)

    // DB 에 먼저 저장 — 발송이 실패하면 바로 삭제해서 불필요한 레코드를 남기지 않습니다.
    const inserted = await pool.query(
      `INSERT INTO sms_verifications (phone_number, code, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [phone, code, expiresAt]
    )
    const insertedId = inserted.rows[0]?.id

    // 실제 SMS 발송 (뿌리오). 실패 시 방금 저장한 레코드를 되돌립니다.
    try {
      await sendSms({ to: phone, text: buildVerificationMessage(code) })
    } catch (smsErr) {
      if (insertedId) {
        await pool.query('DELETE FROM sms_verifications WHERE id = $1', [insertedId]).catch(() => {})
      }
      console.error('SMS 발송 실패:', smsErr.message, smsErr.detail || '')

      // 프론트(브라우저) 에서 바로 원인을 파악할 수 있도록 구조화해서 돌려줍니다.
      //   success : 언제나 false
      //   error   : 표준 에러 코드 (예: "SMS_SEND_FAILED")
      //   detail  : 뿌리오가 돌려준 본문 또는 간략 메시지
      //   serverIp: "invalid ip" 오류일 때 등록해야 할 서버 IP
      const detailText =
        smsErr.ppurioMessage ||
        (typeof smsErr.detail === 'string'
          ? smsErr.detail
          : smsErr.detail
            ? JSON.stringify(smsErr.detail)
            : smsErr.message)

      const payload = {
        success: false,
        error: 'SMS_SEND_FAILED',
        detail: detailText,
      }
      if (smsErr.serverIp) {
        payload.serverIp = smsErr.serverIp
      }
      return res.status(502).json(payload)
    }

    const payload = {
      success: true,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: Math.floor(SMS_CODE_TTL_MS / 1000),
    }
    // 개발 환경에서는 테스트 편의를 위해 코드 값을 응답에도 담아줍니다.
    if (process.env.NODE_ENV !== 'production') {
      payload.devCode = code
    }
    res.json(payload)
  } catch (error) {
    console.error('SMS 발송 오류:', error)
    res.status(500).json({ error: 'SMS 인증 요청 처리 중 오류가 발생했습니다' })
  }
}

/**
 * [POST /api/auth/verify] 인증번호 검증
 *   - body: { phone, code }
 *   - 동작: 가장 최근 발급 내역을 DB 에서 가져와 코드/만료/시도횟수를 검증
 *           성공 시 verified=true, verified_at=NOW() 로 업데이트
 */
const handleVerifySmsCode = async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone ?? req.body?.phoneNumber)
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

    // 이미 인증 완료된 건이면 그대로 성공 응답
    if (record.verified) {
      return res.json({ success: true, verified: true })
    }
    // 3분 만료 체크
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: '인증시간이 만료되었습니다. 다시 요청해 주세요' })
    }
    // 시도 횟수 제한
    if ((record.attempts || 0) >= SMS_MAX_ATTEMPTS) {
      return res.status(429).json({ error: '인증 시도 횟수를 초과했습니다. 다시 요청해 주세요' })
    }

    // 코드가 틀리면 시도 횟수만 올리고 실패 응답
    if (record.code !== code) {
      await pool.query(
        'UPDATE sms_verifications SET attempts = attempts + 1 WHERE id = $1',
        [record.id]
      )
      return res.status(400).json({ error: '인증번호가 일치하지 않습니다' })
    }

    // 성공! verified=true 로 업데이트 → 회원가입 API 에서 이 값을 확인합니다.
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
}

// 기본 엔드포인트 (요구사항에서 명시한 경로)
router.post('/send', handleSendSmsCode)
router.post('/verify', handleVerifySmsCode)

// 하위 호환 alias — 기존 프론트엔드 코드가 바로 깨지지 않도록 남겨둡니다.
router.post('/sms/request', handleSendSmsCode)
router.post('/sms/verify', handleVerifySmsCode)

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

    const existingByPhone = await pool.query('SELECT * FROM members WHERE phone_number = $1', [phone])
    const existingRow = existingByPhone.rows[0]

    if (existingRow && !existingRow.deleted) {
      // 기존 회원이 있는 경우, 새로운 회원 유형으로 추가
      const existingMemberRow = existingRow

      // 새로 추가하는 회원 유형 전용 customer_id (예: 02260422003c)
      // - members.customer_id 는 "첫 가입 유형" 의 ID 라서 그대로 두고,
      //   이번에 새로 추가되는 유형의 ID 는 member_types 행에 저장합니다.
      const newTypeCustomerId = await generateCustomerId(memberType)

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

      // member_types 테이블에 회원 유형 추가 (중복 체크 + customer_id 부여)
      // ★ type 별 회원 정보(이름/사업자명 등)를 member_types 행에도 함께 저장해서
      //    같은 회원이 여러 유형을 가입해도 각 행이 자기 정보를 그대로 보존하도록 합니다.
      const existingMemberType = await pool.query(
        'SELECT id, customer_id FROM member_types WHERE member_id = $1 AND member_type = $2',
        [existingMemberRow.id, memberType]
      )

      if (existingMemberType.rows.length === 0) {
        await pool.query(
          `INSERT INTO member_types (
             member_id, member_type, customer_id, is_active,
             name, gender, resident_number,
             business_name, representative_name, business_number,
             industry, business_type, base_address, detail_address, start_date
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            existingMemberRow.id,
            memberType,
            newTypeCustomerId,
            true,
            memberData?.name || null,
            memberData?.gender || null,
            memberData?.residentNumber || null,
            memberData?.businessName || null,
            memberData?.representativeName || null,
            memberData?.businessNumber || null,
            memberData?.industry || null,
            memberData?.businessType || null,
            memberData?.baseAddress || null,
            memberData?.detailAddress || null,
            memberData?.startDate || null,
          ]
        )
      } else {
        // 같은 type 이 이미 있으면 정보만 갱신
        await pool.query(
          `UPDATE member_types SET
             customer_id = COALESCE(customer_id, $2),
             name = COALESCE($3, name),
             gender = COALESCE($4, gender),
             resident_number = COALESCE($5, resident_number),
             business_name = COALESCE($6, business_name),
             representative_name = COALESCE($7, representative_name),
             business_number = COALESCE($8, business_number),
             industry = COALESCE($9, industry),
             business_type = COALESCE($10, business_type),
             base_address = COALESCE($11, base_address),
             detail_address = COALESCE($12, detail_address),
             start_date = COALESCE($13, start_date)
           WHERE id = $1`,
          [
            existingMemberType.rows[0].id,
            newTypeCustomerId,
            memberData?.name || null,
            memberData?.gender || null,
            memberData?.residentNumber || null,
            memberData?.businessName || null,
            memberData?.representativeName || null,
            memberData?.businessNumber || null,
            memberData?.industry || null,
            memberData?.businessType || null,
            memberData?.baseAddress || null,
            memberData?.detailAddress || null,
            memberData?.startDate || null,
          ]
        )
      }

      // 관리자에게 카카오 알림톡 발송 (기존회원이 새 회원유형 추가)
      notifyAdminSignup({
        customerId: existingMemberType.rows[0]?.customer_id || newTypeCustomerId,
        memberType,
        name:
          memberData?.name ||
          memberData?.representativeName ||
          memberData?.businessName ||
          existingMemberRow.name ||
          '',
        phone: existingMemberRow.phone_number,
        signupAt: new Date(),
      })

      res.json({
        success: true,
        member: {
          id: existingMemberRow.id,
          phoneNumber: existingMemberRow.phone_number,
          memberType: memberType
        }
      })
    } else {
      // 완전 신규 또는 탈퇴한 동일 번호 재가입 — 비밀번호 + SMS 인증 필수
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: '비밀번호는 6~20자의 영문 또는 숫자 또는 특수문자로 입력해 주세요' })
      }

      const verified = await pool.query(
        `SELECT id FROM sms_verifications
         WHERE phone_number = $1
           AND verified = true
           AND verified_at > NOW() - ($2 || ' minutes')::interval
         ORDER BY verified_at DESC
         LIMIT 1`,
        [phone, String(SMS_VERIFY_WINDOW_MINUTES)]
      )
      if (verified.rows.length === 0) {
        return res.status(400).json({ error: 'SMS 인증이 완료되지 않았습니다' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const isRejoinWithdrawn = existingRow?.deleted === true

      if (isRejoinWithdrawn) {
        const customerId = await generateCustomerId(memberType)
        const withdrawnId = existingRow.id
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await client.query('DELETE FROM member_types WHERE member_id = $1', [withdrawnId])

          const upd = await client.query(
            `UPDATE members SET
               deleted = false,
               password_hash = $1,
               member_type = $2,
               customer_id = $3,
               name = $4,
               business_name = $5,
               representative_name = $6,
               business_number = $7,
               industry = $8,
               business_type = $9,
               base_address = $10,
               detail_address = $11,
               start_date = $12,
               gender = $13,
               resident_number = $14,
               signup_method = $15,
               has_info_input = $16,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $17
             RETURNING id, customer_id, phone_number, member_type, name, business_name,
               representative_name, business_number, industry, business_type,
               base_address, detail_address,
               TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
               signup_method, has_info_input, created_at, updated_at, gender, resident_number, deleted`,
            [
              passwordHash,
              memberType,
              customerId,
              memberData?.name || memberData?.representativeName,
              memberData?.businessName,
              memberData?.representativeName,
              memberData?.businessNumber,
              memberData?.industry,
              memberData?.businessType,
              memberData?.baseAddress,
              memberData?.detailAddress,
              memberData?.startDate || null,
              memberData?.gender,
              memberData?.residentNumber,
              '회원 직접 가입',
              true,
              withdrawnId,
            ]
          )
          const member = upd.rows[0]

          await client.query(
            `INSERT INTO member_types (
               member_id, member_type, customer_id, is_active,
               name, gender, resident_number,
               business_name, representative_name, business_number,
               industry, business_type, base_address, detail_address, start_date
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              member.id,
              memberType,
              customerId,
              true,
              memberData?.name || null,
              memberData?.gender || null,
              memberData?.residentNumber || null,
              memberData?.businessName || null,
              memberData?.representativeName || null,
              memberData?.businessNumber || null,
              memberData?.industry || null,
              memberData?.businessType || null,
              memberData?.baseAddress || null,
              memberData?.detailAddress || null,
              memberData?.startDate || null,
            ]
          )
          await client.query('COMMIT')

          const token = jwt.sign(
            { id: member.id, phone: phone },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
          )

          notifyAdminSignup({
            customerId: member.customer_id,
            memberType: member.member_type,
            name:
              member.name ||
              memberData?.representativeName ||
              memberData?.businessName ||
              '',
            phone: member.phone_number,
            signupAt: member.created_at || new Date(),
          })

          res.json({
            success: true,
            token,
            member: {
              id: member.id,
              phoneNumber: member.phone_number,
              memberType: member.member_type
            }
          })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }
      } else {
        // 완전 신규 회원 가입 (INSERT)
        const customerId = await generateCustomerId(memberType)

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

        const member = result.rows[0]

        await pool.query(
          `INSERT INTO member_types (
             member_id, member_type, customer_id, is_active,
             name, gender, resident_number,
             business_name, representative_name, business_number,
             industry, business_type, base_address, detail_address, start_date
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            member.id,
            memberType,
            customerId,
            true,
            memberData?.name || null,
            memberData?.gender || null,
            memberData?.residentNumber || null,
            memberData?.businessName || null,
            memberData?.representativeName || null,
            memberData?.businessNumber || null,
            memberData?.industry || null,
            memberData?.businessType || null,
            memberData?.baseAddress || null,
            memberData?.detailAddress || null,
            memberData?.startDate || null,
          ]
        )

        const token = jwt.sign(
          { id: member.id, phone: phone },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '7d' }
        )

        notifyAdminSignup({
          customerId: member.customer_id,
          memberType: member.member_type,
          name:
            member.name ||
            memberData?.representativeName ||
            memberData?.businessName ||
            '',
          phone: member.phone_number,
          signupAt: member.created_at || new Date(),
        })

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

