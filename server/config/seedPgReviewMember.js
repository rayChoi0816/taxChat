import pool from './database.js'

const NAME_NB = 'PG심사 비사업자 테스트 계정'
const NAME_INDIVIDUAL = 'PG심사 개인사업자 테스트 계정'
const NAME_CORP_DISPLAY = 'PG심사 법인사업자 테스트 계정'

/**
 * PG 심사용 번호(01000000000) 회원이 있으면 member_types 를 맞춥니다.
 * - 무공백 유형(개인사업자/법인사업자) 행 삭제
 * - 비사업자·개인 사업자·법인 사업자 표시명 업데이트(UPSERT)
 */
export async function ensurePgReviewTestMemberTypes() {
  const r = await pool.query(
    `SELECT id FROM members WHERE phone_number = '01000000000' AND deleted = false LIMIT 1`
  )
  if (r.rows.length === 0) return

  const memberId = r.rows[0].id

  await pool.query(
    `DELETE FROM member_types WHERE member_id = $1 AND member_type IN ('개인사업자', '법인사업자')`,
    [memberId]
  )

  const CUSTOMER_ID_NB = 'PG_REVIEW_01000000000'
  const CUSTOMER_ID_IB = 'PG_TEST_01000000000_IB'
  const CUSTOMER_ID_CORP = 'PG_TEST_01000000000_CORP'

  const rows = [
    {
      member_type: '비사업자',
      customer_id: CUSTOMER_ID_NB,
      name: NAME_NB,
      business_name: null,
      representative_name: null,
      business_number: null,
    },
    {
      member_type: '개인 사업자',
      customer_id: CUSTOMER_ID_IB,
      name: NAME_INDIVIDUAL,
      business_name: 'PG심사 개인사업자 테스트 상호',
      representative_name: NAME_INDIVIDUAL,
      business_number: '1234567890',
    },
    {
      member_type: '법인 사업자',
      customer_id: CUSTOMER_ID_CORP,
      name: null,
      business_name: NAME_CORP_DISPLAY,
      representative_name: 'PG심사 법인 대표 테스트',
      business_number: '1108156789012',
    },
  ]

  for (const row of rows) {
    await pool.query(
      `INSERT INTO member_types (
         member_id, member_type, customer_id, is_active,
         name, gender, resident_number,
         business_name, representative_name, business_number,
         industry, business_type, base_address, detail_address, start_date
       ) VALUES ($1, $2, $3, true, $4, null, null, $5, $6, $7, null, null, null, null, null)
       ON CONFLICT (member_id, member_type)
       DO UPDATE SET
         customer_id = EXCLUDED.customer_id,
         is_active = true,
         name = EXCLUDED.name,
         business_name = EXCLUDED.business_name,
         representative_name = EXCLUDED.representative_name,
         business_number = EXCLUDED.business_number`,
      [
        memberId,
        row.member_type,
        row.customer_id,
        row.name,
        row.business_name,
        row.representative_name,
        row.business_number,
      ]
    )
  }

  await pool.query(
    `UPDATE members SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [NAME_NB, memberId]
  )
}
