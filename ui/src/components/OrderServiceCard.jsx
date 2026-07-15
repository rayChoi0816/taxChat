import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { documentAPI } from '../utils/api'
import '../pages/OrderServicePage.css'

// =============================================================================
// OrderServiceCard
// -----------------------------------------------------------------------------
// 결제된 주문 하나의 상세를 카드 형태로 표시하는 공통 컴포넌트입니다.
//
// 이 컴포넌트는 두 페이지에서 재사용되어 "동일한 주문에 대해 동일한 UI/데이터"
// 를 보장합니다.
//   1) /order/:orderId  — 결제 서비스 입력/확인 페이지 (단일 카드)
//   2) /service-history — 마이페이지 > 서비스 이용 내역 (여러 카드 목록)
//
// props:
//   - order              : orders 테이블에서 조회한 원본 주문 객체 (필수)
//   - initialAttachments : 이 주문의 member_documents (deleted=false) 배열
//   - allDocuments       : 진열 상태(usage_status='진열') 서류 목록.
//                          order.required_documents 를 이름으로 매핑할 때 사용.
//   - memberId (opt)     : 파일 업로드/삭제 API 에 사용할 회원 ID.
//                          미지정 시 로그인한 user.id 를 사용하고, 그도 없으면
//                          order.member_id 를 fallback 으로 사용합니다.
//   - onAttachmentsChange(nextAttachments) : 카드 내부의 첨부 상태가 변할 때
//                          부모에게 알리기 위한 콜백. ServiceHistory 처럼 여러
//                          카드가 나열된 화면에서 상위 리스트를 동기화할 수 있게
//                          해 줍니다.
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

const OrderServiceCard = ({
  order,
  initialAttachments = [],
  allDocuments = [],
  memberId: memberIdProp,
  onAttachmentsChange,
  hideTitle = false,
}) => {
  const { user } = useAuth()

  // 첨부 파일 리스트. 부모에서 initialAttachments 가 갱신되면(예: 재로드)
  // 그 값을 반영하도록 useEffect 로 동기화합니다.
  const [attachments, setAttachments] = useState(initialAttachments)
  useEffect(() => {
    setAttachments(initialAttachments)
  }, [initialAttachments])

  const [uploadingDocs, setUploadingDocs] = useState({})
  const [pendingDelete, setPendingDelete] = useState(null)

  const fileInputRefs = useRef({})

  const memberId = memberIdProp ?? user?.id ?? order?.member_id ?? null

  // 부모에게 첨부 리스트 변경 알림 (렌더 사이드이펙트로 통지)
  const emitChange = useCallback(
    (next) => {
      if (typeof onAttachmentsChange === 'function') {
        onAttachmentsChange(next)
      }
    },
    [onAttachmentsChange]
  )

  // ---------------------------------------------------------------------------
  // required_documents 파싱: JSON 문자열 또는 배열. 아이템은 서류 ID(정수) 또는
  // 서류 이름(문자열) 을 모두 허용.
  // ---------------------------------------------------------------------------
  const requiredDocs = useMemo(() => {
    if (!order) return []

    let docIds = []
    if (order.required_documents) {
      try {
        const parsed =
          typeof order.required_documents === 'string'
            ? JSON.parse(order.required_documents)
            : order.required_documents
        docIds = Array.isArray(parsed) ? parsed : [parsed]
      } catch (_) {
        docIds = []
      }
    }

    return docIds
      .map((raw) => {
        const asNum = typeof raw === 'string' ? Number(raw) : raw
        if (typeof asNum === 'number' && !Number.isNaN(asNum)) {
          return allDocuments.find((d) => d.id === asNum) || null
        }
        if (typeof raw === 'string') {
          return allDocuments.find((d) => d.name === raw) || { id: null, name: raw }
        }
        return null
      })
      .filter(Boolean)
  }, [order, allDocuments])

  const currentStatusLabel = STATUS_LABEL_MAP[order?.status] || order?.status || ''
  const currentStepIndex = STATUS_STEPS.indexOf(currentStatusLabel)
  const isCanceled = order?.status === '결제취소'

  /** 문서 ID → 첨부된 attachment (없으면 undefined) */
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
    e.target.value = ''
    if (!file) return

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

      setAttachments((prev) => {
        const filtered = prev.filter((a) => a.document_id !== Number(docId))
        const next = [
          { ...res.data, document_id: Number(docId), file_name: file.name },
          ...filtered,
        ]
        emitChange(next)
        return next
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
  const requestDelete = (attachment) => setPendingDelete({ attachment })
  const cancelDelete = () => setPendingDelete(null)

  const confirmDelete = async () => {
    if (!pendingDelete?.attachment) return
    const att = pendingDelete.attachment

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
      setAttachments((prev) => {
        const next = prev.filter((a) => a.id !== att.id)
        emitChange(next)
        return next
      })
    } catch (err) {
      console.error('첨부 서류 삭제 오류:', err)
      alert(err?.message || '삭제에 실패했습니다.')
    } finally {
      setPendingDelete(null)
    }
  }

  if (!order) return null

  const cardTitle = (() => {
    const cat = order.category_name || ''
    const prod = order.product_name || ''
    if (cat && prod) return `${cat} / ${prod}`
    return cat || prod || ''
  })()

  return (
    <div className="order-service-card">
      {/* ==== 카드 제목: 상품카테고리명 / 상품명 ==== */}
      {!hideTitle && cardTitle && (
        <h3 className="order-service-card-title" title={cardTitle}>
          {cardTitle}
        </h3>
      )}

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
        <h4 className="order-service-section-title">필요 첨부 서류</h4>

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
                        if (attached) return
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
                      <span
                        className="order-service-doc-filename"
                        title={attached.file_name}
                      >
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
        <h4 className="order-service-section-title">진행 상태</h4>
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

export default OrderServiceCard
