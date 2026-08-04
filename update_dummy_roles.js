const fs = require('fs');

const file = '서버관리자_회원관리.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Change Table Header
content = content.replace(/소속 학교 \/ 부서/g, '소속 기관 / 부서');
// Also change the search placeholder if it says "학교명" -> "기관명"
content = content.replace(/이름, 학교명, 또는/g, '이름, 기관명, 또는');

// 2. We will completely replace the <tbody> with our new dummy data.
const newTbody = `
<tbody class="divide-y divide-hairline">
<!-- Table Row 1 (서버 관리자) -->
<tr class="stagger-in transition-table-row" style="animation-delay: 0.1s;">
<td class="px-lg py-base">
<div class="flex items-center gap-sm">
<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">김</div>
<div>
<div class="font-body-strong text-body-strong">김철수</div>
<div class="font-caption text-caption text-muted">chulsoo</div>
</div>
</div>
</td>
<td class="px-lg py-base">
<div class="font-body-md text-body-md text-on-surface-variant">경상북도교육청연구원</div>
<div class="font-caption text-caption text-muted">정보화운영실</div>
</td>
<td class="px-lg py-base">
<span class="px-sm py-xxs rounded-full bg-primary/10 text-primary font-caption-strong">서버 관리자</span>
</td>
<td class="px-lg py-base font-number-display text-caption text-muted">2023.03.12</td>
<td class="px-lg py-base text-center">
<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-success/10 text-success font-caption-strong">
<span class="w-1.5 h-1.5 rounded-full bg-success"></span> 활성
</span>
</td>
</tr>
<!-- Table Row 2 (학교 관리자) -->
<tr class="stagger-in transition-table-row" style="animation-delay: 0.15s;">
<td class="px-lg py-base">
<div class="flex items-center gap-sm">
<div class="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold">이</div>
<div>
<div class="font-body-strong text-body-strong">이영희</div>
<div class="font-caption text-caption text-muted">younghee</div>
</div>
</div>
</td>
<td class="px-lg py-base">
<div class="font-body-md text-body-md text-on-surface-variant">안동초등학교</div>
<div class="font-caption text-caption text-muted">교무실</div>
</td>
<td class="px-lg py-base">
<span class="px-sm py-xxs rounded-full bg-secondary-container/20 text-on-secondary-container font-caption-strong">학교 관리자</span>
</td>
<td class="px-lg py-base font-number-display text-caption text-muted">2023.05.20</td>
<td class="px-lg py-base text-center">
<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-success/10 text-success font-caption-strong">
<span class="w-1.5 h-1.5 rounded-full bg-success"></span> 활성
</span>
</td>
</tr>
<!-- Table Row 3 (교직원) -->
<tr class="stagger-in transition-table-row" style="animation-delay: 0.2s;">
<td class="px-lg py-base">
<div class="flex items-center gap-sm">
<div class="w-10 h-10 rounded-full bg-on-surface-variant/10 flex items-center justify-center text-on-surface-variant font-bold">박</div>
<div>
<div class="font-body-strong text-body-strong">박민수</div>
<div class="font-caption text-caption text-muted">minsoo</div>
</div>
</div>
</td>
<td class="px-lg py-base">
<div class="font-body-md text-body-md text-on-surface-variant">구미정보고등학교</div>
<div class="font-caption text-caption text-muted">교육연구부</div>
</td>
<td class="px-lg py-base">
<span class="px-sm py-xxs rounded-full bg-surface-container-highest text-on-surface-variant font-caption-strong">교직원</span>
</td>
<td class="px-lg py-base font-number-display text-caption text-muted">2024.01.15</td>
<td class="px-lg py-base text-center">
<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-muted/10 text-muted font-caption-strong">
<span class="w-1.5 h-1.5 rounded-full bg-muted"></span> 비활성
</span>
</td>
</tr>
<!-- Table Row 4 (장학사) -->
<tr class="stagger-in transition-table-row" style="animation-delay: 0.25s;">
<td class="px-lg py-base">
<div class="flex items-center gap-sm">
<div class="w-10 h-10 rounded-full bg-tertiary-fixed-dim/20 flex items-center justify-center text-tertiary font-bold">정</div>
<div>
<div class="font-body-strong text-body-strong">정소라</div>
<div class="font-caption text-caption text-muted">sora</div>
</div>
</div>
</td>
<td class="px-lg py-base">
<div class="font-body-md text-body-md text-on-surface-variant">경상북도교육청</div>
<div class="font-caption text-caption text-muted">초등교육과</div>
</td>
<td class="px-lg py-base">
<span class="px-sm py-xxs rounded-full bg-blue-100 text-blue-700 font-caption-strong">장학사</span>
</td>
<td class="px-lg py-base font-number-display text-caption text-muted">2022.11.02</td>
<td class="px-lg py-base text-center">
<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-success/10 text-success font-caption-strong">
<span class="w-1.5 h-1.5 rounded-full bg-success"></span> 활성
</span>
</td>
</tr>
<!-- Table Row 5 (멘토) -->
<tr class="stagger-in transition-table-row" style="animation-delay: 0.3s;">
<td class="px-lg py-base">
<div class="flex items-center gap-sm">
<div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">최</div>
<div>
<div class="font-body-strong text-body-strong">최진우</div>
<div class="font-caption text-caption text-muted">jinwoo</div>
</div>
</div>
</td>
<td class="px-lg py-base">
<div class="font-body-md text-body-md text-on-surface-variant">포항제철고등학교</div>
<div class="font-caption text-caption text-muted">정보화부</div>
</td>
<td class="px-lg py-base">
<span class="px-sm py-xxs rounded-full bg-purple-100 text-purple-700 font-caption-strong">멘토</span>
</td>
<td class="px-lg py-base font-number-display text-caption text-muted">2023.08.19</td>
<td class="px-lg py-base text-center">
<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-success/10 text-success font-caption-strong">
<span class="w-1.5 h-1.5 rounded-full bg-success"></span> 활성
</span>
</td>
</tr>
</tbody>
`;

// Replace tbody
content = content.replace(/<tbody class="divide-y divide-hairline">[\s\S]*?<\/tbody>/, newTbody);

fs.writeFileSync(file, content, 'utf8');
console.log('Updated table with 5 roles and new labels');
