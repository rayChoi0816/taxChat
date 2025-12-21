import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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

const app = express()
const PORT = process.env.PORT || 3001

// 미들웨어
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 정적 파일 서빙 (업로드된 파일)
app.use('/uploads', express.static('uploads'))

// 라우트
app.use('/api/auth', authRoutes)
app.use('/api/members', memberRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/documents', documentRoutes)

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TaxChat Server is running' })
})

// 데이터베이스 초기화 및 마이그레이션 (개발 환경에서만)
if (process.env.NODE_ENV === 'development') {
  initDatabase()
    .then(() => migrateCustomerId())
    .catch(console.error)
}

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`)
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`)
})

