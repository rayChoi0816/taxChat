// ============================================================================
// 디버그 전용 라우트
// ----------------------------------------------------------------------------
// 이 파일은 "개발·운영 중에 서버 상태를 확인할 수 있는 도구" 를 모아 둡니다.
// 예를 들어 뿌리오 같이 "허용 IP" 를 요구하는 외부 서비스를 쓸 때,
// 이 서버가 바깥으로 나갈 때 어떤 공인 IP 를 쓰는지 알아야 하는데
// GET /api/debug/ip 를 호출하면 그 값을 바로 돌려줍니다.
// ============================================================================

import express from 'express'
import axios from 'axios'
import {
  sendAlimtalk,
  buildSignupNotificationMessage,
} from '../services/sms.js'

const router = express.Router()

// 여러 IP 조회 서비스를 시도해서 가장 먼저 성공하는 값을 사용합니다.
// (한 곳이 잠깐 막혀도 다른 곳에서 받아올 수 있도록 안전장치)
const IP_LOOKUP_URLS = [
  'https://api.ipify.org?format=json', // { ip: "..." }
  'https://ifconfig.me/all.json',      // { ip_addr: "..." }
  'https://ipv4.icanhazip.com',         // 텍스트 한 줄
]

/**
 * 바깥 서비스에 "내 공인 IP 알려줘" 하고 물어본 다음
 * 가장 먼저 유효한 응답을 돌려주는 함수.
 */
const lookupPublicIp = async () => {
  const errors = []
  for (const url of IP_LOOKUP_URLS) {
    try {
      const res = await axios.get(url, { timeout: 5000 })
      const data = res.data

      // 응답 형식이 서비스마다 조금 달라서 세 가지 모두 받아줍니다.
      if (typeof data === 'string') {
        const ip = data.trim()
        if (ip) return { ip, source: url }
      } else if (data && typeof data === 'object') {
        const ip = data.ip || data.ip_addr || data.address
        if (ip) return { ip: String(ip).trim(), source: url }
      }
    } catch (err) {
      errors.push(`${url} → ${err.message}`)
    }
  }
  const combined = new Error('공인 IP 조회 실패')
  combined.detail = errors.join(' | ')
  throw combined
}

/**
 * GET /api/debug/ip
 *  - 동작: 현재 Render 서버의 아웃바운드(바깥으로 나갈 때 쓰는) 공인 IP 반환
 *  - 응답 예시: { "ip": "34.123.45.67" }
 *  - 뿌리오 대시보드 "허용 IP" 에 등록할 때 이 값을 사용합니다.
 */
router.get('/ip', async (req, res) => {
  try {
    const { ip, source } = await lookupPublicIp()
    res.json({ ip, source })
  } catch (error) {
    console.error('공인 IP 조회 오류:', error.detail || error.message)
    res.status(502).json({
      error: 'IP_LOOKUP_FAILED',
      detail: error.detail || error.message,
    })
  }
})

/**
 * GET /api/debug/alimtalk-config
 *  - 현재 서버에 설정된 알림톡 환경변수가 정상인지 확인하는 진단용 엔드포인트.
 *  - 보안을 위해 키 값 자체는 일부만 노출한다.
 */
router.get('/alimtalk-config', (req, res) => {
  const mask = (v) => {
    if (!v) return null
    const s = String(v)
    if (s.length <= 8) return '***'
    return `${s.slice(0, 6)}***${s.slice(-3)}`
  }
  res.json({
    PPURIO_ACCOUNT: mask(process.env.PPURIO_ACCOUNT),
    PPURIO_API_KEY: process.env.PPURIO_API_KEY ? 'set' : 'empty',
    PPURIO_FROM: process.env.PPURIO_FROM || null,
    PPURIO_KAKAO_SENDER_KEY: mask(process.env.PPURIO_KAKAO_SENDER_KEY),
    PPURIO_KAKAO_TEMPLATE_CODE: process.env.PPURIO_KAKAO_TEMPLATE_CODE || null,
    ADMIN_NOTIFY_PHONE: process.env.ADMIN_NOTIFY_PHONE || null,
    NODE_ENV: process.env.NODE_ENV || 'development',
  })
})

/**
 * POST /api/debug/alimtalk-test
 *  - 운영 중에 알림톡 발송 경로를 직접 테스트할 수 있는 엔드포인트.
 *  - body: { to?: "01012345678" }   to 가 없으면 ADMIN_NOTIFY_PHONE 첫 번째 사용
 */
router.post('/alimtalk-test', async (req, res) => {
  const targetRaw =
    String(req.body?.to || '').replace(/[^\d]/g, '') ||
    String(process.env.ADMIN_NOTIFY_PHONE || '')
      .split(',')[0]
      .replace(/[^\d]/g, '')

  if (!targetRaw) {
    return res.status(400).json({
      error: 'NO_TARGET',
      detail: 'body.to 또는 ADMIN_NOTIFY_PHONE 환경변수가 필요합니다',
    })
  }

  const text = buildSignupNotificationMessage({
    customerId: 'TEST-0001',
    memberType: '비사업자',
    name: '테스트',
    phone: targetRaw,
    signupAt: new Date(),
  })

  try {
    const r = await sendAlimtalk({
      to: targetRaw,
      text,
      subject: '[택스챗] 알림톡 테스트',
    })
    res.json({ success: true, result: r })
  } catch (err) {
    console.error('알림톡 테스트 실패:', err.message, err.detail || '')
    res.status(502).json({
      success: false,
      error: 'ALIMTALK_TEST_FAILED',
      message: err.message,
      ppurioMessage: err.ppurioMessage,
      detail: err.detail,
      serverIp: err.serverIp,
    })
  }
})

export default router
