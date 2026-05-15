import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './CheckoutPage.css'
import { useAuth } from '../contexts/AuthContext'
import { generateOrderId, requestTossPayment } from '../utils/tossPayments'

// 결제하기 페이지
// - ProductSelection 에서 "결제하기" 버튼을 누르면 이 페이지로 이동됩니다.
// - location.state.product 에 ProductSelection 에서 선택한 상품이 들어오며,
//   상품 선택 상세 페이지의 `.payment-item-card.selected` 와 동일한 UI 로 보여줍니다.
// - 하단의 "위 내용을 확인하였으며 결제에 동의합니다." 체크박스가 체크되어야
//   결제하기 버튼이 활성화되고, 클릭하면 TossPayments 결제창이 열립니다.
const CheckoutPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const product = location.state?.product || null
  const category = location.state?.category || null

  const [agreed, setAgreed] = useState(false)
  const [paying, setPaying] = useState(false)

  // 주문 ID 는 페이지 진입 시 한 번 발급. UUID v4 사용.
  // - Toss 는 orderId 6~64 자 (영문/숫자/-/_) 를 요구하며 UUID 가 이 조건을 만족합니다.
  // - 결제창에서 재시도 시에도 같은 orderId 가 유지되도록 useMemo 로 캐시합니다.
  const orderId = useMemo(() => generateOrderId(), [])

  // 상품 정보 없이 직접 URL 로 진입한 경우에는 이전 페이지로 되돌려 보냅니다.
  useEffect(() => {
    if (!product) {
      alert('결제할 상품을 먼저 선택해 주세요.')
      navigate(-1)
    }
  }, [product, navigate])

  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price || 0)

  const handlePay = async () => {
    if (!agreed || paying || !product) return

    const amount = Number(product.price)
    if (!amount || amount <= 0) {
      alert('결제 금액이 올바르지 않습니다.')
      return
    }

    try {
      setPaying(true)
      // 결제 진행 직전에 사용자에게 보여줄 정보를 sessionStorage 에 임시 저장.
      // success / fail 페이지에서 표시·검증에 활용합니다.
      sessionStorage.setItem(
        'pendingPayment',
        JSON.stringify({
          orderId,
          amount,
          productId: product.id,
          productName: product.name,
          memberId: user?.id || null,
        }),
      )

      await requestTossPayment({
        amount,
        orderId,
        orderName: product.name || '상품 결제',
        customerName: user?.name || user?.business_name || undefined,
        customerEmail: user?.email || undefined,
        method: '카드',
      })
      // requestPayment 는 결제 성공 시 successUrl 로 redirect 되므로
      // 이 시점 이후의 코드는 일반적으로 실행되지 않습니다.
    } catch (err) {
      // 사용자가 결제창을 닫거나 카드사 인증에서 실패한 경우.
      console.error('TossPayments requestPayment 실패:', err)
      const message = err?.message || '결제 요청 중 오류가 발생했습니다.'
      // 사용자가 직접 닫은 경우(USER_CANCEL) 는 조용히 무시.
      if (err?.code !== 'USER_CANCEL') {
        alert(message)
      }
    } finally {
      setPaying(false)
    }
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

        {/* 선택한 상품 카드
         *  - 상품 선택 페이지와 동일한 클래스(`payment-item-card selected`) 를 유지하되,
         *    결제 페이지에서는 비활성(읽기 전용) 스타일로 표시되도록 `checkout-product-card`
         *    에서 오버라이드합니다.
         *  - 클릭 이벤트를 연결하지 않아 선택/해제가 불가능합니다. */}
        <div className="payment-items checkout-items">
          <div
            className="payment-item-card selected checkout-product-card"
            aria-disabled="true"
          >
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
            className={`payment-btn ${agreed && !paying ? 'active' : 'disabled'}`}
            onClick={handlePay}
            disabled={!agreed || paying}
          >
            {paying ? '결제창 여는 중...' : '결제하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
