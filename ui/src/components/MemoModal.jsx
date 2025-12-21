import { useState, useEffect } from 'react'
import './MemoModal.css'

const MemoModal = ({ customer, memos = [], onClose, onSave, onDelete }) => {
  const [memoText, setMemoText] = useState('')
  const [customerMemos, setCustomerMemos] = useState(memos || [])

  useEffect(() => {
    setCustomerMemos(memos || [])
  }, [memos])

  const handleMemoChange = (e) => {
    const value = e.target.value
    setMemoText(value)
  }

  const handleSave = () => {
    if (memoText.trim()) {
      const newMemo = {
        id: Date.now(),
        content: memoText.trim(),
        createdAt: new Date().toISOString()
      }
      const updatedMemos = [...customerMemos, newMemo]
      setCustomerMemos(updatedMemos)
      onSave(customer.id, memoText.trim())
      setMemoText('')
    }
  }

  const handleDelete = (memoId) => {
    const updatedMemos = customerMemos.filter(memo => memo.id !== memoId)
    setCustomerMemos(updatedMemos)
    onDelete(customer.id, memoId)
  }

  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  // 메모 입력 시 등록 버튼 활성화
  const isSaveEnabled = memoText.trim().length > 0

  return (
    <div className="memo-modal-overlay" onClick={onClose}>
      <div className="memo-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="memo-modal-header">
          <div className="memo-modal-title">{customer.name}</div>
          <button className="memo-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Memo Input Area */}
        <div className="memo-modal-content">
          <textarea
            className="memo-input"
            placeholder="메모 입력"
            value={memoText}
            onChange={handleMemoChange}
            rows={5}
          />

          {/* Action Buttons */}
          <div className="memo-modal-actions">
            <button className="memo-cancel-btn" onClick={onClose}>
              취소
            </button>
            <button
              className={`memo-save-btn ${isSaveEnabled ? 'enabled' : 'disabled'}`}
              onClick={handleSave}
              disabled={!isSaveEnabled}
            >
              등록
            </button>
          </div>

          {/* Memo List */}
          {customerMemos.length > 0 && (
            <div className="memo-list">
              {customerMemos.map((memo) => (
                <div key={memo.id} className="memo-item">
                  <div className="memo-item-header">
                    <div className="memo-item-date">{formatDateTime(memo.createdAt)}</div>
                    <button
                      className="memo-delete-btn"
                      onClick={() => handleDelete(memo.id)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div className="memo-item-content">{memo.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MemoModal
