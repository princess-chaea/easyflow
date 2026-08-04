const fs = require('fs');
const file = '업무배송_스마트공문달력.html';
let html = fs.readFileSync(file, 'utf8');

// ─────────────────────────────────────────────
// 1. 오늘의 필수 업무 / 이번 주 준비 서식
//    → data-no-acc 추가해서 아코디언 JS가 건드리지 않도록
// ─────────────────────────────────────────────
html = html.replace(
  /<!-- 오늘의 필수 업무 -->\s*\n<section class="([^"]+)"/,
  (m, cls) => `<!-- 오늘의 필수 업무 -->\n<section class="${cls}" data-no-acc="true"`
);

html = html.replace(
  /<!-- 학사일정 맞춤 준비 서식.*?-->\s*\n<section class="([^"]+)"/,
  (m, cls) => `<!-- 학사일정 맞춤 준비 서식 -->\n<section class="${cls}" data-no-acc="true"`
);

// ─────────────────────────────────────────────
// 2. 주관 부서 details 재구성
//    summary 에서 전체·편집 버튼 제거 → 펼침 영역 맨 위에 추가
// ─────────────────────────────────────────────
// Remove "전체"와 "편집" from summary
html = html.replace(
  /<summary class="flex items-center justify-between p-md cursor-pointer select-none outline-none">\s*<div class="flex items-center gap-xs">\s*<span class="w-7 h-7 rounded-full bg-primary\/5 grid place-items-center shrink-0">\s*<span class="material-symbols-outlined text-\[17px\] text-primary">groups<\/span><\/span>\s*<h2 class="text-title-sm text-primary whitespace-nowrap">주관 부서<\/h2>\s*<\/div>\s*<div class="flex items-center gap-xs shrink-0">\s*<button[^>]+id="btnDeptAll"[^>]*>전체<\/button>\s*<button[^>]+id="btnDeptEdit"[^>]*>[\s\S]*?<\/button>\s*<span class="material-symbols-outlined transition-transform group-open:rotate-180 text-muted ml-1">expand_more<\/span>\s*<\/div>\s*<\/summary>/,
  `<summary class="flex items-center justify-between p-md cursor-pointer select-none outline-none">
<div class="flex items-center gap-xs">
<span class="w-7 h-7 rounded-full bg-primary/5 grid place-items-center shrink-0">
<span class="material-symbols-outlined text-[17px] text-primary">groups</span></span>
<h2 class="text-title-sm text-primary whitespace-nowrap">주관 부서</h2>
</div>
<div class="flex items-center gap-2 shrink-0">
<span class="material-symbols-outlined transition-transform group-open:rotate-180 text-muted">expand_more</span>
</div>
</summary>`
);

// Insert 전체·편집 buttons at top of dept body div
html = html.replace(
  /(<div class="px-md pb-md border-t border-hairline pt-sm">\s*<div class="space-y-xxs" id="deptFilters")/,
  `<div class="px-md pb-md border-t border-hairline pt-sm">
<div class="flex items-center gap-xs mb-sm">
<button class="h-7 px-sm rounded-pill bg-surface-strong text-caption-strong hover:bg-hairline hover:text-primary transition-colors" id="btnDeptAll">전체</button>
<button aria-label="부서·색상 관리" class="h-7 px-xs grid place-items-center rounded-pill bg-surface-strong text-body hover:text-primary hover:bg-hairline transition-colors" id="btnDeptEdit" title="부서·색상 관리">
<span class="flex items-center gap-xxs text-caption-strong"><span class="material-symbols-outlined text-[14px]">edit</span>편집</span>
</button>
</div>
<div class="space-y-xxs" id="deptFilters"`
);

// ─────────────────────────────────────────────
// 3. 보기 설정 — "초기화" 버튼을 헤더에서 제거하고 펼침 영역 맨 위로 이동
//    + 클릭 시 확인 모달 연결
// ─────────────────────────────────────────────
// Remove 초기화 from summary
html = html.replace(
  /<summary class="flex items-center justify-between p-md cursor-pointer select-none outline-none">\s*<div class="flex items-center gap-xs">\s*<span class="w-7 h-7 rounded-full bg-primary\/5 grid place-items-center shrink-0">\s*<span class="material-symbols-outlined text-\[17px\] text-primary">tune<\/span><\/span>\s*<h2 class="text-title-sm text-primary whitespace-nowrap">보기 설정<\/h2>\s*<\/div>\s*<div class="flex items-center gap-2">\s*<button[^>]+id="btnResetOpts"[^>]*>초기화<\/button>\s*<span class="material-symbols-outlined transition-transform group-open:rotate-180 text-muted">expand_more<\/span>\s*<\/div>\s*<\/summary>/,
  `<summary class="flex items-center justify-between p-md cursor-pointer select-none outline-none">
<div class="flex items-center gap-xs">
<span class="w-7 h-7 rounded-full bg-primary/5 grid place-items-center shrink-0">
<span class="material-symbols-outlined text-[17px] text-primary">tune</span></span>
<h2 class="text-title-sm text-primary whitespace-nowrap">보기 설정</h2>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined transition-transform group-open:rotate-180 text-muted">expand_more</span>
</div>
</summary>`
);

// Insert 초기화 button inside 보기 설정 body, before 색상 기준 fieldset
html = html.replace(
  /(<div class="px-md pb-md border-t border-hairline pt-sm">\s*<!-- 색상 기준 -->\s*<fieldset)/,
  `<div class="px-md pb-md border-t border-hairline pt-sm">
<div class="flex justify-end mb-sm">
<button class="h-7 px-sm rounded-pill bg-surface-strong text-caption text-muted hover:text-danger hover:bg-danger/5 transition-colors flex items-center gap-xxs" id="btnResetOpts">
<span class="material-symbols-outlined text-[14px]">restart_alt</span>초기화
</button>
</div>
<!-- 색상 기준 -->
<fieldset`
);

// ─────────────────────────────────────────────
// 4. 파란 박스(업무 경감 목표 CTA) 삭제
// ─────────────────────────────────────────────
html = html.replace(
  /\s*<!-- CTA — 인생도서관 페이지와 동일한 GBE 딥블루 밴드 -->\s*<section class="bg-primary[^>]*>[\s\S]*?<\/section>/,
  ''
);

// ─────────────────────────────────────────────
// 5. 확인 모달 추가 (없을 경우) — 초기화용
// ─────────────────────────────────────────────
const confirmModalHtml = `
<!-- 초기화 확인 모달 -->
<div aria-modal="true" class="hidden fixed inset-0 z-[100] flex items-center justify-center" id="resetConfirmModal" role="dialog">
  <div class="absolute inset-0 bg-ink/50 backdrop-blur-sm" onclick="document.getElementById('resetConfirmModal').classList.add('hidden')"></div>
  <div class="relative bg-canvas rounded-2xl shadow-2xl p-lg w-[90vw] max-w-sm text-center">
    <div class="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-md">
      <span class="material-symbols-outlined text-warning text-[28px]">restart_alt</span>
    </div>
    <h3 class="text-title-md font-bold mb-xs">보기 설정 초기화</h3>
    <p class="text-body text-muted mb-lg">모든 보기 설정을 기본값으로 되돌립니다.<br>계속하시겠습니까?</p>
    <div class="flex gap-sm">
      <button class="flex-1 h-11 rounded-pill bg-surface-strong text-body font-semibold hover:bg-hairline transition-colors" onclick="document.getElementById('resetConfirmModal').classList.add('hidden')">취소</button>
      <button class="flex-1 h-11 rounded-pill bg-warning text-white font-semibold hover:bg-warning/80 transition-colors" id="btnResetConfirm">초기화</button>
    </div>
  </div>
</div>`;

if (!html.includes('resetConfirmModal')) {
  // Insert before </body>
  html = html.replace('</body>', confirmModalHtml + '\n</body>');
}

// ─────────────────────────────────────────────
// 6. JS 수정 — initSideAccordion에서 data-no-acc 건너뜀
// ─────────────────────────────────────────────
html = html.replace(
  "document.querySelectorAll('#sideCol > section').forEach((sec, i) => {",
  "document.querySelectorAll('#sideCol > section').forEach((sec, i) => {\n        if (sec.dataset.noAcc) return;"
);

// ─────────────────────────────────────────────
// 7. btnResetOpts 클릭 → 모달 표시
//    btnResetConfirm 클릭 → 실제 초기화
// ─────────────────────────────────────────────
html = html.replace(
  `    document.getElementById('btnResetOpts').addEventListener('click', () => {
      S = { ...DEFAULTS }; saveSettings(); applySettings(); render();
      toast('보기 설정을 기본값으로 되돌렸습니다', 'restart_alt');
    });`,
  `    document.getElementById('btnResetOpts').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('resetConfirmModal').classList.remove('hidden');
    });
    document.getElementById('btnResetConfirm').addEventListener('click', () => {
      document.getElementById('resetConfirmModal').classList.add('hidden');
      S = { ...DEFAULTS }; saveSettings(); applySettings(); render();
      toast('보기 설정을 기본값으로 되돌렸습니다', 'restart_alt');
    });`
);

fs.writeFileSync(file, html, 'utf8');
console.log('Done!');
