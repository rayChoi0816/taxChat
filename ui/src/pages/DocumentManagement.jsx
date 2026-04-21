import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import './DocumentManagement.css'
import DocumentCategoryModal from '../components/DocumentCategoryModal'
import DocumentRegistrationModal from '../components/DocumentRegistrationModal'
import { documentAPI } from '../utils/api'

const DocumentManagement = () => {
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('등록일시순')
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
  const [searchType, setSearchType] = useState('서류 카테고리')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [displayStatus, setDisplayStatus] = useState({
    진열: true,
    비진열: true
  })
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [loading, setLoading] = useState(false)
  
  // 서류 카테고리 목록
  const [documentCategories, setDocumentCategories] = useState([])
  
  // 서류 카테고리 목록 (ID 포함)
  const [documentCategoriesWithId, setDocumentCategoriesWithId] = useState([])
  
  // 서류 목록
  const [documents, setDocuments] = useState([])
  
  // 서류 카테고리 목록 로드 및 3개월 기본값 설정
  useEffect(() => {
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
      setSelectedPeriod('3개월') // 기본값 설정
    }
    
    loadCategories()
    loadDocuments()
  }, [])
  
  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await documentAPI.getCategories()
      if (response.success) {
        // API 응답을 프론트엔드 형식으로 변환 (ID와 name 모두 저장)
        setDocumentCategoriesWithId(response.data)
        const categoryNames = response.data.map(cat => cat.name)
        setDocumentCategories(categoryNames)
      }
    } catch (error) {
      console.error('서류 카테고리 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 서류 목록 로드
  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await documentAPI.getDocuments()
      console.log(`[서류 목록 조회] API 응답:`, response)
      
      if (response && response.success && Array.isArray(response.data)) {
        console.log(`[서류 목록 조회] 총 ${response.data.length}건 조회됨`)
        
        // API 응답을 프론트엔드 형식으로 변환
        // 백엔드에서 이미 deleted = false인 항목만 반환하므로 필터링 불필요
        // 하지만 안전을 위해 deleted 필드가 true인 경우 제외
        const beforeFilter = response.data.length
        let formattedDocuments = response.data
          .filter(doc => {
            if (!doc) return false
            if (doc.deleted === true) {
              console.warn(`[서류 목록 조회] deleted=true인 항목 발견:`, doc)
              return false
            }
            return true
          }) // 안전장치: null/undefined 및 deleted가 true인 경우 제외
          .map(doc => ({
            id: doc.id,
            category: doc.category_name || null,
            categoryId: doc.category_id,
            name: doc.name,
            description: doc.description || '',
            display: doc.usage_status || '비진열',
            registrationDate: doc.created_at ? new Date(doc.created_at).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, '') : '',
            createdAt: doc.created_at, // 정렬을 위한 원본 날짜
            deleted: false // 백엔드에서 이미 필터링했으므로 항상 false
          }))
        
        // 클라이언트 측 필터링
        // 날짜 범위 필터링
        if (dateRange.start || dateRange.end) {
          formattedDocuments = formattedDocuments.filter(doc => {
            if (!doc.createdAt) return false
            const docDate = new Date(doc.createdAt)
            const startDate = dateRange.start ? new Date(dateRange.start) : null
            const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null
            
            if (startDate && docDate < startDate) return false
            if (endDate && docDate > endDate) return false
            return true
          })
        }
        
        // 검색어 필터링
        if (searchKeyword.trim()) {
          formattedDocuments = formattedDocuments.filter(doc => {
            if (searchType === '서류 카테고리') {
              return doc.category?.toLowerCase().includes(searchKeyword.toLowerCase())
            } else if (searchType === '서류명') {
              return doc.name?.toLowerCase().includes(searchKeyword.toLowerCase())
            }
            return true
          })
        }
        
        // 진열 상태 필터링
        if (!displayStatus.진열 || !displayStatus.비진열) {
          formattedDocuments = formattedDocuments.filter(doc => {
            if (!displayStatus.진열 && doc.display === '진열') return false
            if (!displayStatus.비진열 && doc.display === '비진열') return false
            return true
          })
        }
        
        // 정렬 적용
        formattedDocuments.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
          
          if (sortOrder === '등록일시순') {
            // 등록일시순: 빠른 순 (오름차순)
            return dateA - dateB
          } else if (sortOrder === '등록일시 역순') {
            // 등록일시 역순: 느린 순 (내림차순)
            return dateB - dateA
          }
          return 0
        })
        
        setDocuments(formattedDocuments)
      } else {
        console.error('서류 목록 조회 실패:', response)
        setDocuments([])
      }
    } catch (error) {
      console.error('서류 목록 조회 오류:', error)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

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

  const handleDisplayStatusChange = (status) => {
    setDisplayStatus(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  const handleSearch = () => {
    // 검색 실행 시 첫 페이지로 이동하고 데이터 다시 로드
    setCurrentPage(1)
    loadDocuments()
  }
  
  // 날짜 범위, 검색어, 진열 상태, 정렬 변경 시 문서 목록 다시 로드
  useEffect(() => {
    loadDocuments()
  }, [currentPage, itemsPerPage, sortOrder, dateRange, searchKeyword, searchType, displayStatus])

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
    setSearchType('서류 카테고리')
    setSearchKeyword('')
    setDisplayStatus({
      진열: true,
      비진열: true
    })
  }

  const handleDisplayToggle = async (documentId) => {
    const document = documents.find(doc => doc.id === documentId)
    if (!document) return

    const currentStatus = document.display
    const newStatus = currentStatus === '진열' ? '비진열' : '진열'

    // 상태 변경 전 alert 표시
    if (currentStatus === '진열') {
      alert('비진열 상태로 변경합니다. 선택 리스트에 노출되지 않습니다.')
    } else {
      alert('진열 상태로 변경합니다. 선택 리스트에 노출됩니다.')
    }

    try {
      setLoading(true)
      const response = await documentAPI.updateDocumentUsageStatus(documentId, newStatus)
      if (response.success) {
        // 서류 목록 새로고침
        await loadDocuments()
      } else {
        alert(response.error || '서류 진열 상태 변경 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('서류 진열 상태 변경 오류:', error)
      alert('서류 진열 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('해당 서류를 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      return
    }

    try {
      setLoading(true)
      console.log(`[삭제 요청] 서류 ID: ${id}`)
      const response = await documentAPI.deleteDocument(id)
      console.log(`[삭제 응답]`, response)
      
      if (response && response.success) {
        // 즉시 목록에서 제거 (UX 개선)
        setDocuments(prevDocuments => prevDocuments.filter(doc => doc.id !== id))
        
        // 선택된 항목에서도 제거
        setSelectedItems(prev => prev.filter(item => item !== id))
        
        // 목록 새로고침하여 백엔드 상태와 동기화 (새로고침 시에도 삭제된 항목이 표시되지 않도록)
        console.log(`[목록 새로고침] 삭제 후 목록 새로고침 시작`)
        await loadDocuments()
        console.log(`[목록 새로고침] 완료`)
      } else {
        alert(response?.error || '서류 삭제 중 오류가 발생했습니다.')
        // 삭제 실패 시 목록 새로고침
        await loadDocuments()
      }
    } catch (error) {
      console.error('서류 삭제 오류:', error)
      alert('서류 삭제 중 오류가 발생했습니다.')
      // 삭제 실패 시 목록 새로고침
      await loadDocuments()
    } finally {
      setLoading(false)
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

  const handleSaveCategories = async (newCategoryNames) => {
    try {
      setLoading(true)
      
      // 새로 추가할 카테고리가 있는 경우만 저장
      if (newCategoryNames && newCategoryNames.length > 0) {
        // 기존 카테고리 목록 가져오기
        const existingResponse = await documentAPI.getCategories()
        const existingCategories = existingResponse.success 
          ? existingResponse.data.map(cat => cat.name)
          : []
        
        // 새로 추가할 카테고리만 필터링
        const categoriesToAdd = newCategoryNames.filter(cat => !existingCategories.includes(cat))
        
        // 각 카테고리를 DB에 저장
        for (const categoryName of categoriesToAdd) {
          await documentAPI.createCategory(categoryName)
        }
      }
      
      // 카테고리 목록 새로고침
      await loadCategories()
      
      if (newCategoryNames && newCategoryNames.length > 0) {
        alert('서류 카테고리가 저장되었습니다.')
      }
    } catch (error) {
      console.error('서류 카테고리 저장 오류:', error)
      alert('서류 카테고리 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenRegistrationModal = () => {
    setSelectedDocument(null)
    setIsRegistrationModalOpen(true)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
    setSelectedDocument(null)
  }

  const handleSaveDocument = async (newDocument) => {
    try {
      setLoading(true)
      
      // 서류 카테고리 이름으로 ID 찾기
      let categoryId = null
      if (newDocument.category) {
        const category = documentCategoriesWithId.find(cat => cat.name === newDocument.category)
        categoryId = category ? category.id : null
      }
      
      const documentData = {
        categoryId: categoryId,
        name: newDocument.name,
        description: newDocument.description
      }
      
      const response = await documentAPI.createDocument(documentData)
      if (response.success) {
        // 서류 목록 새로고침
        await loadDocuments()
        setIsRegistrationModalOpen(false)
        setSelectedDocument(null)
        alert('서류가 등록되었습니다.')
      } else {
        alert(response.error || '서류 등록 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('서류 등록 오류:', error)
      alert('서류 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (document) => {
    setSelectedDocument(document)
    setIsRegistrationModalOpen(true)
  }

  const handleUpdateDocument = async (updatedDocument) => {
    try {
      setLoading(true)
      
      // 서류 카테고리 이름으로 ID 찾기
      let categoryId = null
      if (updatedDocument.category) {
        const category = documentCategoriesWithId.find(cat => cat.name === updatedDocument.category)
        categoryId = category ? category.id : null
      }
      
      const documentData = {
        categoryId: categoryId,
        name: updatedDocument.name,
        description: updatedDocument.description
      }
      
      const response = await documentAPI.updateDocument(updatedDocument.id, documentData)
      if (response.success) {
        // 서류 목록 새로고침
        await loadDocuments()
        setIsRegistrationModalOpen(false)
        setSelectedDocument(null)
        alert('서류가 수정되었습니다.')
      } else {
        alert(response.error || '서류 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('서류 수정 오류:', error)
      alert('서류 수정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
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
    <AdminLayout>
      <div className="admin-page">
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
                  className={`admin-date-quick-btn ${selectedPeriod === period ? 'active' : ''}`}
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
                <td colSpan="7" className="admin-table-empty">
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
                  <td data-label="서류 카테고리">{document.category || '-'}</td>
                  <td data-label="서류명">{document.name}</td>
                  <td data-label="서류 설명">{document.description}</td>
                  <td data-label="사용 여부">
                    <button 
                      className="admin-table-btn"
                      onClick={() => handleDisplayToggle(document.id)}
                    >
                      {document.display}
                    </button>
                  </td>
                  <td data-label="기능">
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
                  <td data-label="등록일">{document.registrationDate}</td>
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
                {/* 등록일시 검색과 검색어 입력을 한 줄에 배치 */}
                <div className="admin-search-row">
                  {/* 등록일시 검색 */}
                  <div className="admin-search-section admin-search-section-left">
                    <label className="admin-search-label">등록일시</label>
                    <div className="admin-date-quick-buttons">
                      {['오늘', '1주일', '1개월', '3개월', '6개월', '1년', '전체'].map((period) => (
                        <button
                          key={period}
                          className={`admin-date-quick-btn ${selectedPeriod === period ? 'active' : ''}`}
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
      </div>
    </AdminLayout>
  )
}

export default DocumentManagement
