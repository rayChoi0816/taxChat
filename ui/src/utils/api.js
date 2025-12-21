const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// 토큰 가져오기
const getToken = () => {
  return localStorage.getItem('token')
}

// 기본 fetch 래퍼
const fetchAPI = async (endpoint, options = {}) => {
  const token = getToken()
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '서버 오류가 발생했습니다' }))
      throw new Error(error.error || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API 호출 오류:', error)
    throw error
  }
}

// 인증 API
export const authAPI = {
  login: (phoneNumber) => fetchAPI('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  }),
  
  signup: (phoneNumber, memberType, memberData) => fetchAPI('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, memberType, memberData }),
  }),
}

// 회원 API
export const memberAPI = {
  getMembers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/members?${queryString}`)
  },
  
  createMember: (memberData) => fetchAPI('/members', {
    method: 'POST',
    body: JSON.stringify(memberData),
  }),
  
  updateMember: (id, memberData) => fetchAPI(`/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(memberData),
  }),
  
  deleteMember: (id) => fetchAPI(`/members/${id}`, {
    method: 'DELETE',
  }),
  
  getMemos: (memberId) => fetchAPI(`/members/${memberId}/memos`),
  
  createMemo: (memberId, content) => fetchAPI(`/members/${memberId}/memos`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),
  
  deleteMemo: (memberId, memoId) => fetchAPI(`/members/${memberId}/memos/${memoId}`, {
    method: 'DELETE',
  }),
}

// 상품 API
export const productAPI = {
  getCategories: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/products/categories?${queryString}`)
  },
  
  createCategory: (categoryData) => fetchAPI('/products/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData),
  }),
  
  updateCategory: (id, categoryData) => fetchAPI(`/products/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(categoryData),
  }),
  
  updateCategoryDisplay: (id, displayStatus) => fetchAPI(`/products/categories/${id}/display`, {
    method: 'PATCH',
    body: JSON.stringify({ displayStatus }),
  }),
  
  getProducts: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/products?${queryString}`)
  },
  
  createProduct: (productData) => fetchAPI('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  }),
  
  updateProductDisplay: (id, displayStatus) => fetchAPI(`/products/${id}/display`, {
    method: 'PATCH',
    body: JSON.stringify({ displayStatus }),
  }),
}

// 주문 API
export const orderAPI = {
  getOrders: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/orders?${queryString}`)
  },
  
  createOrder: (orderData) => fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),
  
  updateOrderStatus: (id, status) => fetchAPI(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
}

// 서류 API
export const documentAPI = {
  getCategories: () => fetchAPI('/documents/categories'),
  
  createCategory: (name) => fetchAPI('/documents/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  
  getDocuments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/documents?${queryString}`)
  },
  
  createDocument: (documentData) => fetchAPI('/documents', {
    method: 'POST',
    body: JSON.stringify(documentData),
  }),
  
  getMemberDocuments: (memberId) => fetchAPI(`/documents/member/${memberId}`),
  
  uploadDocument: (memberId, formData) => {
    const token = getToken()
    return fetch(`${API_BASE_URL}/documents/member/${memberId}/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }).then(res => res.json())
  },
  
  downloadDocument: (memberId, documentId) => {
    const token = getToken()
    return fetch(`${API_BASE_URL}/documents/member/${memberId}/${documentId}/download`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
  },
  
  deleteDocument: (memberId, documentId) => fetchAPI(`/documents/member/${memberId}/${documentId}`, {
    method: 'DELETE',
  }),
}

export default fetchAPI

