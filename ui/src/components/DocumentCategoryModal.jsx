import { useState } from 'react'
import './DocumentCategoryModal.css'

const DocumentCategoryModal = ({ onClose, onSave, existingCategories = [] }) => {
  const [categoryName, setCategoryName] = useState('')
  const [categories, setCategories] = useState([])

  const handleCategoryNameChange = (e) => {
    setCategoryName(e.target.value)
  }

  const handleAddCategory = () => {
    const trimmedName = categoryName.trim()
    if (!trimmedName) {
      alert('서류 카테고리명을 입력해주세요.')
      return
    }

    // 중복 체크
    if (categories.includes(trimmedName)) {
      alert('이미 추가된 서류 카테고리입니다.')
      return
    }

    setCategories(prev => [...prev, trimmedName])
    setCategoryName('')
  }

  const handleRemoveCategory = (index) => {
    setCategories(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (categories.length === 0) {
      alert('서류 카테고리를 추가해주세요.')
      return
    }

    onSave(categories)
    
    // 폼 초기화
    setCategoryName('')
    setCategories([])
    onClose()
  }

  const handleCancel = () => {
    // 폼 초기화
    setCategoryName('')
    setCategories([])
    onClose()
  }

  // 등록 버튼 활성화 여부
  const isSaveEnabled = categories.length > 0

  return (
    <div className="document-category-modal-overlay" onClick={handleCancel}>
      <div className="document-category-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="document-category-modal-header">
          <h2 className="document-category-modal-title">서류 카테고리</h2>
          <button className="document-category-modal-close" onClick={handleCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="document-category-modal-content">
          {/* 서류 카테고리명 입력 */}
          <div className="document-category-form-group">
            <label className="document-category-label">서류 카테고리명</label>
            <div className="document-category-input-group">
              <input
                type="text"
                className="document-category-input"
                placeholder="서류 카테고리명 입력"
                value={categoryName}
                onChange={handleCategoryNameChange}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCategory()
                  }
                }}
              />
              <button
                className="document-category-add-btn"
                onClick={handleAddCategory}
              >
                +
              </button>
            </div>
          </div>

          {/* 서류 카테고리 리스트 */}
          {categories.length > 0 && (
            <div className="document-category-list">
              {categories.map((category, index) => (
                <div key={index} className="document-category-item">
                  <span className="document-category-item-name">{category}</span>
                  <button
                    className="document-category-remove-btn"
                    onClick={() => handleRemoveCategory(index)}
                  >
                    -
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="document-category-modal-actions">
          <button className="document-category-cancel-btn" onClick={handleCancel}>
            취소
          </button>
          <button
            className={`document-category-save-btn ${isSaveEnabled ? 'enabled' : 'disabled'}`}
            onClick={handleSave}
            disabled={!isSaveEnabled}
          >
            등록
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentCategoryModal
