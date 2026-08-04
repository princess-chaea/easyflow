const fs = require('fs');

// 1. Fix RAG Data Management HTML
let ragFile = '서버관리자_RAG데이터관리.html';
if (fs.existsSync(ragFile)) {
    let content = fs.readFileSync(ragFile, 'utf8');
    // Add whitespace-nowrap to the '관리' column cells to prevent breaking
    content = content.replace(/<td class="px-xl py-lg text-right">/g, '<td class="px-xl py-lg text-right whitespace-nowrap">');
    fs.writeFileSync(ragFile, content, 'utf8');
}

// 2. Fix profile-modal.js
let modalFile = 'assets/js/profile-modal.js';
if (fs.existsSync(modalFile)) {
    let content = fs.readFileSync(modalFile, 'utf8');
    
    // Add default 교직원 role logic before building HTML
    const roleLogicOld = `    let grantedRoles = JSON.parse(localStorage.getItem(\`grantedRoles_\${currentUser}\`)) || [currentRole];
    let pendingRequests = JSON.parse(localStorage.getItem('roleRequests')) || [];`;
    
    const roleLogicNew = `    let grantedRoles = JSON.parse(localStorage.getItem(\`grantedRoles_\${currentUser}\`)) || [currentRole];
    if (!grantedRoles.includes('교직원')) {
        grantedRoles.unshift('교직원');
    }
    let pendingRequests = JSON.parse(localStorage.getItem('roleRequests')) || [];
    
    // Retrieve stored org and rank or default to empty
    let userOrg = localStorage.getItem(\`org_\${currentUser}\`) || '';
    let userRank = localStorage.getItem(\`rank_\${currentUser}\`) || '';
    
    const allRoles = ['학교 관리자', '업무배송 담당자', '멘토', '장학사', '서버 관리자'];
    const availableRoles = allRoles.filter(r => !grantedRoles.includes(r));
    `;
    
    content = content.replace(roleLogicOld, roleLogicNew);
    
    // Replace the HTML template section
    const htmlOldStart = `<div class="flex-1 flex flex-col gap-4 w-full">`;
    const htmlOldEnd = `</section>`;
    
    const oldSectionRegex = /<div class="flex-1 flex flex-col gap-4 w-full">[\s\S]*?<\/section>/;
    
    const htmlNew = `<div class="flex-1 flex flex-col gap-4 w-full">
                        <div class="flex flex-col sm:flex-row gap-4 w-full">
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">기관</label>
                                <input type="text" id="pmOrgInput" value="\${userOrg}" placeholder="예) 경상북도교육청" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-white">
                            </div>
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">직급</label>
                                <input type="text" id="pmRankInput" value="\${userRank}" placeholder="예) 장학사, 주무관" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-white">
                            </div>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-4 w-full">
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">이름</label>
                                <input type="text" value="\${currentUser.split('@')[0]}" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-surface-soft" readonly>
                            </div>
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">GBE 이메일 (아이디)</label>
                                <input type="text" value="\${currentUser}" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-surface-soft text-ink/60" readonly>
                            </div>
                        </div>
                    </div>
                </section>

                <hr class="border-gray-100">

                <!-- 현재 역할(권한) 상태 -->
                <section class="flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-[18px] font-bold text-ink">권한 및 역할</h2>
                    </div>
                    
                    <div class="bg-surface-soft rounded-xl p-4 border border-gray-200">
                        <div class="flex flex-wrap gap-2 mb-3" id="pmGrantedRolesContainer">
                            \${grantedRoles.map(role => \`<span class="bg-primary text-white px-3 py-1 rounded-full text-[14px] font-bold shadow-sm">\${role}</span>\`).join('')}
                        </div>
                        
                        <div id="pmPendingRolesContainer">
                            \${pendingRequests.filter(r => r.email === currentUser).map(r => \`
                                <p class="text-[13px] text-ink/60 mt-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[16px] text-orange-500">pending</span> 
                                    <strong>'\${r.requestedRole}'</strong> 권한 승인 대기 중입니다.
                                </p>
                            \`).join('')}
                        </div>
                        
                        \${availableRoles.length > 0 ? \`
                        <div class="mt-4 flex gap-2">
                            <select id="pmRoleRequestSelect" class="border border-gray-300 rounded-lg px-3 py-1.5 text-[14px] focus:border-primary focus:outline-none flex-1">
                                <option value="">추가 권한 신청하기...</option>
                                \${availableRoles.map(r => \`<option value="\${r}">\${r}</option>\`).join('')}
                            </select>
                            <button id="pmRequestRoleBtn" class="bg-ink text-white px-4 py-1.5 rounded-lg text-[14px] font-bold hover:bg-ink/80 transition-colors">신청</button>
                        </div>
                        \` : \`<div class="mt-4 text-[13px] text-ink/60">모든 권한을 보유하고 있습니다.</div>\`}
                    </div>
                </section>`;

    content = content.replace(oldSectionRegex, htmlNew);
    
    // We also need to save org and rank on saveBtn click
    const saveEventRegex = /saveBtn\.addEventListener\('click',\s*\(\)\s*=>\s*\{/;
    const saveEventNew = `saveBtn.addEventListener('click', () => {
        const orgInput = document.getElementById('pmOrgInput');
        const rankInput = document.getElementById('pmRankInput');
        if(orgInput) localStorage.setItem(\`org_\${currentUser}\`, orgInput.value);
        if(rankInput) localStorage.setItem(\`rank_\${currentUser}\`, rankInput.value);
`;
    content = content.replace(saveEventRegex, saveEventNew);
    
    fs.writeFileSync(modalFile, content, 'utf8');
}

console.log('Fixed RAG table and Profile Modal');
