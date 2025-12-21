import pool from './database.js'

// 고객 ID 생성 함수
const generateCustomerId = async (memberType, signupDate, sequence) => {
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
  
  // 순번 형식: 001, 002, ...
  const sequenceStr = String(sequence).padStart(3, '0')
  
  // 소문자 알파벳 임의 한 글자 생성
  const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
  
  return `${typeCode}${dateStr}${sequenceStr}${randomChar}`
}

// customer_id 컬럼 추가 및 기존 데이터에 고객 ID 발급
const migrateCustomerId = async () => {
  try {
    // customer_id 컬럼 추가 (이미 있으면 무시)
    await pool.query(`
      ALTER TABLE members 
      ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) UNIQUE
    `)

    // customer_id가 없는 회원들을 가입일과 회원 유형별로 그룹화하여 순번 부여
    const result = await pool.query(`
      SELECT id, member_type, created_at
      FROM members 
      WHERE customer_id IS NULL 
      ORDER BY created_at, id
    `)

    // 날짜별, 회원 유형별 순번 추적
    const sequenceMap = new Map()

    for (const row of result.rows) {
      const signupDate = new Date(row.created_at)
      const dateKey = `${signupDate.toISOString().split('T')[0]}_${row.member_type}`
      
      // 해당 날짜와 회원 유형의 순번 가져오기
      if (!sequenceMap.has(dateKey)) {
        // 해당 날짜에 이미 가입한 회원 수 조회
        const countResult = await pool.query(
          `SELECT COUNT(*) as count FROM members 
           WHERE DATE(created_at) = DATE($1) 
           AND member_type = $2
           AND customer_id IS NOT NULL`,
          [signupDate, row.member_type]
        )
        sequenceMap.set(dateKey, parseInt(countResult.rows[0].count))
      }
      
      const currentSequence = sequenceMap.get(dateKey) + 1
      sequenceMap.set(dateKey, currentSequence)
      
      let customerId
      let attempts = 0
      
      // 중복되지 않는 고객 ID 생성
      while (attempts < 26) {
        customerId = await generateCustomerId(row.member_type, signupDate, currentSequence)
        
        const checkResult = await pool.query(
          'SELECT id FROM members WHERE customer_id = $1',
          [customerId]
        )
        
        if (checkResult.rows.length === 0) {
          break
        }
        
        attempts++
      }
      
      if (customerId) {
        await pool.query(
          'UPDATE members SET customer_id = $1 WHERE id = $2',
          [customerId, row.id]
        )
        console.log(`회원 ID ${row.id}에 고객 ID ${customerId} 발급 완료`)
      }
    }

    console.log('고객 ID 마이그레이션 완료')
  } catch (error) {
    console.error('고객 ID 마이그레이션 오류:', error)
    throw error
  }
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCustomerId()
    .then(() => {
      console.log('마이그레이션 완료')
      process.exit(0)
    })
    .catch((error) => {
      console.error('마이그레이션 실패:', error)
      process.exit(1)
    })
}

export default migrateCustomerId

