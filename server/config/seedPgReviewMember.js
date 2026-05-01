import pool from './database.js'

/**
 * PG 심사용 번호(01000000000) 회원이 있으면 member_types 가 부족할 때 자동으로 채웁니다.
 * 스크립트 수동 실행 없이도 개인/법인·무공백 유형이 들어가도록 합니다.
 */
export async function ensurePgReviewTestMemberTypes() {
  const DISPLAY_NAME = 'PG심사테스트'
  const r = await pool.query(
    `SELECT id FROM members WHERE phone_number = '01000000000' AND deleted = false LIMIT 1`
  )
  if (r.rows.length === 0) return

  const memberId = r.rows[0].id
  const CUSTOMER_ID_NB = 'PG_REVIEW_01000000000'
  const CUSTOMER_ID_IB = 'PG_TEST_01000000000_IB'
  const CUSTOMER_ID_CORP = 'PG_TEST_01000000000_CORP'
  const CUSTOMER_ID_IB_NS = 'PG_TEST_01000000000_IB_NS'
  const CUSTOMER_ID_CORP_NS = 'PG_TEST_01000000000_CORP_NS'

  const rows = [
    {
      member_type: '비사업자',
      customer_id: CUSTOMER_ID_NB,
      name: DISPLAY_NAME,
      business_name: null,
      representative_name: null,
      business_number: null,
    },
    {
      member_type: '개인 사업자',
      customer_id: CUSTOMER_ID_IB,
      name: DISPLAY_NAME,
      business_name: `(테스트)${DISPLAY_NAME} 개인사업`,
      representative_name: DISPLAY_NAME,
      business_number: '1234567890',
    },
    {
      member_type: '법인 사업자',
      customer_id: CUSTOMER_ID_CORP,
      name: null,
      business_name: `(테스트)오월법인 주식회사`,
      representative_name: DISPLAY_NAME,
      business_number: '1108156789012',
    },
    {
      member_type: '개인사업자',
      customer_id: CUSTOMER_ID_IB_NS,
      name: DISPLAY_NAME,
      business_name: `(테스트)${DISPLAY_NAME} 개인사업(무공백유형)`,
      representative_name: DISPLAY_NAME,
      business_number: '1234567891',
    },
    {
      member_type: '법인사업자',
      customer_id: CUSTOMER_ID_CORP_NS,
      name: null,
      business_name: `(테스트)오월법인(무공백유형)`,
      representative_name: DISPLAY_NAME,
      business_number: '1108156789013',
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
       ON CONFLICT (member_id, member_type) DO NOTHING`,
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
}
