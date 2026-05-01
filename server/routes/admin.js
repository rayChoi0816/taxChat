import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  getTestModeSnapshot,
  setTestMode,
  setTestPhone,
} from '../services/testModeService.js'

const router = express.Router()

/**
 * GET /api/admin/test-mode
 */
router.get('/test-mode', authenticateToken, async (req, res) => {
  try {
    const { testMode, testPhone } = await getTestModeSnapshot()
    res.json({ testMode, testPhone })
  } catch (e) {
    console.error('[admin/test-mode GET]', e)
    res.status(500).json({ error: e.message || '테스트 모드를 불러오지 못했습니다' })
  }
})

/**
 * POST /api/admin/test-mode
 * body: { testMode: boolean, testPhone?: string }
 */
router.post('/test-mode', authenticateToken, async (req, res) => {
  try {
    const { testMode, testPhone } = req.body || {}
    if (typeof testMode !== 'boolean') {
      return res.status(400).json({ error: 'testMode(boolean)이 필요합니다' })
    }

    await setTestMode(testMode)

    if (testPhone !== undefined && testPhone !== null && String(testPhone).trim() !== '') {
      await setTestPhone(testPhone)
    }

    const snapshot = await getTestModeSnapshot()
    res.json(snapshot)
  } catch (e) {
    console.error('[admin/test-mode POST]', e)
    const msg = e.message || '설정 저장에 실패했습니다'
    const code = msg.includes('테스트 번호') ? 400 : 500
    res.status(code).json({ error: msg })
  }
})

export default router
