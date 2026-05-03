import './taxPreview.css'

export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const label = pct >= 100 ? '100% 완료' : `${pct}%`
  return (
    <div className="tax-progress-wrap">
      <div className="tax-progress-label">{label}</div>
      <div className="tax-progress-track">
        <div className="tax-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
