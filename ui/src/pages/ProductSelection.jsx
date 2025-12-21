import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import { productAPI } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const ProductSelection = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const categoryId = new URLSearchParams(location.search).get('categoryId')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [products, setProducts] = useState([])
  const [category, setCategory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // 카테고리 정보 조회
        if (categoryId) {
          const categoryResponse = await productAPI.getCategories()
          if (categoryResponse.success) {
            const foundCategory = categoryResponse.data.find(c => c.id === parseInt(categoryId))
            if (foundCategory) {
              setCategory(foundCategory)
            }
          }
        }

        // 상품 목록 조회
        const memberType = user?.memberType || '비사업자'
        const productsResponse = await productAPI.getProducts({
          categoryId,
          displayStatus: '진열',
          memberType
        })
        
        if (productsResponse.success) {
          // 서류 정보는 추후 API에서 가져올 수 있도록 구조화
          const formattedProducts = productsResponse.data.map(product => ({
            id: product.id,
            categoryName: product.category_name || '',
            name: product.name,
            code: product.code,
            price: product.price,
            description: product.description,
            documents: [] // 추후 서류 API 연동 시 추가
          }))
          setProducts(formattedProducts)
        }
      } catch (error) {
        console.error('상품 조회 오류:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [categoryId, user])

  const handleProductClick = (productId) => {
    if (selectedProduct === productId) {
      setSelectedProduct(null)
    } else {
      setSelectedProduct(productId)
    }
  }

  const handlePayment = async () => {
    if (!selectedProduct) {
      return
    }
    // 실제 결제 처리 로직 (추후 구현)
    const product = products.find(p => p.id === selectedProduct)
    if (product) {
      alert(`${product.name} (${product.price.toLocaleString()}원) 결제를 진행합니다.`)
      // TODO: 결제 API 연동
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  return (
    <div className="payment-wrapper">
      <div className="payment-container">
        {/* Header */}
        <header className="payment-header">
          <button className="payment-back-btn" onClick={() => navigate('/payment')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="payment-title">{currentCategory.name}</h1>
        </header>

        {/* Description */}
        {category && (
          <div className="product-description">
            <p>{category.detailed_description || category.brief_description || ''}</p>
          </div>
        )}

        {/* Product List */}
        <div className="payment-items">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>등록된 상품이 없습니다.</div>
          ) : (
            products.map((product) => (
            <div
              key={product.id}
              className={`payment-item-card ${selectedProduct === product.id ? 'selected' : ''}`}
              onClick={() => handleProductClick(product.id)}
            >
              <h3 className="payment-item-title">{product.name}</h3>
              <div className="product-documents">
                <p className="documents-label">&lt;첨부 서류&gt;</p>
                <ul className="documents-list">
                  {product.documents.map((doc, index) => (
                    <li key={index}>{doc}</li>
                  ))}
                </ul>
              </div>
              <p className="payment-item-price">
                가격 {formatPrice(product.price)}원
              </p>
            </div>
            ))
          )}
        </div>

        {/* Footer Navigation */}
        <div className="form-footer">
          <button 
            className={`payment-btn ${selectedProduct ? 'active' : 'disabled'}`}
            onClick={handlePayment}
            disabled={!selectedProduct}
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductSelection

