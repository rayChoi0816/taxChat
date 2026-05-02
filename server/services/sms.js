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

function ppurioSafeJsonStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2)
  } catch (_) {
    return String(obj)
  }
}

/** 뿌리오 원문 객체에서 messageKey 변형 후보 통합 추출 */
function pickPpurioMessageKey(raw) {
  if (raw == null || typeof raw !== 'object') return undefined
  return (
    raw.messageKey ??
    raw.MessageKey ??
    raw.message_key ??
    raw.msgKey ??
    raw.mid ??
    raw.messageId ??
    raw.message_id
  )
}

/**
 * account / senderProfile / templateCode / messageKey / 원문 바디 필수 진단 출력
 * */
function logPpurioAlimtalkTrace(stage, account, senderProfile, templateCode, messageKeyHint, rawBody) {
  const mk =
    messageKeyHint !== undefined &&
    messageKeyHint !== null &&
    String(messageKeyHint).trim() !== ''
      ? String(messageKeyHint).trim()
      : '(none)'
  const acc = account ?? '(missing)'
  const sp = senderProfile ?? '(missing)'
  const tpl = templateCode ?? '(missing)'
  console.log(
    `[PPURIO_ALIMTALK_TRACE:${stage}] account=${acc} senderProfile=${sp} templateCode=${tpl} messageKey=${mk}`
  )
  console.log(
    `[PPURIO_ALIMTALK_RESPONSE_BODY:${stage}] ${typeof rawBody === 'string' ? rawBody : ppurioSafeJsonStringify(rawBody)}`
  )
}

/** 콤마·세미콜론·파이프로 구분된 env 목록 */
function splitEnvList(s) {
  return String(s || '')
    .split(/[,|;]/g)
    .map((x) => String(x).trim())
    .filter(Boolean)
}

function parseOptionalJsonEnv(name) {
  const raw = String(process.env[name] || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    console.warn(`[알림톡 검증] ${name} 파싱 실패(JSON 아님) → 해당 규칙은 건너뜁니다.`)
    return null
  }
}

const envTruthy = (name) =>
  ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env[name] || '').trim().toLowerCase())

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)))

/**
 * /v1/kakao 호출 전 로컬 검증 (뿌리오에는 공개 「프로필·템플릿 귀속 조회」 가 없음).
 * 교차 검사: 선택 env `PPURIO_ALIMTALK_ALLOWED_*`, JSON 맵 두 종류 참고 코멘트.
 */
