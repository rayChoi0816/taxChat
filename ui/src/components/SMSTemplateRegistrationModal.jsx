import { useState, useEffect } from 'react'
import './SMSTemplateRegistrationModal.css'

const SMSTemplateRegistrationModal = ({ 
  template = null, 
  isEditMode = false, 
  onClose, 
  onSave, 
  onEdit, 
  onCancelEdit 
}) => {
  const [templateName, setTemplateName] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [isReadOnly, setIsReadOnly] = useState(template !== null && !isEditMode)

  useEffect(() => {
    if (template) {
      setTemplateName(template.name || '')
      setTemplateContent(template.content || '')
      setIsReadOnly(!isEditMode)
    } else {
      setTemplateName('')
      setTemplateContent('')
      setIsReadOnly(false)
    }
  }, [template, isEditMode])

  const isRegisterEnabled = () => {
    return templateName.trim().length > 0 && templateContent.trim().length > 0
  }

  const handleSave = () => {
    if (!isRegisterEnabled()) {
      return
    }
    
    if (onSave) {
      onSave({
        name: templateName,
        content: templateContent
      })
    }
  }

  const handleEdit = () => {
    setIsReadOnly(false)
    if (onEdit) {
      onEdit()
    }
  }

  const handleCancel = () => {
    if (isReadOnly) {
      // 읽기 모드에서 취소하면 모달 닫기
      onClose()
    } else {
      // 수정 모드에서 취소하면 원래 값으로 복원
      if (template) {
        setTemplateName(template.name || '')
        setTemplateContent(template.content || '')
        setIsReadOnly(true)
        if (onCancelEdit) {
          onCancelEdit()
        }
      } else {
        // 등록 모드에서 취소하면 모달 닫기
        onClose()
      }
    }
  }

  return (
    <div className="sms-template-registration-modal-overlay" onClick={onClose}>
      <div className="sms-template-registration-modal" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="sms-template-registration-modal-header">
          <h3>템플릿 등록</h3>
          <button className="sms-template-registration-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* 모달 내용 */}
        <div className="sms-template-registration-modal-content">
          <div className="sms-template-registration-form-group">
            <label className="sms-template-registration-form-label">템플릿명을 입력하세요.</label>
            <input
              type="text"
              className="sms-template-registration-form-input"
              placeholder="템플릿명 입력"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          
          <div className="sms-template-registration-form-group">
            <label className="sms-template-registration-form-label">템플릿 내용을 입력하세요</label>
            <textarea
              className="sms-template-registration-form-textarea"
              placeholder="템플릿 내용 입력"
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              readOnly={isReadOnly}
              rows={8}
            />
          </div>
        </div>
        
        {/* 액션 버튼 */}
        <div className="sms-template-registration-modal-actions">
          <button
            className="sms-template-registration-cancel-btn"
            onClick={handleCancel}
          >
            취소
          </button>
          {isReadOnly ? (
            <button
              className="sms-template-registration-edit-btn"
              onClick={handleEdit}
            >
              수정하기
            </button>
          ) : (
            <button
              className={`sms-template-registration-register-btn ${isRegisterEnabled() ? 'enabled' : 'disabled'}`}
              onClick={handleSave}
              disabled={!isRegisterEnabled()}
            >
              {template ? '수정완료' : '등록'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SMSTemplateRegistrationModal

