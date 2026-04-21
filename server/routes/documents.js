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

// 파일명 디코딩 미들웨어 (업로드 시)
const decodeFileNameMiddleware = (req, res, next) => {
  if (req.file && req.file.originalname) {
    try {
      // 파일명이 URL 인코딩되어 있을 수 있으므로 디코딩 시도
      let decodedName = decodeURIComponent(req.file.originalname)
      // 한글 파일명이 깨진 경우 latin1 -> utf8 변환 시도
      if (decodedName !== req.file.originalname) {
        req.file.originalname = decodedName
      } else {
        // latin1로 인코딩된 경우 디코딩
        try {
          const buffer = Buffer.from(req.file.originalname, 'latin1')
          const utf8Name = buffer.toString('utf8')
          // 한글이 포함되어 있는지 확인
          if (/[가-힣]/.test(utf8Name)) {
            req.file.originalname = utf8Name
          }
        } catch (e) {
          // 디코딩 실패 시 원본 유지
        }
      }
    } catch (e) {
      // 디코딩 실패 시 원본 유지
    }
  }
  next()
}

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

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '서류 카테고리명이 필요합니다' })
    }

    // 중복 체크
    const existing = await pool.query(
      'SELECT * FROM document_categories WHERE name = $1',
      [name.trim()]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '이미 존재하는 서류 카테고리입니다' })
    }

    const result = await pool.query(
      'INSERT INTO document_categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
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

// 서류 카테고리 삭제
router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // 해당 카테고리를 사용하는 서류가 있는지 확인
    const documentsUsingCategory = await pool.query(
      'SELECT COUNT(*) as count FROM documents WHERE category_id = $1 AND deleted = false',
      [id]
    )

    if (parseInt(documentsUsingCategory.rows[0].count) > 0) {
      return res.status(400).json({ error: '해당 카테고리를 사용하는 서류가 있어 삭제할 수 없습니다' })
    }

    await pool.query('DELETE FROM document_categories WHERE id = $1', [id])

    res.json({
      success: true
    })
  } catch (error) {
    console.error('서류 카테고리 삭제 오류:', error)
    res.status(500).json({ error: '서류 카테고리 삭제 중 오류가 발생했습니다' })
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

    console.log(`[서류 조회] deleted=false 조건으로 조회, 결과: ${result.rows.length}건`)

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

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '서류명이 필요합니다' })
    }

    // categoryId가 문자열인 경우 숫자로 변환
    const catId = categoryId ? (typeof categoryId === 'string' ? parseInt(categoryId) : categoryId) : null

    const result = await pool.query(
      `INSERT INTO documents (category_id, name, description, usage_status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [catId, name.trim(), description || null, '비진열']
    )

    // 등록된 서류와 카테고리 정보를 함께 조회
    const insertedId = result.rows[0].id
    const documentResult = await pool.query(
      `SELECT d.*, dc.name as category_name
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       WHERE d.id = $1`,
      [insertedId]
    )

    res.json({
      success: true,
      data: documentResult.rows[0]
    })
  } catch (error) {
    console.error('서류 등록 오류:', error)
    res.status(500).json({ error: '서류 등록 중 오류가 발생했습니다' })
  }
})

// 서류 수정
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { categoryId, name, description } = req.body

    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (categoryId !== undefined) {
      const catId = categoryId ? (typeof categoryId === 'string' ? parseInt(categoryId) : categoryId) : null
      updateFields.push(`category_id = $${paramIndex}`)
      updateValues.push(catId)
      paramIndex++
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: '서류명이 필요합니다' })
      }
      updateFields.push(`name = $${paramIndex}`)
      updateValues.push(name.trim())
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      updateValues.push(description || null)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 정보가 없습니다' })
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(id)

    const query = `
      UPDATE documents SET
        ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `

    const result = await pool.query(query, updateValues)

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 수정된 서류와 카테고리 정보를 함께 조회
    const documentResult = await pool.query(
      `SELECT d.*, dc.name as category_name
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       WHERE d.id = $1`,
      [id]
    )

    res.json({
      success: true,
      data: documentResult.rows[0]
    })
  } catch (error) {
    console.error('서류 수정 오류:', error)
    res.status(500).json({ error: '서류 수정 중 오류가 발생했습니다' })
  }
})

// 서류 진열 상태 변경
router.patch('/:id/usage-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { usageStatus } = req.body

    if (!usageStatus || !['진열', '비진열'].includes(usageStatus)) {
      return res.status(400).json({ error: '올바른 사용 여부 상태가 필요합니다' })
    }

    const result = await pool.query(
      `UPDATE documents 
       SET usage_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [usageStatus, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 수정된 서류와 카테고리 정보를 함께 조회
    const documentResult = await pool.query(
      `SELECT d.*, dc.name as category_name
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       WHERE d.id = $1`,
      [id]
    )

    res.json({
      success: true,
      data: documentResult.rows[0]
    })
  } catch (error) {
    console.error('서류 진열 상태 변경 오류:', error)
    res.status(500).json({ error: '서류 진열 상태 변경 중 오류가 발생했습니다' })
  }
})

