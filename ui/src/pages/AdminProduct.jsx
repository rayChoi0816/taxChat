import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import ProductRegistrationModal from '../components/ProductRegistrationModal'

const AdminProduct = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const categoryId = new URLSearchParams(location.search).get('categoryId')
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('등록일시순')
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  // 상품 카테고리 목록 (실제로는 API에서 가져와야 함)
  const [categories] = useState([
    {
      id: 1,
      code: 'cate01ab',
      name: '인건비 신고',
      deleted: false
    }
  ])
  
  // 첨부 서류 목록 (실제로는 API에서 가져와야 함)
  const [attachments] = useState([
    { id: 1, name: '첨부서류 A' },
    { id: 2, name: '첨부서류 B' },
    { id: 3, name: '첨부서류 C' }
  ])
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchType, setSearchType] = useState('상품 카테고리명')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [displayStatus, setDisplayStatus] = useState({
    진열: true,
    비진열: true
  })

  const [products, setProducts] = useState([
    {
      id: 1,
      categoryName: '인건비 신고',
      name: '프리랜서 (4대 보험 신고 불필요)',
      code: 'cate01fe_01',
      price: 50000,
      display: '비진열',
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    },
    {
      id: 2,
      categoryName: '인건비 신고',
      name: '아르바이트 (고용, 산재보험만 신고)',
      code: 'cate01fe_02',
      price: 40000,
      display: '진열',
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    },
    {
      id: 3,
      categoryName: '인건비 신고',
      name: '상시근로자 (4대 보험 신고 필요)',
      code: 'cate01fe_03',
      price: 30000,
      display: '진열',
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    }
  ])

  const handleSelectAll = () => {
    if (selectedItems.length === visibleProducts.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(visibleProducts.map(item => item.id))
    }
  }

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원'
  }

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
    setSearchType('상품 카테고리명')
    setSearchKeyword('')
    setDisplayStatus({
      진열: true,
      비진열: true
    })
  }

  // 초기 날짜 범위 기본값 설정 (3개월)
  useEffect(() => {
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
  }, [])

  const handleDisplayToggle = (productId) => {
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? { ...product, display: product.display === '진열' ? '비진열' : '진열' }
        : product
    ))
  }

  const handleDelete = (id) => {
    if (window.confirm('해당 상품을 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      setProducts(prev => prev.map(product => 
        product.id === id
          ? { ...product, deleted: true }
          : product
      ))
    }
  }

  const handleCategoryManagement = () => {
    navigate('/admin/product-category')
  }

  const handleOpenRegistrationModal = () => {
    setSelectedProduct(null)
    setIsRegistrationModalOpen(true)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
    setSelectedProduct(null)
  }

  const handleSaveProducts = (newProducts) => {
    setProducts(prev => [...prev, ...newProducts])
    setIsRegistrationModalOpen(false)
    setSelectedProduct(null)
  }

  const handleViewDetails = (product) => {
    setSelectedProduct(product)
    setIsRegistrationModalOpen(true)
  }

  const handleUpdateProduct = (updatedProduct) => {
    setProducts(prev => prev.map(prod => 
      prod.id === updatedProduct.id
        ? { ...updatedProduct }
        : prod
    ))
    setIsRegistrationModalOpen(false)
    setSelectedProduct(null)
  }

  // 삭제되지 않은 상품만 필터링
  const visibleProducts = products.filter(product => !product.deleted)

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
                  <option value="상품 카테고리명">상품 카테고리명</option>
                  <option value="상품명">상품명</option>
                  <option value="상품코드">상품코드</option>
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
            <span className="admin-count-text">총 {visibleProducts.length}</span>
            <span className="admin-count-text">선택 {selectedItems.length} 건</span>
            <button className="admin-select-all-btn" onClick={handleSelectAll}>
              전체 선택
            </button>
          </div>
          <div className="admin-controls-right">
            <div className="admin-action-buttons">
              <button 
                className="admin-action-btn danger"
                onClick={handleCategoryManagement}
              >
                상품 카테고리 관리
              </button>
              <button 
                className="admin-action-btn primary"
                onClick={handleOpenRegistrationModal}
              >
                상품 등록
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
                    checked={selectedItems.length === visibleProducts.length && visibleProducts.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>상품 카테고리명</th>
                <th>상품명</th>
                <th>상품코드</th>
                <th>상품 가격</th>
                <th>진열</th>
                <th>기능</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={selectedItems.includes(product.id)}
                        onChange={() => handleSelectItem(product.id)}
                      />
                    </td>
                    <td>{product.categoryName}</td>
                    <td>{product.name}</td>
                    <td>{product.code}</td>
                    <td>{formatPrice(product.price)}</td>
                    <td>
                      <button 
                        className="admin-table-btn"
                        onClick={() => handleDisplayToggle(product.id)}
                      >
                        {product.display}
                      </button>
                    </td>
                    <td>
                      <button 
                        className="admin-table-btn"
                        onClick={() => handleViewDetails(product)}
                      >
                        상세 보기
                      </button>
                      <button 
                        className="admin-table-btn danger"
                        onClick={() => handleDelete(product.id)}
                      >
                        삭제
                      </button>
                    </td>
                    <td>{product.registrationDate}</td>
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
      </div>

      {/* Product Registration Modal */}
      {isRegistrationModalOpen && (
        <ProductRegistrationModal
          onClose={handleCloseRegistrationModal}
          onSave={handleSaveProducts}
          categories={categories}
          attachments={attachments}
          product={selectedProduct}
          onUpdate={handleUpdateProduct}
        />
      )}
    </AdminLayout>
  )
}

export default AdminProduct

