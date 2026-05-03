import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/autoplay'
import 'swiper/css/pagination'
import './App.css'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CustomerMemoProvider } from './contexts/CustomerMemoContext'
import ProtectedRoute from './components/ProtectedRoute'
import { settingsAPI } from './utils/api'
import AdminCustomer from './pages/AdminCustomer'
import AdminProductCategory from './pages/AdminProductCategory'
import AdminProduct from './pages/AdminProduct'
import AdminDocument from './pages/AdminDocument'
import DocumentManagement from './pages/DocumentManagement'
import AdminSMS from './pages/AdminSMS'
import AdminOrderPayment from './pages/AdminOrderPayment'
import Payment from './pages/Payment'
import ProductSelection from './pages/ProductSelection'
import CheckoutPage from './pages/CheckoutPage'
import MyPage from './pages/MyPage'
import ServiceHistory from './pages/ServiceHistory'
import DocumentStorage from './pages/DocumentStorage'
import DocumentAttachment from './pages/DocumentAttachment'
import MemberTypeSelection from './pages/MemberTypeSelection'
import AddMemberType from './pages/AddMemberType'
import MemberTypeForm from './pages/MemberTypeForm'
import Login from './pages/Login'
import AuthVerify from './pages/AuthVerify'
import ResetPassword from './pages/ResetPassword'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import AdminLogin from './pages/AdminLogin'
import AdminSettings from './pages/AdminSettings'
import AdminRoute from './components/AdminRoute'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import KakaoConsultDragButton from './components/KakaoConsultDragButton'
import TaxSelectPage from './pages/TaxSelectPage.jsx'
import CapitalGainsLayout from './pages/CapitalGainsLayout.jsx'
import CapitalGainsFlowPage from './pages/CapitalGainsFlowPage.jsx'
import CapitalGainsResultPage from './pages/CapitalGainsResultPage.jsx'

function BannerSlider({ banners }) {
  const swiperRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const multiple = banners.length > 1

  const handlePlayToggle = () => {
    const swiper = swiperRef.current
    if (!swiper || !swiper.autoplay) return
    if (isPlaying) {
      swiper.autoplay.stop()
    } else {
      swiper.autoplay.start()
    }
  }

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      className="banner-swiper"
      loop={multiple}
      autoplay={
        multiple
          ? {
              delay: (banners[0].displayTime || 3) * 1000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false
      }
      pagination={
        multiple
          ? {
              clickable: true,
              bulletClass: 'banner-bullet',
              bulletActiveClass: 'banner-bullet-active',
            }
          : false
      }
      allowTouchMove={multiple}
      speed={500}
      onSwiper={(swiper) => {
        swiperRef.current = swiper
        setIsPlaying(!!swiper.autoplay?.running)
      }}
      onAutoplayStart={() => setIsPlaying(true)}
      onAutoplayStop={() => setIsPlaying(false)}
      onAutoplayPause={() => setIsPlaying(false)}
      onAutoplayResume={() => setIsPlaying(true)}
    >
      {banners.map((banner) => {
        const delayMs = Math.max(1, Math.min(10, banner.displayTime || 3)) * 1000
        const imageEl = (
          <img
            className="banner-slide-image"
            src={banner.imageUrl}
            alt=""
            draggable={false}
          />
        )
        return (
          <SwiperSlide
            key={banner.id}
            data-swiper-autoplay={delayMs}
            className="banner-slide"
          >
            {banner.linkUrl ? (
              <a
                href={banner.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="banner-slide-link"
              >
                {imageEl}
              </a>
            ) : (
              imageEl
            )}
          </SwiperSlide>
        )
      })}

      {multiple && (
        <button
          type="button"
          className="banner-playpause-btn"
          onClick={handlePlayToggle}
          aria-label={isPlaying ? '슬라이드 정지' : '슬라이드 재생'}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </Swiper>
  )
}

function Home() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [mainBanners, setMainBanners] = useState([])
  const [bannersLoading, setBannersLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    settingsAPI
      .getMainBanners()
      .then((res) => {
        if (!cancelled && res.success) setMainBanners(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setMainBanners([])
      })
      .finally(() => {
        if (!cancelled) setBannersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePaymentClick = () => {
    if (isAuthenticated) {
    navigate('/payment')
    } else {
      navigate('/login')
    }
  }

  const handleTaxPreviewClick = () => {
    navigate('/tax-preview')
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

  const handleAdminClick = () => {
    navigate('/admin/customer')
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
              <div className="banner-slider">
                {bannersLoading ? (
                  <div className="banner-slide active">
                    <div className="banner-content banner-content-loading">
                      <p>배너 불러오는 중…</p>
                    </div>
                  </div>
                ) : mainBanners.length === 0 ? (
                  <div className="banner-slide active">
                    <div className="banner-content">
                      <h2>세금 신고 서비스</h2>
                      <p>관리자 환경 설정에서 메인 배너를 등록할 수 있습니다</p>
                    </div>
                  </div>
                ) : (
                  <BannerSlider banners={mainBanners} />
                )}
              </div>
            </div>
          </section>

          {/* Main Content */}
          <main className="main-content">
            {/* Action Buttons */}
            <section className="action-buttons">
              <button className="action-button primary tax-preview" onClick={handleTaxPreviewClick}>
                <div className="button-content">
                  <h3>예상 세금 미리보기</h3>
                  <p>예상 세금과 절세 가능성까지 한 번에 확인하세요</p>
                </div>
              </button>
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
              <button className="action-button admin" onClick={handleAdminClick}>
                <div className="button-content">
                  <h3>관리자 페이지</h3>
                  <p>고객, 상품, 주문 등을 관리하세요.</p>
                </div>
              </button>
            </section>

            {/* Footer Content */}
            <footer className="footer-content">
              <div className="footer-brand">세무회계 오월 | 택스챗</div>

              <div className="footer-section">
                <p className="footer-multiline">
                  <span>
                    전화 :{' '}
                    <a className="footer-tel-link" href="tel:01021637610">
                      010-2163-7610
                    </a>
                  </span>
                  <span>(평일 10:00 ~ 18:00 / 주말•공휴일 휴무)</span>
                </p>
                <p>
                  E-MAIL :{' '}
                  <a className="footer-mail-link" href="mailto:tax5wol@gmail.com">
                    tax5wol@gmail.com
                  </a>
                </p>
              </div>

              <div className="footer-section">
                <p>상호명 : 세무회계 오월</p>
                <p>대표자 : 최미순 세무사</p>
                <p>사업자번호 : 670-07-02709</p>
                <p>통신 판매업 신고번호 : </p>
                <p className="footer-multiline">
                  <span>사업장 소재지 : 충남 아산시 송악면 강당로 119번길 5</span>
                  <span>세무회계 오월</span>
                </p>
              </div>

              <div className="footer-links-block">
                <div className="footer-links">
                  <Link className="footer-link" to="/terms-of-service">
                    택스챗 이용약관
                  </Link>
                  <span className="footer-divider">|</span>
                  <Link className="footer-link" to="/privacy-policy">
                    개인정보처리방침
                  </Link>
                </div>
                <div className="footer-privacy-officer">개인정보보호책임자 : 최민용</div>
              </div>

              <div className="footer-copyright">Copyright © taxChat all rights reserved</div>
            </footer>
          </main>

          {/* KakaoTalk Consultation Floating Button (우측 하단 고정) */}
          <KakaoConsultDragButton />
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
      <CustomerMemoProvider>
    <BrowserRouter>
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/password-reset" element={<ResetPassword />} />
          <Route 
            path="/" 
            element={<Home />} 
          />
          <Route path="/tax-preview" element={<TaxSelectPage />} />
          <Route path="/tax-preview/capital-gains" element={<CapitalGainsLayout />}>
            <Route index element={<CapitalGainsFlowPage />} />
            <Route path="result" element={<CapitalGainsResultPage />} />
          </Route>
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
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
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
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/auth-verify" element={<AuthVerify />} />
          <Route path="/add-member-type" element={<AddMemberType />} />
          <Route path="/member-type-form" element={<MemberTypeForm />} />

          {/* 관리자 로그인 */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* 관리자 보호 라우트 */}
          <Route path="/admin" element={<AdminRoute><Navigate to="/admin/customer" replace /></AdminRoute>} />
          <Route path="/admin/customer" element={<AdminRoute><AdminCustomer /></AdminRoute>} />
          <Route path="/admin/product-category" element={<AdminRoute><AdminProductCategory /></AdminRoute>} />
          <Route path="/admin/product" element={<AdminRoute><AdminProduct /></AdminRoute>} />
          <Route path="/admin/document" element={<AdminRoute><AdminDocument /></AdminRoute>} />
          <Route path="/admin/document-management" element={<AdminRoute><DocumentManagement /></AdminRoute>} />
          <Route path="/admin/sms" element={<AdminRoute><AdminSMS /></AdminRoute>} />
          <Route path="/admin/payment" element={<AdminRoute><AdminOrderPayment /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
      </CustomerMemoProvider>
      </AdminAuthProvider>
    </AuthProvider>
  )
}

export default App