// 서류 삭제
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    console.log(`[서류 삭제] ID: ${id}, deleted를 true로 업데이트 시작`)
    
    const result = await pool.query(
      'UPDATE documents SET deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, deleted',
      [id]
    )

    if (result.rowCount === 0) {
      console.log(`[서류 삭제] ID: ${id}, 해당 서류를 찾을 수 없음`)
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    console.log(`[서류 삭제] ID: ${id}, 삭제 완료. deleted=${result.rows[0].deleted}`)

    res.json({ success: true })
  } catch (error) {
    console.error('서류 삭제 오류:', error)
    res.status(500).json({ error: '서류 삭제 중 오류가 발생했습니다' })
  }
})

// 조합형 한글을 완성형으로 변환하는 함수
const composeHangul = (str) => {
  // 조합형 한글 범위: 초성(0x1100-0x1112), 중성(0x1161-0x1175), 종성(0x11A8-0x11C2)
  // 완성형 한글 범위: 0xAC00-0xD7A3
  const result = []
  let i = 0
  
  while (i < str.length) {
    const code = str.charCodeAt(i)
    
    // 조합형 한글인 경우
    if (code >= 0x1100 && code <= 0x1112) { // 초성
      const cho = code - 0x1100
      let jung = 0
      let jong = 0
      
      // 중성 확인
      if (i + 1 < str.length) {
        const nextCode = str.charCodeAt(i + 1)
        if (nextCode >= 0x1161 && nextCode <= 0x1175) {
          jung = nextCode - 0x1161
          i++
          
          // 종성 확인
          if (i + 1 < str.length) {
            const nextCode2 = str.charCodeAt(i + 1)
            if (nextCode2 >= 0x11A8 && nextCode2 <= 0x11C2) {
              jong = nextCode2 - 0x11A8
              i++
            }
          }
        }
      }
      
      // 완성형 한글로 변환: 0xAC00 + (cho * 588) + (jung * 28) + jong
      const completed = 0xAC00 + (cho * 588) + (jung * 28) + jong
      result.push(String.fromCharCode(completed))
    } else {
      result.push(str[i])
    }
    
    i++
  }
  
  return result.join('')
}

// 파일명 디코딩 헬퍼 함수
const decodeFileName = (fileName) => {
  if (!fileName) return fileName
  
  try {
    // 이미 올바른 UTF-8인 경우
    if (/[가-힣]/.test(fileName)) {
      return fileName
    }
    
    // latin1로 잘못 해석된 UTF-8 바이트를 올바르게 디코딩
    // 깨진 파일명을 latin1 바이트로 변환 후 UTF-8로 디코딩
    const latin1Buffer = Buffer.from(fileName, 'latin1')
    const latin1Decoded = latin1Buffer.toString('utf8')
    
    // 조합형 한글이 포함되어 있으면 완성형으로 변환
    if (/[\u1100-\u11FF]/.test(latin1Decoded)) {
      return composeHangul(latin1Decoded)
    }
    
    // 디코딩 후 한글이 포함되어 있으면 성공
    if (/[가-힣]/.test(latin1Decoded)) {
      return latin1Decoded
    }
    
    return fileName
  } catch (e) {
    return fileName
  }
}

