/** @type {readonly { id: string; label: string }[]} */
export const CAPITAL_GAINS_CONSULT_CTA_VARIANTS = [
  { id: 'A', label: '절세 가능 금액 확인하기' },
  { id: 'B', label: '내 세금 줄일 수 있는지 확인하기' },
  { id: 'C', label: '전문 세무사 상담 받기' },
]

const STORAGE_CTA_VARIANT = 'taxChat_ab_capital_gains_consult_cta_v1'

/**
 * 세션별 상담 CTA 문구 선택 (URL `?taxCta=A|B|C` 로 강제 가능)
 * @returns {{ id: string; label: string }}
 */
export function getConsultCtaAssignment() {
  try {
    const params = new URLSearchParams(window.location.search)
    const qp = params.get('taxCta')?.trim().toUpperCase()
    if (qp && CAPITAL_GAINS_CONSULT_CTA_VARIANTS.some((v) => v.id === qp)) {
      const v = CAPITAL_GAINS_CONSULT_CTA_VARIANTS.find((x) => x.id === qp)
      return v ?? CAPITAL_GAINS_CONSULT_CTA_VARIANTS[0]
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_CTA_VARIANT)
    const found = CAPITAL_GAINS_CONSULT_CTA_VARIANTS.find((v) => v.id === raw)
    if (found) return found
    const idx = Math.floor(Math.random() * CAPITAL_GAINS_CONSULT_CTA_VARIANTS.length)
    const picked = CAPITAL_GAINS_CONSULT_CTA_VARIANTS[idx]
    sessionStorage.setItem(STORAGE_CTA_VARIANT, picked.id)
    return picked
  } catch (_) {
    return CAPITAL_GAINS_CONSULT_CTA_VARIANTS[0]
  }
}

/**
 * 결과 페이지 이벤트 (외부에서는 window 'taxPreviewTrack' 리스너로 후킹 가능)
 * @param {string} eventName
 * @param {Record<string, unknown>} [props]
 */
export function trackTaxPreviewResult(eventName, props = {}) {
  const detail = { event: eventName, ts: Date.now(), ...props }
  try {
    window.dispatchEvent(new CustomEvent('taxPreviewTrack', { detail }))
  } catch (_) {
    /* ignore */
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[taxPreviewTrack]', eventName, props)
  }
}
