import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { orderAPI, documentAPI } from '../utils/api'
import OrderServiceCard from '../components/OrderServiceCard'
import './Payment.css'
import './OrderServicePage.css'

// =============================================================================
// 결제 서비스 입력/확인 페이지 (/order/:orderId)
// -----------------------------------------------------------------------------
// 단일 주문 하나의 상세 정보를 카드 형태로 표시하고, 해당 주문에 필요한 첨부
// 서류를 회원이 개별적으로 업로드/삭제할 수 있게 하는 페이지.
//
// 실제 카드 UI/로직은 `OrderServiceCard` 공통 컴포넌트가 담당하고, 이 페이지는
// 라우트 파라미터로 받은 orderId 로 데이터를 로드해서 카드에 넘겨주는 얇은
// 래퍼입니다. 이렇게 하면 마이페이지 > 서비스 이용 내역 페이지가 동일한 카드
// 컴포넌트를 재사용하므로 두 페이지의 UI/데이터가 항상 동일하게 유지됩니다.
// =============================================================================

const OrderServicePage = () => {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [order, setOrder] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [allDocuments, setAllDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // ---------------------------------------------------------------------------
  // 주문 + 첨부서류 로드
  // ---------------------------------------------------------------------------
  const loadOrder = useCallback(async () => {
    if (!orderId) return
    try {
      setLoading(true)
      setErrorMsg('')

      const [orderRes, docsRes] = await Promise.all([
        orderAPI.getOrderByOrderId(orderId),
        documentAPI.getDocuments({ usageStatus: '진열' }),
      ])

      if (!orderRes?.success) {
        throw new Error(orderRes?.error || '주문 정보를 불러오지 못했습니다.')
      }

      setOrder(orderRes.data.order)
      setAttachments(orderRes.data.attachments || [])
      setAllDocuments(docsRes?.success ? docsRes.data || [] : [])
    } catch (err) {
      console.error('주문 상세 로드 오류:', err)
      setErrorMsg(err?.message || '주문 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const pageTitle = useMemo(() => {
    if (!order) return ''
    const cat = order.category_name || ''
    const prod = order.product_name || ''
    if (cat && prod) return `${cat} / ${prod}`
    return cat || prod || ''
  }, [order])

  // ---------------------------------------------------------------------------
  // 헤더 - 좌측: 페이지 제목, 우측: 닫기(X) 버튼
  //   * 팝업/새 창(window.opener 존재)이면 window.close()
  //   * 아니면 history.back() → 그것도 불가하면 홈으로 이동
  // ---------------------------------------------------------------------------
  const handleClose = () => {
    try {
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        window.close()
        return
      }
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/')
      }
    } catch (_) {
      navigate('/')
    }
  }

  const renderHeader = (titleText) => (
    <header className="payment-header order-service-header">
      <h1
        className="payment-title order-service-header-title"
        title={titleText || undefined}
      >
        {titleText}
      </h1>
      <button
        type="button"
        className="order-service-close-btn"
        onClick={handleClose}
        aria-label="닫기"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </header>
  )

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="payment-wrapper">
        <div className="payment-container">
          {renderHeader('')}
          <div className="order-service-loading">불러오는 중…</div>
        </div>
      </div>
    )
  }

  if (errorMsg || !order) {
    return (
      <div className="payment-wrapper">
        <div className="payment-container">
          {renderHeader('')}
          <div className="order-service-error">
            {errorMsg || '주문 정보를 표시할 수 없습니다.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {renderHeader(pageTitle)}

        <div className="order-service-body">
          {/*
            단일 주문 카드.
            제목(상품카테고리명 / 상품명)은 이미 페이지 헤더에서 표시되므로
            카드 자체 제목은 숨겨도 되지만, 컴포넌트 일관성을 위해 카드가
            자체 제목을 표시해도 자연스럽게 보이도록 CSS 로 배치하였습니다.
          */}
          <OrderServiceCard
            order={order}
            initialAttachments={attachments}
            allDocuments={allDocuments}
            onAttachmentsChange={setAttachments}
            hideTitle
          />

          {/* ==== 안내 문구 ==== */}
          <ul className="order-service-guide">
            <li>이 페이지에서는 필요한 정보만 간편하게 입력하고 확인하실 수 있습니다.</li>
            <li>더 자세한 정보와 다양한 서비스는 마이페이지에서 확인 및 이용하실 수 있습니다.</li>
          </ul>

          <div className="order-service-brand">TaxChat</div>
        </div>
      </div>
    </div>
  )
}

export default OrderServicePage
