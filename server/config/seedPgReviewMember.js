import pool from './database.js'

const DISPLAY_NAME = 'PG심사 테스트 계정'
const CUSTOMER_ID = 'PG_REVIEW_01000000000'
const MEMBER_TYPE = '비사업자'

/**
 * PG 심사용 번호(01000000000) 회원이 있으면 비사업자만 남기고 member_types 정리합니다.
 */
export async function ensurePgReviewTestMemberTypes() {
  const r = await pool.query(
    `SELECT id FROM members WHERE phone_number = '01000000000' AND deleted = false LIMIT 1`
  )
  if (r.rows.length === 0) return

  const memberId = r.rows[0].id

  await pool.query(
    `DELETE FROM member_types
     WHERE member_id = $1
       AND member_type IN (
         '개인 사업자', '법인 사업자',
         '개인사업자', '법인사업자'
       )`,
    [memberId]
  )

  await pool.query(
    `INSERT INTO member_types (
       member_id, member_type, customer_id, is_active,
       name, gender, resident_number,
       business_name, representative_name, business_number,
       industry, business_type, base_address, detail_address, start_date
     ) VALUES ($1, $2, $3, true, $4, null, null, null, null, null, null, null, null, null, null)
     ON CONFLICT (member_id, member_type)
     DO UPDATE SET
       customer_id = EXCLUDED.customer_id,
       is_active = true,
       name = EXCLUDED.name,
       business_name = null,
       representative_name = null,
       business_number = null`,
    [memberId, MEMBER_TYPE, CUSTOMER_ID, DISPLAY_NAME]
  )

  await pool.query(
    `UPDATE members
     SET name = $1, member_type = $2, customer_id = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [DISPLAY_NAME, MEMBER_TYPE, CUSTOMER_ID, memberId]
  )
}
