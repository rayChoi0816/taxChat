// 브라우저 콘솔에서 실행하여 실제 데이터 상태 확인

console.log('=== 데이터 상태 확인 ===');

// React DevTools를 통한 확인 (가능한 경우)
console.log('1. 현재 페이지 URL:', window.location.href);

// 테이블 구조 확인
const table = document.querySelector('.admin-table');
const tbody = document.querySelector('.admin-table tbody');
const rows = tbody?.querySelectorAll('tr') || [];

console.log('2. 테이블 존재:', !!table);
console.log('3. tbody 존재:', !!tbody);
console.log('4. 행 개수:', rows.length);

if (rows.length > 0) {
  console.log('5. 첫 번째 행 내용:', rows[0].textContent?.substring(0, 100));
}

// colspan="10"인 td 확인
const noResultsTd = document.querySelector('td[colspan="10"]');
if (noResultsTd) {
  console.log('6. colspan="10" td 존재:', true);
  console.log('7. td 텍스트:', noResultsTd.textContent);
  console.log('8. td 클래스:', noResultsTd.className);
  console.log('9. td 부모 구조:');
  let parent = noResultsTd;
  for (let i = 0; i < 5 && parent; i++) {
    console.log(`   ${i}: ${parent.tagName} ${parent.className || ''}`);
    parent = parent.parentElement;
  }
} else {
  console.log('6. colspan="10" td 없음');
}

// 전체 admin-table-container 내용 확인
const container = document.querySelector('.admin-table-container');
if (container) {
  console.log('10. admin-table-container children:', container.children.length);
  Array.from(container.children).forEach((child, idx) => {
    console.log(`   Child ${idx}: ${child.tagName} ${child.className}`);
  });
}

console.log('\n=== 결론 ===');
if (!noResultsTd) {
  console.log('✅ 데이터가 있어서 테이블이 정상 렌더링됨');
} else if (noResultsTd.textContent.includes('검색 결과가 없습니다')) {
  console.log('❌ 이전 버전 코드가 실행되고 있음 - 개발 서버 재시작 필요');
} else if (noResultsTd.textContent.includes('검색결과가 없습니다. 2')) {
  console.log('✅ 최신 코드가 반영됨');
} else {
  console.log('⚠️ 예상치 못한 상태');
}

