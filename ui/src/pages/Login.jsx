import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import './Login.css'
import mayLogo from '../assets/may_logo.png'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const isLoginEnabled = useMemo(() => {
    const digits = phoneNumber.replace(/[^\d]/g, '')
    return digits.length >= 10 && password.length > 0 && !submitting
  }, [phoneNumber, password, submitting])

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '').slice(0, 11)
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneNumberChange = (e) => {
    setPhoneNumber(formatPhoneNumber(e.target.value))
    setErrorMsg('')
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    setErrorMsg('')
  }

  const handleLogin = async () => {
    if (!isLoginEnabled) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const result = await login(phoneNumber, password)
      if (result.success) {
        navigate('/')
      } else {
        setErrorMsg(result.error || '로그인에 실패했습니다')
      }
    } catch (err) {
      console.error('로그인 오류:', err)
      setErrorMsg('로그인 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  const handleBack = () => {
    navigate('/')
  }

  const handleSignUp = () => {
    navigate('/auth-verify')
  }

  const handleResetPassword = () => {
    alert('비밀번호 재설정 기능은 준비 중입니다.')
  }

  const handleKakaoChannel = () => {
    window.open('https://pf.kakao.com/_your_channel_id', '_blank')
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
        <div className="app app-auth">
          <div className="login-content login-content--with-shell-back">
            <button type="button" className="shell-back-btn" onClick={handleBack} aria-label="뒤로가기">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            {/* Logo */}
            <div className="login-logo-section">
              <div className="login-logo">
                <div className="logo-circle">
                  <img src={mayLogo} alt="세무회계 오월 로고" className="logo-image" />
                </div>
              </div>
              <h1 className="login-service-name">세무회계 오월</h1>
            </div>

            {/* Login Form */}
            <div className="login-form">
              <input
                type="tel"
                className="login-input"
                placeholder="휴대전화번호 입력"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                onKeyDown={handleKeyDown}
                maxLength={13}
                inputMode="numeric"
                autoComplete="tel"
              />

              <input
                type="password"
                className="login-input"
                placeholder="비밀번호 입력"
                value={password}
                onChange={handlePasswordChange}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />

              <button
                className={`login-button ${isLoginEnabled ? 'enabled' : 'disabled'}`}
                onClick={handleLogin}
                disabled={!isLoginEnabled}
              >
                {submitting ? '로그인 중...' : '로그인'}
              </button>

              {errorMsg && <p className="login-error">{errorMsg}</p>}

              <div className="login-links">
                <button type="button" className="login-link-btn" onClick={handleSignUp}>
                  회원 가입하기
                </button>
                <span className="login-link-sep">|</span>
                <button type="button" className="login-link-btn" onClick={handleResetPassword}>
                  비밀번호 재설정
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="login-footer">
              <div className="login-footer-title">사용문의</div>
              <button
                type="button"
                className="login-footer-link"
                onClick={handleKakaoChannel}
              >
                카카오채널
              </button>
              <div className="login-footer-brand">byray</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
