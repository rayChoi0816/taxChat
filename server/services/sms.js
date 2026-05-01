// ============================================================================
// 뿌리오(Ppurio) SMS 발송 서비스
// ----------------------------------------------------------------------------
// 이 파일은 "문자를 실제로 보내는 일"만 담당합니다.
// 회원가입·인증코드 저장 같은 로직은 routes/auth.js 에 있어요.
//
// 뿌리오 공식 v1 API 흐름:
//   1) 계정ID + API키를 Base64 로 묶어서 /v1/token 에 요청 → 토큰(Bearer) 발급
//   2) 받은 토큰을 Authorization 헤더에 넣어 /v1/message 로 문자 전송
// ============================================================================

import axios from 'axios'
import { getSendPhoneNumber } from './testModeService.js'

// 뿌리오 서버 기본 주소 (공식 문서 기준)
const PPURIO_BASE_URL = 'https://message.ppurio.com'

// 토큰은 발급받는 데 시간이 걸리므로, 한번 받으면 메모리에 잠깐 저장해서 재사용합니다.
// (서버가 재시작되면 자동으로 지워져요)
let cachedToken = null
let tokenExpiresAt = 0 // 토큰이 무효해지는 시각(ms)

/**
 * 로컬/개발 환경인지 판별합니다.
 * PPURIO_API_KEY, PPURIO_ACCOUNT, PPURIO_FROM 중 하나라도 비어 있으면
 * "진짜로 문자를 보내지 않고 콘솔에만 출력"하도록 합니다.
 */
const isPpurioConfigured = () => {
  return Boolean(
    process.env.PPURIO_API_KEY &&
    process.env.PPURIO_ACCOUNT &&
    process.env.PPURIO_FROM
  )
}

/**
 * 뿌리오 /v1/kakao 는 senderProfile 이 반드시 '@' 로 시작해야 함 (code 2000).
 * env 에 @ 없이 채널명만 넣은 경우 자동 보정.
 */
const readPpurioKakaoSenderProfileEnv = () =>
  String(
    process.env.PPURIO_KAKAO_SENDER_KEY ||
      process.env.PPURIO_KAKAO_SENDER_PROFILE ||
      ''
  ).trim()

const normalizePpurioKakaoSenderProfile = (trimmedRaw) => {
  if (!trimmedRaw) return ''
  return trimmedRaw.startsWith('@') ? trimmedRaw : `@${trimmedRaw}`
}

/** API 에 실어 보낼 발신 프로필(@접두 포함). 별칭 env: PPURIO_KAKAO_SENDER_PROFILE */
const getPpurioKakaoSenderProfile = () =>
  normalizePpurioKakaoSenderProfile(readPpurioKakaoSenderProfileEnv())

/** 알림톡 템플릿 코드. 별칭: PPURIO_KAKAO_TEMPLATE */
const getPpurioKakaoTemplateCode = () =>
  String(
    process.env.PPURIO_KAKAO_TEMPLATE_CODE ||
      process.env.PPURIO_KAKAO_TEMPLATE ||
      ''
  ).trim()

/**
 * 카카오 미호출 시 어떤 env 가 비었는지 로그 (배포 환경에서 두 변수만 빼먹은 경우 진단용)
 */
function logAlimtalkSkippedReason() {
  if (!isPpurioConfigured()) {
    const miss = []
    if (!String(process.env.PPURIO_ACCOUNT || '').trim()) miss.push('PPURIO_ACCOUNT')
    if (!String(process.env.PPURIO_API_KEY || '').trim()) miss.push('PPURIO_API_KEY')
    if (!String(process.env.PPURIO_FROM || '').trim()) miss.push('PPURIO_FROM')
    console.warn('[알림톡 진단] 문자 연동 필수 env 누락:', miss.join(', ') || '알 수 없음')
    return
  }
  const miss = []
  if (!getPpurioKakaoSenderProfile()) {
    miss.push(
      'PPURIO_KAKAO_SENDER_KEY(또는 PPURIO_KAKAO_SENDER_PROFILE): 발신 프로필'
    )
  }
  if (!getPpurioKakaoTemplateCode()) {
    miss.push('PPURIO_KAKAO_TEMPLATE_CODE(또는 PPURIO_KAKAO_TEMPLATE): 알림톡 템플릿 코드')
  }
  console.warn(
    '[알림톡 진단] 위 값이 프로세스 env 에 없어 /v1/kakao 를 호출하지 않고 LMS 만 발송합니다.',
    '로컬 .env 만 채우고 Render·도커 등 실행 환경에는 미설정인 경우가 흔합니다.',
    `\n→ 누락: ${miss.join(' | ')}`
  )
}

