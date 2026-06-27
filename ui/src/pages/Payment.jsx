import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import { productAPI } from '../utils/api'

// 디버깅용 — 빌드 시점에 박힌 API base URL 을 화면에 노출.
// (실제로 어디로 요청이 가는지 한눈에 확인해 배포 환경변수 누락을 빠르게 진단)
const RUNTIME_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

const Payment = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await productAPI.getCategories({ displayStatus: '진열' })
        if (response.success) {
          const productsResponse = await productAPI.getProducts({ displayStatus: '진열' })
          const products = productsResponse.success ? productsResponse.data : []

          const categoriesWithPrices = response.data.map((category) => {
            const categoryProducts = products.filter((p) => p.category_id === category.id)
            const prices = categoryProducts.map((p) => p.price)
            return {
              ...category,
              id: category.id,
              code: category.code,
              name: category.name,
              briefDesc: category.brief_description || '',
              detailedDesc: category.detailed_description || '',
              minPrice: prices.length > 0 ? Math.min(...prices) : 0,
              maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            }
          })
          setCategories(categoriesWithPrices)
        } else {
          setLoadError(response?.error || '카테고리 응답이 올바르지 않습니다.')
        }
      } catch (error) {
        console.error('카테고리 조회 오류:', error)
        // "Failed to fetch" 등 네트워크/배포 환경변수 문제를 화면에 그대로 노출해
        // "등록된 상품이 없습니다" 로 잘못 보이는 케이스를 방지.
        setLoadError(error?.message || '카테고리를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [])

  const handleItemClick = (categoryId) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null)
    } else {
      setSelectedCategory(categoryId)
    }
  }

  const handlePayment = () => {
    if (!selectedCategory) {
      return
    }
    // 상품 선택 화면으로 이동
    navigate(`/product-selection?categoryId=${selectedCategory}`)
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">서비스 결제</h1>
        </header>

        {/* Instructions */}
        <div className="payment-instructions">
          <p>신고가 필요한 항목을 선택 후 결제해주세요.</p>
        </div>

        {/* Service Items List */}
        <div className="payment-items">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
          ) : loadError ? (
            <div
              style={{
                textAlign: 'left',
                padding: '1.5rem',
                background: '#fff4f4',
                border: '1px solid #f1c0c0',
                borderRadius: 8,
                color: '#b32424',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              <strong>상품 정보를 불러오지 못했습니다.</strong>
              <div style={{ marginTop: 8 }}>사유: {loadError}</div>
              <div style={{ marginTop: 8, color: '#666', wordBreak: 'break-all' }}>
                API base URL: <code>{RUNTIME_API_BASE_URL}</code>
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>
                Render 배포라면 프론트 환경변수 <code>VITE_API_BASE_URL</code> 이
                백엔드 주소(<code>https://&lt;백엔드&gt;.onrender.com/api</code>)로
                설정되어 있는지, 그리고 백엔드 <code>CORS_ORIGIN</code> 이 현재
                프론트 도메인을 허용하는지 확인하세요.
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>등록된 상품 카테고리가 없습니다.</div>
          ) : (
            categories.map((category) => (
            <div
              key={category.id}
              className={`payment-item-card ${selectedCategory === category.id ? 'selected' : ''}`}
              onClick={() => handleItemClick(category.id)}
            >
              <h3 className="payment-item-title">{category.name}</h3>
              <p className="payment-item-desc">{category.briefDesc}</p>
              <p className="payment-item-price">
                {formatPrice(category.minPrice)}원 ~ {formatPrice(category.maxPrice)}원
              </p>
            </div>
            ))
          )}
        </div>

        {/* Footer Navigation */}
        <div className="form-footer">
          <button 
            className={`payment-btn ${selectedCategory ? 'active' : 'disabled'}`}
            onClick={handlePayment}
            disabled={!selectedCategory}
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  )
}

export default Payment
