import express from 'express'
import pool from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 업로드 디렉토리 생성
const uploadDir = process.env.UPLOAD_DIR || './uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage })

const router = express.Router()

// 서류 카테고리 조회
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM document_categories ORDER BY name')

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('서류 카테고리 조회 오류:', error)
    res.status(500).json({ error: '서류 카테고리 조회 중 오류가 발생했습니다' })
  }
})

// 서류 카테고리 등록
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body

    const result = await pool.query(
      'INSERT INTO document_categories (name) VALUES ($1) RETURNING *',
      [name]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 카테고리 등록 오류:', error)
    res.status(500).json({ error: '서류 카테고리 등록 중 오류가 발생했습니다' })
  }
})

// 서류 조회
router.get('/', async (req, res) => {
  try {
    const { usageStatus } = req.query

    let query = `
      SELECT d.*, dc.name as category_name
      FROM documents d
      LEFT JOIN document_categories dc ON d.category_id = dc.id
      WHERE d.deleted = false
    `
    const params = []

    if (usageStatus) {
      query += ' AND d.usage_status = $1'
      params.push(usageStatus)
    }

    query += ' ORDER BY d.created_at DESC'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('서류 조회 오류:', error)
    res.status(500).json({ error: '서류 조회 중 오류가 발생했습니다' })
  }
})

// 서류 등록
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { categoryId, name, description } = req.body

    const result = await pool.query(
      `INSERT INTO documents (category_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [categoryId, name, description]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 등록 오류:', error)
    res.status(500).json({ error: '서류 등록 중 오류가 발생했습니다' })
  }
})

// 회원 서류 조회
router.get('/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params

    const result = await pool.query(
      `SELECT md.*, d.name as document_name, dc.name as category_name
       FROM member_documents md
       LEFT JOIN documents d ON md.document_id = d.id
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       WHERE md.member_id = $1 AND md.deleted = false
       ORDER BY md.created_at DESC`,
      [memberId]
    )

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('회원 서류 조회 오류:', error)
    res.status(500).json({ error: '회원 서류 조회 중 오류가 발생했습니다' })
  }
})

// 회원 서류 업로드
router.post('/member/:memberId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { memberId } = req.params
    const { documentId, description, orderId } = req.body

    if (!req.file) {
      return res.status(400).json({ error: '파일이 필요합니다' })
    }

    const result = await pool.query(
      `INSERT INTO member_documents (member_id, order_id, document_id, file_path, file_name, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        memberId,
        orderId || null,
        documentId,
        req.file.path,
        req.file.originalname,
        description || null
      ]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 업로드 오류:', error)
    res.status(500).json({ error: '서류 업로드 중 오류가 발생했습니다' })
  }
})

// 회원 서류 다운로드
router.get('/member/:memberId/:documentId/download', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params

    const result = await pool.query(
      'SELECT * FROM member_documents WHERE id = $1',
      [documentId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    const document = result.rows[0]
    const filePath = path.join(__dirname, '..', document.file_path)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다' })
    }

    res.download(filePath, document.file_name)
  } catch (error) {
    console.error('서류 다운로드 오류:', error)
    res.status(500).json({ error: '서류 다운로드 중 오류가 발생했습니다' })
  }
})

// 회원 서류 삭제
router.delete('/member/:memberId/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params

    await pool.query(
      'UPDATE member_documents SET deleted = true WHERE id = $1',
      [documentId]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('서류 삭제 오류:', error)
    res.status(500).json({ error: '서류 삭제 중 오류가 발생했습니다' })
  }
})

export default router

