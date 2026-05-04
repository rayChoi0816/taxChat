/** 입력 스냅샷 문자열 → 동일 결과일 때만 세션 디스크로져 유지 */

const STORAGE_FP = 'taxChat_cg_result_disclosure_fp_v1'
const STORAGE_OK = 'taxChat_cg_result_disclosure_ok_v1'

/**
 * @param {Record<string, unknown>} data - flow 데이터 일부만 사용
 */
export function capitalGainsDisclosureFingerprint(data) {
  const parts = [
    data.assetType,
    data.houseCount,
    data.holdingPeriod,
    data.isResident === true ? 1 : data.isResident === false ? 0 : '',
    Number(data.purchasePrice) || 0,
    Number(data.salePrice) || 0,
    data.expensesUnknown === true ? 1 : 0,
    data.expensesUnknown === true ? '' : Number(data.expenses) || 0,
  ]
  return parts.join('|')
}

export function loadDisclosureStateFromSession(fingerprint) {
  try {
    const fp = sessionStorage.getItem(STORAGE_FP)
    const ok = sessionStorage.getItem(STORAGE_OK)
    if (!ok || fp !== fingerprint) return false
    return ok === '1'
  } catch (_) {
    return false
  }
}

export function saveDisclosureConfirmedToSession(fingerprint) {
  try {
    sessionStorage.setItem(STORAGE_FP, fingerprint)
    sessionStorage.setItem(STORAGE_OK, '1')
  } catch (_) {
    /* ignore */
  }
}

export function clearDisclosureSession() {
  try {
    sessionStorage.removeItem(STORAGE_FP)
    sessionStorage.removeItem(STORAGE_OK)
  } catch (_) {
    /* ignore */
  }
}
