import { useState, useEffect } from 'react'
import './ProductRegistrationModal.css'

const ProductRegistrationModal = ({ onClose, onSave, categories = [], attachments = [], product = null, onUpdate = null }) => {
  const isEditMode = product !== null
  const [isEditing, setIsEditing] = useState(false)
  
  const [selectedCategory, setSelectedCategory] = useState('')
  const [products, setProducts] = useState([
    {
      id: 1,
      availableUsers: {
        비사업자: false,
        개인사업자: false,
        법인사업자: false
      },
      name: '',
      price: '',
      description: '',
      attachments: []
    }
  ])

  // 수정 모드일 때 초기 데이터 로드
  useEffect(() => {
    if (product) {
      const categoryId = categories.find(cat => cat.name === product.categoryName)?.id || ''
      setSelectedCategory(String(categoryId))
      
      // 상품 데이터를 모달 형식에 맞게 변환
      const availableUsers = product.availableUsers || {
        비사업자: false,
        개인사업자: false,
        법인사업자: false
      }
      
      const productAttachments = (product.attachments || []).map((att, index) => ({
        id: Date.now() + index,
        value: att
      }))
      
      setProducts([{
        id: product.id,
        availableUsers: availableUsers,
        name: product.name || '',
        price: String(product.price || ''),
        description: product.description || '',
        attachments: productAttachments
      }])
      setIsEditing(false)
    } else {
      setSelectedCategory('')
      setProducts([{
        id: 1,
        availableUsers: {
          비사업자: false,
          개인사업자: false,
          법인사업자: false
        },
        name: '',
        price: '',
        description: '',
        attachments: []
      }])
      setIsEditing(false)
    }
  }, [product, categories])

  // 상품 추가
  const handleAddProduct = () => {
    // 수정 모드이고 수정 중일 때만 추가 가능
    if (isEditMode && !isEditing) {
      return
    }
    
    const nextId = Math.max(...products.map(p => p.id), 0) + 1
    setProducts(prev => [...prev, {
      id: nextId,
      availableUsers: {
        비사업자: false,
        개인사업자: false,
        법인사업자: false
      },
      name: '',
      price: '',
      description: '',
      attachments: []
    }])
  }

  // 상품 삭제
  const handleDeleteProduct = (productId) => {
    // 수정 모드이고 수정 중일 때만 삭제 가능
    if (isEditMode && !isEditing) {
      return
    }
    
    if (products.length > 1) {
      setProducts(prev => prev.filter(p => p.id !== productId))
    } else {
      alert('최소 하나의 상품은 필요합니다.')
    }
  }

  // 상품 이용 가능자 변경
  const handleAvailableUserChange = (productId, userType) => {
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? {
            ...product,
            availableUsers: {
              ...product.availableUsers,
              [userType]: !product.availableUsers[userType]
            }
          }
        : product
    ))
  }

  // 상품명 변경
  const handleProductNameChange = (productId, value) => {
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? { ...product, name: value }
        : product
    ))
  }

  // 상품 가격 변경 (숫자만 입력)
  const handleProductPriceChange = (productId, value) => {
    const numericValue = value.replace(/[^\d]/g, '')
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? { ...product, price: numericValue }
        : product
    ))
  }

  // 상품 설명 변경
  const handleProductDescriptionChange = (productId, value) => {
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? { ...product, description: value }
        : product
    ))
  }

  // 첨부 서류 추가
  const handleAddAttachment = (productId, selectedValue = '') => {
    if (!selectedValue) return
    
    // 먼저 중복 체크
    const product = products.find(p => p.id === productId)
    if (product) {
      const isAlreadyAttached = product.attachments.some(att => att.value === selectedValue)
      
      if (isAlreadyAttached) {
        alert('이미 첨부된 서류입니다.')
        return
      }
    }
    
    // 중복이 아니면 추가
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? {
            ...product,
            attachments: [...product.attachments, { id: Date.now() + Math.random(), value: selectedValue }]
          }
        : product
    ))
  }

  // 첨부 서류 삭제
  const handleDeleteAttachment = (productId, attachmentId) => {
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? {
            ...product,
            attachments: product.attachments.filter(att => att.id !== attachmentId)
          }
        : product
    ))
  }

  // 첨부 서류 선택 변경
  const handleAttachmentChange = (productId, attachmentId, value) => {
    if (!value) {
      // 빈 값으로 변경하는 경우는 허용
      setProducts(prev => prev.map(product => 
        product.id === productId
          ? {
              ...product,
              attachments: product.attachments.map(att => 
                att.id === attachmentId
                  ? { ...att, value }
                  : att
              )
            }
          : product
      ))
      return
    }
    
    // 먼저 중복 체크
    const product = products.find(p => p.id === productId)
    if (product) {
      const isAlreadyAttached = product.attachments.some(att => 
        att.id !== attachmentId && att.value === value
      )
      
      if (isAlreadyAttached) {
        alert('이미 첨부된 서류입니다.')
        return
      }
    }
    
    // 중복이 아니면 변경
    setProducts(prev => prev.map(product => 
      product.id === productId
        ? {
            ...product,
            attachments: product.attachments.map(att => 
              att.id === attachmentId
                ? { ...att, value }
                : att
            )
          }
        : product
    ))
  }

  // 상품 코드 생성: cate + 두자리 순번 + 소문자 알파벳 두글자 + 두자리 순번
  const generateProductCode = (productIndex, existingCodes = []) => {
    // 기존 코드에서 최대 순번 찾기
    let maxCategoryNumber = 0
    existingCodes.forEach(code => {
      const match = code.match(/^cate(\d{2})[a-z]{2}\d{2}$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxCategoryNumber) {
          maxCategoryNumber = num
        }
      }
    })

    // 다음 카테고리 순번 계산
    const categoryNumber = maxCategoryNumber + 1
    const categoryNumberStr = String(categoryNumber).padStart(2, '0')
    
    // 임의의 소문자 알파벳 두 글자 생성
    const randomAlphabet1 = String.fromCharCode(97 + Math.floor(Math.random() * 26))
    const randomAlphabet2 = String.fromCharCode(97 + Math.floor(Math.random() * 26))
    const alphabets = randomAlphabet1 + randomAlphabet2
    
    // 상품 순번
    const productNumber = String(productIndex).padStart(2, '0')
    
    return `cate${categoryNumberStr}${alphabets}${productNumber}`
  }

  // 등록/수정 버튼 활성화 여부 확인
  const isSaveEnabled = () => {
    if (!selectedCategory) return false
    
    return products.every(prod => {
      const hasAvailableUser = Object.values(prod.availableUsers).some(v => v === true)
      return hasAvailableUser && prod.name.trim() && prod.price.trim() && prod.description.trim()
    })
  }

  // 등록/수정 처리
  const handleSave = () => {
    if (!isSaveEnabled()) return

    const selectedCategoryData = categories.find(cat => cat.id === parseInt(selectedCategory))
    
    if (isEditMode && isEditing && onUpdate) {
      // 수정 모드
      const updatedProduct = {
        ...product,
        categoryName: selectedCategoryData?.name || product.categoryName,
        name: products[0].name.trim(),
        price: parseInt(products[0].price),
        availableUsers: products[0].availableUsers,
        description: products[0].description.trim(),
        attachments: products[0].attachments.map(att => att.value).filter(v => v)
      }
      onUpdate(updatedProduct)
      setIsEditing(false)
      onClose()
    } else if (!isEditMode && onSave) {
      // 등록 모드
      // 기존 상품 코드 목록 가져오기 (실제로는 props로 전달받아야 함)
      const existingCodes = []
      
      const productsToSave = products.map((prod, index) => ({
        id: Date.now() + index,
        categoryName: selectedCategoryData?.name || '',
        name: prod.name.trim(),
        code: generateProductCode(index + 1, existingCodes),
        price: parseInt(prod.price),
        display: '진열',
        registrationDate: new Date().toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\. /g, '-').replace(/\./g, '').replace(/,/g, ''),
        deleted: false,
        availableUsers: prod.availableUsers,
        description: prod.description.trim(),
        attachments: prod.attachments.map(att => att.value).filter(v => v)
      }))

      onSave(productsToSave)
      
      // 폼 초기화
      setSelectedCategory('')
      setProducts([{
        id: 1,
        availableUsers: {
          비사업자: false,
          개인사업자: false,
          법인사업자: false
        },
        name: '',
        price: '',
        description: '',
        attachments: []
      }])
      
      onClose()
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (isEditMode && isEditing) {
      // 수정 중이면 원래 값으로 복원
      if (product) {
        const categoryId = categories.find(cat => cat.name === product.categoryName)?.id || ''
        setSelectedCategory(String(categoryId))
        
        const availableUsers = product.availableUsers || {
          비사업자: false,
          개인사업자: false,
          법인사업자: false
        }
        
        const productAttachments = (product.attachments || []).map((att, index) => ({
          id: Date.now() + index,
          value: att
        }))
        
        setProducts([{
          id: product.id,
          availableUsers: availableUsers,
          name: product.name || '',
          price: String(product.price || ''),
          description: product.description || '',
          attachments: productAttachments
        }])
      }
      setIsEditing(false)
    } else {
      // 폼 초기화
      setSelectedCategory('')
      setProducts([{
        id: 1,
        availableUsers: {
          비사업자: false,
          개인사업자: false,
          법인사업자: false
        },
        name: '',
        price: '',
        description: '',
        attachments: []
      }])
      onClose()
    }
  }

  return (
    <div className="product-registration-modal-overlay" onClick={handleCancel}>
      <div className="product-registration-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="product-registration-modal-header">
          <h2 className="product-registration-modal-title">
            {isEditMode ? '상품 상세' : '상품 등록'}
          </h2>
          <button className="product-registration-modal-close" onClick={handleCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="product-registration-modal-content">
          {/* 상품 카테고리 선택 */}
          <div className="product-registration-form-group">
            <label className="product-registration-label">상품 카테고리 선택</label>
            {isEditMode && !isEditing ? (
              <div className="product-registration-display">
                {categories.find(cat => cat.id === parseInt(selectedCategory))?.name || '-'}
              </div>
            ) : (
              <select
                className="product-registration-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">선택</option>
                {categories
                  .filter(cat => !cat.deleted && (cat.display_status === '진열' || cat.display === '진열'))
                  .map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* 상품 정보 입력 영역들 */}
          {products.map((product, index) => (
            <div key={product.id} className="product-registration-product-section">
              <div className="product-registration-product-header">
                <h3 className="product-registration-product-title">상품 {String(index + 1).padStart(2, '0')}</h3>
                <div className="product-registration-product-actions">
                  <button
                    className={`product-registration-add-btn ${(isEditMode && !isEditing) ? 'disabled' : ''}`}
                    onClick={handleAddProduct}
                    disabled={isEditMode && !isEditing}
                  >
                    상품 +
                  </button>
                  <button
                    className={`product-registration-delete-btn ${(isEditMode && !isEditing) ? 'disabled' : ''}`}
                    onClick={() => handleDeleteProduct(product.id)}
                    disabled={isEditMode && !isEditing}
                  >
                    상품 삭제
                  </button>
                </div>
              </div>

              {/* 상품 이용 회원 유형 */}
              <div className="product-registration-form-group">
                <label className="product-registration-label">상품 이용 회원 유형</label>
                {isEditMode && !isEditing ? (
                  <div className="product-registration-display">
                    {Object.entries(product.availableUsers)
                      .filter(([_, checked]) => checked)
                      .map(([userType, _]) => userType)
                      .join(', ') || '-'}
                  </div>
                ) : (
                  <div className="product-registration-checkbox-group">
                    {['비사업자', '개인사업자', '법인사업자'].map(userType => (
                      <label key={userType} className="product-registration-checkbox-label">
                        <input
                          type="checkbox"
                          checked={product.availableUsers[userType]}
                          onChange={() => handleAvailableUserChange(product.id, userType)}
                        />
                        <span>{userType}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 상품명 */}
              <div className="product-registration-form-group">
                <label className="product-registration-label">상품명을 입력하세요.</label>
                {isEditMode && !isEditing ? (
                  <div className="product-registration-display">{product.name || '-'}</div>
                ) : (
                  <input
                    type="text"
                    className="product-registration-input"
                    placeholder="상품명 입력"
                    value={product.name}
                    onChange={(e) => handleProductNameChange(product.id, e.target.value)}
                  />
                )}
              </div>

              {/* 상품 가격 */}
              <div className="product-registration-form-group">
                <label className="product-registration-label">상품 가격을 입력하세요.</label>
                {isEditMode && !isEditing ? (
                  <div className="product-registration-display">
                    {product.price ? `${parseInt(product.price).toLocaleString()}원` : '-'}
                  </div>
                ) : (
                  <div className="product-registration-price-group">
                    <input
                      type="text"
                      className="product-registration-input"
                      placeholder="숫자만 입력"
                      value={product.price}
                      onChange={(e) => handleProductPriceChange(product.id, e.target.value)}
                    />
                    <span className="product-registration-price-unit">원</span>
                  </div>
                )}
              </div>

              {/* 상품 설명 */}
              <div className="product-registration-form-group">
                <label className="product-registration-label">상품 설명을 입력하세요</label>
                {isEditMode && !isEditing ? (
                  <div className="product-registration-display">{product.description || '-'}</div>
                ) : (
                  <textarea
                    className="product-registration-textarea"
                    placeholder="상품 설명 입력"
                    value={product.description}
                    onChange={(e) => handleProductDescriptionChange(product.id, e.target.value)}
                    rows={5}
                  />
                )}
              </div>

              {/* 첨부 서류 선택 */}
              <div className="product-registration-form-group">
                <label className="product-registration-label">첨부 서류 선택</label>
                {isEditMode && !isEditing ? (
                  <div className="product-registration-display">
                    {product.attachments.length > 0 
                      ? product.attachments.map(att => att.value).join(', ')
                      : '-'}
                  </div>
                ) : (
                  <>
                    <div className="product-registration-attachment-group">
                      <select
                        className="product-registration-select"
                        id={`attachment-select-${product.id}`}
                        defaultValue=""
                      >
                        <option value="">선택</option>
                        {attachments.map(attachment => (
                          <option key={attachment.id || attachment} value={attachment.name || attachment}>
                            {attachment.name || attachment}
                          </option>
                        ))}
                      </select>
                      <button
                        className="product-registration-attachment-add-btn"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const selectElement = document.getElementById(`attachment-select-${product.id}`)
                          if (selectElement && selectElement.value) {
                            handleAddAttachment(product.id, selectElement.value)
                            selectElement.value = ''
                          } else {
                            alert('첨부 서류를 선택해주세요.')
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                    
                    {/* 첨부 서류 리스트 */}
                    {product.attachments.map((attachment, attIndex) => (
                      <div key={attachment.id} className="product-registration-attachment-item">
                        <span className="product-registration-attachment-label">첨부 서류 {attIndex + 1}</span>
                        <select
                          className="product-registration-select"
                          value={attachment.value}
                          onChange={(e) => handleAttachmentChange(product.id, attachment.id, e.target.value)}
                        >
                          <option value="">선택</option>
                          {attachments.map(att => (
                            <option key={att.id || att} value={att.name || att}>
                              {att.name || att}
                            </option>
                          ))}
                        </select>
                        <button
                          className="product-registration-attachment-delete-btn"
                          onClick={() => handleDeleteAttachment(product.id, attachment.id)}
                        >
                          -
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="product-registration-modal-actions">
          <button className="product-registration-cancel-btn" onClick={handleCancel}>
            {isEditMode && isEditing ? '취소' : '취소'}
          </button>
          {isEditMode ? (
            !isEditing ? (
              <button
                className="product-registration-edit-btn"
                onClick={handleEdit}
              >
                수정하기
              </button>
            ) : (
              <button
                className={`product-registration-save-btn ${isSaveEnabled() ? 'enabled' : 'disabled'}`}
                onClick={handleSave}
                disabled={!isSaveEnabled()}
              >
                수정완료
              </button>
            )
          ) : (
            <button
              className={`product-registration-save-btn ${isSaveEnabled() ? 'enabled' : 'disabled'}`}
              onClick={handleSave}
              disabled={!isSaveEnabled()}
            >
              등록
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductRegistrationModal
