import { useState, useEffect } from 'react'
import './DocumentRegistrationModal.css'
import { documentAPI } from '../utils/api'

const DocumentRegistrationModal = ({ onClose, onSave, categories = [], document = null, onUpdate = null }) => {
  const isEditMode = document !== null
  const [isEditing, setIsEditing] = useState(false)
  
  const [selectedCategory, setSelectedCategory] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [documentDescription, setDocumentDescription] = useState('')
  const [categoryList, setCategoryList] = useState([])
  const [loading, setLoading] = useState(false)
  
  // 서류 카테고리 목록 로드
  useEffect(() => {
    loadCategories()
  }, [])
  
  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await documentAPI.getCategories()
      if (response.success) {
        // API 응답을 카테고리 이름 배열로 변환
        const categoryNames = response.data.map(cat => cat.name)
        setCategoryList(categoryNames)
      } else {
        // API 실패 시 prop으로 전달된 categories 사용
        setCategoryList(categories)
      }
    } catch (error) {
      console.error('서류 카테고리 조회 오류:', error)
      // 오류 발생 시 prop으로 전달된 categories 사용
      setCategoryList(categories)
    } finally {
      setLoading(false)
    }
  }

  // 수정 모드일 때 초기 데이터 로드
  useEffect(() => {
    if (document) {
      setSelectedCategory(document.category || '')
      setDocumentName(document.name || '')
      setDocumentDescription(document.description || '')
      setIsEditing(false)
    } else {
      setSelectedCategory('')
      setDocumentName('')
      setDocumentDescription('')
      setIsEditing(false)
    }
  }, [document])

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value)
  }

  const handleDocumentNameChange = (e) => {
    setDocumentName(e.target.value)
  }

  const handleDocumentDescriptionChange = (e) => {
    setDocumentDescription(e.target.value)
  }

  const handleSave = () => {
    if (!isSaveEnabled()) return

    if (isEditMode && isEditing && onUpdate) {
      // 수정 모드
      const updatedDocument = {
        ...document,
        category: selectedCategory.trim(),
        name: documentName.trim(),
        description: documentDescription.trim()
      }
      onUpdate(updatedDocument)
      setIsEditing(false)
      onClose()
    } else if (!isEditMode && onSave) {
      // 등록 모드
      const newDocument = {
        id: Date.now(),
        category: selectedCategory.trim(),
        name: documentName.trim(),
        description: documentDescription.trim(),
        display: '비진열',
        registrationDate: new Date().toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, ''),
        deleted: false
      }

      onSave(newDocument)
      
      // 폼 초기화
      setSelectedCategory('')
      setDocumentName('')
      setDocumentDescription('')
      onClose()
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (isEditMode && isEditing) {
      // 수정 중이면 원래 값으로 복원
      if (document) {
        setSelectedCategory(document.category || '')
        setDocumentName(document.name || '')
        setDocumentDescription(document.description || '')
      }
      setIsEditing(false)
    } else {
      // 폼 초기화
      setSelectedCategory('')
      setDocumentName('')
      setDocumentDescription('')
      onClose()
    }
  }

  // 등록 버튼 활성화 여부 확인
  const isSaveEnabled = () => {
    return documentName.trim() && documentDescription.trim()
  }

  return (
    <div className="document-registration-modal-overlay" onClick={handleCancel}>
      <div className="document-registration-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="document-registration-modal-header">
          <h2 className="document-registration-modal-title">
            {isEditMode ? '서류 상세' : '서류 등록'}
          </h2>
          <button className="document-registration-modal-close" onClick={handleCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="document-registration-modal-content">
          {/* 서류 카테고리 선택 */}
          <div className="document-registration-form-group">
            <label className="document-registration-label">서류 카테고리 선택</label>
            {isEditMode && !isEditing ? (
              <div className="document-registration-display">
                {selectedCategory || '-'}
              </div>
            ) : (
              <select
                className="document-registration-select"
                value={selectedCategory}
                onChange={handleCategoryChange}
                disabled={loading}
              >
                <option value="">선택</option>
                {categoryList.map((category, index) => (
                  <option key={index} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 서류명 입력 */}
          <div className="document-registration-form-group">
            <label className="document-registration-label">서류명을 입력하세요.</label>
            {isEditMode && !isEditing ? (
              <div className="document-registration-display">{documentName || '-'}</div>
            ) : (
              <input
                type="text"
                className="document-registration-input"
                placeholder="서류명 입력"
                value={documentName}
                onChange={handleDocumentNameChange}
              />
            )}
          </div>

          {/* 서류 설명 입력 */}
          <div className="document-registration-form-group">
            <label className="document-registration-label">서류 설명을 입력하세요</label>
            {isEditMode && !isEditing ? (
              <div className="document-registration-display">{documentDescription || '-'}</div>
            ) : (
              <textarea
                className="document-registration-textarea"
                placeholder="서류 설명 입력"
                value={documentDescription}
                onChange={handleDocumentDescriptionChange}
                rows={5}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="document-registration-modal-actions">
          <button className="document-registration-cancel-btn" onClick={handleCancel}>
            {isEditMode && isEditing ? '취소' : '취소'}
          </button>
          {isEditMode ? (
            !isEditing ? (
              <button
                className="document-registration-edit-btn"
                onClick={handleEdit}
              >
                수정하기
              </button>
            ) : (
              <button
                className={`document-registration-save-btn ${isSaveEnabled() ? 'enabled' : 'disabled'}`}
                onClick={handleSave}
                disabled={!isSaveEnabled()}
              >
                수정완료
              </button>
            )
          ) : (
            <button
              className={`document-registration-save-btn ${isSaveEnabled() ? 'enabled' : 'disabled'}`}
              onClick={handleSave}
              disabled={!isSaveEnabled()}
            >
              등록
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentRegistrationModal
