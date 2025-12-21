import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import './App.css'
import kLogo from './assets/k_logo.png'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CustomerMemoProvider } from './contexts/CustomerMemoContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminCustomer from './pages/AdminCustomer'
import AdminProductCategory from './pages/AdminProductCategory'
import AdminProduct from './pages/AdminProduct'
import AdminDocument from './pages/AdminDocument'
import DocumentManagement from './pages/DocumentManagement'
import AdminSMS from './pages/AdminSMS'
import AdminOrderPayment from './pages/AdminOrderPayment'
import Payment from './pages/Payment'
import ProductSelection from './pages/ProductSelection'
import MyPage from './pages/MyPage'
import ServiceHistory from './pages/ServiceHistory'
import DocumentStorage from './pages/DocumentStorage'
import DocumentAttachment from './pages/DocumentAttachment'
import MemberTypeSelection from './pages/MemberTypeSelection'
import AddMemberType from './pages/AddMemberType'
import MemberTypeForm from './pages/MemberTypeForm'
import Login from './pages/Login'

function Home() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [currentBanner, setCurrentBanner] = useState(0)

  const banners = [
    { id: 1, title: '세금 신고 서비스', description: '전문 세무사가 도와드립니다' },
    { id: 2, title: '빠른 신고 처리', description: '24시간 내 신고 완료' },
    { id: 3, title: '안전한 서류 관리', description: '보안이 강화된 서류 보관' }
  ]

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const handlePaymentClick = () => {
    if (isAuthenticated) {
    navigate('/payment')
    } else {
      navigate('/login')
    }
  }

  const handleDocumentClick = () => {
    if (isAuthenticated) {
    navigate('/document-storage')
    } else {
      navigate('/login')
    }
  }

  const handleLoginClick = () => {
    navigate('/login')
  }

  return (
    <div className="app-wrapper">
      {/* Background Decoration for Desktop/Tablet */}
      <div className="background-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
        <div className="decoration-circle circle-3"></div>
        <div className="decoration-pattern"></div>
      </div>

      {/* Mobile App Container */}
      <div className="mobile-app-container">
        <div className="app">
          {/* Header */}
          <header className="header">
            <div className="header-content">
              <div className="logo">
                <span className="logo-text">TaxChat</span>
              </div>
              <div className="header-actions">
                {isAuthenticated ? (
                  <>
                <button className="icon-button" aria-label="알림">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </button>
                <button 
                  className="icon-button" 
                  aria-label="메뉴"
                  onClick={() => navigate('/mypage')}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </button>
                  </>
                ) : (
                  <button 
                    className="header-login-btn" 
                    onClick={handleLoginClick}
                  >
                    로그인
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Main Banner */}
          <section className="banner-section">
            <div className="banner-container">
              <button className="banner-nav prev" onClick={prevBanner} aria-label="이전 배너">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <div className="banner-slider">
                {banners.map((banner, index) => (
                  <div
                    key={banner.id}
                    className={`banner-slide ${index === currentBanner ? 'active' : ''}`}
                  >
                    <div className="banner-content">
                      <h2>{banner.title}</h2>
                      <p>{banner.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="banner-nav next" onClick={nextBanner} aria-label="다음 배너">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
            <div className="banner-indicator">
              {currentBanner + 1} / {banners.length}
            </div>
          </section>

          {/* Main Content */}
          <main className="main-content">
            {/* Action Buttons */}
            <section className="action-buttons">
              <button className="action-button primary" onClick={handlePaymentClick}>
                <div className="button-content">
                  <h3>결제하기</h3>
                  <p>세금 신고가 필요한 서비스를 결제하세요.</p>
                </div>
              </button>
              <button className="action-button secondary" onClick={handleDocumentClick}>
                <div className="button-content">
                  <h3>내 서류 관리</h3>
                  <p>세금 신고에 필요한 서류를 첨부하세요.</p>
                </div>
              </button>
            </section>

            {/* Footer Content */}
            <div className="footer-content">
            </div>
          </main>

          {/* KakaoTalk Consultation Button */}
          <button 
            className="kakao-consult-btn"
            onClick={() => window.open('https://pf.kakao.com/_your_channel_id', '_blank')}
          >
            <div className="kakao-icon">
              <img src={kLogo} alt="카카오톡" />
            </div>
            <span>카카오톡 상담</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <CustomerMemoProvider>
    <BrowserRouter>
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={<Home />} 
          />
          <Route 
            path="/payment" 
            element={
              <ProtectedRoute>
                <Payment />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/product-selection" 
            element={
              <ProtectedRoute>
                <ProductSelection />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/mypage" 
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/service-history" 
            element={
              <ProtectedRoute>
                <ServiceHistory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/document-storage" 
            element={
              <ProtectedRoute>
                <DocumentStorage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/document-attachment" 
            element={
              <ProtectedRoute>
                <DocumentAttachment />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/member-type-selection" 
            element={
              <ProtectedRoute>
                <MemberTypeSelection />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/add-member-type" 
            element={
              <ProtectedRoute>
                <AddMemberType />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/member-type-form" 
            element={
              <ProtectedRoute>
                <MemberTypeForm />
              </ProtectedRoute>
            } 
          />
          <Route path="/admin/customer" element={<AdminCustomer />} />
        <Route path="/admin/product-category" element={<AdminProductCategory />} />
        <Route path="/admin/product" element={<AdminProduct />} />
        <Route path="/admin/document" element={<AdminDocument />} />
          <Route path="/admin/document-management" element={<DocumentManagement />} />
          <Route path="/admin/sms" element={<AdminSMS />} />
          <Route path="/admin/payment" element={<AdminOrderPayment />} />
      </Routes>
    </BrowserRouter>
      </CustomerMemoProvider>
    </AuthProvider>
  )
}

export default App
