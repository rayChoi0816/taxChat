import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdminAuth } from '../contexts/AdminAuthContext'

// =============================================================================
// OrderAccessRoute
// -----------------------------------------------------------------------------
// 결제 서비스 입력/확인 페이지(/order/:orderId) 는 다음 두 주체가 모두 접근할
// 수 있어야 합니다.
//   1) 회원 : 자신이 결제한 주문의 첨부서류 업로드/삭제
//   2) 관리자 : 회원에게 전달한 링크를 미리 확인 (뷰 전용)
//
// 기존 ProtectedRoute 는 회원 인증(AuthContext) 만 체크하기 때문에, 관리자만
// 로그인한 상태에서 관리자 페이지의 링크를 클릭하면 /login 으로 튕겨나가는
// 문제가 있었습니다. 이 라우트는 회원 인증 또는 관리자 인증 중 하나라도
// 존재하면 통과시켜, 두 주체가 동일 URL 로 이 페이지에 진입할 수 있게 합니다.
// =============================================================================
const OrderAccessRoute = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const { isAdminAuthed } = useAdminAuth()
  const location = useLocation()

  if (!isAuthenticated && !isAdminAuthed) {
    // 로그인 이후 원래 페이지로 다시 돌아올 수 있도록 state 로 위치 전달.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return children
}

export default OrderAccessRoute
