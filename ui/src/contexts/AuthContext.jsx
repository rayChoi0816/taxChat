import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../utils/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // localStorage에서 토큰 확인
    const token = localStorage.getItem('token')
    return !!token
  })

  const [userPhone, setUserPhone] = useState(() => {
    return localStorage.getItem('userPhone') || ''
  })

  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  })

  const login = async (phoneNumber, password) => {
    try {
      const response = await authAPI.login(phoneNumber, password)

      if (response.success) {
        localStorage.setItem('token', response.token)
        localStorage.setItem('userPhone', phoneNumber)
        localStorage.setItem('user', JSON.stringify(response.member))
        setIsAuthenticated(true)
        setUserPhone(phoneNumber)
        setUser(response.member)
        return { success: true }
      }
      return { success: false, error: response.error || '로그인에 실패했습니다' }
    } catch (error) {
      console.error('로그인 오류:', error)
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUserPhone('')
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('userPhone')
    localStorage.removeItem('user')
  }

  const updateUser = (updatedUserData) => {
    const updatedUser = { ...user, ...updatedUserData }
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, userPhone, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
