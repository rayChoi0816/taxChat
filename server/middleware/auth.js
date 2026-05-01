import jwt from 'jsonwebtoken'

export const authenticateToken = (req, res, next) => {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const skipAuth = process.env.SKIP_AUTH !== 'false'

  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  // 개발·SKIP_AUTH: 토큰이 있으면 먼저 검증해 본인(id)·관리자(isAdmin) 구분에 쓰고,
  // 없거나 깨진 경우에만 기본 관리자 컨텍스트로 통과(기존 관리자 화면 호환).
  if (nodeEnv === 'development' && skipAuth) {
    if (token) {
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
        return next()
      } catch {
        // ignore — 아래 기본 관리자
      }
    }
    req.user = { id: 1, phoneNumber: 'admin', isAdmin: true, role: 'admin' }
    return next()
  }

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