function validatePpurioAlimtalkBeforeSend({
  account,
  senderProfile,
  templateCode,
  recipientPhone,
  refKey,
}) {
  const errors = []
  const envAccount = String(process.env.PPURIO_ACCOUNT || '').trim()

  if (!account) errors.push('account 비어 있음')
  else if (envAccount && account !== envAccount) {
    errors.push(`account 불일치(요청 body.account=${account} vs 환경 PPURIO_ACCOUNT=${envAccount})`)
  }

  if (!senderProfile) errors.push('senderProfile 비어 있음')
  else if (!senderProfile.startsWith('@')) {
    errors.push('senderProfile 은 반드시 @ 로 시작해야 함')
  }

  if (!templateCode) errors.push('templateCode 비어 있음')

  const digitsOnly = String(recipientPhone ?? '').replace(/\D/g, '')
  if (!/^\d{10,11}$/.test(digitsOnly)) {
    errors.push(`수신번호 형식 오류(raw=${recipientPhone ?? ''}) — 숫자 10~11자리 필요`)
  }

  if (!refKey) errors.push('refKey 비어 있음')

  const allowProf = splitEnvList(process.env.PPURIO_ALIMTALK_ALLOWED_SENDER_PROFILES)
  if (allowProf.length && !allowProf.includes(senderProfile)) {
    errors.push(
      `senderProfile 이 허용목록 없음(env PPURIO_ALIMTALK_ALLOWED_SENDER_PROFILES)·다른 뿌리오 계정용 프로필일 수 있음`
    )
  }

  const allowTpl = splitEnvList(process.env.PPURIO_ALIMTALK_ALLOWED_TEMPLATE_CODES)
  if (allowTpl.length && !allowTpl.includes(templateCode)) {
    errors.push(`templateCode 가 허용목록 없음(env PPURIO_ALIMTALK_ALLOWED_TEMPLATE_CODES)`)
  }

  // 예: "{ \"ppur_xxx\":\"tax5wol\" }" — 템플릿 코드가 속한 계정 ID
  const tplOwners = parseOptionalJsonEnv('PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP')
  if (tplOwners != null && typeof tplOwners === 'object' && !Array.isArray(tplOwners)) {
    const owner = tplOwners[templateCode]
    if (
      owner != null &&
      String(owner).trim() !== '' &&
      String(owner).trim() !== account
    ) {
      errors.push(
        `템플릿 귀속 계정 불일치: PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP 에서 코드 ${templateCode} → 기대 ${String(owner).trim()} 실제 account=${account}`
      )
    }
  }

  // 예: "{ \"tax5wol\": \"@발신프로필\" }" 또는 [\"@p1\",\"@p2\"]
  const accSendMap = parseOptionalJsonEnv('PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP')
  if (accSendMap != null && typeof accSendMap === 'object' && !Array.isArray(accSendMap)) {
    const expected = accSendMap[account]
    if (expected != null) {
      const list = Array.isArray(expected) ? expected : [expected]
      const norms = list
        .map((s) =>
          normalizePpurioKakaoSenderProfile(String(s ?? '').trim())
        )
        .filter(Boolean)
      const ok = norms.some((x) => x === senderProfile)
      if (!ok) {
        errors.push(
          `발신 프로필·계정 매핑 불일치: PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP 에서 account=${account} 는 허용 [${norms.join(', ')}], 요청=${senderProfile}`
        )
      }
    }
  }

  if (envTruthy('PPURIO_ALIMTALK_ENFORCE_OWNERSHIP_MAPS')) {
    const tplOwners = parseOptionalJsonEnv('PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP')
    const accSendMap = parseOptionalJsonEnv('PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP')
    if (!tplOwners || typeof tplOwners !== 'object' || Array.isArray(tplOwners)) {
      errors.push(
        'PPURIO_ALIMTALK_ENFORCE_OWNERSHIP_MAPS=1 인데 PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP 가 없거나 JSON 객체가 아님'
      )
    } else if (!(templateCode in tplOwners)) {
      errors.push(
        `PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP 에 현재 templateCode "${templateCode}" 키가 없음`
      )
    }
    if (!accSendMap || typeof accSendMap !== 'object' || Array.isArray(accSendMap)) {
      errors.push(
        'PPURIO_ALIMTALK_ENFORCE_OWNERSHIP_MAPS=1 인데 PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP 가 없거나 JSON 객체가 아님'
      )
    } else if (!(account in accSendMap)) {
      errors.push(
        `PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP 에 현재 account "${account}" 키가 없음`
      )
    }
  }

  return { errors }
}

function summarizeAxiosRejectForPpurio(err) {
  if (!err.response) {
    return { status: '(no_http_response)', headers: {}, data: { message: err.message } }
  }
  return {
    status: err.response.status,
    statusText: err.response.statusText ?? '',
    headers: err.response.headers ?? {},
    data: err.response.data,
  }
}

function replaceAlimtalkTemplatePlaceholders(s, vars) {
  let out = String(s ?? '')
  for (const [k, val] of Object.entries(vars)) {
    out = out.split(`__${k}__`).join(val)
  }
  return out
}

/**
 * 뿌리오 message.ppurio.com 공개 명세 목록에는 messageKey 상태 조회 API 가 없음(사업자별 별도 URL 지원 확인 시 사용).
 */
async function probePpurioMessageKeyStatus(authBearer, vars) {
  const urlRaw = String(process.env.PPURIO_MESSAGEKEY_STATUS_POST_URL || '').trim()
  if (!urlRaw) {
    return { outcome: 'skipped', reason: 'PPURIO_MESSAGEKEY_STATUS_POST_URL 미설정' }
  }

  let bodyObj
  const tplRaw =
    String(process.env.PPURIO_MESSAGEKEY_STATUS_BODY_JSON_TEMPLATE || '').trim() ||
    '{"account":"__PPUR_ACCOUNT__","messageKey":"__MESSAGE_KEY__","refKey":"__REF_KEY__"}'
  try {
    const jsonStr = replaceAlimtalkTemplatePlaceholders(tplRaw, vars)
    bodyObj = JSON.parse(jsonStr)
  } catch (e) {
    return {
      outcome: 'config_error',
      reason: `PPURIO_MESSAGEKEY_STATUS_BODY_JSON_TEMPLATE 파싱 실패: ${e.message}`,
    }
  }

  try {
    const res = await axios.post(urlRaw, bodyObj, {
      headers: {
        Authorization: `Bearer ${authBearer}`,
        'Content-Type': 'application/json',
      },
      timeout: 12_000,
    })
    return { outcome: 'http_ok', status: res.status, data: res.data ?? null }
  } catch (e) {
    const blob = summarizeAxiosRejectForPpurio(e)
    return {
      outcome: 'http_fail',
      status: blob.status,
      data: blob.data,
      errorMessage: e.message,
    }
  }
}

/** probe 응답을 규칙으로 해석. delivered: true 확정 성공 · false 확정 실패 · undefined 검증 불가. */
function interpretDeliveryProbe(parseResult) {
  if (parseResult?.outcome === 'skipped') {
    return {
      delivered: undefined,
      verification: 'skipped',
      certainty: 'none',
      hint: parseResult.reason,
    }
  }
  if (
    parseResult?.outcome === 'config_error' ||
    parseResult?.outcome === 'http_fail'
  ) {
    return {
      delivered: undefined,
      verification:
        parseResult.outcome === 'config_error'
          ? 'probe_config_error'
          : 'probe_http_error',
      certainty: 'low',
      hint: parseResult.reason || parseResult.errorMessage || 'probe request failed',
    }
  }

  const data = parseResult?.data
  const okCodesList = splitEnvList(process.env.PPURIO_MESSAGEKEY_PROBE_DELIVERED_CODES)
  const failCodesList = splitEnvList(process.env.PPURIO_MESSAGEKEY_PROBE_FAILURE_CODES)
  const pendingCodesList = splitEnvList(process.env.PPURIO_MESSAGEKEY_PROBE_PENDING_CODES)

  if (data && typeof data === 'object') {
    const c = String(data.code ?? data.resultCode ?? data.status ?? '').trim()
    if (okCodesList.length && c && okCodesList.includes(c)) {
      return {
        delivered: true,
        verification: 'delivered_ok',
        certainty: 'high',
        probeCode: c,
      }
    }
    if (failCodesList.length && c && failCodesList.includes(c)) {
      return {
        delivered: false,
        verification: 'delivered_fail',
        certainty: 'high',
        probeCode: c,
      }
    }
    if (pendingCodesList.length && c && pendingCodesList.includes(c)) {
      return {
        delivered: undefined,
        verification: 'pending_retry',
        certainty: 'low',
        probeCode: c,
        hint: 'PPURIO_MESSAGEKEY_PROBE_PENDING_CODES',
      }
    }
  }

  const okRe = String(process.env.PPURIO_MESSAGEKEY_PROBE_SUCCESS_BODY_REGEX ?? '').trim()
  if (okRe.length > 2) {
    try {
      const re = new RegExp(okRe, 'i')
      const hay = ppurioSafeJsonStringify(data)
      if (re.test(hay)) {
        return {
          delivered: true,
          verification: 'regex_ok',
          certainty: 'medium',
          hint: 'SUCCESS_BODY_REGEX',
        }
      }
    } catch {
      console.warn('[알림톡 검증] PPURIO_MESSAGEKEY_PROBE_SUCCESS_BODY_REGEX 가 올바른 정규식이 아님')
    }
  }

  const failRe = String(process.env.PPURIO_MESSAGEKEY_PROBE_FAILURE_BODY_REGEX ?? '').trim()
  if (failRe.length > 2) {
    try {
      const re = new RegExp(failRe, 'i')
      const hay = ppurioSafeJsonStringify(data)
      if (re.test(hay)) {
        return {
          delivered: false,
          verification: 'regex_fail',
          certainty: 'medium',
          hint: 'FAILURE_BODY_REGEX',
        }
      }
    } catch {
      console.warn('[알림톡 검증] PPURIO_MESSAGEKEY_PROBE_FAILURE_BODY_REGEX 가 올바른 정규식이 아님')
    }
  }

  return {
    delivered: undefined,
    verification: 'unknown_response',
    certainty: 'unknown',
    hint: 'PROBE_DELIVERED_CODES / FAILURE / PENDING 또는 BODY 정규식 설정 필요',
  }
}

