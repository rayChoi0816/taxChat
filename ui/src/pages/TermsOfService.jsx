import { useNavigate } from 'react-router-dom'
import '../App.css'
import './TermsOfService.css'
import AuthPageHeader from '../components/AuthPageHeader'

const TermsOfService = () => {
  const navigate = useNavigate()

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
            <div className="auth-page-scroll">
              <AuthPageHeader title="택스챗 서비스 이용약관" onClose={handleClose} />
              <div className="auth-page-content legal-doc-static">
                <article className="terms-of-service-article">
                  <section className="terms-of-service-section">
          <h2>제1조 (목적)</h2>
          <p>
            본 약관은 회사가 제공하는 택스챗(TaxChat) 서비스와 관련하여 회사와 이용자 간의 권리, 의무 및
            책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="terms-of-service-section">
          <h2>제2조 (정의)</h2>
          <ol>
            <li>
              “서비스”란 회사가 제공하는 다음 각 호의 기능을 의미합니다.
              <ul className="terms-of-service-sublist">
                <li>① 세금 신고 결제 서비스</li>
                <li>② 세금 신고 진행 상태 관리 서비스</li>
                <li>③ 서류 업로드 및 관리 서비스</li>
                <li>④ 기타 회사가 정하는 서비스</li>
              </ul>
            </li>
            <li>“이용자”란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 의미합니다.</li>
            <li>
              “세무대리인”이란 세무사 등 관련 법령에 따라 세금 신고를 대리 수행하는 자를 의미합니다.
            </li>
            <li>“결제”란 이용자가 세금 신고 관련 서비스 이용을 위해 금전을 지급하는 행위를 의미합니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제3조 (약관의 효력 및 변경)</h2>
          <ol>
            <li>본 약관은 서비스 내 게시함으로써 효력이 발생합니다.</li>
            <li>회사는 관련 법령(전자상거래법, 전자금융거래법 등)을 위반하지 않는 범위에서 약관을 변경할 수 있습니다.</li>
            <li>이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단할 수 있습니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제4조 (서비스의 성격 및 역할 제한)</h2>
          <ol>
            <li>회사는 세금 신고를 위한 플랫폼 및 중개 시스템을 제공하는 사업자입니다.</li>
            <li>회사는 세무대리인이 아니며, 세금 신고의 법적 책임 주체가 아닙니다.</li>
            <li>실제 세금 신고 행위는 이용자 또는 세무대리인에 의해 수행됩니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제5조 (서비스 제공)</h2>
          <p>회사는 다음 서비스를 제공합니다.</p>
          <ol>
            <li>세금 신고 결제 처리</li>
            <li>세금 신고 진행 상태 표시</li>
            <li>서류 업로드 및 관리 기능</li>
            <li>기타 부가 서비스</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제6조 (이용자의 의무)</h2>
          <p>이용자는 다음 사항을 준수해야 합니다.</p>
          <ol>
            <li>정확한 정보 및 서류 제출</li>
            <li>타인의 정보 도용 금지</li>
            <li>관련 법령 준수</li>
            <li>허위 자료 제출 금지</li>
          </ol>
          <p className="terms-of-service-note">※ 허위 정보로 인한 모든 책임은 이용자에게 있습니다.</p>
        </section>

        <section className="terms-of-service-section">
          <h2>제7조 (결제 및 전자상거래 관련 규정)</h2>
          <ol>
            <li>서비스 내 결제는 전자상거래법 및 관련 법령을 따릅니다.</li>
            <li>이용자는 결제 전 서비스 내용, 금액, 조건을 확인해야 합니다.</li>
            <li>결제 완료 시 서비스 이용 계약이 성립됩니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제8조 (전자금융거래)</h2>
          <ol>
            <li>회사는 PG사 등 결제대행사를 통해 결제를 처리합니다.</li>
            <li>전자금융거래와 관련된 책임은 관련 법령 및 PG사의 약관에 따릅니다.</li>
            <li>이용자의 과실로 발생한 결제 오류에 대해 회사는 책임을 지지 않습니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제9조 (환불 및 청약철회)</h2>
          <ol>
            <li>
              다음의 경우 청약철회 및 환불이 제한됩니다.
              <ul className="terms-of-service-sublist">
                <li>① 세금 신고 업무가 이미 개시된 경우</li>
                <li>② 이용자의 책임 있는 사유로 서비스가 진행된 경우</li>
              </ul>
            </li>
            <li>환불 기준은 관련 법령 및 회사 정책에 따릅니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제10조 (세금 신고 및 책임의 분리)</h2>
          <ol>
            <li>회사는 세금 신고 결과에 대해 어떠한 법적 책임도 부담하지 않습니다.</li>
            <li>
              세금 신고의 정확성, 적법성, 결과에 대한 책임은 다음 주체에게 있습니다.
              <ul className="terms-of-service-sublist">
                <li>① 이용자가 직접 신고한 경우: 이용자</li>
                <li>② 세무대리인이 신고한 경우: 세무대리인</li>
              </ul>
            </li>
            <li>
              회사는 다음 사항에 대해 책임을 지지 않습니다.
              <ul>
                <li>신고 오류</li>
                <li>세액 산정 오류</li>
                <li>가산세, 과태료 발생</li>
                <li>세무조사 결과</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제11조 (서류 업로드 및 데이터 책임)</h2>
          <ol>
            <li>이용자가 업로드한 모든 자료의 책임은 이용자에게 있습니다.</li>
            <li>회사는 자료의 정확성, 진위 여부를 검증할 의무가 없습니다.</li>
            <li>
              다음의 경우 회사는 자료를 삭제할 수 있습니다.
              <ul>
                <li>불법 자료</li>
                <li>타인의 권리 침해 자료</li>
                <li>서비스 운영에 문제를 일으키는 자료</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제12조 (서비스 중단 및 변경)</h2>
          <ol>
            <li>
              회사는 다음의 경우 서비스 제공을 중단할 수 있습니다.
              <ul>
                <li>시스템 점검</li>
                <li>장애 발생</li>
                <li>불가항력적 사유</li>
              </ul>
            </li>
            <li>서비스 내용은 운영상 필요에 따라 변경될 수 있습니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제13조 (면책조항)</h2>
          <p>회사는 다음에 대해 책임을 지지 않습니다.</p>
          <ol>
            <li>이용자의 입력 오류로 인한 문제</li>
            <li>서류 누락 또는 오기재</li>
            <li>세금 신고 지연 또는 실패</li>
            <li>이용자의 시스템 환경 문제</li>
            <li>외부 기관(국세청 등) 시스템 문제</li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제14조 (손해배상 제한)</h2>
          <p>
            회사의 책임이 인정되는 경우에도 그 범위는 이용자가 실제 지급한 금액을 초과하지 않습니다.
          </p>
        </section>

        <section className="terms-of-service-section">
          <h2>제15조 (계약 해지 및 이용 제한)</h2>
          <ol>
            <li>이용자는 언제든지 서비스 이용을 중단할 수 있습니다.</li>
            <li>
              회사는 다음의 경우 이용을 제한할 수 있습니다.
              <ul>
                <li>약관 위반</li>
                <li>불법 행위</li>
                <li>서비스 악용</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="terms-of-service-section">
          <h2>제16조 (개인정보 보호)</h2>
          <p>회사는 관련 법령에 따라 개인정보를 보호하며, 별도의 개인정보처리방침에 따릅니다.</p>
        </section>

        <section className="terms-of-service-section">
          <h2>제17조 (준거법 및 관할)</h2>
          <ol>
            <li>본 약관은 대한민국 법령을 따릅니다.</li>
            <li>분쟁 발생 시 회사 본점 소재지 관할 법원을 전속 관할로 합니다.</li>
          </ol>
        </section>

        <section className="terms-of-service-section terms-of-service-supplement">
          <h2>부칙</h2>
          <p>본 약관은 2026년 07월 01일부터 시행됩니다.</p>
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

export default TermsOfService
