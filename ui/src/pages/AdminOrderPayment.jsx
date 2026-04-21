import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import MemoModal from '../components/MemoModal'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import { orderAPI } from '../utils/api'
import '../components/AdminLayout.css'
import './AdminOrderPayment.css'
import './AdminCustomer.css'

const AdminOrderPayment = () => {
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('주문결제일시순')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
  const [searchType, setSearchType] = useState('주문인')
  const [searchKeyword, setSearchKeyword] = useState('')
  
  // 메모 모달 상태
  const [selectedOrder, setSelectedOrder] = useState(null)
  const { customerMemos, addMemo, deleteMemo, getLatestMemo: getLatestMemoFromContext, initializeMemos } = useCustomerMemo()
  
  // 상태 변경 모달
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState(null)
  
  // 결제 취소 모달
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState(null)
  const [cancelAmount, setCancelAmount] = useState('')
  const cancelAmountInputRef = useRef(null)
  
  // 취소 완료 정보 모달
  const [cancelInfoModalOpen, setCancelInfoModalOpen] = useState(false)
  const [selectedCanceledOrder, setSelectedCanceledOrder] = useState(null)

  // 예시 데이터 날짜를 현재 날짜 기준으로 설정
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDateString = (daysAgo) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  const getOrderId = (dateStr) => {
    const date = new Date(dateStr)
    const year = String(date.getFullYear()).slice(-2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const randomChars = String.fromCharCode(97 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26))
    return `${year}${month}${day}${hours}${minutes}${seconds}${randomChars}`
  }

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  // 주문 목록 로드
  const loadOrders = async () => {
    try {
      setLoading(true)
      
      // 서버 API의 검색 타입에 맞게 변환 (주문인 -> 회원명)
      const apiSearchType = searchType === '주문인' ? '회원명' : searchType
      
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sortOrder: sortOrder === '주문결제일시순' ? '주문결제일시순' : 
                   sortOrder === '주문결제일시 역순' ? '주문결제일시 역순' :
                   '등록일시 역순'
      }
      
      // 날짜 필터가 있으면 추가
      if (dateRange.start) {
        params.startDate = dateRange.start
      }
      if (dateRange.end) {
        params.endDate = dateRange.end
      }
      
      // 검색 필터가 있으면 추가
      if (searchKeyword) {
        params.searchType = apiSearchType
        params.searchKeyword = searchKeyword
      }

      const response = await orderAPI.getOrders(params)
      
      console.log('주문 목록 API 응답:', response) // 디버깅용
      
      if (response && response.success && response.data) {
        // response.data가 배열인지 확인
        const dataArray = Array.isArray(response.data) ? response.data : []
        
        if (dataArray.length === 0) {
          console.warn('주문 데이터가 비어있습니다. 응답:', response)
        }
        
        // API 응답을 프론트엔드 형식으로 변환
        const formattedOrders = dataArray.map(order => {
          // 회원명 처리 (name 또는 business_name)
          const customerName = order.member_name || order.business_name || ''
          
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
            id: order.id,
            orderId: order.order_id || '',
            customerName: customerName,
            customerId: order.member_id || null,
            categoryName: order.category_name || '',
            productName: order.product_name || '',
            productPrice: order.product_price || order.payment_amount || 0,
            status: order.status || '결제대기',
            orderPaymentDate: formatDate(order.payment_date),
            cancelAmount: order.cancel_amount || 0,
            cancelDate: formatDate(order.cancel_date),
      deleted: false
    }
        })
        
        setOrders(formattedOrders)
        setTotalCount(response.pagination?.total || formattedOrders.length)
        initializeMemos(formattedOrders, 'customerId')
      } else {
        console.error('주문 목록 조회 실패:', response)
        setOrders([])
        setTotalCount(0)
        if (response && response.error) {
          console.error('API 오류:', response.error)
        }
      }
    } catch (error) {
      console.error('주문 목록 조회 오류:', error)
      setOrders([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // 날짜 범위 기본값 설정 제거 - 모든 데이터를 볼 수 있도록 함
  // 사용자가 원할 때만 날짜 필터를 적용할 수 있음

  // 주문 목록 로드 (필터 변경 시)
  // 초기 3개월 기본값 설정
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
    
    if (!dateRange.start && !dateRange.end) {
      setDateRange({
        start: formatDate(startDate),
        end: formatDate(today)
      })
      setSelectedPeriod('3개월')
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [currentPage, itemsPerPage, sortOrder, dateRange, searchKeyword, searchType])

  const handleDateQuickSelect = (period) => {
    setSelectedPeriod(period) // 선택된 기간 업데이트
    
    const today = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '오늘':
        // 오늘 날짜로 설정 (시작일과 종료일 모두 오늘)
        const todayStr = today.toISOString().split('T')[0]
        setDateRange({ start: todayStr, end: todayStr })
        // useEffect가 자동으로 loadOrders 호출
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
        // useEffect가 자동으로 loadOrders 호출
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
    // useEffect가 자동으로 loadOrders 호출
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadOrders()
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
    setSearchType('주문인')
    setSearchKeyword('')
    setCurrentPage(1)
  }

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedItems.length === orders.length && orders.length > 0 && 
        orders.every(order => selectedItems.includes(order.id))) {
      setSelectedItems([])
    } else {
      setSelectedItems(orders.map(order => order.id))
    }
  }

  const handleDocumentClick = (order) => {
    // 첨부 서류 관리 페이지로 이동, 주문 ID로 검색
    navigate(`/admin/document?searchType=주문 ID&searchKeyword=${encodeURIComponent(order.orderId)}`)
  }

  const handleMemoClick = (order) => {
    setSelectedOrder(order)
  }

  const handleMemoSave = (customerId, memoContent) => {
    addMemo(customerId, memoContent)
  }

  const handleMemoDelete = (customerId, memoId) => {
    deleteMemo(customerId, memoId)
  }

  const getLatestMemo = (order) => {
    const customerId = order.customerId
    if (!customerId) return null
    return getLatestMemoFromContext(customerId)
  }

  const truncateMemo = (memo) => {
    if (!memo || !memo.content) return ''
    return memo.content.length > 25 ? memo.content.substring(0, 25) + '...' : memo.content
  }

  const handleStatusClick = (order) => {
    setSelectedOrderForStatus(order)
    setStatusModalOpen(true)
  }

  const handleStatusChange = async (newStatus) => {
    if (selectedOrderForStatus) {
      try {
        const response = await orderAPI.updateOrderStatus(selectedOrderForStatus.id, newStatus)
        if (response.success) {
          // 주문 목록 다시 로드
          await loadOrders()
        } else {
          alert('주문 상태 변경 중 오류가 발생했습니다: ' + (response.error || '알 수 없는 오류'))
        }
      } catch (error) {
        console.error('주문 상태 변경 오류:', error)
        alert('주문 상태 변경 중 오류가 발생했습니다.')
      }
    }
    setStatusModalOpen(false)
    setSelectedOrderForStatus(null)
  }

  const handleCancelClick = (order) => {
    if (window.confirm('결제를 취소하시겠습니까?')) {
      setSelectedOrderForCancel(order)
      // 기본값으로 결제 금액 설정 (수정 가능)
      setCancelAmount(order.productPrice.toString())
      setCancelModalOpen(true)
    }
  }

  const handleCancelConfirm = () => {
    if (!cancelAmount || isNaN(cancelAmount) || Number(cancelAmount) <= 0) {
      alert('올바른 금액을 입력해주세요.')
      if (cancelAmountInputRef.current) {
        cancelAmountInputRef.current.focus()
      }
      return
    }
    
    // 결제 금액 초과 검증
    if (selectedOrderForCancel && Number(cancelAmount) > selectedOrderForCancel.productPrice) {
      alert('결제 취소 금액은 결제 금액을 초과할 수 없습니다.')
      if (cancelAmountInputRef.current) {
        cancelAmountInputRef.current.focus()
        cancelAmountInputRef.current.select()
      }
      return
    }
    
    if (selectedOrderForCancel) {
      // 결제 취소 로직 (실제로는 API 호출)
      const cancelDate = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, '')
      
      setOrders(prev => prev.map(order => 
        order.id === selectedOrderForCancel.id
          ? { 
              ...order, 
              status: '결제취소',
              cancelAmount: Number(cancelAmount),
              cancelDate: cancelDate
            }
          : order
      ))
    }
    setCancelModalOpen(false)
    setSelectedOrderForCancel(null)
    setCancelAmount('')
  }

  const handleCancelInfoClick = (order) => {
    setSelectedCanceledOrder(order)
    setCancelInfoModalOpen(true)
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원'
  }

  // 서버에서 이미 필터링/정렬/페이지네이션된 데이터를 받으므로 orders를 직접 사용
  const visibleOrders = orders
  const [totalCount, setTotalCount] = useState(0)
  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const statusOptions = ['결제완료', '신고진행중', '신고완료']

  return (
    <AdminLayout>
      <div className="admin-page">
        {/* Search Area */}
        <div className="admin-search-area">
          <div className="admin-search-row">
            {/* 주문결제일시 검색 */}
            <div className="admin-search-section admin-search-section-left">
              <label className="admin-search-label">주문결제일</label>
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
                  <option value="주문인">주문인</option>
                  <option value="주문 ID">주문 ID</option>
                  <option value="상품카테고리명">상품카테고리명</option>
                  <option value="상품명">상품명</option>
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
            <span className="admin-count-text">총 {totalCount}</span>
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
            <div className="admin-sort-order">
              <select
                className="admin-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="주문결제일시순">주문결제일시순</option>
                <option value="주문결제일시 역순">주문결제일시 역순</option>
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

        {/* Data Table */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="admin-table-checkbox"
                    checked={visibleOrders.length > 0 && visibleOrders.every(order => selectedItems.includes(order.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>주문결제일</th>
                <th>주문 ID</th>
                <th>주문인</th>
                <th>상품카테고리명</th>
                <th>상품명</th>
                <th>상품 가격</th>
                <th>첨부 서류</th>
                <th>메모</th>
                <th>상태</th>
                <th>결제 취소</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan="11" className="admin-table-empty">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => {
                  const latestMemo = getLatestMemo(order)
                  return (
                    <tr key={order.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="admin-table-checkbox"
                          checked={selectedItems.includes(order.id)}
                          onChange={() => handleSelectItem(order.id)}
                        />
                      </td>
                      <td data-label="주문결제일">{order.orderPaymentDate}</td>
                      <td data-label="주문 ID">{order.orderId}</td>
                      <td data-label="주문인">{order.customerName}</td>
                      <td data-label="상품카테고리명">{order.categoryName}</td>
                      <td data-label="상품명">{order.productName}</td>
                      <td data-label="상품 가격">{formatPrice(order.productPrice)}</td>
                      <td data-label="첨부 서류">
                        <button 
                          className="admin-table-btn"
                          onClick={() => handleDocumentClick(order)}
                        >
                          첨부 서류
                        </button>
                      </td>
                      <td data-label="메모">
                        {latestMemo ? (
                          <span 
                            className="admin-memo-text admin-memo-clickable"
                            onClick={() => handleMemoClick(order)}
                            style={{ cursor: 'pointer' }}
                          >
                            {truncateMemo(latestMemo)}
                          </span>
                        ) : (
                          <button 
                            className="admin-memo-btn"
                            onClick={() => handleMemoClick(order)}
                          >
                            메모
                          </button>
                        )}
                      </td>
                      <td data-label="상태">
                        <button 
                          className="admin-status-btn"
                          onClick={() => handleStatusClick(order)}
                        >
                          {order.status}
                        </button>
                      </td>
                      <td data-label="결제 취소">
                        {order.status === '결제취소' ? (
                          <button 
                            className="admin-table-btn"
                            onClick={() => handleCancelInfoClick(order)}
                          >
                            취소 완료
                          </button>
                        ) : (
                        <button 
                          className="admin-table-btn danger"
                          onClick={() => handleCancelClick(order)}
                        >
                          결제 취소
                        </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              className="admin-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              이전
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`admin-pagination-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              className="admin-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              다음
            </button>
          </div>
        )}

        {/* Status Change Modal */}
        {statusModalOpen && selectedOrderForStatus && (
          <div className="admin-modal-overlay" onClick={() => setStatusModalOpen(false)}>
            <div className="admin-status-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>상태 변경</h3>
                <button className="admin-modal-close" onClick={() => setStatusModalOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="admin-modal-content">
                <p>상태를 선택하세요:</p>
                <div className="admin-status-options">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      className={`admin-status-option-btn ${selectedOrderForStatus.status === status ? 'active' : ''}`}
                      onClick={() => handleStatusChange(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Cancel Modal */}
        {cancelModalOpen && selectedOrderForCancel && (
          <div className="admin-modal-overlay" onClick={() => setCancelModalOpen(false)}>
            <div className="admin-cancel-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>결제 취소</h3>
                <button className="admin-modal-close" onClick={() => setCancelModalOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="admin-modal-content">
                <div className="admin-cancel-info">
                  <p>결제 금액: <strong>{formatPrice(selectedOrderForCancel.productPrice)}</strong></p>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">결제 취소 원하는 금액</label>
                  <input
                    ref={cancelAmountInputRef}
                    type="number"
                    className="admin-form-input"
                    value={cancelAmount}
                    onChange={(e) => setCancelAmount(e.target.value)}
                    min="0"
                    max={selectedOrderForCancel.productPrice}
                  />
                </div>
                <div className="admin-modal-actions">
                  <button 
                    className="admin-modal-btn secondary"
                    onClick={() => setCancelModalOpen(false)}
                  >
                    닫기
                  </button>
                  <button 
                    className="admin-modal-btn primary"
                    onClick={handleCancelConfirm}
                  >
                    결제취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Info Modal */}
        {cancelInfoModalOpen && selectedCanceledOrder && (
          <div className="admin-modal-overlay" onClick={() => setCancelInfoModalOpen(false)}>
            <div className="admin-cancel-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>취소 완료 정보</h3>
                <button className="admin-modal-close" onClick={() => setCancelInfoModalOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="admin-modal-content">
                <div className="admin-cancel-info">
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ marginBottom: '0.5rem' }}>
                      <strong>취소 금액:</strong> {formatPrice(selectedCanceledOrder.cancelAmount || 0)}
                    </p>
                    <p>
                      <strong>취소 일시:</strong> {selectedCanceledOrder.cancelDate || '-'}
                    </p>
                  </div>
                </div>
                <div className="admin-modal-actions">
                  <button 
                    className="admin-modal-btn primary"
                    onClick={() => setCancelInfoModalOpen(false)}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Memo Modal */}
        {selectedOrder && (
          <MemoModal
            customer={{ id: selectedOrder.customerId, name: selectedOrder.customerName }}
            memos={customerMemos[selectedOrder.customerId] || []}
            onClose={() => setSelectedOrder(null)}
            onSave={handleMemoSave}
            onDelete={handleMemoDelete}
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
                  {/* 주문결제일 검색과 검색어 입력을 한 줄에 배치 */}
                  <div className="admin-search-row">
                    {/* 주문결제일 검색 */}
                    <div className="admin-search-section admin-search-section-left">
                      <label className="admin-search-label">주문결제일</label>
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
                          <option value="주문인">주문인</option>
                          <option value="주문 ID">주문 ID</option>
                          <option value="상품카테고리명">상품카테고리명</option>
                          <option value="상품명">상품명</option>
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
      </div>
    </AdminLayout>
  )
}

export default AdminOrderPayment