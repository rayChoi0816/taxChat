import { useState, useEffect } from 'react'
import './ProductCategoryRegistrationModal.css'

const ProductCategoryRegistrationModal = ({ onClose, onSave, category = null, onUpdate = null }) => {
  const isEditMode = category !== null
  const [isEditing, setIsEditing] = useState(false)
  
  const [categoryName, setCategoryName] = useState('')
  const [briefDesc, setBriefDesc] = useState('')
  const [detailedDesc, setDetailedDesc] = useState('')

  useEffect(() => {
    if (category) {
      setCategoryName(category.name || '')
      setBriefDesc(category.briefDesc || '')
      setDetailedDesc(category.detailedDesc || '')
      setIsEditing(false)
    } else {
      setCategoryName('')
      setBriefDesc('')
      setDetailedDesc('')
      setIsEditing(false)
    }
  }, [category])

  const handleCategoryNameChange = (e) => {
    setCategoryName(e.target.value)
  }

  const handleBriefDescChange = (e) => {
    setBriefDesc(e.target.value)
  }

  const handleDetailedDescChange = (e) => {
    setDetailedDesc(e.target.value)
  }

  const handleSave = () => {
    if (categoryName.trim()) {
      if (isEditMode && isEditing && onUpdate) {
        // 수정 모드
        const updatedCategory = {
          ...category,
          name: categoryName.trim(),
          briefDesc: briefDesc.trim() || '',
          detailedDesc: detailedDesc.trim() || ''
        }
        onUpdate(updatedCategory)
        setIsEditing(false)
        onClose()
      } else if (!isEditMode && onSave) {
        // 등록 모드
        const newCategory = {
          name: categoryName.trim(),
          briefDesc: briefDesc.trim() || '',
          detailedDesc: detailedDesc.trim() || '',
          display: '비진열'
        }
        onSave(newCategory)
        
        // 폼 초기화
        setCategoryName('')
        setBriefDesc('')
        setDetailedDesc('')
        onClose()
      }
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (isEditMode && isEditing) {
      // 수정 중이면 원래 값으로 복원
      if (category) {
        setCategoryName(category.name || '')
        setBriefDesc(category.briefDesc || '')
        setDetailedDesc(category.detailedDesc || '')
      }
      setIsEditing(false)
    } else {
      // 폼 초기화
      setCategoryName('')
      setBriefDesc('')
      setDetailedDesc('')
      onClose()
    }
  }

  // 상품 카테고리명만 입력 시 등록/수정 버튼 활성화
  const isSaveEnabled = categoryName.trim().length > 0

  return (
    <div className="product-category-registration-modal-overlay" onClick={handleCancel}>
      <div className="product-category-registration-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="product-category-registration-modal-header">
          <h2 className="product-category-registration-modal-title">
            {isEditMode ? '상품 카테고리 상세' : '상품 카테고리 등록'}
          </h2>
          <button className="product-category-registration-modal-close" onClick={handleCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="product-category-registration-modal-content">
          {/* 상품 카테고리명 */}
          <div className="product-category-registration-form-group">
            <label className="product-category-registration-label">
              상품 카테고리명
            </label>
            {isEditMode && !isEditing ? (
              <div className="product-category-registration-display">{categoryName || '-'}</div>
            ) : (
              <input
                type="text"
                className="product-category-registration-input"
                placeholder="상품 카테고리명 입력"
                value={categoryName}
                onChange={handleCategoryNameChange}
              />
            )}
          </div>

          {/* 상품 카테고리 간략 설명 */}
          <div className="product-category-registration-form-group">
            <label className="product-category-registration-label">
              상품 카테고리 간략 설명을 입력하세요
            </label>
            {isEditMode && !isEditing ? (
              <div className="product-category-registration-display">{briefDesc || '-'}</div>
            ) : (
              <textarea
                className="product-category-registration-textarea"
                placeholder="상품 카테고리 간략 설명 입력"
                value={briefDesc}
                onChange={handleBriefDescChange}
                rows={5}
              />
            )}
          </div>

          {/* 상품 카테고리 상세 설명 */}
          <div className="product-category-registration-form-group">
            <label className="product-category-registration-label">
              상품 카테고리 상세 설명을 입력하세요
            </label>
            {isEditMode && !isEditing ? (
              <div className="product-category-registration-display">{detailedDesc || '-'}</div>
            ) : (
              <textarea
                className="product-category-registration-textarea"
                placeholder="상품 카테고리 상세 설명 입력"
                value={detailedDesc}
                onChange={handleDetailedDescChange}
                rows={5}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="product-category-registration-modal-actions">
          <button className="product-category-registration-cancel-btn" onClick={handleCancel}>
            {isEditMode && isEditing ? '취소' : '취소'}
          </button>
          {isEditMode ? (
            !isEditing ? (
              <button
                className="product-category-registration-edit-btn"
                onClick={handleEdit}
              >
                수정하기
              </button>
            ) : (
              <button
                className={`product-category-registration-save-btn ${isSaveEnabled ? 'enabled' : 'disabled'}`}
                onClick={handleSave}
                disabled={!isSaveEnabled}
              >
                수정완료
              </button>
            )
          ) : (
            <button
              className={`product-category-registration-save-btn ${isSaveEnabled ? 'enabled' : 'disabled'}`}
              onClick={handleSave}
              disabled={!isSaveEnabled}
            >
              등록
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductCategoryRegistrationModal
