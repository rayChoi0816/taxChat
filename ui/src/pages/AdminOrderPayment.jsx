import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import MemoModal from '../components/MemoModal'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import '../components/AdminLayout.css'
import './AdminOrderPayment.css'
import './AdminCustomer.css'

const AdminOrderPayment = () => {
  const navigate = useNavigate()
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('주문결제일시순')
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
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

  const [orders, setOrders] = useState([
    {
      id: 1,
      orderPaymentDate: getDateString(1),
      orderId: getOrderId(getDateString(1)),
      customerName: '홍길동',
      customerId: 1,
      categoryName: '인건비 신고',
      productName: '프리랜서 (4대 보험 신고 불필요)',
      productPrice: 50000,
      status: '결제완료',
      deleted: false
    },
    {
      id: 2,
      orderPaymentDate: getDateString(2),
      orderId: getOrderId(getDateString(2)),
      customerName: '장길산',
      customerId: 3,
      categoryName: '인건비 신고',
      productName: '아르바이트 (고용, 산재보험만 신고)',
      productPrice: 40000,
      status: '신고진행중',
      deleted: false
    },
    {
      id: 3,
      orderPaymentDate: getDateString(3),
      orderId: getOrderId(getDateString(3)),
      customerName: '임꺽정',
      customerId: 2,
      categoryName: '인건비 신고',
      productName: '상시근로자 (4대 보험 신고 필요)',
      productPrice: 30000,
      status: '신고완료',
      deleted: false
    }
  ])

  // 메모 초기화 및 날짜 범위 기본값 설정 (3개월)
  useEffect(() => {
    initializeMemos(orders, 'customerId')
    
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
    setCurrentPage(1)
  }

  const handleReset = () => {
    setDateRange({ start: '', end: '' })
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
    const visibleOrders = getFilteredOrders()
    const currentPageOrders = getPaginatedOrders(visibleOrders)
    
    if (selectedItems.length === currentPageOrders.length && 
        currentPageOrders.every(order => selectedItems.includes(order.id))) {
      setSelectedItems(prev => prev.filter(id => !currentPageOrders.some(order => order.id === id)))
    } else {
      const newSelected = [...new Set([...selectedItems, ...currentPageOrders.map(order => order.id)])]
      setSelectedItems(newSelected)
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

  const handleStatusChange = (newStatus) => {
    if (selectedOrderForStatus) {
      setOrders(prev => prev.map(order => 
        order.id === selectedOrderForStatus.id
          ? { ...order, status: newStatus }
          : order
      ))
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

  const getFilteredOrders = () => {
    return orders.filter(order => {
      if (order.deleted) return false
      
      // 날짜 필터
      if (dateRange.start && dateRange.end) {
        const orderDateStr = order.orderPaymentDate.split(' ')[0] // YYYY-MM-DD 형식
        const startDateStr = dateRange.start // YYYY-MM-DD 형식
        const endDateStr = dateRange.end // YYYY-MM-DD 형식
        
        // 날짜 문자열 직접 비교 (YYYY-MM-DD 형식이므로 문자열 비교 가능)
        if (orderDateStr < startDateStr || orderDateStr > endDateStr) return false
      }
      
      // 검색어 필터
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.trim().toLowerCase()
        switch (searchType) {
          case '주문인':
            if (!order.customerName.toLowerCase().includes(keyword)) return false
            break
          case '주문 ID':
            if (!order.orderId.toLowerCase().includes(keyword)) return false
            break
          case '상품카테고리명':
            if (!order.categoryName.toLowerCase().includes(keyword)) return false
            break
          case '상품명':
            if (!order.productName.toLowerCase().includes(keyword)) return false
            break
          default:
            break
        }
      }
      
      return true
    })
  }

  const getSortedOrders = (orderList) => {
    const sorted = [...orderList]
    sorted.sort((a, b) => {
      const dateA = new Date(a.orderPaymentDate.replace(/-/g, '/'))
      const dateB = new Date(b.orderPaymentDate.replace(/-/g, '/'))
      
      if (sortOrder === '주문결제일시순') {
        return dateA - dateB
      } else {
        return dateB - dateA
      }
    })
    return sorted
  }

  const getPaginatedOrders = (orderList) => {
    const sorted = getSortedOrders(orderList)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sorted.slice(startIndex, endIndex)
  }

  const filteredOrders = getFilteredOrders()
  const visibleOrders = getPaginatedOrders(filteredOrders)
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)

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
            <span className="admin-count-text">총 {filteredOrders.length}</span>
            <span className="admin-count-text">선택 {selectedItems.length} 건</span>
            <button className="admin-select-all-btn" onClick={handleSelectAll}>
              전체 선택
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
                      <td>{order.orderPaymentDate}</td>
                      <td>{order.orderId}</td>
                      <td>{order.customerName}</td>
                      <td>{order.categoryName}</td>
                      <td>{order.productName}</td>
                      <td>{formatPrice(order.productPrice)}</td>
                      <td>
                        <button 
                          className="admin-table-btn"
                          onClick={() => handleDocumentClick(order)}
                        >
                          첨부 서류
                        </button>
                      </td>
                      <td>
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
                      <td>
                        <button 
                          className="admin-status-btn"
                          onClick={() => handleStatusClick(order)}
                        >
                          {order.status}
                        </button>
                      </td>
                      <td>
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
      </div>
    </AdminLayout>
  )
}

export default AdminOrderPayment

