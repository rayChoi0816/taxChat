import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import MemoModal from '../components/MemoModal'
import SMSSendModal from '../components/SMSSendModal'
import SMSTemplateManagementModal from '../components/SMSTemplateManagementModal'
import { useCustomerMemo } from '../contexts/CustomerMemoContext'
import '../components/AdminLayout.css'
import './AdminSMS.css'
import './AdminCustomer.css'

const AdminSMS = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('발송일시순')
  
  // 검색 필터 상태
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
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
  const [smsTemplates, setSmsTemplates] = useState([
    { id: 1, name: '템플릿 1', content: '안녕하세요. 세무회계 오월입니다.', usageStatus: '미사용' },
    { id: 2, name: '템플릿 2', content: '결제가 완료되었습니다.', usageStatus: '미사용' },
    { id: 3, name: '템플릿 3', content: '신고가 완료되었습니다.', usageStatus: '미사용' }
  ])

  // 예시 데이터 날짜를 현재 날짜 기준으로 설정
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

  const [smsList, setSmsList] = useState([
    {
      id: 1,
      sendDate: getDateString(1),
      recipient: '홍길동',
      smsType: '결제 링크',
      content: '결제 링크가 발송되었습니다.',
      success: true,
      memo: [
        { id: 1, content: '첫 번째 메모입니다.', createdAt: getDateString(1) },
        { id: 2, content: '두 번째 메모입니다.', createdAt: getDateString(1) }
      ],
      deleted: false,
      customerId: 1
    },
    {
      id: 2,
      sendDate: getDateString(4),
      recipient: '암꺽정',
      smsType: '템플릿',
      content: '템플릿 메시지입니다.',
      success: false,
      memo: [],
      deleted: false,
      customerId: 2
    },
    {
      id: 3,
      sendDate: getDateString(5),
      recipient: '장길산',
      smsType: '내용 작성',
      content: '직접 작성한 메시지입니다.',
      success: true,
      memo: [
        { id: 3, content: '세 번째 메모입니다.', createdAt: getDateString(5) }
      ],
      deleted: false,
      customerId: 3
    }
  ])

  // 메모 초기화 및 날짜 범위 기본값 설정 (3개월)
  useEffect(() => {
    initializeMemos(smsList, 'customerId')
    
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
        startDate = null
        break
    }

    if (period === '전체') {
      setDateRange({ start: '', end: '' })
    } else if (period === '오늘') {
      const todayStr = today.toISOString().split('T')[0]
      setDateRange({ start: todayStr, end: todayStr })
    } else {
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = today.toISOString().split('T')[0]
      setDateRange({ start: startStr, end: endStr })
    }
  }

  const handleSearch = () => {
    // 검색 로직 (필터링은 filteredSMSList에서 처리)
    setCurrentPage(1)
  }

  const handleReset = () => {
    setDateRange({ start: '', end: '' })
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
  }

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    const visibleSMS = getFilteredSMS()
    const currentPageSMS = getPaginatedSMS(visibleSMS)
    
    if (selectedItems.length === currentPageSMS.length && 
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

  const handleResend = (sms) => {
    if (window.confirm('해당 SMS를 재발송하겠습니까?')) {
      // 재발송 로직 (실제로는 API 호출)
      // 성공 여부를 다시 확인하여 업데이트
      const success = Math.random() > 0.3 // 70% 성공률로 시뮬레이션
      
      setSmsList(prev => prev.map(item => 
        item.id === sms.id 
          ? { ...item, success, sendDate: new Date().toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, '') }
          : item
      ))
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

  const getSortedSMS = (smsList) => {
    const sorted = [...smsList]
    sorted.sort((a, b) => {
      const dateA = new Date(a.sendDate.replace(/-/g, '/'))
      const dateB = new Date(b.sendDate.replace(/-/g, '/'))
      
      if (sortOrder === '발송일시순') {
        return dateA - dateB
      } else {
        return dateB - dateA
      }
    })
    return sorted
  }

  const getPaginatedSMS = (smsList) => {
    const sorted = getSortedSMS(smsList)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sorted.slice(startIndex, endIndex)
  }

  const filteredSMS = getFilteredSMS()
  const visibleSMS = getPaginatedSMS(filteredSMS)
  const totalPages = Math.ceil(filteredSMS.length / itemsPerPage)

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
            <span className="admin-count-text">총 {filteredSMS.length}</span>
            <span className="admin-count-text">선택 {selectedItems.length} 건</span>
            <button className="admin-select-all-btn" onClick={handleSelectAll}>
              전체 선택
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

        {/* Data Table */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="admin-table-checkbox"
                    checked={visibleSMS.length > 0 && visibleSMS.every(sms => selectedItems.includes(sms.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>발송일시</th>
                <th>수신인</th>
                <th>SMS 유형</th>
                <th>SMS 내용</th>
                <th>성공 여부</th>
                <th>메모</th>
                <th>재발송</th>
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
                    <tr key={sms.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="admin-table-checkbox"
                          checked={selectedItems.includes(sms.id)}
                          onChange={() => handleSelectItem(sms.id)}
                        />
                      </td>
                      <td>{sms.sendDate}</td>
                      <td>{sms.recipient}</td>
                      <td>{sms.smsType}</td>
                      <td>{sms.content}</td>
                      <td>
                        {sms.success ? (
                          <span className="admin-success-label">성공</span>
                        ) : (
                          <button 
                            className="admin-failure-btn"
                            onClick={() => handleFailureClick(sms)}
                          >
                            실패
                          </button>
                        )}
                      </td>
                      <td>
                        {latestMemo ? (
                          <span 
                            className="admin-memo-text admin-memo-clickable"
                            onClick={() => handleMemoClick(sms)}
                            style={{ cursor: 'pointer' }}
                          >
                            {truncateMemo(latestMemo)}
                          </span>
                        ) : (
                          <button 
                            className="admin-memo-btn"
                            onClick={() => handleMemoClick(sms)}
                          >
                            메모
                          </button>
                        )}
                      </td>
                      <td>
                        <button 
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
            onSend={(smsData) => {
              // SMS 발송 처리 로직
              const recipientName = smsData.recipientType === 'load' 
                ? smsData.recipient.name 
                : smsData.recipient.phoneNumber
              
              const newSMS = {
                id: Date.now(),
                sendDate: new Date().toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, ''),
                recipient: recipientName,
                smsType: smsData.smsType,
                content: smsData.content,
                success: Math.random() > 0.3, // 70% 성공률로 시뮬레이션
                memo: [],
                deleted: false,
                customerId: smsData.recipientType === 'load' && smsData.recipient.id ? smsData.recipient.id : null
              }
              
              // SMS 목록에 추가
              setSmsList(prev => [newSMS, ...prev])
              
              alert('SMS가 발송되었습니다.')
              setIsSMSSendModalOpen(false)
            }}
            templates={smsTemplates.filter(t => t.usageStatus === '사용')}
          />
        )}
        
        {/* SMS 템플릿 관리 모달 */}
        {isTemplateManagementModalOpen && (
          <SMSTemplateManagementModal
            onClose={() => setIsTemplateManagementModalOpen(false)}
            templates={smsTemplates}
            onTemplatesChange={(updatedTemplates) => {
              setSmsTemplates(updatedTemplates)
            }}
          />
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminSMS

