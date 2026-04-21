import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'taxchat',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
}

// 원격(Render 등) PostgreSQL 연결 시 SSL 필요
const shouldUseSSL =
  process.env.DB_SSL === 'true' || /\.render\.com$/i.test(dbConfig.host)
if (shouldUseSSL) {
  dbConfig.ssl = { rejectUnauthorized: false }
}

console.log('데이터베이스 연결 설정:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password ? '***' : '없음',
  ssl: Boolean(dbConfig.ssl),
})

const pool = new Pool(dbConfig)

// 연결 에러 핸들링
pool.on('error', (err) => {
  console.error('예상치 못한 데이터베이스 클라이언트 오류:', err)
})

// 테스트 연결
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('데이터베이스 연결 실패:', err.message)
    console.error('연결 설정:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    })
    console.error('오류 상세:', err)
  } else {
    console.log('데이터베이스 연결 성공:', res.rows[0].now)
  }
})

export default pool