/**
 * 지금 이 서버가 바깥으로 나갈 때 쓰는 공인 IP 를 돌려줍니다.
 * (뿌리오가 "invalid ip" 를 돌려줄 때, 어떤 IP 를 등록해야 하는지 알려주려고 사용합니다)
 *
 * 실패해도 예외를 던지지 않고 "unknown" 을 돌려주어, 에러 처리 흐름이 끊기지 않게 합니다.
 */
export const getServerPublicIp = async () => {
  try {
    const { data } = await axios.get('https://api.ipify.org?format=json', {
      timeout: 5000,
    })
    if (data?.ip) return String(data.ip).trim()
  } catch (_) {
    // 1차 실패 → 2차 시도
    try {
      const { data } = await axios.get('https://ipv4.icanhazip.com', {
        timeout: 5000,
      })
      if (data) return String(data).trim()
    } catch (__) {
      // 모두 실패
    }
  }
  return 'unknown'
}

/**
 * 뿌리오 에러 응답이 "IP 미허용(코드 3003 / invalid ip)" 인지 판별합니다.
 */
const isInvalidIpError = (data) => {
  if (!data) return false
  const code = String(data.code || '').trim()
  const desc = String(data.description || data.message || '').toLowerCase()
  return code === '3003' || desc.includes('invalid ip')
}

/**
 * 뿌리오 에러를 콘솔에 "보기 쉽게" 출력하고,
 * 상위 호출자가 사용자에게 돌려줄 수 있도록 상세 정보를 묶어서 반환합니다.
 *
 * @param {string} stage  - 어느 단계에서 실패했는지 ("token" / "send" / "retry")
 * @param {any} err       - axios 에서 던진 에러 객체
 * @returns {Promise<{message: string, detail: any, serverIp: string|null}>}
 */
const summarizePpurioError = async (stage, err) => {
  const data = err.response?.data
  const status = err.response?.status
  const messageFromPpurio =
    data?.description || data?.message || err.message || '알 수 없는 오류'

  // 서버 전체 응답 본문을 "있는 그대로" 한 번 출력해서 디버깅을 쉽게 합니다.
  console.error(`[PPURIO ${stage.toUpperCase()} ERROR] status=${status || 'n/a'}`)
  console.error('[PPURIO ERROR BODY]:', data ?? err.message)

  // "IP 허용 목록에 없음" 오류라면, 이 서버의 공인 IP 를 조회해서 친절히 알려줍니다.
  let serverIp = null
  if (isInvalidIpError(data)) {
    serverIp = await getServerPublicIp()
    console.error(`PPURIO ERROR: invalid ip`)
    console.error(`REGISTER THIS IP: ${serverIp}`)
  }

  return {
    message: messageFromPpurio,
    detail: data ?? err.message,
    serverIp,
  }
}

/**
 * 뿌리오 접근 토큰(Bearer) 발급
 * - Basic 인증: base64("계정ID:API키")
 * - 성공 응답: { token: "...", expired: 1800 } 형태 (expired는 초 단위, 대략 30분)
 */
const fetchPpurioToken = async () => {
  const account = process.env.PPURIO_ACCOUNT
  const apiKey = process.env.PPURIO_API_KEY

  // "계정ID:API키" 문자열을 Base64 로 변환합니다.
  const basic = Buffer.from(`${account}:${apiKey}`).toString('base64')

  const res = await axios.post(
    `${PPURIO_BASE_URL}/v1/token`,
    {}, // 본문은 비어있어도 됩니다.
    {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000, // 10초 안에 응답 없으면 실패 처리
    }
  )

  const token = res.data?.token
  // expired(초)가 오면 그만큼, 없으면 기본 30분으로 잡아둡니다.
  const ttlSec = Number(res.data?.expired) || 30 * 60
  if (!token) {
    throw new Error('뿌리오 토큰 발급 실패: 응답에 token 필드가 없습니다')
  }
  return { token, expiresAt: Date.now() + ttlSec * 1000 }
}

/**
 * 캐시된 토큰이 아직 유효하면 그대로 쓰고, 아니면 새로 받아옵니다.
 */
const getPpurioToken = async () => {
  const now = Date.now()
  // 만료 30초 전부터는 미리 갱신 (짧은 안전 여유)
  if (cachedToken && tokenExpiresAt - 30_000 > now) {
    return cachedToken
  }
  const { token, expiresAt } = await fetchPpurioToken()
  cachedToken = token
  tokenExpiresAt = expiresAt
  return cachedToken
}

