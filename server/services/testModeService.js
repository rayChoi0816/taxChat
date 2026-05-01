import pool from '../config/database.js'

const KEY_TEST_MODE = 'TEST_MODE'
const KEY_TEST_PHONE = 'TEST_PHONE'

const DEFAULT_ENV_TEST_PHONE = '01088810816'

/** @returns {boolean} */
function parseBoolEnv(v) {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}

function normalizeDigits(phone) {
  return String(phone ?? '').replace(/[^\d]/g, '')
}

/**
 * 테스트 모드·테스트 번호 기본 행 확보 (서버 기동 시·최초 API 호출 전).
 */
export async function ensureSystemSettingsDefaults() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  const testModeSeed = parseBoolEnv(process.env.TEST_MODE) ? 'true' : 'false'
  const phoneSeed =
    normalizeDigits(process.env.TEST_PHONE) ||
    normalizeDigits(DEFAULT_ENV_TEST_PHONE) ||
    DEFAULT_ENV_TEST_PHONE

  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,
    [KEY_TEST_MODE, testModeSeed]
  )
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,
    [KEY_TEST_PHONE, phoneSeed]
  )
}

export async function getTestModeFromDB() {
  const r = await pool.query(`SELECT value FROM system_settings WHERE key = $1`, [KEY_TEST_MODE])
  if (r.rows.length === 0) {
    console.warn('[TEST_MODE] DB 행 없음 → env.TEST_MODE 참조')
    return parseBoolEnv(process.env.TEST_MODE)
  }
  return String(r.rows[0].value).toLowerCase() === 'true'
}

export async function getConfiguredTestPhoneDigits() {
  const r = await pool.query(`SELECT value FROM system_settings WHERE key = $1`, [KEY_TEST_PHONE])
  if (r.rows.length === 0 || !String(r.rows[0].value ?? '').trim()) {
    const fromEnv = normalizeDigits(process.env.TEST_PHONE)
    return fromEnv || normalizeDigits(DEFAULT_ENV_TEST_PHONE) || DEFAULT_ENV_TEST_PHONE
  }
  const d = normalizeDigits(r.rows[0].value)
  return d || normalizeDigits(DEFAULT_ENV_TEST_PHONE) || DEFAULT_ENV_TEST_PHONE
}

/**
 * 카카오 알림톡 등 실제 발송용 수신 번호 결정.
 * 테스트 모드 ON 이면 `system_settings.TEST_PHONE`(또는 env TEST_PHONE)으로만 치환할 뿐,
 * 뿌리오/카카오 API 호출 자체를 막지 않습니다(mock 아님).
 *
 * @param {string} originalPhone 원본 번호 (하이픈 허용)
 * @returns {Promise<string>} 숫자만
 */
export async function getSendPhoneNumber(originalPhone) {
  const digitsOriginal = normalizeDigits(originalPhone)
  const isTestMode = await getTestModeFromDB()
  const testPhone = await getConfiguredTestPhoneDigits()

  if (isTestMode) {
    console.log(
      `[TEST MODE] 실제 발송 라우팅 수신번호=${testPhone} (원번호 ${digitsOriginal || '-'}) · 뿌리오까지 동일하게 요청됨`
    )
    return testPhone
  }
  console.log(`[PRODUCTION] ${digitsOriginal || '-'}로 발송`)
  return digitsOriginal
}

export async function setTestMode(testMode) {
  const v = testMode === true ? 'true' : 'false'
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY_TEST_MODE, v]
  )
}

export async function setTestPhone(phone) {
  const digits = normalizeDigits(phone)
  if (!/^01\d{8,9}$/.test(digits)) {
    throw new Error('테스트 번호는 010 등으로 시작하는 10~11자리 숫자여야 합니다')
  }
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY_TEST_PHONE, digits]
  )
  return digits
}

export async function getTestModeSnapshot() {
  const testMode = await getTestModeFromDB()
  const testPhone = await getConfiguredTestPhoneDigits()
  return { testMode, testPhone }
}
