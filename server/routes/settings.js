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
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  }

  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim()
  let protocol = forwardedProto || req.protocol

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

/**
 * 이미지 바이너리를 직접 API 로 서빙한다.
 *  - 원본은 main_banners.image_data (BYTEA) 이므로 서버 파일시스템이
 *    재시작/재배포로 비워져도(Render 등 ephemeral disk) 이미지는 사라지지 않는다.
 *  - 캐시 무효화는 ?v=updated_at(epoch) 으로 처리 → 변경 즉시 새 이미지 로드.
 */
function buildImageUrl(req, row) {
  const base = resolvePublicBaseUrl(req)
  const v = row.updated_at
    ? new Date(row.updated_at).getTime()
    : row.created_at
    ? new Date(row.created_at).getTime()
    : 0
  return `${base}/api/settings/main-banners/${row.id}/image?v=${v}`
}

function rowToBanner(req, row) {
  return {
    id: row.id,
    imageUrl: buildImageUrl(req, row),
    linkUrl: row.link_url || '',
    displayOrder: row.display_order,
    displayTime: row.display_time,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 업로드된 원본 버퍼를 720x600 webp 로 정규화한다.
 *  - BYTEA 컬럼에 저장할 buffer 와 mime 를 리턴.
 *  - 호환을 위해 파일도 함께 기록(image_url) 하지만, 파일은 캐시일 뿐이며
 *    원본 데이터는 DB 의 image_data 이다.
 */
async function normalizeImage(buffer) {
  const out = await sharp(buffer)
    .rotate()
    .resize(BANNER_WIDTH, BANNER_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toBuffer()
  return { buffer: out, mime: 'image/webp' }
}

function writeFileCacheSafe(buffer) {
  // 파일 저장 실패는 치명적이지 않다(원본이 DB 에 있으므로).
  try {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`
    const absPath = path.join(bannersDir, filename)
    fs.writeFileSync(absPath, buffer)
    return `banners/${filename}`
  } catch {
    return null
  }
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

/**
 * 파일이 남아 있는 구버전 행에 대해, image_data 로 lazy 마이그레이션 한다.
 *  - 한 번이라도 DB 에 백업되면 이후로는 절대 손상되지 않는다.
 */
async function lazyBackfillFromFile(row) {
  if (row.image_data) return row
  const rel = String(row.image_url || '').replace(/^\/+/, '')
  if (!rel) return row
  if (rel.includes('..')) return row
  const abs = path.join(uploadsRoot, rel)
  if (!abs.startsWith(uploadsRoot) || !fs.existsSync(abs)) return row
  try {
    const buf = fs.readFileSync(abs)
    const ext = path.extname(rel).toLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : 'image/webp'
    await pool.query(
      `UPDATE main_banners SET image_data = $1, image_mime = $2 WHERE id = $3`,
      [buf, mime, row.id]
    )
    return { ...row, image_data: buf, image_mime: mime }
  } catch {
    return row
  }
}

// 메인 배너 목록 (공개: 활성 배너만, 관리자: 전체)
router.get('/main-banners', async (req, res) => {
  try {
    const includeInactive = req.query.all === '1' || req.query.all === 'true'
    const where = includeInactive ? '' : 'WHERE is_active = true'
    const result = await pool.query(
      `SELECT id, image_url, image_mime, link_url, display_order, display_time,
              is_active, created_at, updated_at,
              (image_data IS NOT NULL) AS has_data
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

// 메인 배너 이미지 바이너리 서빙 (DB BYTEA 우선, 없으면 파일 fallback)
router.get('/main-banners/:id/image', async (req, res) => {
  try {
    const idNum = Number.parseInt(req.params.id, 10)
    if (Number.isNaN(idNum)) return res.status(400).end()
    const result = await pool.query(
      `SELECT id, image_data, image_mime, image_url FROM main_banners WHERE id = $1`,
      [idNum]
    )
    if (result.rows.length === 0) return res.status(404).end()
    let row = result.rows[0]
    if (!row.image_data) {
      row = await lazyBackfillFromFile(row)
    }
    if (row.image_data) {
      res.setHeader('Content-Type', row.image_mime || 'image/webp')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return res.send(row.image_data)
    }
    return res.status(404).end()
  } catch (error) {
    console.error('메인 배너 이미지 서빙 오류:', error)
    res.status(500).end()
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

      const { buffer, mime } = await normalizeImage(req.file.buffer)
      const relativePath = writeFileCacheSafe(buffer)

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
        `INSERT INTO main_banners
           (image_url, image_data, image_mime, link_url, display_order, display_time, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING id, image_url, image_mime, link_url, display_order, display_time,
                   is_active, created_at, updated_at`,
        [relativePath, buffer, mime, linkUrl, nextOrder, displayTime, isActive]
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
        `SELECT id, image_url, image_data, image_mime, link_url, display_order,
                display_time, is_active, created_at, updated_at
         FROM main_banners WHERE id = $1`,
        [idNum]
      )
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: '배너를 찾을 수 없습니다' })
      }
      const current = existing.rows[0]

      let newImagePath = current.image_url
      let newImageData = current.image_data
      let newImageMime = current.image_mime
      let oldImagePath = null
      if (req.file) {
        const { buffer, mime } = await normalizeImage(req.file.buffer)
        newImageData = buffer
        newImageMime = mime
        oldImagePath = current.image_url
        newImagePath = writeFileCacheSafe(buffer)
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
             image_data = $2,
             image_mime = $3,
             link_url = $4,
             display_order = $5,
             display_time = $6,
             is_active = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING id, image_url, image_mime, link_url, display_order, display_time,
                   is_active, created_at, updated_at`,
        [newImagePath, newImageData, newImageMime, linkUrl, displayOrder, displayTime, isActive, idNum]
      )

      if (oldImagePath && oldImagePath !== newImagePath) {
        unlinkIfExists(oldImagePath)
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
      `UPDATE main_banners SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, image_url, image_mime, link_url, display_order, display_time,
                 is_active, created_at, updated_at`,
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

// 배너 삭제 (사용자가 명시적으로 삭제하기 전까지는 절대 사라지지 않는다)
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
