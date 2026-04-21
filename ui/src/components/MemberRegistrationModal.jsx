import { useState, useEffect } from 'react'
import './MemberRegistrationModal.css'

const MemberRegistrationModal = ({ onClose, onSave, initialMemberType = '비사업자' }) => {
  const [memberType, setMemberType] = useState(initialMemberType)
  
  // initialMemberType이 변경되면 memberType 업데이트
  useEffect(() => {
    setMemberType(initialMemberType)
  }, [initialMemberType])
  
  // 비사업자 입력 필드
  const [nonBusinessFields, setNonBusinessFields] = useState({
    name: '',
    gender: '',
    rrnFront: '',
    rrnBack: '',
    address: '',
    detailAddress: '',
    phoneNumber: ''
  })

  // 개인 사업자/법인 사업자 입력 필드
  const [businessFields, setBusinessFields] = useState({
    businessName: '',
    representativeName: '',
    businessNumber: '',
    industry: '',
    businessType: '',
    address: '',
    detailAddress: '',
    startDate: '',
    phoneNumber: ''
  })

  const handleNonBusinessChange = (field, value) => {
    setNonBusinessFields(prev => ({ ...prev, [field]: value }))
  }

  const handleBusinessChange = (field, value) => {
    setBusinessFields(prev => ({ ...prev, [field]: value }))
  }

  const formatPhoneNumber = (value) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '')
    
    // 하이픈 자동 추가
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }
  }

  const handleAddressSearch = () => {
    // 다음 주소 API가 로드되었는지 확인
    if (typeof window.daum === 'undefined' || typeof window.daum.Postcode === 'undefined') {
      // 스크립트가 로드되지 않은 경우 동적으로 로드
      const script = document.createElement('script')
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.onload = () => {
        openAddressPopup()
      }
      script.onerror = () => {
        alert('주소 API를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      document.head.appendChild(script)
    } else {
      openAddressPopup()
    }
  }

  const openAddressPopup = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        // 주소 선택 시 실행되는 콜백
        let addr = '' // 주소 변수
        let extraAddr = '' // 참고항목 변수

        // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
        if (data.userSelectedType === 'R') {
          // 사용자가 도로명 주소를 선택했을 경우
          addr = data.roadAddress
        } else {
          // 사용자가 지번 주소를 선택했을 경우(J)
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

        // 선택한 주소를 해당 입력 필드에 반영
        const fullAddress = addr + extraAddr
        if (memberType === '비사업자') {
          handleNonBusinessChange('address', fullAddress)
        } else {
          handleBusinessChange('address', fullAddress)
        }
      },
      width: '100%',
      height: '100%',
      maxSuggestItems: 5
    }).open()
  }

  const isFormValid = () => {
    if (memberType === '비사업자') {
      return (
        nonBusinessFields.name.trim() !== '' &&
        nonBusinessFields.gender !== '' &&
        nonBusinessFields.rrnFront.trim() !== '' &&
        nonBusinessFields.rrnBack.trim() !== '' &&
        nonBusinessFields.address.trim() !== '' &&
        nonBusinessFields.detailAddress.trim() !== '' &&
        nonBusinessFields.phoneNumber.trim() !== ''
      )
    } else {
      // 개인 사업자 또는 법인 사업자
      return (
        businessFields.businessName.trim() !== '' &&
        businessFields.representativeName.trim() !== '' &&
        businessFields.businessNumber.trim() !== '' &&
        businessFields.industry.trim() !== '' &&
        businessFields.businessType.trim() !== '' &&
        businessFields.address.trim() !== '' &&
        businessFields.detailAddress.trim() !== '' &&
        businessFields.startDate.trim() !== '' &&
        businessFields.phoneNumber.trim() !== ''
      )
    }
  }

  const handleSave = () => {
    if (isFormValid()) {
      const memberData = {
        memberType,
        phoneNumber: memberType === '비사업자' 
          ? nonBusinessFields.phoneNumber 
          : businessFields.phoneNumber,
        ...(memberType === '비사업자' 
          ? {
              name: nonBusinessFields.name,
              gender: nonBusinessFields.gender,
              rrn: `${nonBusinessFields.rrnFront}-${nonBusinessFields.rrnBack}`,
              baseAddress: nonBusinessFields.address || '',
              detailAddress: nonBusinessFields.detailAddress || ''
            }
          : {
              businessName: businessFields.businessName,
              representativeName: businessFields.representativeName,
              businessNumber: businessFields.businessNumber,
              industry: businessFields.industry,
              businessType: businessFields.businessType,
              baseAddress: businessFields.address || '',
              detailAddress: businessFields.detailAddress || '',
              startDate: businessFields.startDate
            }
        )
      }
      onSave(memberData)
      onClose()
    }
  }

  return (
    <div className="member-registration-modal-overlay" onClick={onClose}>
      <div className="member-registration-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="member-registration-modal-header">
          <div className="member-registration-modal-title">회원 가입</div>
          <button className="member-registration-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="member-registration-modal-content">
          {/* Member Type Selection */}
          <div className="member-type-selection">
            <label className="member-type-radio">
              <input
                type="radio"
                name="memberType"
                value="비사업자"
                checked={memberType === '비사업자'}
                onChange={(e) => setMemberType(e.target.value)}
              />
              <span>비사업자</span>
            </label>
            <label className="member-type-radio">
              <input
                type="radio"
                name="memberType"
                value="개인 사업자"
                checked={memberType === '개인 사업자'}
                onChange={(e) => setMemberType(e.target.value)}
              />
              <span>개인 사업자</span>
            </label>
            <label className="member-type-radio">
              <input
                type="radio"
                name="memberType"
                value="법인 사업자"
                checked={memberType === '법인 사업자'}
                onChange={(e) => setMemberType(e.target.value)}
              />
              <span>법인 사업자</span>
            </label>
          </div>

          {/* Input Forms */}
          <div className="member-registration-form">
            {memberType === '비사업자' ? (
              <>
                {/* 성명 */}
                <div className="form-field">
                  <label>성명</label>
                  <input
                    type="text"
                    placeholder="성명"
                    value={nonBusinessFields.name}
                    onChange={(e) => handleNonBusinessChange('name', e.target.value)}
                  />
                </div>

                {/* 성별 */}
                <div className="form-field">
                  <label>성별</label>
                  <div className="gender-buttons">
                    <button
                      type="button"
                      className={`gender-btn ${nonBusinessFields.gender === '남성' ? 'active' : ''}`}
                      onClick={() => handleNonBusinessChange('gender', '남성')}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      className={`gender-btn ${nonBusinessFields.gender === '여성' ? 'active' : ''}`}
                      onClick={() => handleNonBusinessChange('gender', '여성')}
                    >
                      여성
                    </button>
                  </div>
                </div>

                {/* 주민등록번호 */}
                <div className="form-field">
                  <label>주민등록번호</label>
                  <div className="rrn-input-group">
                    <input
                      type="text"
                      placeholder="주민등록번호 앞자리"
                      maxLength={6}
                      value={nonBusinessFields.rrnFront}
                      onChange={(e) => handleNonBusinessChange('rrnFront', e.target.value.replace(/[^\d]/g, ''))}
                    />
                    <span className="rrn-separator">-</span>
                    <input
                      type="text"
                      placeholder="주민등록번호 뒷자리"
                      maxLength={7}
                      value={nonBusinessFields.rrnBack}
                      onChange={(e) => handleNonBusinessChange('rrnBack', e.target.value.replace(/[^\d]/g, ''))}
                    />
                  </div>
                </div>

                {/* 주소지 */}
                <div className="form-field">
                  <label>주소지</label>
                  <div className="address-input-group">
                    <button
                      type="button"
                      className="address-search-btn"
                      onClick={handleAddressSearch}
                    >
                      주소 찾기
                    </button>
                    <input
                      type="text"
                      placeholder="주소"
                      value={nonBusinessFields.address}
                      onChange={(e) => handleNonBusinessChange('address', e.target.value)}
                      readOnly
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="상세 주소 입력"
                    value={nonBusinessFields.detailAddress}
                    onChange={(e) => handleNonBusinessChange('detailAddress', e.target.value)}
                    className="detail-address-input"
                  />
                </div>

                {/* 전화번호 */}
                <div className="form-field">
                  <label>전화번호</label>
                  <input
                    type="tel"
                    placeholder="전화번호"
                    value={nonBusinessFields.phoneNumber}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value)
                      handleNonBusinessChange('phoneNumber', formatted)
                    }}
                    maxLength={13}
                  />
                </div>
              </>
            ) : (
              <>
                {/* 사업장명 */}
                <div className="form-field">
                  <label>사업장명</label>
                  <input
                    type="text"
                    placeholder="사업장명"
                    value={businessFields.businessName}
                    onChange={(e) => handleBusinessChange('businessName', e.target.value)}
                  />
                </div>

                {/* 대표자명 */}
                <div className="form-field">
                  <label>대표자명</label>
                  <input
                    type="text"
                    placeholder="대표자명"
                    value={businessFields.representativeName}
                    onChange={(e) => handleBusinessChange('representativeName', e.target.value)}
                  />
                </div>

                {/* 사업자번호 */}
                <div className="form-field">
                  <label>사업자번호</label>
                  <input
                    type="text"
                    placeholder="사업자번호"
                    value={businessFields.businessNumber}
                    onChange={(e) => handleBusinessChange('businessNumber', e.target.value)}
                  />
                </div>

                {/* 업종 */}
                <div className="form-field">
                  <label>업종</label>
                  <input
                    type="text"
                    placeholder="업종"
                    value={businessFields.industry}
                    onChange={(e) => handleBusinessChange('industry', e.target.value)}
                  />
                </div>

                {/* 업태 */}
                <div className="form-field">
                  <label>업태</label>
                  <input
                    type="text"
                    placeholder="업태"
                    value={businessFields.businessType}
                    onChange={(e) => handleBusinessChange('businessType', e.target.value)}
                  />
                </div>

                {/* 사업장 주소 */}
                <div className="form-field">
                  <label>사업장 주소</label>
                  <div className="address-input-group">
                    <button
                      type="button"
                      className="address-search-btn"
                      onClick={handleAddressSearch}
                    >
                      주소 찾기
                    </button>
                    <input
                      type="text"
                      placeholder="주소"
                      value={businessFields.address}
                      onChange={(e) => handleBusinessChange('address', e.target.value)}
                      readOnly
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="상세 주소 입력"
                    value={businessFields.detailAddress}
                    onChange={(e) => handleBusinessChange('detailAddress', e.target.value)}
                    className="detail-address-input"
                  />
                </div>

                {/* 사업 시작일 */}
                <div className="form-field">
                  <label>사업 시작일</label>
                  <input
                    type="date"
                    value={businessFields.startDate}
                    onChange={(e) => handleBusinessChange('startDate', e.target.value)}
                  />
                </div>

                {/* 전화번호 */}
                <div className="form-field">
                  <label>전화번호</label>
                  <input
                    type="tel"
                    placeholder="전화번호"
                    value={businessFields.phoneNumber}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value)
                      handleBusinessChange('phoneNumber', formatted)
                    }}
                    maxLength={13}
                  />
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="member-registration-modal-actions">
            <button className="member-registration-cancel-btn" onClick={onClose}>
              취소
            </button>
            <button
              className={`member-registration-save-btn ${isFormValid() ? 'enabled' : 'disabled'}`}
              onClick={handleSave}
              disabled={!isFormValid()}
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemberRegistrationModal

