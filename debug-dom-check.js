// 브라우저 콘솔에 복사해서 실행하세요

console.log('=== DOM 구조 확인 ===');
console.log('1. admin-no-results-wrapper:', document.querySelector('.admin-no-results-wrapper'));
console.log('2. admin-no-results-mobile-overlay:', document.querySelector('.admin-no-results-mobile-overlay'));
console.log('3. admin-no-results-mobile-message:', document.querySelector('.admin-no-results-mobile-message'));
console.log('4. admin-table-container:', document.querySelector('.admin-table-container'));
console.log('5. admin-table:', document.querySelector('.admin-table'));
console.log('6. 모든 td:', document.querySelectorAll('td'));
console.log('7. colspan="10"인 td:', document.querySelectorAll('td[colspan="10"]'));
console.log('8. admin-no-results-td-mobile:', document.querySelector('.admin-no-results-td-mobile'));

// admin-table-container 내부 구조 확인
const container = document.querySelector('.admin-table-container');
if (container) {
  console.log('9. admin-table-container children:', container.children.length);
  console.log('10. admin-table-container innerHTML (처음 1000자):', container.innerHTML.substring(0, 1000));
} else {
  console.log('❌ admin-table-container를 찾을 수 없습니다');
}

// 검색 결과가 있는지 확인
const table = document.querySelector('.admin-table');
if (table) {
  const rows = table.querySelectorAll('tbody tr');
  console.log('11. 테이블 행 수:', rows.length);
  if (rows.length > 0) {
    console.log('12. 첫 번째 행 내용:', rows[0].textContent);
  }
} else {
  console.log('❌ admin-table을 찾을 수 없습니다');
}

