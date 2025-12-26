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

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// CORS 설정
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}
app.use(cors(corsOptions))

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
      documents: '/api/documents'
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

// 데이터베이스 초기화 및 마이그레이션 (개발 환경에서만)
if (process.env.NODE_ENV === 'development') {
  initDatabase()
    .then(() => migrateCustomerId())
    .catch(console.error)
}

// 서버 시작
app.listen(PORT, () => {
  console.log('='.repeat(50))
  console.log(`🚀 TaxChat 서버가 포트 ${PORT}에서 실행 중입니다`)
  console.log(`📝 환경: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐 API 엔드포인트: http://localhost:${PORT}/api`)
  console.log(`💚 헬스 체크: http://localhost:${PORT}/api/health`)
  console.log('='.repeat(50))
})

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

