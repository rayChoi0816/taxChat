import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import { documentAPI } from '../utils/api'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import './AdminCustomer.css'
import './AdminDocument.css'
import MemoModal from '../components/MemoModal'

const AdminDocument = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('첨부일시순')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
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
    
    if (!dateRange.start && !dateRange.end) {
      setDateRange({
        start: formatDate(startDate),
        end: formatDate(today)
      })
      setSelectedPeriod('3개월')
    }
  }, [location.search])
  
  // 메모 모달 상태
  const [selectedDocument, setSelectedDocument] = useState(null)
  const { customerMemos, addMemo, deleteMemo, getLatestMemo: getLatestMemoFromContext, initializeMemos } = useCustomerMemo()

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  // 첨부 서류 로드
  const loadDocuments = async () => {
    try {
      setLoading(true)
      const params = {}
      
      if (dateRange.start) {
        params.startDate = dateRange.start
      }
      if (dateRange.end) {
        params.endDate = dateRange.end
      }
      if (searchKeyword) {
        params.searchType = searchType
        params.searchKeyword = searchKeyword
      }
      if (sortOrder) {
        params.sortOrder = sortOrder
      }

      const response = await documentAPI.getAttachments(params)
      
      console.log('첨부 서류 API 응답:', response) // 디버깅용
      
      if (response && response.success && response.data) {
        // response.data가 배열인지 확인
        const dataArray = Array.isArray(response.data) ? response.data : []
        
        if (dataArray.length === 0) {
          console.warn('첨부 서류 데이터가 비어있습니다. 응답:', response)
        }
        
        // API 응답을 프론트엔드 형식으로 변환
        const formattedDocuments = dataArray.map((doc) => {
          // 날짜 포맷팅
          const formatDate = (dateStr) => {
            if (!dateStr) return ''
            const date = new Date(dateStr)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            const seconds = String(date.getSeconds()).padStart(2, '0')
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
          }

          return {
            id: doc.id,
            attachmentDate: formatDate(doc.attachmentDate),
            orderId: doc.orderId || '-', // orderId가 null이면 "-"로 표시
            memberName: doc.memberName,
            documentName: doc.documentName,
            fileName: doc.fileName,
            description: doc.description,
            memo: [],
            deleted: false,
            customerId: doc.memberId
          }
        })
        
        setDocuments(formattedDocuments)
      } else {
        console.error('첨부 서류 조회 실패:', response)
        setDocuments([])
        if (response && response.error) {
          console.error('API 오류:', response.error)
        }
      }
    } catch (error) {
      console.error('첨부 서류 조회 오류:', error)
      if (error.message && error.message.includes('서버에 연결할 수 없습니다')) {
        console.error('백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:3001)')
      }
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  // 메모 초기화 및 첨부 서류 로드
  useEffect(() => {
    loadDocuments()
  }, [currentPage, itemsPerPage, sortOrder, dateRange, searchKeyword, searchType])

  // 메모 초기화 - customerId 기준으로 메모 관리
  useEffect(() => {
    if (documents.length > 0) {
      initializeMemos(documents, 'customerId')
    }
  }, [documents])

  const handleDateQuickSelect = (period) => {
    setSelectedPeriod(period) // 선택된 기간 업데이트
    
    const today = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '오늘':
        // 오늘 날짜로 설정 (시작일과 종료일 모두 오늘)
        const todayStr = today.toISOString().split('T')[0]
        setDateRange({ start: todayStr, end: todayStr })
        // useEffect가 자동으로 loadDocuments 호출
        return
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
        // useEffect가 자동으로 loadDocuments 호출
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
    // useEffect가 자동으로 loadDocuments 호출
  }

  const handleSearch = () => {
    setCurrentPage(1) // 검색 시 첫 페이지로 이동
    loadDocuments()
  }

  const handleReset = () => {
    // 3개월 기본값으로 초기화
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
    setSelectedPeriod('3개월')
    setSearchType('주문 ID')
    setSearchKeyword('')
    setCurrentPage(1)
    // 초기화 후 데이터 다시 로드
    setTimeout(() => {
      loadDocuments()
    }, 0)
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
                    className={`admin-date-quick-btn ${period === selectedPeriod ? 'active' : ''}`}
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
            <button 
              className="admin-filter-btn"
              onClick={() => setIsFilterModalOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
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
                <th>주문 ID</th>
                <th>회원</th>
                <th>서류명</th>
                <th>메모</th>
                <th>기능</th>
                <th>첨부일시</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-table-empty">
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
                      <td data-label="주문 ID">{document.orderId}</td>
                      <td data-label="회원">{document.memberName}</td>
                      <td data-label="서류명">{document.documentName}</td>
                      <td data-label="메모">
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
                    <td data-label="기능">
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
                      <td data-label="첨부일시">{document.attachmentDate}</td>
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

      {/* Filter Modal (Mobile) */}
      {isFilterModalOpen && (
        <div className="admin-filter-overlay" onClick={() => setIsFilterModalOpen(false)}>
          <div className="admin-filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-filter-header">
              <span className="admin-filter-title">필터</span>
              <button className="admin-filter-close" onClick={() => setIsFilterModalOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="admin-filter-content">
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
                          className={`admin-date-quick-btn ${period === selectedPeriod ? 'active' : ''}`}
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
                  <button className="admin-search-btn" onClick={() => { handleSearch(); setIsFilterModalOpen(false); }}>
                    검색
                  </button>
                  <button className="admin-reset-btn" onClick={() => { handleReset(); setIsFilterModalOpen(false); }}>
                    초기화
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminDocument