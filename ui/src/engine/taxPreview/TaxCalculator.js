import { CAPITAL_GAINS_TAX_VERSION } from './capitalGainsQuestionConfig.js'

/**
 * 과세표준 구간별 누진(참고용 간이 모델, 실세법과 다를 수 있음).
 * @param {number} taxable
 */
function progressiveNationalTaxAmount(taxable) {
  let left = Math.max(0, Math.floor(taxable))
  let tax = 0
  /** 초과분 구간 폭별 세율(참고용 간이 표) */
  const tiers = [
    [12_000_000, 0.06],
    [34_000_000, 0.15],
    [42_000_000, 0.24],
    [62_000_000, 0.35],
    [150_000_000, 0.38],
    [200_000_000, 0.4],
  ]
  for (const [w, r] of tiers) {
    const slice = Math.min(left, w)
    tax += slice * r
    left -= slice
    if (left <= 0) return Math.floor(tax)
  }
  tax += left * 0.45
  return Math.floor(tax)
}

function longTermDeductionFraction(holdingPeriod) {
  switch (holdingPeriod) {
    case 'under1':
      return 0
    case '1to2':
      return 0.08
    case '2plus':
      return 0.16
    case '5plus':
      return 0.26
    default:
      return 0
  }
}

function multiHouseRateBump(houseCount) {
  if (houseCount === '2') return 0.2
  if (houseCount === '3plus') return 0.3
  return 0
}

/**
 * @param {{
 *   assetType?: string
 *   houseCount?: string
 *   holdingPeriod?: string
 *   isResident?: boolean
 *   purchasePrice?: number
 *   salePrice?: number
 *   expenses?: number | null
 *   expensesUnknown?: boolean
 *   isAdjustZone?: boolean
 * }} data
 */
export function calculateCapitalGainsTax(data) {
  const purchase = Number(data.purchasePrice) || 0
  const sale = Number(data.salePrice) || 0

  let expenses = Number(data.expenses)
  if (data.expensesUnknown === true) {
    expenses = Math.round(sale * 0.025)
  } else if (!Number.isFinite(expenses)) {
    expenses = 0
  }

  const gain = Math.max(0, Math.round(sale - purchase - expenses))

  const oneHouse = data.houseCount === '1'
  const holdingEnough = data.holdingPeriod === '2plus' || data.holdingPeriod === '5plus'
  const adjust = !!data.isAdjustZone
  const residentOk = data.isResident === true

  let exemptReason = ''
  let exempt =
    oneHouse &&
    holdingEnough &&
    (!adjust || (adjust && residentOk))

  if (exempt) {
    exemptReason = '1주택·보유 요건 등(참고)으로 비과세로 가정했어요.'
    return {
      version: CAPITAL_GAINS_TAX_VERSION,
      exempt: true,
      exemptReason,
      gain,
      expensesApplied: expenses,
      longTermDeduction: 0,
      taxableBase: 0,
      nationalTaxBeforeBump: 0,
      multiHouseBumpRatio: multiHouseRateBump(data.houseCount),
      nationalTax: 0,
      localIncomeTax: 0,
      finalTax: 0,
    }
  }

  const ltFrac = longTermDeductionFraction(data.holdingPeriod)
  const longTermDeduction = Math.floor(gain * ltFrac)

  const basicDeduction = 2_500_000
  let taxableBase = gain - longTermDeduction - basicDeduction
  if (taxableBase < 0) taxableBase = 0

  const bump = multiHouseRateBump(data.houseCount)
  const nationalTaxBeforeBump = progressiveNationalTaxAmount(taxableBase)
  const nationalTax = Math.floor(nationalTaxBeforeBump * (1 + bump))

  const localIncomeTax = Math.floor(nationalTax * 0.1)
  const finalTax = nationalTax + localIncomeTax

  return {
    version: CAPITAL_GAINS_TAX_VERSION,
    exempt: false,
    gain,
    expensesApplied: expenses,
    longTermDeduction,
    taxableBase,
    nationalTaxBeforeBump,
    multiHouseBumpRatio: bump,
    nationalTax,
    localIncomeTax,
    finalTax,
  }
}
