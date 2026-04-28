import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import './Login.css'
import './AuthVerify.css'
import mayLogo from '../assets/may_logo.png'
import { authAPI } from '../utils/api'

const PHONE_REGEX = /^01\d{8,9}$/
// 비밀번호 규칙: 영문/숫자/특수문자 6~20자 (공백 제외 ASCII 출력 가능 문자)
const PASSWORD_REGEX = /^[\x21-\x7E]{6,20}$/
const CODE_REGEX = /^\d{6}$/

const formatPhoneNumber = (value) => {
  const numbers = value.replace(/[^\d]/g, '').slice(0, 11)
  if (numbers.length <= 3) return numbers
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
}

const toDigits = (value) => String(value || '').replace(/[^\d]/g, '')

const AuthVerify = () => {
  const navigate = useNavigate()

  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)

  const [smsOpen, setSmsOpen] = useState(false)
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [remainSec, setRemainSec] = useState(0)
  const [requesting, setRequesting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [smsErrorMsg, setSmsErrorMsg] = useState('')
  const [smsInfoMsg, setSmsInfoMsg] = useState('')

  const timerRef = useRef(null)
  const phoneInputRef = useRef(null)

  const phoneDigits = useMemo(() => toDigits(phoneNumber), [phoneNumber])
  const isPhoneValid = PHONE_REGEX.test(phoneDigits)
  const isPasswordValid = PASSWORD_REGEX.test(password)
  const isPasswordConfirmValid =
    passwordConfirm.length > 0 && password === passwordConfirm
  const canOpenSms = isPhoneValid && !verified
  const canVerify = codeSent && CODE_REGEX.test(code) && !verifying && !verified
  const canComplete =
    verified && isPasswordValid && isPasswordConfirmValid && agreed

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startTimer = (seconds) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setRemainSec(seconds)
    timerRef.current = setInterval(() => {
      setRemainSec((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatRemain = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0')
    const s = String(sec % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  const resetVerification = () => {
    setCodeSent(false)
    setVerified(false)
    setCode('')
    setDevCode('')
    setRemainSec(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handlePhoneChange = (e) => {
    setPhoneNumber(formatPhoneNumber(e.target.value))
    if (verified || codeSent) resetVerification()
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value.slice(0, 20))
  }

  const handlePasswordConfirmChange = (e) => {
    setPasswordConfirm(e.target.value.slice(0, 20))
  }

  const handleCodeChange = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 6)
    setCode(digits)
    setSmsErrorMsg('')
  }

  const openSmsModal = async () => {
    if (!canOpenSms) return
    setSmsOpen(true)
    setSmsErrorMsg('')
    setSmsInfoMsg('')
    await handleRequestCode()
  }

  const closeSmsModal = () => {
    setSmsOpen(false)
  }

  const handleRequestCode = async () => {
    setRequesting(true)
    setSmsErrorMsg('')
    setSmsInfoMsg('')
    try {
      const res = await authAPI.requestSmsCode(phoneDigits)
      if (res.success) {
        setCodeSent(true)
        setVerified(false)
        setCode('')
        setDevCode(res.devCode || '')
        startTimer(res.ttlSeconds || 300)
        setSmsInfoMsg('인증번호가 발송되었습니다. SMS를 확인해 주세요.')
      } else {
        setSmsErrorMsg(res.error || '인증번호 발송에 실패했습니다')
      }
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('이미 가입된 휴대폰')) {
        alert('이미 가입된 휴대폰번호입니다.')
        setSmsOpen(false)
        setSmsErrorMsg('')
        phoneInputRef.current?.focus()
        return
      }
      setSmsErrorMsg(msg || '인증번호 발송에 실패했습니다')
    } finally {
      setRequesting(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!canVerify) return
    setVerifying(true)
    setSmsErrorMsg('')
    try {
      const res = await authAPI.verifySmsCode(phoneDigits, code)
      if (res.success) {
        setVerified(true)
        if (timerRef.current) clearInterval(timerRef.current)
        setSmsOpen(false)
      } else {
        setSmsErrorMsg(res.error || '인증에 실패했습니다')
      }
    } catch (err) {
      setSmsErrorMsg(err.message || '인증에 실패했습니다')
    } finally {
      setVerifying(false)
    }
  }

  const handleComplete = () => {
    if (!canComplete) return
    navigate('/add-member-type', {
      state: {
        existingTypes: [],
        signupPhone: phoneDigits,
        signupPassword: password,
      },
    })
  }

  const handleBack = () => {
    navigate('/login')
  }

  const handleOpenTerms = (e) => {
    e.preventDefault()
    e.stopPropagation()
    alert('이용 약관은 준비 중입니다.')
  }

  return (
    <div className="app-wrapper">
      <div className="background-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
        <div className="decoration-circle circle-3"></div>
        <div className="decoration-pattern"></div>
      </div>

      <div className="mobile-app-container">
        <div className="app">
          <div className="login-content auth-verify-content">
            <button type="button" className="auth-verify-back-btn" onClick={handleBack}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            <div className="login-logo-section auth-verify-logo">
              <div className="login-logo">
                <div className="logo-circle">
                  <img src={mayLogo} alt="세무회계 오월 로고" className="logo-image" />
                </div>
              </div>
              <h1 className="login-service-name">인증하기</h1>
              <p className="auth-verify-subtitle">
                회원가입을 위해 휴대폰 인증을 진행해 주세요
              </p>
            </div>

            <div className="login-form auth-verify-form">
              {/* 휴대폰 번호 */}
              <div className="auth-verify-field">
                <label className="auth-verify-label">휴대폰 번호</label>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  className="login-input auth-verify-input"
                  placeholder="휴대전화번호 입력"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  maxLength={13}
                  inputMode="numeric"
                  autoComplete="tel"
                  disabled={verified}
                />
              </div>

              {/* 휴대폰 인증하기 / 인증완료 버튼 */}
              <button
                type="button"
                className={`login-button auth-verify-phone-btn ${
                  verified ? 'disabled verified' : canOpenSms ? 'enabled' : 'disabled'
                }`}
                onClick={openSmsModal}
                disabled={!canOpenSms}
              >
                {verified ? '휴대폰 인증완료' : '휴대폰 인증하기'}
              </button>

              {/* 비밀번호 */}
              <div className="auth-verify-field">
                <div className="auth-verify-label-row">
                  <label className="auth-verify-label">비밀번호</label>
                  <span className="auth-verify-hint">영문 또는 숫자 또는 특수문자 6~20</span>
                </div>
                <input
                  type="password"
                  className="login-input auth-verify-input"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  maxLength={20}
                />
                {password.length > 0 && !isPasswordValid && (
                  <p className="auth-verify-field-error">
                    영문 또는 숫자 또는 특수문자로 6~20자를 입력해 주세요
                  </p>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div className="auth-verify-field">
                <label className="auth-verify-label">비밀번호 확인</label>
                <input
                  type="password"
                  className="login-input auth-verify-input"
                  placeholder="비밀번호 확인"
                  value={passwordConfirm}
                  onChange={handlePasswordConfirmChange}
                  autoComplete="new-password"
                  maxLength={20}
                />
                {passwordConfirm.length > 0 && password !== passwordConfirm && (
                  <p className="auth-verify-field-error">
                    비밀번호가 일치하지 않습니다
                  </p>
                )}
              </div>

              {/* 이용 약관 동의 */}
              <label className="auth-verify-agree">
                <input
                  type="checkbox"
                  className="auth-verify-agree-checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="auth-verify-agree-box" aria-hidden="true">
                  {agreed && (
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="4 10 8 14 16 6"></polyline>
                    </svg>
                  )}
                </span>
                <span className="auth-verify-agree-text">
                  <button
                    type="button"
                    className="auth-verify-agree-link"
                    onClick={handleOpenTerms}
                  >
                    이용
                  </button>
                  {' 약관에 동의합니다.'}
                </span>
              </label>

              {/* 다음 단계 */}
              <button
                type="button"
                className={`login-button auth-verify-next ${canComplete ? 'enabled' : 'disabled'}`}
                onClick={handleComplete}
                disabled={!canComplete}
              >
                다음 단계 - 회원 유형 선택
              </button>
            </div>

            {/* SMS 인증 모달 */}
            {smsOpen && (
              <div className="auth-verify-modal-backdrop" onClick={closeSmsModal}>
                <div
                  className="auth-verify-modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="auth-verify-modal-head">
                    <h2 className="auth-verify-modal-title">휴대폰 SMS 인증</h2>
                    <button
                      type="button"
                      className="auth-verify-modal-close"
                      onClick={closeSmsModal}
                      aria-label="닫기"
                    >
                      ×
                    </button>
                  </div>

                  <p className="auth-verify-modal-desc">
                    <strong>{phoneNumber}</strong> 으로 발송된 6자리 인증번호를 입력해 주세요
                  </p>

                  {devCode && (
                    <p className="auth-verify-modal-dev">
                      개발용 코드: <strong>{devCode}</strong>
                    </p>
                  )}

                  <div className="auth-verify-code-row">
                    <input
                      type="text"
                      className="login-input auth-verify-input auth-verify-code-input"
                      placeholder="6자리 숫자"
                      value={code}
                      onChange={handleCodeChange}
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={`auth-verify-code-btn ${canVerify ? 'enabled' : 'disabled'}`}
                      onClick={handleVerifyCode}
                      disabled={!canVerify}
                    >
                      {verifying ? '확인 중' : '확인'}
                    </button>
                  </div>

                  <div className="auth-verify-modal-foot">
                    <span className="auth-verify-timer">
                      {remainSec > 0
                        ? `남은 시간 ${formatRemain(remainSec)}`
                        : codeSent
                          ? '시간이 만료되었습니다'
                          : requesting
                            ? '인증번호 전송 중...'
                            : ''}
                    </span>
                    <button
                      type="button"
                      className="auth-verify-resend-btn"
                      onClick={handleRequestCode}
                      disabled={requesting}
                    >
                      {requesting ? '전송 중...' : '인증번호 재전송'}
                    </button>
                  </div>

                  {smsInfoMsg && !smsErrorMsg && (
                    <p className="auth-verify-info">{smsInfoMsg}</p>
                  )}
                  {smsErrorMsg && <p className="login-error">{smsErrorMsg}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthVerify
