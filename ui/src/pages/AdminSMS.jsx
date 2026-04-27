import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import MemoModal from '../components/MemoModal'
import SMSSendModal from '../components/SMSSendModal'
import SMSTemplateManagementModal from '../components/SMSTemplateManagementModal'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import { smsAPI, memberAPI, productAPI } from '../utils/api'
import '../components/AdminLayout.css'
import './AdminSMS.css'
import './AdminCustomer.css'

/** SMS 이력 테이블용 발송일시 (ISO → 읽기 쉬운 로컬 문자열) */
const formatSmsDateTime = (value) => {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${min}:${s}`
}

/** 수신인: 이름 + 휴대폰(하이픈) 한 줄로 */
const formatSmsRecipientFromRow = (sms) => {
  const name = (sms.recipient_name && String(sms.recipient_name).trim()) || ''
  const raw = sms.recipient_phone != null ? String(sms.recipient_phone) : ''
  const digits = raw.replace(/[^\d]/g, '')
  const phone =
    digits.length === 11
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : raw || digits
  if (name && phone) return `${name} · ${phone}`
  if (name) return name
  return phone || '—'
}

const AdminSMS = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('발송일시순')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPeriod, setSelectedPeriod] = useState('3개월') // 기본값 3개월
  const [recipient, setRecipient] = useState('')
  const [smsTypes, setSmsTypes] = useState({
    '결제 링크': true,
    '템플릿': true,
    '내용 작성': true,
    '상품 결제 링크': true
  })
  const [successStatus, setSuccessStatus] = useState({
    '성공': true,
    '실패': true
  })
  
  // 메모 모달 상태
  const [selectedSMS, setSelectedSMS] = useState(null)
  const { customerMemos, addMemo, deleteMemo, getLatestMemo: getLatestMemoFromContext, initializeMemos } = useCustomerMemo()
  
  // SMS 전송 모달 상태
  const [isSMSSendModalOpen, setIsSMSSendModalOpen] = useState(false)
  
  // SMS 템플릿 관리 모달 상태
  const [isTemplateManagementModalOpen, setIsTemplateManagementModalOpen] = useState(false)
  const [smsTemplates, setSmsTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [members, setMembers] = useState([])
  const [products, setProducts] = useState([])
  const [smsList, setSmsList] = useState([])

  // 데이터 로드
  useEffect(() => {
    loadSMSList()
    loadTemplates()
    loadMembers()
    loadProducts()
  }, [])

  // SMS 전송 모달을 열 때마다 회원·템플릿을 다시 불러 최신 가입자·템플릿 반영
  useEffect(() => {
    if (isSMSSendModalOpen) {
      loadMembers()
      loadTemplates()
    }
  }, [isSMSSendModalOpen])

  // 3개월 기본값 설정
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
      setSelectedPeriod('3개월') // 기본값 설정
    }
  }, [])

  // 날짜 범위, 검색 필터, 정렬 변경 시 SMS 목록 다시 로드
  useEffect(() => {
    loadSMSList()
  }, [dateRange.start, dateRange.end, recipient, smsTypes, successStatus, sortOrder, currentPage, itemsPerPage])

  // SMS 목록 로드
  const loadSMSList = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        startDate: dateRange.start,
        endDate: dateRange.end,
        sortOrder: sortOrder
      }
      
      // SMS 유형 필터
      const activeSmsTypes = Object.keys(smsTypes).filter(key => smsTypes[key])
      if (activeSmsTypes.length > 0) {
        params.smsType = activeSmsTypes
      }
      
      // 수신인 필터
      if (recipient) {
        params.recipient = recipient
      }
      
      // 성공 여부 필터
      const activeSuccessStatus = Object.keys(successStatus).filter(key => successStatus[key])
      if (activeSuccessStatus.length > 0) {
        params.successStatus = activeSuccessStatus
      }
      
      const response = await smsAPI.getMessages(params)
      
      console.log('SMS 목록 API 응답:', response) // 디버깅용
      
      if (response && response.success && response.data) {
        // API 응답을 프론트엔드 형식으로 변환
        const formattedSMS = (response.data || []).map((sms) => ({
          id: sms.id,
          sendDate: formatSmsDateTime(sms.sent_at),
          sentAt: sms.sent_at,
          recipient: formatSmsRecipientFromRow(sms),
          smsType: sms.sms_type,
          content: sms.content || '',
          success: sms.success_status === '성공',
          customerId: sms.member_id || null,
          deleted: false,
        }))
        setSmsList(formattedSMS)
        setTotalCount(response.pagination?.total || formattedSMS.length)
        initializeMemos(formattedSMS, 'customerId')
      } else {
        console.error('SMS 목록 조회 실패:', response)
        setSmsList([])
        setTotalCount(0)
        if (response && response.error) {
          console.error('API 오류:', response.error, response.details)
          const errorMessage = `SMS 목록을 불러오는 중 오류가 발생했습니다.\n\n${response.error}${response.details ? '\n\n상세: ' + response.details : ''}\n\n서버가 실행 중인지 확인해 주세요.`
          alert(errorMessage)
        }
      }
    } catch (error) {
      console.error('SMS 목록 로드 오류:', error)
      setSmsList([])
      setTotalCount(0)
      if (error.message && error.message.includes('서버에 연결할 수 없습니다')) {
        alert('백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:3001)')
      } else {
        alert('SMS 목록 로드 중 알 수 없는 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
      }
    } finally {
      setLoading(false)
    }
  }

  // 템플릿 로드
  const loadTemplates = async () => {
    try {
      const response = await smsAPI.getTemplates()
      if (response.success) {
        // API 응답의 usage_status를 usageStatus로 정규화
        const normalizedTemplates = response.data.map(template => ({
          ...template,
          usageStatus: template.usageStatus || template.usage_status || '미사용'
        }))
        setSmsTemplates(normalizedTemplates)
      }
    } catch (error) {
      console.error('템플릿 로드 오류:', error)
    }
  }

  // 회원 목록 로드
  const loadMembers = async () => {
    try {
      const response = await memberAPI.getMembers({ limit: 1000, page: 1 })
      if (response.success) {
        setMembers(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      console.error('회원 목록 로드 오류:', error)
    }
  }

  // 상품 목록 로드
  const loadProducts = async () => {
    try {
      const response = await productAPI.getProducts({ limit: 1000 })
      if (response.success) {
        setProducts(response.data)
      }
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
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
        // useEffect에서 자동으로 loadSMSList 호출하도록 해야 함
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
        // useEffect가 자동으로 loadSMSList 호출
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
    // useEffect가 자동으로 loadSMSList 호출
  }

  const handleSearch = async () => {
    setCurrentPage(1)
    await loadSMSList()
  }

  // SMS 전송 핸들러
  const handleSMSSend = async (smsData) => {
    try {
      const response = await smsAPI.sendSMS(smsData)
      if (response.data) {
        const row = response.data
        const newSMS = {
          id: row.id,
          sendDate: formatSmsDateTime(row.sent_at),
          sentAt: row.sent_at,
          recipient: formatSmsRecipientFromRow(row),
          smsType: row.sms_type,
          content: row.content || '',
          success: row.success_status === '성공',
          customerId: row.member_id || null,
          deleted: false,
        }
        setSmsList((prev) => [newSMS, ...prev])
        if (response.success) {
          alert(response.message || 'SMS가 발송되었습니다.')
        } else {
          alert(response.message || '뿌리오 발송에 실패했습니다. 이력에 실패로 저장되었습니다.')
        }
        setIsSMSSendModalOpen(false)
        loadSMSList()
      }
    } catch (error) {
      console.error('SMS 전송 오류:', error)
      alert(error.message || 'SMS 전송 중 오류가 발생했습니다.')
    }
  }

  const handleTemplatesChange = () => {
    loadTemplates()
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
    setRecipient('')
    setSmsTypes({
      '결제 링크': true,
      '템플릿': true,
      '내용 작성': true,
      '상품 결제 링크': true
    })
    setSuccessStatus({
      '성공': true,
      '실패': true
    })
    setCurrentPage(1)
    loadSMSList()
  }

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  // 백엔드에서 필터링, 정렬, 페이지네이션을 모두 처리하므로 클라이언트에서는 받은 데이터를 그대로 사용
  const visibleSMS = smsList.filter(sms => !sms.deleted)
  const totalPages = Math.ceil((totalCount || smsList.length) / itemsPerPage)

  const handleSelectAll = () => {
    // 백엔드에서 페이지네이션을 처리하므로 현재 페이지의 SMS만 처리
    const currentPageSMS = visibleSMS
    
    if (selectedItems.length === currentPageSMS.length && 
        currentPageSMS.length > 0 &&
        currentPageSMS.every(sms => selectedItems.includes(sms.id))) {
      // 모두 선택되어 있으면 모두 해제
      setSelectedItems(prev => prev.filter(id => !currentPageSMS.some(sms => sms.id === id)))
    } else {
      // 일부만 선택되어 있거나 선택되지 않았으면 모두 선택
      const newSelected = [...new Set([...selectedItems, ...currentPageSMS.map(sms => sms.id)])]
      setSelectedItems(newSelected)
    }
  }

  const handleDelete = (id) => {
    if (window.confirm('해당 SMS를 삭제하시겠습니까?')) {
      setSmsList(prev => prev.map(sms => 
        sms.id === id ? { ...sms, deleted: true } : sms
      ))
      setSelectedItems(prev => prev.filter(item => item !== id))
    }
  }

  const handleResend = async (sms) => {
    if (window.confirm('해당 SMS를 재발송하겠습니까?')) {
      try {
        const response = await smsAPI.resendSMS(sms.id)
        const row = response.data
        if (row) {
          const newSMS = {
            id: row.id,
            sendDate: formatSmsDateTime(row.sent_at),
            sentAt: row.sent_at,
            recipient: formatSmsRecipientFromRow(row),
            smsType: row.sms_type,
            content: row.content || '',
            success: row.success_status === '성공',
            customerId: row.member_id || null,
            deleted: false,
          }
          setSmsList((prev) => [newSMS, ...prev])
        }
        if (response.success) {
          alert(response.message || 'SMS가 재발송되었습니다.')
        } else {
          alert(response.message || '재발송에 실패했습니다. 이력에 실패로 저장되었습니다.')
        }
        loadSMSList()
      } catch (error) {
        console.error('SMS 재발송 오류:', error)
        alert('SMS 재발송 중 오류가 발생했습니다.')
      }
    }
  }

  const handleFailureClick = (sms) => {
    handleResend(sms)
  }

  const handleMemoClick = (sms) => {
    setSelectedSMS(sms)
  }

  const handleMemoSave = (customerId, memoContent) => {
    addMemo(customerId, memoContent)
  }

  const handleMemoDelete = (customerId, memoId) => {
    deleteMemo(customerId, memoId)
  }

  const getLatestMemo = (sms) => {
    const customerId = sms.customerId
    if (!customerId) return null
    return getLatestMemoFromContext(customerId)
  }

  const truncateMemo = (memo) => {
    if (!memo || !memo.content) return ''
    return memo.content.length > 25 ? memo.content.substring(0, 25) + '...' : memo.content
  }

  const getFilteredSMS = () => {
    return smsList.filter(sms => {
      if (sms.deleted) return false
      
      // 날짜 필터
      if (dateRange.start && dateRange.end) {
        const smsDateStr = sms.sendDate.split(' ')[0] // YYYY-MM-DD 형식
        const startDateStr = dateRange.start // YYYY-MM-DD 형식
        const endDateStr = dateRange.end // YYYY-MM-DD 형식
        
        // 날짜 문자열 직접 비교 (YYYY-MM-DD 형식이므로 문자열 비교 가능)
        if (smsDateStr < startDateStr || smsDateStr > endDateStr) return false
      }
      
      // 수신인 필터
      if (recipient.trim() && !sms.recipient.includes(recipient.trim())) {
        return false
      }
      
      // SMS 유형 필터
      if (!smsTypes[sms.smsType]) {
        return false
      }
      
      // 성공 여부 필터
      const successLabel = sms.success ? '성공' : '실패'
      if (!successStatus[successLabel]) {
        return false
      }
      
      return true
    })
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        {/* Search Area */}
        <div className="admin-search-area">
          <div className="admin-search-row">
            {/* 발송일시 검색 */}
            <div className="admin-search-section admin-search-section-left">
              <label className="admin-search-label">발송 일시</label>
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

            {/* 수신인 입력 */}
            <div className="admin-search-section admin-search-section-right">
              <label className="admin-search-label">수신인</label>
              <input
                type="text"
                className="admin-search-input admin-sms-recipient-input"
                placeholder="수신인 입력"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
          </div>

          {/* SMS 유형 및 성공 여부 체크박스 */}
          <div className="admin-search-row">
            <div className="admin-search-section admin-search-section-left">
              <label className="admin-search-label">SMS 유형</label>
              <div className="admin-checkbox-group">
                {Object.keys(smsTypes).map((type) => (
                  <label key={type} className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={smsTypes[type]}
                      onChange={(e) => setSmsTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-search-section admin-search-section-right">
              <label className="admin-search-label">성공 여부</label>
              <div className="admin-checkbox-group">
                {Object.keys(successStatus).map((status) => (
                  <label key={status} className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={successStatus[status]}
                      onChange={(e) => setSuccessStatus(prev => ({ ...prev, [status]: e.target.checked }))}
                    />
                    <span>{status}</span>
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
            <span className="admin-count-text">총 {totalCount || visibleSMS.length}</span>
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
                onClick={() => setIsTemplateManagementModalOpen(true)}
              >
                SMS 템플릿 관리
              </button>
              <button 
                className="admin-action-btn primary"
                onClick={() => setIsSMSSendModalOpen(true)}
              >
                SMS 전송
              </button>
            </div>
            <div className="admin-sort-order">
              <select
                className="admin-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="발송일시순">발송일시순</option>
                <option value="발송일시 역순">발송일시 역순</option>
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

        {/* Data Table — SMS 발신 결과 내역 */}
        <div className="admin-table-container admin-sms-table-container">
          <table className="admin-table admin-sms-table">
            <thead>
              <tr>
                <th className="admin-sms-th admin-sms-th--check" scope="col">
                  <input
                    type="checkbox"
                    className="admin-table-checkbox"
                    title="전체 선택"
                    checked={visibleSMS.length > 0 && visibleSMS.every(sms => selectedItems.includes(sms.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="admin-sms-th admin-sms-th--date" scope="col">발송일시</th>
                <th className="admin-sms-th admin-sms-th--recipient" scope="col">수신인</th>
                <th className="admin-sms-th admin-sms-th--type" scope="col">SMS 유형</th>
                <th className="admin-sms-th admin-sms-th--content" scope="col">SMS 내용</th>
                <th className="admin-sms-th admin-sms-th--result" scope="col">발신 결과</th>
                <th className="admin-sms-th admin-sms-th--memo" scope="col">메모</th>
                <th className="admin-sms-th admin-sms-th--action" scope="col">재발송</th>
              </tr>
            </thead>
            <tbody>
              {visibleSMS.length === 0 ? (
                <tr>
                  <td colSpan="8" className="admin-table-empty">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                visibleSMS.map((sms) => {
                  const latestMemo = getLatestMemo(sms)
                  return (
                    <tr key={sms.id} className="admin-sms-tr">
                      <td className="admin-sms-td admin-sms-td--check" data-label="선택">
                        <input
                          type="checkbox"
                          className="admin-table-checkbox"
                          checked={selectedItems.includes(sms.id)}
                          onChange={() => handleSelectItem(sms.id)}
                        />
                      </td>
                      <td className="admin-sms-td admin-sms-td--date" data-label="발송일시">
                        <span className="admin-sms-cell-date">{sms.sendDate}</span>
                      </td>
                      <td className="admin-sms-td admin-sms-td--recipient" data-label="수신인">
                        <span className="admin-sms-cell-recipient">{sms.recipient}</span>
                      </td>
                      <td className="admin-sms-td admin-sms-td--type" data-label="SMS 유형">
                        <span className="admin-sms-cell-type">{sms.smsType}</span>
                      </td>
                      <td className="admin-sms-td admin-sms-td--content" data-label="SMS 내용">
                        <div className="admin-sms-content-cell" title={sms.content || ''}>
                          {sms.content || '—'}
                        </div>
                      </td>
                      <td className="admin-sms-td admin-sms-td--result" data-label="발신 결과">
                        {sms.success ? (
                          <span className="admin-sms-result-pill admin-sms-result-pill--ok">성공</span>
                        ) : (
                          <button
                            type="button"
                            className="admin-sms-result-pill admin-sms-result-pill--fail"
                            onClick={() => handleFailureClick(sms)}
                          >
                            실패
                          </button>
                        )}
                      </td>
                      <td className="admin-sms-td admin-sms-td--memo" data-label="메모">
                        {latestMemo ? (
                          <span
                            className="admin-memo-text admin-memo-clickable"
                            onClick={() => handleMemoClick(sms)}
                            style={{ cursor: 'pointer' }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleMemoClick(sms)}
                          >
                            {truncateMemo(latestMemo)}
                          </span>
                        ) : (
                          <button
                            className="admin-memo-btn"
                            type="button"
                            onClick={() => handleMemoClick(sms)}
                          >
                            메모
                          </button>
                        )}
                      </td>
                      <td className="admin-sms-td admin-sms-td--action" data-label="재발송">
                        <button
                          type="button"
                          className="admin-table-btn"
                          onClick={() => handleResend(sms)}
                        >
                          재발송
                        </button>
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

        {/* Memo Modal */}
        {selectedSMS && (
          <MemoModal
            customer={{ ...selectedSMS, id: selectedSMS.customerId }}
            memos={customerMemos[selectedSMS.customerId] || []}
            onClose={() => setSelectedSMS(null)}
            onSave={handleMemoSave}
            onDelete={handleMemoDelete}
          />
        )}
        
        {/* SMS 전송 모달 */}
        {isSMSSendModalOpen && (
          <SMSSendModal
            onClose={() => setIsSMSSendModalOpen(false)}
            onSend={handleSMSSend}
            templates={smsTemplates.filter(t => (t.usageStatus || t.usage_status) === '사용')}
            members={members}
            products={products}
          />
        )}
        
        {/* SMS 템플릿 관리 모달 */}
        {isTemplateManagementModalOpen && (
          <SMSTemplateManagementModal
            onClose={() => {
              setIsTemplateManagementModalOpen(false)
              loadTemplates()
            }}
            templates={smsTemplates}
            onTemplatesChange={handleTemplatesChange}
            reloadTemplates={loadTemplates}
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
                  <div className="admin-search-row">
                    {/* 발송일시 검색 */}
                    <div className="admin-search-section admin-search-section-left">
                      <label className="admin-search-label">발송 일시</label>
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

                    {/* 수신인 입력 */}
                    <div className="admin-search-section admin-search-section-right">
                      <label className="admin-search-label">수신인</label>
                      <input
                        type="text"
                        className="admin-search-input admin-sms-recipient-input"
                        placeholder="수신인 입력"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* SMS 유형 및 성공 여부 체크박스 */}
                  <div className="admin-search-row">
                    <div className="admin-search-section admin-search-section-left">
                      <label className="admin-search-label">SMS 유형</label>
                      <div className="admin-checkbox-group">
                        {Object.keys(smsTypes).map((type) => (
                          <label key={type} className="admin-checkbox-label">
                            <input
                              type="checkbox"
                              checked={smsTypes[type]}
                              onChange={(e) => setSmsTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                            />
                            <span>{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="admin-search-section admin-search-section-right">
                      <label className="admin-search-label">성공 여부</label>
                      <div className="admin-checkbox-group">
                        {Object.keys(successStatus).map((status) => (
                          <label key={status} className="admin-checkbox-label">
                            <input
                              type="checkbox"
                              checked={successStatus[status]}
                              onChange={(e) => setSuccessStatus(prev => ({ ...prev, [status]: e.target.checked }))}
                            />
                            <span>{status}</span>
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
      </div>
    </AdminLayout>
  )
}

export default AdminSMS