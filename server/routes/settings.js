import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsRoot = path.join(__dirname, '../uploads')
const bannersDir = path.join(uploadsRoot, 'banners')

if (!fs.existsSync(bannersDir)) {
  fs.mkdirSync(bannersDir, { recursive: true })
}

// 요구사항: 권장 사이즈 720 x 600 px
const BANNER_WIDTH = 720
const BANNER_HEIGHT = 600
// 요구사항: 2MB 이하
const MAX_FILE_SIZE = 2 * 1024 * 1024
// 요구사항: jpg, png, webp 허용
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

const MIN_DISPLAY_TIME = 1
const MAX_DISPLAY_TIME = 10

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true)
    cb(new Error('지원 포맷은 JPG, PNG, WebP 입니다'))
  },
})

const router = express.Router()

function resolvePublicBaseUrl(req) {
  // 1) 환경 변수가 지정되어 있으면 최우선 (예: https://api.taxchat.co.kr)
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  }

  // 2) reverse proxy 가 보내주는 X-Forwarded-Proto 헤더를 사용 (Render 등 배포 환경)
  //    - app.set('trust proxy', true) 가 설정돼 있으면 req.protocol 이 자동으로 정확해지지만,
  //      혹시 누락된 환경에서도 mixed-content 가 발생하지 않도록 헤더를 직접 확인합니다.
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim()
  let protocol = forwardedProto || req.protocol

  // 3) 운영(NODE_ENV=production) 환경에서는 안전을 위해 항상 https 로 강제합니다.
  //    - http 로 빌드된 이미지 URL 이 HTTPS 프론트에서 차단되는 사고를 막기 위함.
  if (process.env.NODE_ENV === 'production' && protocol !== 'https') {
    protocol = 'https'
  }

  return `${protocol}://${req.get('host')}`
}

function clampDisplayTime(value, fallback = 3) {
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.max(MIN_DISPLAY_TIME, Math.min(MAX_DISPLAY_TIME, n))
}

