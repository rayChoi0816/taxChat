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
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)
  // 기본값: "등록일시 역순" = 최신순 (가장 최근에 가입한 회원이 맨 위에 오도록)
  const [sortOrder, setSortOrder] = useState('등록일시 역순')
  const [loading, setLoading] = useState(true)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
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

  // 회원 데이터
  const [customers, setCustomers] = useState([])
  const [totalCount, setTotalCount] = useState(0)

  // DB에서 회원 목록 로드
  const loadCustomers = async () => {
    try {
      setLoading(true)
      
      // 회원 유형 필터 (배열로 변환)
      const activeMemberTypes = Object.keys(memberTypes).filter(key => memberTypes[key])
      // 가입 방식 필터 (배열로 변환)
      const activeSignupMethods = Object.keys(signupMethods).filter(key => signupMethods[key])
      
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sortOrder: sortOrder
      }
      
      // 날짜 필터가 있을 때만 추가
      if (dateRange.start) {
        params.startDate = dateRange.start
      }
      if (dateRange.end) {
        params.endDate = dateRange.end
      }
      
      // 검색 필터가 있을 때만 추가
      if (searchKeyword) {
        params.searchType = searchType
        params.searchKeyword = searchKeyword
      }
      
      // 필터가 활성화된 경우에만 파라미터 추가
      if (activeMemberTypes.length > 0) {
        params.memberTypes = activeMemberTypes
      }
      if (activeSignupMethods.length > 0) {
        params.signupMethods = activeSignupMethods
      }

      const response = await memberAPI.getMembers(params)
      
      console.log('회원 목록 API 응답:', response) // 디버깅용
      
      // 에러 응답 확인
      if (response && response.error) {
        console.error('API 오류:', response.error, response.details)
        const errorDetails = response.details || response.stack || ''
        const errorMessage = `데이터를 불러오는 중 오류가 발생했습니다.\n\n${response.error}${errorDetails ? '\n\n상세: ' + errorDetails : ''}\n\n서버가 실행 중인지 확인해 주세요.`
        alert(errorMessage)
        setCustomers([])
        setTotalCount(0)
        return
      }
      
      if (response && response.success && response.data) {
        // response.data가 배열인지 확인
        const dataArray = Array.isArray(response.data) ? response.data : []
        
        if (dataArray.length === 0) {
          console.warn('회원 데이터가 비어있습니다. 응답:', response)
          // 데이터가 없을 때도 총 개수는 표시
          setTotalCount(response.pagination?.total || 0)
        }
        
        // API 응답을 프론트엔드 형식으로 변환
        const formattedCustomers = dataArray.map(member => {
          // 전화번호 포맷팅
          const phoneNumber = member.phone_number || ''
          const formattedPhone = phoneNumber.length === 11 
            ? `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`
            : phoneNumber

          // 주소 합치기
          const address = member.base_address 
            ? (member.detail_address ? `${member.base_address} ${member.detail_address}` : member.base_address)
            : ''

          // 서버가 "한 행 = (회원 × 한 회원 유형)" 단위로 펼쳐서 보내옵니다.
          //  - id        : "mt-12" / "m-7" 같은 행 고유 키 (selectedItems 등에 사용)
          //  - memberId  : members 테이블의 진짜 회원 id (수정/삭제/메모 시 사용)
          //  - memberType: 이 행이 보여주는 회원 유형 (비사업자/개인 사업자/법인 사업자)
          return {
            id: member.id,
            memberId: member.member_id ?? member.id,
            customerId: member.customer_id || '',
            memberType: member.member_type || '비사업자',
            signupMethod: member.signup_method || '회원 직접 가입',
            name: member.name || '',
            businessName: member.business_name || '',
            representativeName: member.representative_name || '',
            businessNumber: member.business_number || '',
            industry: member.industry || '',
            businessType: member.business_type || '',
            address: address,
            baseAddress: member.base_address || '',
            detailAddress: member.detail_address || '',
            startDate: member.start_date || '',
            contact: formattedPhone,
            phoneNumber: phoneNumber,
            gender: member.gender || '',
            residentNumber: member.resident_number || '',
            memo: '',
            hasInfoInput: member.has_info_input || false,
            registrationDate: member.created_at ? new Date(member.created_at).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, '') : '',
            deleted: member.deleted || false
          }
        })
        
        setCustomers(formattedCustomers)
        setTotalCount(response.pagination?.total || formattedCustomers.length)
      } else {
        console.error('회원 목록 조회 실패:', response)
        const errorMsg = response?.error || '데이터 형식이 올바르지 않습니다'
        alert(`데이터를 불러오는 중 오류가 발생했습니다:\n\n${errorMsg}`)
        setCustomers([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('회원 목록 조회 오류:', error)
      const errorMsg = error.message || '서버에 연결할 수 없습니다'
      alert(`데이터를 불러오는 중 오류가 발생했습니다:\n\n${errorMsg}\n\n서버가 실행 중인지 확인해주세요.`)
      setCustomers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // 날짜 범위 기본값 설정 제거 - 모든 데이터를 볼 수 있도록 함
  // 사용자가 원할 때만 날짜 필터를 적용할 수 있음

  // 초기 로드 및 필터 변경 시 회원 목록 다시 로드
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
    loadCustomers()
  }, [currentPage, itemsPerPage, sortOrder, dateRange.start, dateRange.end, searchKeyword, searchType, memberTypes, signupMethods])

  // 필터링된 회원 목록 계산 (서버에서 필터링하므로 클라이언트에서는 그대로 반환)
  const getFilteredCustomers = () => {
    return customers.filter(c => !c.deleted)
  }

  // 정렬된 회원 목록 (서버에서 정렬하므로 그대로 반환)
  const getSortedCustomers = (customerList) => {
    return customerList
  }

  // 페이지네이션된 회원 목록 (서버에서 페이지네이션하므로 그대로 반환)
  const getPaginatedCustomers = (customerList) => {
    return customerList
  }

  // 초기 메모 초기화 (회원 단위로 묶이도록 memberId 키 사용)
  useEffect(() => {
    if (customers && customers.length > 0 && initializeMemos) {
      initializeMemos(customers, 'memberId')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers])

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
    setSelectedPeriod(period) // 선택된 기간 업데이트
    
    const today = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '오늘':
        // 오늘 날짜로 설정 (시작일과 종료일 모두 오늘)
        const todayStr = today.toISOString().split('T')[0]
        setDateRange({ start: todayStr, end: todayStr })
        // useEffect가 자동으로 loadCustomers 호출
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
    // useEffect가 dateRange, searchKeyword, searchType 변경을 감지하여 자동으로 loadMembers 호출
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
    setCurrentPage(1)
  }

  const handleDelete = (customer) => {
    if (window.confirm('해당 회원을 삭제하시겠습니까? (DB는 유지되며 출력만 제외됩니다)')) {
      // 한 회원이 여러 유형으로 펼쳐져 있더라도 회원 자체를 숨김 처리합니다.
      const targetMemberId = customer.memberId
      setCustomers(prev => prev.map(c =>
        c.memberId === targetMemberId ? { ...c, deleted: true } : c
      ))
      // 서버에 회원 삭제 요청 (출력만 제외)
      memberAPI.deleteMember(targetMemberId).catch(err => {
        console.error('회원 삭제 오류:', err)
      })
    }
  }

  // 초기 메모 데이터 로드 (회원 단위)
  useEffect(() => {
    if (customers && customers.length > 0 && initializeMemos) {
      initializeMemos(customers, 'memberId')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getLatestMemo = (customer) => {
    return getLatestMemoFromContext(customer.memberId)
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

  const handleSaveMemo = (_customerId, memoContent) => {
    // 메모는 회원 단위로 저장하므로 항상 memberId 를 키로 사용합니다.
    const memberId = selectedCustomer?.memberId
    if (memberId == null) return
    addMemo(memberId, memoContent)
    // 모달 닫지 않고 유지 (사용자가 계속 메모를 추가할 수 있도록)
  }

  const handleDeleteMemo = (_customerId, memoId) => {
    const memberId = selectedCustomer?.memberId
    if (memberId == null) return
    deleteMemo(memberId, memoId)
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
      baseAddress: memberData.baseAddress,
      detailAddress: memberData.detailAddress,
      address: memberData.baseAddress && memberData.detailAddress
        ? `${memberData.baseAddress} ${memberData.detailAddress}`
        : (memberData.baseAddress || memberData.detailAddress || ''),
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

  const handleUpdateMember = async (memberData) => {
    try {
      // API 호출하여 회원 정보 수정
      const updateData = {
        memberType: memberData.memberType
      }

      // 비사업자 필드
      if (memberData.memberType === '비사업자') {
        if (memberData.name !== undefined) updateData.name = memberData.name
        if (memberData.gender !== undefined) updateData.gender = memberData.gender
        if (memberData.rrn !== undefined) updateData.residentNumber = memberData.rrn
      } else {
        // 사업자 필드
        if (memberData.businessName !== undefined) updateData.businessName = memberData.businessName
        if (memberData.representativeName !== undefined) updateData.representativeName = memberData.representativeName
        if (memberData.businessNumber !== undefined) updateData.businessNumber = memberData.businessNumber
        if (memberData.industry !== undefined) updateData.industry = memberData.industry
        if (memberData.businessType !== undefined) updateData.businessType = memberData.businessType
        if (memberData.startDate !== undefined) updateData.startDate = memberData.startDate
      }

      // 공통 필드
      if (memberData.baseAddress !== undefined) updateData.baseAddress = memberData.baseAddress
      if (memberData.detailAddress !== undefined) updateData.detailAddress = memberData.detailAddress
      if (memberData.phoneNumber !== undefined) updateData.phoneNumber = memberData.phoneNumber

      const response = await memberAPI.updateMember(memberData.id, updateData)

      if (response.success) {
        // 로컬 상태 업데이트
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
                baseAddress: memberData.baseAddress,
                detailAddress: memberData.detailAddress,
                address: memberData.baseAddress && memberData.detailAddress 
                  ? `${memberData.baseAddress} ${memberData.detailAddress}` 
                  : (memberData.baseAddress || memberData.detailAddress || ''),
                startDate: memberData.startDate,
                contact: memberData.phoneNumber || customer.contact,
                phoneNumber: memberData.phoneNumber || customer.phoneNumber
              }
            : customer
        ))
        alert('회원 정보가 수정되었습니다.')
        setInfoCustomer(null)
      } else {
        alert('회원 정보 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 정보 수정 오류:', error)
      alert('회원 정보 수정 중 오류가 발생했습니다.')
    }
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
                회원 등록
              </button>
            </div>
            <div className="admin-sort-order">
              <select
                className="admin-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="등록일시 역순">최신순 (등록일시 역순)</option>
                <option value="등록일시순">과거순 (등록일시순)</option>
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
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="admin-table-container">
          {(() => {
            const filtered = getFilteredCustomers()
            const visibleCustomers = getPaginatedCustomers(filtered)
            
            if (visibleCustomers.length === 0) {
              return (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="admin-table-checkbox"
                          checked={false}
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
                    <tr>
                      <td colSpan="10" className="admin-table-empty">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  </tbody>
                </table>
              )
            }
                
            return (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={visibleCustomers.every(c => selectedItems.includes(c.id))}
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
                  {visibleCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={selectedItems.includes(customer.id)}
                        onChange={() => handleSelectItem(customer.id)}
                      />
                    </td>
                    <td data-label="회원 유형">
                      <span>{customer.memberType}</span>
                    </td>
                    <td data-label="가입 방식">
                      <span>{customer.signupMethod}</span>
                    </td>
                    <td data-label="고객 ID">
                      <span>{customer.customerId}</span>
                    </td>
                    <td data-label="회원명">
                      <span>
                        {customer.memberType === '비사업자'
                          ? customer.name
                          : `${customer.businessName || ''} / ${customer.representativeName || ''}`}
                      </span>
                    </td>
                    <td data-label="연락처">
                      <span>{customer.contact}</span>
                    </td>
                    <td data-label="메모">
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
                    <td data-label="회원 정보 입력 여부">
                      <button 
                        className="admin-table-btn"
                        onClick={() => handleInfoInputClick(customer)}
                      >
                        {customer.hasInfoInput ? '입력완료' : '입력하기'}
                      </button>
                    </td>
                    <td data-label="기능">
                      <button 
                        className="admin-table-btn danger"
                        onClick={() => handleDelete(customer)}
                      >
                        삭제
                      </button>
                    </td>
                    <td>{formatDate(customer.registrationDate)}</td>
                  </tr>
                  ))}
            </tbody>
          </table>
            )
          })()}
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
          memos={customerMemos[String(selectedCustomer.memberId)] || []}
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
                {/* 등록일시 검색과 일반 검색을 한 줄에 배치 */}
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

export default AdminCustomer