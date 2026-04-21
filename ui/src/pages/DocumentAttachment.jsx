import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './DocumentAttachment.css'
import { documentAPI } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { orderAPI } from '../utils/api'

const DocumentAttachment = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  const { user } = useAuth()
  
  // URL 파라미터에서 orderId, documentId, memberDocumentId, view 가져오기
  const searchParams = new URLSearchParams(location.search)
  const urlOrderId = searchParams.get('orderId')
  const urlDocumentId = searchParams.get('documentId')
  const memberDocumentId = searchParams.get('memberDocumentId')
  const isViewMode = searchParams.get('view') === 'true'
  const isEditMode = searchParams.get('edit') === 'true'
  
  const [isEditing, setIsEditing] = useState(false)
  const [memberDocument, setMemberDocument] = useState(null)
  
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDocumentList, setShowDocumentList] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileDescription, setFileDescription] = useState('')
  const [documentTypes, setDocumentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadedDocuments, setUploadedDocuments] = useState([])
  const [loadingDocuments, setLoadingDocuments] = useState(true)

  // 서류 관리 페이지에 등록된 서류 목록 조회
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true)
        const response = await documentAPI.getDocuments()
        if (response.success) {
          // 서류 관리 페이지에 등록된 모든 서류를 표시 (삭제되지 않은 서류만)
          setDocumentTypes(response.data || [])
          
          // URL에서 documentId가 있으면 해당 서류 선택
          if (urlDocumentId) {
            const doc = response.data.find(d => d.id === parseInt(urlDocumentId))
            if (doc) {
              setSelectedDocument(doc)
              setSearchQuery(doc.name)
            }
          }
        }
      } catch (error) {
        console.error('서류 목록 조회 오류:', error)
      } finally {
        setLoading(false)
      }
    }
    loadDocuments()
  }, [urlDocumentId])

  // URL에서 orderId를 가져와서 주문 정보로 변환 (order_id를 order.id로)
  const [orderIdForUpload, setOrderIdForUpload] = useState(null)
  useEffect(() => {
    const getOrderId = async () => {
      if (urlOrderId && user?.id) {
        try {
          // order_id로 주문 조회
          const ordersResponse = await orderAPI.getOrders({
            memberId: user.id,
            searchType: '주문 ID',
            searchKeyword: urlOrderId,
            limit: 100
          })
          if (ordersResponse.success && ordersResponse.data.length > 0) {
            // order_id로 필터링 (API가 정확히 매칭하지 않을 수 있으므로)
            const order = ordersResponse.data.find(o => o.order_id === urlOrderId)
            if (order) {
              setOrderIdForUpload(order.id) // order.id 사용
            }
          }
        } catch (error) {
          console.error('주문 조회 오류:', error)
        }
      }
    }
    getOrderId()
  }, [urlOrderId, user])

  // memberDocumentId가 있을 때 기존 서류 정보 로드
  useEffect(() => {
    const loadMemberDocument = async () => {
      if (!memberDocumentId || !user?.id) {
        return
      }

      try {
        const response = await documentAPI.getMemberDocuments(user.id)
        if (response.success) {
          const doc = response.data.find(d => d.id === parseInt(memberDocumentId))
          if (doc) {
            setMemberDocument(doc)
            // 서류 정보 설정
            const docType = documentTypes.find(dt => dt.id === doc.document_id)
            if (docType) {
              setSelectedDocument(docType)
              setSearchQuery(docType.name)
            }
            // 파일 설명 설정
            if (doc.description) {
              setFileDescription(doc.description)
            }
            // 파일명 표시를 위한 상태 (실제 파일은 없지만 파일명만 표시)
            if (doc.file_name) {
              setSelectedFile({ name: doc.file_name })
            }
          }
        }
      } catch (error) {
        console.error('서류 정보 조회 오류:', error)
      }
    }

    if (memberDocumentId && documentTypes.length > 0) {
      loadMemberDocument()
    }
  }, [memberDocumentId, user, documentTypes])

  // 첨부한 서류 목록 조회 (view 모드가 아닐 때만)
  useEffect(() => {
    const loadUploadedDocuments = async () => {
      if (!user?.id || isViewMode) {
        setLoadingDocuments(false)
        return
      }
      
      try {
        setLoadingDocuments(true)
        const response = await documentAPI.getMemberDocuments(user.id)
        if (response.success) {
          // order_id로 필터링 (URL에서 orderId가 있으면)
          let filtered = response.data || []
          if (urlOrderId && orderIdForUpload) {
            // order.id로 필터링
            filtered = filtered.filter(doc => doc.order_id === orderIdForUpload)
          }
          setUploadedDocuments(filtered)
        }
      } catch (error) {
        console.error('첨부한 서류 조회 오류:', error)
      } finally {
        setLoadingDocuments(false)
      }
    }
    
    if (user?.id && (!urlOrderId || orderIdForUpload) && !isViewMode) {
      loadUploadedDocuments()
    }
  }, [user, urlOrderId, orderIdForUpload, isViewMode])

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

  const handleEditClick = () => {
    setIsEditing(true)
  }

  const handleComplete = async () => {
    if (!selectedDocument || !user?.id) {
      return
    }

    // 수정 모드일 때는 파일이 선택되지 않아도 됨 (기존 파일 유지)
    if (!isEditing && !selectedFile) {
      return
    }
    
    try {
      setUploading(true)
      
      // FormData 생성
      const formData = new FormData()
      
      // 수정 모드인 경우
      if (isEditing && memberDocumentId) {
        formData.append('documentId', selectedDocument.id.toString())
        if (fileDescription !== undefined) {
          formData.append('description', fileDescription)
        }
        if (orderIdForUpload) {
          formData.append('orderId', orderIdForUpload.toString())
        }
        // 새 파일이 선택된 경우에만 추가
        if (selectedFile && selectedFile instanceof File) {
          formData.append('file', selectedFile)
        }
        
        // 서류 수정
        const response = await documentAPI.updateMemberDocument(user.id, memberDocumentId, formData)
        
        if (response.success) {
          alert('서류 수정이 완료되었습니다.')
          navigate('/document-storage')
        } else {
          alert('서류 수정 중 오류가 발생했습니다.')
        }
      } else {
        // 새로 업로드하는 경우
        if (!selectedFile) {
          return
        }
        
        formData.append('file', selectedFile)
        formData.append('documentId', selectedDocument.id.toString())
        if (fileDescription) {
          formData.append('description', fileDescription)
        }
        if (orderIdForUpload) {
          formData.append('orderId', orderIdForUpload.toString())
        }
        
        // 서류 업로드
        const response = await documentAPI.uploadDocument(user.id, formData)
        
        if (response.success) {
          alert('서류 첨부가 완료되었습니다.')
          
          // 첨부한 서류 목록 새로고침
          const documentsResponse = await documentAPI.getMemberDocuments(user.id)
          if (documentsResponse.success) {
            let filtered = documentsResponse.data || []
            if (urlOrderId && orderIdForUpload) {
              filtered = filtered.filter(doc => doc.order_id === orderIdForUpload)
            }
            setUploadedDocuments(filtered)
          }
          
          // 입력 필드 초기화
          setSelectedFile(null)
          setFileDescription('')
          setSearchQuery('')
          setSelectedDocument(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          
          // edit 모드가 아니면 document-storage로 이동
          if (!isEditMode) {
            navigate('/document-storage')
          }
        } else {
          alert('서류 첨부 중 오류가 발생했습니다.')
        }
      }
    } catch (error) {
      console.error('서류 처리 오류:', error)
      alert('서류 처리 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const isCompleteButtonEnabled = selectedDocument && (isEditing ? true : selectedFile)

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
              placeholder={loading ? "서류 목록을 불러오는 중..." : "첨부할 서류를 선택해주세요"}
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowDocumentList(true)}
              disabled={loading || (isViewMode && !isEditing)}
            />
            <div className="document-select-arrow">▼</div>
            
            {/* 서류 목록 드롭다운 */}
            {showDocumentList && !loading && filteredDocuments.length > 0 && (
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
            {showDocumentList && !loading && filteredDocuments.length === 0 && searchQuery && (
              <div className="document-list-dropdown">
                <div className="document-list-item" style={{ color: '#999', cursor: 'default' }}>
                  검색 결과가 없습니다
                </div>
              </div>
            )}
          </div>

          {/* 서류 찾기 버튼 */}
          <button
            className={`document-find-btn ${selectedDocument && (isViewMode ? isEditing : true) ? 'active' : 'disabled'}`}
            onClick={handleFileSelect}
            disabled={!selectedDocument || (isViewMode && !isEditing)}
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
                disabled={isViewMode && !isEditing}
              />
            </div>
          )}


        </div>

        {/* Footer Navigation */}
        <div className="form-footer">
          {isViewMode && !isEditing ? (
            <button
              className="document-complete-btn active"
              onClick={handleEditClick}
            >
              수정하기
            </button>
          ) : (
            <button
              className={`document-complete-btn ${isCompleteButtonEnabled && !uploading ? 'active' : 'disabled'}`}
              onClick={handleComplete}
              disabled={!isCompleteButtonEnabled || uploading}
            >
              {uploading ? (isEditing ? '수정 중...' : '업로드 중...') : (isEditing ? '수정완료' : '서류 첨부 완료')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentAttachment