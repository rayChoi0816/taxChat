import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionCard from '../components/taxPreview/QuestionCard.jsx'
import OptionButton from '../components/taxPreview/OptionButton.jsx'
import ProgressBar from '../components/taxPreview/ProgressBar.jsx'
import '../components/taxPreview/taxPreview.css'
import {
  ASSET_OPTIONS,
  HOUSE_OPTIONS,
  HOLDING_OPTIONS,
} from '../engine/taxPreview/capitalGainsQuestionConfig.js'
import { useCapitalGainsFlow } from '../engine/taxPreview/TaxFlowEngine.jsx'

const TOTAL_STEPS = 8

export function formatKRWLabel(n) {
  if (n == null || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('ko-KR').format(Math.floor(n))
}

export function digitsToInt(s) {
  const d = String(s || '').replace(/[^\d]/g, '')
  if (!d) return 0
  const x = Number(d)
  if (!Number.isSafeInteger(x)) return Number.MAX_SAFE_INTEGER
  return x
}

/** @returns {boolean} */
function validateStep(stepIndex, data, ctx) {
  const { expensePhase, purchaseStr, saleStr, expenseStr } = ctx
  switch (stepIndex) {
    case 0:
      return Boolean(data.assetType)
    case 1:
      return Boolean(data.houseCount)
    case 2:
      return Boolean(data.holdingPeriod)
    case 3:
      return data.isResident === true || data.isResident === false
    case 4:
      return digitsToInt(purchaseStr) > 0
    case 5:
      return digitsToInt(saleStr) > 0
    case 6:
      if (expensePhase === 'choose')
        return data.expensesUnknown === true
      return digitsToInt(expenseStr) >= 0
    case 7:
      return false
    default:
      return false
  }
}

export default function CapitalGainsFlowPage() {
  const navigate = useNavigate()
  const { stepIndex, setStepIndex, data, patch } = useCapitalGainsFlow()
  const [purchaseStr, setPurchaseStr] = useState('')
  const [saleStr, setSaleStr] = useState('')
  const [expenseStr, setExpenseStr] = useState('')
  const [expensePhase, setExpensePhase] = useState('choose')

  useEffect(() => {
    if (stepIndex !== 4) return
    if (data.purchasePrice != null) setPurchaseStr(formatKRWLabel(data.purchasePrice))
  }, [stepIndex, data.purchasePrice])

  useEffect(() => {
    if (stepIndex !== 5) return
    if (data.salePrice != null) setSaleStr(formatKRWLabel(data.salePrice))
  }, [stepIndex, data.salePrice])

  useEffect(() => {
    if (stepIndex !== 6) return
    if (data.expensesUnknown === true) {
      setExpensePhase('choose')
      return
    }
    if (data.expensesUnknown === false && data.expenses != null) {
      setExpensePhase('input')
      setExpenseStr(formatKRWLabel(data.expenses))
      return
    }
    setExpensePhase('choose')
    setExpenseStr('')
  }, [stepIndex, data.expenses, data.expensesUnknown])

  const ctxMemo = useMemo(
    () => ({
      expensePhase,
      purchaseStr,
      saleStr,
      expenseStr,
    }),
    [expensePhase, purchaseStr, saleStr, expenseStr]
  )

  const canNext = validateStep(stepIndex, data, ctxMemo)

  useEffect(() => {
    if (stepIndex !== TOTAL_STEPS - 1) return undefined
    const timer = window.setTimeout(() => {
      navigate('/tax-preview/capital-gains/result')
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [stepIndex, navigate])

  const onChangeDigits = (raw, setter) => {
    setter(formatKRWLabel(digitsToInt(raw)))
  }

  const persistNumericSteps = () => {
    if (stepIndex === 4) patch({ purchasePrice: digitsToInt(purchaseStr) })
    if (stepIndex === 5) patch({ salePrice: digitsToInt(saleStr) })
    if (stepIndex === 6 && expensePhase === 'input') {
      patch({
        expensesUnknown: false,
        expenses: digitsToInt(expenseStr),
      })
    }
  }

  const goNext = () => {
    persistNumericSteps()
    if (stepIndex < TOTAL_STEPS - 1) setStepIndex(stepIndex + 1)
  }

  const goBack = () => {
    if (stepIndex <= 0) {
      navigate('/tax-preview')
      return
    }
    if (stepIndex === 6 && expensePhase === 'input') {
      setExpensePhase('choose')
      patch({ expensesUnknown: undefined, expenses: undefined })
      setExpenseStr('')
      return
    }
    setStepIndex(stepIndex - 1)
  }

  const startExpenseDirect = () => {
    setExpensePhase('input')
    setExpenseStr('')
    patch({ expensesUnknown: false, expenses: undefined })
  }

  const quickPreset = [
    ['1억', 100_000_000],
    ['5억', 500_000_000],
    ['10억', 1_000_000_000],
  ]

  const renderStepBody = () => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="tax-option-grid">
            {ASSET_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={data.assetType === opt.value}
                onClick={() => patch({ assetType: opt.value })}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        )
      case 1:
        return (
          <div className="tax-option-grid">
            {HOUSE_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={data.houseCount === opt.value}
                onClick={() => patch({ houseCount: opt.value })}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        )
      case 2:
        return (
          <div className="tax-option-grid">
            {HOLDING_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={data.holdingPeriod === opt.value}
                onClick={() => patch({ holdingPeriod: opt.value })}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        )
      case 3:
        return (
          <div className="tax-option-grid">
            <OptionButton
              selected={data.isResident === true}
              onClick={() => patch({ isResident: true })}
            >
              예
            </OptionButton>
            <OptionButton
              selected={data.isResident === false}
              onClick={() => patch({ isResident: false })}
            >
              아니오
            </OptionButton>
          </div>
        )
      case 4:
        return (
          <>
            <input
              className="tax-num-field"
              inputMode="numeric"
              placeholder="예: 500,000,000"
              aria-label="구매 가격"
              value={purchaseStr}
              onChange={(e) => onChangeDigits(e.target.value, setPurchaseStr)}
            />
            <div className="tax-quick-row">
              {quickPreset.map(([lab, amt]) => (
                <button
                  key={lab}
                  type="button"
                  className="tax-quick-chip"
                  onClick={() => {
                    const next = amt
                    setPurchaseStr(formatKRWLabel(next))
                    patch({ purchasePrice: next })
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>
          </>
        )
      case 5:
        return (
          <>
            <input
              className="tax-num-field"
              inputMode="numeric"
              placeholder="예: 800,000,000"
              aria-label="판매 가격"
              value={saleStr}
              onChange={(e) => onChangeDigits(e.target.value, setSaleStr)}
            />
            <div className="tax-quick-row">
              {quickPreset.map(([lab, amt]) => (
                <button
                  key={`sale-${lab}`}
                  type="button"
                  className="tax-quick-chip"
                  onClick={() => {
                    const next = amt
                    setSaleStr(formatKRWLabel(next))
                    patch({ salePrice: next })
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>
          </>
        )
      case 6:
        if (expensePhase === 'choose') {
          return (
            <div className="tax-option-grid">
              <OptionButton
                selected={data.expensesUnknown === true}
                onClick={() => {
                  patch({ expensesUnknown: true, expenses: null })
                }}
              >
                잘 모르겠어요 (기본값 적용)
              </OptionButton>
              <OptionButton selected={false} onClick={startExpenseDirect}>
                직접 입력
              </OptionButton>
            </div>
          )
        }
        return (
          <input
            className="tax-num-field"
            inputMode="numeric"
            placeholder="비용 합계 (원)"
            aria-label="비용"
            value={expenseStr}
            onChange={(e) => onChangeDigits(e.target.value, setExpenseStr)}
          />
        )
      case 7:
        return (
          <p className="tax-loading-msg">
            거의 다 됐어요! 예상 세금을 계산 중입니다…
          </p>
        )
      default:
        return null
    }
  }

  const titles = [
    '어떤 부동산을 파셨나요?',
    '현재 집이 몇 채 있으세요?',
    '얼마나 보유하셨나요?',
    '직접 거주하셨나요?',
    '구매 가격은 얼마인가요?',
    '판매 가격은 얼마인가요?',
    '비용(세금, 수수료 등)은 얼마나 들었나요?',
    '',
  ]

  const handlePrimaryFooter = () => {
    if (stepIndex === 6 && expensePhase === 'choose' && data.expensesUnknown === true) {
      setStepIndex(7)
      return
    }
    goNext()
  }

  const footerPrimaryLabel =
    stepIndex === TOTAL_STEPS - 1 ? '계산 중…' : '다음'

  const footerDisabled =
    stepIndex === TOTAL_STEPS - 1 ||
    (stepIndex === 6 && expensePhase === 'choose' ? !data.expensesUnknown : !canNext)

  return (
    <div className="tax-preview-page">
      <header className="tax-preview-header">
        <button
          type="button"
          className="tax-preview-back"
          aria-label="뒤로"
          onClick={goBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="tax-preview-title">양도소득세 미리보기</h1>
      </header>

      <section className="tax-preview-body">
        {stepIndex < TOTAL_STEPS - 1 ? (
          <ProgressBar current={stepIndex + 1} total={TOTAL_STEPS} />
        ) : (
          <ProgressBar current={TOTAL_STEPS} total={TOTAL_STEPS} />
        )}

        {stepIndex < TOTAL_STEPS - 1 ? (
          <QuestionCard title={titles[stepIndex]} hint={null}>
            {renderStepBody()}
          </QuestionCard>
        ) : (
          <QuestionCard>{renderStepBody()}</QuestionCard>
        )}
      </section>

      {stepIndex < TOTAL_STEPS - 1 ? (
        <div className="tax-flow-footer">
          <button type="button" className="tax-flow-nav-btn secondary" onClick={goBack}>
            이전
          </button>
          <button
            type="button"
            className="tax-flow-nav-btn primary"
            disabled={footerDisabled}
            onClick={handlePrimaryFooter}
          >
            {footerPrimaryLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