// 관리자용 전체 첨부 서류 조회
router.get('/attachments', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, searchType, searchKeyword, sortOrder } = req.query

    let query = `
      SELECT 
        md.id,
        md.order_id,
        md.created_at,
        md.file_name,
        md.description,
        d.name as document_name,
        dc.name as category_name,
        m.id as member_id,
        m.name as member_name,
        m.business_name,
        m.phone_number,
        o.order_id as order_order_id
      FROM member_documents md
      LEFT JOIN documents d ON md.document_id = d.id
      LEFT JOIN document_categories dc ON d.category_id = dc.id
      LEFT JOIN members m ON md.member_id = m.id
      LEFT JOIN orders o ON md.order_id = o.id
      WHERE md.deleted = false
    `
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate) {
      query += ` AND md.created_at >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }
    if (endDate) {
      query += ` AND md.created_at <= $${paramIndex}::date + INTERVAL '1 day'`
      params.push(endDate)
      paramIndex++
    }

    // 검색 필터
    if (searchKeyword && searchType) {
      switch (searchType) {
        case '주문 ID':
          query += ` AND (o.order_id ILIKE $${paramIndex} OR md.order_id::text ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '고객':
          query += ` AND (m.name ILIKE $${paramIndex} OR m.business_name ILIKE $${paramIndex} OR m.phone_number ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '서류명':
          query += ` AND d.name ILIKE $${paramIndex}`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
      }
    }

    // 정렬
    if (sortOrder === '첨부일시 역순') {
      query += ' ORDER BY md.created_at DESC'
    } else if (sortOrder === '첨부일시순') {
      query += ' ORDER BY md.created_at ASC'
    } else if (sortOrder === '회원명순') {
      query += ' ORDER BY COALESCE(m.business_name, m.name) ASC'
    } else if (sortOrder === '서류명순') {
      query += ' ORDER BY d.name ASC'
    } else {
      query += ' ORDER BY md.created_at DESC'
    }

    const result = await pool.query(query, params)

    // 파일명 디코딩 처리 및 데이터 포맷팅
    const formattedRows = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_order_id || '-', // order_id가 null이면 "-"로 표시
      attachmentDate: row.created_at,
      memberName: row.business_name || row.member_name || '정보 없음',
      documentName: row.document_name || '서류',
      fileName: decodeFileName(row.file_name),
      description: row.description,
      categoryName: row.category_name,
      memberId: row.member_id,
      phoneNumber: row.phone_number
    }))

    res.json({
      success: true,
      data: formattedRows
    })
  } catch (error) {
    console.error('첨부 서류 조회 오류:', error)
    res.status(500).json({ error: '첨부 서류 조회 중 오류가 발생했습니다' })
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

    // 파일명 디코딩 처리
    const decodedRows = result.rows.map(row => ({
      ...row,
      file_name: decodeFileName(row.file_name)
    }))

    res.json({
      success: true,
      data: decodedRows
    })
  } catch (error) {
    console.error('회원 서류 조회 오류:', error)
    res.status(500).json({ error: '회원 서류 조회 중 오류가 발생했습니다' })
  }
})

// 회원 서류 업로드
router.post('/member/:memberId/upload', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
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

// 회원 서류 수정
router.put('/member/:memberId/:documentId', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
  try {
    const { memberId, documentId } = req.params
    const { documentId: newDocumentId, description, orderId } = req.body

    // 기존 서류 정보 조회
    const existingDoc = await pool.query(
      'SELECT * FROM member_documents WHERE id = $1 AND member_id = $2 AND deleted = false',
      [documentId, memberId]
    )

    if (existingDoc.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 업데이트할 필드 준비
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (newDocumentId) {
      updateFields.push(`document_id = $${paramIndex}`)
      updateValues.push(newDocumentId)
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      updateValues.push(description || null)
      paramIndex++
    }

    if (orderId !== undefined) {
      updateFields.push(`order_id = $${paramIndex}`)
      updateValues.push(orderId || null)
      paramIndex++
    }

    if (req.file) {
      updateFields.push(`file_path = $${paramIndex}`)
      updateValues.push(req.file.path)
      paramIndex++
      updateFields.push(`file_name = $${paramIndex}`)
      updateValues.push(req.file.originalname)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다' })
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(documentId, memberId)

    const result = await pool.query(
      `UPDATE member_documents 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND member_id = $${paramIndex + 1}
       RETURNING *`,
      updateValues
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 수정 오류:', error)
    res.status(500).json({ error: '서류 수정 중 오류가 발생했습니다' })
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

// 관리자용 전체 첨부 서류 조회
router.get('/attachments', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, searchType, searchKeyword, sortOrder } = req.query

    let query = `
      SELECT 
        md.id,
        md.order_id,
        md.created_at,
        md.file_name,
        md.description,
        d.name as document_name,
        dc.name as category_name,
        m.id as member_id,
        m.name as member_name,
        m.business_name,
        m.phone_number,
        o.order_id as order_order_id
      FROM member_documents md
      LEFT JOIN documents d ON md.document_id = d.id
      LEFT JOIN document_categories dc ON d.category_id = dc.id
      LEFT JOIN members m ON md.member_id = m.id
      LEFT JOIN orders o ON md.order_id = o.id
      WHERE md.deleted = false
    `
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate) {
      query += ` AND md.created_at >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }
    if (endDate) {
      query += ` AND md.created_at <= $${paramIndex}::date + INTERVAL '1 day'`
      params.push(endDate)
      paramIndex++
    }

    // 검색 필터
    if (searchKeyword && searchType) {
      switch (searchType) {
        case '주문 ID':
          query += ` AND (o.order_id ILIKE $${paramIndex} OR md.order_id::text ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '고객':
          query += ` AND (m.name ILIKE $${paramIndex} OR m.business_name ILIKE $${paramIndex} OR m.phone_number ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '서류명':
          query += ` AND d.name ILIKE $${paramIndex}`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
      }
    }

    // 정렬
    if (sortOrder === '첨부일시 역순') {
      query += ' ORDER BY md.created_at DESC'
    } else if (sortOrder === '첨부일시순') {
      query += ' ORDER BY md.created_at ASC'
    } else if (sortOrder === '회원명순') {
      query += ' ORDER BY COALESCE(m.business_name, m.name) ASC'
    } else if (sortOrder === '서류명순') {
      query += ' ORDER BY d.name ASC'
    } else {
      query += ' ORDER BY md.created_at DESC'
    }

    const result = await pool.query(query, params)

    // 파일명 디코딩 처리 및 데이터 포맷팅
    const formattedRows = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_order_id || '-', // order_id가 null이면 "-"로 표시
      attachmentDate: row.created_at,
      memberName: row.business_name || row.member_name || '정보 없음',
      documentName: row.document_name || '서류',
      fileName: decodeFileName(row.file_name),
      description: row.description,
      categoryName: row.category_name,
      memberId: row.member_id,
      phoneNumber: row.phone_number
    }))

    res.json({
      success: true,
      data: formattedRows
    })
  } catch (error) {
    console.error('첨부 서류 조회 오류:', error)
    res.status(500).json({ error: '첨부 서류 조회 중 오류가 발생했습니다' })
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

    // 파일명 디코딩 처리
    const decodedRows = result.rows.map(row => ({
      ...row,
      file_name: decodeFileName(row.file_name)
    }))

    res.json({
      success: true,
      data: decodedRows
    })
  } catch (error) {
    console.error('회원 서류 조회 오류:', error)
    res.status(500).json({ error: '회원 서류 조회 중 오류가 발생했습니다' })
  }
})

