/**
 * @param {number} amount
 */
export function formatKRWWon(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('ko-KR').format(Math.floor(Math.max(0, n)))
}

/** 예: 4,230,000 → ₩ 4,2**,*** 형태 마스킹 */
export function maskPartialWonDisplay(amount) {
  const formatted = formatKRWWon(amount)
  const parts = formatted.split(',')
  if (parts.length <= 1) {
    const s = formatted
    const lead = s.slice(0, 1)
    return lead ? `₩ ${lead}**,***` : '₩ ***,***'
  }
  const [first, ...rest] = parts
  const tail = rest[rest.length - 1]
  const middle = rest.slice(0, -1)
  const tailMasked = '*'.repeat(Math.max(String(tail).length, 3))
  let midMasked = ''
  if (middle.length > 0) {
    midMasked = middle.map((seg) => String(seg)[0] + '**').join(',')
    midMasked += ','
  } else midMasked = String(tail)[0] + '**,'
  return `₩ ${first.slice(0, 1)},${midMasked}${tailMasked}`
}

/**
 * 참고용 절세 상한 안내값 (실제 절세액 보장 아님)
 * @returns {number | null}
 */
export function estimatePotentialSavingsKRW(finalTax, exempt) {
  if (exempt || !Number.isFinite(finalTax) || finalTax <= 0) return null
  const raw = Math.min(finalTax * 0.35, 5_000_000)
  const rounded = Math.round(raw / 100_000) * 100_000
  return Math.max(100_000, rounded)
}