/**
 * 실제 문자 발송 함수
 *
 * @param {Object} params
 * @param {string} params.to   - 받는 사람 휴대폰 번호 (예: "01012345678")
 * @param {string} params.text - 보낼 메시지 본문
 * @returns {Promise<{ok: boolean, dev?: boolean, data?: any}>}
 *
 * - 운영(뿌리오 설정 O): 실제 문자 발송
 * - 개발(뿌리오 설정 X): 콘솔에 "[개발 SMS] ..." 로만 출력
 *
 * 실패 시 던지는 Error 객체에는 아래 필드가 함께 붙습니다.
 *   - err.detail   : 뿌리오가 돌려준 원본 응답 (디버깅용)
 *   - err.serverIp : IP 미허용 오류일 때, 이 서버의 공인 IP
 */
export const sendSms = async ({ to, text }) => {
  // 1) 개발 환경 대응 — 환경변수가 없으면 실제 발송을 시도하지 않습니다.
  if (!isPpurioConfigured()) {
    console.log(`[개발 SMS] to=${to} | text=${text}`)
    return { ok: true, dev: true }
  }

  // 2) 토큰 받기
  let token
  try {
    token = await getPpurioToken()
  } catch (err) {
    const info = await summarizePpurioError('token', err)
    const e = new Error('SMS 발송 준비 중 오류가 발생했습니다')
    e.detail = info.detail
    e.serverIp = info.serverIp
    e.ppurioMessage = info.message
    throw e
  }

  // 3) 문자 전송 요청
  // refKey: 뿌리오가 요청을 식별하는 데 쓰는 "우리쪽 고유 ID"입니다.
  //          최대 30자 영문/숫자만 허용되어, 짧은 timestamp + 랜덤 6자로 만듭니다.
  const refKey = `tc${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`.slice(0, 30)

  const body = {
    account: process.env.PPURIO_ACCOUNT,
    messageType: 'SMS', // 단문(90byte 이내)
    from: process.env.PPURIO_FROM, // 사전에 뿌리오에 등록한 발신번호
    content: text,
    duplicateFlag: 'N', // 같은 번호로 중복 발송 허용
    refKey, // 뿌리오 v1 필수 필드
    targetCount: 1,
    targets: [{ to }],
  }

  try {
    const res = await axios.post(`${PPURIO_BASE_URL}/v1/message`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    })
    return { ok: true, data: res.data }
  } catch (err) {
    // 토큰이 만료돼서 401 을 받으면, 캐시를 지우고 딱 한 번 다시 시도합니다.
    if (err.response?.status === 401) {
      cachedToken = null
      tokenExpiresAt = 0
      try {
        const retryToken = await getPpurioToken()
        const res = await axios.post(`${PPURIO_BASE_URL}/v1/message`, body, {
          headers: {
            Authorization: `Bearer ${retryToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        })
        return { ok: true, data: res.data }
      } catch (retryErr) {
        const info = await summarizePpurioError('retry', retryErr)
        const e = new Error('SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요')
        e.detail = info.detail
        e.serverIp = info.serverIp
        e.ppurioMessage = info.message
        throw e
      }
    }

    const info = await summarizePpurioError('send', err)
    const e = new Error('SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요')
    e.detail = info.detail
    e.serverIp = info.serverIp
    e.ppurioMessage = info.message
    throw e
  }
}

/**
 * 인증번호 문자 기본 문구를 만드는 도우미 함수
 */
export const buildVerificationMessage = (code) => {
  return `[taxChat] 인증번호 ${code} 를 입력해 주세요. (유효시간 3분)`
}

// ============================================================================
// 카카오 알림톡 (Ppurio Alimtalk - v1)
// ----------------------------------------------------------------------------
// 뿌리오 v1 알림톡 정식 명세
//   - URL          : POST {PPURIO_BASE_URL}/v1/kakao    (※ /v1/message 가 아님)
//   - messageType  : "ALT"                              (※ "AT"/"AI" 아님)
//   - senderProfile: 최상위 필드 (발신프로필 키)
//   - templateCode : 최상위 필드 (사전 승인된 템플릿 코드)
//   - isResend/resend: 알림톡 실패시 SMS/LMS 로 대체 발송할 본문
//
// 추가로 필요한 환경변수:
//   PPURIO_KAKAO_SENDER_KEY   : 카카오 발신 프로필(@채널검색아이디). @ 생략 시 코드에서 @ 접두 보정
//   PPURIO_KAKAO_TEMPLATE_CODE: 사전 승인된 알림톡 템플릿 코드(별칭 PPURIO_KAKAO_TEMPLATE)
//
// 알림톡 본문은 뿌리오에 등록된 템플릿과 **바이트까지 동일**해야 하고, changeWord 는 규격대로 var1[*1*] 또는 
// #{ }+카멜키(계정별 상이) 여부를 맞춰야 한다. 불일치 시 isResend=Y 이면 카카오 단계에서 떨어지고 **SMS/LMS 만** 올 수 있다.
// ─────────────────────────────────────────────────────────────────────────────

const PPURIO_VAR_MAX_LEN = 100

/** 뿌리오 changeWord varN 은 text(100) */
export const clipPpurioChangeWordValue = (s, max = PPURIO_VAR_MAX_LEN) => {
  const x = String(s ?? '')
  if (x.length <= max) return x
  return x.slice(0, max)
}

/** 템플릿 문자열: BOM·CRLF 정규화. 선행 빈 줄 제거는 뿌리오 등록본과 맞출 때만 `PPURIO_ALIMTALK_STRIP_LEADING_NL=1` */
export const normalizeAlimtalkContentBody = (raw) => {
  if (typeof raw !== 'string') return ''
  let s = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (String(process.env.PPURIO_ALIMTALK_STRIP_LEADING_NL || '').trim() === '1') {
    s = s.replace(/^[\n\r]+/, '')
  }
  return s
}

function normalizeAndClipChangeWord(cw) {
  if (!cw || typeof cw !== 'object') return cw
  const out = {}
  for (const [k, val] of Object.entries(cw)) {
    out[k] = typeof val === 'string' ? clipPpurioChangeWordValue(val) : val
  }
  return out
}

const isAlimtalkConfigured = () =>
  Boolean(
    isPpurioConfigured() &&
      getPpurioKakaoSenderProfile() &&
      getPpurioKakaoTemplateCode()
  )

/**
 * LMS(장문 SMS) 발송 - 90byte 초과 시 자동으로 LMS 로 분기.
 * 알림톡이 불가능할 때의 fallback 으로 사용된다.
 */
export const sendLms = async ({ to, subject, text }) => {
  if (!isPpurioConfigured()) {
    console.log(`[개발 LMS] to=${to} | subject=${subject || ''} | text=${text}`)
    return { ok: true, dev: true }
  }

  const token = await getPpurioToken()
  const refKey = `tc${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`.slice(0, 30)

  const body = {
    account: process.env.PPURIO_ACCOUNT,
    messageType: 'LMS',
    from: process.env.PPURIO_FROM,
    subject: (subject || '[taxChat] 알림').slice(0, 30),
    content: text,
    duplicateFlag: 'N',
    refKey,
    targetCount: 1,
    targets: [{ to }],
  }

  try {
    const res = await axios.post(`${PPURIO_BASE_URL}/v1/message`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    })
    return { ok: true, data: res.data }
  } catch (err) {
    const info = await summarizePpurioError('lms', err)
    const e = new Error('LMS 발송 실패')
    e.detail = info.detail
    e.serverIp = info.serverIp
    e.ppurioMessage = info.message
    throw e
  }
}

/**
 * 카카오 알림톡 발송 (뿌리오 v1 /v1/kakao)
 *
 * @param {Object} params
 * @param {string} params.to        - 받는 사람 휴대폰 번호 (01012345678)
 * @param {string} params.text      - 알림톡 본문 (템플릿과 동일해야 함, 변수치환 후 최종 문구)
 * @param {string} [params.subject] - SMS/LMS 대체발송 시 제목
 * @param {Object} [params.changeWord] - 템플릿 변수 치환 (예: 카카오 #{키} 이름과 동일한 키, 또는 뿌리오 var1~var8)
 * 루트 {@code content} 포함 규칙:
 * - {@code PPURIO_KAKAO_INCLUDE_TEMPLATE_CONTENT=1|true…} 이면 강제 포함, {@code 0|false|off} 이면 강제 제외.
 * - 그 외: changeWord 가 있으면 기본 포함(회원가입 알림 등). 없으면 미포함(디버그 LMS 문구 테스트 등).
 * @returns {Promise<{ok:boolean, channel:'ALT'|'LMS'|'DEV', data?:any}>}
 *
 * 알림톡 미설정/실패 시 자동으로 LMS 로 대체 발송하여 메시지 누락을 방지.
 */
export const sendAlimtalk = async ({
  to,
  text,
  subject,
  changeWord,
  ppurioIsResend = 'Y',
  lmsFallbackBody,
}) => {
  const resolvedTo = await getSendPhoneNumber(to)
  const toDigitsOnly = String(resolvedTo).replace(/\D/g, '')
  const recipientPhone = toDigitsOnly.length >= 10 ? toDigitsOnly : String(resolvedTo).trim()
  const rawText = typeof text === 'string' ? text : String(text ?? '')
  const normalizedAlimtalkBody = normalizeAlimtalkContentBody(rawText)
  const lmsText =
    typeof lmsFallbackBody === 'string' && lmsFallbackBody.length > 0
      ? lmsFallbackBody
      : normalizedAlimtalkBody

  // 1) 알림톡 설정 자체가 비어있다면 곧장 LMS/개발 로그로 처리
  if (!isAlimtalkConfigured()) {
    if (!isPpurioConfigured()) {
      console.log(`[개발 알림톡] to=${resolvedTo} | text=${normalizedAlimtalkBody}`)
      return { ok: true, channel: 'DEV', dev: true }
    }
    logAlimtalkSkippedReason()
    console.log('[알림톡] 환경변수 미설정 → LMS 로 발송')
    const r = await sendLms({ to: recipientPhone, subject, text: lmsText })
    return { ok: true, channel: 'LMS', data: r.data }
  }

  // 2) 토큰 발급
  let token
  try {
    token = await getPpurioToken()
  } catch (err) {
    const info = await summarizePpurioError('token', err)
    const e = new Error('알림톡 발송 준비 중 오류가 발생했습니다')
    e.detail = info.detail
    e.serverIp = info.serverIp
    e.ppurioMessage = info.message
    throw e
  }

  const refKey = `tc${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`.slice(0, 30)

  // 3) 뿌리오 v1 /v1/kakao
  //    - 템플릿 검증 시 루트 content 를 카카오 등록본과 동일하게 보내는 경우가 많다.
  //    - 기본: changeWord 가 있으면 루트 content 도 함께 전송(LMS 테스트 엔드포인트 등 changeWord 없으면 미포함).
  //      끄려면 PPURIO_KAKAO_INCLUDE_TEMPLATE_CONTENT=0|false|off
  //    - 강제 켜기: PPURIO_KAKAO_INCLUDE_TEMPLATE_CONTENT=1|true|on
  const clippedCw = normalizeAndClipChangeWord(changeWord)
  const cwKeyCount =
    clippedCw && typeof clippedCw === 'object' ? Object.keys(clippedCw).length : 0
  const kw = String(process.env.PPURIO_KAKAO_INCLUDE_TEMPLATE_CONTENT || '')
    .trim()
    .toLowerCase()
  const rootExplicitOff = ['0', 'false', 'no', 'n', 'off'].includes(kw)
  const rootExplicitOn = ['1', 'true', 'yes', 'y', 'on'].includes(kw)
  const includeRootContent =
    rootExplicitOn ||
    (!rootExplicitOff && Boolean(normalizedAlimtalkBody) && cwKeyCount > 0)

  const target = { to: recipientPhone }
  if (cwKeyCount > 0) {
    target.changeWord = clippedCw
  }

  const trimmedSenderEnv = readPpurioKakaoSenderProfileEnv()
  const senderProfile = normalizePpurioKakaoSenderProfile(trimmedSenderEnv)
  if (trimmedSenderEnv && !trimmedSenderEnv.startsWith('@')) {
    console.log(
      `[알림톡] senderProfile env 에 '@' 가 없어 뿌리오 요구 형식으로 보정했습니다 → ${senderProfile}`
    )
  }
  const templateCodeResolved = getPpurioKakaoTemplateCode()

  const body = {
    account: process.env.PPURIO_ACCOUNT,
    messageType: 'ALT',
    senderProfile,
    templateCode: templateCodeResolved,
    duplicateFlag: 'N',
    refKey,
    targetCount: 1,
    targets: [target],
    isResend: ppurioIsResend === 'N' ? 'N' : 'Y',
    resend: {
      messageType: 'LMS',
      from: process.env.PPURIO_FROM,
      subject: (subject || '[taxChat] 알림').slice(0, 30),
      content: lmsText,
    },
  }

  if (includeRootContent && normalizedAlimtalkBody) {
    body.content = normalizedAlimtalkBody
  }

  const contentForCompare = normalizedAlimtalkBody
  const effectiveChangeWord = clippedCw

  console.log('========== 환경 설정 ==========')
  console.log('WORD_STYLE:', process.env.PPURIO_SIGNUP_ALIMTALK_WORD_STYLE)
  console.log('TEMPLATE_CODE:', templateCodeResolved)
  console.log(
    'KAKAO_ROOT_CONTENT:',
    includeRootContent
      ? rootExplicitOn
        ? '포함(env 강제 on)'
        : '포함(기본·changeWord 있음)'
      : rootExplicitOff
        ? '미포함(env 강제 off)'
        : '미포함(changeWord 없음 또는 본문 없음)'
  )

  if (effectiveChangeWord) {
    Object.entries(effectiveChangeWord).forEach(([key, value]) => {
      if (!value) {
        console.warn(`⚠️ changeWord 값 없음: ${key}`)
      }
    })
  } else {
    console.log('[알림톡 진단] changeWord 없음(치환 변수 미사용 또는 plain 경로 가능)')
  }

  console.log('========== content 비교(참고·요청에 넣는지는 KAKAO_ROOT_CONTENT) ==========')
  console.log(String(contentForCompare || '').replace(/\s/g, '_'))
  if (!includeRootContent) {
    console.log('[참고] 루트 content 미포함 → templateCode + changeWord 중심 전달.')
  }

  console.log('===== 알림톡 요청 최종 content(루트, 전송 여부는 KAKAO_ROOT_CONTENT 참고) =====')
  console.log(includeRootContent ? normalizedAlimtalkBody : '(루트 미포함)')
  console.log('===== 알림톡 요청 최종 changeWord =====')
  console.log(effectiveChangeWord ?? '(없음)')

  console.log('========== 알림톡 요청 payload ==========')
  console.log('template_code:', templateCodeResolved)
  console.log('content(최상위):', includeRootContent ? normalizedAlimtalkBody : undefined)
  console.log('changeWord:', effectiveChangeWord)
  console.log('to:', recipientPhone, '| raw:', resolvedTo)
  console.log('senderProfile:', senderProfile)
  console.log('refKey:', refKey)
  console.log('isResend:', body.isResend)
  try {
    console.log('full_body:', JSON.stringify(body, null, 2))
  } catch (_) {
    console.log('full_body: (직렬화 실패)')
  }

  try {
    const res = await axios.post(`${PPURIO_BASE_URL}/v1/kakao`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    })

    console.log('========== 알림톡 성공 응답 (HTTP) ==========')
    console.log('status:', res.status)
    console.log('data:', JSON.stringify(res.data, null, 2))

    const bizCode = res.data?.code != null ? String(res.data.code) : ''
    const bizDesc = res.data?.description != null ? String(res.data.description) : ''
    if (bizCode === '1000') {
      console.log('[뿌리오 알림톡] 응답 코드 해석: SUCCESS (통상 code=1000)')
      return { ok: true, channel: 'ALT', data: res.data }
    }

    console.error(
      '========== 알림톡 API code≠1000 (카카오 미수락 가능) ==========',
      `code="${bizCode}" description="${bizDesc}"`
    )
    const hints = []
    if (/template|매칭|match|내용|불일치|코드/i.test(bizDesc)) {
      hints.push('TEMPLATE·content·TEMPLATE_CODE 불일치 의심')
    }
    if (/parm|파라미터|invalid|변수|change/i.test(bizDesc)) {
      hints.push('INVALID_PARAMETER · changeWord·본문 변수 의심')
    }
    console.warn(
      '[뿌리오 알림톡] 진단 힌트:',
      hints.length > 0 ? hints.join(' | ') : '뿌리오 에러 코드표·대시보드 확인 → 아래 LMS 수동 재시도'
    )

    try {
      const r = await sendLms({ to: recipientPhone, subject, text: lmsText })
      return {
        ok: true,
        channel: 'LMS',
        data: r.data,
        alimtalkError: `[code≠1000] ${bizCode} ${bizDesc}`.slice(0, 300),
      }
    } catch (lmsErr) {
      const e = new Error('카카오 알림톡 거절(응답 code≠1000) 후 LMS 대체도 실패했습니다')
      const info = await summarizePpurioError('alimtalk-lms-after-codefail', lmsErr)
      e.detail = info.detail || lmsErr.detail
      e.serverIp = info.serverIp || lmsErr.serverIp
      e.ppurioMessage = info.message
      throw e
    }
  } catch (err) {
    console.log('========== 알림톡 실패 ==========')
    if (err.response) {
      console.log('status:', err.response.status)
      console.log('data:', JSON.stringify(err.response.data, null, 2))
      const eco = err.response.data
      const ed = eco && typeof eco.description === 'string' ? eco.description : ''
      if (/template/i.test(ed) || /코드/i.test(ed)) {
        console.warn('[진단] TEMPLATE 불일치·템플릿 코드 오류 가능성 (description 위 참고)')
      }
      if (/parm|파라미터|invalid|변수|change/i.test(ed)) {
        console.warn('[진단] INVALID_PARAMETER · changeWord·변수 규격 가능성')
      }
    } else {
      console.log('error:', err.message)
    }

    if (err.response?.status === 401) {
      cachedToken = null
      tokenExpiresAt = 0
    }
    const info = await summarizePpurioError('alimtalk', err)
    console.error('알림톡 발송 실패 → LMS 대체 시도:', info.message)
    // 알림톡이 어떤 사유로든 실패하면 LMS 로라도 메시지가 가도록 한다.
    try {
      const r = await sendLms({ to: recipientPhone, subject, text: lmsText })
      return { ok: true, channel: 'LMS', data: r.data, alimtalkError: info.message }
    } catch (lmsErr) {
      const e = new Error('카카오 알림톡 및 LMS 발송 모두 실패했습니다')
      e.detail = lmsErr.detail || info.detail
      e.serverIp = lmsErr.serverIp || info.serverIp
      e.ppurioMessage = lmsErr.ppurioMessage || info.message
      throw e
    }
  }
}

/**
 * 회원가입 알림 본문 (LMS/미설정 폴백용).
 * - 카카오 승인 템플릿과 별개로, 문자 대체 발송 시 관리 가독성을 위해 고객ID 등을 포함합니다.
 */
export const buildSignupNotificationMessage = ({
  customerId,
  memberType,
  name,
  phone,
  signupAt,
}) => {
  const formattedPhone = phone
    ? String(phone).replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
    : '-'
  const ts = signupAt ? new Date(signupAt) : new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const formatted = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}`

  return [
    '[택스챗] 신규 회원가입 알림',
    '',
    `고객ID: ${customerId || '-'}`,
    `사업자 유형: ${memberType || '-'}`,
    `회원명: ${name || '-'}`,
    `연락처: ${formattedPhone}`,
    `가입일시: ${formatted}`,
    '',
    '관리자 페이지에서 상세 정보를 확인하세요.',
  ].join('\n')
}

/** 카카오 비즈니스 승인본(#{변수}) 유지용 — 소스 오브 트루스 */
export const SIGNUP_ADMIN_ALIMTALK_ORIGINAL_CONTENT =
  '\n' +
  '택스챗 신규 회원이 가입되었습니다.\n' +
  '\n' +
  '사업자 유형: #{memberType}\n' +
  '회원명: #{memberName}\n' +
  '연락처: #{phone}\n' +
  '가입일시: #{signupAt}\n' +
  '\n' +
  '택스쳇 관리자페이지로 이동\n'

/**
 * 뿌리오 API용([*n*] + changeWord.var1…)
 * 콘솔 등록 템플릿과 줄바꿈·공백까지 맞춤: 선행 빈 줄·본문 후 빈 줄 없음. 마지막 줄만 "택스쳇"(등록 오탈자) 유지.
 */
export const SIGNUP_ADMIN_ALIMTALK_NUMBERED_CONTENT = `
택스챗 신규 회원이 가입되었습니다.
사업자 유형: [*1*]
회원명: [*2*]
연락처: [*3*]
가입일시: [*4*]
택스쳇 관리자페이지로 이동
`.trim()

/** @deprecated SIGNUP_ADMIN_ALIMTALK_ORIGINAL_CONTENT 권장 */
export const SIGNUP_ADMIN_ALIMTALK_DEFAULT_CONTENT = SIGNUP_ADMIN_ALIMTALK_ORIGINAL_CONTENT

/**
 * 신규가입 카카오 알림톡 (관리자 수신)
 *
 * **기본 전송 모드는 뿌리오 규격 `[*n*]` + `var1…var4`(numbered)** 입니다. 카카오 콘솔에서는 #{변수}로
 * 보이더라도 API 연동은 대개 번호 변수가 맞습니다. `#{memberType}+memberType키` 형만 쓰는 계정이면
 * `PPURIO_SIGNUP_ALIMTALK_WORD_STYLE=hash` 로 명시합니다.
 *
 * payload (routes/auth.js): memberType, name→memberName, phone, signupAt (+ customerId는 LMS 폴백)
 *
 * - PPURIO_SIGNUP_ALIMTALK_MODE=plain → 치환 없이 LMS 위주
 * - PPURIO_SIGNUP_ALIMTALK_TEMPLATE → (선택) hash 분기만 본문 덮어쓰기 (#{ })
 */
export const buildSignupAdminAlimtalkRequest = (payload) => {
  const plainText = buildSignupNotificationMessage(payload)

  if (String(process.env.PPURIO_SIGNUP_ALIMTALK_MODE || '').toLowerCase() === 'plain') {
    return {
      text: plainText,
      changeWord: undefined,
      plainText,
      ppurioIsResend: 'Y',
    }
  }

  const memberType =
    payload.memberType != null && String(payload.memberType).trim() !== ''
      ? String(payload.memberType)
      : '-'
  const memberName =
    payload.name != null && String(payload.name).trim() !== ''
      ? String(payload.name)
      : '-'
  const rawPhone = payload.phone != null ? String(payload.phone).replace(/[^\d]/g, '') : ''
  const phone =
    rawPhone.length >= 10
      ? rawPhone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
      : payload.phone != null && String(payload.phone).trim() !== ''
        ? String(payload.phone)
        : '-'

  const ts = payload.signupAt ? new Date(payload.signupAt) : new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const signupAt = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}`

  const envStyle = String(process.env.PPURIO_SIGNUP_ALIMTALK_WORD_STYLE || '').trim().toLowerCase()
  const useHashBranch =
    envStyle === 'hash' ||
    envStyle === 'kakao_hash' ||
    envStyle === 'legacy_hash' ||
    envStyle === 'sharp'

  /** 기본값: numbered (환경변수 비움 또는 `numbered` 명시 동일 처리) → #{ } 분기 미매칭으로 대체문자만 가는 현상 예방 */
  const isNumbered = !useHashBranch

  const envOriginal = String(process.env.PPURIO_SIGNUP_ALIMTALK_TEMPLATE || '').trim()
  const originalContentRaw = envOriginal || SIGNUP_ADMIN_ALIMTALK_ORIGINAL_CONTENT
  const numberedContentRaw = SIGNUP_ADMIN_ALIMTALK_NUMBERED_CONTENT

  const pickedRaw = isNumbered ? numberedContentRaw : originalContentRaw
  const content = normalizeAlimtalkContentBody(pickedRaw)

  const hashChangeWord = normalizeAndClipChangeWord({
    memberType,
    memberName,
    phone,
    signupAt,
  })

  /** 순서 고정: var1~var4 (= 사업자유형 → 이름 → 연락처 → 가입일시) */
  const numberedChangeWord = normalizeAndClipChangeWord({
    var1: memberType,
    var2: memberName,
    var3: phone,
    var4: signupAt,
  })

  const changeWord = isNumbered ? numberedChangeWord : hashChangeWord

  console.log(
    `[회원가입 알림톡] 전송 분기=${isNumbered ? 'numbered([*]+var)' : 'hash(#{memberType}+키일치 필수)'} ENV.PPURIO_SIGNUP_ALIMTALK_WORD_STYLE="${
      process.env.PPURIO_SIGNUP_ALIMTALK_WORD_STYLE || '(기본 numbered)'
    }"`
  )

  if (!payload.name || String(payload.name).trim() === '') {
    console.warn('[회원가입 알림톡] payload.name 비어 있음 → memberName 은 "-" 로 대체됩니다.')
  }
  if (!payload.phone || String(payload.phone).replace(/[^\d]/g, '').length < 10) {
    console.warn('[회원가입 알림톡] payload.phone 이 짧거나 비어 있을 수 있습니다.')
  }

  console.log('===== 최종 content =====')
  console.log(content)
  console.log('===== changeWord =====')
  console.log(changeWord)
  console.log('[회원가입 알림톡] 회원명(payload.name→memberName):', memberName)
  console.log('[회원가입 알림톡] 회원 연락처(raw):', payload.phone ?? '(payload 없음)')
  console.log('[회원가입 알림톡] 회원 연락처(치환용 phone):', phone)
  console.log('[회원가입 알림톡] 사업자 유형(payload.memberType):', memberType)

  return {
    text: content,
    changeWord,
    plainText,
    ppurioIsResend: 'Y',
  }
}

/**
 * 뿌리오 단문(SMS) 또는 장문(LMS) 자동 선택 (90byte 초과 시 LMS)
 */
export const sendSmsOrLms = async ({ to, text, subject }) => {
  const body = String(text || '')
  const byteLen = Buffer.byteLength(body, 'utf8')
  if (byteLen > 90) {
    return sendLms({ to, subject: subject || '[taxChat] 알림', text: body })
  }
  return sendSms({ to, text: body })
}

export default {
  sendSms,
  sendLms,
  sendSmsOrLms,
  sendAlimtalk,
  buildVerificationMessage,
  buildSignupNotificationMessage,
  buildSignupAdminAlimtalkRequest,
  getServerPublicIp,
  SIGNUP_ADMIN_ALIMTALK_ORIGINAL_CONTENT,
  SIGNUP_ADMIN_ALIMTALK_NUMBERED_CONTENT,
  SIGNUP_ADMIN_ALIMTALK_DEFAULT_CONTENT,
}