function rowToBanner(req, row) {
  const rel = String(row.image_url || '').replace(/^\/+/, '')
  return {
    id: row.id,
    imageUrl: `${resolvePublicBaseUrl(req)}/uploads/${rel}`,
    linkUrl: row.link_url || '',
    displayOrder: row.display_order,
    displayTime: row.display_time,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

async function processAndSaveImage(buffer) {
  // 720x600 센터 크롭 + 리사이즈, webp 로 저장 (용량 최적화)
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`
  const absPath = path.join(bannersDir, filename)
  await sharp(buffer)
    .rotate()
    .resize(BANNER_WIDTH, BANNER_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 85 })
    .toFile(absPath)
  return `banners/${filename}`
}

function unlinkIfExists(relPath) {
  if (!relPath) return
  if (relPath.includes('..') || relPath.startsWith('/')) return
  const abs = path.join(uploadsRoot, relPath)
  if (abs.startsWith(uploadsRoot) && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs)
    } catch {
      // ignore
    }
  }
}

// 메인 배너 목록 (공개: 활성 배너만, 관리자: 전체)
router.get('/main-banners', async (req, res) => {
  try {
    const includeInactive = req.query.all === '1' || req.query.all === 'true'
    const where = includeInactive ? '' : 'WHERE is_active = true'
    const result = await pool.query(
      `SELECT id, image_url, link_url, display_order, display_time, is_active, created_at
       FROM main_banners
       ${where}
       ORDER BY display_order ASC, created_at ASC`
    )
    res.json({
      success: true,
      data: result.rows.map((row) => rowToBanner(req, row)),
    })
  } catch (error) {
    console.error('메인 배너 조회 오류:', error)
    res.status(500).json({ error: '메인 배너를 불러오는 중 오류가 발생했습니다' })
  }
})

// 메인 배너 등록 (이미지 + 선택 필드들)
router.post(
  '/main-banners',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '이미지 파일이 필요합니다' })
      }

      const relativePath = await processAndSaveImage(req.file.buffer)

      const linkUrl = (req.body.linkUrl || '').trim() || null
      const displayTime = clampDisplayTime(req.body.displayTime, 3)

      const maxOrder = await pool.query(
        'SELECT COALESCE(MAX(display_order), 0) AS m FROM main_banners'
      )
      const nextOrder = (maxOrder.rows[0]?.m || 0) + 1

      const isActive =
        req.body.isActive === undefined
          ? true
          : String(req.body.isActive) === 'true' || req.body.isActive === true

      const inserted = await pool.query(
        `INSERT INTO main_banners (image_url, link_url, display_order, display_time, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, image_url, link_url, display_order, display_time, is_active, created_at`,
        [relativePath, linkUrl, nextOrder, displayTime, isActive]
      )

      res.json({
        success: true,
        data: rowToBanner(req, inserted.rows[0]),
      })
    } catch (error) {
      console.error('메인 배너 등록 오류:', error)
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '이미지 용량은 2MB 이하여야 합니다' })
      }
      res.status(500).json({ error: error.message || '메인 배너 등록 중 오류가 발생했습니다' })
    }
  }
)

// 메인 배너 수정 (이미지 교체 선택)
router.put(
  '/main-banners/:id',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      const idNum = Number.parseInt(req.params.id, 10)
      if (Number.isNaN(idNum)) {
        return res.status(400).json({ error: '잘못된 배너 ID입니다' })
      }

      const existing = await pool.query(
        `SELECT id, image_url, link_url, display_order, display_time, is_active, created_at
         FROM main_banners WHERE id = $1`,
        [idNum]
      )
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: '배너를 찾을 수 없습니다' })
      }
      const current = existing.rows[0]

      let newImagePath = current.image_url
      if (req.file) {
        newImagePath = await processAndSaveImage(req.file.buffer)
      }

      const linkUrl =
        req.body.linkUrl !== undefined
          ? (req.body.linkUrl || '').trim() || null
          : current.link_url

      const displayOrder =
        req.body.displayOrder !== undefined
          ? Number.parseInt(req.body.displayOrder, 10) || 0
          : current.display_order

      const displayTime =
        req.body.displayTime !== undefined
          ? clampDisplayTime(req.body.displayTime, current.display_time || 3)
          : current.display_time

      const isActive =
        req.body.isActive === undefined
          ? current.is_active
          : String(req.body.isActive) === 'true' || req.body.isActive === true

      const updated = await pool.query(
        `UPDATE main_banners
         SET image_url = $1,
             link_url = $2,
             display_order = $3,
             display_time = $4,
             is_active = $5
         WHERE id = $6
         RETURNING id, image_url, link_url, display_order, display_time, is_active, created_at`,
        [newImagePath, linkUrl, displayOrder, displayTime, isActive, idNum]
      )

      if (req.file && current.image_url && current.image_url !== newImagePath) {
        unlinkIfExists(current.image_url)
      }

      res.json({ success: true, data: rowToBanner(req, updated.rows[0]) })
    } catch (error) {
      console.error('메인 배너 수정 오류:', error)
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '이미지 용량은 2MB 이하여야 합니다' })
      }
      res.status(500).json({ error: error.message || '메인 배너 수정 중 오류가 발생했습니다' })
    }
  }
)

// 순서 일괄 변경: [{ id, displayOrder }]
router.patch('/main-banners/reorder', authenticateToken, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (items.length === 0) {
    return res.status(400).json({ error: '변경할 항목이 없습니다' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const it of items) {
      const id = Number.parseInt(it.id, 10)
      const order = Number.parseInt(it.displayOrder, 10)
      if (Number.isNaN(id) || Number.isNaN(order)) continue
      await client.query(
        'UPDATE main_banners SET display_order = $1 WHERE id = $2',
        [order, id]
      )
    }
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('메인 배너 순서 변경 오류:', error)
    res.status(500).json({ error: '순서 변경 중 오류가 발생했습니다' })
  } finally {
    client.release()
  }
})

// ON/OFF 토글
router.patch('/main-banners/:id/active', authenticateToken, async (req, res) => {
  try {
    const idNum = Number.parseInt(req.params.id, 10)
    if (Number.isNaN(idNum)) {
      return res.status(400).json({ error: '잘못된 배너 ID입니다' })
    }
    const isActive =
      req.body?.isActive === undefined
        ? false
        : String(req.body.isActive) === 'true' || req.body.isActive === true

    const updated = await pool.query(
      `UPDATE main_banners SET is_active = $1 WHERE id = $2
       RETURNING id, image_url, link_url, display_order, display_time, is_active, created_at`,
      [isActive, idNum]
    )
    if (updated.rows.length === 0) {
      return res.status(404).json({ error: '배너를 찾을 수 없습니다' })
    }
    res.json({ success: true, data: rowToBanner(req, updated.rows[0]) })
  } catch (error) {
    console.error('메인 배너 상태 변경 오류:', error)
    res.status(500).json({ error: '상태 변경 중 오류가 발생했습니다' })
  }
})

// 배너 삭제
router.delete('/main-banners/:id', authenticateToken, async (req, res) => {
  try {
    const idNum = Number.parseInt(req.params.id, 10)
    if (Number.isNaN(idNum)) {
      return res.status(400).json({ error: '잘못된 배너 ID입니다' })
    }
    const existing = await pool.query(
      'SELECT id, image_url FROM main_banners WHERE id = $1',
      [idNum]
    )
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '배너를 찾을 수 없습니다' })
    }

    await pool.query('DELETE FROM main_banners WHERE id = $1', [idNum])
    unlinkIfExists(existing.rows[0].image_url)

    res.json({ success: true })
  } catch (error) {
    console.error('메인 배너 삭제 오류:', error)
    res.status(500).json({ error: '메인 배너 삭제 중 오류가 발생했습니다' })
  }
})

export default router
