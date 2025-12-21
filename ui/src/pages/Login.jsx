import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import './Login.css'
import mayLogo from '../assets/may_logo.png'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLoginEnabled, setIsLoginEnabled] = useState(false)

  // 이미 로그인된 경우 메인 화면으로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const formatPhoneNumber = (value) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '')
    
    // 하이픈 자동 추가
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }
  }

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value
    const formatted = formatPhoneNumber(value)
    setPhoneNumber(formatted)
    // 휴대폰번호가 입력되면 로그인 버튼 활성화 (최소 10자리 이상)
    const numbers = formatted.replace(/[^\d]/g, '')
    setIsLoginEnabled(numbers.length >= 10)
  }

  const handleLogin = async () => {
    if (isLoginEnabled && phoneNumber.trim()) {
      try {
        const result = await login(phoneNumber)
        if (result.success) {
          // 로그인 성공 시 메인 화면으로 이동
          navigate('/')
        } else {
          alert(result.error || '로그인에 실패했습니다')
        }
      } catch (error) {
        console.error('로그인 오류:', error)
        alert('로그인 중 오류가 발생했습니다')
      }
    }
  }

  const handleSignUp = () => {
    // 회원가입 페이지로 이동 (추후 구현)
    console.log('회원가입 페이지로 이동')
  }

  const handleKakaoChannel = () => {
    window.open('https://pf.kakao.com/_your_channel_id', '_blank')
  }

  return (
    <div className="app-wrapper">
      {/* Background Decoration for Desktop/Tablet */}
      <div className="background-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
        <div className="decoration-circle circle-3"></div>
        <div className="decoration-pattern"></div>
      </div>

      {/* Mobile App Container */}
      <div className="mobile-app-container">
        <div className="app">
          <div className="login-content">
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
                className="login-phone-input"
                placeholder="휴대전화번호를 입력하세요"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                maxLength={13}
              />
              
              <button
                className={`login-button ${isLoginEnabled ? 'enabled' : 'disabled'}`}
                onClick={handleLogin}
                disabled={!isLoginEnabled}
              >
                로그인
              </button>

              <button
                className="login-signup-link"
                onClick={handleSignUp}
              >
                회원 가입하기
              </button>
            </div>

            {/* Footer */}
            <div className="login-footer">
              <div className="login-footer-item">사용문의</div>
              <button
                className="login-footer-link"
                onClick={handleKakaoChannel}
              >
                카카오채널
              </button>
              <div className="login-footer-item">byray</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
