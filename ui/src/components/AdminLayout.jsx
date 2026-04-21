import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './AdminLayout.css'

const AdminLayout = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedItems, setSelectedItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const menuItems = [
    { path: '/admin/customer', label: '고객 관리' },
    { path: '/admin/product', label: '상품 관리' },
    { path: '/admin/payment', label: '주문 결제 관리' },
    { path: '/admin/document', label: '첨부 서류 관리' },
    { path: '/admin/sms', label: 'SMS 관리' },
    { path: '/admin/settings', label: '환경 설정' }
  ]

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      navigate('/')
    }
  }

  const handleClose = () => {
    if (location.pathname === '/admin/product-category') {
      navigate('/admin/product')
    } else if (location.pathname === '/admin/document-management') {
      navigate('/admin/document')
    }
  }

  const isProductCategoryPage = location.pathname === '/admin/product-category'
  const isDocumentManagementPage = location.pathname === '/admin/document-management'
  const shouldHideNav = isProductCategoryPage || isDocumentManagementPage

  const handleMenuClick = () => {
    setIsMenuOpen(true)
  }

  const handleMenuClose = () => {
    setIsMenuOpen(false)
  }

  const handleMenuItemClick = (path) => {
    navigate(path)
    setIsMenuOpen(false)
  }

  return (
    <div className="admin-layout">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-logo" onClick={() => navigate('/admin/product-category')}>
            <span>로고 이미지</span>
          </div>
          {(isProductCategoryPage || isDocumentManagementPage) ? (
            <>
              <button className="admin-logout-btn" onClick={handleClose}>
                창닫기
              </button>
              <button className="admin-menu-btn" onClick={handleClose}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button className="admin-logout-btn" onClick={handleLogout}>
                로그아웃
              </button>
              <button className="admin-menu-btn" onClick={handleMenuClick}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Navigation Bar */}
      {!shouldHideNav && (
        <nav className="admin-nav">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`admin-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {/* Main Content */}
      <main className="admin-main">
        {children}
      </main>

      {/* Mobile Menu Modal */}
      {isMenuOpen && (
        <div className="admin-menu-overlay" onClick={handleMenuClose}>
          <div className="admin-menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="admin-menu-header">
              <span className="admin-menu-title">메뉴</span>
              <button className="admin-menu-close" onClick={handleMenuClose}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="admin-menu-list">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  className={`admin-menu-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => handleMenuItemClick(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="admin-menu-footer">
              <button className="admin-menu-logout" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminLayout