import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import './Login.css'
import './AuthVerify.css'
import mayLogo from '../assets/may_logo.png'
import { authAPI } from '../utils/api'
import AuthPageHeader from '../components/AuthPageHeader'
import PasswordVisibilityToggle from '../components/auth/PasswordVisibilityToggle.jsx'

const PHONE_REGEX = /^01\d{8,9}$/
const PASSWORD_REGEX = /^[\x21-\x7E]{6,20}$/
const CODE_REGEX = /^\d{6}$/

const formatPhoneNumber = (value) => {
  const numbers = value.replace(/[^\d]/g, '').slice(0, 11)
  if (numbers.length <= 3) return numbers
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
}

const toDigits = (value) => String(value || '').replace(/[^\d]/g, '')

const ResetPassword = () => {
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

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
  const [submitting, setSubmitting] = useState(false)

  const timerRef = useRef(null)
  const phoneInputRef = useRef(null)

  const phoneDigits = useMemo(() => toDigits(phoneNumber), [phoneNumber])
  const isPhoneValid = PHONE_REGEX.test(phoneDigits)
  const isPasswordValid = PASSWORD_REGEX.test(password)
  const isPasswordConfirmValid =
    passwordConfirm.length > 0 && password === passwordConfirm
  const canOpenSms = isPhoneValid && !verified
  const canVerify = codeSent && CODE_REGEX.test(code) && !verifying && !verified
  const canSubmit =
    verified && isPasswordValid && isPasswordConfirmValid && !submitting

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

  const applySuccessfulSmsRequest = (res) => {
    setCodeSent(true)
    setVerified(false)
    setCode('')
    setDevCode(res.devCode || '')
    startTimer(res.ttlSeconds || 300)
    setSmsInfoMsg('인증번호가 발송되었습니다.')
  }

  const handleRequestCode = async ({ openModalOnSuccess }) => {
    setRequesting(true)
    setSmsErrorMsg('')
    setSmsInfoMsg('')
    try {
      const res = await authAPI.requestPasswordResetSms(phoneDigits)
      if (res.success) {
        applySuccessfulSmsRequest(res)
        if (openModalOnSuccess) setSmsOpen(true)
      }
    } catch (err) {
      const msg = err.message || ''
      if (openModalOnSuccess) alert(msg || '요청 실패')
      else setSmsErrorMsg(msg || '요청 실패')
    } finally {
      setRequesting(false)
    }
  }

  const openSmsModal = async () => {
    if (!canOpenSms) return
    await handleRequestCode({ openModalOnSuccess: true })
  }

  const closeSmsModal = () => setSmsOpen(false)

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
      }
    } catch (err) {
      setSmsErrorMsg(err.message || '인증에 실패했습니다')
    } finally {
      setVerifying(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await authAPI.completePasswordReset(phoneDigits, password)
      alert('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.')
      navigate('/login')
    } catch (err) {
      alert(err.message || '재설정에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => navigate('/login')

  return (
    <div className="app-wrapper">
      <div className="background-decoration">
        <div className="decoration-circle circle-1" />
        <div className="decoration-circle circle-2" />
        <div className="decoration-circle circle-3" />
        <div className="decoration-pattern" />
      </div>

      <div className="mobile-app-container">
        <div className="app app-auth">
          <div className="auth-page-shell">
            <div className="auth-page-scroll">
              <AuthPageHeader title="비밀번호 재설정" onBack={handleBack} />
              <div className="auth-page-content">
                <div className="login-content auth-verify-content">
                  <div className="login-logo-section auth-verify-logo">
                    <div className="login-logo">
                      <div className="logo-circle">
                        <img src={mayLogo} alt="세무회계 오월 로고" className="logo-image" />
                      </div>
                    </div>
                    <h1 className="login-service-name">세무회계 오월</h1>
                    <p className="auth-verify-subtitle">
                      등록된 휴대폰으로 인증 후 비밀번호 변경
                    </p>
                  </div>

                  <div className="login-form auth-verify-form">
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

                    <button
                      type="button"
                      className={`login-button auth-verify-phone-btn ${
                        verified ? 'disabled verified' : canOpenSms && !requesting ? 'enabled' : 'disabled'
                      }`}
                      onClick={openSmsModal}
                      disabled={!canOpenSms || requesting}
                    >
                      {verified
                        ? '휴대폰 인증완료'
                        : requesting && !smsOpen
                          ? '확인 중...'
                          : '휴대폰 인증하기'}
                    </button>

                    <div className="auth-verify-field">
                      <div className="auth-verify-label-row">
                        <label className="auth-verify-label">새 비밀번호</label>
                        <span className="auth-verify-hint">영문·숫자·특수문자 6~20자</span>
                      </div>
                      <div className="login-password-wrap">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          className="login-input auth-verify-input login-input-password-padding"
                          placeholder="새 비밀번호 입력"
                          value={password}
                          onChange={(e) => setPassword(e.target.value.slice(0, 20))}
                          autoComplete="new-password"
                          maxLength={20}
                          disabled={!verified}
                        />
                        <PasswordVisibilityToggle
                          revealed={showPwd}
                          onToggle={() => setShowPwd(!showPwd)}
                        />
                      </div>
                      {password.length > 0 && !isPasswordValid && (
                        <p className="auth-verify-field-error">
                          영문 또는 숫자 또는 특수문자로 6~20자를 입력해 주세요
                        </p>
                      )}
                    </div>

                    <div className="auth-verify-field">
                      <label className="auth-verify-label">새 비밀번호 확인</label>
                      <div className="login-password-wrap">
                        <input
                          type={showPwd2 ? 'text' : 'password'}
                          className="login-input auth-verify-input login-input-password-padding"
                          placeholder="새 비밀번호 재입력"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value.slice(0, 20))}
                          autoComplete="new-password"
                          maxLength={20}
                          disabled={!verified}
                        />
                        <PasswordVisibilityToggle
                          revealed={showPwd2}
                          onToggle={() => setShowPwd2(!showPwd2)}
                        />
                      </div>
                      {passwordConfirm.length > 0 && password !== passwordConfirm && (
                        <p className="auth-verify-field-error">비밀번호가 일치하지 않습니다</p>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`login-button ${canSubmit ? 'enabled' : 'disabled'}`}
                      disabled={!canSubmit}
                      onClick={handleSubmit}
                    >
                      {submitting ? '처리 중...' : '비밀번호 재설정'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {smsOpen && (
        <div className="auth-verify-modal-backdrop" onClick={closeSmsModal}>
          <div className="auth-verify-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-verify-modal-head">
              <h2 className="auth-verify-modal-title">휴대폰 SMS 인증</h2>
              <button type="button" className="auth-verify-modal-close" onClick={closeSmsModal}>
                닫기
              </button>
            </div>
            <p className="auth-verify-modal-desc">{phoneNumber} 로 인증번호를 보냈습니다.</p>
            {!!devCode && (
              <p className="auth-verify-modal-dev">[개발] 인증번호: {devCode}</p>
            )}
            <div className="auth-verify-code-row">
              <input
                type="text"
                inputMode="numeric"
                className="login-input auth-verify-input auth-verify-code-input"
                placeholder="6자리"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                }
              />
              <button
                type="button"
                className={`auth-verify-code-btn ${canVerify ? 'enabled' : 'disabled'}`}
                disabled={!canVerify}
                onClick={handleVerifyCode}
              >
                {verifying ? '확인 중' : '확인'}
              </button>
            </div>
            <div className="auth-verify-modal-foot">
              {remainSec > 0 && (
                <span className="auth-verify-timer">{formatRemain(remainSec)}</span>
              )}
              <button
                type="button"
                className="auth-verify-resend-btn"
                disabled={requesting || !isPhoneValid}
                onClick={() => handleRequestCode({ openModalOnSuccess: false })}
              >
                {requesting ? '요청 중' : '인증번호 재요청'}
              </button>
            </div>
            {smsErrorMsg && <p className="auth-verify-field-error">{smsErrorMsg}</p>}
            {smsInfoMsg && <p className="auth-verify-info">{smsInfoMsg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default ResetPassword
