import './taxPreview.css'

export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  return (
    <div className="tax-progress-wrap">
      <div className="tax-progress-label">
        {current} / {total}
      </div>
      <div className="tax-progress-track">
        <div className="tax-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
