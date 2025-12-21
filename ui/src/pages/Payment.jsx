import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Payment.css'
import { productAPI } from '../utils/api'

const Payment = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await productAPI.getCategories({ displayStatus: '진열' })
        if (response.success) {
          // 가격 범위 계산을 위해 상품도 가져오기
          const productsResponse = await productAPI.getProducts({ displayStatus: '진열' })
          const products = productsResponse.success ? productsResponse.data : []
          
          const categoriesWithPrices = response.data.map(category => {
            const categoryProducts = products.filter(p => p.category_id === category.id)
            const prices = categoryProducts.map(p => p.price)
            return {
              ...category,
              id: category.id,
              code: category.code,
              name: category.name,
              briefDesc: category.brief_description || '',
              detailedDesc: category.detailed_description || '',
              minPrice: prices.length > 0 ? Math.min(...prices) : 0,
              maxPrice: prices.length > 0 ? Math.max(...prices) : 0
            }
          })
          setCategories(categoriesWithPrices)
        }
      } catch (error) {
        console.error('카테고리 조회 오류:', error)
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
