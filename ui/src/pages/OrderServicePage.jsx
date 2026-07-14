import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { orderAPI, documentAPI } from '../utils/api'
import './Payment.css'
import './OrderServicePage.css'

// =============================================================================
// 결제 서비스 입력/확인 페이지 (/order/:orderId)
// -----------------------------------------------------------------------------
// 단일 주문 하나의 상세 정보를 보여주고, 해당 주문에 필요한 첨부 서류를
// 회원이 개별적으로 업로드/삭제할 수 있게 하는 페이지.
//
//  - orderId 는 orders.order_id (YYMMDDHHMMSSxx) 문자열 사용.
//  - 관리자 페이지에서 이 페이지로 링크가 걸립니다.
//  - 로그인 회원 본인 또는 관리자가 접근하는 것을 전제로 하지만,
//    별도 권한 체크는 서버(authenticateToken) 에 위임합니다.
// =============================================================================

/** 파일명에서 이름과 확장자를 분리합니다. */
const splitFileName = (fileName) => {
  if (!fileName) return { base: '', ext: '' }
  const idx = fileName.lastIndexOf('.')
  if (idx === -1) return { base: fileName, ext: '' }
  return { base: fileName.slice(0, idx), ext: fileName.slice(idx + 1) }
}

/** 결제일 표시 포맷: YYYY-MM-DD HH:mm:ss */
const formatPaymentDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const H = String(date.getHours()).padStart(2, '0')
  const M = String(date.getMinutes()).padStart(2, '0')
  const S = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${H}:${M}:${S}`
}

/** 결제 금액 포맷: 50000 → 50,000원 */
const formatPrice = (amount) => {
  if (amount == null) return '-'
  const num = Number(amount)
  if (Number.isNaN(num)) return String(amount)
  return `${new Intl.NumberFormat('ko-KR').format(num)}원`
}

/** DB 저장 상태값 → 화면 표시용 라벨 매핑 */
const STATUS_LABEL_MAP = {
  결제완료: '결제 완료',
  결제대기: '결제 대기',
  신고진행중: '신고 진행 중',
  신고완료: '신고 완료',
  결제취소: '결제 취소',
}

const STATUS_STEPS = ['결제 완료', '신고 진행 중', '신고 완료']

const OrderServicePage = () => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { user } = useAuth()

  const [order, setOrder] = useState(null)
  const [requiredDocs, setRequiredDocs] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // 서류별 업로드 진행 상태(문서 ID → boolean)
  const [uploadingDocs, setUploadingDocs] = useState({})

  // 삭제 Confirm 모달 상태
  const [pendingDelete, setPendingDelete] = useState(null) // { attachment }

  // 서류별 file input ref 저장 (documentId → HTMLInputElement)
  const fileInputRefs = useRef({})

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

      const orderData = orderRes.data.order
      const attachmentsData = orderRes.data.attachments || []
      const allDocs = docsRes?.success ? docsRes.data || [] : []

      // required_documents 는 서버에 문자열(JSON) 로 저장되어 있음.
      // 배열의 요소는 서류 ID(정수) 또는 서류 이름(문자열)일 수 있음.
      let docIds = []
      if (orderData.required_documents) {
        try {
          const parsed =
            typeof orderData.required_documents === 'string'
              ? JSON.parse(orderData.required_documents)
              : orderData.required_documents
          docIds = Array.isArray(parsed) ? parsed : [parsed]
        } catch (_) {
          docIds = []
        }
      }

      const resolved = docIds
        .map((raw) => {
          const asNum = typeof raw === 'string' ? Number(raw) : raw
          if (typeof asNum === 'number' && !Number.isNaN(asNum)) {
            return allDocs.find((d) => d.id === asNum) || null
          }
          // 이름으로 저장된 legacy 케이스 대응
          if (typeof raw === 'string') {
            return allDocs.find((d) => d.name === raw) || { id: null, name: raw }
          }
          return null
        })
        .filter(Boolean)

      setOrder(orderData)
      setRequiredDocs(resolved)
      setAttachments(attachmentsData)
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

  // ---------------------------------------------------------------------------
  // 파생 값
  // ---------------------------------------------------------------------------
  const pageTitle = useMemo(() => {
    if (!order) return ''
    const cat = order.category_name || ''
    const prod = order.product_name || ''
    if (cat && prod) return `${cat} / ${prod}`
    return cat || prod || ''
  }, [order])

  const currentStatusLabel = useMemo(() => {
    if (!order) return ''
    return STATUS_LABEL_MAP[order.status] || order.status || ''
  }, [order])

  const currentStepIndex = STATUS_STEPS.indexOf(currentStatusLabel)

  /** 문서 ID → 첨부된 attachment (없으면 null) */
  const attachmentByDocId = useMemo(() => {
    const map = {}
    for (const att of attachments) {
      if (att.document_id != null) {
        map[att.document_id] = att
      }
    }
    return map
  }, [attachments])

  // ---------------------------------------------------------------------------
  // 파일 업로드
  // ---------------------------------------------------------------------------
  const handleAttachClick = (docId) => {
    const input = fileInputRefs.current[docId]
    if (input) input.click()
  }

  const handleFileChange = async (docId, e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 가능하도록 리셋
    if (!file) return

    const memberId = user?.id || order?.member_id
    if (!memberId) {
      alert('로그인 정보가 없어 파일을 업로드할 수 없습니다.')
      return
    }

    try {
      setUploadingDocs((prev) => ({ ...prev, [docId]: true }))

      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentId', String(docId))
      formData.append('orderId', String(order.id))

      const res = await documentAPI.uploadDocument(memberId, formData)

      if (!res?.success) {
        throw new Error(res?.error || '파일 업로드에 실패했습니다.')
      }

      // 낙관적 갱신 대신 서버 응답을 최신 상태로 병합
      // (동일 서류에 대해 이전 첨부가 있으면 그건 서버에서 어떻게 처리할지에
      //  따라 다르지만, 여기서는 새로 들어온 항목을 목록 앞에 추가하고
      //  같은 document_id 의 예전 값은 제거해서 UI 최신화)
      setAttachments((prev) => {
        const filtered = prev.filter((a) => a.document_id !== Number(docId))
        return [{ ...res.data, document_id: Number(docId), file_name: file.name }, ...filtered]
      })
    } catch (err) {
      console.error('파일 업로드 오류:', err)
      alert(err?.message || '파일 업로드에 실패했습니다.')
    } finally {
      setUploadingDocs((prev) => ({ ...prev, [docId]: false }))
    }
  }

  // ---------------------------------------------------------------------------
  // 파일 삭제 (Confirm)
  // ---------------------------------------------------------------------------
  const requestDelete = (attachment) => {
    setPendingDelete({ attachment })
  }

  const cancelDelete = () => setPendingDelete(null)

  const confirmDelete = async () => {
    if (!pendingDelete?.attachment) return
    const att = pendingDelete.attachment
    const memberId = user?.id || order?.member_id

    if (!memberId) {
      alert('로그인 정보가 없어 삭제할 수 없습니다.')
      setPendingDelete(null)
      return
    }

    try {
      const res = await documentAPI.deleteDocument(memberId, att.id)
      if (!res?.success) {
        throw new Error(res?.error || '삭제에 실패했습니다.')
      }
      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
    } catch (err) {
      console.error('첨부 서류 삭제 오류:', err)
      alert(err?.message || '삭제에 실패했습니다.')
    } finally {
      setPendingDelete(null)
    }
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="payment-wrapper">
        <div className="payment-container">
          <header className="payment-header">
            <button className="payment-back-btn" onClick={() => navigate(-1)} aria-label="뒤로 가기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className="payment-title">결제 서비스 입력/확인 페이지</h1>
          </header>
          <div className="order-service-loading">불러오는 중…</div>
        </div>
      </div>
    )
  }

  if (errorMsg || !order) {
    return (
      <div className="payment-wrapper">
        <div className="payment-container">
          <header className="payment-header">
            <button className="payment-back-btn" onClick={() => navigate(-1)} aria-label="뒤로 가기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className="payment-title">결제 서비스 입력/확인 페이지</h1>
          </header>
          <div className="order-service-error">
            {errorMsg || '주문 정보를 표시할 수 없습니다.'}
          </div>
        </div>
      </div>
    )
  }

  const isCanceled = order.status === '결제취소'

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="payment-title">결제 서비스 입력/확인 페이지</h1>
        </header>

        <div className="order-service-body">
          {/* ==== 페이지 제목 ==== */}
          <h2 className="order-service-page-title">{pageTitle}</h2>

          {/* ==== 주문 정보 ==== */}
          <div className="order-service-info">
            <p>
              <span className="order-service-info-label">주문결제일 :</span>
              <span> {formatPaymentDateTime(order.payment_date || order.created_at)}</span>
            </p>
            <p>
              <span className="order-service-info-label">주문 ID :</span>
              <span> {order.order_id}</span>
            </p>
            <p>
              <span className="order-service-info-label">결제금액:</span>
              <span> {formatPrice(order.payment_amount ?? order.product_price)}</span>
            </p>
          </div>

          {/* ==== 필요 첨부 서류 ==== */}
          <section className="order-service-section">
            <h3 className="order-service-section-title">필요 첨부 서류</h3>

            {requiredDocs.length === 0 ? (
              <p className="order-service-empty">필요한 첨부 서류가 없습니다.</p>
            ) : (
              <ul className="order-service-doc-list">
                {requiredDocs.map((doc, idx) => {
                  const docId = doc.id
                  const attached = docId != null ? attachmentByDocId[docId] : null
                  const isUploading = docId != null && !!uploadingDocs[docId]
                  const { base, ext } = splitFileName(attached?.file_name || '')

                  return (
                    <li key={`${docId ?? doc.name}-${idx}`} className="order-service-doc-item">
                      <div className="order-service-doc-row">
                        <span className="order-service-doc-name">{doc.name}</span>
                        <button
                          type="button"
                          className={`order-service-doc-btn ${attached ? 'attached' : ''}`}
                          disabled={isUploading || docId == null || isCanceled}
                          onClick={() => {
                            if (attached) return // 이미 첨부된 경우엔 삭제 버튼으로만 조작
                            handleAttachClick(docId)
                          }}
                        >
                          {isUploading
                            ? '업로드 중…'
                            : attached
                              ? '서류 첨부완료'
                              : '서류 첨부하기'}
                        </button>
                        <input
                          type="file"
                          ref={(el) => {
                            if (docId != null) fileInputRefs.current[docId] = el
                          }}
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileChange(docId, e)}
                        />
                      </div>

                      {attached && (
                        <div className="order-service-doc-file">
                          <span className="order-service-doc-filename" title={attached.file_name}>
                            {base}
                            {ext ? `.${ext}` : ''}
                          </span>
                          <button
                            type="button"
                            className="order-service-doc-remove"
                            aria-label={`${attached.file_name} 삭제`}
                            onClick={() => requestDelete(attached)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* ==== 진행 상태 ==== */}
          <section className="order-service-section">
            <h3 className="order-service-section-title">진행 상태</h3>
            <div className="order-service-status-row">
              {STATUS_STEPS.map((label, idx) => (
                <span
                  key={label}
                  className={`order-service-status-chip ${idx === currentStepIndex ? 'active' : ''}`}
                >
                  {label}
                </span>
              ))}
            </div>
            {isCanceled && (
              <p className="order-service-cancel-note">해당 주문은 결제 취소된 주문입니다.</p>
            )}
          </section>

          {/* ==== 안내 문구 ==== */}
          <ul className="order-service-guide">
            <li>이 페이지에서는 필요한 정보만 간편하게 입력하고 확인하실 수 있습니다.</li>
            <li>더 자세한 정보와 다양한 서비스는 마이페이지에서 확인 및 이용하실 수 있습니다.</li>
          </ul>

          <div className="order-service-brand">TaxChat</div>
        </div>
      </div>

      {/* ==== 삭제 Confirm Dialog ==== */}
      {pendingDelete?.attachment && (
        <div className="order-service-dialog-overlay" onClick={cancelDelete}>
          <div className="order-service-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="order-service-dialog-msg">
              {pendingDelete.attachment.file_name} 파일을 삭제하시겠습니까?
              <br />
              삭제 후에는 다시 첨부하실 수 있습니다.
            </p>
            <div className="order-service-dialog-actions">
              <button
                type="button"
                className="order-service-dialog-btn primary"
                onClick={confirmDelete}
              >
                삭제하기
              </button>
              <button
                type="button"
                className="order-service-dialog-btn"
                onClick={cancelDelete}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderServicePage
