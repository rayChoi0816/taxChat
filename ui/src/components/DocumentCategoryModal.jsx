import { useState, useEffect } from 'react'
import './DocumentCategoryModal.css'
import { documentAPI } from '../utils/api'

const DocumentCategoryModal = ({ onClose, onSave, existingCategories = [] }) => {
  const [categoryName, setCategoryName] = useState('')
  const [newCategories, setNewCategories] = useState([]) // 새로 추가할 카테고리
  const [existingCategoryList, setExistingCategoryList] = useState([]) // 기존 카테고리 목록 (DB에서 가져온 것)
  const [loading, setLoading] = useState(false)
  
  // existingCategories를 기존 카테고리 목록으로 설정
  useEffect(() => {
    // existingCategories는 문자열 배열이므로 객체 배열로 변환
    const categoryList = existingCategories.map((name, index) => ({
      id: `existing-${index}`,
      name: name,
      isExisting: true
    }))
    setExistingCategoryList(categoryList)
  }, [existingCategories])
  
  // 기존 카테고리 목록 로드
  useEffect(() => {
    loadExistingCategories()
  }, [])
  
  const loadExistingCategories = async () => {
    try {
      setLoading(true)
      const response = await documentAPI.getCategories()
      if (response.success) {
        const categoryList = response.data.map(cat => ({
          id: cat.id,
          name: cat.name,
          isExisting: true
        }))
        setExistingCategoryList(categoryList)
      }
    } catch (error) {
      console.error('서류 카테고리 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryNameChange = (e) => {
    setCategoryName(e.target.value)
  }

  const handleAddCategory = () => {
    const trimmedName = categoryName.trim()
    if (!trimmedName) {
      alert('서류 카테고리명을 입력해주세요.')
      return
    }

    // 기존 카테고리와 중복 체크
    const allCategories = [...existingCategoryList, ...newCategories]
    if (allCategories.some(cat => cat.name === trimmedName)) {
      alert('이미 존재하는 서류 카테고리입니다.')
      return
    }

    setNewCategories(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: trimmedName,
      isExisting: false
    }])
    setCategoryName('')
  }

  const handleRemoveNewCategory = (id) => {
    setNewCategories(prev => prev.filter(cat => cat.id !== id))
  }

  const handleRemoveExistingCategory = async (id, name) => {
    if (!window.confirm(`"${name}" 서류 카테고리를 삭제하시겠습니까?`)) {
      return
    }

    try {
      setLoading(true)
      // 숫자 ID인 경우에만 서버에 삭제 요청
      if (typeof id === 'number' || !isNaN(id)) {
        const response = await documentAPI.deleteCategory(id)
        if (response.success) {
          setExistingCategoryList(prev => prev.filter(cat => cat.id !== id))
          alert('서류 카테고리가 삭제되었습니다.')
        } else {
          alert(response.error || '서류 카테고리 삭제 중 오류가 발생했습니다.')
        }
      } else {
        // 임시 ID인 경우 (existingCategories에서 온 것) 로컬에서만 제거
        setExistingCategoryList(prev => prev.filter(cat => cat.id !== id))
      }
    } catch (error) {
      console.error('서류 카테고리 삭제 오류:', error)
      alert('서류 카테고리 삭제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (newCategories.length === 0) {
      // 새로 추가할 카테고리가 없어도 저장 가능 (삭제만 한 경우)
      onSave([])
      onClose()
      return
    }

    // 새로 추가할 카테고리 이름만 추출
    const newCategoryNames = newCategories.map(cat => cat.name)
    onSave(newCategoryNames)
    
    // 폼 초기화
    setCategoryName('')
    setNewCategories([])
    onClose()
  }

  const handleCancel = () => {
    // 폼 초기화
    setCategoryName('')
    setNewCategories([])
    onClose()
  }

  // 등록 버튼 활성화 여부 (변경사항이 있으면 활성화)
  const hasChanges = newCategories.length > 0

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

          {/* 서류 카테고리 리스트 (통합) */}
          {(existingCategoryList.length > 0 || newCategories.length > 0) && (
            <div className="document-category-list">
              {existingCategoryList.map((category) => (
                <div key={category.id} className="document-category-item">
                  <span className="document-category-item-name">{category.name}</span>
                  <button
                    className="document-category-remove-btn"
                    onClick={() => handleRemoveExistingCategory(category.id, category.name)}
                    disabled={loading}
                  >
                    -
                  </button>
                </div>
              ))}
              {newCategories.map((category) => (
                <div key={category.id} className="document-category-item">
                  <span className="document-category-item-name">{category.name}</span>
                  <button
                    className="document-category-remove-btn"
                    onClick={() => handleRemoveNewCategory(category.id)}
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
            className={`document-category-save-btn ${hasChanges ? 'enabled' : 'disabled'}`}
            onClick={handleSave}
            disabled={!hasChanges || loading}
          >
            {loading ? '처리 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentCategoryModal
