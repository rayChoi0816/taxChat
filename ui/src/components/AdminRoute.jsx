import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../contexts/AdminAuthContext'

const AdminRoute = ({ children }) => {
  const { isAdminAuthed } = useAdminAuth()
  const location = useLocation()

  if (!isAdminAuthed) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default AdminRoute
