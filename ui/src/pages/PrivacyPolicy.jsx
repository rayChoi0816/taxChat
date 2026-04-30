import { useNavigate } from 'react-router-dom'
import '../App.css'
import './TermsOfService.css'
import AuthPageHeader from '../components/AuthPageHeader'
import { useLegalPageScrollTop } from '../hooks/useLegalPageScrollTop'

const PrivacyPolicy = () => {
  const navigate = useNavigate()
  const legalScrollRef = useLegalPageScrollTop()

  const handleClose = () => {
    if (window.opener != null) {
      window.close()
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="app-wrapper terms-of-service-page">
      <div className="mobile-app-container">
        <div className="app app-auth">
          <div className="auth-page-shell">
            <div ref={legalScrollRef} className="auth-page-scroll">
              <AuthPageHeader title="개인정보처리방침" onClose={handleClose} />
              <div className="auth-page-content legal-doc-static">
                <article className="terms-of-service-article">
                  <section className="terms-of-service-section">
                    <h2>제1조 (개인정보 처리 목적)</h2>
                    <p>회사는 다음 목적을 위해 개인정보를 처리합니다.</p>
                    <ol>
                      <li>세금 신고 서비스 제공</li>
                      <li>결제 및 정산 처리</li>
                      <li>신고 진행 상태 관리</li>
                      <li>고객 문의 대응</li>
                      <li>법령상 의무 이행</li>
                    </ol>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제2조 (수집 항목)</h2>
                    <p className="privacy-block-title">1. 필수정보</p>
                    <ul className="privacy-bullet-list">
                      <li>이름, 연락처, 이메일</li>
                      <li>생년월일, 주소</li>
                    </ul>
                    <p className="privacy-block-title-spaced">2. 세무 처리 정보</p>
                    <ul className="privacy-bullet-list">
                      <li>주민등록번호(법령 허용 범위 내)</li>
                      <li>소득, 매출, 사업자 정보</li>
                      <li>계좌 정보</li>
                      <li>기타 세금 신고에 필요한 정보</li>
                    </ul>
                    <p className="terms-of-service-note">
                      ※ 해당 정보는 「개인정보 보호법」 및 관련 법령에 따라 엄격히 보호됩니다.
                    </p>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제3조 (개인정보 수집 방법)</h2>
                    <ul className="privacy-bullet-list">
                      <li>회원가입</li>
                      <li>서비스 이용 과정</li>
                      <li>서류 업로드</li>
                      <li>고객 문의</li>
                    </ul>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제4조 (보유 및 이용기간)</h2>
                    <ol>
                      <li>원칙적으로 목적 달성 시 지체 없이 파기합니다.</li>
                      <li>단, 관련 법령에 따라 일정 기간 보관할 수 있습니다.</li>
                    </ol>
                    <ul className="privacy-bullet-list">
                      <li>전자상거래 기록: 5년</li>
                      <li>계약/결제 기록: 5년</li>
                      <li>소비자 불만 기록: 3년</li>
                    </ul>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제5조 (개인정보 제3자 제공)</h2>
                    <p>회사는 원칙적으로 개인정보를 외부에 제공하지 않습니다.</p>
                    <p>단, 다음의 경우 예외로 합니다.</p>
                    <ol>
                      <li>이용자 동의가 있는 경우</li>
                      <li>세무 신고 수행을 위해 세무대리인에게 제공하는 경우</li>
                      <li>법령에 따라 요구되는 경우</li>
                    </ol>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제6조 (처리 위탁)</h2>
                    <p>회사는 서비스 제공을 위해 다음과 같이 위탁할 수 있습니다.</p>
                    <ul className="privacy-bullet-list">
                      <li>결제 처리(PG사)</li>
                      <li>문자 발송 서비스</li>
                      <li>클라우드 인프라</li>
                    </ul>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제7조 (이용자의 권리)</h2>
                    <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
                    <ol>
                      <li>개인정보 열람</li>
                      <li>정정 및 삭제 요청</li>
                      <li>처리 정지 요청</li>
                    </ol>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제8조 (개인정보 보호 조치)</h2>
                    <p>회사는 다음과 같은 보호조치를 시행합니다.</p>
                    <ul className="privacy-bullet-list">
                      <li>암호화 저장</li>
                      <li>접근 권한 제한</li>
                      <li>접속 기록 관리</li>
                      <li>보안 시스템 운영</li>
                    </ul>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section">
                    <h2>제9조 (책임의 한계)</h2>
                    <p>회사는 다음에 대해 책임을 지지 않습니다.</p>
                    <ul className="privacy-bullet-list">
                      <li>이용자가 잘못 입력한 정보</li>
                      <li>이용자가 업로드한 서류의 오류</li>
                      <li>세무 신고 결과</li>
                    </ul>
                  </section>

                  <hr className="legal-divider" />

                  <section className="terms-of-service-section terms-of-service-supplement">
                    <h2>제10조 (개인정보 보호책임자)</h2>
                    <ul className="privacy-bullet-list">
                      <li>성명: 최민용</li>
                      <li>
                        이메일:{' '}
                        <a className="footer-mail-link" href="mailto:choiminyong0816@gmail.com">
                          choiminyong0816@gmail.com
                        </a>
                      </li>
                    </ul>
                  </section>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
