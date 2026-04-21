import { createContext, useContext, useEffect, useState } from 'react'
import { authAPI } from '../utils/api'

const STORAGE_KEY = 'adminToken'

const AdminAuthContext = createContext(null)

export const AdminAuthProvider = ({ children }) => {
  const [adminToken, setAdminToken] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  })

  // sessionStorage 변동 감지 (다른 탭 대응)
  useEffect(() => {
    const handler = () => {
      setAdminToken(sessionStorage.getItem(STORAGE_KEY) || '')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const login = async (password) => {
    try {
      const res = await authAPI.adminLogin(password)
      if (res?.success && res.token) {
        sessionStorage.setItem(STORAGE_KEY, res.token)
        setAdminToken(res.token)
        return { success: true }
      }
      return { success: false, error: res?.error || '로그인에 실패했습니다' }
    } catch (err) {
      return { success: false, error: err.message || '로그인에 실패했습니다' }
    }
  }

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAdminToken('')
  }

  return (
    <AdminAuthContext.Provider
      value={{
        adminToken,
        isAdminAuthed: Boolean(adminToken),
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
