import { useNavigate, useSearchParams } from 'react-router-dom'
import './Payment.css'
import './CheckoutPage.css'

// =============================================================================
// 결제 실패 페이지 (Toss failUrl 콜백)
// -----------------------------------------------------------------------------
// 결제창에서 인증 실패 / 사용자 취소 / 카드사 오류 등이 발생하면 이 페이지로
// redirect 됩니다. Toss 가 ?code=...&message=...&orderId=... 형태로 사유를 전달합니다.
// =============================================================================
const PaymentFail = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const code = searchParams.get('code') || ''
  const message = searchParams.get('message') || '결제가 정상적으로 완료되지 않았습니다.'
  const orderId = searchParams.get('orderId') || ''

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        <header className="payment-header">
          <h1 className="payment-title">결제 실패</h1>
        </header>

        <div style={{ padding: '2rem 1.25rem' }}>
          <h2 style={{ color: '#b32424', marginBottom: '1rem' }}>결제에 실패했습니다.</h2>
          <ul style={{ lineHeight: 1.9, listStyle: 'none', padding: 0 }}>
            {orderId && (
              <li><strong>주문번호</strong> : {orderId}</li>
            )}
            {code && (
              <li><strong>코드</strong> : {code}</li>
            )}
            <li><strong>사유</strong> : {message}</li>
          </ul>
        </div>

        <div className="form-footer" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="payment-btn active"
            onClick={() => navigate(-1)}
            style={{ flex: 1 }}
          >
            다시 결제하기
          </button>
          <button
            className="payment-btn"
            onClick={() => navigate('/')}
            style={{ flex: 1, background: '#999' }}
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentFail
