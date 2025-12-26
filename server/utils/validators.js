/**
 * 유효성 검사 유틸리티 함수
 */

/**
 * 이메일 유효성 검사
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 전화번호 유효성 검사 (한국 형식)
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

/**
 * 주민등록번호 유효성 검사
 */
export const isValidSSN = (ssn) => {
  const ssnRegex = /^[0-9]{6}-?[1-4][0-9]{6}$/
  return ssnRegex.test(ssn.replace(/\s/g, ''))
}

/**
 * 사업자번호 유효성 검사
 */
export const isValidBusinessNumber = (businessNumber) => {
  const businessNumberRegex = /^[0-9]{3}-?[0-9]{2}-?[0-9]{5}$/
  return businessNumberRegex.test(businessNumber.replace(/\s/g, ''))
}

/**
 * 필수 필드 검사
 */
export const validateRequired = (data, fields) => {
  const missing = []
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field)
    }
  }
  if (missing.length > 0) {
    throw new Error(`필수 필드가 누락되었습니다: ${missing.join(', ')}`)
  }
}

/**
 * 숫자 범위 검사
 */
export const validateRange = (value, min, max) => {
  const num = Number(value)
  if (isNaN(num)) {
    throw new Error('숫자가 아닙니다')
  }
  if (num < min || num > max) {
    throw new Error(`값은 ${min}과 ${max} 사이여야 합니다`)
  }
  return num
}

