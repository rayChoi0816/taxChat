import { useState, useEffect } from 'react'
import './SMSTemplateManagementModal.css'
import SMSTemplateRegistrationModal from './SMSTemplateRegistrationModal'

const SMSTemplateManagementModal = ({ onClose, templates: initialTemplates = [], onTemplatesChange }) => {
  // API 응답의 usage_status를 usageStatus로 변환하고 기본값 설정
  const normalizeTemplates = (templates) => {
    return templates.map(template => ({
      ...template,
      usageStatus: template.usageStatus || template.usage_status || '미사용'
    }))
  }
  
  const [templates, setTemplates] = useState(normalizeTemplates(initialTemplates))
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  
  // initialTemplates가 변경될 때 상태 업데이트
  useEffect(() => {
    const normalized = initialTemplates.map(template => ({
      ...template,
      usageStatus: template.usageStatus || template.usage_status || '미사용'
    }))
    setTemplates(normalized)
  }, [initialTemplates])

  const handleTemplateSave = (templateData) => {
    let updatedTemplates
    if (selectedTemplate && isEditMode) {
      // 템플릿 수정
      updatedTemplates = templates.map(t => 
        t.id === selectedTemplate.id
          ? { ...t, name: templateData.name, content: templateData.content }
          : t
      )
      setTemplates(updatedTemplates)
      setIsEditMode(false)
    } else {
      // 새 템플릿 등록
      const newTemplate = {
        id: Date.now(),
        name: templateData.name,
        content: templateData.content,
        usageStatus: '미사용'
      }
      updatedTemplates = [...templates, newTemplate]
      setTemplates(updatedTemplates)
    }
    
    if (onTemplatesChange) {
      onTemplatesChange(updatedTemplates)
    }
    
    setIsRegistrationModalOpen(false)
    setSelectedTemplate(null)
  }

  const handleTemplateDelete = (templateId) => {
    if (window.confirm('해당 템플릿을 삭제하시겠습니까?')) {
      const updatedTemplates = templates.filter(t => t.id !== templateId)
      setTemplates(updatedTemplates)
      if (onTemplatesChange) {
        onTemplatesChange(updatedTemplates)
      }
    }
  }

  const handleUsageStatusToggle = async (templateId) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return
    
    const currentStatus = template.usageStatus || template.usage_status || '미사용'
    const newStatus = currentStatus === '미사용' ? '사용' : '미사용'
    
    // alert 메시지 표시
    if (currentStatus === '사용') {
      alert('미사용 상태로 변경합니다. 선택 리스트에 노출되지 않습니다.')
    } else {
      alert('사용 상태로 변경합니다. 선택 리스트에 노출됩니다.')
    }
    
    const updatedTemplates = templates.map(t => 
      t.id === templateId
        ? { ...t, usageStatus: newStatus, usage_status: newStatus }
        : t
    )
    setTemplates(updatedTemplates)
    
    // API 호출하여 서버에 저장
    try {
      const { smsAPI } = await import('../utils/api')
      await smsAPI.updateTemplateUsage(templateId, newStatus)
    } catch (error) {
      console.error('템플릿 사용 상태 변경 오류:', error)
    }
    
    if (onTemplatesChange) {
      onTemplatesChange(updatedTemplates)
    }
  }

  const handleDetailClick = (template) => {
    setSelectedTemplate(template)
    setIsEditMode(false)
    setIsRegistrationModalOpen(true)
  }

  const handleEditClick = () => {
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
    setSelectedTemplate(null)
    setIsEditMode(false)
  }

  return (
    <>
      <div className="sms-template-management-modal-overlay" onClick={onClose}>
        <div className="sms-template-management-modal" onClick={(e) => e.stopPropagation()}>
          {/* 모달 헤더 */}
          <div className="sms-template-management-modal-header">
            <h3>SMS 템플릿 관리</h3>
            <button className="sms-template-management-modal-close" onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          {/* 모달 내용 */}
          <div className="sms-template-management-modal-content">
            {/* 템플릿 등록 버튼 */}
            <button
              className="sms-template-register-btn"
              onClick={() => {
                setSelectedTemplate(null)
                setIsEditMode(false)
                setIsRegistrationModalOpen(true)
              }}
            >
              템플릿 등록
            </button>
            
            {/* 템플릿 목록 */}
            {templates.length === 0 ? (
              <div className="sms-template-empty-message">
                등록된 템플릿이 없습니다.
              </div>
            ) : (
              <div className="sms-template-list">
                {templates.map((template) => (
                  <div key={template.id} className="sms-template-item">
                    <div className="sms-template-name">{template.name}</div>
                    <div className="sms-template-actions">
                      <button
                        className={`sms-template-usage-btn ${(template.usageStatus || template.usage_status || '미사용') === '사용' ? 'active' : ''}`}
                        onClick={() => handleUsageStatusToggle(template.id)}
                      >
                        {template.usageStatus || template.usage_status || '미사용'}
                      </button>
                      <button
                        className="sms-template-detail-btn"
                        onClick={() => handleDetailClick(template)}
                      >
                        상세보기
                      </button>
                      <button
                        className="sms-template-delete-btn"
                        onClick={() => handleTemplateDelete(template.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 액션 버튼 */}
          <div className="sms-template-management-modal-actions">
            <button
              className="sms-template-cancel-btn"
              onClick={onClose}
            >
              취소
            </button>
            <button
              className="sms-template-save-btn"
              onClick={() => {
                if (onTemplatesChange) {
                  onTemplatesChange(templates)
                }
                onClose()
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
      
      {/* 템플릿 등록 모달 */}
      {isRegistrationModalOpen && (
        <SMSTemplateRegistrationModal
          template={selectedTemplate}
          isEditMode={isEditMode}
          onClose={handleCloseRegistrationModal}
          onSave={handleTemplateSave}
          onEdit={handleEditClick}
          onCancelEdit={handleCancelEdit}
        />
      )}
    </>
  )
}

export default SMSTemplateManagementModal

