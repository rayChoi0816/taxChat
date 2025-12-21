import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import './DocumentManagement.css'
import DocumentCategoryModal from '../components/DocumentCategoryModal'
import DocumentRegistrationModal from '../components/DocumentRegistrationModal'

const DocumentManagement = () => {
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('등록일시순')
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchType, setSearchType] = useState('서류 카테고리')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [displayStatus, setDisplayStatus] = useState({
    진열: true,
    비진열: true
  })

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState(null)
  
  // 기존 서류 카테고리 목록 (실제로는 API에서 가져와야 함)
  const [documentCategories, setDocumentCategories] = useState([
    '소득 관련 첨부 서류',
    '매출 관련 첨부 서류',
    '기타 행정 관련 서류'
  ])

  const [documents, setDocuments] = useState([
    {
      id: 1,
      category: '매출 관련 서류',
      name: '첨부 서류 A',
      description: '첨부 서류 A 입니다.',
      display: '진열',
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    },
    {
      id: 2,
      category: null,
      name: '첨부 서류 B',
      description: '첨부 서류 B 입니다.',
      display: '진열',
      registrationDate: '2025-12-29 10:20:15',
      deleted: false
    },
    {
      id: 3,
      category: '비용 관련 서류',
      name: '첨부 서류 C',
      description: '첨부 서류 C 입니다.',
      display: '비진열',
      registrationDate: '2025-12-28 09:15:30',
      deleted: false
    }
  ])

  const handleDateQuickSelect = (period) => {
    const today = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '오늘':
        startDate = new Date(today)
        break
      case '1주일':
        startDate.setDate(today.getDate() - 7)
        break
      case '1개월':
        startDate.setMonth(today.getMonth() - 1)
        break
      case '3개월':
        startDate.setMonth(today.getMonth() - 3)
        break
      case '6개월':
        startDate.setMonth(today.getMonth() - 6)
        break
      case '1년':
        startDate.setFullYear(today.getFullYear() - 1)
        break
      case '전체':
        setDateRange({ start: '', end: '' })
        return
      default:
        return
    }
    
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    setDateRange({
      start: formatDate(startDate),
      end: formatDate(today)
    })
  }

  const handleDisplayStatusChange = (status) => {
    setDisplayStatus(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  const handleSearch = () => {
    // 검색 로직 구현
    console.log('검색 실행', { dateRange, searchType, searchKeyword, displayStatus })
  }

  const handleReset = () => {
    setDateRange({ start: '', end: '' })
    setSearchType('서류 카테고리')
    setSearchKeyword('')
    setDisplayStatus({
      진열: true,
      비진열: true
    })
  }

  const handleDisplayToggle = (documentId) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId
        ? { 
            ...doc, 
            display: doc.display === '진열' ? '비진열' : '진열'
          }
        : doc
    ))
  }

  const handleDelete = (id) => {
    if (window.confirm('해당 서류를 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      setDocuments(prev => prev.map(doc => 
        doc.id === id
          ? { ...doc, deleted: true }
          : doc
      ))
    }
  }

  const handleClose = () => {
    navigate('/admin/document')
  }

  const handleOpenCategoryModal = () => {
    setIsCategoryModalOpen(true)
  }

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false)
  }

  const handleSaveCategories = (categories) => {
    // 서류 카테고리 저장 로직
    console.log('서류 카테고리 저장:', categories)
    setDocumentCategories(categories)
    // 실제로는 API 호출하여 저장
  }

  const handleOpenRegistrationModal = () => {
    setSelectedDocument(null)
    setIsRegistrationModalOpen(true)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
    setSelectedDocument(null)
  }

  const handleSaveDocument = (newDocument) => {
    setDocuments(prev => [...prev, newDocument])
    setIsRegistrationModalOpen(false)
    setSelectedDocument(null)
  }

  const handleViewDetails = (document) => {
    setSelectedDocument(document)
    setIsRegistrationModalOpen(true)
  }

  const handleUpdateDocument = (updatedDocument) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === updatedDocument.id
        ? { ...updatedDocument }
        : doc
    ))
    setIsRegistrationModalOpen(false)
    setSelectedDocument(null)
  }

  const handleSelectAll = () => {
    if (selectedItems.length === visibleDocuments.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(visibleDocuments.map(item => item.id))
    }
  }

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  // 삭제되지 않은 문서만 필터링
  const visibleDocuments = documents.filter(doc => !doc.deleted)

  return (
    <div className="document-management-page">
      {/* Header */}
      <div className="document-management-header">
        <h1 className="document-management-title">서류 관리</h1>
        <button className="document-management-close-btn" onClick={handleClose}>
          ×
        </button>
      </div>

      {/* Search Area */}
      <div className="admin-search-area">
        {/* 등록일시 검색과 검색어 입력을 한 줄에 배치 */}
        <div className="admin-search-row">
          {/* 등록일시 검색 */}
          <div className="admin-search-section admin-search-section-left">
            <label className="admin-search-label">등록일시</label>
            <div className="admin-date-quick-buttons">
              {['오늘', '1주일', '1개월', '3개월', '6개월', '1년', '전체'].map((period) => (
                <button
                  key={period}
                  className={`admin-date-quick-btn ${dateRange.start && period === '1개월' ? 'active' : ''}`}
                  onClick={() => handleDateQuickSelect(period)}
                >
                  {period}
                </button>
              ))}
            </div>
            <div className="admin-date-inputs">
              <input
                type="date"
                className="admin-date-input"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="admin-date-separator">~</span>
              <input
                type="date"
                className="admin-date-input"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          {/* 검색어 입력 */}
          <div className="admin-search-section admin-search-section-right">
            <label className="admin-search-label">검색</label>
            <div className="admin-search-input-group">
              <select
                className="admin-search-select"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <option value="서류 카테고리">서류 카테고리</option>
                <option value="서류명">서류명</option>
              </select>
              <input
                type="text"
                className="admin-search-input"
                placeholder="검색어 입력"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 진열 여부 필터 */}
        <div className="admin-search-section">
          <label className="admin-search-label">진열</label>
          <div className="admin-checkbox-group">
            {['진열', '비진열'].map((status) => (
              <label key={status} className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={displayStatus[status]}
                  onChange={() => handleDisplayStatusChange(status)}
                />
                <span>{status}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 검색/초기화 버튼 */}
        <div className="admin-search-actions">
          <button className="admin-search-btn" onClick={handleSearch}>
            검색
          </button>
          <button className="admin-reset-btn" onClick={handleReset}>
            초기화
          </button>
        </div>
      </div>

      {/* Common Controls */}
      <div className="admin-controls">
        <div className="admin-controls-left">
          <span className="admin-count-text">총 {visibleDocuments.length}</span>
          <span className="admin-count-text">선택 {selectedItems.length} 건</span>
          <button className="admin-select-all-btn" onClick={handleSelectAll}>
            전체 선택
          </button>
        </div>
        <div className="admin-controls-right">
          <div className="admin-action-buttons">
            <button 
              className="admin-action-btn danger"
              onClick={handleOpenCategoryModal}
            >
              서류 카테고리 관리
            </button>
            <button 
              className="admin-action-btn primary"
              onClick={handleOpenRegistrationModal}
            >
              첨부 서류 등록
            </button>
          </div>
          <div className="admin-sort-order">
            <select
              className="admin-sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="등록일시순">등록일시순</option>
              <option value="등록일시 역순">등록일시 역순</option>
            </select>
          </div>
          <div className="admin-page-size">
            <span className="admin-page-size-label">페이지당 리스트 수</span>
            <select
              className="admin-page-size-select"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  className="admin-table-checkbox"
                  checked={selectedItems.length === visibleDocuments.length && visibleDocuments.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>서류 카테고리</th>
              <th>서류명</th>
              <th>서류 설명</th>
              <th>사용 여부</th>
              <th>기능</th>
              <th>등록일</th>
            </tr>
          </thead>
          <tbody>
            {visibleDocuments.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              visibleDocuments.map((document) => (
                <tr key={document.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="admin-table-checkbox"
                      checked={selectedItems.includes(document.id)}
                      onChange={() => handleSelectItem(document.id)}
                    />
                  </td>
                  <td>{document.category || '-'}</td>
                  <td>{document.name}</td>
                  <td>{document.description}</td>
                  <td>
                    <button 
                      className="admin-table-btn"
                      onClick={() => handleDisplayToggle(document.id)}
                    >
                      {document.display}
                    </button>
                  </td>
                  <td>
                    <button 
                      className="admin-table-btn"
                      onClick={() => handleViewDetails(document)}
                    >
                      상세 보기
                    </button>
                    <button 
                      className="admin-table-btn danger"
                      onClick={() => handleDelete(document.id)}
                    >
                      삭제
                    </button>
                  </td>
                  <td>{document.registrationDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="admin-pagination">
        <button
          className="admin-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          이전
        </button>
        <button
          className={`admin-pagination-page ${currentPage === 1 ? 'active' : ''}`}
          onClick={() => setCurrentPage(1)}
        >
          1
        </button>
        <button
          className="admin-pagination-page"
          onClick={() => setCurrentPage(2)}
        >
          2
        </button>
        <button
          className="admin-pagination-page"
          onClick={() => setCurrentPage(3)}
        >
          3
        </button>
        <span className="admin-pagination-ellipsis">...</span>
        <button
          className="admin-pagination-page"
          onClick={() => setCurrentPage(35)}
        >
          35
        </button>
        <button
          className="admin-pagination-btn"
          disabled={currentPage === 35}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          다음
        </button>
      </div>

      {/* Document Category Modal */}
      {isCategoryModalOpen && (
        <DocumentCategoryModal
          onClose={handleCloseCategoryModal}
          onSave={handleSaveCategories}
          existingCategories={documentCategories}
        />
      )}

      {/* Document Registration Modal */}
      {isRegistrationModalOpen && (
        <DocumentRegistrationModal
          onClose={handleCloseRegistrationModal}
          onSave={handleSaveDocument}
          categories={documentCategories}
          document={selectedDocument}
          onUpdate={handleUpdateDocument}
        />
      )}
    </div>
  )
}

export default DocumentManagement
