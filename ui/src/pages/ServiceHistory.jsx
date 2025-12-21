import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import './ServiceHistory.css'

const ServiceHistory = () => {
  const navigate = useNavigate()

  // 서비스 이용 내역 데이터 (실제로는 API에서 가져올 데이터)
  const serviceHistory = [
    {
      id: 1,
      serviceName: '인건비 신고',
      paymentDate: '25.08.16. 10:35',
      serviceType: '상시근로자 (4대 보험신고 필요)',
      status: '결제 완료',
      documents: [
        { name: '첨부 서류 1', status: '필요' },
        { name: '첨부 서류 2', status: '필요' }
      ]
    },
    {
      id: 2,
      serviceName: '인건비 신고',
      paymentDate: '25.08.16. 10:35',
      serviceType: '상시근로자 (4대 보험신고 필요)',
      status: '신고 진행 중',
      documents: [
        { name: '첨부 서류 1', status: '완료' },
        { name: '첨부 서류 2', status: '완료' }
      ]
    },
    {
      id: 3,
      serviceName: '인건비 신고',
      paymentDate: '24.05.11. 09:20',
      serviceType: '프리랜서 (4대 보험 신고 불필요)',
      status: '신고 완료',
      documents: [
        { name: '첨부 서류 1', status: '완료' },
        { name: '첨부 서류 2', status: '완료' }
      ]
    }
  ]

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
          {serviceHistory.map((item) => {
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
                  <ul className="document-list">
                    {item.documents.map((doc, index) => (
                      <li key={index} className="document-item">
                        <span className="document-name">{doc.name}</span>
                        <button 
                          className={`document-action-btn ${doc.status === '완료' ? 'completed' : 'required'}`}
                          onClick={() => {
                            if (doc.status === '완료') {
                              navigate(`/document-attachment?serviceId=${item.id}&documentId=${index}&edit=true`)
                            } else {
                              navigate(`/document-attachment?serviceId=${item.id}&documentId=${index}`)
                            }
                          }}
                        >
                          {doc.status === '완료' ? '첨부 서류 수정하기' : '서류 첨부하기'}
                        </button>
                      </li>
                    ))}
                  </ul>
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
          })}
        </div>
      </div>
    </div>
  )
}

export default ServiceHistory

