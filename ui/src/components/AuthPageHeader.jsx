import './AuthPageHeader.css'

const AuthPageHeader = ({ title, onBack }) => {
  return (
    <header className="auth-page-header">
      <button type="button" className="auth-page-header-back" onClick={onBack} aria-label="뒤로가기">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1 className="auth-page-header-title">{title}</h1>
      <span className="auth-page-header-spacer" aria-hidden />
    </header>
  )
}

export default AuthPageHeader
