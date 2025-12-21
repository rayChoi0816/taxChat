import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './MemberTypeSelection.css'

const MemberTypeSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [openMoreMenuId, setOpenMoreMenuId] = useState(null) // 더보기 메뉴가 열린 카드 ID

  // 가입한 회원 유형 목록 (실제로는 API에서 가져올 데이터)
  const [memberTypes, setMemberTypes] = useState([
    {
      id: 1,
      name: '최민용',
      type: '비사업자',
      isActive: true
    },
    {
      id: 2,
      name: 'by ray',
      type: '개인 사업자',
      isActive: false
    }
  ])

  // 초기 선택값: 첫 번째 회원 유형 또는 활성화된 회원 유형
  const getInitialSelectedId = () => {
    const activeMemberType = memberTypes.find(mt => mt.isActive)
    return activeMemberType ? activeMemberType.id : (memberTypes.length > 0 ? memberTypes[0].id : null)
  }

  const [selectedMemberTypeId, setSelectedMemberTypeId] = useState(getInitialSelectedId())

  // 회원 유형 추가 후 목록 업데이트
  useEffect(() => {
    if (location.state?.addedTypes && Array.isArray(location.state.addedTypes)) {
      // 복수 개의 회원 유형 추가
      setMemberTypes(prevTypes => {
        let maxId = Math.max(...prevTypes.map(mt => mt.id), 0)
        const newMemberTypes = location.state.addedTypes.map((addedType, index) => ({
          id: maxId + index + 1,
          name: '새 회원', // 실제로는 사용자 입력 또는 기본값
          type: addedType,
          isActive: false
        }))
        return [...prevTypes, ...newMemberTypes]
      })
      // location.state 초기화
      window.history.replaceState({}, document.title)
    } else if (location.state?.addedType) {
      // 단일 회원 유형 추가 (하위 호환성)
      setMemberTypes(prevTypes => {
        const newId = Math.max(...prevTypes.map(mt => mt.id)) + 1
        const newMemberType = {
          id: newId,
          name: '새 회원', // 실제로는 사용자 입력 또는 기본값
          type: location.state.addedType,
          isActive: false
        }
        return [...prevTypes, newMemberType]
      })
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

  const handleViewDetails = (memberTypeId) => {
    setOpenMoreMenuId(null)
    alert(`회원 유형 ID: ${memberTypeId} 상세보기 페이지로 이동`)
    // navigate(`/member-type-detail/${memberTypeId}`)
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

  const handleComplete = () => {
    // 선택한 회원 유형으로 변경 처리
    const selectedMemberType = memberTypes.find(mt => mt.id === selectedMemberTypeId)
    if (selectedMemberType) {
      // 선택한 회원 유형 정보를 마이 페이지로 전달
      navigate('/mypage', {
        state: {
          selectedMemberType: {
            name: selectedMemberType.name,
            type: selectedMemberType.type
          }
        }
      })
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
          {/* 회원 유형 카드 목록 */}
          <div className="member-type-selection-cards">
            {memberTypes.map((memberType) => (
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
            ))}
          </div>

          {/* 회원 유형 추가 버튼 */}
          <button className="add-member-type-btn" onClick={handleAddMemberType}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            회원 유형
          </button>
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
      </div>
    </div>
  )
}

export default MemberTypeSelection

