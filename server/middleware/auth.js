import jwt from 'jsonwebtoken'

export const authenticateToken = (req, res, next) => {
  // 개발 모드에서 인증 우회 (환경 변수로 제어, 기본값은 true)
  const nodeEnv = process.env.NODE_ENV || 'development'
  const skipAuth = process.env.SKIP_AUTH !== 'false' // 기본값은 true (skip auth)
  
  if (nodeEnv === 'development' && skipAuth) {
    req.user = { id: 1, phoneNumber: 'admin' }
    return next()
  }

  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다' })
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다' })
    }
    req.user = user
    next()
  })
}

