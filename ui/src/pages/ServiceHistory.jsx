import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { orderAPI, documentAPI } from '../utils/api'
import OrderServiceCard from '../components/OrderServiceCard'
import './Payment.css'
import './OrderServicePage.css'
import './ServiceHistory.css'

// =============================================================================
// 마이페이지 > 서비스 이용 내역 (/service-history)
// -----------------------------------------------------------------------------
// 로그인한 회원의 결제/서비스 이용 내역을 카드 목록 형태로 표시합니다.
// 각 카드는 "결제 서비스 입력/확인 페이지"(/order/:orderId) 와 동일한
// `OrderServiceCard` 공통 컴포넌트를 사용하므로, 동일한 주문에 대해 두 페이지의
// UI/데이터가 항상 일치합니다.
//   - 결제일시 / 상품카테고리명 / 상품명 / 필요 첨부 서류 / 진행 상태
//   - 최신순(주문결제일시 내림차순)으로 정렬
// =============================================================================

const ServiceHistory = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [orders, setOrders] = useState([])
  const [attachmentsByOrder, setAttachmentsByOrder] = useState({}) // { [order.id]: attachment[] }
  const [allDocuments, setAllDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // ---------------------------------------------------------------------------
  // 데이터 로드
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErrorMsg('')

      // 주문 목록 + 회원 첨부서류 + 진열 서류 목록을 한 번에 조회.
      // 주문은 서버에서 '주문결제일시 역순'(최신순)으로 정렬하여 반환합니다.
      const [ordersRes, memberDocsRes, docsRes] = await Promise.all([
        orderAPI.getOrders({
          memberId: user.id,
          limit: 1000,
          sortOrder: '주문결제일시 역순',
        }),
        documentAPI.getMemberDocuments(user.id),
        documentAPI.getDocuments({ usageStatus: '진열' }),
      ])

      if (!ordersRes?.success) {
        throw new Error(ordersRes?.error || '주문 목록을 불러오지 못했습니다.')
      }

      const orderList = ordersRes.data || []
      const memberDocs = memberDocsRes?.success ? memberDocsRes.data || [] : []
      const docs = docsRes?.success ? docsRes.data || [] : []

      // order.id 별로 첨부 서류 그룹핑 (삭제되지 않은 것만).
      const grouped = {}
      for (const md of memberDocs) {
        if (md.deleted) continue
        if (md.order_id == null) continue
        if (!grouped[md.order_id]) grouped[md.order_id] = []
        grouped[md.order_id].push(md)
      }

      setOrders(orderList)
      setAttachmentsByOrder(grouped)
      setAllDocuments(docs)
    } catch (err) {
      console.error('서비스 이용 내역 로드 오류:', err)
      setErrorMsg(err?.message || '서비스 이용 내역을 불러오는 중 오류가 발생했습니다.')
      setOrders([])
      setAttachmentsByOrder({})
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ---------------------------------------------------------------------------
  // 정렬 보정 - 서버 정렬을 신뢰하되, 안전을 위해 클라에서도 최신순으로 정렬합니다.
  // 정렬 기준: payment_date > created_at
  // ---------------------------------------------------------------------------
  const sortedOrders = useMemo(() => {
    const getTime = (o) => {
      const raw = o.payment_date || o.created_at
      if (!raw) return 0
      const t = new Date(raw).getTime()
      return Number.isNaN(t) ? 0 : t
    }
    return [...orders].sort((a, b) => getTime(b) - getTime(a))
  }, [orders])

  // ---------------------------------------------------------------------------
  // 특정 카드에서 첨부 상태가 변경되면 부모 state 도 즉시 동기화합니다.
  // 이렇게 하면 같은 화면에서 여러 카드가 나열돼 있어도 재렌더링이 자연스러움.
  // ---------------------------------------------------------------------------
  const handleAttachmentsChange = (orderIdNum, nextAttachments) => {
    setAttachmentsByOrder((prev) => ({
      ...prev,
      [orderIdNum]: nextAttachments,
    }))
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/mypage')}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">서비스 이용 내역</h1>
        </header>

        {/* Service History List */}
        <div className="service-history-list">
          {loading ? (
            <div className="service-history-empty">불러오는 중…</div>
          ) : errorMsg ? (
            <div className="service-history-empty service-history-error">{errorMsg}</div>
          ) : sortedOrders.length === 0 ? (
            <div className="service-history-empty">이용 내역이 없습니다.</div>
          ) : (
            sortedOrders.map((order) => (
              <OrderServiceCard
                key={order.id}
                order={order}
                initialAttachments={attachmentsByOrder[order.id] || []}
                allDocuments={allDocuments}
                memberId={user?.id}
                onAttachmentsChange={(next) => handleAttachmentsChange(order.id, next)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ServiceHistory
