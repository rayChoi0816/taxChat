/** @typedef {'apartment' | 'land' | 'commercial'} AssetType */

export const CAPITAL_GAINS_TAX_VERSION = '2026-preview-1'

export const ASSET_OPTIONS = [
  { value: 'apartment', label: '아파트 / 주택' },
  { value: 'land', label: '토지' },
  { value: 'commercial', label: '상가 / 기타' },
]

export const HOUSE_OPTIONS = [
  { value: '1', label: '1채' },
  { value: '2', label: '2채' },
  { value: '3plus', label: '3채 이상' },
]

export const HOLDING_OPTIONS = [
  { value: 'under1', label: '1년 미만' },
  { value: '1to2', label: '1~2년' },
  { value: '2plus', label: '2년 이상' },
  { value: '5plus', label: '5년 이상' },
]

export const EXPENSE_PRESET_UNKNOWN = 'unknown'
export const EXPENSE_PRESET_INPUT = 'direct'
