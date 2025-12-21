import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './MemberTypeForm.css'

const MemberTypeForm = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedTypes = location.state?.selectedTypes || []
  const [currentStep, setCurrentStep] = useState(0) // 현재 진행 중인 회원 유형 인덱스
  const [currentType, setCurrentType] = useState(selectedTypes[0] || '비사업자')
  
  // 비사업자 폼 데이터
  const [nonBusinessData, setNonBusinessData] = useState({
    name: '',
    gender: '',
    residentNumber1: '',
    residentNumber2: '',
    address: '',
    detailAddress: ''
  })

  // 개인 사업자 폼 데이터
  const [individualBusinessData, setIndividualBusinessData] = useState({
    businessName: '',
    representativeName: '',
    businessNumber: '',
    industry: '',
    businessType: '',
    address: '',
    detailAddress: '',
    startDate: ''
  })

  // 법인 사업자 폼 데이터
  const [corporateBusinessData, setCorporateBusinessData] = useState({
    corporateName: '',
    representativeName: '',
    businessNumber: '',
    industry: '',
    businessType: '',
    address: '',
    detailAddress: '',
    startDate: ''
  })

  const totalSteps = selectedTypes.length
  const currentTypeIndex = selectedTypes.indexOf(currentType)

  const handleTypeChange = (type) => {
    setCurrentType(type)
    const index = selectedTypes.indexOf(type)
    setCurrentStep(index)
  }

  const handleNonBusinessChange = (field, value) => {
    setNonBusinessData(prev => ({ ...prev, [field]: value }))
  }

  const handleIndividualBusinessChange = (field, value) => {
    setIndividualBusinessData(prev => ({ ...prev, [field]: value }))
  }

  const handleCorporateBusinessChange = (field, value) => {
    setCorporateBusinessData(prev => ({ ...prev, [field]: value }))
  }

  const isFormValid = () => {
    if (currentType === '비사업자') {
      return nonBusinessData.name && nonBusinessData.gender && 
             nonBusinessData.residentNumber1 && nonBusinessData.residentNumber2 && 
             nonBusinessData.address
    } else if (currentType === '개인 사업자') {
      return individualBusinessData.businessName && individualBusinessData.representativeName &&
             individualBusinessData.businessNumber && individualBusinessData.industry &&
             individualBusinessData.businessType && individualBusinessData.address &&
             individualBusinessData.startDate
    } else if (currentType === '법인 사업자') {
      return corporateBusinessData.corporateName && corporateBusinessData.representativeName &&
             corporateBusinessData.businessNumber && corporateBusinessData.industry &&
             corporateBusinessData.businessType && corporateBusinessData.address &&
             corporateBusinessData.startDate
    }
    return false
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevType = selectedTypes[currentStep - 1]
      setCurrentType(prevType)
      setCurrentStep(currentStep - 1)
    } else {
      navigate('/add-member-type', { state: { existingTypes: [] } })
    }
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      const nextType = selectedTypes[currentStep + 1]
      setCurrentType(nextType)
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    // 모든 폼 데이터를 서버에 저장
    const formData = {
      nonBusiness: nonBusinessData,
      individualBusiness: individualBusinessData,
      corporateBusiness: corporateBusinessData
    }
    
    alert('회원 유형이 추가되었습니다.')
    navigate('/member-type-selection', {
      state: { addedTypes: selectedTypes }
    })
  }

  const handleAddressSearch = () => {
    // 카카오 주소 API (Daum 우편번호 서비스) 사용
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: function(data) {
          // 주소 정보를 조합하여 표시
          let addr = '' // 주소 변수
          let extraAddr = '' // 참고항목 변수

          // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
          if (data.userSelectedType === 'R') { // 사용자가 도로명 주소를 선택했을 경우
            addr = data.roadAddress
          } else { // 사용자가 지번 주소를 선택했을 경우(J)
            addr = data.jibunAddress
          }

          // 사용자가 선택한 주소가 도로명 타입일때 참고항목을 조합한다.
          if(data.userSelectedType === 'R'){
            // 법정동명이 있을 경우 추가한다. (법정리는 제외)
            // 법정동의 경우 마지막 문자가 "동/로/가"로 끝난다.
            if(data.bname !== '' && /[동|로|가]$/g.test(data.bname)){
              extraAddr += data.bname
            }
            // 건물명이 있고, 공동주택일 경우 추가한다.
            if(data.buildingName !== '' && data.apartment === 'Y'){
              extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName)
            }
            // 표시할 참고항목이 있을 경우, 괄호까지 추가한 최종 문자열을 만든다.
            if(extraAddr !== ''){
              extraAddr = ' (' + extraAddr + ')'
            }
          }

          // 선택한 주소를 해당 회원 유형의 주소 필드에 설정
          const fullAddress = addr + extraAddr
          
          if (currentType === '비사업자') {
            handleNonBusinessChange('address', fullAddress)
          } else if (currentType === '개인 사업자') {
            handleIndividualBusinessChange('address', fullAddress)
          } else if (currentType === '법인 사업자') {
            handleCorporateBusinessChange('address', fullAddress)
          }
        },
        width: '100%',
        height: '100%',
        maxSuggestItems: 5
      }).open()
    } else {
      // 스크립트가 로드되지 않은 경우 동적으로 로드
      const script = document.createElement('script')
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.onload = () => {
        handleAddressSearch()
      }
      script.onerror = () => {
        alert('주소 검색 서비스를 불러올 수 없습니다. 인터넷 연결을 확인해주세요.')
      }
      document.head.appendChild(script)
    }
  }

  const renderNonBusinessForm = () => (
    <div className="form-content">
      <div className="form-group">
        <label className="form-label">성명</label>
        <input
          type="text"
          className="form-input"
          placeholder="성명"
          value={nonBusinessData.name}
          onChange={(e) => handleNonBusinessChange('name', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">성별</label>
        <div className="gender-buttons">
          <button
            type="button"
            className={`gender-button ${nonBusinessData.gender === '남성' ? 'selected' : ''}`}
            onClick={() => handleNonBusinessChange('gender', '남성')}
          >
            남성
          </button>
          <button
            type="button"
            className={`gender-button ${nonBusinessData.gender === '여성' ? 'selected' : ''}`}
            onClick={() => handleNonBusinessChange('gender', '여성')}
          >
            여성
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">주민등록번호</label>
        <div className="resident-number-inputs">
          <input
            type="text"
            className="form-input"
            placeholder="주민등록번호 앞자리"
            maxLength={6}
            value={nonBusinessData.residentNumber1}
            onChange={(e) => handleNonBusinessChange('residentNumber1', e.target.value)}
          />
          <span className="hyphen">-</span>
          <input
            type="text"
            className="form-input"
            placeholder="주민등록번호 뒷자리"
            maxLength={7}
            value={nonBusinessData.residentNumber2}
            onChange={(e) => handleNonBusinessChange('residentNumber2', e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">주소지</label>
        <div className="address-row">
          <button className="address-search-btn" onClick={handleAddressSearch}>
            주소 찾기
          </button>
          <input
            type="text"
            className="form-input address-input"
            value={nonBusinessData.address}
            readOnly
            disabled={!nonBusinessData.address}
          />
        </div>
        {nonBusinessData.address && (
          <input
            type="text"
            className="form-input"
            placeholder="상세 주소 입력"
            value={nonBusinessData.detailAddress}
            onChange={(e) => handleNonBusinessChange('detailAddress', e.target.value)}
          />
        )}
      </div>
    </div>
  )

  const renderIndividualBusinessForm = () => (
    <div className="form-content">
      <div className="form-group">
        <label className="form-label">사업장명</label>
        <input
          type="text"
          className="form-input"
          placeholder="사업장명"
          value={individualBusinessData.businessName}
          onChange={(e) => handleIndividualBusinessChange('businessName', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">대표자명</label>
        <input
          type="text"
          className="form-input"
          placeholder="대표자명"
          value={individualBusinessData.representativeName}
          onChange={(e) => handleIndividualBusinessChange('representativeName', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">사업자번호</label>
        <input
          type="text"
          className="form-input"
          placeholder="사업자번호"
          value={individualBusinessData.businessNumber}
          onChange={(e) => handleIndividualBusinessChange('businessNumber', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">업종</label>
        <input
          type="text"
          className="form-input"
          placeholder="업종"
          value={individualBusinessData.industry}
          onChange={(e) => handleIndividualBusinessChange('industry', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">업태</label>
        <input
          type="text"
          className="form-input"
          placeholder="업태"
          value={individualBusinessData.businessType}
          onChange={(e) => handleIndividualBusinessChange('businessType', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">사업장 주소</label>
        <div className="address-row">
          <button className="address-search-btn" onClick={handleAddressSearch}>
            주소 찾기
          </button>
          <input
            type="text"
            className="form-input address-input"
            value={individualBusinessData.address}
            readOnly
            disabled={!individualBusinessData.address}
          />
        </div>
        {individualBusinessData.address && (
          <input
            type="text"
            className="form-input"
            placeholder="상세 주소 입력"
            value={individualBusinessData.detailAddress}
            onChange={(e) => handleIndividualBusinessChange('detailAddress', e.target.value)}
          />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">사업 시작일</label>
        <input
          type="date"
          className="form-input date-input"
          value={individualBusinessData.startDate}
          onChange={(e) => handleIndividualBusinessChange('startDate', e.target.value)}
        />
      </div>
    </div>
  )

  const renderCorporateBusinessForm = () => (
    <div className="form-content">
      <div className="form-group">
        <label className="form-label">법인명</label>
        <input
          type="text"
          className="form-input"
          placeholder="법인명"
          value={corporateBusinessData.corporateName}
          onChange={(e) => handleCorporateBusinessChange('corporateName', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">대표자명</label>
        <input
          type="text"
          className="form-input"
          placeholder="대표자명"
          value={corporateBusinessData.representativeName}
          onChange={(e) => handleCorporateBusinessChange('representativeName', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">사업자번호</label>
        <input
          type="text"
          className="form-input"
          placeholder="사업자번호"
          value={corporateBusinessData.businessNumber}
          onChange={(e) => handleCorporateBusinessChange('businessNumber', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">업종</label>
        <input
          type="text"
          className="form-input"
          placeholder="업종"
          value={corporateBusinessData.industry}
          onChange={(e) => handleCorporateBusinessChange('industry', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">업태</label>
        <input
          type="text"
          className="form-input"
          placeholder="업태"
          value={corporateBusinessData.businessType}
          onChange={(e) => handleCorporateBusinessChange('businessType', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">사업장 주소</label>
        <div className="address-row">
          <button className="address-search-btn" onClick={handleAddressSearch}>
            주소 찾기
          </button>
          <input
            type="text"
            className="form-input address-input"
            value={corporateBusinessData.address}
            readOnly
            disabled={!corporateBusinessData.address}
          />
        </div>
        {corporateBusinessData.address && (
          <input
            type="text"
            className="form-input"
            placeholder="상세 주소 입력"
            value={corporateBusinessData.detailAddress}
            onChange={(e) => handleCorporateBusinessChange('detailAddress', e.target.value)}
          />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">사업 시작일</label>
        <input
          type="date"
          className="form-input date-input"
          value={corporateBusinessData.startDate}
          onChange={(e) => handleCorporateBusinessChange('startDate', e.target.value)}
        />
      </div>
    </div>
  )

  const renderForm = () => {
    switch (currentType) {
      case '비사업자':
        return renderNonBusinessForm()
      case '개인 사업자':
        return renderIndividualBusinessForm()
      case '법인 사업자':
        return renderCorporateBusinessForm()
      default:
        return null
    }
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/add-member-type', { state: { existingTypes: [] } })}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">회원 가입 ({currentStep + 1}/{totalSteps})</h1>
        </header>

        {/* Content */}
        <div className="member-type-form-content">
          {/* 회원 유형 선택 버튼 */}
          {selectedTypes.length > 1 && (
            <div className="type-selector">
              {selectedTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`type-selector-btn ${currentType === type ? 'selected' : ''}`}
                  onClick={() => handleTypeChange(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          )}

          {/* 폼 내용 */}
          {renderForm()}
        </div>

        {/* Footer Navigation */}
        <div className="form-footer">
          <button className="prev-btn" onClick={handlePrev}>
            이전
          </button>
          <button
            className={`next-btn ${isFormValid() ? 'active' : ''}`}
            onClick={handleNext}
            disabled={!isFormValid()}
          >
            {currentStep === totalSteps - 1 ? '완료' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MemberTypeForm