// 회원 서류 업로드
router.post('/member/:memberId/upload', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
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

// 회원 서류 수정
router.put('/member/:memberId/:documentId', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
  try {
    const { memberId, documentId } = req.params
    const { documentId: newDocumentId, description, orderId } = req.body

    // 기존 서류 정보 조회
    const existingDoc = await pool.query(
      'SELECT * FROM member_documents WHERE id = $1 AND member_id = $2 AND deleted = false',
      [documentId, memberId]
    )

    if (existingDoc.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 업데이트할 필드 준비
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (newDocumentId) {
      updateFields.push(`document_id = $${paramIndex}`)
      updateValues.push(newDocumentId)
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      updateValues.push(description || null)
      paramIndex++
    }

    if (orderId !== undefined) {
      updateFields.push(`order_id = $${paramIndex}`)
      updateValues.push(orderId || null)
      paramIndex++
    }

    if (req.file) {
      updateFields.push(`file_path = $${paramIndex}`)
      updateValues.push(req.file.path)
      paramIndex++
      updateFields.push(`file_name = $${paramIndex}`)
      updateValues.push(req.file.originalname)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다' })
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(documentId, memberId)

    const result = await pool.query(
      `UPDATE member_documents 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND member_id = $${paramIndex + 1}
       RETURNING *`,
      updateValues
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 수정 오류:', error)
    res.status(500).json({ error: '서류 수정 중 오류가 발생했습니다' })
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

// 관리자용 전체 첨부 서류 조회
router.get('/attachments', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, searchType, searchKeyword, sortOrder } = req.query

    let query = `
      SELECT 
        md.id,
        md.order_id,
        md.created_at,
        md.file_name,
        md.description,
        d.name as document_name,
        dc.name as category_name,
        m.id as member_id,
        m.name as member_name,
        m.business_name,
        m.phone_number,
        o.order_id as order_order_id
      FROM member_documents md
      LEFT JOIN documents d ON md.document_id = d.id
      LEFT JOIN document_categories dc ON d.category_id = dc.id
      LEFT JOIN members m ON md.member_id = m.id
      LEFT JOIN orders o ON md.order_id = o.id
      WHERE md.deleted = false
    `
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate) {
      query += ` AND md.created_at >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }
    if (endDate) {
      query += ` AND md.created_at <= $${paramIndex}::date + INTERVAL '1 day'`
      params.push(endDate)
      paramIndex++
    }

    // 검색 필터
    if (searchKeyword && searchType) {
      switch (searchType) {
        case '주문 ID':
          query += ` AND (o.order_id ILIKE $${paramIndex} OR md.order_id::text ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '고객':
          query += ` AND (m.name ILIKE $${paramIndex} OR m.business_name ILIKE $${paramIndex} OR m.phone_number ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '서류명':
          query += ` AND d.name ILIKE $${paramIndex}`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
      }
    }

    // 정렬
    if (sortOrder === '첨부일시 역순') {
      query += ' ORDER BY md.created_at DESC'
    } else if (sortOrder === '첨부일시순') {
      query += ' ORDER BY md.created_at ASC'
    } else if (sortOrder === '회원명순') {
      query += ' ORDER BY COALESCE(m.business_name, m.name) ASC'
    } else if (sortOrder === '서류명순') {
      query += ' ORDER BY d.name ASC'
    } else {
      query += ' ORDER BY md.created_at DESC'
    }

    const result = await pool.query(query, params)

    // 파일명 디코딩 처리 및 데이터 포맷팅
    const formattedRows = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_order_id || '-', // order_id가 null이면 "-"로 표시
      attachmentDate: row.created_at,
      memberName: row.business_name || row.member_name || '정보 없음',
      documentName: row.document_name || '서류',
      fileName: decodeFileName(row.file_name),
      description: row.description,
      categoryName: row.category_name,
      memberId: row.member_id,
      phoneNumber: row.phone_number
    }))

    res.json({
      success: true,
      data: formattedRows
    })
  } catch (error) {
    console.error('첨부 서류 조회 오류:', error)
    res.status(500).json({ error: '첨부 서류 조회 중 오류가 발생했습니다' })
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

    // 파일명 디코딩 처리
    const decodedRows = result.rows.map(row => ({
      ...row,
      file_name: decodeFileName(row.file_name)
    }))

    res.json({
      success: true,
      data: decodedRows
    })
  } catch (error) {
    console.error('회원 서류 조회 오류:', error)
    res.status(500).json({ error: '회원 서류 조회 중 오류가 발생했습니다' })
  }
})

// 회원 서류 업로드
router.post('/member/:memberId/upload', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
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

// 회원 서류 수정
router.put('/member/:memberId/:documentId', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
  try {
    const { memberId, documentId } = req.params
    const { documentId: newDocumentId, description, orderId } = req.body

    // 기존 서류 정보 조회
    const existingDoc = await pool.query(
      'SELECT * FROM member_documents WHERE id = $1 AND member_id = $2 AND deleted = false',
      [documentId, memberId]
    )

    if (existingDoc.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 업데이트할 필드 준비
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (newDocumentId) {
      updateFields.push(`document_id = $${paramIndex}`)
      updateValues.push(newDocumentId)
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      updateValues.push(description || null)
      paramIndex++
    }

    if (orderId !== undefined) {
      updateFields.push(`order_id = $${paramIndex}`)
      updateValues.push(orderId || null)
      paramIndex++
    }

    if (req.file) {
      updateFields.push(`file_path = $${paramIndex}`)
      updateValues.push(req.file.path)
      paramIndex++
      updateFields.push(`file_name = $${paramIndex}`)
      updateValues.push(req.file.originalname)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다' })
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(documentId, memberId)

    const result = await pool.query(
      `UPDATE member_documents 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND member_id = $${paramIndex + 1}
       RETURNING *`,
      updateValues
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 수정 오류:', error)
    res.status(500).json({ error: '서류 수정 중 오류가 발생했습니다' })
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

// 관리자용 전체 첨부 서류 조회
router.get('/attachments', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, searchType, searchKeyword, sortOrder } = req.query

    let query = `
      SELECT 
        md.id,
        md.order_id,
        md.created_at,
        md.file_name,
        md.description,
        d.name as document_name,
        dc.name as category_name,
        m.id as member_id,
        m.name as member_name,
        m.business_name,
        m.phone_number,
        o.order_id as order_order_id
      FROM member_documents md
      LEFT JOIN documents d ON md.document_id = d.id
      LEFT JOIN document_categories dc ON d.category_id = dc.id
      LEFT JOIN members m ON md.member_id = m.id
      LEFT JOIN orders o ON md.order_id = o.id
      WHERE md.deleted = false
    `
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate) {
      query += ` AND md.created_at >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }
    if (endDate) {
      query += ` AND md.created_at <= $${paramIndex}::date + INTERVAL '1 day'`
      params.push(endDate)
      paramIndex++
    }

    // 검색 필터
    if (searchKeyword && searchType) {
      switch (searchType) {
        case '주문 ID':
          query += ` AND (o.order_id ILIKE $${paramIndex} OR md.order_id::text ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '고객':
          query += ` AND (m.name ILIKE $${paramIndex} OR m.business_name ILIKE $${paramIndex} OR m.phone_number ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '서류명':
          query += ` AND d.name ILIKE $${paramIndex}`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
      }
    }

    // 정렬
    if (sortOrder === '첨부일시 역순') {
      query += ' ORDER BY md.created_at DESC'
    } else if (sortOrder === '첨부일시순') {
      query += ' ORDER BY md.created_at ASC'
    } else if (sortOrder === '회원명순') {
      query += ' ORDER BY COALESCE(m.business_name, m.name) ASC'
    } else if (sortOrder === '서류명순') {
      query += ' ORDER BY d.name ASC'
    } else {
      query += ' ORDER BY md.created_at DESC'
    }

    const result = await pool.query(query, params)

    // 파일명 디코딩 처리 및 데이터 포맷팅
    const formattedRows = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_order_id || '-', // order_id가 null이면 "-"로 표시
      attachmentDate: row.created_at,
      memberName: row.business_name || row.member_name || '정보 없음',
      documentName: row.document_name || '서류',
      fileName: decodeFileName(row.file_name),
      description: row.description,
      categoryName: row.category_name,
      memberId: row.member_id,
      phoneNumber: row.phone_number
    }))

    res.json({
      success: true,
      data: formattedRows
    })
  } catch (error) {
    console.error('첨부 서류 조회 오류:', error)
    res.status(500).json({ error: '첨부 서류 조회 중 오류가 발생했습니다' })
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

    // 파일명 디코딩 처리
    const decodedRows = result.rows.map(row => ({
      ...row,
      file_name: decodeFileName(row.file_name)
    }))

    res.json({
      success: true,
      data: decodedRows
    })
  } catch (error) {
    console.error('회원 서류 조회 오류:', error)
    res.status(500).json({ error: '회원 서류 조회 중 오류가 발생했습니다' })
  }
})

// 회원 서류 업로드
router.post('/member/:memberId/upload', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
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

// 회원 서류 수정
router.put('/member/:memberId/:documentId', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
  try {
    const { memberId, documentId } = req.params
    const { documentId: newDocumentId, description, orderId } = req.body

    // 기존 서류 정보 조회
    const existingDoc = await pool.query(
      'SELECT * FROM member_documents WHERE id = $1 AND member_id = $2 AND deleted = false',
      [documentId, memberId]
    )

    if (existingDoc.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 업데이트할 필드 준비
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (newDocumentId) {
      updateFields.push(`document_id = $${paramIndex}`)
      updateValues.push(newDocumentId)
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      updateValues.push(description || null)
      paramIndex++
    }

    if (orderId !== undefined) {
      updateFields.push(`order_id = $${paramIndex}`)
      updateValues.push(orderId || null)
      paramIndex++
    }

    if (req.file) {
      updateFields.push(`file_path = $${paramIndex}`)
      updateValues.push(req.file.path)
      paramIndex++
      updateFields.push(`file_name = $${paramIndex}`)
      updateValues.push(req.file.originalname)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다' })
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(documentId, memberId)

    const result = await pool.query(
      `UPDATE member_documents 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND member_id = $${paramIndex + 1}
       RETURNING *`,
      updateValues
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 수정 오류:', error)
    res.status(500).json({ error: '서류 수정 중 오류가 발생했습니다' })
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

// 관리자용 전체 첨부 서류 조회
router.get('/attachments', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, searchType, searchKeyword, sortOrder } = req.query

    let query = `
      SELECT 
        md.id,
        md.order_id,
        md.created_at,
        md.file_name,
        md.description,
        d.name as document_name,
        dc.name as category_name,
        m.id as member_id,
        m.name as member_name,
        m.business_name,
        m.phone_number,
        o.order_id as order_order_id
      FROM member_documents md
      LEFT JOIN documents d ON md.document_id = d.id
      LEFT JOIN document_categories dc ON d.category_id = dc.id
      LEFT JOIN members m ON md.member_id = m.id
      LEFT JOIN orders o ON md.order_id = o.id
      WHERE md.deleted = false
    `
    const params = []
    let paramIndex = 1

    // 날짜 필터
    if (startDate) {
      query += ` AND md.created_at >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }
    if (endDate) {
      query += ` AND md.created_at <= $${paramIndex}::date + INTERVAL '1 day'`
      params.push(endDate)
      paramIndex++
    }

    // 검색 필터
    if (searchKeyword && searchType) {
      switch (searchType) {
        case '주문 ID':
          query += ` AND (o.order_id ILIKE $${paramIndex} OR md.order_id::text ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '고객':
          query += ` AND (m.name ILIKE $${paramIndex} OR m.business_name ILIKE $${paramIndex} OR m.phone_number ILIKE $${paramIndex})`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
        case '서류명':
          query += ` AND d.name ILIKE $${paramIndex}`
          params.push(`%${searchKeyword}%`)
          paramIndex++
          break
      }
    }

    // 정렬
    if (sortOrder === '첨부일시 역순') {
      query += ' ORDER BY md.created_at DESC'
    } else if (sortOrder === '첨부일시순') {
      query += ' ORDER BY md.created_at ASC'
    } else if (sortOrder === '회원명순') {
      query += ' ORDER BY COALESCE(m.business_name, m.name) ASC'
    } else if (sortOrder === '서류명순') {
      query += ' ORDER BY d.name ASC'
    } else {
      query += ' ORDER BY md.created_at DESC'
    }

    const result = await pool.query(query, params)

    // 파일명 디코딩 처리 및 데이터 포맷팅
    const formattedRows = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_order_id || '-', // order_id가 null이면 "-"로 표시
      attachmentDate: row.created_at,
      memberName: row.business_name || row.member_name || '정보 없음',
      documentName: row.document_name || '서류',
      fileName: decodeFileName(row.file_name),
      description: row.description,
      categoryName: row.category_name,
      memberId: row.member_id,
      phoneNumber: row.phone_number
    }))

    res.json({
      success: true,
      data: formattedRows
    })
  } catch (error) {
    console.error('첨부 서류 조회 오류:', error)
    res.status(500).json({ error: '첨부 서류 조회 중 오류가 발생했습니다' })
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

    // 파일명 디코딩 처리
    const decodedRows = result.rows.map(row => ({
      ...row,
      file_name: decodeFileName(row.file_name)
    }))

    res.json({
      success: true,
      data: decodedRows
    })
  } catch (error) {
    console.error('회원 서류 조회 오류:', error)
    res.status(500).json({ error: '회원 서류 조회 중 오류가 발생했습니다' })
  }
})

// 회원 서류 업로드
router.post('/member/:memberId/upload', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
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

// 회원 서류 수정
router.put('/member/:memberId/:documentId', authenticateToken, upload.single('file'), decodeFileNameMiddleware, async (req, res) => {
  try {
    const { memberId, documentId } = req.params
    const { documentId: newDocumentId, description, orderId } = req.body

    // 기존 서류 정보 조회
    const existingDoc = await pool.query(
      'SELECT * FROM member_documents WHERE id = $1 AND member_id = $2 AND deleted = false',
      [documentId, memberId]
    )

    if (existingDoc.rows.length === 0) {
      return res.status(404).json({ error: '서류를 찾을 수 없습니다' })
    }

    // 업데이트할 필드 준비
    const updateFields = []
    const updateValues = []
    let paramIndex = 1

    if (newDocumentId) {
      updateFields.push(`document_id = $${paramIndex}`)
      updateValues.push(newDocumentId)
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      updateValues.push(description || null)
      paramIndex++
    }

    if (orderId !== undefined) {
      updateFields.push(`order_id = $${paramIndex}`)
      updateValues.push(orderId || null)
      paramIndex++
    }

    if (req.file) {
      updateFields.push(`file_path = $${paramIndex}`)
      updateValues.push(req.file.path)
      paramIndex++
      updateFields.push(`file_name = $${paramIndex}`)
      updateValues.push(req.file.originalname)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다' })
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
    updateValues.push(documentId, memberId)

    const result = await pool.query(
      `UPDATE member_documents 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND member_id = $${paramIndex + 1}
       RETURNING *`,
      updateValues
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('서류 수정 오류:', error)
    res.status(500).json({ error: '서류 수정 중 오류가 발생했습니다' })
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

