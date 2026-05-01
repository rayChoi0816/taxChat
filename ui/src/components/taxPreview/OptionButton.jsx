import './taxPreview.css'

export default function OptionButton({ selected, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`tax-option-btn ${selected ? 'selected' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
