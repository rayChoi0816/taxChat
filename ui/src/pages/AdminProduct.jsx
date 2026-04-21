import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import '../components/AdminLayout.css'
import './AdminProduct.css'
import ProductRegistrationModal from '../components/ProductRegistrationModal'
import { productAPI, documentAPI } from '../utils/api'

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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  const [categories, setCategories] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
  const [searchType, setSearchType] = useState('상품 카테고리명')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [displayStatus, setDisplayStatus] = useState({
    진열: true,
    비진열: true
  })

  const [products, setProducts] = useState([])

  // 데이터 로드
  useEffect(() => {
    loadCategories()
    loadDocuments()
    
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
    setSelectedPeriod('3개월') // 기본값 설정
  }, [])

  // attachments가 로드된 후에 상품 목록 로드
  useEffect(() => {
    if (attachments.length > 0 || categoryId) {
      loadProducts()
    }
  }, [attachments, categoryId])

  // 날짜 범위, 정렬 변경 시 상품 목록 다시 로드
  useEffect(() => {
    // attachments나 categoryId가 로드된 후에만 실행
    if (attachments.length > 0 || categoryId !== null) {
      loadProducts()
    }
  }, [dateRange.start, dateRange.end, sortOrder])

  // 검색어, 진열 상태 변경 시 상품 목록 다시 로드
  useEffect(() => {
    if (attachments.length > 0 || categoryId) {
      loadProducts()
    }
  }, [searchKeyword, displayStatus])

  // 서류 목록 로드 (진열 상태인 서류만)
  const loadDocuments = async () => {
    try {
      const response = await documentAPI.getDocuments({ usageStatus: '진열' })
      if (response && response.success && response.data) {
        // 서류 목록을 attachments 형식으로 변환
        const documentList = (response.data || []).map(doc => ({
          id: doc.id,
          name: doc.name
        }))
        setAttachments(documentList)
      }
    } catch (error) {
      console.error('서류 목록 조회 오류:', error)
    }
  }

  // 카테고리 로드 (진열 상태인 것만 가져오기)
  const loadCategories = async () => {
    try {
      const response = await productAPI.getCategories({ displayStatus: '진열' })
      console.log('카테고리 API 응답:', response) // 디버깅용
      if (response && response.success && response.data) {
        setCategories(response.data || [])
      } else {
        console.warn('카테고리 데이터가 없습니다. 응답:', response)
        setCategories([])
      }
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
      if (error.message && error.message.includes('서버에 연결할 수 없습니다')) {
        console.error('백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:3001)')
      }
      setCategories([])
    }
  }

  // 상품 목록 로드
  const loadProducts = async () => {
    try {
      setLoading(true)
      const params = {}
      if (categoryId) {
        params.categoryId = categoryId
      }
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
      if (sortOrder) {
        params.sortOrder = sortOrder
      }
      const response = await productAPI.getProducts(params)
      
      console.log('상품 목록 API 응답:', response) // 디버깅용
      
      if (response && response.success && Array.isArray(response.data)) {
        if (response.data.length === 0) {
          console.warn('상품 데이터가 비어있습니다. 응답:', response)
        }
        
        // API 응답을 프론트엔드 형식으로 변환
        const formattedProducts = (response.data || []).map(product => {
          // required_documents를 파싱 (JSON 문자열 또는 배열)
          // 서류 ID 배열을 서류명 배열로 변환
          let productAttachments = []
          if (product.required_documents) {
            try {
              const documentIds = typeof product.required_documents === 'string'
                ? JSON.parse(product.required_documents)
                : product.required_documents
              
              // 서류 ID 배열을 서류명 배열로 변환
              productAttachments = Array.isArray(documentIds)
                ? documentIds.map(id => {
                    // id가 숫자인지 확인하고 타입 변환
                    const docId = typeof id === 'string' ? parseInt(id) : id
                    if (isNaN(docId)) {
                      console.warn(`상품 "${product.name}"의 서류 ID가 유효하지 않습니다:`, id)
                      return null
                    }
                    const doc = attachments.find(d => d.id === docId)
                    if (doc) {
                      return doc.name
                    } else {
                      console.warn(`상품 "${product.name}"의 서류 ID ${docId}를 찾을 수 없습니다. attachments:`, attachments.map(a => ({ id: a.id, name: a.name })))
                      return null
                    }
                  }).filter(v => v !== null && v !== undefined)
                : []
            } catch (e) {
              // JSON 파싱 실패 시 빈 배열
              productAttachments = []
            }
          }
          
          return {
            id: product.id,
            categoryName: product.category_name || '',
            name: product.name,
            code: product.code,
            price: product.price,
            display: product.display_status || '비진열',
            registrationDate: product.created_at ? new Date(product.created_at).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, '') : '',
            deleted: product.deleted || false,
            availableUsers: {
              비사업자: product.available_for_non_business || false,
              개인사업자: product.available_for_individual_business || false,
              법인사업자: product.available_for_corporate_business || false
            },
            description: product.description || '',
            attachments: productAttachments
          }
        })
        setProducts(formattedProducts)
      } else {
        console.error('상품 목록 조회 실패:', response)
        setProducts([])
        if (response && response.error) {
          console.error('API 오류:', response.error)
        }
      }
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

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
    setSelectedPeriod(period) // 선택된 기간 업데이트
    
    const today = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '오늘':
        // 오늘 날짜로 설정 (시작일과 종료일 모두 오늘)
        const todayStr = today.toISOString().split('T')[0]
        setDateRange({ start: todayStr, end: todayStr })
        // useEffect가 자동으로 loadProducts 호출
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
        // useEffect가 자동으로 loadProducts 호출
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
    // useEffect가 자동으로 loadProducts 호출
  }

  const handleDisplayStatusFilterChange = (status) => {
    setDisplayStatus(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  const handleDisplayToggle = async (productId) => {
    const product = products.find(p => p.id === productId)
    if (!product) return
    
    const newStatus = product.display === '진열' ? '비진열' : '진열'
    
    // alert 메시지 표시
    if (product.display === '진열') {
      alert('비진열 상태로 변경합니다. 선택 리스트에 노출되지 않습니다.')
    } else {
      alert('진열 상태로 변경합니다. 선택 리스트에 노출됩니다.')
    }
    
    await handleDisplayStatusChange(productId, newStatus)
  }

  const handleSearch = () => {
    // 검색 실행 - 현재 페이지로 리셋하고 데이터 로드
    setCurrentPage(1)
    loadProducts()
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
    setSearchType('상품 카테고리명')
    setSearchKeyword('')
    setDisplayStatus({
      진열: true,
      비진열: true
    })
    setCurrentPage(1)
    loadProducts()
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

  const handleOpenRegistrationModal = async () => {
    setSelectedProduct(null)
    // 모달을 열 때 카테고리 목록과 서류 목록을 다시 로드 (진열 상태 변경 반영)
    await loadCategories()
    await loadDocuments()
    setIsRegistrationModalOpen(true)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
    setSelectedProduct(null)
  }

  const handleSaveProducts = async (newProducts) => {
    try {
      setLoading(true)
      
      // 첫 번째 상품의 카테고리 ID 찾기
      const firstProduct = newProducts[0]
      const category = categories.find(cat => cat.name === firstProduct.categoryName)
      
      if (!category) {
        alert('카테고리를 찾을 수 없습니다.')
        return
      }

      // API 형식에 맞게 변환
      const productsToSave = newProducts.map(prod => {
        // attachments의 value가 서류명인 경우 서류 ID로 변환
        const documentIds = prod.attachments && prod.attachments.length > 0
          ? prod.attachments.map(att => {
              const value = att.value || att
              // value가 서류명인 경우 서류 ID 찾기
              const document = attachments.find(doc => doc.name === value)
              return document ? document.id : value
            }).filter(v => v)
          : []
        
        return {
          name: prod.name,
          price: parseInt(prod.price) || 0,
          description: prod.description || '',
          requiredDocuments: documentIds,
          availableForNonBusiness: prod.availableUsers?.비사업자 || false,
          availableForIndividualBusiness: prod.availableUsers?.개인사업자 || false,
          availableForCorporateBusiness: prod.availableUsers?.법인사업자 || false
        }
      })

      const response = await productAPI.createProduct({
        categoryId: category.id,
        products: productsToSave
      })

      if (response.success) {
        // 상품 목록 다시 로드
        await loadProducts()
        setIsRegistrationModalOpen(false)
        setSelectedProduct(null)
        alert('상품이 등록되었습니다.')
      } else {
        alert(response.error || '상품 등록 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('상품 등록 오류:', error)
      alert('상품 등록 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (product) => {
    setSelectedProduct(product)
    setIsRegistrationModalOpen(true)
  }

  const handleUpdateProduct = async (updatedProduct) => {
    try {
      setLoading(true)
      
      // 카테고리 ID 찾기
      const category = categories.find(cat => cat.name === updatedProduct.categoryName)
      if (!category) {
        alert('카테고리를 찾을 수 없습니다.')
        return
      }

      // attachments의 value가 서류명인 경우 서류 ID로 변환
      const documentIds = updatedProduct.attachments && updatedProduct.attachments.length > 0
        ? updatedProduct.attachments.map(att => {
            const value = att.value || att
            // value가 서류명인 경우 서류 ID 찾기
            const document = attachments.find(doc => doc.name === value)
            return document ? document.id : value
          }).filter(v => v)
        : []

      const productData = {
        categoryId: category.id,
        name: updatedProduct.name,
        price: parseInt(updatedProduct.price) || 0,
        description: updatedProduct.description || '',
        requiredDocuments: documentIds,
        availableForNonBusiness: updatedProduct.availableUsers?.비사업자 || false,
        availableForIndividualBusiness: updatedProduct.availableUsers?.개인사업자 || false,
        availableForCorporateBusiness: updatedProduct.availableUsers?.법인사업자 || false
      }

      const response = await productAPI.updateProduct(updatedProduct.id, productData)
      
      if (response.success) {
        // 상품 목록 다시 로드
        await loadProducts()
        setIsRegistrationModalOpen(false)
        setSelectedProduct(null)
        alert('상품이 수정되었습니다.')
      } else {
        alert(response.error || '상품 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('상품 수정 오류:', error)
      alert('상품 수정 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  // 진열 상태 변경
  const handleDisplayStatusChange = async (productId, newStatus) => {
    try {
      const response = await productAPI.updateProductDisplay(productId, newStatus)
      if (response.success) {
        await loadProducts()
      } else {
        alert('진열 상태 변경 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('진열 상태 변경 오류:', error)
      alert('진열 상태 변경 중 오류가 발생했습니다.')
    }
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
                    onChange={() => handleDisplayStatusFilterChange(status)}
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
                <th>상품 이용 회원 유형</th>
                <th>진열</th>
                <th>기능</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="admin-table-empty">
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
                    <td data-label="상품 카테고리명">{product.categoryName}</td>
                    <td data-label="상품명">{product.name}</td>
                    <td data-label="상품코드">{product.code}</td>
                    <td data-label="상품 가격">{formatPrice(product.price)}</td>
                    <td data-label="상품 이용 회원 유형">
                      {product.availableUsers ? (() => {
                        const availableTypes = []
                        if (product.availableUsers.비사업자) availableTypes.push('비사업자')
                        if (product.availableUsers.개인사업자) availableTypes.push('개인사업자')
                        if (product.availableUsers.법인사업자) availableTypes.push('법인사업자')
                        
                        return availableTypes.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {availableTypes.map((type, index) => (
                              <span key={index} style={{ 
                                fontSize: '0.85rem',
                                padding: '0.2rem 0.5rem',
                                backgroundColor: '#f0f0f0',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                {type}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#999' }}>-</span>
                        )
                      })() : (
                        <span style={{ fontSize: '0.85rem', color: '#999' }}>-</span>
                      )}
                    </td>
                    <td data-label="진열">
                      <button 
                        className="admin-table-btn"
                        onClick={() => handleDisplayToggle(product.id)}
                      >
                        {product.display}
                      </button>
                    </td>
                    <td data-label="기능">
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
                    <td data-label="등록일">{product.registrationDate}</td>
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
                          onChange={() => handleDisplayStatusFilterChange(status)}
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
    </AdminLayout>
  )
}

export default AdminProduct