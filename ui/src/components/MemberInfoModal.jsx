import { useState, useEffect } from 'react'
import './MemberInfoModal.css'
import '../components/MemberRegistrationModal.css'

const MemberInfoModal = ({ customer, onClose, onUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false)
  const [memberType, setMemberType] = useState(customer.memberType || '비사업자')
  
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

  // 초기 데이터 로드
  useEffect(() => {
    if (customer.memberType === '비사업자') {
      const rrn = customer.rrn ? customer.rrn.split('-') : ['', '']
      const addressParts = customer.address ? customer.address.split(' ') : ['', '']
      const mainAddress = addressParts[0] || ''
      const detailAddress = addressParts.slice(1).join(' ') || ''
      setNonBusinessFields({
        name: customer.name || '',
        gender: customer.gender || '',
        rrnFront: rrn[0] || '',
        rrnBack: rrn[1] || '',
        address: mainAddress,
        detailAddress: detailAddress,
        phoneNumber: customer.contact || customer.phoneNumber || ''
      })
    } else {
      const addressParts = customer.address ? customer.address.split(' ') : ['', '']
      const mainAddress = addressParts[0] || ''
      const detailAddress = addressParts.slice(1).join(' ') || ''
      setBusinessFields({
        businessName: customer.businessName || customer.name || '',
        representativeName: customer.representativeName || '',
        businessNumber: customer.businessNumber || '',
        industry: customer.industry || '',
        businessType: customer.businessType || '',
        address: mainAddress,
        detailAddress: detailAddress,
        startDate: customer.startDate || '',
        phoneNumber: customer.contact || customer.phoneNumber || ''
      })
    }
  }, [customer])

  const handleNonBusinessChange = (field, value) => {
    setNonBusinessFields(prev => ({ ...prev, [field]: value }))
  }

  const handleBusinessChange = (field, value) => {
    setBusinessFields(prev => ({ ...prev, [field]: value }))
  }

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '')
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }
  }

  const handleAddressSearch = () => {
    if (typeof window.daum === 'undefined' || typeof window.daum.Postcode === 'undefined') {
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
        let addr = ''
        let extraAddr = ''

        if (data.userSelectedType === 'R') {
          addr = data.roadAddress
        } else {
          addr = data.jibunAddress
        }

        if(data.userSelectedType === 'R'){
          if(data.bname !== '' && /[동|로|가]$/g.test(data.bname)){
            extraAddr += data.bname
          }
          if(data.buildingName !== '' && data.apartment === 'Y'){
            extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName)
          }
          if(extraAddr !== ''){
            extraAddr = ' (' + extraAddr + ')'
          }
        }

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

  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleSave = () => {
    const memberData = {
      id: customer.id,
      memberType,
      phoneNumber: memberType === '비사업자' 
        ? nonBusinessFields.phoneNumber 
        : businessFields.phoneNumber,
      ...(memberType === '비사업자' 
        ? {
            name: nonBusinessFields.name,
            gender: nonBusinessFields.gender,
            rrn: `${nonBusinessFields.rrnFront}-${nonBusinessFields.rrnBack}`,
            address: `${nonBusinessFields.address} ${nonBusinessFields.detailAddress}`.trim()
          }
        : {
            businessName: businessFields.businessName,
            representativeName: businessFields.representativeName,
            businessNumber: businessFields.businessNumber,
            industry: businessFields.industry,
            businessType: businessFields.businessType,
            address: `${businessFields.address} ${businessFields.detailAddress}`.trim(),
            startDate: businessFields.startDate
          }
      )
    }
    onUpdate(memberData)
    onClose()
  }

  return (
    <div className="member-info-modal-overlay" onClick={onClose}>
      <div className="member-info-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="member-info-modal-header">
          <div className="member-info-modal-title">회원 가입</div>
          <button className="member-info-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="member-info-modal-content">
          {/* Member Type Selection (수정 모드에서만 변경 가능) */}
          {isEditMode && (
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
          )}

          {/* Input Forms */}
          <div className="member-info-form">
            {memberType === '비사업자' ? (
              <>
                {/* 성명 */}
                <div className="info-field">
                  <label>성명</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      placeholder="성명"
                      value={nonBusinessFields.name}
                      onChange={(e) => handleNonBusinessChange('name', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{nonBusinessFields.name || '-'}</div>
                  )}
                </div>

                {/* 성별 */}
                <div className="info-field">
                  <label>성별</label>
                  {isEditMode ? (
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
                  ) : (
                    <div className="info-value">{nonBusinessFields.gender || '-'}</div>
                  )}
                </div>

                {/* 주민등록번호 */}
                <div className="info-field">
                  <label>주민등록번호</label>
                  {isEditMode ? (
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
                  ) : (
                    <div className="info-value">
                      {nonBusinessFields.rrnFront && nonBusinessFields.rrnBack 
                        ? `${nonBusinessFields.rrnFront}-${nonBusinessFields.rrnBack}` 
                        : '-'}
                    </div>
                  )}
                </div>

                {/* 주소지 */}
                <div className="info-field">
                  <label>주소지</label>
                  {isEditMode ? (
                    <>
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
                    </>
                  ) : (
                    <div className="info-value">
                      {nonBusinessFields.address && nonBusinessFields.detailAddress
                        ? `${nonBusinessFields.address} ${nonBusinessFields.detailAddress}`
                        : nonBusinessFields.address || '-'}
                    </div>
                  )}
                </div>

                {/* 전화번호 */}
                <div className="info-field">
                  <label>전화번호</label>
                  {isEditMode ? (
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
                  ) : (
                    <div className="info-value">{nonBusinessFields.phoneNumber || '-'}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 사업장명 */}
                <div className="info-field">
                  <label>사업장명</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      placeholder="사업장명"
                      value={businessFields.businessName}
                      onChange={(e) => handleBusinessChange('businessName', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{businessFields.businessName || '-'}</div>
                  )}
                </div>

                {/* 대표자명 */}
                <div className="info-field">
                  <label>대표자명</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      placeholder="대표자명"
                      value={businessFields.representativeName}
                      onChange={(e) => handleBusinessChange('representativeName', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{businessFields.representativeName || '-'}</div>
                  )}
                </div>

                {/* 사업자번호 */}
                <div className="info-field">
                  <label>사업자번호</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      placeholder="사업자번호"
                      value={businessFields.businessNumber}
                      onChange={(e) => handleBusinessChange('businessNumber', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{businessFields.businessNumber || '-'}</div>
                  )}
                </div>

                {/* 업종 */}
                <div className="info-field">
                  <label>업종</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      placeholder="업종"
                      value={businessFields.industry}
                      onChange={(e) => handleBusinessChange('industry', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{businessFields.industry || '-'}</div>
                  )}
                </div>

                {/* 업태 */}
                <div className="info-field">
                  <label>업태</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      placeholder="업태"
                      value={businessFields.businessType}
                      onChange={(e) => handleBusinessChange('businessType', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{businessFields.businessType || '-'}</div>
                  )}
                </div>

                {/* 사업장 주소 */}
                <div className="info-field">
                  <label>사업장 주소</label>
                  {isEditMode ? (
                    <>
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
                    </>
                  ) : (
                    <div className="info-value">
                      {businessFields.address && businessFields.detailAddress
                        ? `${businessFields.address} ${businessFields.detailAddress}`
                        : businessFields.address || '-'}
                    </div>
                  )}
                </div>

                {/* 사업 시작일 */}
                <div className="info-field">
                  <label>사업 시작일</label>
                  {isEditMode ? (
                    <input
                      type="date"
                      value={businessFields.startDate}
                      onChange={(e) => handleBusinessChange('startDate', e.target.value)}
                    />
                  ) : (
                    <div className="info-value">{businessFields.startDate || '-'}</div>
                  )}
                </div>

                {/* 전화번호 */}
                <div className="info-field">
                  <label>전화번호</label>
                  {isEditMode ? (
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
                  ) : (
                    <div className="info-value">{businessFields.phoneNumber || '-'}</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="member-info-modal-actions">
            <button className="member-info-cancel-btn" onClick={onClose}>
              취소
            </button>
            {isEditMode ? (
              <button className="member-info-save-btn" onClick={handleSave}>
                수정완료
              </button>
            ) : (
              <button className="member-info-edit-btn" onClick={handleEdit}>
                수정하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemberInfoModal
