const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// 토큰 가져오기 (관리자 세션 토큰이 있으면 우선 사용)
const getToken = () => {
  return sessionStorage.getItem('adminToken') || localStorage.getItem('token')
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
    // 네트워크 오류인 경우 더 명확한 메시지 제공
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error('API 호출 오류: 서버에 연결할 수 없습니다.', {
        endpoint: `${API_BASE_URL}${endpoint}`,
        message: '백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:3001)',
        error: error.message
      })
      throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
    }
    console.error('API 호출 오류:', error)
    throw error
  }
}

// 인증 API
export const authAPI = {
  login: (phoneNumber, password) => fetchAPI('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, password }),
  }),

  signup: (phoneNumber, memberType, memberData, password) => fetchAPI('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, memberType, memberData, password }),
  }),

  // SMS 인증번호 발송: 브라우저 → 우리 서버(POST /api/auth/send) → (서버에서) 뿌리오 호출
  // 프론트는 절대 뿌리오를 직접 호출하지 않습니다. (API 키 노출 방지)
  requestSmsCode: (phoneNumber) => {
    const phone = String(phoneNumber || '').replace(/[^\d]/g, '')
    return fetchAPI('/auth/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
  },

  // SMS 인증번호 검증: 브라우저 → 우리 서버(POST /api/auth/verify) → DB 검증
  verifySmsCode: (phoneNumber, code) => {
    const phone = String(phoneNumber || '').replace(/[^\d]/g, '')
    return fetchAPI('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code: String(code || '').trim() }),
    })
  },

  adminLogin: (password) => fetchAPI('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
}

// 회원 API
export const memberAPI = {
  getMembers: (params = {}) => {
    // URLSearchParams는 배열을 자동으로 처리하므로 그대로 사용
    const queryParams = new URLSearchParams()
    Object.keys(params).forEach(key => {
      const value = params[key]
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          // 배열인 경우 각 값을 별도로 추가
          value.forEach(v => queryParams.append(key, v))
        } else {
          queryParams.append(key, value)
        }
      }
    })
    return fetchAPI(`/members?${queryParams.toString()}`)
  },
  
  getMember: (id) => fetchAPI(`/members/${id}`),
  
  getMemberTypes: (id) => fetchAPI(`/members/${id}/member-types`),
  
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
  
  updateProduct: (id, productData) => fetchAPI(`/products/${id}`, {
    method: 'PUT',
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
  
  deleteCategory: (id) => fetchAPI(`/documents/categories/${id}`, {
    method: 'DELETE',
  }),
  
  getDocuments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/documents?${queryString}`)
  },
  
  createDocument: (documentData) => fetchAPI('/documents', {
    method: 'POST',
    body: JSON.stringify(documentData),
  }),
  
  updateDocument: (id, documentData) => fetchAPI(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(documentData),
  }),
  
  updateDocumentUsageStatus: (id, usageStatus) => fetchAPI(`/documents/${id}/usage-status`, {
    method: 'PATCH',
    body: JSON.stringify({ usageStatus }),
  }),
  
  deleteDocument: (id) => fetchAPI(`/documents/${id}`, {
    method: 'DELETE',
  }),
  
  getAttachments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/documents/attachments?${queryString}`)
  },
  
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
  
  updateMemberDocument: (memberId, documentId, formData) => {
    const token = getToken()
    return fetch(`${API_BASE_URL}/documents/member/${memberId}/${documentId}`, {
      method: 'PUT',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }).then(res => res.json())
  },
}

// SMS API
export const smsAPI = {
  getTemplates: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/sms/templates?${queryString}`)
  },
  
  createTemplate: (templateData) => fetchAPI('/sms/templates', {
    method: 'POST',
    body: JSON.stringify(templateData),
  }),
  
  updateTemplate: (id, templateData) => fetchAPI(`/sms/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(templateData),
  }),
  
  updateTemplateUsage: (id, usageStatus) => fetchAPI(`/sms/templates/${id}/usage`, {
    method: 'PATCH',
    body: JSON.stringify({ usageStatus }),
  }),
  
  deleteTemplate: (id) => fetchAPI(`/sms/templates/${id}`, {
    method: 'DELETE',
  }),
  
  getMessages: (params = {}) => {
    // URLSearchParams(plainObject) 는 배열 값을 "a,b" 한 덩어리로 보내
    // Express req.query.smsType 이 배열이 아니게 되어 DB 필터가 전부 틀어짐.
    // 회원 API(getMembers)와 동일하게 배열은 키를 반복 append 한다.
    const queryParams = new URLSearchParams()
    Object.keys(params).forEach((key) => {
      const value = params[key]
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => queryParams.append(key, v))
        } else {
          queryParams.append(key, value)
        }
      }
    })
    return fetchAPI(`/sms?${queryParams.toString()}`)
  },
  
  sendSMS: (smsData) => fetchAPI('/sms/send', {
    method: 'POST',
    body: JSON.stringify(smsData),
  }),
  
  resendSMS: (id) => fetchAPI(`/sms/${id}/resend`, {
    method: 'POST',
  }),
}

// 결제 API
export const paymentAPI = {
  getPayments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/payments?${queryString}`)
  },
  
  createPayment: (paymentData) => fetchAPI('/payments', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  }),
  
  updatePaymentStatus: (id, statusData) => fetchAPI(`/payments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(statusData),
  }),
  
  cancelPayment: (id, cancelData) => fetchAPI(`/payments/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(cancelData),
  }),
}

// 환경 설정 (메인 배너 등)
const multipartFetch = async (url, options = {}) => {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || `HTTP error! status: ${res.status}`)
  }
  return body
}

export const settingsAPI = {
  // all=true 로 호출하면 비활성 배너까지 포함 (관리자용)
  getMainBanners: (options = {}) => {
    const q = options.all ? '?all=1' : ''
    return fetchAPI(`/settings/main-banners${q}`)
  },

  createMainBanner: (formData) =>
    multipartFetch(`${API_BASE_URL}/settings/main-banners`, {
      method: 'POST',
      body: formData,
    }),

  updateMainBanner: (id, formData) =>
    multipartFetch(`${API_BASE_URL}/settings/main-banners/${id}`, {
      method: 'PUT',
      body: formData,
    }),

  toggleMainBanner: (id, isActive) =>
    fetchAPI(`/settings/main-banners/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  reorderMainBanners: (items) =>
    fetchAPI('/settings/main-banners/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }),

  deleteMainBanner: (id) =>
    fetchAPI(`/settings/main-banners/${id}`, {
      method: 'DELETE',
    }),
}

export default fetchAPI
