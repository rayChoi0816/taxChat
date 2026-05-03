/** 앱 파비콘 + 표시/숨김(눈) 아이콘 — 버튼에 텍스트 없이 접근성은 aria-label */
export function pwdFaviconSrc() {
  const b = String(import.meta.env.BASE_URL || '/')
  const norm = b.endsWith('/') ? b : `${b}/`
  return `${norm}vite.svg`
}

export function EyeOpenIcon({ className }) {
  return (
    <svg
      className={className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon({ className }) {
  return (
    <svg
      className={className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.73 10.73a3 3 0 004.54 4.54m1.71-4.54a3 3 0 10-6.26-6.26" />
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-6 0-10-8-10-8a17.93 17.93 0 014.93-6.43" />
      <path d="M9.9 5a13.93 13.93 0 016.36 6.51M14.07 13.93A14.93 14.93 0 0112 20c-6 0-10-8-10-8a17.85 17.85 0 017.21-10" />
    </svg>
  )
}

/** @param {{ revealed: boolean, onToggle: () => void, labelReveal?: string, labelHide?: string }} props */
export default function PasswordVisibilityToggle({
  revealed,
  onToggle,
  labelReveal = '비밀번호 표시',
  labelHide = '비밀번호 숨기기',
}) {
  return (
    <button
      type="button"
      className="pwd-visibility-toggle"
      onClick={onToggle}
      aria-label={revealed ? labelHide : labelReveal}
    >
      <img src={pwdFaviconSrc()} alt="" className="pwd-visibility-favicon" width={16} height={16} />
      {revealed ? <EyeOffIcon className="pwd-visibility-svg" /> : <EyeOpenIcon className="pwd-visibility-svg" />}
    </button>
  )
}
