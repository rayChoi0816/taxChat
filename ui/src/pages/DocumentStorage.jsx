import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import './DocumentStorage.css'

const DocumentStorage = () => {
  const navigate = useNavigate()
  const [sortOption, setSortOption] = useState('최신순')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // 서류 데이터 (실제로는 API에서 가져올 데이터)
  const [documents, setDocuments] = useState([
    {
      id: 1,
      name: '사업자등록증',
      uploadDate: '25.11.28 13:30:45'
    },
    {
      id: 2,
      name: '주민등록등본',
      uploadDate: '25.11.28 13:30:45'
    }
  ])

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
        sortedDocs.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
        break
      case '오래된순':
        sortedDocs.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate))
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
    navigate(`/document-detail/${documentId}`)
  }

  const handleDelete = (documentId) => {
    if (window.confirm('해당 서류를 삭제하시겠습니까?')) {
      setDocuments(documents.filter(doc => doc.id !== documentId))
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
            {documents.length === 0 ? (
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

