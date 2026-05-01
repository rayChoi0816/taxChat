import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const STORAGE_KEY = 'taxChat_capitalGains_preview_v1'

const defaultCapitalGainsData = () => ({
  taxType: 'capital_gains',
  isAdjustZone: false,
  confirmedStart: false,
  assetType: undefined,
  houseCount: undefined,
  holdingPeriod: undefined,
  isResident: undefined,
  purchasePrice: undefined,
  salePrice: undefined,
  expenses: undefined,
  expensesUnknown: undefined,
})

const TaxFlowContext = createContext(null)

export function CapitalGainsFlowProvider({ children }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState(() => ({
    ...defaultCapitalGainsData(),
    ...loadDraft(),
  }))

  useEffect(() => {
    persistDraft(data)
  }, [data])

  const patch = useCallback((partial) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const reset = useCallback(() => {
    const fresh = defaultCapitalGainsData()
    setData(fresh)
    setStepIndex(0)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch (_) {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      stepIndex,
      setStepIndex,
      data,
      patch,
      reset,
    }),
    [stepIndex, data, patch, reset]
  )

  return <TaxFlowContext.Provider value={value}>{children}</TaxFlowContext.Provider>
}

export function useCapitalGainsFlow() {
  const ctx = useContext(TaxFlowContext)
  if (!ctx) throw new Error('useCapitalGainsFlow: Provider missing')
  return ctx
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (_) {
    return null
  }
}

function persistDraft(data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {
    /* quota / private mode */
  }
}
