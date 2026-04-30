import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import kLogo from '../assets/k_logo.png'

const MARGIN = 8

const KAKAO_CHAT_URL = 'https://pf.kakao.com/_cwjhG/chat'

/** 홈 우측 하단 기준 위치 근처(기존 약 7rem / 1rem 과 유사). */
function defaultCornerPosition(el) {
  const w = el?.offsetWidth ?? 260
  const h = el?.offsetHeight ?? 72
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return {
    left: Math.max(MARGIN, vw - w - MARGIN),
    top: Math.max(MARGIN, vh - h - 112),
  }
}

function clampPosition(left, top, el) {
  const w = el?.offsetWidth ?? 260
  const h = el?.offsetHeight ?? 72
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxL = Math.max(MARGIN, vw - w - MARGIN)
  const maxT = Math.max(MARGIN, vh - h - MARGIN)
  return {
    left: Math.min(maxL, Math.max(MARGIN, left)),
    top: Math.min(maxT, Math.max(MARGIN, top)),
  }
}

export default function KakaoConsultDragButton() {
  const btnRef = useRef(null)
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    startClient: { x: 0, y: 0 },
    startPos: { left: 0, top: 0 },
  })

  const [pos, setPos] = useState(() => ({ left: 0, top: 0 }))

  useLayoutEffect(() => {
    const el = btnRef.current
    if (!el) return
    const next = defaultCornerPosition(el)
    setPos(next)
    const ro = () => setPos((p) => clampPosition(p.left, p.top, btnRef.current))
    window.addEventListener('resize', ro)
    window.addEventListener('orientationchange', ro)
    return () => {
      window.removeEventListener('resize', ro)
      window.removeEventListener('orientationchange', ro)
    }
  }, [])

  const openKakao = useCallback(() => {
    window.open(KAKAO_CHAT_URL, '_blank', 'noopener,noreferrer')
  }, [])

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startPos: { ...pos },
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      //
    }
  }

  const onPointerMove = (e) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return
    const dx = e.clientX - dragRef.current.startClient.x
    const dy = e.clientY - dragRef.current.startClient.y
    if (Math.hypot(dx, dy) > 5) dragRef.current.moved = true
    setPos(
      clampPosition(
        dragRef.current.startPos.left + dx,
        dragRef.current.startPos.top + dy,
        btnRef.current,
      ),
    )
  }

  const endDrag = (e) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return
    dragRef.current.active = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      //
    }
    const moved = dragRef.current.moved
    dragRef.current.moved = false
    if (!moved) openKakao()
  }

  return (
    <button
      ref={btnRef}
      type="button"
      className="kakao-consult-btn kakao-consult-btn-draggable"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        right: 'auto',
        bottom: 'auto',
        zIndex: 999,
        touchAction: 'none',
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label="카카오톡 상담 (드래그하여 이동)"
    >
      <div className="kakao-icon">
        <img src={kLogo} alt="" draggable={false} />
      </div>
      <span>카카오톡 상담</span>
    </button>
  )
}
