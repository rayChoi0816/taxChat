// 모바일 중앙 정렬 디버깅 스크립트
// 브라우저 콘솔에서 실행

console.log('=== 모바일 중앙 정렬 디버깅 ===');

// 1. 모든 가능한 선택자로 요소 찾기
const selectors = [
  '.admin-no-results-td-mobile',
  'td[colspan="10"]',
  '.admin-no-results-wrapper td',
  '.admin-table-container td[colspan="10"]',
  '#root > div > main > div > div.admin-table-container > table > tbody > tr > td',
  'table.admin-table tbody td[colspan="10"]'
];

let foundElement = null;
for (const selector of selectors) {
  const el = document.querySelector(selector);
  if (el) {
    console.log(`✅ 요소 찾음: ${selector}`, el);
    foundElement = el;
    break;
  } else {
    console.log(`❌ 요소 없음: ${selector}`);
  }
}

if (!foundElement) {
  console.log('❌ 요소를 찾을 수 없습니다. 검색 결과가 없는 상태인지 확인하세요.');
  console.log('현재 테이블 요소:', document.querySelector('.admin-table'));
  console.log('현재 tbody:', document.querySelector('.admin-table tbody'));
  console.log('현재 tr:', document.querySelector('.admin-table tbody tr'));
  console.log('현재 td:', document.querySelector('.admin-table tbody td'));
} else {
  console.log('\n=== 현재 Computed 스타일 ===');
  const styles = window.getComputedStyle(foundElement);
  console.log('position:', styles.position);
  console.log('top:', styles.top);
  console.log('left:', styles.left);
  console.log('transform:', styles.transform);
  console.log('justify-content:', styles.justifyContent);
  console.log('text-align:', styles.textAlign);
  console.log('display:', styles.display);
  
  console.log('\n=== 인라인 스타일 적용 시도 ===');
  foundElement.style.position = 'fixed';
  foundElement.style.top = '50%';
  foundElement.style.left = '50%';
  foundElement.style.transform = 'translate(-50%, -50%)';
  foundElement.style.justifyContent = 'center';
  foundElement.style.alignItems = 'center';
  foundElement.style.textAlign = 'center';
  foundElement.style.width = '100vw';
  foundElement.style.zIndex = '999999';
  foundElement.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
  
  console.log('✅ 인라인 스타일 적용 완료');
  
  // 다시 확인
  setTimeout(() => {
    const newStyles = window.getComputedStyle(foundElement);
    console.log('\n=== 적용 후 Computed 스타일 ===');
    console.log('position:', newStyles.position);
    console.log('top:', newStyles.top);
    console.log('left:', newStyles.left);
    console.log('transform:', newStyles.transform);
    console.log('justify-content:', newStyles.justifyContent);
  }, 100);
}

