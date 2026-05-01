/**
 * 결과 화면용 짧은 설명 문자열 생성 (참고용).
 */

/**
 * @param {Record<string, unknown>} data
 * @param {object} result calculateCapitalGainsTax 반환값
 */
export function interpretCapitalGainsResult(data, result) {
  /** @type {string[]} */
  const lines = []

  if (result.exempt) {
    lines.push('1주택 + 2년 이상 보유 조건으로 세금이 줄어들었어요 👍')
    return lines
  }

  const hc = data.houseCount
  if (hc === '2') {
    lines.push('다주택(2채)로 간주해 세율에 가산을 반영했어요.')
  }
  if (hc === '3plus') {
    lines.push('다주택(3채 이상) 가산을 반영했어요.')
  }

  const hp = data.holdingPeriod
  if (hp === '5plus') {
    lines.push('보유 기간이 길어 장기보유 공제 비율을 높게 적용했어요.')
  } else if (hp === '2plus') {
    lines.push('장기보유특별공제를 일부 반영했어요.')
  }

  lines.push(
    result.finalTax <= 0
      ? '이번 입력에서는 세액 산출이 0원으로 나왔어요.'
      : '입력값 기준 간이 세액입니다. 실제 과세 특례는 전문 검토가 필요해요.'
  )

  return lines
}
