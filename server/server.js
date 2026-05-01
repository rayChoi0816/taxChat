import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pool from './config/database.js'
import initDatabase from './config/initDatabase.js'
import migrateCustomerId from './config/migrateCustomerId.js'

// 라우트 임포트
import authRoutes from './routes/auth.js'
import memberRoutes from './routes/members.js'
import productRoutes from './routes/products.js'
import orderRoutes from './routes/orders.js'
import documentRoutes from './routes/documents.js'
import smsRoutes from './routes/sms.js'
import paymentRoutes from './routes/payments.js'
import settingsRoutes from './routes/settings.js'
import debugRoutes from './routes/debug.js'
import adminRoutes from './routes/admin.js'
import { ensureSystemSettingsDefaults } from './services/testModeService.js'

dotenv.config()

// 환경 변수 기본값 설정
process.env.NODE_ENV = process.env.NODE_ENV || 'development'
process.env.SKIP_AUTH = process.env.SKIP_AUTH || 'true'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Render / 일반 reverse proxy 뒤에서 동작하므로 X-Forwarded-* 헤더를 신뢰합니다.
//  - 이 설정이 없으면 req.protocol 이 항상 'http' 로 잡혀, 업로드 이미지 URL이
//    http:// 로 빌드되어 HTTPS 페이지에서 mixed-content 로 차단됩니다.
app.set('trust proxy', true)

// CORS 설정 (콤마로 여러 도메인 허용)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const corsOptions = {
  origin: (origin, callback) => {
    // 같은 서버·서버사이드 호출 (origin 없음) 은 허용
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error(`CORS 차단: ${origin}`))
  },
  credentials: true,
}
app.use(cors(corsOptions))

console.log('허용된 CORS Origin:', allowedOrigins)

// Body 파싱 미들웨어
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 요청 로깅 미들웨어 (개발 환경)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    next()
  })
}

// 정적 파일 서빙 (업로드된 파일)
const uploadsDir = join(__dirname, 'uploads')
app.use('/uploads', express.static(uploadsDir))

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    message: 'TaxChat API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      members: '/api/members',
      products: '/api/products',
      orders: '/api/orders',
      documents: '/api/documents',
      sms: '/api/sms',
      payments: '/api/payments'
    },
    documentation: 'See README.md for API documentation'
  })
})

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'TaxChat Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// API 라우트
app.use('/api/auth', authRoutes)
app.use('/api/members', memberRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/sms', smsRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/debug', debugRoutes)
app.use('/api/admin', adminRoutes)

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `경로를 찾을 수 없습니다: ${req.method} ${req.path}`
  })
})

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('에러 발생:', err)
  
  const statusCode = err.statusCode || 500
  const message = err.message || '서버 내부 오류가 발생했습니다'
  
  res.status(statusCode).json({
    error: 'Error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// 데이터베이스 초기화 및 마이그레이션 (개발 환경), 전역 설정 기본값 (모든 환경)
const bootServer = async () => {
  if (process.env.NODE_ENV === 'development') {
    try {
      await initDatabase()
      await migrateCustomerId()
    } catch (err) {
      console.error(err)
    }
  }

  try {
    await ensureSystemSettingsDefaults()
    console.log('system_settings 기본값 확인 완료')
  } catch (err) {
    console.warn('system_settings 기본값 확인 실패:', err.message)
  }

  app.listen(PORT, () => {
    console.log('='.repeat(50))
    console.log(`🚀 TaxChat 서버가 포트 ${PORT}에서 실행 중입니다`)
    console.log(`📝 환경: ${process.env.NODE_ENV || 'development'}`)
    console.log(`🌐 API 엔드포인트: http://localhost:${PORT}/api`)
    console.log(`💚 헬스 체크: http://localhost:${PORT}/api/health`)
    console.log('='.repeat(50))
  })
}

bootServer()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다...')
  pool.end(() => {
    console.log('데이터베이스 연결이 종료되었습니다.')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\nSIGINT 신호를 받았습니다. 서버를 종료합니다...')
  pool.end(() => {
    console.log('데이터베이스 연결이 종료되었습니다.')
    process.exit(0)
  })
})

