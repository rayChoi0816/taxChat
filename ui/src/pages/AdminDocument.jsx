import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import './AdminCustomer.css'
import MemoModal from '../components/MemoModal'

const AdminDocument = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('첨부일시순')
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchType, setSearchType] = useState('주문 ID')
  const [searchKeyword, setSearchKeyword] = useState('')
  
  // URL 파라미터에서 검색 조건 읽기 및 날짜 범위 기본값 설정 (3개월)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const urlSearchType = params.get('searchType')
    const urlSearchKeyword = params.get('searchKeyword')
    
    if (urlSearchType) {
      setSearchType(urlSearchType)
    }
    if (urlSearchKeyword) {
      setSearchKeyword(urlSearchKeyword)
    }
    
    // 3개월 기본값 설정
    const today = new Date()
    const startDate = new Date()
    startDate.setMonth(today.getMonth() - 3)
    
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
  }, [location.search])
  
  // 메모 모달 상태
  const [selectedDocument, setSelectedDocument] = useState(null)
  const { customerMemos, addMemo, deleteMemo, getLatestMemo: getLatestMemoFromContext, initializeMemos } = useCustomerMemo()

  const [documents, setDocuments] = useState([
    {
      id: 1,
      attachmentDate: '2025-12-30 19:40:50',
      orderId: '251230113227ab',
      memberName: '홍길동',
      documentName: '첨부 서류 A',
      memo: [
        { id: 1, content: '첫 번째 메모입니다.', createdAt: '2025-12-30 10:00:00' },
        { id: 2, content: '두 번째 메모입니다.', createdAt: '2025-12-30 11:00:00' }
      ],
      deleted: false,
      customerId: 1
    },
    {
      id: 2,
      attachmentDate: '2025-12-27 17:30:20',
      orderId: '-',
      memberName: '암꺽정',
      documentName: '첨부 서류 B',
      memo: [],
      deleted: false,
      customerId: 2
    },
    {
      id: 3,
      attachmentDate: '2025-12-26 16:20:10',
      orderId: '251228091530ef',
      memberName: '장길산',
      documentName: '첨부 서류 C',
      memo: [
        { id: 3, content: '세 번째 메모입니다.', createdAt: '2025-12-26 15:00:00' }
      ],
      deleted: false,
      customerId: 3
    }
  ])

  // 메모 초기화 - customerId 기준으로 메모 관리
  useEffect(() => {
    initializeMemos(documents, 'customerId')
  }, [])

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

  const handleSearch = () => {
    // 검색 로직 구현
    console.log('검색 실행', { dateRange, searchType, searchKeyword })
  }

  const handleReset = () => {
    setDateRange({ start: '', end: '' })
    setSearchType('주문 ID')
    setSearchKeyword('')
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

  const handleDelete = (id) => {
    if (window.confirm('해당 첨부 서류를 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      setDocuments(prev => prev.map(doc => 
        doc.id === id
          ? { ...doc, deleted: true }
          : doc
      ))
    }
  }

  const handleDownload = (document) => {
    // 파일 다운로드 로직
    alert(`"${document.documentName}" 파일을 다운로드합니다.`)
  }

  const handleMemoClick = (document) => {
    setSelectedDocument(document)
  }

  const handleCloseMemoModal = () => {
    setSelectedDocument(null)
  }

  const handleSaveMemo = (customerId, memoText) => {
    addMemo(customerId, memoText)
  }

  const handleDeleteMemo = (customerId, memoId) => {
    deleteMemo(customerId, memoId)
  }

  const getLatestMemo = (document) => {
    const customerId = document.customerId
    if (!customerId) return null
    return getLatestMemoFromContext(customerId)
  }

  const truncateMemo = (memo) => {
    if (!memo || !memo.content) return ''
    return memo.content.length > 25 ? memo.content.substring(0, 25) + '...' : memo.content
  }

  // 삭제되지 않은 문서만 필터링
  const visibleDocuments = documents.filter(doc => !doc.deleted)

  return (
    <AdminLayout>
      <div className="admin-page">
        {/* Search Area */}
        <div className="admin-search-area">
          {/* 첨부일시 검색과 검색어 입력을 한 줄에 배치 */}
          <div className="admin-search-row">
            {/* 첨부일시 검색 */}
            <div className="admin-search-section admin-search-section-left">
              <label className="admin-search-label">첨부일시</label>
              <div className="admin-date-quick-buttons">
                {['오늘', '1주일', '1개월', '3개월', '6개월', '1년', '전체'].map((period) => (
                  <button
                    key={period}
                    className={`admin-date-quick-btn ${dateRange.start && period === '3개월' ? 'active' : ''}`}
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
                  <option value="주문 ID">주문 ID</option>
                  <option value="고객">고객</option>
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
                className="admin-action-btn primary"
                onClick={() => navigate('/admin/document-management')}
              >
                서류 관리
              </button>
            </div>
            <div className="admin-sort-order">
              <select
                className="admin-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="첨부일시순">첨부일시순</option>
                <option value="첨부일시 역순">첨부일시 역순</option>
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
                <th>첨부일시</th>
                <th>주문 ID</th>
                <th>회원</th>
                <th>서류명</th>
                <th>메모</th>
                <th>기능</th>
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
                visibleDocuments.map((document) => {
                  const latestMemo = getLatestMemo(document)
                  return (
                  <tr key={document.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={selectedItems.includes(document.id)}
                        onChange={() => handleSelectItem(document.id)}
                      />
                    </td>
                      <td>{document.attachmentDate}</td>
                      <td>{document.orderId}</td>
                      <td>{document.memberName}</td>
                      <td>{document.documentName}</td>
                      <td>
                        {latestMemo ? (
                          <div className="memo-cell">
                            <div className="memo-cell-content" onClick={() => handleMemoClick(document)}>
                              {truncateMemo(latestMemo)}
                            </div>
                          </div>
                        ) : (
                          <button
                            className="admin-table-btn"
                            onClick={() => handleMemoClick(document)}
                          >
                            메모
                          </button>
                        )}
                      </td>
                    <td>
                        <button 
                          className="admin-table-btn"
                          onClick={() => handleDownload(document)}
                        >
                          다운로드
                        </button>
                        <button 
                          className="admin-table-btn danger"
                          onClick={() => handleDelete(document.id)}
                        >
                          삭제
                        </button>
                    </td>
                  </tr>
                  )
                })
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
      </div>

      {/* Memo Modal */}
      {selectedDocument && (
        <MemoModal
          customer={{ id: selectedDocument.customerId, name: selectedDocument.memberName }}
          memos={customerMemos[selectedDocument.customerId] || []}
          onClose={handleCloseMemoModal}
          onSave={handleSaveMemo}
          onDelete={handleDeleteMemo}
        />
      )}
    </AdminLayout>
  )
}

export default AdminDocument
