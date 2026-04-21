// 브라우저 콘솔에서 실행하세요

console.log('=== td 내용 확인 ===');
const td = document.querySelector('td[colspan="10"]');
if (td) {
  console.log('1. td 요소:', td);
  console.log('2. td textContent:', td.textContent);
  console.log('3. td innerHTML:', td.innerHTML);
  console.log('4. td className:', td.className);
  console.log('5. td style:', td.style.cssText);
  console.log('6. td parentElement:', td.parentElement);
  console.log('7. td parentElement className:', td.parentElement?.className);
  console.log('8. td의 조상 요소들:');
  let parent = td.parentElement;
  let level = 0;
  while (parent && level < 5) {
    console.log(`   Level ${level}:`, parent.tagName, parent.className);
    parent = parent.parentElement;
    level++;
  }
} else {
  console.log('❌ colspan="10"인 td를 찾을 수 없습니다');
}

// 모든 admin-table 확인
console.log('\n=== 모든 admin-table 확인 ===');
const allTables = document.querySelectorAll('.admin-table');
console.log('admin-table 개수:', allTables.length);
allTables.forEach((table, index) => {
  console.log(`Table ${index + 1}:`, table);
  console.log(`  - className:`, table.className);
  console.log(`  - parent:`, table.parentElement?.className);
});

