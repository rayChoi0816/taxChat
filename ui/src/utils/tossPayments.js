// =============================================================================
// TossPayments 결제 연동 헬퍼
// -----------------------------------------------------------------------------
// - 공식 CDN 스크립트(https://js.tosspayments.com/v1/payment)를 동적으로 로드합니다.
//   (npm 설치 없이도 로컬·Render 어디서나 동일하게 동작)
// - 클라이언트 키는 환경변수 VITE_TOSS_CLIENT_KEY 에서 읽고, 없으면
//   백엔드의 GET /api/payments/toss/config 를 폴백으로 사용합니다.
// - 시크릿 키는 절대 이 모듈에서 다루지 않습니다. (서버에서만 사용)
// =============================================================================
import { paymentAPI } from './api'

const TOSS_SDK_URL = 'https://js.tosspayments.com/v1/payment'

let sdkLoadingPromise = null

const loadTossScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 사용할 수 있습니다.'))
  }
  if (window.TossPayments) return Promise.resolve(window.TossPayments)
  if (sdkLoadingPromise) return sdkLoadingPromise

  sdkLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TOSS_SDK_URL}"]`)
    const handleLoad = () => {
      if (window.TossPayments) resolve(window.TossPayments)
      else reject(new Error('TossPayments SDK 로드 실패'))
    }
    if (existing) {
      existing.addEventListener('load', handleLoad, { once: true })
      existing.addEventListener('error', () => reject(new Error('TossPayments SDK 로드 실패')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = TOSS_SDK_URL
    script.async = true
    script.onload = handleLoad
    script.onerror = () => reject(new Error('TossPayments SDK 로드 실패'))
    document.head.appendChild(script)
  })

  return sdkLoadingPromise
}

const resolveClientKey = async () => {
  const fromEnv = import.meta.env.VITE_TOSS_CLIENT_KEY
  if (fromEnv) return fromEnv

  // 환경변수가 없으면 서버 설정에서 받아옵니다. (Render 배포 시 ENV 누락 대비)
  try {
    const res = await paymentAPI.getTossConfig()
    if (res?.success && res.data?.clientKey) return res.data.clientKey
  } catch (e) {
    // 무시하고 아래에서 명시적 오류 발생
  }
  throw new Error('Toss 클라이언트 키가 설정되어 있지 않습니다. VITE_TOSS_CLIENT_KEY 를 확인하세요.')
}

/**
 * 브라우저 호환 UUID 생성기.
 * - 최신 브라우저는 crypto.randomUUID() 를 지원합니다.
 * - 구형 환경 fallback 으로 crypto.getRandomValues 기반 v4 UUID 를 생성합니다.
 */
export const generateOrderId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch (_) {
    /* ignore */
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

/**
 * 현재 브라우저 origin 을 기반으로 success / fail URL 을 만듭니다.
 * - 로컬(http://localhost:5173) / Render 배포 도메인 어디서나 자동으로 적절히 동작합니다.
 */
export const buildReturnUrls = () => {
  const origin = window.location.origin
  return {
    successUrl: `${origin}/payment/success`,
    failUrl: `${origin}/payment/fail`,
  }
}

/**
 * TossPayments 결제창 호출.
 *
 * @param {Object} params
 * @param {number} params.amount       결제 금액 (원)
 * @param {string} params.orderId      UUID 등 6~64자 문자열
 * @param {string} params.orderName    결제창에 표시될 주문명 (상품명)
 * @param {string} [params.customerName] 구매자 이름
 * @param {string} [params.customerEmail] 구매자 이메일
 * @param {string} [params.method='카드'] 결제수단 ('카드','계좌이체','가상계좌','휴대폰' 등)
 */
export const requestTossPayment = async ({
  amount,
  orderId,
  orderName,
  customerName,
  customerEmail,
  method = '카드',
}) => {
  const TossPayments = await loadTossScript()
  const clientKey = await resolveClientKey()
  const { successUrl, failUrl } = buildReturnUrls()

  const tossPayments = TossPayments(clientKey)
  // requestPayment 는 결제창을 띄우고, 성공 시 successUrl 로 redirect 합니다.
  // 사용자가 결제창에서 취소(닫기)할 경우 reject 되므로 호출부에서 catch 처리합니다.
  return tossPayments.requestPayment(method, {
    amount: Number(amount),
    orderId,
    orderName,
    customerName: customerName || undefined,
    customerEmail: customerEmail || undefined,
    successUrl,
    failUrl,
  })
}
