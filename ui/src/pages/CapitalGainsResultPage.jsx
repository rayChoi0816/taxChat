import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../components/taxPreview/taxPreview.css'
import { KAKAO_CONSULT_CHAT_URL } from '../components/KakaoConsultDragButton.jsx'
import { calculateCapitalGainsTax } from '../engine/taxPreview/TaxCalculator.js'
import { interpretCapitalGainsResult } from '../engine/taxPreview/ResultInterpreter.js'
import { CAPITAL_GAINS_TAX_VERSION } from '../engine/taxPreview/capitalGainsQuestionConfig.js'
import { formatKRWLabel } from './CapitalGainsFlowPage.jsx'
import { useCapitalGainsFlow } from '../engine/taxPreview/TaxFlowEngine.jsx'

function isCapitalGainsComplete(data) {
  const feeOk =
    data.expensesUnknown === true ||
    (data.expensesUnknown === false &&
      typeof data.expenses === 'number' &&
      Number.isFinite(data.expenses))
  return !!(
    data.confirmedStart &&
    data.assetType &&
    data.houseCount &&
    data.holdingPeriod &&
    (data.isResident === true || data.isResident === false) &&
    Number(data.purchasePrice) > 0 &&
    Number(data.salePrice) > 0 &&
    feeOk
  )
}

export default function CapitalGainsResultPage() {
  const navigate = useNavigate()
  const { data, reset } = useCapitalGainsFlow()

  const complete = useMemo(() => isCapitalGainsComplete(data), [data])

  useEffect(() => {
    if (!complete) {
      navigate('/tax-preview/capital-gains', { replace: true })
    }
  }, [complete, navigate])

  const result = useMemo(() => calculateCapitalGainsTax(data), [data])

  const lines = useMemo(
    () => interpretCapitalGainsResult(data, result),
    [data, result]
  )

  const openKakao = () =>
    window.open(KAKAO_CONSULT_CHAT_URL, '_blank', 'noopener,noreferrer')

  const restart = () => {
    reset()
    navigate('/tax-preview/capital-gains', { replace: true })
  }

  const sale = Number(data.salePrice)
  const showRatio =
    !result.exempt &&
    Number.isFinite(sale) &&
    sale > 0 &&
    Number.isFinite(result.finalTax)

  if (!complete) {
    return (
      <div className="tax-preview-page">
        <p className="tax-loading-msg">불러오는 중입니다…</p>
      </div>
    )
  }

  return (
    <div className="tax-preview-page">
      <header className="tax-preview-header">
        <button type="button" className="tax-preview-back" aria-label="뒤로" onClick={() => navigate('/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="tax-preview-title">계산 결과</h1>
      </header>

      <section className="tax-preview-body">
        <div className="tax-question-card">
          <div className="tax-result-hero">
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              예상 세금 · 지방 포함
            </div>
            <p className="tax-result-main-amount">
              약 {formatKRWLabel(result.finalTax)}원
              {showRatio ? (
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginTop: '0.25rem', fontWeight: 600 }}>
                  (매매가 대비 약{' '}
                  {((result.finalTax / sale) * 100).toFixed(1)}
                  %, 참고)
                </span>
              ) : null}
            </p>
          </div>

          <div className="tax-result-rows">
            <div className="tax-result-row">
              <span>비과세요</span>
              <strong>{result.exempt ? '예 (추정)' : '아니오 · 간이 과세 표준 적용'}</strong>
            </div>
            <div className="tax-result-row">
              <span>양도차익</span>
              <strong>{formatKRWLabel(result.gain)}원</strong>
            </div>
            <div className="tax-result-row">
              <span>과세표준 (참고)</span>
              <strong>{formatKRWLabel(result.taxableBase)}원</strong>
            </div>
            {!result.exempt ? (
              <div className="tax-result-row">
                <span>국세 (참고)</span>
                <strong>{formatKRWLabel(result.nationalTax)}원</strong>
              </div>
            ) : null}
            {!result.exempt ? (
              <div className="tax-result-row">
                <span>지방소득세 (국세 × 10%)</span>
                <strong>{formatKRWLabel(result.localIncomeTax)}원</strong>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
            버전 · {CAPITAL_GAINS_TAX_VERSION}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {lines.map((t, i) => (
              <p key={i} style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: 1.55 }}>
                {t}
              </p>
            ))}
          </div>

          <div className="tax-disclaimer">
            본 결과는 간이 참고 계산물이며, 실제 과세 특례·공제 여부 및 세금은 다를 수 있습니다. 공동명의,
            종전대보·증여·양도 차익 제외항목 등은 포함하지 않았습니다.
          </div>

          <div className="tax-cta-stack">
            <button type="button" className="tax-cta-primary" onClick={openKakao}>
              세무사에게 정확한 계산 받아보기
            </button>
            <button type="button" className="tax-cta-secondary" onClick={openKakao}>
              절세 상담 받기
            </button>
          </div>

          <button
            type="button"
            className="tax-flow-nav-btn secondary"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={restart}
          >
            새로 계산하기
          </button>
        </div>
      </section>
    </div>
  )
}
