import { useLayoutEffect, useRef } from 'react'

/** 법무/약관 페이지 진입 시 뷰포트·내부 스크롤 영역을 항상 상단부터 보이게 합니다. */
export function useLegalPageScrollTop() {
  const scrollRef = useRef(null)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    scrollRef.current?.scrollTo(0, 0)
  }, [])
  return scrollRef
}
