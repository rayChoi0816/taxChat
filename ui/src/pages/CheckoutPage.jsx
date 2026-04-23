import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './CheckoutPage.css'

// 결제하기 페이지
// - ProductSelection 에서 "결제하기" 버튼을 누르면 이 페이지로 이동됩니다.
// - location.state.product 에 ProductSelection 에서 선택한 상품이 들어오며,
//   상품 선택 상세 페이지의 `.payment-item-card.selected` 와 동일한 UI 로 보여줍니다.
// - 하단의 "위 내용을 확인하였으며 결제에 동의합니다." 체크박스가 체크되어야만
//   결제하기 버튼이 활성화됩니다. (PG 연동은 준비 중)
const CheckoutPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const product = location.state?.product || null
  const category = location.state?.category || null

  const [agreed, setAgreed] = useState(false)

  // 상품 정보 없이 직접 URL 로 진입한 경우에는 이전 페이지로 되돌려 보냅니다.
  useEffect(() => {
    if (!product) {
      alert('결제할 상품을 먼저 선택해 주세요.')
      navigate(-1)
    }
  }, [product, navigate])

  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price || 0)

  const handlePay = () => {
    if (!agreed) return
    alert('PG 연동 준비 중입니다.')
  }

  if (!product) return null

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button
            className="payment-back-btn"
            onClick={() => navigate(-1)}
            aria-label="뒤로 가기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">결제하기 페이지</h1>
        </header>

        {/* 선택한 상품 카드 (상품 선택 페이지의 .selected 카드와 동일 UI) */}
        <div className="payment-items checkout-items">
          <div className="payment-item-card selected checkout-product-card">
            <h3 className="payment-item-title">{product.name}</h3>
            {product.description && (
              <div
                className="product-description-text"
                style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}
              >
                <p>{product.description}</p>
              </div>
            )}
            {product.documents && product.documents.length > 0 && (
              <div className="product-documents">
                <p className="documents-label">&lt;첨부 서류&gt;</p>
                <ul className="documents-list">
                  {product.documents.map((doc, index) => (
                    <li key={doc.id || index}>
                      <strong>{doc.name}</strong>
                      {doc.description && ` - ${doc.description}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="payment-item-price">가격 {formatPrice(product.price)}원</p>
          </div>
        </div>

        {/* 결제 페이지 상품 설명 (상품등록 모달에서 입력한 내용) */}
        <div className="checkout-description">
          {product.paymentDescription ? (
            // 줄바꿈을 그대로 유지해서 출력
            <p>{product.paymentDescription}</p>
          ) : (
            <p className="checkout-description-empty">
              결제페이지 상품 설명이 아직 등록되지 않았습니다.
            </p>
          )}
        </div>

        {/* 동의 체크 영역 */}
        <div className="checkout-agree">
          <label className="checkout-agree-label">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>위 내용을 확인하였으며 결제에 동의합니다.</span>
          </label>
        </div>

        {/* Footer: 결제하기 버튼 */}
        <div className="form-footer">
          <button
            className={`payment-btn ${agreed ? 'active' : 'disabled'}`}
            onClick={handlePay}
            disabled={!agreed}
          >
            결제하기
          </button>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
