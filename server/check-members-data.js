import pool from './config/database.js'

const checkMembersData = async () => {
  try {
    // members 테이블의 모든 회원 조회
    const result = await pool.query(`
      SELECT 
        id,
        customer_id,
        phone_number,
        member_type,
        name,
        business_name,
        representative_name,
        business_number,
        industry,
        business_type,
        base_address,
        detail_address,
        start_date,
        gender,
        resident_number,
        signup_method,
        has_info_input,
        deleted,
        created_at,
        updated_at
      FROM members
      ORDER BY created_at DESC
    `)

    console.log(`\n=== 고객 DB 데이터 확인 ===`)
    console.log(`총 회원 수: ${result.rows.length}명\n`)

    if (result.rows.length === 0) {
      console.log('고객 데이터가 없습니다.')
    } else {
      console.log('고객 목록:\n')
      result.rows.forEach((member, index) => {
        console.log(`[${index + 1}] 회원 ID: ${member.id}`)
        console.log(`   - 고객 ID: ${member.customer_id || 'N/A'}`)
        console.log(`   - 전화번호: ${member.phone_number || 'N/A'}`)
        console.log(`   - 회원 유형: ${member.member_type || 'N/A'}`)
        console.log(`   - 이름: ${member.name || 'N/A'}`)
        console.log(`   - 사업자명: ${member.business_name || 'N/A'}`)
        console.log(`   - 대표자명: ${member.representative_name || 'N/A'}`)
        console.log(`   - 사업자등록번호: ${member.business_number || 'N/A'}`)
        console.log(`   - 업종: ${member.industry || 'N/A'}`)
        console.log(`   - 사업 유형: ${member.business_type || 'N/A'}`)
        console.log(`   - 기본 주소: ${member.base_address || 'N/A'}`)
        console.log(`   - 상세 주소: ${member.detail_address || 'N/A'}`)
        console.log(`   - 사업 시작일: ${member.start_date ? new Date(member.start_date).toLocaleDateString('ko-KR') : 'N/A'}`)
        console.log(`   - 성별: ${member.gender || 'N/A'}`)
        console.log(`   - 주민등록번호: ${member.resident_number || 'N/A'}`)
        console.log(`   - 가입 방식: ${member.signup_method || 'N/A'}`)
        console.log(`   - 정보 입력 여부: ${member.has_info_input ? '입력완료' : '미입력'}`)
        console.log(`   - 삭제 여부: ${member.deleted ? '삭제됨' : '정상'}`)
        console.log(`   - 등록일시: ${member.created_at ? new Date(member.created_at).toLocaleString('ko-KR') : 'N/A'}`)
        console.log(`   - 수정일시: ${member.updated_at ? new Date(member.updated_at).toLocaleString('ko-KR') : 'N/A'}`)
        console.log('')
      })
    }

    // 통계 정보
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN deleted = false THEN 1 END) as active,
        COUNT(CASE WHEN deleted = true THEN 1 END) as deleted,
        COUNT(CASE WHEN member_type = '비사업자' THEN 1 END) as non_business,
        COUNT(CASE WHEN member_type = '개인 사업자' THEN 1 END) as individual_business,
        COUNT(CASE WHEN member_type = '법인 사업자' THEN 1 END) as corporate_business,
        COUNT(CASE WHEN signup_method = '회원 직접 가입' THEN 1 END) as direct_signup,
        COUNT(CASE WHEN signup_method = '관리자가 등록' THEN 1 END) as admin_signup,
        COUNT(CASE WHEN has_info_input = true THEN 1 END) as info_input_completed
      FROM members
    `)

    const stats = statsResult.rows[0]
    console.log(`\n=== 고객 통계 ===`)
    console.log(`전체: ${stats.total}명`)
    console.log(`정상: ${stats.active}명`)
    console.log(`삭제됨: ${stats.deleted}명`)
    console.log(`비사업자: ${stats.non_business}명`)
    console.log(`개인 사업자: ${stats.individual_business}명`)
    console.log(`법인 사업자: ${stats.corporate_business}명`)
    console.log(`회원 직접 가입: ${stats.direct_signup}명`)
    console.log(`관리자가 등록: ${stats.admin_signup}명`)
    console.log(`정보 입력 완료: ${stats.info_input_completed}명`)

    process.exit(0)
  } catch (error) {
    console.error('고객 데이터 확인 오류:', error)
    process.exit(1)
  }
}

checkMembersData()

