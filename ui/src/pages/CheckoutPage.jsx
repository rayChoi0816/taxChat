import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import './Payment.css'
import './CheckoutPage.css'
import { useAuth } from '../contexts/AuthContext'
import { generateOrderId, requestTossPayment } from '../utils/tossPayments'
import { productAPI, documentAPI } from '../utils/api'

// 결제하기 페이지
// -----------------------------------------------------------------------------
// 진입 경로 두 가지를 모두 지원합니다.
//
//  (A) 정상 흐름
//      ProductSelection → navigate('/checkout', { state: { product, category } })
//      이 경우 location.state.product / category 를 그대로 사용합니다.
//
//  (B) 상품 결제 링크 진입
//      /checkout/:productId  (예: https://.../checkout/12)
//      관리자 상품 관리 페이지에서 생성된 개별 상품 결제 링크로 진입한 경우.
//      state 가 없으므로 URL 파라미터 productId 로 서버에서 상품을 조회하고,
//      ProductSelection 이 만들던 것과 동일한 모양의 product 객체를 구성합니다.
//
// - 하단 "결제에 동의합니다." 체크박스가 체크되어야 결제하기 버튼이 활성화되고,
//   클릭하면 TossPayments 결제창이 열립니다.
const CheckoutPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { user } = useAuth()

  const stateProduct = location.state?.product || null
  const stateCategory = location.state?.category || null
  const linkProductId = params?.productId || null

  // 상품/카테고리 정보. state 로 이미 넘어온 경우 그 값을 초기값으로 세팅하고,
  // 링크 진입인 경우엔 useEffect 에서 서버 조회 후 채웁니다.
  const [product, setProduct] = useState(stateProduct)
  // eslint-disable-next-line no-unused-vars
  const [category, setCategory] = useState(stateCategory)
  const [loading, setLoading] = useState(!stateProduct && !!linkProductId)
  const [loadError, setLoadError] = useState('')

  const [agreed, setAgreed] = useState(false)
  const [paying, setPaying] = useState(false)

  // 주문 ID 는 페이지 진입 시 한 번 발급. UUID v4 사용.
  const orderId = useMemo(() => generateOrderId(), [])

  // -------------------------------------------------------------------------
  // 진입 경로 처리
  //  - state 로 상품이 넘어온 경우: 그대로 사용
  //  - URL 파라미터 productId 만 있는 경우: 서버에서 조회 후 product 구성
  //  - 둘 다 없는 경우: 이전 페이지로 되돌려 보내기
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (stateProduct) return // (A) 정상 흐름: 이미 상품 정보를 가지고 있음

    if (!linkProductId) {
      alert('결제할 상품을 먼저 선택해 주세요.')
      navigate(-1)
      return
    }

    let cancelled = false

    const buildProductFromServer = async () => {
      try {
        setLoading(true)
        setLoadError('')

        // 진열 상태인 서류 목록을 미리 로드해서 required_documents(ID/이름) 를
        // 사용자에게 보여줄 서류명으로 변환합니다.
        const [productRes, documentsRes] = await Promise.all([
          productAPI.getProduct(linkProductId),
          documentAPI.getDocuments({ usageStatus: '진열' }),
        ])

        if (cancelled) return

        if (!productRes?.success) {
          throw new Error(productRes?.error || '상품 정보를 불러오지 못했습니다.')
        }

        const raw = productRes.data
        const allDocs = documentsRes?.success ? documentsRes.data || [] : []

        // required_documents 파싱 (JSON 문자열/배열/단일값 모두 대응)
        let documentIds = []
        if (raw.required_documents) {
          try {
            const parsed =
              typeof raw.required_documents === 'string'
                ? JSON.parse(raw.required_documents)
                : raw.required_documents
            documentIds = Array.isArray(parsed) ? parsed : [parsed]
          } catch (_) {
            documentIds = []
          }
        }

        const documents = documentIds
          .map((docId) => {
            const id = typeof docId === 'string' ? Number(docId) : docId
            if (Number.isFinite(id)) {
              return allDocs.find((d) => d.id === id) || null
            }
            if (typeof docId === 'string') {
              return allDocs.find((d) => d.name === docId) || { id: null, name: docId }
            }
            return null
          })
          .filter(Boolean)

        const nextProduct = {
          id: raw.id,
          categoryName: raw.category_name || '',
          name: raw.name,
          code: raw.code,
          price: raw.price,
          description: raw.description || '',
          paymentDescription: raw.payment_description || '',
          documents,
        }

        setProduct(nextProduct)
        setCategory(raw.category_name ? { id: raw.category_id, name: raw.category_name } : null)
      } catch (err) {
        if (cancelled) return
        console.error('상품 결제 링크 진입 - 상품 조회 실패:', err)
        setLoadError(err?.message || '상품 정보를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    buildProductFromServer()

    return () => {
      cancelled = true
    }
  }, [stateProduct, linkProductId, navigate])

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

  // 로딩 상태 (상품 결제 링크로 진입해서 서버 조회 중)
  if (loading) {
    return (
      <div className="payment-wrapper">
        <div className="payment-container">
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
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#666' }}>
            상품 정보를 불러오는 중…
          </div>
        </div>
      </div>
    )
  }

  // 오류 상태 (존재하지 않거나 삭제된 상품 등)
  if (loadError || !product) {
    return (
      <div className="payment-wrapper">
        <div className="payment-container">
          <header className="payment-header">
            <button
              className="payment-back-btn"
              onClick={() => navigate('/')}
              aria-label="홈으로"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h1 className="payment-title">결제하기 페이지</h1>
          </header>
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <p style={{ color: '#dc2626', marginBottom: '1rem', fontWeight: 600 }}>
              {loadError || '상품 정보를 표시할 수 없습니다.'}
            </p>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              존재하지 않거나 이미 삭제된 상품일 수 있습니다.
              <br />
              다른 상품을 선택해 주세요.
            </p>
            <button
              className="payment-btn active"
              style={{ maxWidth: 240, margin: '0 auto' }}
              onClick={() => navigate('/payment')}
            >
              상품 목록으로 이동
            </button>
          </div>
        </div>
      </div>
    )
  }

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
