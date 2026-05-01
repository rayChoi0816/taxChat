import { useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { settingsAPI } from '../utils/api'
import '../components/AdminLayout.css'
import './AdminSettings.css'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const ACCEPT_MIME = 'image/jpeg,image/jpg,image/png,image/webp'
const MIN_DISPLAY_TIME = 1
const MAX_DISPLAY_TIME = 10

// 신규(미저장) 배너 아이템 초기 값
const createEmptyDraft = (index) => ({
  key: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  id: null,
  imageFile: null,
  imagePreview: '',
  imageUrl: '',
  linkUrl: '',
  displayOrder: index + 1,
  displayTime: 3,
  isActive: true,
  saving: false,
  dirty: false,
  error: null,
})

const fromServer = (banner) => ({
  key: `banner-${banner.id}`,
  id: banner.id,
  imageFile: null,
  imagePreview: '',
  imageUrl: banner.imageUrl || '',
  linkUrl: banner.linkUrl || '',
  displayOrder: banner.displayOrder ?? 0,
  displayTime: banner.displayTime ?? 3,
  isActive: banner.isActive !== false,
  saving: false,
  dirty: false,
  error: null,
})

const clampDisplayTime = (value) => {
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) return MIN_DISPLAY_TIME
  return Math.max(MIN_DISPLAY_TIME, Math.min(MAX_DISPLAY_TIME, n))
}

