import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import './MyPage.css'
import { useAuth } from '../contexts/AuthContext'
import { memberAPI } from '../utils/api'

const MyPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const [memberType, setMemberType] = useState('비사업자')
  const [memberName, setMemberName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(true)

  // 회원 정보 조회 함수
  const fetchMemberInfo = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // 특정 회원 조회 API 사용
      const response = await memberAPI.getMember(user.id)
      
      if (response.success && response.data) {
        const member = response.data
        const memberType = member.member_type || '비사업자'
        setMemberType(memberType)
        
        if (memberType === '비사업자') {
          setMemberName(member.name || '')
        } else {
          setBusinessName(member.business_name || '')
        }
      } else {
        // API 실패 시 user 객체에서 정보 가져오기
        if (user.member_type || user.memberType) {
          const type = user.member_type || user.memberType
          setMemberType(type)
          if (type === '비사업자') {
            setMemberName(user.name || '')
          } else {
            setBusinessName(user.business_name || '')
          }
        }
      }
    } catch (error) {
      console.error('회원 정보 조회 오류:', error)
      // 에러 발생 시 user 객체에서 정보 가져오기
      if (user.member_type || user.memberType) {
        const type = user.member_type || user.memberType
        setMemberType(type)
        if (type === '비사업자') {
          setMemberName(user.name || '')
        } else {
          setBusinessName(user.business_name || '')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // 회원 정보 조회
  useEffect(() => {
    fetchMemberInfo()
  }, [user])

  // 회원 유형 선택 페이지에서 선택한 정보 업데이트
  useEffect(() => {
    if (location.state?.selectedMemberType) {
      const { name, type } = location.state.selectedMemberType
      setMemberType(type)
      if (type === '비사업자') {
        setMemberName(name)
      } else {
        setBusinessName(name)
      }
      // location.state 초기화
      window.history.replaceState({}, document.title)
      // 회원 정보 다시 로드
      if (user?.id) {
        fetchMemberInfo()
      }
    }
  }, [location.state, user])

  const handleMenuClick = (menu) => {
    switch (menu) {
      case 'change-member-type':
        // 현재 선택된 회원 유형 정보를 전달
        navigate('/member-type-selection', {
          state: {
            currentMemberType: {
              type: memberType,
              name: memberType === '비사업자' ? memberName : businessName
            }
          }
        })
        break
      case 'document-storage':
        navigate('/document-storage')
        break
      case 'service-history':
        navigate('/service-history')
        break
      case 'logout':
        if (window.confirm('로그아웃 하시겠습니까?')) {
          logout()
          navigate('/login')
        }
        break
      case 'withdrawal':
        if (window.confirm('정말 회원탈퇴를 하시겠습니까? 서비스 이용이 제한됩니다.')) {
          const memberId = user?.id
          if (!memberId) {
            alert('회원 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')
            break
          }
          ;(async () => {
            try {
              const res = await memberAPI.deleteMember(memberId)
              if (res?.success !== false) {
                alert('회원탈퇴가 완료되었습니다.')
                logout()
                navigate('/login')
              }
            } catch (err) {
              console.error(err)
              alert(err.message || '탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
            }
          })()
        }
        break
      default:
        break
    }
  }

  const getDisplayLabel = () => {
    return memberType === '비사업자' ? '성명' : '사업장명'
  }

  const getDisplayValue = () => {
    return memberType === '비사업자' ? memberName : businessName
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
          <h1 className="payment-title">마이 페이지</h1>
        </header>

        {/* Content */}
        <div className="mypage-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
          ) : (
            <>
          {/* 회원 정보 영역 */}
          <div className="member-info-section">
            <div className="member-info-row">
              <div className="member-info-left">
                    <span className="member-info-value">{getDisplayValue() || '정보 없음'}</span>
              </div>
              <div className="member-info-right">
                <button className="member-type-label-btn">
                  {memberType}
                </button>
                <button 
                  className="member-type-change-btn"
                  onClick={() => handleMenuClick('change-member-type')}
                >
                  회원 유형 변경
                </button>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="mypage-menu">
            <div 
              className="mypage-menu-item"
              onClick={() => handleMenuClick('document-storage')}
            >
              서류 보관함
            </div>
            <div 
              className="mypage-menu-item"
              onClick={() => handleMenuClick('service-history')}
            >
              서비스 이용내역
            </div>
            <div 
              className="mypage-menu-item"
              onClick={() => handleMenuClick('logout')}
            >
              로그아웃
            </div>
          </div>

          {/* Withdrawal */}
          <div className="mypage-withdrawal">
            <div 
              className="mypage-withdrawal-item"
              onClick={() => handleMenuClick('withdrawal')}
            >
              회원탈퇴
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MyPage
