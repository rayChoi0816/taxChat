import { useNavigate } from 'react-router-dom'
import '../components/taxPreview/taxPreview.css'

export default function TaxSelectPage() {
  const navigate = useNavigate()

  return (
    <div className="tax-preview-page">
      <header className="tax-preview-header">
        <button
          type="button"
          className="tax-preview-back"
          aria-label="뒤로"
          onClick={() => navigate(-1)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="tax-preview-title">세금 선택</h1>
      </header>

      <section className="tax-preview-body">
        <div className="tax-select-list">
          <button type="button" className="tax-option-btn" onClick={() => navigate('/tax-preview/capital-gains')}>
            양도소득세
          </button>
          <button type="button" className="tax-option-btn" disabled aria-disabled title="준비 중">
            상속세 (준비 중)
          </button>
          <button type="button" className="tax-option-btn" disabled aria-disabled title="준비 중">
            종합소득세 (준비 중)
          </button>
        </div>
      </section>
    </div>
  )
}
