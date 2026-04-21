import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../contexts/AdminAuthContext'
import './AdminLogin.css'

const AdminLogin = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdminAuthed, login } = useAdminAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = location.state?.from || '/admin/customer'

  useEffect(() => {
    if (isAdminAuthed) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAdminAuthed, navigate, redirectTo])

  const handleChange = (e) => {
    setPassword(e.target.value)
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    const result = await login(password)
    setSubmitting(false)
    if (result.success) {
      navigate(redirectTo, { replace: true })
    } else {
      setError(result.error || '비밀번호가 일치하지 않습니다')
      setPassword('')
    }
  }

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1 className="admin-login-title">관리자 로그인</h1>
          <p className="admin-login-subtitle">관리자 비밀번호를 입력해 주세요</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className="admin-login-input"
            placeholder="비밀번호"
            value={password}
            onChange={handleChange}
            autoFocus
            autoComplete="current-password"
            disabled={submitting}
          />

          {error && <p className="admin-login-error">{error}</p>}

          <button
            type="submit"
            className={`admin-login-button ${password ? 'enabled' : 'disabled'}`}
            disabled={!password || submitting}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <button
          type="button"
          className="admin-login-back"
          onClick={() => navigate('/')}
        >
          ← 메인 화면으로 돌아가기
        </button>
      </div>
    </div>
  )
}

export default AdminLogin
