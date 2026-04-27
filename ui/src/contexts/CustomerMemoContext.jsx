import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const CustomerMemoContext = createContext(null)

export const CustomerMemoProvider = ({ children }) => {
  const [customerMemos, setCustomerMemos] = useState(() => {
    // localStorage에서 메모 데이터 로드
    const saved = localStorage.getItem('customerMemos')
    return saved ? JSON.parse(saved) : {}
  })

  // localStorage에 메모 저장
  useEffect(() => {
    localStorage.setItem('customerMemos', JSON.stringify(customerMemos))
  }, [customerMemos])

  const addMemo = (customerId, memoContent) => {
    const key = String(customerId)
    const newMemo = {
      id: Date.now(),
      content: memoContent,
      createdAt: new Date().toISOString()
    }
    
    setCustomerMemos(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newMemo]
    }))
  }

  const deleteMemo = (customerId, memoId) => {
    const key = String(customerId)
    setCustomerMemos(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(memo => memo.id !== memoId)
    }))
  }

  const getMemos = (customerId) => {
    return customerMemos[String(customerId)] || []
  }

  const getLatestMemo = (customerId) => {
    const memos = customerMemos[String(customerId)] || []
    if (memos.length === 0) return null
    
    const sortedMemos = [...memos].sort((a, b) => {
      const dateA = new Date(a.createdAt)
      const dateB = new Date(b.createdAt)
      return dateB - dateA
    })
    
    return sortedMemos[0]
  }

  // 초기 데이터 로드 (각 페이지의 mock 데이터에서 메모 초기화)
  const initializeMemos = useCallback((items, customerIdKey = 'customerId') => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return
    }
    
    setCustomerMemos(prev => {
      const updated = { ...prev }
      items.forEach(item => {
        if (!item) return
        
        const customerId = item[customerIdKey] != null && item[customerIdKey] !== ''
          ? item[customerIdKey]
          : item.id
        if (customerId != null && customerId !== '' && item.memo) {
          let memosToAdd = []
          
          // memo가 문자열인 경우 (고객 관리 페이지)
          if (typeof item.memo === 'string' && item.memo.trim().length > 0) {
            memosToAdd = [{
              id: Date.now() + Math.random(), // 임시 ID
              content: item.memo.trim(),
              createdAt: new Date().toISOString()
            }]
          }
          // memo가 배열인 경우 (첨부 서류 관리, SMS 관리 페이지)
          else if (Array.isArray(item.memo) && item.memo.length > 0) {
            memosToAdd = item.memo
          }
          
          if (memosToAdd.length > 0) {
            // 중복 제거를 위해 기존 메모와 병합
            const existingIds = new Set((updated[customerId] || []).map(m => m && m.id ? m.id : null).filter(id => id !== null))
            const newMemos = memosToAdd.filter(m => m && m.id && !existingIds.has(m.id))
            if (newMemos.length > 0) {
              updated[customerId] = [...(updated[customerId] || []), ...newMemos]
            }
          }
        }
      })
      return updated
    })
  }, [])

  return (
    <CustomerMemoContext.Provider 
      value={{ 
        customerMemos, 
        addMemo, 
        deleteMemo, 
        getMemos, 
        getLatestMemo,
        initializeMemos
      }}
    >
      {children}
    </CustomerMemoContext.Provider>
  )
}

export const useCustomerMemo = () => {
  const context = useContext(CustomerMemoContext)
  if (!context) {
    throw new Error('useCustomerMemo must be used within a CustomerMemoProvider')
  }
  return context
}

