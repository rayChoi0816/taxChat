import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './AdminLayout.css'

const AdminLayout = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedItems, setSelectedItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)

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

  return (
    <div className="admin-layout">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-logo" onClick={() => navigate('/admin/product-category')}>
            <span>로고 이미지</span>
          </div>
          <button className="admin-logout-btn" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
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

      {/* Main Content */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  )
}

export default AdminLayout

