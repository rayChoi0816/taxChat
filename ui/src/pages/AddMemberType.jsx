import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './AddMemberType.css'

const AddMemberType = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedTypes, setSelectedTypes] = useState([]) // 복수 선택 가능

  const existingMemberTypes = location.state?.existingTypes || ['비사업자', '개인 사업자']

  const allMemberTypes = [
    {
      code: '비사업자',
      title: '비사업자',
      description:
        '사업을 하지 않는 일반 개인은 근로소득세, 종합소득세, 양도세 등 소득·자산 거래에서 발생하는 세금을 납부합니다. 부동산·자동차를 사면 취득세, 보유하면 재산세가 발생합니다.',
    },
    {
      code: '개인 사업자',
      title: '개인 사업자',
      description:
        '개인사업자는 매출이 생기면 부가세와 종합소득세를 기본적으로 신고·납부해야 합니다. 직원·프리랜서에게 비용을 지급하면 원천징수세가 생길 수 있으며, 지방소득세도 함께 납부해야 합니다.',
    },
    {
      code: '법인 사업자',
      title: '법인 사업자',
      description:
        '법인은 사업에서 발생한 이익에 대해 법인세를 납부하고, 매출에 따른 부가세 신고도 필수입니다. 직원 급여·배당 지급 시 원천징수 의무가 있으며 지방소득세도 함께 납부합니다.',
    },
  ]

  const availableMemberTypes = allMemberTypes.filter(
    (type) => !existingMemberTypes.includes(type.code)
  )

  const handleCardClick = (typeCode) => {
    if (selectedTypes.includes(typeCode)) {
      setSelectedTypes(selectedTypes.filter((type) => type !== typeCode))
    } else {
      setSelectedTypes([...selectedTypes, typeCode])
    }
  }

  const handleComplete = () => {
    if (selectedTypes.length > 0) {
      navigate('/member-type-form', {
        state: {
          selectedTypes,
          signupPhone: location.state?.signupPhone,
          signupPassword: location.state?.signupPassword,
        },
      })
    }
  }

  return (
    <div className="add-member-bg">
      <div className="add-member-shell">
        <header className="add-member-header-fixed">
          <button type="button" className="add-member-back-btn" onClick={() => navigate('/member-type-selection')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="add-member-title">회원 유형 추가</h1>
        </header>

        <main className="add-member-scroll">
          {availableMemberTypes.length === 0 ? (
            <div className="no-available-types">
              <p>추가할 수 있는 회원 유형이 없습니다.</p>
            </div>
          ) : (
            <div className="add-member-type-cards">
              {availableMemberTypes.map((memberType) => (
                <div
                  key={memberType.code}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardClick(memberType.code)
                    }
                  }}
                  className={`add-member-type-card ${selectedTypes.includes(memberType.code) ? 'selected' : ''}`}
                  onClick={() => handleCardClick(memberType.code)}
                >
                  <h3 className="add-member-type-title">{memberType.title}</h3>
                  <p className="add-member-type-description">{memberType.description}</p>
                </div>
              ))}
            </div>
          )}
        </main>

        <div className="add-member-footer-fixed">
          <button
            type="button"
            className="add-member-complete-btn"
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