async function pollPpurioMessageKeyDelivery(authBearer, vars) {
  const attempts = Math.min(
    30,
    Math.max(1, Number(process.env.PPURIO_MESSAGEKEY_PROBE_MAX_ATTEMPTS ?? 6))
  )
  const intervalMs = Math.max(0, Number(process.env.PPURIO_MESSAGEKEY_PROBE_INTERVAL_MS ?? 800))

  /** @type {Array<{attempt: number, probe: any, interpreted: Record<string, any>}>} */
  const series = []

  let probeRaw = await probePpurioMessageKeyStatus(authBearer, vars)
  let interpreted = interpretDeliveryProbe(probeRaw)
  series.push({ attempt: 1, probe: probeRaw, interpreted })

  for (let n = 2; n <= attempts; n++) {
    if (probeRaw.outcome === 'skipped' || probeRaw.outcome === 'config_error') break
    if (interpreted.delivered === true || interpreted.delivered === false) break
    await delay(intervalMs)
    probeRaw = await probePpurioMessageKeyStatus(authBearer, vars)
    interpreted = interpretDeliveryProbe(probeRaw)
    series.push({ attempt: n, probe: probeRaw, interpreted })
  }

  const summary =
    interpreted.delivered === true
      ? 'DELIVERY_VERIFIED_OK'
      : interpreted.delivered === false
        ? 'DELIVERY_VERIFIED_FAIL'
        : 'DELIVERY_NOT_VERIFIED'

  return {
    summary,
    lastProbe: probeRaw,
    lastInterpreted: interpreted,
    pollSeries: series,
  }
}

/**
 * LMS(SMS) 폴백 정책. 기본 delivery_fail_only = 전달 **확정 실패** 시에만 문자(미확정은 비용 절감을 위해 발송 안 함).
 */
function readDeliveryFallbackPolicy() {
  const p = String(process.env.PPURIO_ALIMTALK_DELIVERY_FALLBACK_POLICY || '')
    .trim()
    .toLowerCase()

  const valid = [
    '',
    'none',
    'disabled',
    'always',
    'force_lms',
    'delivery_fail_only',
    'not_verified_fallback',
    'delivery_not_confirmed_fallback',
  ]
  if (p && !valid.includes(p))
    console.warn(
      `[알림톡] PPURIO_ALIMTALK_DELIVERY_FALLBACK_POLICY="${p}" 인식 불가 → delivery_fail_only. 허용: none | always | delivery_fail_only`
    )

  if (p === 'none' || p === 'disabled') return 'none'
  if (p === 'always' || p === 'force_lms') return 'always'

  if (
    p === 'not_verified_fallback' ||
    p === 'delivery_not_confirmed_fallback'
  ) {
    console.warn(
      '[알림톡 비용정책] not_verified_fallback 는 폐기→ delivery_fail_only 와 동일(미확정 시 LMS 금지)'
    )
    return 'delivery_fail_only'
  }
  if (p === 'delivery_fail_only') return 'delivery_fail_only'

  const leg = String(process.env.PPURIO_ALIMTALK_AFTER_1000_LMS ?? '')
    .trim()
    .toLowerCase()
  if (leg === 'always' || leg === 'mirror') return 'always'
  if (leg === 'never') return 'none'
  if (leg === 'if_delivery_not_confirmed')
    console.warn(
      '[알림톡 비용정책] AFTER_1000_LMS=if_delivery_not_confirmed → delivery_fail_only(미확정 시 문자 없음)'
    )
  return 'delivery_fail_only'
}

/** @returns {{ deliveryState: 'true'|'false'|'undefined', smsTriggered: boolean, fallbackDecisionReason: string }} */
function evaluateSmsFallbackAfterDelivery(policy, interpreted) {
  const deliveryState =
    interpreted.delivered === true
      ? 'true'
      : interpreted.delivered === false
        ? 'false'
        : 'undefined'

  if (policy === 'always') {
    return {
      deliveryState,
      smsTriggered: true,
      fallbackDecisionReason:
        interpreted.delivered === false
          ? 'deliveryState_false_AND_policy_always'
          : `policy_always_SMS_despite_deliveryState=${deliveryState}_COST_MODE`,
    }
  }
  if (policy === 'none') {
    return {
      deliveryState,
      smsTriggered: false,
      fallbackDecisionReason:
        interpreted.delivered === false
          ? 'deliveryState_false_BUT_policy_none_no_SMS'
          : `policy_none_no_SMS_deliveryState=${deliveryState}`,
    }
  }
  const failOnly = interpreted.delivered === false
  return {
    deliveryState,
    smsTriggered: failOnly,
    fallbackDecisionReason: failOnly
      ? 'deliveryState_false_CONFIRMED_FAIL_SMS_FALLBACK'
      : deliveryState === 'true'
        ? 'deliveryState_true_NO_SMS'
        : 'deliveryState_undefined_POLL_EXHAUSTED_NO_SMS',
  }
}

function logDeliveryDecisionRow(opts) {
  const {
    messageKeyVal,
    policy,
    interpreted,
    pollOutcome,
    deliveryState,
    smsTriggered,
    fallbackDecisionReason,
  } = opts
  console.log('[PPURIO_ALIMTALK_DELIVERY] ----- 전달 상태·SMS 폴백 -----')
  console.log(
    `[PPURIO_ALIMTALK_DELIVERY] messageKey=${messageKeyVal ?? '(none)'} fallbackPolicy=${policy} pollSummary=${pollOutcome.summary}`
  )
  console.log(
    `[PPURIO_ALIMTALK_DELIVERY] verification=${interpreted.verification ?? '?'} certainty=${interpreted.certainty ?? '?'}`
  )
  console.log(`[PPURIO_ALIMTALK_DELIVERY] deliveryState=${deliveryState}`)
  console.log(
    `[PPURIO_ALIMTALK_DELIVERY] fallbackDecisionReason=${fallbackDecisionReason}`
  )
  console.log(`[PPURIO_ALIMTALK_DELIVERY] smsTriggered=${smsTriggered ? 'YES' : 'NO'}`)
  console.log('[PPURIO_ALIMTALK_DELIVERY] pollAttempts=', pollOutcome.pollSeries?.length ?? 0)
}

function logPpurioKakaoBindingSummary(account, senderProfile, templateCode) {
  const tplOwners = parseOptionalJsonEnv('PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP')
  const accSendMap = parseOptionalJsonEnv('PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP')

  let tplLine = '(맵 미설정·검증 생략)'
  if (
    tplOwners != null &&
    typeof tplOwners === 'object' &&
    !Array.isArray(tplOwners) &&
    Object.keys(tplOwners).length > 0
  ) {
    const expectedOwner = tplOwners[templateCode]
    if (expectedOwner == null)
      tplLine = `TEXT_NOT_IN_MAP templateCode="${templateCode}"`
    else {
      const ex = String(expectedOwner).trim()
      tplLine =
        ex === account
          ? `OK 템플릿 코드 "${templateCode}" → 기대 계정 일치 (${ex})`
          : `⚠ 불일치 템플릿 "${templateCode}" 는 뿌리오에서 계정 "${ex}" 귀속인데 요청 account="${account}" (계정 다른 콘솔에서는 발송 미표시·카카오 drop 가능)`
    }
  }

  let sndLine = '(맵 미설정·검증 생략)'
  if (
    accSendMap != null &&
    typeof accSendMap === 'object' &&
    !Array.isArray(accSendMap) &&
    Object.keys(accSendMap).length > 0
  ) {
    const rawEx = accSendMap[account]
    if (rawEx == null) sndLine = `ACCOUNT_NOT_IN_MAP 계정="${account}"`
    else {
      const list = Array.isArray(rawEx) ? rawEx : [rawEx]
      const norms = list
        .map((s) => normalizePpurioKakaoSenderProfile(String(s ?? '').trim()))
        .filter(Boolean)
      const ok = norms.includes(senderProfile)
      sndLine = ok
        ? `OK account="${account}" 발신 허용 ${norms.join(' | ')} 중 일치 (${senderProfile})`
        : `⚠ 불일치 account="${account}" 은 카카오 발신 허용 [${norms.join(', ')}] 인데 현재=${senderProfile} (타 계정 채널이면 카카오가 조용히 폐기할 수 있음)`
    }
  }

  console.log(`[PPURIO_OWNERSHIP] templateOwnership: ${tplLine}`)
  console.log(`[PPURIO_OWNERSHIP] senderProfileBinding: ${sndLine}`)
  console.warn(
    '[카카오 silent-drop 안내] code=1000 은 「뿌리오 접수」일 뿐이며 카카오·잔액·프로필 불일치로 최종 폐기될 수 있음(공식 개발문서 참고).'
  )

  const enforce = envTruthy('PPURIO_ALIMTALK_ENFORCE_OWNERSHIP_MAPS')
  const hasTplRules =
    tplOwners != null &&
    typeof tplOwners === 'object' &&
    !Array.isArray(tplOwners) &&
    Object.keys(tplOwners).length > 0
  const hasSndRules =
    accSendMap != null &&
    typeof accSendMap === 'object' &&
    !Array.isArray(accSendMap) &&
    Object.keys(accSendMap).length > 0
  if (!enforce && !hasTplRules && !hasSndRules) {
    console.warn(
      '[PPURIO_OWNERSHIP] PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP · PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP 미설정 — 계정 바인딩 자동판정 불가. 운영서버에는 JSON 맵 권장(PPURIO_ALIMTALK_ENFORCE_OWNERSHIP_MAPS=1)'
    )
  }
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
//   - 본문       : API 요청 시 루트 content 사용 안 함 · 뿌리오 등록 템플릿만 사용(changeWord 로 변수만 전달)
//   - isResend/resend: 알림톡 실패시 SMS/LMS 로 대체 발송할 본문
//
// 추가로 필요한 환경변수:
//   PPURIO_KAKAO_SENDER_KEY   : 카카오 발신 프로필(@채널검색아이디). @ 생략 시 코드에서 @ 접두 보정
//   PPURIO_KAKAO_TEMPLATE_CODE: 사전 승인된 알림톡 템플릿 코드(별칭 PPURIO_KAKAO_TEMPLATE)
//
// 교차 검증(선택, 뿌리오 공식 「프로필·템플릿 조회 API」 부재 시 서버 규칙):
//   PPURIO_ALIMTALK_ALLOWED_SENDER_PROFILES  콤마·세미콜론·파이프로 구분 허용 @발신프로필
//   PPURIO_ALIMTALK_ALLOWED_TEMPLATE_CODES   허용 templateCode 목록
//   PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP     JSON {"템플릿코드":"뿌리오계정ID"}
//   PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP       JSON {"계정ID":"@프로필"} 또는 허용 배열
//   PPURIO_ALIMTALK_ENFORCE_OWNERSHIP_MAPS=1 : 위 두 맵 필수이며 키 존재 검사(배포 검증용)
// 접수(code=1000) 이후 messageKey 전달 조회(공개 message.ppurio.com 명세표에 경로 없음 → 뿌리오 별도 URL 필요):
//   PPURIO_MESSAGEKEY_STATUS_POST_URL               POST 조회 전체 URL
//   PPURIO_MESSAGEKEY_STATUS_BODY_JSON_TEMPLATE       플레이스홀더 __PPUR_ACCOUNT__,__MESSAGE_KEY__,__REF_KEY__
//   PPURIO_MESSAGEKEY_PROBE_DELAY_MS                  첫 조회 전 대기(ms). (기존) PPURIO_ALIMTALK_PROBE_DELAY_MS 동일 허용
//   PPURIO_MESSAGEKEY_PROBE_MAX_ATTEMPTS / _INTERVAL_MS  폴링 횟수·간격
//   PPURIO_MESSAGEKEY_PROBE_PENDING_CODES            처리중 코드(재폴링 유지)
//   PPURIO_MESSAGEKEY_PROBE_DELIVERED_CODES / _FAILURE_CODES  전달 성공·실패 응답 code
//   PPURIO_MESSAGEKEY_PROBE_*_BODY_REGEX             성공/실패 본문 정규식 보조
// 전달 결과 기준 LMS 폴백(기본 delivery_fail_only: delivered===false 확정 시에만 SMS, 미확정은 비용 절감을 위해 미발송):
//   PPURIO_ALIMTALK_DELIVERY_FALLBACK_POLICY  none | always | delivery_fail_only (기본, 권장) | not_verified_fallback(폐기·fail_only 동일 처리)
//   또는 호환: PPURIO_ALIMTALK_AFTER_1000_LMS mirror|always → always, never→none, if_delivery_not_confirmed→delivery_fail_only(미확정 시 문자 없음)
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
 * @param {string} params.text      - 카카오 본문은 뿌리오 등록 템플릿 사용(text 는 로그·LMS 폴백용 본문)
 * @param {string} [params.subject] - SMS/LMS 대체발송 시 제목
 * @param {Object} [params.changeWord] - 치환 변수만 전달(뿌리오 카카오 API 는 루트 content 필드 미사용)
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

  // 3) 뿌리오 v1 /v1/kakao — 루트에 content 는 넣지 않음(JSON 스키마 additionalProperties 거절).
  //    템플릿 문구는 뿌리오 등록본 + templateCode, 변수는 targets[].changeWord 로만 전달.
  const clippedCw = normalizeAndClipChangeWord(changeWord)

  const target = { to: recipientPhone }
  if (clippedCw && typeof clippedCw === 'object' && Object.keys(clippedCw).length > 0) {
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
  const ppurAccountResolved = String(process.env.PPURIO_ACCOUNT ?? '').trim()

  const body = {
    account: ppurAccountResolved,
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

  const preflight = validatePpurioAlimtalkBeforeSend({
    account: ppurAccountResolved,
    senderProfile,
    templateCode: templateCodeResolved,
    recipientPhone,
    refKey,
  })
  if (preflight.errors.length > 0) {
    logPpurioAlimtalkTrace(
      'PRE_VALIDATE_FAIL',
      ppurAccountResolved,
      senderProfile,
      templateCodeResolved,
      '(미발송)',
      {
        code: '(local)',
        description: preflight.errors.join(' | '),
        ppurioHints: [
          '뿌리오 콘솔 다른 계정(운영·테스트) 로그인 시 발송내역 표시 불일치 가능',
          '선택 교차 검증: PPURIO_ALIMTALK_TEMPLATE_ACCOUNT_MAP, PPURIO_ALIMTALK_ACCOUNT_SENDER_MAP, PPURIO_ALIMTALK_ALLOWED_*',
        ],
      }
    )
    const reject = new Error(`알림톡 사전 검증 실패: ${preflight.errors.join(' · ')}`)
    reject.isPpurioAlimtalkPreflightReject = true
    reject.preflightErrors = preflight.errors
    throw reject
  }

  logPpurioKakaoBindingSummary(ppurAccountResolved, senderProfile, templateCodeResolved)

  const contentForCompare = normalizedAlimtalkBody
  const effectiveChangeWord = clippedCw

  console.log('========== 환경 설정 ==========')
  console.log('WORD_STYLE:', process.env.PPURIO_SIGNUP_ALIMTALK_WORD_STYLE)
  console.log('TEMPLATE_CODE:', templateCodeResolved)
  console.log('[알림톡] /v1/kakao 페이로드에는 루트 content 미포함(뿌리오 스키마). templateCode + changeWord 만 전달.')

  if (effectiveChangeWord) {
    Object.entries(effectiveChangeWord).forEach(([key, value]) => {
      if (!value) {
        console.warn(`⚠️ changeWord 값 없음: ${key}`)
      }
    })
  } else {
    console.log('[알림톡 진단] changeWord 없음(치환 변수 미사용 또는 plain 경로 가능)')
  }

  console.log(
    '========== 템플릿 텍스트 참고 로그(JSON 요청 불포함·등록본과 줄바꿈 일치 여부 확인용) =========='
  )
  console.log(String(contentForCompare || '').replace(/\s/g, '_'))

  console.log('===== changeWord (실제 카카오 요청에 포함) =====')
  console.log(effectiveChangeWord ?? '(없음)')

  console.log('========== 알림톡 요청 payload ==========')
  console.log('template_code:', templateCodeResolved)
  console.log('루트 content:', '(없음·스키마상 금지)')
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

    const rd = res.data

    logPpurioAlimtalkTrace(
      rd?.code === '1000' ? 'HTTP200_OK_1000' : 'HTTP200_BIZ_REJECT',
      ppurAccountResolved,
      senderProfile,
      templateCodeResolved,
      pickPpurioMessageKey(rd),
      rd
    )

    console.log(
      `[알림톡 HTTP] status=${res.status} code=${rd?.code ?? '?'} description=${rd?.description ?? '?'}`
    )

    const bizCode = rd?.code != null ? String(rd.code) : ''
    const bizDesc = rd?.description != null ? String(rd.description) : ''
    if (bizCode === '1000') {
      console.log(
        '[뿌리오 알림톡] code=1000 = 뿌리오 접수 완료. 이어서 messageKey 기준 전달 조회 후 LMS 폴백 여부를 판단합니다.'
      )

      const mkResolved = pickPpurioMessageKey(rd)
      await delay(
        Number(
          process.env.PPURIO_MESSAGEKEY_PROBE_DELAY_MS ??
            process.env.PPURIO_ALIMTALK_PROBE_DELAY_MS ??
            0
        )
      )

      const probeVars = {
        PPUR_ACCOUNT: ppurAccountResolved,
        MESSAGE_KEY: mkResolved != null ? String(mkResolved) : '',
        REF_KEY:
          rd.refKey != null
            ? String(rd.refKey)
            : rd.refkey != null
              ? String(rd.refkey)
              : refKey,
      }

      const pollOutcome = await pollPpurioMessageKeyDelivery(token, probeVars)
      const interpreted = pollOutcome.lastInterpreted
      const probeRaw = pollOutcome.lastProbe

      logPpurioAlimtalkTrace(
        'MESSAGEKEY_DELIVERY_POLL',
        ppurAccountResolved,
        senderProfile,
        templateCodeResolved,
        mkResolved ?? '(none)',
        {
          pollSummary: pollOutcome.summary,
          pollAttempts: pollOutcome.pollSeries?.length ?? 0,
          pollSeries: pollOutcome.pollSeries,
          lastProbe: probeRaw,
          interpreted,
        }
      )

      const policy = readDeliveryFallbackPolicy()
      const {
        deliveryState,
        smsTriggered,
        fallbackDecisionReason,
      } = evaluateSmsFallbackAfterDelivery(policy, interpreted)

      logDeliveryDecisionRow({
        messageKeyVal: mkResolved ?? '(none)',
        policy,
        interpreted,
        pollOutcome,
        deliveryState,
        smsTriggered,
        fallbackDecisionReason,
      })

      let supplementaryLmsResult = null
      if (smsTriggered) {
        try {
          supplementaryLmsResult = await sendLms({
            to: recipientPhone,
            subject,
            text: lmsText,
          })
          console.warn(
            `[알림톡] SMS 폴백 실행(delivered 확정 실패 또는 policy_always). 카카오+문자 요금 동시 발생 가능 — policy=${policy} reason=${fallbackDecisionReason}`
          )
          logPpurioAlimtalkTrace(
            'DELIVERY_FALLBACK_LMS',
            ppurAccountResolved,
            senderProfile,
            templateCodeResolved,
            mkResolved ?? '(none)',
            {
              policy,
              deliveryState,
              fallbackDecisionReason,
              smsTriggered: true,
              lmsOk: supplementaryLmsResult?.ok ?? true,
              lmsData: supplementaryLmsResult?.data ?? null,
            }
          )
        } catch (mirErr) {
          console.error(
            '[알림톡] 전달 확정 실패에 따른 LMS 폴백 발송 실패:',
            mirErr.message || mirErr
          )
          logPpurioAlimtalkTrace(
            'DELIVERY_FALLBACK_LMS_FAILED',
            ppurAccountResolved,
            senderProfile,
            templateCodeResolved,
            mkResolved ?? '(none)',
            {
              policy,
              deliveryState,
              fallbackDecisionReason,
              smsTriggered: true,
              error: mirErr.message,
            }
          )
        }
      }

      const settledChannel =
        smsTriggered && supplementaryLmsResult?.ok === true && !supplementaryLmsResult?.dev
          ? 'LMS'
          : 'ALT'

      return {
        ok: true,
        channel: settledChannel,
        data: rd,
        altAcceptResponse: rd,
        deliveryPoll: pollOutcome,
        deliveredInterpretation: interpreted,
        deliveryFallbackPolicy: policy,
        deliveryState,
        fallbackDecisionReason,
        smsTriggered,
        supplementaryLmsAfterDeliveryCheck: supplementaryLmsResult,
        lmsFallbackPayload: supplementaryLmsResult?.data,
        deliveryFallbackTriggered: Boolean(
          smsTriggered && supplementaryLmsResult?.ok && !supplementaryLmsResult?.dev
        ),
      }
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
    if (err?.isPpurioAlimtalkPreflightReject) {
      console.error('[알림톡] 사전 검증으로 뿌리오 /v1/kakao 미호출 → LMS 시도:', err.message)
      try {
        const r = await sendLms({ to: recipientPhone, subject, text: lmsText })
        return {
          ok: true,
          channel: 'LMS',
          data: r.data,
          alimtalkError: err.message,
          preflightFailed: true,
        }
      } catch (lmsErr) {
        const e = new Error('알림톡 사전 검증 실패 후 LMS 도 실패했습니다')
        e.detail = lmsErr.detail
        e.serverIp = lmsErr.serverIp
        e.ppurioMessage = lmsErr.ppurioMessage
        throw e
      }
    }

    console.log('========== 알림톡 실패 ==========')
    const failedBlob = summarizeAxiosRejectForPpurio(err)
    logPpurioAlimtalkTrace(
      'REQUEST_OR_HTTP_FAIL',
      ppurAccountResolved,
      senderProfile,
      templateCodeResolved,
      pickPpurioMessageKey(failedBlob.data),
      failedBlob
    )

    if (err.response) {
      const eco = err.response.data
      const extra = eco && typeof eco === 'object' ? eco : { value: eco }
      console.error(
        '[알림톡] 뿌리오 응답 body 전체 재출력:',
        ppurioSafeJsonStringify(extra)
      )
      const ed =
        eco && typeof eco.description === 'string'
          ? eco.description
          : eco && typeof eco.message === 'string'
            ? eco.message
            : ''
      if (/template/i.test(ed) || /코드/i.test(ed)) {
        console.warn('[진단] TEMPLATE 불일치·템플릿 코드 오류 가능성 (description 위 참고)')
      }
      if (/parm|파라미터|invalid|변수|change|additional/i.test(ed)) {
        console.warn('[진단] INVALID_PARAMETER 또는 스키마(additionalProperties) 가능성')
      }
    } else {
      console.log('error(non-http):', err.message)
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
