import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import './AdminProductCategory.css'
import ProductCategoryRegistrationModal from '../components/ProductCategoryRegistrationModal'

const AdminProductCategory = () => {
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('등록일시순')
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchType, setSearchType] = useState('상품 카테고리 ID')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [displayStatus, setDisplayStatus] = useState({
    진열: true,
    비진열: true
  })

  const [categories, setCategories] = useState([
    {
      id: 1,
      code: 'cate01ab',
      name: '인건비 신고',
      briefDesc: '인건비 신고에 대한 정의가 출력되는 영역이며...',
      detailedDesc: '인건비',
      display: '비진열',
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    }
  ])

  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)

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
    setSearchType('상품 카테고리 ID')
    setSearchKeyword('')
    setDisplayStatus({
      진열: true,
      비진열: true
    })
  }

  const handleDisplayToggle = (categoryId) => {
    setCategories(prev => prev.map(category => 
      category.id === categoryId
        ? { ...category, display: category.display === '진열' ? '비진열' : '진열' }
        : category
    ))
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

  const handleUpdateCategory = (updatedCategory) => {
    setCategories(prev => prev.map(cat => 
      cat.id === updatedCategory.id
        ? { ...updatedCategory }
        : cat
    ))
    setIsRegistrationModalOpen(false)
    setSelectedCategory(null)
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

  const handleSaveCategory = (newCategory) => {
    // 기존 카테고리 코드 목록 가져오기
    const existingCodes = categories.map(cat => cat.code)
    
    // 새로운 코드 생성
    const newCode = generateCategoryCode(existingCodes)
    
    // 등록일시 포맷팅
    const now = new Date()
    const registrationDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    
    const categoryToAdd = {
      ...newCategory,
      id: Date.now(),
      code: newCode,
      registrationDate: registrationDate
    }

    setCategories(prev => [...prev, categoryToAdd])
    setIsRegistrationModalOpen(false)
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

  // 삭제되지 않은 카테고리만 필터링
  const visibleCategories = categories.filter(category => !category.deleted)

  return (
    <div className="admin-product-category-page">
      {/* Header */}
      <div className="admin-product-category-header">
        <h1 className="admin-product-category-title">상품 카테고리 관리</h1>
        <button className="admin-product-category-close-btn" onClick={handleClose}>
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
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
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
                  <td>{category.code}</td>
                  <td>{category.name}</td>
                  <td>{category.briefDesc}</td>
                  <td>{category.detailedDesc}</td>
                  <td>
                    <button 
                      className="admin-table-btn"
                      onClick={() => handleDisplayToggle(category.id)}
                    >
                      {category.display}
                    </button>
                  </td>
                  <td>
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
                  <td>{category.registrationDate}</td>
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

      {/* Product Category Registration Modal */}
      {isRegistrationModalOpen && (
        <ProductCategoryRegistrationModal
          onClose={handleCloseRegistrationModal}
          onSave={handleSaveCategory}
          category={selectedCategory}
          onUpdate={handleUpdateCategory}
        />
      )}
    </div>
  )
}

export default AdminProductCategory
