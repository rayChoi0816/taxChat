import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import './ServiceHistory.css'
import { useAuth } from '../contexts/AuthContext'
import { orderAPI, documentAPI } from '../utils/api'

const ServiceHistory = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [serviceHistory, setServiceHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [allDocuments, setAllDocuments] = useState([])

  // 진열 상태인 모든 서류 정보 조회
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const documentsResponse = await documentAPI.getDocuments({ usageStatus: '진열' })
        if (documentsResponse.success) {
          setAllDocuments(documentsResponse.data)
        }
      } catch (error) {
        console.error('서류 정보 조회 오류:', error)
      }
    }
    loadDocuments()
  }, [])

  // 주문 목록 로드
  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // 현재 사용자의 주문만 조회
        const ordersResponse = await orderAPI.getOrders({
          memberId: user.id,
          limit: 1000 // 모든 주문 가져오기
        })
        
        // 회원이 첨부한 서류 목록 조회
        const memberDocumentsResponse = await documentAPI.getMemberDocuments(user.id)
        const memberDocuments = memberDocumentsResponse.success ? memberDocumentsResponse.data : []
        
        if (ordersResponse.success) {
          // API 응답을 프론트엔드 형식으로 변환
          const formattedHistory = ordersResponse.data.map((order) => {
            // required_documents 파싱
            let documentIds = []
            if (order.required_documents) {
              try {
                const parsed = typeof order.required_documents === 'string'
                  ? JSON.parse(order.required_documents)
                  : order.required_documents
                documentIds = Array.isArray(parsed) ? parsed : [parsed]
              } catch (e) {
                console.error('서류 ID 파싱 오류:', e)
                documentIds = []
              }
            }

            // 서류 ID를 서류 정보로 변환
            const documents = documentIds
              .map(docId => {
                const id = typeof docId === 'string' ? parseInt(docId) : docId
                if (isNaN(id)) {
                  return allDocuments.find(doc => doc.name === docId)
                }
                return allDocuments.find(doc => doc.id === id)
              })
              .filter(doc => doc !== undefined)

            // 이 주문에 첨부된 서류 확인 (order_id로 필터링)
            const orderMemberDocuments = memberDocuments.filter(
              md => md.order_id === order.id && !md.deleted
            )

            // 각 필요한 서류가 첨부되었는지 확인
            const documentsWithStatus = documents.map(doc => {
              const isAttached = orderMemberDocuments.some(md => md.document_id === doc.id)
              return {
                id: doc.id,
                name: doc.name,
                status: isAttached ? '완료' : '필요'
              }
            })
              
            // 날짜 포맷팅 (YY.MM.DD. HH:MM)
            const formatPaymentDate = (dateStr) => {
              if (!dateStr) return ''
              const date = new Date(dateStr)
              const year = String(date.getFullYear()).slice(-2)
              const month = String(date.getMonth() + 1).padStart(2, '0')
              const day = String(date.getDate()).padStart(2, '0')
              const hours = String(date.getHours()).padStart(2, '0')
              const minutes = String(date.getMinutes()).padStart(2, '0')
              return `${year}.${month}.${day}. ${hours}:${minutes}`
            }

            // 상태 변환 (결제완료 -> 결제 완료, 신고진행중 -> 신고 진행 중, 신고완료 -> 신고 완료)
            const statusMap = {
              '결제완료': '결제 완료',
              '신고진행중': '신고 진행 중',
              '신고완료': '신고 완료',
              '결제대기': '결제 대기'
            }

            return {
              id: order.id,
              orderId: order.order_id,
              serviceName: order.category_name || '서비스',
              paymentDate: formatPaymentDate(order.payment_date),
              serviceType: order.product_name || '',
              status: statusMap[order.status] || order.status,
              documents: documentsWithStatus
            }
          })
          
          setServiceHistory(formattedHistory)
        } else {
          console.error('주문 목록 조회 실패:', ordersResponse)
          setServiceHistory([])
        }
      } catch (error) {
        console.error('주문 목록 조회 오류:', error)
        setServiceHistory([])
      } finally {
        setLoading(false)
      }
    }

    // allDocuments가 로드된 후에 주문 목록 로드
    if (user?.id) {
      loadOrders()
    }
  }, [user, allDocuments])

  const getActionButton = (item) => {
    const isCompleted = item.status === '신고 완료'

    if (isCompleted) {
      return {
        text: '납부 확인서 다운 받기',
        message: '신고가 완료되면 납부확인서를 다운로드할 수 있습니다.'
      }
    } else {
      return null
    }
  }

  const handleActionClick = (item) => {
    const action = getActionButton(item)
    
    if (action && action.text === '납부 확인서 다운 받기') {
      alert('납부 확인서를 다운로드합니다.')
    }
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/mypage')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">서비스 이용 내역</h1>
        </header>

        {/* Service History List */}
        <div className="service-history-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
          ) : serviceHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>이용 내역이 없습니다.</div>
          ) : (
            serviceHistory.map((item) => {
            const action = getActionButton(item)
            const statusButtons = ['결제 완료', '신고 진행 중', '신고 완료']
            const currentStatusIndex = statusButtons.indexOf(item.status)

            return (
              <div key={item.id} className="service-history-card">
                {/* Service Info */}
                <div className="service-info">
                  <h3 className="service-name">{item.serviceName}</h3>
                  <p className="service-payment-date">결제일시: {item.paymentDate}</p>
                  <p className="service-type">{item.serviceType}</p>
                </div>

                {/* Document Status */}
                <div className="document-status">
                  <p className="document-status-label">&lt;첨부 서류 상태&gt;</p>
                  {item.documents && item.documents.length > 0 ? (
                    <ul className="document-list">
                      {item.documents.map((doc, index) => (
                        <li key={index} className="document-item">
                          <span className="document-name">{doc.name}</span>
                          <button 
                            className={`document-action-btn ${doc.status === '완료' ? 'completed' : 'required'}`}
                            onClick={() => {
                              if (doc.status === '완료') {
                                navigate(`/document-attachment?orderId=${item.orderId}&documentId=${doc.id}&edit=true`)
                              } else {
                                navigate(`/document-attachment?orderId=${item.orderId}&documentId=${doc.id}`)
                              }
                            }}
                          >
                            {doc.status === '완료' ? '첨부 서류 수정하기' : '서류 첨부하기'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ padding: '1rem', color: '#666', fontSize: '0.9rem' }}>첨부 서류 없음</p>
                  )}
                </div>

                {/* Status Buttons */}
                <div className="status-buttons">
                  {statusButtons.map((status, index) => (
                    <button
                      key={index}
                      className={`status-btn ${index === currentStatusIndex ? 'active' : ''}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Action Button */}
                {action && (
                  <>
                    <button
                      className="service-action-btn"
                      onClick={() => handleActionClick(item)}
                    >
                      {action.text}
                    </button>

                    {/* Instruction Message */}
                    <p className="service-instruction">{action.message}</p>
                  </>
                )}
              </div>
            )
          }))}
        </div>
      </div>
    </div>
  )
}

export default ServiceHistory