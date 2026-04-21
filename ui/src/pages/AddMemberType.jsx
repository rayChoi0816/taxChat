import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './AddMemberType.css'

const AddMemberType = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedTypes, setSelectedTypes] = useState([]) // 복수 선택 가능

  // 현재 가입한 회원 유형 목록 (실제로는 location.state나 API에서 가져올 데이터)
  const existingMemberTypes = location.state?.existingTypes || ['비사업자', '개인 사업자']

  // 모든 회원 유형 정의
  const allMemberTypes = [
    {
      code: '비사업자',
      title: '비사업자',
      description: '사업을 하지 않는 일반 개인은 근로소득세, 종합소득세, 양도세 등 소득·자산 거래에서 발생하는 세금을 납부합니다. 부동산·자동차를 사면 취득세, 보유하면 재산세가 발생합니다.'
    },
    {
      code: '개인 사업자',
      title: '개인 사업자',
      description: '개인사업자는 매출이 생기면 부가세와 종합소득세를 기본적으로 신고·납부해야 합니다. 직원·프리랜서에게 비용을 지급하면 원천징수세가 생길 수 있으며, 지방소득세도 함께 납부해야 합니다.'
    },
    {
      code: '법인 사업자',
      title: '법인 사업자',
      description: '법인은 사업에서 발생한 이익에 대해 법인세를 납부하고, 매출에 따른 부가세 신고도 필수입니다. 직원 급여·배당 지급 시 원천징수 의무가 있으며 지방소득세도 함께 납부합니다.'
    }
  ]

  // 가입하지 않은 회원 유형만 필터링
  const availableMemberTypes = allMemberTypes.filter(
    type => !existingMemberTypes.includes(type.code)
  )

  const handleCardClick = (typeCode) => {
    if (selectedTypes.includes(typeCode)) {
      // 이미 선택된 경우 선택 해제
      setSelectedTypes(selectedTypes.filter(type => type !== typeCode))
    } else {
      // 선택되지 않은 경우 추가
      setSelectedTypes([...selectedTypes, typeCode])
    }
  }

  const handleComplete = () => {
    if (selectedTypes.length > 0) {
      // 선택한 회원 유형에 대한 폼 페이지로 이동
      navigate('/member-type-form', {
        state: {
          selectedTypes,
          signupPhone: location.state?.signupPhone,
          signupPassword: location.state?.signupPassword,
        }
      })
    }
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/member-type-selection')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">회원 유형 추가</h1>
        </header>

        {/* Content */}
        <div className="add-member-type-content">
          {availableMemberTypes.length === 0 ? (
            <div className="no-available-types">
              <p>추가할 수 있는 회원 유형이 없습니다.</p>
            </div>
          ) : (
            <div className="add-member-type-cards">
              {availableMemberTypes.map((memberType) => (
                <div
                  key={memberType.code}
                  className={`add-member-type-card ${selectedTypes.includes(memberType.code) ? 'selected' : ''}`}
                  onClick={() => handleCardClick(memberType.code)}
                >
                  <h3 className="add-member-type-title">{memberType.title}</h3>
                  <p className="add-member-type-description">{memberType.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 선택 완료 버튼 */}
        <div className="add-member-type-footer">
          <button 
            className="complete-btn" 
            onClick={handleComplete}
            disabled={selectedTypes.length === 0}
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMemberType

