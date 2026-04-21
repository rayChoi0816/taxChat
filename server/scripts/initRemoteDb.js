import 'dotenv/config'
import pool from '../config/database.js'
import initDatabase from '../config/initDatabase.js'
import migrateCustomerId from '../config/migrateCustomerId.js'

const run = async () => {
  console.log('='.repeat(60))
  console.log('원격 데이터베이스 스키마 초기화 시작')
  console.log('='.repeat(60))

  try {
    await initDatabase()
    console.log('✅ 테이블 초기화 완료')

    await migrateCustomerId()
    console.log('✅ customer_id 마이그레이션 완료')

    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    )
    console.log('\n생성된 테이블 목록:')
    tables.rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.table_name}`))

    console.log('\n🎉 모든 작업이 완료되었습니다.')
  } catch (err) {
    console.error('❌ 초기화 실패:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

run()
