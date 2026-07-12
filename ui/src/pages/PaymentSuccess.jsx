import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './Payment.css'
import './CheckoutPage.css'
import { paymentAPI } from '../utils/api'

// =============================================================================
// 결제 성공 페이지 (Toss successUrl 콜백)
// -----------------------------------------------------------------------------
// TossPayments 결제창에서 결제 인증을 마치면 이 페이지로 redirect 됩니다.
// 쿼리스트링으로 paymentKey / orderId / amount 가 전달되며,
// 이 값들을 서버(시크릿 키 보관) 에 넘겨 실제 "결제 승인" 까지 마무리합니다.
//   1. URL 파라미터 파싱
//   2. POST /api/payments/toss/confirm 호출 (서버에서 Toss 승인 API 호출)
//   3. 우리 DB 에 주문 생성 (orderAPI.createOrder) — 실패해도 결제 자체는 성공 처리
//   4. 결과 화면 표시
// =============================================================================
const PaymentSuccess = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  const [status, setStatus] = useState('processing') // processing | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmed, setConfirmed] = useState(null)
  // React 18 StrictMode dev 환경에서 useEffect 가 두 번 호출돼도
  // 결제 승인 API 는 한 번만 쏘도록 보호합니다. (멱등성)
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    if (!paymentKey || !orderId || !amount) {
      setStatus('error')
      setErrorMsg('결제 정보가 누락되었습니다.')
      return
    }
    calledRef.current = true

    const pendingRaw = sessionStorage.getItem('pendingPayment')
    const pending = pendingRaw ? JSON.parse(pendingRaw) : null

    const run = async () => {
      try {
        // 서버가 승인 성공 시 orders + payments 를 함께 저장하도록 memberId/productId 를 함께 전달.
        // (이전엔 프론트에서 별도로 orderAPI.createOrder 를 호출했으나,
        //  로그인 토큰 유실이나 sessionStorage 손실로 저장이 실패하는 케이스가 있어
        //  서버 단일 지점에서 원자적으로 처리하도록 변경했습니다.)
        const res = await paymentAPI.confirmTossPayment({
          paymentKey,
          orderId,
          amount: Number(amount),
          memberId: pending?.memberId || null,
          productId: pending?.productId || null,
        })

        if (!res?.success) {
          throw new Error(res?.error || '결제 승인에 실패했습니다.')
        }

        setConfirmed(res.data)
        setStatus('success')

        sessionStorage.removeItem('pendingPayment')
      } catch (err) {
        console.error('결제 승인 실패:', err)
        setStatus('error')
        setErrorMsg(err?.message || '결제 승인 중 오류가 발생했습니다.')
      }
    }
    run()
  }, [paymentKey, orderId, amount])

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        <header className="payment-header">
          <h1 className="payment-title">결제 결과</h1>
        </header>

        <div style={{ padding: '2rem 1.25rem' }}>
          {status === 'processing' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>결제를 승인하고 있습니다…</p>
              <p style={{ color: '#666' }}>잠시만 기다려 주세요.</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <h2 style={{ color: '#1f7a3a', marginBottom: '1rem' }}>결제가 완료되었습니다.</h2>
              <ul style={{ lineHeight: 1.9, listStyle: 'none', padding: 0 }}>
                <li><strong>주문번호</strong> : {confirmed?.orderId}</li>
                <li><strong>상품명</strong> : {confirmed?.orderName}</li>
                <li><strong>결제수단</strong> : {confirmed?.method}</li>
                <li>
                  <strong>결제금액</strong> :{' '}
                  {new Intl.NumberFormat('ko-KR').format(confirmed?.totalAmount || 0)}원
                </li>
                <li><strong>승인시각</strong> : {confirmed?.approvedAt}</li>
              </ul>
              {confirmed?.receiptUrl && (
                <p style={{ marginTop: '1rem' }}>
                  <a href={confirmed.receiptUrl} target="_blank" rel="noopener noreferrer">
                    영수증 보기
                  </a>
                </p>
              )}
            </div>
          )}

          {status === 'error' && (
            <div>
              <h2 style={{ color: '#b32424', marginBottom: '1rem' }}>결제 승인 실패</h2>
              <p style={{ color: '#555' }}>{errorMsg}</p>
            </div>
          )}
        </div>

        <div className="form-footer">
          <button
            className="payment-btn active"
            onClick={() => navigate('/')}
            disabled={status === 'processing'}
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentSuccess
