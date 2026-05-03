import 'dotenv/config'
import { sendAlimtalk, buildSignupAdminAlimtalkRequest } from './services/sms.js'
const to = String(process.env.ADMIN_NOTIFY_PHONE || '').split(',')[0].replace(/\D/g, '')
const textPayload = buildSignupAdminAlimtalkRequest({
  customerId: 'TEST-KAKAO',
  memberType: '비사업자',
  name: '알림톡테스트발송',
  phone: to,
  signupAt: new Date(),
})
const r = await sendAlimtalk({
  to,
  text: textPayload.text,
  subject: '[택스챗] 신규 회원가입 테스트',
  changeWord: textPayload.changeWord,
  ppurioIsResend: textPayload.ppurioIsResend,
  lmsFallbackBody: textPayload.plainText,
})
console.log(JSON.stringify(r, null, 2))
