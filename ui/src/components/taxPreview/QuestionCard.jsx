import './taxPreview.css'

export default function QuestionCard({ title, hint, children }) {
  return (
    <div className="tax-question-card">
      {title ? <h2 className="tax-question-title">{title}</h2> : null}
      {hint ? <p className="tax-question-hint">{hint}</p> : null}
      <div className="tax-question-body">{children}</div>
    </div>
  )
}
