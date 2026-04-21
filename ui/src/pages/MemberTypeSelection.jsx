import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './MemberTypeSelection.css'
import { useAuth } from '../contexts/AuthContext'
import { memberAPI } from '../utils/api'
import MemberInfoModal from '../components/MemberInfoModal'

const MemberTypeSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, updateUser } = useAuth()
  const [openMoreMenuId, setOpenMoreMenuId] = useState(null) // 더보기 메뉴가 열린 카드 ID
  const [loading, setLoading] = useState(true)
  const [detailModalOpen, setDetailModalOpen] = useState(false) // 상세보기 모달 상태
  const [selectedMemberTypeForDetail, setSelectedMemberTypeForDetail] = useState(null) // 상세보기할 회원 유형

  // 가입한 회원 유형 목록
  const [memberTypes, setMemberTypes] = useState([])

  // 초기 선택값: 첫 번째 회원 유형 또는 활성화된 회원 유형
  const getInitialSelectedId = () => {
    const activeMemberType = memberTypes.find(mt => mt.isActive)
    return activeMemberType ? activeMemberType.id : (memberTypes.length > 0 ? memberTypes[0].id : null)
  }

  const [selectedMemberTypeId, setSelectedMemberTypeId] = useState(null)

  // 회원 유형 목록 로드
  const loadMemberTypes = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await memberAPI.getMemberTypes(user.id)
      
      if (response.success && response.data) {
        const formattedTypes = response.data.map((mt, index) => ({
          id: mt.id || index + 1,
          name: mt.name || '회원',
          type: mt.type,
          isActive: mt.isActive || false,
          customerId: mt.customerId
        }))
        setMemberTypes(formattedTypes)
        
        // 초기 선택값 설정
        const activeMemberType = formattedTypes.find(mt => mt.isActive)
        if (activeMemberType) {
          setSelectedMemberTypeId(activeMemberType.id)
        } else if (formattedTypes.length > 0) {
          setSelectedMemberTypeId(formattedTypes[0].id)
        }
      }
    } catch (error) {
      console.error('회원 유형 목록 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 초기 로드
  useEffect(() => {
    loadMemberTypes()
  }, [user])

  // 회원 유형 추가 후 목록 새로고침
  useEffect(() => {
    if (location.state?.addedTypes || location.state?.addedType) {
      // 회원 유형 추가 후 목록 새로고침
      loadMemberTypes()
      // location.state 초기화
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // 마이 페이지에서 전달받은 현재 회원 유형 정보로 초기 선택값 업데이트
  useEffect(() => {
    if (location.state?.currentMemberType) {
      const { type, name } = location.state.currentMemberType
      const foundMemberType = memberTypes.find(mt => mt.type === type && mt.name === name)
      if (foundMemberType) {
        setSelectedMemberTypeId(foundMemberType.id)
      }
      // location.state 초기화
      window.history.replaceState({}, document.title)
    }
  }, [location.state, memberTypes])

  const handleRadioClick = (memberTypeId) => {
    setSelectedMemberTypeId(memberTypeId)
  }

  const handleMoreClick = (e, memberTypeId) => {
    e.stopPropagation() // 카드 클릭 이벤트 전파 방지
    setOpenMoreMenuId(openMoreMenuId === memberTypeId ? null : memberTypeId)
  }

  const handleViewDetails = async (memberTypeId) => {
    setOpenMoreMenuId(null)
    
    // 선택한 회원 유형 정보 찾기
    const memberType = memberTypes.find(mt => mt.id === memberTypeId)
    if (!memberType) {
      alert('회원 정보를 찾을 수 없습니다.')
      return
    }

    // 회원 상세 정보 조회
    try {
      const response = await memberAPI.getMember(memberType.id)
      if (response.success && response.data) {
        const memberData = response.data
        
        // 주민등록번호 분리
        let rrnFront = ''
        let rrnBack = ''
        if (memberData.resident_number) {
          const rrnParts = memberData.resident_number.split('-')
          rrnFront = rrnParts[0] || ''
          rrnBack = rrnParts[1] || ''
        }
        
        setSelectedMemberTypeForDetail({
          id: memberData.id,
          memberType: memberType.type,
          memberTypeLabel: memberType.type,
          name: memberType.type === '비사업자' ? memberData.name : memberData.business_name,
          businessName: memberData.business_name,
          representativeName: memberData.representative_name,
          businessNumber: memberData.business_number,
          industry: memberData.industry,
          businessType: memberData.business_type,
          baseAddress: memberData.base_address || '',
          detailAddress: memberData.detail_address || '',
          address: memberData.base_address && memberData.detail_address
            ? `${memberData.base_address} ${memberData.detail_address}`
            : (memberData.base_address || memberData.detail_address || ''),
          startDate: memberData.start_date ? (typeof memberData.start_date === 'string' ? memberData.start_date.split('T')[0] : memberData.start_date) : '',
          gender: memberData.gender,
          rrn: memberData.resident_number,
          contact: memberData.phone_number,
          phoneNumber: memberData.phone_number
        })
        setDetailModalOpen(true)
      } else {
        alert('회원 정보를 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('회원 정보 조회 오류:', error)
      alert('회원 정보를 불러올 수 없습니다.')
    }
  }

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false)
    setSelectedMemberTypeForDetail(null)
  }

  const handleUpdateMember = async (updatedData) => {
    try {
      // updatedData에 id가 포함되어 있음
      const response = await memberAPI.updateMember(updatedData.id, updatedData)
      if (response.success) {
        alert('회원 정보가 수정되었습니다.')
        await loadMemberTypes() // 목록 새로고침
        handleCloseDetailModal()
      } else {
        alert('회원 정보 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 정보 수정 오류:', error)
      alert('회원 정보 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = (memberTypeId) => {
    setOpenMoreMenuId(null)
    if (window.confirm('해당 회원 유형을 삭제하시겠습니까?')) {
      setMemberTypes(memberTypes.filter(mt => mt.id !== memberTypeId))
      if (selectedMemberTypeId === memberTypeId && memberTypes.length > 1) {
        // 삭제된 회원 유형이 선택되어 있었다면 첫 번째로 변경
        setSelectedMemberTypeId(memberTypes[0].id === memberTypeId ? memberTypes[1].id : memberTypes[0].id)
      }
    }
  }

  const handleAddMemberType = () => {
    // 현재 가입한 회원 유형 목록 전달
    const existingTypes = memberTypes.map(mt => mt.type)
    navigate('/add-member-type', {
      state: { existingTypes }
    })
  }

  const handleComplete = async () => {
    // 선택한 회원 유형으로 변경 처리
    const selectedMemberType = memberTypes.find(mt => mt.id === selectedMemberTypeId)
    if (!selectedMemberType || !user?.id) {
      alert('회원 정보를 찾을 수 없습니다.')
      return
    }

    try {
      // API를 호출하여 회원 유형 업데이트
      const response = await memberAPI.updateMember(user.id, {
        memberType: selectedMemberType.type
      })

      if (response.success) {
        // AuthContext의 user 정보 업데이트
        updateUser({
          member_type: selectedMemberType.type,
          memberType: selectedMemberType.type
        })
        
        // 마이 페이지로 이동
        navigate('/mypage', {
          state: {
            selectedMemberType: {
              name: selectedMemberType.name,
              type: selectedMemberType.type
            }
          }
        })
        alert('회원 유형이 변경되었습니다.')
      } else {
        alert('회원 유형 변경 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 유형 변경 오류:', error)
      alert('회원 유형 변경 중 오류가 발생했습니다.')
    }
  }

  const handleBackdropClick = () => {
    setOpenMoreMenuId(null)
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/mypage')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">회원 유형 선택</h1>
        </header>

        {/* Content */}
        <div className="member-type-selection-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
          ) : (
            <>
              {/* 회원 유형 카드 목록 */}
              <div className="member-type-selection-cards">
                {memberTypes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>등록된 회원 유형이 없습니다.</div>
                ) : (
                  memberTypes.map((memberType) => (
                    <div
                      key={memberType.id}
                      className={`member-type-selection-card ${selectedMemberTypeId === memberType.id ? 'selected' : ''}`}
                      onClick={() => handleRadioClick(memberType.id)}
                    >
                      {/* 회원 정보 */}
                      <div className="member-info">
                        <div className="member-name">{memberType.name}</div>
                        <button className="member-type-label">{memberType.type}</button>
                      </div>

                      {/* 더보기 버튼 */}
                      <div className="more-button-wrapper">
                        <button
                          className="more-button"
                          onClick={(e) => handleMoreClick(e, memberType.id)}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                          </svg>
                        </button>

                        {/* 더보기 모달 */}
                        {openMoreMenuId === memberType.id && (
                          <div className="more-menu-modal">
                            <button
                              className="more-menu-item"
                              onClick={() => handleViewDetails(memberType.id)}
                            >
                              상세보기
                            </button>
                            <button
                              className="more-menu-item delete"
                              onClick={() => handleDelete(memberType.id)}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 회원 유형 추가 버튼 */}
              <button className="add-member-type-btn" onClick={handleAddMemberType}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                회원 유형
              </button>
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="form-footer">
          <button className="complete-btn" onClick={handleComplete}>
            선택 완료
          </button>
        </div>

        {/* 백드롭 (더보기 메뉴가 열려있을 때) */}
        {openMoreMenuId && (
          <div className="backdrop" onClick={handleBackdropClick}></div>
        )}

        {/* 회원 상세 정보 모달 */}
        {detailModalOpen && selectedMemberTypeForDetail && (
          <MemberInfoModal
            customer={selectedMemberTypeForDetail}
            onClose={handleCloseDetailModal}
            onUpdate={handleUpdateMember}
          />
        )}
      </div>
    </div>
  )
}

export default MemberTypeSelection

