import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import { productAPI, documentAPI } from '../utils/api'
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
  const [allDocuments, setAllDocuments] = useState([]) // 모든 진열 상태 서류 정보

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
        // memberType 필터링은 선택적으로 적용 (사용자가 로그인한 경우에만)
        const memberType = user?.member_type || user?.memberType
        console.log('상품 조회 파라미터:', { categoryId, memberType, user })
        
        const queryParams = {
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          displayStatus: '진열'
        }
        
        // memberType이 있는 경우에만 필터링 적용
        if (memberType) {
          queryParams.memberType = memberType
        }
        
        const productsResponse = await productAPI.getProducts(queryParams)
        
        console.log('상품 조회 응답:', productsResponse)
        console.log('서류 정보:', allDocuments)
        
        if (productsResponse.success) {
          // 서류 정보 파싱 및 구조화
          const formattedProducts = productsResponse.data.map(product => {
            // required_documents를 파싱 (JSON 문자열 또는 배열)
            let documentIds = []
            if (product.required_documents) {
              try {
                const parsed = typeof product.required_documents === 'string'
                  ? JSON.parse(product.required_documents)
                  : product.required_documents
                
                // 배열이면 그대로 사용, 아니면 배열로 변환
                documentIds = Array.isArray(parsed) ? parsed : [parsed]
              } catch (e) {
                console.error('서류 ID 파싱 오류:', e, product.required_documents)
                documentIds = []
              }
            }
            
            console.log(`상품 ${product.name}의 서류 ID 배열:`, documentIds)
            
            // 서류 ID 배열을 서류 정보 객체 배열로 변환
            const documents = documentIds
              .map(docId => {
                // docId가 숫자인 경우와 문자열인 경우 모두 처리
                const id = typeof docId === 'string' ? parseInt(docId) : docId
                if (isNaN(id)) {
                  // 숫자가 아닌 경우 서류명으로 찾기 시도
                  return allDocuments.find(doc => doc.name === docId)
                }
                return allDocuments.find(doc => doc.id === id)
              })
              .filter(doc => doc !== undefined) // 존재하지 않는 서류 제거
            
            console.log(`상품 ${product.name}의 서류 정보:`, documents)
            
            return {
              id: product.id,
              categoryName: product.category_name || '',
              name: product.name,
              code: product.code,
              price: product.price,
              description: product.description || '',
              // 결제 페이지에 출력되는 상품 설명 (상품등록 모달에서 입력)
              paymentDescription: product.payment_description || '',
              documents: documents // 서류 정보 객체 배열
            }
          })
          console.log('포맷된 상품 목록:', formattedProducts)
          setProducts(formattedProducts)
        } else {
          console.error('상품 조회 실패:', productsResponse)
        }
      } catch (error) {
        console.error('상품 조회 오류:', error)
      } finally {
        setLoading(false)
      }
    }
    
    // allDocuments가 로드된 후에만 실행
    if (allDocuments.length > 0 || categoryId) {
      fetchData()
    }
  }, [categoryId, user, allDocuments])

  const handleProductClick = (productId) => {
    if (selectedProduct === productId) {
      setSelectedProduct(null)
    } else {
      setSelectedProduct(productId)
    }
  }

  // [결제하기] 버튼 클릭 시
  //  - 선택된 상품 정보를 들고 "결제하기 페이지"(/checkout) 로 이동합니다.
  //  - PG 연동은 결제하기 페이지에서 처리 예정이므로 여기서는 주문을 생성하지 않습니다.
  const handlePayment = () => {
    if (!selectedProduct) return

    if (!user || !user.id) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    const product = products.find(p => p.id === selectedProduct)
    if (!product) {
      alert('상품 정보를 찾을 수 없습니다.')
      return
    }

    // 결제하기 페이지로 "새 페이지" 이동. 선택된 상품 + 카테고리 정보를 state 로 전달.
    navigate('/checkout', {
      state: {
        product,
        category
      }
    })
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
          <h1 className="payment-title">{category?.name || '상품 선택'}</h1>
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
              {product.description && (
                <div className="product-description-text" style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
                  <p>{product.description}</p>
                </div>
              )}
              {product.documents && product.documents.length > 0 && (
                <div className="product-documents">
                  <p className="documents-label">&lt;첨부 서류&gt;</p>
                  <ul className="documents-list">
                    {product.documents.map((doc, index) => (
                      <li key={doc.id || index}>
                        <strong>{doc.name}</strong>
                        {doc.description && ` - ${doc.description}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
            결제하기
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductSelection

