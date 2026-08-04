const fs = require('fs');
const file = '업무배송_스마트공문달력.html';
let html = fs.readFileSync(file, 'utf8');

// 1. 잘못된 위치의 중복 addEventListener 제거
html = html.replace(
  /\n      document\.getElementById\('btnSidebar'\)\.addEventListener\('click', \(\) => \{\s+S\.sidebar = S\.sidebar === 'open' \? 'closed' : 'open';\s+saveSettings\(\); applySettings\(\);\s+\}\);\n/,
  '\n'
);

// 2. 주석처리된 원래 코드를 실제 코드로 교체
html = html.replace(
  `    // document.getElementById('btnSidebar').addEventListener('click', () => {
    //   S.sidebar = S.sidebar === 'open' ? 'closed' : 'open';
    //   saveSettings(); applySettings();
    // });`,
  `    document.getElementById('btnSidebar').addEventListener('click', () => {
      S.sidebar = S.sidebar === 'open' ? 'closed' : 'open';
      saveSettings(); applySettings();
    });`
);

// 3. applySettings() 안에 사이드바 숨김 CSS를 JS로 처리
// body.dataset.sidebar 가 이미 설정되는데, sideCol에 hidden 클래스 토글 추가
html = html.replace(
  `      const asideBtn = document.getElementById('btnSidebar');
      if (asideBtn) {
        const open = S.sidebar === 'open';
        asideBtn.setAttribute('aria-expanded', open);
        asideBtn.querySelector('.material-symbols-outlined').textContent = open ? 'left_panel_close' : 'left_panel_open';
        document.getElementById('sidebarBtnLabel').textContent = open ? '메뉴 접기' : '메뉴 펴기';
        asideBtn.title = open ? '사이드바 접기 — 달력을 넓게 봅니다' : '사이드바 펴기';
      }`,
  `      const asideBtn = document.getElementById('btnSidebar');
      if (asideBtn) {
        const open = S.sidebar === 'open';
        asideBtn.setAttribute('aria-expanded', open);
        asideBtn.querySelector('.material-symbols-outlined').textContent = open ? 'left_panel_close' : 'left_panel_open';
        document.getElementById('sidebarBtnLabel').textContent = open ? '메뉴 접기' : '메뉴 펴기';
        asideBtn.title = open ? '사이드바 접기 — 달력을 넓게 봅니다' : '사이드바 펴기';
        // 사이드바 실제 숨김/표시
        const sideEl = document.getElementById('sideCol');
        const grid = document.getElementById('mainGrid');
        if (sideEl) {
          if (open) {
            sideEl.style.display = '';
            if (grid) grid.style.gridTemplateColumns = '';
          } else {
            sideEl.style.display = 'none';
            if (grid) grid.style.gridTemplateColumns = '1fr';
          }
        }
      }`
);

fs.writeFileSync(file, html, 'utf8');
console.log('Sidebar toggle fixed!');
