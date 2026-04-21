import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import './DocumentStorage.css'
import { documentAPI } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const DocumentStorage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sortOption, setSortOption] = useState('최신순')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  // DB에서 첨부된 서류 목록 조회
  useEffect(() => {
    const loadDocuments = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await documentAPI.getMemberDocuments(user.id)
        if (response.success) {
          // API 응답을 프론트엔드 형식으로 변환
          const formattedDocuments = response.data.map((doc) => {
            // 날짜 포맷팅 (YY.MM.DD. HH:MM:SS)
            const formatDate = (dateStr) => {
              if (!dateStr) return ''
              const date = new Date(dateStr)
              const year = String(date.getFullYear()).slice(-2)
              const month = String(date.getMonth() + 1).padStart(2, '0')
              const day = String(date.getDate()).padStart(2, '0')
              const hours = String(date.getHours()).padStart(2, '0')
              const minutes = String(date.getMinutes()).padStart(2, '0')
              const seconds = String(date.getSeconds()).padStart(2, '0')
              return `${year}.${month}.${day}. ${hours}:${minutes}:${seconds}`
            }

            return {
              id: doc.id,
              name: doc.document_name || '서류',
              uploadDate: formatDate(doc.created_at),
              createdAt: doc.created_at // 정렬을 위해 원본 날짜 저장
            }
          })
          
          // 기본 정렬 (최신순)
          formattedDocuments.sort((a, b) => {
            const dateA = new Date(a.createdAt)
            const dateB = new Date(b.createdAt)
            return dateB - dateA
          })
          
          setDocuments(formattedDocuments)
        } else {
          setDocuments([])
        }
      } catch (error) {
        console.error('서류 목록 조회 오류:', error)
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [user])

  const sortOptions = [
    { value: '최신순', label: '첨부일시 최신순' },
    { value: '오래된순', label: '첨부일시 오래된 순' },
    { value: '가나다순', label: '가나다 순' },
    { value: '가나다역순', label: '가나다 역순' }
  ]

  const handleSortChange = (option) => {
    setSortOption(option.value)
    setShowSortMenu(false)
    
    // 정렬 로직
    let sortedDocs = [...documents]
    switch (option.value) {
      case '최신순':
        sortedDocs.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
          return dateB - dateA
        })
        break
      case '오래된순':
        sortedDocs.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
          return dateA - dateB
        })
        break
      case '가나다순':
        sortedDocs.sort((a, b) => a.name.localeCompare(b.name))
        break
      case '가나다역순':
        sortedDocs.sort((a, b) => b.name.localeCompare(a.name))
        break
      default:
        break
    }
    setDocuments(sortedDocs)
  }

  const handleViewDetails = (documentId) => {
    navigate(`/document-attachment?memberDocumentId=${documentId}&view=true`)
  }

  const handleDelete = async (documentId) => {
    if (window.confirm('해당 서류를 삭제하시겠습니까?')) {
      try {
        const response = await documentAPI.deleteDocument(user.id, documentId)
        if (response.success) {
          // 삭제 성공 시 목록에서 제거
          setDocuments(documents.filter(doc => doc.id !== documentId))
        } else {
          alert('서류 삭제 중 오류가 발생했습니다.')
        }
      } catch (error) {
        console.error('서류 삭제 오류:', error)
        alert('서류 삭제 중 오류가 발생했습니다.')
      }
    }
  }

  const currentSortLabel = sortOptions.find(opt => opt.value === sortOption)?.label || '첨부일시 최신순'

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/mypage')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">서류 보관함</h1>
        </header>

        {/* Content */}
        <div className="document-storage-content">
          {/* 서류 첨부 버튼 */}
          <button 
            className="document-attach-btn"
            onClick={() => navigate('/document-attachment')}
          >
            서류 첨부
          </button>

          {/* 첨부된 서류 영역 */}
          <div className="document-list-section">
            <div className="document-list-header">
              <h2 className="document-list-title">첨부된 서류 ({documents.length})</h2>
              <div className="sort-container">
                <button 
                  className="sort-btn"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                >
                  {currentSortLabel}
                </button>
                {showSortMenu && (
                  <div className="sort-menu">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        className={`sort-menu-item ${sortOption === option.value ? 'active' : ''}`}
                        onClick={() => handleSortChange(option)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 서류 카드 목록 */}
            {loading ? (
              <div className="empty-documents">
                <p>서류 목록을 불러오는 중...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-documents">
                <p>첨부된 서류가 없습니다.</p>
              </div>
            ) : (
              <div className="document-cards">
                {documents.map((doc) => (
                  <div key={doc.id} className="document-card">
                    <h3 className="document-name">{doc.name}</h3>
                    <p className="document-date">첨부일시 : {doc.uploadDate}</p>
                    <div className="document-actions">
                      <button
                        className="document-action-btn view-btn"
                        onClick={() => handleViewDetails(doc.id)}
                      >
                        상세 보기
                      </button>
                      <button
                        className="document-action-btn delete-btn"
                        onClick={() => handleDelete(doc.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentStorage