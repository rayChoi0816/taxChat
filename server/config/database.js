import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// === 연결 안정성 공통 옵션 ===
// Render 무료 PostgreSQL은 idle 커넥션을 갑자기 닫는 경향이 있어
// "Connection terminated unexpectedly" 가 자주 발생합니다.
// 아래 옵션으로 1) 죽은 커넥션을 재활용하지 않고 2) TCP keepalive 로 살아있게 유지합니다.
const commonPoolOptions = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  allowExitOnIdle: false,
}

// Render 등 클라우드 PostgreSQL 은 보통 단일 연결 문자열(DATABASE_URL)을 제공합니다.
// 개별 5개 환경변수(DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD)를 따로 설정하다 보면
// 비밀번호에 공백이 섞이거나 user 이름이 미세하게 어긋나는 실수가 자주 납니다.
// DATABASE_URL 이 있으면 그대로 우선 사용하도록 합니다. (가장 안전)
const connectionString = process.env.DATABASE_URL || ''

let dbConfig
if (connectionString) {
  dbConfig = {
    connectionString,
    ...commonPoolOptions,
  }
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'taxchat',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ...commonPoolOptions,
  }
}

// 원격(Render 등) PostgreSQL 연결 시 SSL 필요
// - DATABASE_URL 에 .render.com 이 포함되어 있어도 동일하게 SSL 활성화
const hostHint = connectionString || dbConfig.host || ''
const shouldUseSSL =
  process.env.DB_SSL === 'true' || /\.render\.com/i.test(hostHint)
if (shouldUseSSL) {
  dbConfig.ssl = { rejectUnauthorized: false }
}

// 비밀번호/문자열은 마스킹해서 로그
const maskUrl = (u) =>
  String(u || '').replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1***$3')
console.log('데이터베이스 연결 설정:', {
  mode: connectionString ? 'DATABASE_URL' : 'individual env vars',
  url: connectionString ? maskUrl(connectionString) : undefined,
  host: connectionString ? undefined : dbConfig.host,
  port: connectionString ? undefined : dbConfig.port,
  database: connectionString ? undefined : dbConfig.database,
  user: connectionString ? undefined : dbConfig.user,
  ssl: Boolean(dbConfig.ssl),
})

const pool = new Pool(dbConfig)

// pool 레벨 에러 핸들링
// - 끊긴 idle client 가 다음 쿼리에서 다시 사용되지 않도록 즉시 destroy.
pool.on('error', (err, client) => {
  console.error('[DB] pool 클라이언트 오류 (연결 폐기 처리):', err.message)
  try {
    client?.release(true) // true = destroy
  } catch (_) {
    /* ignore */
  }
})

// 테스트 연결
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('데이터베이스 연결 실패:', err.message)
    console.error('연결 설정:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
    })
    console.error('오류 상세:', err)
  } else {
    console.log('데이터베이스 연결 성공:', res.rows[0].now)
  }
})

export default pool

