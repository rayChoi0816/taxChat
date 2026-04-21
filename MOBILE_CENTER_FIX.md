# 모바일 환경에서 "검색 결과가 없습니다." 메시지 정중앙 배치 문제 해결

## 문제 원인 분석

모바일에서 정중앙 정렬이 안 되는 주요 원인:

1. **부모 요소의 transform/overflow 간섭**: `position: fixed`가 부모 요소의 `transform`, `perspective`, `filter` 속성에 의해 viewport 기준이 아닌 부모 기준으로 동작할 수 있음
2. **CSS 우선순위 문제**: 다른 CSS 파일(특히 AdminLayout.css)의 스타일이 간섭
3. **z-index 충돌**: 다른 요소가 더 높은 z-index를 가지고 있을 수 있음

## 적용된 해결책

### 1. CSS 수정 사항
- `z-index`를 `999999`로 증가 (최상위 표시)
- `will-change: auto` 추가 (transform 간섭 방지)
- `transform: none` 명시적 설정
- 모든 여백/패딩을 `!important`로 명시적 제거
- `box-sizing: border-box` 명시적 설정

### 2. 구조 개선
- 모바일 전용 오버레이를 별도 요소로 분리
- 데스크톱용 테이블과 완전히 분리

## 디버깅 방법

브라우저 개발자 도구에서 다음을 확인:

1. **요소 검사**
   - `.admin-no-results-mobile-overlay` 요소 선택
   - Computed 스타일 확인:
     - `position`이 `fixed`인지
     - `display`가 `flex`인지
     - `z-index` 값 확인
     - `top`, `left`, `right`, `bottom` 값 확인

2. **부모 요소 확인**
   - `.admin-table-container`에 `transform` 속성이 있는지 확인
   - `.admin-no-results-wrapper`에 `transform` 속성이 있는지 확인

3. **레이아웃 확인**
   - Elements 패널에서 레이어 확인
   - 어떤 요소가 오버레이 위에 있는지 확인

## 추가 확인 사항

만약 여전히 문제가 발생한다면:

1. **다른 CSS 파일 확인**
   ```bash
   grep -r "admin-no-results" ui/src/
   grep -r "position.*fixed" ui/src/components/
   ```

2. **인라인 스타일 확인**
   - JSX에서 인라인 스타일이 적용되지 않았는지 확인

3. **React Portal 사용 고려**
   - CSS로 해결되지 않으면 React Portal을 사용하여 body에 직접 렌더링

## 최종 확인 사항

모바일 브라우저 또는 개발자 도구 모바일 뷰에서:
- [ ] "검색 결과가 없습니다." 메시지가 화면 정중앙에 표시되는가?
- [ ] 메시지 박스가 카드 스타일로 표시되는가?
- [ ] 배경이 반투명하게 표시되는가?
- [ ] 다른 요소들이 메시지 위에 표시되지 않는가?

