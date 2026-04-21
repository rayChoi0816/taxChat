import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import './AdminProductCategory.css'
import ProductCategoryRegistrationModal from '../components/ProductCategoryRegistrationModal'
import { productAPI } from '../utils/api'

const AdminProductCategory = () => {
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('등록일시순')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
  const [searchType, setSearchType] = useState('상품 카테고리 ID')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [displayStatus, setDisplayStatus] = useState({
    진열: true,
    비진열: true
  })

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)

  // 데이터 로드 및 3개월 기본값 설정
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
  }, [])

  // 날짜 범위, 검색어, 진열 상태 변경 시 카테고리 목록 다시 로드
  useEffect(() => {
    loadCategories()
  }, [dateRange.start, dateRange.end, searchKeyword, displayStatus])

  // 카테고리 로드
  const loadCategories = async () => {
    try {
      setLoading(true)
      const params = {}
      // 검색 필터 적용
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
      if (displayStatus.진열 && !displayStatus.비진열) {
        params.displayStatus = '진열'
      } else if (!displayStatus.진열 && displayStatus.비진열) {
        params.displayStatus = '비진열'
      }
      const response = await productAPI.getCategories(params)
      if (response && response.success && response.data) {
        // API 응답을 프론트엔드 형식으로 변환
        const formattedCategories = (response.data || []).map(category => {
          // 날짜 포맷팅
          let formattedDate = ''
          if (category.created_at) {
            const date = new Date(category.created_at)
            const year = String(date.getFullYear()).slice(-2)
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            formattedDate = `${year}.${month}.${day}. ${hours}:${minutes}`
          }
          
          return {
            id: category.id,
            code: category.code,
            name: category.name,
            briefDesc: category.brief_description || '',
            detailedDesc: category.detailed_description || '',
            display: category.display_status || '비진열',
            registrationDate: formattedDate,
            createdAt: category.created_at, // 필터링을 위한 원본 날짜
            deleted: category.deleted || false
          }
        })
        setCategories(formattedCategories)
      } else {
        console.error('카테고리 조회 실패:', response)
        setCategories([])
        if (response && response.error) {
          console.error('API 오류:', response.error)
        }
      }
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
      setCategories([])
    } finally {
      setLoading(false)
    }
  }


  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)

  const handleDateQuickSelect = (period) => {
    setSelectedPeriod(period) // 선택된 기간 업데이트
    
    const today = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '오늘':
        // 오늘 날짜로 설정 (시작일과 종료일 모두 오늘)
        const todayStr = today.toISOString().split('T')[0]
        setDateRange({ start: todayStr, end: todayStr })
        // handleSearch나 useEffect에서 자동으로 loadCategories 호출
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
        // useEffect가 자동으로 loadCategories 호출
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
    // useEffect가 자동으로 loadCategories 호출
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
    loadCategories()
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
    setSearchType('상품 카테고리 ID')
    setSearchKeyword('')
    setDisplayStatus({
      진열: true,
      비진열: true
    })
    setCurrentPage(1)
    loadCategories()
  }

  const handleDisplayToggle = async (categoryId) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return
    
    const currentStatus = category.display === '진열' ? '진열' : '비진열'
    const newStatus = currentStatus === '진열' ? '비진열' : '진열'
    
    // Alert 메시지 표시
    if (currentStatus === '진열') {
      alert('비진열 상태로 변경합니다. 선택 리스트에 노출되지 않습니다.')
    } else {
      alert('진열 상태로 변경합니다. 선택 리스트에 노출됩니다.')
    }
    
    try {
      const response = await productAPI.updateCategoryDisplay(categoryId, newStatus)
      if (response.success) {
        // 카테고리 목록 다시 로드
        await loadCategories()
        // 상품 페이지의 카테고리 목록도 갱신되도록 (부모 컴포넌트에 알림 필요 시)
      } else {
        alert('진열 상태 변경 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('진열 상태 변경 오류:', error)
      alert('진열 상태 변경 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = (id) => {
    if (window.confirm('해당 상품 카테고리를 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      setCategories(prev => prev.map(category => 
        category.id === id
          ? { ...category, deleted: true }
          : category
      ))
    }
  }

  const handleClose = () => {
    navigate('/admin/product')
  }

  const handleOpenRegistrationModal = () => {
    setSelectedCategory(null)
    setIsRegistrationModalOpen(true)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
    setSelectedCategory(null)
  }

  const handleViewDetails = (category) => {
    setSelectedCategory(category)
    setIsRegistrationModalOpen(true)
  }

  const handleUpdateCategory = async (updatedCategory) => {
    try {
      const response = await productAPI.updateCategory(updatedCategory.id, {
        name: updatedCategory.name,
        briefDescription: updatedCategory.briefDesc,
        detailedDescription: updatedCategory.detailedDesc
      })
      
      if (response.success) {
        // 카테고리 목록 다시 로드
        await loadCategories()
    setIsRegistrationModalOpen(false)
    setSelectedCategory(null)
        alert('카테고리가 수정되었습니다.')
      } else {
        alert('카테고리 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('카테고리 수정 오류:', error)
      alert('카테고리 수정 중 오류가 발생했습니다.')
    }
  }

  const generateCategoryCode = (existingCodes) => {
    // 기존 코드에서 최대 순번 찾기
    let maxNumber = 0
    existingCodes.forEach(code => {
      const match = code.match(/^cate(\d{2})[a-z]{2}$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    })

    // 다음 순번 계산
    const nextNumber = maxNumber + 1
    const numberStr = String(nextNumber).padStart(2, '0')
    
    // 임의의 소문자 알파벳 두 글자 생성
    const randomAlphabet1 = String.fromCharCode(97 + Math.floor(Math.random() * 26)) // 97은 'a'의 ASCII 코드
    const randomAlphabet2 = String.fromCharCode(97 + Math.floor(Math.random() * 26))
    const alphabets = randomAlphabet1 + randomAlphabet2

    return `cate${numberStr}${alphabets}`
  }

  const handleSaveCategory = async (newCategory) => {
    try {
      const response = await productAPI.createCategory({
        name: newCategory.name,
        briefDescription: newCategory.briefDesc,
        detailedDescription: newCategory.detailedDesc
      })
      
      if (response.success) {
        // 카테고리 목록 다시 로드
        await loadCategories()
        setIsRegistrationModalOpen(false)
        setSelectedCategory(null)
        alert('카테고리가 등록되었습니다.')
      } else {
        alert('카테고리 등록 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('카테고리 등록 오류:', error)
      alert('카테고리 등록 중 오류가 발생했습니다.')
    }
  }

  const handleSelectAll = () => {
    if (selectedItems.length === visibleCategories.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(visibleCategories.map(item => item.id))
    }
  }

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  // 필터링 및 검색 로직
  const getFilteredCategories = () => {
    let filtered = categories.filter(category => !category.deleted)

    // 날짜 범위 필터링
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(category => {
        if (!category.createdAt) return false
        const categoryDate = new Date(category.createdAt)
        const startDate = dateRange.start ? new Date(dateRange.start) : null
        const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null
        
        if (startDate && categoryDate < startDate) return false
        if (endDate && categoryDate > endDate) return false
        return true
      })
    }

    // 검색어 필터링
    if (searchKeyword.trim()) {
      filtered = filtered.filter(category => {
        if (searchType === '상품 카테고리 ID') {
          return category.code?.toLowerCase().includes(searchKeyword.toLowerCase())
        } else if (searchType === '상품 카테고리명') {
          return category.name?.toLowerCase().includes(searchKeyword.toLowerCase())
        }
        return true
      })
    }

    // 진열 상태 필터링
    if (!displayStatus.진열 || !displayStatus.비진열) {
      filtered = filtered.filter(category => {
        if (!displayStatus.진열 && category.display === '진열') return false
        if (!displayStatus.비진열 && category.display === '비진열') return false
        return true
      })
    }

    return filtered
  }

  // 정렬 로직
  const getSortedCategories = (filtered) => {
    const sorted = [...filtered]
    
    if (sortOrder === '등록일시순') {
      sorted.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
        return dateA - dateB
      })
    } else if (sortOrder === '등록일시 역순') {
      sorted.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
        return dateB - dateA
      })
    }
    
    return sorted
  }

  // 페이지네이션 로직
  const getPaginatedCategories = (sorted) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sorted.slice(startIndex, endIndex)
  }

  // 최종 표시할 카테고리
  const filteredCategories = getFilteredCategories()
  const sortedCategories = getSortedCategories(filteredCategories)
  const visibleCategories = getPaginatedCategories(sortedCategories)
  const totalPages = Math.ceil(sortedCategories.length / itemsPerPage)

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
                <option value="상품 카테고리 ID">상품 카테고리 ID</option>
                <option value="상품 카테고리명">상품 카테고리명</option>
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
          <span className="admin-count-text">총 {visibleCategories.length}</span>
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
              onClick={handleOpenRegistrationModal}
            >
              상품 카테고리 등록
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
                  checked={selectedItems.length === visibleCategories.length && visibleCategories.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>상품 카테고리 ID</th>
              <th>상품 카테고리명</th>
              <th>상품 간략 카테고리 설명</th>
              <th>상품 상세 카테고리 설명</th>
              <th>진열</th>
              <th>기능</th>
              <th>등록일</th>
            </tr>
          </thead>
          <tbody>
            {visibleCategories.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              visibleCategories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="admin-table-checkbox"
                      checked={selectedItems.includes(category.id)}
                      onChange={() => handleSelectItem(category.id)}
                    />
                  </td>
                  <td data-label="상품 카테고리 ID">{category.code}</td>
                  <td data-label="상품 카테고리명">{category.name}</td>
                  <td data-label="상품 간략 카테고리 설명">{category.briefDesc}</td>
                  <td data-label="상품 상세 카테고리 설명">{category.detailedDesc}</td>
                  <td data-label="진열">
                    <button 
                      className="admin-table-btn"
                      onClick={() => handleDisplayToggle(category.id)}
                    >
                      {category.display}
                    </button>
                  </td>
                  <td data-label="기능">
                    <button 
                      className="admin-table-btn"
                      onClick={() => handleViewDetails(category)}
                    >
                      상세 보기
                    </button>
                    <button 
                      className="admin-table-btn danger"
                      onClick={() => handleDelete(category.id)}
                    >
                      삭제
                    </button>
                  </td>
                  <td data-label="등록일">{category.registrationDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="admin-pagination">
          <button
            className="admin-pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            // 현재 페이지 주변 페이지만 표시
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 2 && page <= currentPage + 2)
            ) {
              return (
                <button
                  key={page}
                  className={`admin-pagination-page ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              )
            } else if (
              page === currentPage - 3 ||
              page === currentPage + 3
            ) {
              return (
                <span key={page} className="admin-pagination-ellipsis">
                  ...
                </span>
              )
            }
            return null
          })}
          <button
            className="admin-pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            다음
          </button>
        </div>
      )}

      {/* Product Category Registration Modal */}
      {isRegistrationModalOpen && (
        <ProductCategoryRegistrationModal
          onClose={handleCloseRegistrationModal}
          onSave={handleSaveCategory}
          category={selectedCategory}
          onUpdate={handleUpdateCategory}
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
                        <option value="상품 카테고리 ID">상품 카테고리 ID</option>
                        <option value="상품 카테고리명">상품 카테고리명</option>
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

export default AdminProductCategory