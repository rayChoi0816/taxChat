/**
 * PG 심사용 테스트 회원 확보 스크립트
 * 실행: cd server && node scripts/ensurePgTestMember.mjs
 *
 * 휴대폰 01000000000 / 비밀번호 test1234! (bcrypt 저장)
 * 회원유형: 비사업자, 개인 사업자, 법인 사업자 (무공백 유형 미사용)
 */
import bcrypt from 'bcryptjs'
import pool from '../config/database.js'

const PHONE = '01000000000'
const PASSWORD = 'test1234!'
const PRIMARY_MEMBER_TYPE = '비사업자'
/** members 행 표시 이름(비사업자 기준) */
const NAME_MEMBER_ROW = 'PG심사 비사업자 테스트 계정'
const CUSTOMER_ID_NB = 'PG_REVIEW_01000000000'
const CUSTOMER_ID_IB = 'PG_TEST_01000000000_IB'
const CUSTOMER_ID_CORP = 'PG_TEST_01000000000_CORP'

const NAME_NB = 'PG심사 비사업자 테스트 계정'
const NAME_INDIVIDUAL = 'PG심사 개인사업자 테스트 계정'
const NAME_CORP_DISPLAY = 'PG심사 법인사업자 테스트 계정'

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const client = await pool.connect()
  try {
    const found = await client.query(
      'SELECT id FROM members WHERE phone_number = $1',
      [PHONE]
    )

    let memberId
    if (found.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO members (
          customer_id, phone_number, member_type, name,
          signup_method, has_info_input, password_hash, deleted
        ) VALUES ($1, $2, $3, $4, '관리자가 등록', true, $5, false)
        RETURNING id`,
        [CUSTOMER_ID_NB, PHONE, PRIMARY_MEMBER_TYPE, NAME_MEMBER_ROW, passwordHash]
      )
      memberId = ins.rows[0].id
      console.log('신규 삽입:', { memberId })
    } else {
      memberId = found.rows[0].id
      await client.query(
        `UPDATE members SET
           password_hash = $1,
           deleted = false,
           member_type = $2,
           name = $3,
           customer_id = $4,
           signup_method = '관리자가 등록',
           has_info_input = true,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [passwordHash, PRIMARY_MEMBER_TYPE, NAME_MEMBER_ROW, CUSTOMER_ID_NB, memberId]
      )
      console.log('기존 행 갱신:', { memberId })
    }

    await client.query('DELETE FROM member_types WHERE member_id = $1', [memberId])

    const cols = `
      INSERT INTO member_types (
        member_id, member_type, customer_id, is_active,
        name, gender, resident_number,
        business_name, representative_name, business_number,
        industry, business_type, base_address, detail_address, start_date
      ) VALUES `

    await client.query(
      cols +
        `($1, '비사업자', $2, true, $3, null, null, null, null, null, null, null, null, null, null)`,
      [memberId, CUSTOMER_ID_NB, NAME_NB]
    )
    await client.query(
      cols +
        `($1, '개인 사업자', $2, true, $3, null, null, $4, $3, $5, null, null, null, null, null)`,
      [
        memberId,
        CUSTOMER_ID_IB,
        NAME_INDIVIDUAL,
        'PG심사 개인사업자 테스트 상호',
        '1234567890',
      ]
    )
    await client.query(
      cols +
        `($1, '법인 사업자', $2, true, null, null, null, $3, $4, $5, null, null, null, null, null)`,
      [
        memberId,
        CUSTOMER_ID_CORP,
        NAME_CORP_DISPLAY,
        'PG심사 법인 대표 테스트',
        '1108156789012',
      ]
    )

    console.log(
      '완료 — 로그인:',
      PHONE,
      '/ 비밀번호',
      PASSWORD,
      '/ 회원유형: 비사업자·개인 사업자·법인 사업자'
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
