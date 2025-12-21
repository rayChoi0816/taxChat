import { useState, useEffect, useRef } from 'react'
import './SMSSendModal.css'

const SMSSendModal = ({ onClose, onSend, templates: externalTemplates = [] }) => {
  // 수신인 선택 방식 (기본값: 'load')
  const [recipientType, setRecipientType] = useState('load')
  
  // 수신인 불러오기 관련
  const [recipientSearch, setRecipientSearch] = useState('')
  const [showRecipientList, setShowRecipientList] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [members, setMembers] = useState([])
  const [filteredMembers, setFilteredMembers] = useState([])
  const recipientInputRef = useRef(null)
  const recipientListRef = useRef(null)
  
  // 수신 번호 새로 작성
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  
  // SMS 유형
  const [smsType, setSmsType] = useState('템플릿')
  
  // 템플릿 관련
  const [selectedTemplate, setSelectedTemplate] = useState('')
  // 외부에서 전달받은 템플릿 사용 (사용 상태인 템플릿만)
  const templates = externalTemplates.length > 0 
    ? externalTemplates.filter(t => t.usageStatus === '사용')
    : []
  
  // 결제링크 관련
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentContent, setPaymentContent] = useState('')
  
  // 상품 결제링크 관련
  const [selectedProduct, setSelectedProduct] = useState('')
  const [products] = useState([
    { id: 1, name: '프리랜서 (4대 보험 신고 불필요)', price: 50000 },
    { id: 2, name: '아르바이트 (고용, 산재보험만 신고)', price: 40000 },
    { id: 3, name: '상시근로자 (4대 보험 신고 필요)', price: 30000 }
  ])
  
  // 내용 작성 관련
  const [customContent, setCustomContent] = useState('')
  
  // SMS 미리보기 모달 상태
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  
  // 예시 회원 데이터 (실제로는 API에서 가져와야 함)
  useEffect(() => {
    const exampleMembers = [
      { id: 1, name: '홍길동', phoneNumber: '010-1234-5678' },
      { id: 2, name: '임꺽정', phoneNumber: '010-2345-6789' },
      { id: 3, name: '장길산', phoneNumber: '010-3456-7890' },
      { id: 4, name: '김철수', phoneNumber: '010-4567-8901' },
      { id: 5, name: '이영희', phoneNumber: '010-5678-9012' }
    ]
    setMembers(exampleMembers)
    setFilteredMembers(exampleMembers)
  }, [])
  
  // 수신인 검색 필터링
  useEffect(() => {
    if (recipientSearch.trim() === '') {
      setFilteredMembers(members)
    } else {
      const filtered = members.filter(member => 
        member.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        member.phoneNumber.includes(recipientSearch)
      )
      setFilteredMembers(filtered)
    }
  }, [recipientSearch, members])
  
  // 외부 클릭 시 리스트 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        recipientListRef.current &&
        !recipientListRef.current.contains(event.target) &&
        recipientInputRef.current &&
        !recipientInputRef.current.contains(event.target)
      ) {
        setShowRecipientList(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  // 전화번호 포맷팅
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '')
    
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }
  }
  
  const handleRecipientSearchChange = (e) => {
    const value = e.target.value
    setRecipientSearch(value)
    setShowRecipientList(true)
  }
  
  const handleRecipientSelect = (member) => {
    setSelectedRecipient(member)
    setRecipientSearch(`${member.name} (${member.phoneNumber})`)
    setShowRecipientList(false)
  }
  
  const handleNewPhoneNumberChange = (e) => {
    const value = e.target.value
    const formatted = formatPhoneNumber(value)
    setNewPhoneNumber(formatted)
  }
  
  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId)
    setSelectedTemplate(templateId)
    if (template) {
      setCustomContent(template.content)
    }
  }
  
  // 등록 버튼 활성화 여부 확인
  const isRegisterEnabled = () => {
    // 수신인 확인
    if (recipientType === 'load' && !selectedRecipient) {
      return false
    }
    if (recipientType === 'new' && !newPhoneNumber.trim()) {
      return false
    }
    
    // SMS 유형별 필수 입력 확인
    if (smsType === '템플릿' && !selectedTemplate) {
      return false
    }
    if (smsType === '결제링크' && (!paymentAmount || !paymentContent.trim())) {
      return false
    }
    if (smsType === '상품 결제링크' && !selectedProduct) {
      return false
    }
    if (smsType === '내용 작성' && !customContent.trim()) {
      return false
    }
    
    return true
  }
  
  const handlePreview = () => {
    if (!isRegisterEnabled()) {
      return
    }
    setIsPreviewModalOpen(true)
  }
  
  const getPreviewContent = () => {
    const phoneNumber = getRecipientPhoneNumber()
    const content = getSMSContent()
    
    return {
      recipient: phoneNumber,
      content: content
    }
  }
  
  const handleRegister = () => {
    if (!isRegisterEnabled()) {
      return
    }
    
    const smsData = {
      recipientType,
      recipient: recipientType === 'load' 
        ? { id: selectedRecipient.id, name: selectedRecipient.name, phoneNumber: selectedRecipient.phoneNumber }
        : { phoneNumber: newPhoneNumber },
      smsType,
      content: getSMSContent(),
      templateId: smsType === '템플릿' ? selectedTemplate : null,
      paymentAmount: smsType === '결제링크' ? paymentAmount : null,
      productId: smsType === '상품 결제링크' ? selectedProduct : null
    }
    
    if (onSend) {
      onSend(smsData)
    }
    onClose()
  }
  
  const getSMSContent = () => {
    switch (smsType) {
      case '템플릿':
        const template = templates.find(t => t.id === selectedTemplate)
        return template ? template.content : ''
      case '결제링크':
        return paymentContent
      case '상품 결제링크':
        const product = products.find(p => p.id === selectedProduct)
        return product ? `${product.name} 결제 링크: [링크]` : ''
      case '내용 작성':
        return customContent
      default:
        return ''
    }
  }
  
  const getRecipientPhoneNumber = () => {
    if (recipientType === 'load') {
      return selectedRecipient ? selectedRecipient.phoneNumber : ''
    } else {
      return newPhoneNumber
    }
  }
  
  return (
    <div className="sms-send-modal-overlay" onClick={onClose}>
      <div className="sms-send-modal" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="sms-send-modal-header">
          <h3>SMS 전송</h3>
          <button className="sms-send-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* 모달 내용 */}
        <div className="sms-send-modal-content">
          {/* 수신 번호 선택 */}
          <div className="sms-send-form-group">
            <label className="sms-send-form-label">수신 번호</label>
            <div className="sms-send-radio-group">
              <label className="sms-send-radio-label">
                <input
                  type="radio"
                  name="recipientType"
                  value="load"
                  checked={recipientType === 'load'}
                  onChange={(e) => setRecipientType(e.target.value)}
                />
                <span>수신인 불러오기</span>
              </label>
              <label className="sms-send-radio-label">
                <input
                  type="radio"
                  name="recipientType"
                  value="new"
                  checked={recipientType === 'new'}
                  onChange={(e) => setRecipientType(e.target.value)}
                />
                <span>수신 번호 새로 작성</span>
              </label>
            </div>
            
            {recipientType === 'load' ? (
              <div className="sms-send-combobox-wrapper">
                <input
                  ref={recipientInputRef}
                  type="text"
                  className="sms-send-combobox-input"
                  placeholder="수신인 검색"
                  value={recipientSearch}
                  onChange={handleRecipientSearchChange}
                  onFocus={() => setShowRecipientList(true)}
                />
                {showRecipientList && filteredMembers.length > 0 && (
                  <div ref={recipientListRef} className="sms-send-combobox-list">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="sms-send-combobox-item"
                        onClick={() => handleRecipientSelect(member)}
                      >
                        <div className="sms-send-member-name">{member.name}</div>
                        <div className="sms-send-member-phone">{member.phoneNumber}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                type="tel"
                className="sms-send-form-input"
                placeholder="전화번호 입력"
                value={newPhoneNumber}
                onChange={handleNewPhoneNumberChange}
                maxLength={13}
              />
            )}
          </div>
          
          {/* SMS 유형 선택 */}
          <div className="sms-send-form-group">
            <label className="sms-send-form-label">SMS 유형</label>
            <select
              className="sms-send-form-select"
              value={smsType}
              onChange={(e) => setSmsType(e.target.value)}
            >
              <option value="템플릿">템플릿</option>
              <option value="결제링크">결제링크</option>
              <option value="상품 결제링크">상품 결제링크</option>
              <option value="내용 작성">내용 작성</option>
            </select>
          </div>
          
          {/* SMS 유형별 입력 영역 */}
          {smsType === '템플릿' && (
            <div className="sms-send-form-group">
              <label className="sms-send-form-label">템플릿 선택</label>
              <select
                className="sms-send-form-select"
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(Number(e.target.value))}
              >
                <option value="">선택</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {smsType === '결제링크' && (
            <>
              <div className="sms-send-form-group">
                <label className="sms-send-form-label">결제할 금액</label>
                <div className="sms-send-amount-input-wrapper">
                  <input
                    type="number"
                    className="sms-send-form-input"
                    placeholder="결제 금액 입력"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="0"
                  />
                  <span className="sms-send-amount-unit">원</span>
                </div>
              </div>
              <div className="sms-send-form-group">
                <label className="sms-send-form-label">전송할 내용을 입력하세요</label>
                <textarea
                  className="sms-send-form-textarea"
                  placeholder="전송 내용 입력"
                  value={paymentContent}
                  onChange={(e) => setPaymentContent(e.target.value)}
                  rows={5}
                />
              </div>
            </>
          )}
          
          {smsType === '상품 결제링크' && (
            <div className="sms-send-form-group">
              <label className="sms-send-form-label">상품 선택</label>
              <select
                className="sms-send-form-select"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                <option value="">선택</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.price.toLocaleString()}원)
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {smsType === '내용 작성' && (
            <div className="sms-send-form-group">
              <label className="sms-send-form-label">전송할 내용을 입력하세요</label>
              <textarea
                className="sms-send-form-textarea"
                placeholder="전송 내용 입력"
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                rows={5}
              />
            </div>
          )}
        </div>
        
        {/* 액션 버튼 */}
        <div className="sms-send-modal-actions">
          <button
            className={`sms-send-preview-btn ${isRegisterEnabled() ? 'enabled' : 'disabled'}`}
            onClick={handlePreview}
            disabled={!isRegisterEnabled()}
          >
            SMS 미리보기
          </button>
          <div className="sms-send-action-buttons">
            <button
              className="sms-send-cancel-btn"
              onClick={onClose}
            >
              취소
            </button>
            <button
              className={`sms-send-register-btn ${isRegisterEnabled() ? 'enabled' : 'disabled'}`}
              onClick={handleRegister}
              disabled={!isRegisterEnabled()}
            >
              등록
            </button>
          </div>
        </div>
        
        {/* SMS 미리보기 모달 */}
        {isPreviewModalOpen && (
          <div className="sms-preview-modal-overlay" onClick={() => setIsPreviewModalOpen(false)}>
            <div className="sms-preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sms-preview-modal-header">
                <h3>SMS 미리보기</h3>
                <button className="sms-preview-modal-close" onClick={() => setIsPreviewModalOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="sms-preview-modal-content">
                <div className="sms-preview-info">
                  <div className="sms-preview-item">
                    <label className="sms-preview-label">수신 번호:</label>
                    <span className="sms-preview-value">{getPreviewContent().recipient || '-'}</span>
                  </div>
                  <div className="sms-preview-item">
                    <label className="sms-preview-label">SMS 내용:</label>
                    <div className="sms-preview-message">
                      {getPreviewContent().content || '-'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="sms-preview-modal-actions">
                <button
                  className="sms-preview-close-btn"
                  onClick={() => setIsPreviewModalOpen(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SMSSendModal

