import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../components/taxPreview/taxPreview.css'
import { KAKAO_CONSULT_CHAT_URL } from '../components/KakaoConsultDragButton.jsx'
import { calculateCapitalGainsTax } from '../engine/taxPreview/TaxCalculator.js'
import { interpretCapitalGainsResult } from '../engine/taxPreview/ResultInterpreter.js'
import { CAPITAL_GAINS_TAX_VERSION } from '../engine/taxPreview/capitalGainsQuestionConfig.js'
import { formatKRWLabel } from './CapitalGainsFlowPage.jsx'
import { useCapitalGainsFlow } from '../engine/taxPreview/TaxFlowEngine.jsx'
import {
  capitalGainsDisclosureFingerprint,
  clearDisclosureSession,
  loadDisclosureStateFromSession,
  saveDisclosureConfirmedToSession,
} from '../utils/capitalGainsResultReveal.js'
import {
  estimatePotentialSavingsKRW,
  maskPartialWonDisplay,
} from '../utils/taxAmountPresentation.js'
import {
  getConsultCtaAssignment,
  trackTaxPreviewResult,
} from '../utils/taxPreviewResultTracking.js'

function isCapitalGainsComplete(data) {
  const feeOk =
    data.expensesUnknown === true ||
    (data.expensesUnknown === false &&
      typeof data.expenses === 'number' &&
      Number.isFinite(data.expenses))
  return !!(
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
  const fingerprint = useMemo(() => capitalGainsDisclosureFingerprint(data), [data])
  const ctaAssignment = useMemo(() => getConsultCtaAssignment(), [])
  const trackedViewRef = useRef(false)

  const [revealed, setRevealed] = useState(false)
  const [disclosureModalOpen, setDisclosureModalOpen] = useState(false)

  useEffect(() => {
    if (!complete) return
    setRevealed(loadDisclosureStateFromSession(fingerprint))
  }, [complete, fingerprint])

  useEffect(() => {
    if (!complete || trackedViewRef.current) return
    trackedViewRef.current = true
    trackTaxPreviewResult('capital_gains_result_view', {
      fingerprint,
      cta_variant: ctaAssignment.id,
      disclosed: loadDisclosureStateFromSession(fingerprint),
    })
  }, [complete, fingerprint, ctaAssignment.id])

  useEffect(() => {
    if (!complete) return
    setDisclosureModalOpen(false)
  }, [complete, fingerprint])

  useEffect(() => {
    if (!disclosureModalOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setDisclosureModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disclosureModalOpen])

  useEffect(() => {
    if (!disclosureModalOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [disclosureModalOpen])

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

  const potentialSavings = useMemo(
    () => estimatePotentialSavingsKRW(result.finalTax, result.exempt),
    [result.finalTax, result.exempt]
  )

  const openKakao = () =>
    window.open(KAKAO_CONSULT_CHAT_URL, '_blank', 'noopener,noreferrer')

  const onConsultPrimary = () => {
    trackTaxPreviewResult('capital_gains_result_consult_cta_click', {
      cta_variant: ctaAssignment.id,
      fingerprint,
      label: ctaAssignment.label,
    })
    openKakao()
  }

  const restart = () => {
    clearDisclosureSession()
    reset()
    navigate('/tax-preview/capital-gains', { replace: true })
  }

  const sale = Number(data.salePrice)
  const showRatio =
    !result.exempt &&
    Number.isFinite(sale) &&
    sale > 0 &&
    Number.isFinite(result.finalTax)

  const maskedLine = maskPartialWonDisplay(result.finalTax)

  const onOpenDisclosureModal = () => {
    trackTaxPreviewResult('capital_gains_result_disclosure_cta_click', { fingerprint })
    setDisclosureModalOpen(true)
  }

  const onConfirmDisclosure = () => {
    trackTaxPreviewResult('capital_gains_result_modal_confirm', { fingerprint })
    saveDisclosureConfirmedToSession(fingerprint)
    setRevealed(true)
    setDisclosureModalOpen(false)
  }

  const onCloseModal = () => setDisclosureModalOpen(false)

  if (!complete) {
    return (
      <div className="tax-preview-page tax-result-page-shell">
        <p className="tax-loading-msg">불러오는 중입니다…</p>
      </div>
    )
  }

  const goHome = () => navigate('/')

  const DISCLOSURE_MODAL_BODY =
    '본 결과는 입력 정보를 기반으로 자동 계산된 참고용 예상 금액입니다.\n' +
    '실제 세금과 차이가 있을 수 있으며,\n' +
    '정확한 세액 및 절세 가능 여부는 세무사 상담을 통해 확인하실 수 있습니다.'

  const DISCLAIMER_FOOTER =
    '본 결과는 입력 정보를 기반으로 자동 계산된 참고용 예상 금액입니다.\n' +
    '실제 세금과 차이가 있을 수 있으며,\n' +
    '정확한 세액 및 절세 가능 여부는 세무사 상담을 통해 확인하시기 바랍니다.'

  const showStickyRevealCta = !revealed

  return (
    <div className="tax-preview-page tax-result-page-shell tax-result-page-v2">
      <header className="tax-result-header-fixed">
        <button
          type="button"
          className="tax-result-header-btn tax-preview-back"
          aria-label="뒤로가기"
          onClick={() => navigate(-1)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="tax-result-header-btn-label">뒤로가기</span>
        </button>
        <h1 className="tax-preview-title tax-result-header-title">예상 세금 결과</h1>
        <button type="button" className="tax-result-home-brand-btn" aria-label="홈으로 이동" onClick={goHome}>
          <svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="tax-result-header-home-svg"
            aria-hidden
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      </header>

      <section className="tax-result-scroll-body tax-result-scroll-body-v2">
        <div className="tax-question-card tax-result-card-v2">
          <header className="tax-result-intro">
            <p className="tax-result-intro-copy">입력하신 정보를 바탕으로 계산된 결과입니다</p>
          </header>

          {!revealed ? (
            <div className="tax-result-phase-partial">
              <p className="tax-result-hero-amount tax-result-amount-teaser">{maskedLine}</p>
              <p className="tax-result-micro-note">(자동 계산된 참고용 금액)</p>
              <p className="tax-result-save-teaser-line">최대 절세 가능 금액이 있을 수 있어요</p>
            </div>
          ) : (
            <>
              <div className="tax-result-phase-full">
                <p className="tax-result-hero-amount tax-result-amount-reveal">
                  ₩ {formatKRWLabel(result.finalTax)}
                </p>
                <p className="tax-result-micro-note">(자동 계산된 참고용 금액)</p>
                {showRatio ? (
                  <span className="tax-result-ratio-pill">
                    매매가 대비 약 {((result.finalTax / sale) * 100).toFixed(1)}% · 참고
                  </span>
                ) : null}
                {potentialSavings != null ? (
                  <div className="tax-result-savings-highlight">
                    <p className="tax-result-savings-main">
                      이 중 최대 ₩{formatKRWLabel(potentialSavings)} 절세 가능
                    </p>
                    <p className="tax-result-savings-sub">놓친 공제/세금 혜택이 있을 수 있어요</p>
                  </div>
                ) : null}
              </div>

              <div className="tax-result-rows tax-result-rows-v2">
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

              <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                버전 · {CAPITAL_GAINS_TAX_VERSION}
              </div>

              <div className="tax-result-interpret-lines">
                {lines.map((t, i) => (
                  <p key={i} className="tax-result-interpret-line">
                    {t}
                  </p>
                ))}
              </div>

              <p className="tax-result-footer-disclaimer">
                {DISCLAIMER_FOOTER.split('\n').map((line, i, arr) => (
                  <span key={`d-${i}-${line.slice(0, 8)}`}>
                    {line}
                    {i < arr.length - 1 ? <br /> : null}
                  </span>
                ))}
              </p>

              <button
                type="button"
                className="tax-flow-nav-btn secondary tax-result-footer-btn tax-result-soft-btn-v2"
                onClick={restart}
              >
                새로 계산하기
              </button>
            </>
          )}
        </div>
      </section>

      {showStickyRevealCta ? (
        <footer className="tax-result-sticky-bar">
          <button type="button" className="tax-result-sticky-primary" onClick={onOpenDisclosureModal}>
            전체 결과 확인하기
          </button>
        </footer>
      ) : null}

      {revealed ? (
        <footer className="tax-result-sticky-bar">
          <button type="button" className="tax-result-sticky-accent" onClick={onConsultPrimary}>
            {ctaAssignment.label}
          </button>
        </footer>
      ) : null}

      {disclosureModalOpen ? (
        <div
          className="tax-result-sheet-backdrop"
          role="presentation"
          onClick={onCloseModal}
        >
          <div
            className="tax-result-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tax-result-disclosure-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tax-result-sheet-grab" aria-hidden />
            <h3 id="tax-result-disclosure-title" className="tax-result-sheet-title">
              결과 확인 전 안내
            </h3>
            <p className="tax-result-sheet-body">
              {DISCLOSURE_MODAL_BODY.split('\n').map((line, i, arr) => (
                <span key={`m-${i}`}>
                  {line}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
            <div className="tax-result-sheet-actions">
              <button type="button" className="tax-result-sheet-confirm" onClick={onConfirmDisclosure}>
                확인하고 결과 보기
              </button>
              <button type="button" className="tax-result-sheet-dismiss" onClick={onCloseModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