const AdminSettings = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fileInputsRef = useRef({})

  const [testMode, setTestMode] = useState(false)
  const [testModeLoading, setTestModeLoading] = useState(true)
  const [testModeSaving, setTestModeSaving] = useState(false)
  const [testModeError, setTestModeError] = useState(null)
  const [testPhoneDraft, setTestPhoneDraft] = useState('')
  const [testPhoneSaving, setTestPhoneSaving] = useState(false)

  const loadTestMode = async () => {
    setTestModeLoading(true)
    setTestModeError(null)
    try {
      const data = await settingsAPI.getTestMode()
      setTestMode(Boolean(data.testMode))
      setTestPhoneDraft(String(data.testPhone ?? '').replace(/[^\d]/g, ''))
    } catch (e) {
      setTestModeError(e.message || '테스트 모드를 불러오지 못했습니다')
    } finally {
      setTestModeLoading(false)
    }
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await settingsAPI.getMainBanners({ all: true })
      const next = res.success ? res.data.map(fromServer) : []
      next.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
      setItems(next)
    } catch (e) {
      setError(e.message || '배너를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadTestMode()
  }, [])


  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.imagePreview) URL.revokeObjectURL(it.imagePreview)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateItem = (key, patch) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch, dirty: true } : it)))
  }

  const handleAddBanner = () => {
    setItems((prev) => [...prev, createEmptyDraft(prev.length)])
  }

  const handleFileChange = (key, file) => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      updateItem(key, { error: '이미지 용량은 2MB 이하여야 합니다' })
      return
    }
    const preview = URL.createObjectURL(file)
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it
        if (it.imagePreview) URL.revokeObjectURL(it.imagePreview)
        return { ...it, imageFile: file, imagePreview: preview, error: null, dirty: true }
      })
    )
  }

  const handlePickFile = (key) => {
    fileInputsRef.current[key]?.click()
  }

  const handleRemoveLocal = (key) => {
    setItems((prev) => {
      const target = prev.find((it) => it.key === key)
      if (target?.imagePreview) URL.revokeObjectURL(target.imagePreview)
      return prev.filter((it) => it.key !== key)
    })
  }

  const handleDeleteServer = async (item) => {
    if (!window.confirm('이 배너를 삭제할까요?')) return
    try {
      await settingsAPI.deleteMainBanner(item.id)
      handleRemoveLocal(item.key)
    } catch (e) {
      updateItem(item.key, { error: e.message || '삭제에 실패했습니다' })
    }
  }

  const handleToggleActive = async (item) => {
    const nextValue = !item.isActive
    if (item.id) {
      try {
        await settingsAPI.toggleMainBanner(item.id, nextValue)
        updateItem(item.key, { isActive: nextValue, dirty: false })
      } catch (e) {
        updateItem(item.key, { error: e.message || '상태 변경 실패' })
      }
    } else {
      updateItem(item.key, { isActive: nextValue })
    }
  }

  const handleSave = async (item) => {
    if (!item.imageFile && !item.id) {
      updateItem(item.key, { error: '이미지를 선택해 주세요' })
      return
    }
    updateItem(item.key, { saving: true, error: null })

    try {
      const form = new FormData()
      if (item.imageFile) form.append('image', item.imageFile)
      form.append('linkUrl', item.linkUrl || '')
      form.append('displayOrder', String(item.displayOrder || 0))
      form.append('displayTime', String(clampDisplayTime(item.displayTime)))
      form.append('isActive', String(item.isActive))

      const res = item.id
        ? await settingsAPI.updateMainBanner(item.id, form)
        : await settingsAPI.createMainBanner(form)

      if (res.success) {
        const updated = fromServer(res.data)
        setItems((prev) =>
          prev.map((it) =>
            it.key === item.key
              ? { ...updated, key: it.key }
              : it
          )
        )
      }
    } catch (e) {
      updateItem(item.key, { saving: false, error: e.message || '저장 실패' })
      return
    }
    setItems((prev) => prev.map((it) => (it.key === item.key ? { ...it, saving: false, dirty: false } : it)))
  }

  const handleReorder = async (item, direction) => {
    const idx = items.findIndex((it) => it.key === item.key)
    const targetIdx = idx + direction
    if (idx < 0 || targetIdx < 0 || targetIdx >= items.length) return

    const next = [...items]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    const withOrder = next.map((it, i) => ({ ...it, displayOrder: i + 1 }))
    setItems(withOrder)

    const payload = withOrder
      .filter((it) => it.id)
      .map((it) => ({ id: it.id, displayOrder: it.displayOrder }))
    if (payload.length > 0) {
      try {
        await settingsAPI.reorderMainBanners(payload)
      } catch (e) {
        setError(e.message || '순서 저장에 실패했습니다')
      }
    }
  }

  const hasAny = items.length > 0

  const handleTestModeToggle = async () => {
    const next = !testMode
    setTestModeSaving(true)
    setTestModeError(null)
    try {
      await settingsAPI.setTestMode({ testMode: next })
      setTestMode(next)
    } catch (e) {
      setTestModeError(e.message || '테스트 모드 변경에 실패했습니다')
    } finally {
      setTestModeSaving(false)
    }
  }

  const handleSaveTestPhone = async () => {
    setTestPhoneSaving(true)
    setTestModeError(null)
    try {
      const data = await settingsAPI.setTestMode({
        testMode,
        testPhone: testPhoneDraft.replace(/[^\d]/g, ''),
      })
      setTestMode(Boolean(data.testMode))
      setTestPhoneDraft(String(data.testPhone ?? '').replace(/[^\d]/g, ''))
    } catch (e) {
      setTestModeError(e.message || '테스트 번호 저장에 실패했습니다')
    } finally {
      setTestPhoneSaving(false)
    }
  }

  const summary = useMemo(() => {
    const active = items.filter((it) => it.isActive && it.id).length
    return `총 ${items.length}개 · 활성 ${active}개`
  }, [items])

  return (
    <AdminLayout>
      <div className="admin-settings">
        <h1 className="admin-settings-title">환경 설정</h1>

        <section className="admin-settings-section">
          <div className="admin-settings-section-head">
            <div>
              <h2 className="admin-settings-section-title">카카오 알림톡 테스트 모드</h2>
              <p className="admin-settings-desc">
                ON이면 모든 알림톡이 아래 테스트 번호로 발송되며, 로그에 [TEST MODE]가 남습니다.
              </p>
            </div>
          </div>

          {testModeLoading ? (
            <p className="admin-settings-muted">테스트 모드 불러오는 중…</p>
          ) : (
            <>
              <div className="admin-settings-test-row">
                <span className="admin-settings-test-label">테스트 모드</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={testMode}
                  className={`admin-settings-toggle ${testMode ? 'on' : 'off'}${testModeSaving ? ' pending' : ''}`}
                  onClick={handleTestModeToggle}
                  disabled={testModeSaving}
                >
                  <span className="admin-settings-toggle-knob" />
                </button>
              </div>
              <p className="admin-settings-test-status">
                현재 상태: <strong>{testMode ? 'ON' : 'OFF'}</strong>
              </p>

              <div className="admin-settings-test-phone">
                <label className="admin-settings-test-phone-label">
                  <span>테스트 수신 번호</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="01088810816"
                    value={testPhoneDraft}
                    onChange={(e) => setTestPhoneDraft(e.target.value.replace(/[^\d-]/g, ''))}
                  />
                </label>
                <button
                  type="button"
                  className="admin-settings-test-phone-save"
                  onClick={handleSaveTestPhone}
                  disabled={testPhoneSaving || !testPhoneDraft.replace(/[^\d]/g, '')}
                >
                  {testPhoneSaving ? '저장 중…' : '번호 저장'}
                </button>
              </div>
              <p className="admin-settings-desc admin-settings-env-hint">
                기본값은 서버 환경변수 <code>TEST_MODE</code>, <code>TEST_PHONE</code> 및 DB 테이블{' '}
                <code>system_settings</code>로 관리됩니다.
              </p>
              {testModeError && <div className="admin-settings-error admin-settings-error-spaced">{testModeError}</div>}
            </>
          )}
        </section>

        <section className="admin-settings-section admin-settings-section-spaced">
          <div className="admin-settings-section-head">
            <div>
              <h2 className="admin-settings-section-title">메인 배너</h2>
              <p className="admin-settings-desc">
                권장 사이즈 720 × 600 px · 2MB 이하 (JPG, PNG, WebP). 비율이 다르면 자동 센터 크롭됩니다.
              </p>
              <p className="admin-settings-desc">{summary}</p>
            </div>
            <button type="button" className="admin-settings-add-btn" onClick={handleAddBanner}>
              + 배너 추가
            </button>
          </div>

          {error && <div className="admin-settings-error">{error}</div>}

          {loading ? (
            <p className="admin-settings-muted">불러오는 중…</p>
          ) : !hasAny ? (
            <p className="admin-settings-muted">
              등록된 배너가 없습니다. 우측 상단 “배너 추가”를 눌러 등록해 주세요.
            </p>
          ) : (
            <ul className="banner-form-list">
              {items.map((it, index) => {
                const previewSrc = it.imagePreview || it.imageUrl
                return (
                  <li key={it.key} className={`banner-form-item ${it.isActive ? '' : 'inactive'}`}>
                    <div className="banner-form-head">
                      <span className="banner-form-index">#{index + 1}</span>
                      <div className="banner-form-order-btns">
                        <button
                          type="button"
                          className="banner-form-icon-btn"
                          onClick={() => handleReorder(it, -1)}
                          disabled={index === 0}
                          aria-label="위로"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="banner-form-icon-btn"
                          onClick={() => handleReorder(it, 1)}
                          disabled={index === items.length - 1}
                          aria-label="아래로"
                        >
                          ↓
                        </button>
                      </div>

                      <label className="banner-form-toggle">
                        <input
                          type="checkbox"
                          checked={it.isActive}
                          onChange={() => handleToggleActive(it)}
                        />
                        <span>{it.isActive ? '노출 ON' : '노출 OFF'}</span>
                      </label>

                      {it.id ? (
                        <button
                          type="button"
                          className="banner-form-delete-btn"
                          onClick={() => handleDeleteServer(it)}
                        >
                          삭제
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="banner-form-delete-btn"
                          onClick={() => handleRemoveLocal(it.key)}
                        >
                          취소
                        </button>
                      )}
                    </div>

                    <div className="banner-form-body">
                      <div className="banner-form-thumb">
                        <input
                          ref={(el) => (fileInputsRef.current[it.key] = el)}
                          type="file"
                          accept={ACCEPT_MIME}
                          className="banner-form-file-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (file) handleFileChange(it.key, file)
                          }}
                        />
                        {previewSrc ? (
                          <img src={previewSrc} alt="배너 미리보기" />
                        ) : (
                          <div className="banner-form-thumb-empty">이미지 없음</div>
                        )}
                        <button
                          type="button"
                          className="banner-form-thumb-btn"
                          onClick={() => handlePickFile(it.key)}
                        >
                          {previewSrc ? '이미지 변경' : '이미지 업로드'}
                        </button>
                      </div>

                      <div className="banner-form-fields">
                        <label className="banner-form-field">
                          <span>연결 URL</span>
                          <input
                            type="url"
                            placeholder="https://example.com"
                            value={it.linkUrl}
                            onChange={(e) => updateItem(it.key, { linkUrl: e.target.value })}
                          />
                        </label>

                        <div className="banner-form-row">
                          <label className="banner-form-field">
                            <span>노출 순서</span>
                            <input
                              type="number"
                              min="1"
                              value={it.displayOrder}
                              onChange={(e) =>
                                updateItem(it.key, {
                                  displayOrder: Number.parseInt(e.target.value, 10) || 1,
                                })
                              }
                            />
                          </label>
                          <label className="banner-form-field">
                            <span>노출 시간(초) · {MIN_DISPLAY_TIME}~{MAX_DISPLAY_TIME}</span>
                            <input
                              type="number"
                              min={MIN_DISPLAY_TIME}
                              max={MAX_DISPLAY_TIME}
                              value={it.displayTime}
                              onChange={(e) =>
                                updateItem(it.key, {
                                  displayTime: clampDisplayTime(e.target.value),
                                })
                              }
                            />
                          </label>
                        </div>

                        {it.error && <p className="banner-form-error">{it.error}</p>}

                        <div className="banner-form-actions">
                          <button
                            type="button"
                            className="banner-form-save-btn"
                            onClick={() => handleSave(it)}
                            disabled={it.saving || (!it.dirty && it.id)}
                          >
                            {it.saving ? '저장 중…' : it.id ? '변경 저장' : '등록'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}

export default AdminSettings
