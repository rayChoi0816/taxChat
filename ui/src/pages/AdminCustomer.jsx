import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import MemoModal from '../components/MemoModal'
import MemberRegistrationModal from '../components/MemberRegistrationModal'
import MemberInfoModal from '../components/MemberInfoModal'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import { memberAPI } from '../utils/api'
import '../components/AdminLayout.css'
import './AdminCustomer.css'

const AdminCustomer = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('등록일시순')
  const [loading, setLoading] = useState(true)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchType, setSearchType] = useState('회원명')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [memberTypes, setMemberTypes] = useState({
    비사업자: true,
    '개인 사업자': true,
    '법인 사업자': true
  })
  const [signupMethods, setSignupMethods] = useState({
    '회원 직접 가입': true,
    '관리자가 등록': true
  })

  // 메모 모달 상태
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const { customerMemos, addMemo, deleteMemo, getLatestMemo: getLatestMemoFromContext, initializeMemos } = useCustomerMemo()

  // 회원 등록 모달 상태
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false)
  const [registrationModalMemberType, setRegistrationModalMemberType] = useState('비사업자')

  // 회원 정보 조회 모달 상태
  const [infoCustomer, setInfoCustomer] = useState(null)

  // 고객 ID 생성 함수 (로컬)
  const generateCustomerId = (memberType) => {
    const typeCodeMap = {
      '비사업자': '01',
      '개인 사업자': '02',
      '법인 사업자': '03'
    }
    
    const typeCode = typeCodeMap[memberType] || '01'
    const now = new Date()
    const year = String(now.getFullYear()).slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    
    // 해당 날짜에 가입한 같은 유형의 회원 수 계산
    const todayCustomers = customers.filter(c => {
      if (c.deleted) return false
      const regDate = new Date(c.registrationDate)
      return regDate.toISOString().split('T')[0] === now.toISOString().split('T')[0] &&
             c.memberType === memberType
    })
    
    const sequence = todayCustomers.length + 1
    const sequenceStr = String(sequence).padStart(3, '0')
    const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
    
    return `${typeCode}${dateStr}${sequenceStr}${randomChar}`
  }

  // 회원 데이터 (로컬 상태로 관리)
  const [customers, setCustomers] = useState([
    {
      id: 1,
      customerId: '01251220001a',
      memberType: '비사업자',
      signupMethod: '회원 직접 가입',
      name: '홍길동',
      contact: '010-1234-5678',
      phoneNumber: '01012345678',
      memo: '최신 메모 내용입니다.',
      hasInfoInput: false,
      registrationDate: '2025-12-20 10:30:15',
      deleted: false
    },
    {
      id: 2,
      customerId: '02251230001b',
      memberType: '개인 사업자',
      signupMethod: '관리자가 등록',
      name: '임꺽정',
      businessName: '임꺽정 사업장',
      representativeName: '임꺽정',
      businessNumber: '123-45-67890',
      industry: '도매 및 소매업',
      businessType: '도매업',
      address: '서울특별시 강남구 테헤란로 123',
      startDate: '2020-01-01',
      contact: '010-2345-6789',
      phoneNumber: '01023456789',
      memo: '',
      hasInfoInput: true,
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    },
    {
      id: 3,
      customerId: '03251230002c',
      memberType: '법인 사업자',
      signupMethod: '관리자가 등록',
      name: '장길산',
      businessName: '장길산 법인',
      representativeName: '장길산',
      businessNumber: '987-65-43210',
      industry: '제조업',
      businessType: '제조업',
      address: '서울특별시 서초구 서초대로 456',
      startDate: '2019-06-15',
      contact: '010-3456-7890',
      phoneNumber: '01034567890',
      memo: '법인 사업자 메모',
      hasInfoInput: true,
      registrationDate: '2025-12-30 11:32:27',
      deleted: false
    }
  ])
  const [totalCount, setTotalCount] = useState(3)

  // 필터링된 회원 목록 계산
  const getFilteredCustomers = () => {
    let filtered = customers.filter(c => !c.deleted)

    // 날짜 필터
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(c => {
        const regDate = new Date(c.registrationDate.split(' ')[0])
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        return regDate >= start && regDate <= end
      })
    }

    // 검색어 필터
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase()
      filtered = filtered.filter(c => {
        if (searchType === '회원명') {
          return (c.name || '').toLowerCase().includes(keyword) ||
                 (c.businessName || '').toLowerCase().includes(keyword)
        } else if (searchType === '연락처') {
          return (c.contact || '').toLowerCase().includes(keyword) ||
                 (c.phoneNumber || '').toLowerCase().includes(keyword)
        }
        return true
      })
    }

    // 회원 유형 필터
    const selectedTypes = Object.keys(memberTypes).filter(k => memberTypes[k])
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(c => selectedTypes.includes(c.memberType))
    }

    // 가입 방식 필터
    const selectedMethods = Object.keys(signupMethods).filter(k => signupMethods[k])
    if (selectedMethods.length > 0) {
      filtered = filtered.filter(c => selectedMethods.includes(c.signupMethod))
    }

    return filtered
  }

  // 정렬된 회원 목록
  const getSortedCustomers = (customerList) => {
    const sorted = [...customerList]
    sorted.sort((a, b) => {
      const dateA = new Date(a.registrationDate)
      const dateB = new Date(b.registrationDate)
      return sortOrder === '등록일시 역순' ? dateB - dateA : dateA - dateB
    })
    return sorted
  }

  // 페이지네이션된 회원 목록
  const getPaginatedCustomers = (customerList) => {
    const sorted = getSortedCustomers(customerList)
    const startIndex = (currentPage - 1) * itemsPerPage
    return sorted.slice(startIndex, startIndex + itemsPerPage)
  }

  // 필터링 및 페이지네이션 적용
  useEffect(() => {
    const filtered = getFilteredCustomers()
    setTotalCount(filtered.length)
    setLoading(false)
  }, [customers, dateRange, searchKeyword, searchType, memberTypes, signupMethods, sortOrder, currentPage, itemsPerPage])

  // 초기 메모 초기화 및 날짜 범위 기본값 설정 (3개월)
  useEffect(() => {
    if (customers && customers.length > 0 && initializeMemos) {
      initializeMemos(customers, 'id')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectAll = () => {
    const filtered = getFilteredCustomers()
    const visibleCustomers = getPaginatedCustomers(filtered)
    const visibleIds = visibleCustomers.map(c => c.id)
    
    const allSelected = visibleIds.every(id => selectedItems.includes(id))
    
    if (allSelected) {
      // 현재 페이지의 선택 해제
      setSelectedItems(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      // 현재 페이지의 모든 항목 선택
      setSelectedItems(prev => [...new Set([...prev, ...visibleIds])])
    }
  }

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
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

  const handleMemberTypeChange = (type) => {
    setMemberTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  const handleSignupMethodChange = (method) => {
    setSignupMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }))
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setLoading(false)
  }

  const handleReset = () => {
    setDateRange({ start: '', end: '' })
    setSearchType('회원명')
    setSearchKeyword('')
    setMemberTypes({
      비사업자: true,
      '개인 사업자': true,
      '법인 사업자': true
    })
    setSignupMethods({
      '회원 직접 가입': true,
      '관리자가 등록': true
    })
  }

  const handleDelete = (id) => {
    if (window.confirm('해당 회원을 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      setCustomers(prev => prev.map(customer => 
        customer.id === id ? { ...customer, deleted: true } : customer
      ))
    }
  }

  // 초기 메모 데이터 로드
  useEffect(() => {
    if (customers && customers.length > 0 && initializeMemos) {
      initializeMemos(customers, 'id')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getLatestMemo = (customer) => {
    return getLatestMemoFromContext(customer.id)
  }

  const truncateMemo = (memo) => {
    if (!memo || !memo.content) return ''
    if (memo.content.length <= 20) return memo.content
    return memo.content.substring(0, 20) + '...'
  }

  const handleMemoClick = (customer) => {
    setSelectedCustomer(customer)
  }

  const handleCloseMemoModal = () => {
    setSelectedCustomer(null)
  }

  const handleSaveMemo = (customerId, memoContent) => {
    addMemo(customerId, memoContent)
    // 모달 닫지 않고 유지 (사용자가 계속 메모를 추가할 수 있도록)
  }

  const handleDeleteMemo = (customerId, memoId) => {
    deleteMemo(customerId, memoId)
  }

  const handleOpenRegistrationModal = () => {
    setIsRegistrationModalOpen(true)
  }

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false)
  }

  const handleSaveMember = (memberData) => {
    // 고객 ID 생성
    const customerId = generateCustomerId(memberData.memberType || '비사업자')
    
    // 새 회원 데이터 생성
    const newCustomer = {
      id: Date.now(), // 임시 ID
      customerId: customerId,
      memberType: memberData.memberType,
      signupMethod: '관리자가 등록',
      name: memberData.memberType === '비사업자' 
        ? (memberData.name || memberData.representativeName)
        : memberData.businessName,
      businessName: memberData.businessName,
      representativeName: memberData.representativeName,
      businessNumber: memberData.businessNumber,
      industry: memberData.industry,
      businessType: memberData.businessType,
      address: memberData.address,
      startDate: memberData.startDate,
      contact: memberData.phoneNumber?.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') || '',
      phoneNumber: memberData.phoneNumber?.replace(/[^\d]/g, '') || '',
      memo: '',
      hasInfoInput: true,
      registrationDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      deleted: false
    }
    
    // 회원 목록에 추가
    setCustomers(prev => [...prev, newCustomer])
    setIsRegistrationModalOpen(false)
  }

  const handleInfoInputClick = (customer) => {
    if (customer.hasInfoInput) {
      // 회원가입 입력 정보 모달 출력
      setInfoCustomer(customer)
    } else {
      // 입력하기: 해당 회원 유형에 맞는 회원 등록 모달 출력
      setRegistrationModalMemberType(customer.memberType || '비사업자')
      setIsRegistrationModalOpen(true)
    }
  }

  const handleCloseInfoModal = () => {
    setInfoCustomer(null)
  }

  const handleUpdateMember = (memberData) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === memberData.id 
        ? { 
            ...customer, 
            name: memberData.memberType === '비사업자' 
              ? (memberData.name || memberData.representativeName)
              : memberData.businessName,
            businessName: memberData.businessName,
            representativeName: memberData.representativeName,
            businessNumber: memberData.businessNumber,
            industry: memberData.industry,
            businessType: memberData.businessType,
            address: memberData.address,
            startDate: memberData.startDate
          }
        : customer
    ))
    setInfoCustomer(null)
  }

  const formatDate = (dateString) => {
    return dateString
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        {/* Search Area */}
        <div className="admin-search-area">
          {/* 등록일시 검색과 일반 검색을 한 줄에 배치 */}
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

            {/* 일반 검색 */}
            <div className="admin-search-section admin-search-section-right">
              <label className="admin-search-label">검색</label>
              <div className="admin-search-input-group">
                <select
                  className="admin-search-select"
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                >
                  <option value="회원명">회원명</option>
                  <option value="연락처">연락처</option>
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

          {/* 회원 유형과 가입 방식을 한 줄에 배치 */}
          <div className="admin-search-row">
            {/* 회원 유형 필터 */}
            <div className="admin-search-section admin-search-section-left">
              <label className="admin-search-label">회원 유형</label>
              <div className="admin-checkbox-group">
                {['비사업자', '개인 사업자', '법인 사업자'].map((type) => (
                  <label key={type} className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={memberTypes[type]}
                      onChange={() => handleMemberTypeChange(type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 가입 방식 필터 */}
            <div className="admin-search-section admin-search-section-right">
              <label className="admin-search-label">가입 방식</label>
              <div className="admin-checkbox-group">
                {['회원 직접 가입', '관리자가 등록'].map((method) => (
                  <label key={method} className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={signupMethods[method]}
                      onChange={() => handleSignupMethodChange(method)}
                    />
                    <span>{method}</span>
                  </label>
                ))}
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
          </div>
          <div className="admin-controls-right">
            <div className="admin-action-buttons">
              <button 
                className="admin-action-btn primary"
                onClick={handleOpenRegistrationModal}
              >
                회원 등록
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
                    checked={(() => {
                      const filtered = getFilteredCustomers()
                      const visibleCustomers = getPaginatedCustomers(filtered)
                      return visibleCustomers.length > 0 && 
                             visibleCustomers.every(c => selectedItems.includes(c.id))
                    })()}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>회원 유형</th>
                <th>가입 방식</th>
                <th>고객 ID</th>
                <th>회원명</th>
                <th>연락처</th>
                <th>메모</th>
                <th>회원 정보 입력 여부</th>
                <th>삭제</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = getFilteredCustomers()
                const visibleCustomers = getPaginatedCustomers(filtered)
                
                if (visibleCustomers.length === 0) {
                  return (
                <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
                  )
                }
                
                return visibleCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={selectedItems.includes(customer.id)}
                        onChange={() => handleSelectItem(customer.id)}
                      />
                    </td>
                    <td>{customer.memberType}</td>
                    <td>{customer.signupMethod}</td>
                    <td>{customer.customerId}</td>
                    <td>
                      {customer.memberType === '비사업자' 
                        ? customer.name
                        : `${customer.businessName || ''} / ${customer.representativeName || ''}`
                      }
                    </td>
                    <td>{customer.contact}</td>
                    <td>
                      {(() => {
                        const latestMemo = getLatestMemo(customer)
                        return latestMemo ? (
                          <div className="memo-cell">
                            <div className="memo-cell-content" onClick={() => handleMemoClick(customer)}>
                              {truncateMemo(latestMemo)}
                            </div>
                          </div>
                        ) : (
                          <button 
                            className="admin-table-btn"
                            onClick={() => handleMemoClick(customer)}
                          >
                            메모
                          </button>
                        )
                      })()}
                    </td>
                    <td>
                      <button 
                        className="admin-table-btn"
                        onClick={() => handleInfoInputClick(customer)}
                      >
                        {customer.hasInfoInput ? '입력완료' : '입력하기'}
                      </button>
                    </td>
                    <td>
                      <button 
                        className="admin-table-btn danger"
                        onClick={() => handleDelete(customer.id)}
                      >
                        삭제
                      </button>
                    </td>
                    <td>{formatDate(customer.registrationDate)}</td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(() => {
          const filtered = getFilteredCustomers()
          const totalPages = Math.ceil(filtered.length / itemsPerPage)
          
          if (totalPages <= 1) return null
          
          const pages = []
          const maxVisiblePages = 5
          let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
          let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
          
          if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1)
          }
          
          if (startPage > 1) {
            pages.push(
          <button
                key={1}
            className={`admin-pagination-page ${currentPage === 1 ? 'active' : ''}`}
            onClick={() => setCurrentPage(1)}
          >
            1
          </button>
            )
            if (startPage > 2) {
              pages.push(<span key="ellipsis1" className="admin-pagination-ellipsis">...</span>)
            }
          }
          
          for (let i = startPage; i <= endPage; i++) {
            pages.push(
          <button
                key={i}
                className={`admin-pagination-page ${currentPage === i ? 'active' : ''}`}
                onClick={() => setCurrentPage(i)}
          >
                {i}
          </button>
            )
          }
          
          if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
              pages.push(<span key="ellipsis2" className="admin-pagination-ellipsis">...</span>)
            }
            pages.push(
          <button
                key={totalPages}
                className={`admin-pagination-page ${currentPage === totalPages ? 'active' : ''}`}
                onClick={() => setCurrentPage(totalPages)}
          >
                {totalPages}
          </button>
            )
          }
          
          return (
            <div className="admin-pagination">
          <button
                className="admin-pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
                이전
          </button>
              {pages}
          <button
            className="admin-pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            다음
          </button>
        </div>
          )
        })()}
      </div>

      {/* Memo Modal */}
      {selectedCustomer && (
        <MemoModal
          customer={selectedCustomer}
          memos={customerMemos[selectedCustomer.id] || []}
          onClose={handleCloseMemoModal}
          onSave={handleSaveMemo}
          onDelete={handleDeleteMemo}
        />
      )}

      {/* Member Registration Modal */}
      {isRegistrationModalOpen && (
        <MemberRegistrationModal
          onClose={handleCloseRegistrationModal}
          onSave={handleSaveMember}
          initialMemberType={registrationModalMemberType}
        />
      )}

      {/* Member Info Modal */}
      {infoCustomer && (
        <MemberInfoModal
          customer={infoCustomer}
          onClose={handleCloseInfoModal}
          onUpdate={handleUpdateMember}
        />
      )}
    </AdminLayout>
  )
}

export default AdminCustomer
