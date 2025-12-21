import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import './DocumentAttachment.css'

const DocumentAttachment = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDocumentList, setShowDocumentList] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileDescription, setFileDescription] = useState('')

  // 관리자 페이지에서 등록한 첨부 서류 목록 (실제로는 API에서 가져올 데이터)
  const documentTypes = [
    { id: 1, name: '가족관계증명서' },
    { id: 2, name: '사업자등록증' },
    { id: 3, name: '주민등록등본' },
    { id: 4, name: '기타' }
  ]

  // 검색 필터링
  const filteredDocuments = documentTypes.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDocumentSelect = (document) => {
    setSelectedDocument(document)
    setSearchQuery(document.name)
    setShowDocumentList(false)
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setShowDocumentList(true)
    if (!e.target.value) {
      setSelectedDocument(null)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleFileRemove = () => {
    setSelectedFile(null)
    setFileDescription('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleComplete = () => {
    if (!selectedDocument || !selectedFile) {
      return
    }
    
    // 서류 첨부 완료 처리
    alert('서류 첨부가 완료되었습니다.')
    navigate('/document-storage')
  }

  const isCompleteButtonEnabled = selectedDocument && selectedFile

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <h1 className="payment-title">서류 첨부</h1>
          <button className="document-close-btn" onClick={() => navigate('/document-storage')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="document-attachment-content">
          {/* 서류 선택 콤보 박스 */}
          <div className="document-select-container">
            <input
              type="text"
              className="document-select-input"
              placeholder="첨부할 서류를 선택해주세요"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowDocumentList(true)}
            />
            <div className="document-select-arrow">▼</div>
            
            {/* 서류 목록 드롭다운 */}
            {showDocumentList && filteredDocuments.length > 0 && (
              <div className="document-list-dropdown">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="document-list-item"
                    onClick={() => handleDocumentSelect(doc)}
                  >
                    {doc.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 서류 찾기 버튼 */}
          <button
            className={`document-find-btn ${selectedDocument ? 'active' : 'disabled'}`}
            onClick={handleFileSelect}
            disabled={!selectedDocument}
          >
            서류 찾기
          </button>

          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />

          {/* 선택한 파일 표시 */}
          {selectedFile && (
            <div className="selected-file-section">
              <div className="selected-file-item">
                <span className="selected-file-name">{selectedFile.name}</span>
                <button className="file-remove-btn" onClick={handleFileRemove}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              {/* 파일 설명 입력란 */}
              <textarea
                className="file-description-input"
                placeholder="첨부한 서류에 대해 설명이 필요하다면 간략히 설명하세요"
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                rows={4}
              />
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="form-footer">
          <button
            className={`document-complete-btn ${isCompleteButtonEnabled ? 'active' : 'disabled'}`}
            onClick={handleComplete}
            disabled={!isCompleteButtonEnabled}
          >
            서류 첨부 완료
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentAttachment

