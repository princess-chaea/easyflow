const fs = require('fs');

const file = '서버관리자_역할관리.html';
let content = fs.readFileSync('서버관리자_회원관리.html', 'utf8');

// Change Title and text
content = content.replace(/<title>.*<\/title>/, '<title>역할 관리 - 이지플로우</title>');
content = content.replace(/<h1 class="text-\[28px\] font-bold text-ink mb-xs">사용자 권한 관리<\/h1>/, '<h1 class="text-[28px] font-bold text-ink mb-xs">역할 관리</h1>');
content = content.replace(/<p class="text-\[15px\] text-ink\/70">시스템 전체 사용자 리스트를 조회하고 권한을 변경할 수 있습니다\.<\/p>/, '<p class="text-[15px] text-ink/70">사용자들이 신청한 권한(역할)을 일괄 승인하거나 반려할 수 있습니다.</p>');

// Update Sidebar to highlight '역할 관리' instead of '회원 관리'
content = content.replace(/class="font-nav-link block px-sm py-sm rounded-lg transition-colors text-\[16px\] bg-primary text-white font-bold" href="서버관리자_회원관리\.html"/, 
    'class="font-nav-link block px-sm py-sm rounded-lg transition-colors text-[16px] text-on-surface-variant hover:bg-surface hover:text-ink" href="서버관리자_회원관리.html"');
content = content.replace(/class="font-nav-link block px-sm py-sm rounded-lg transition-colors text-\[16px\] text-on-surface-variant hover:bg-surface hover:text-ink" href="서버관리자_역할관리\.html"/, 
    'class="font-nav-link block px-sm py-sm rounded-lg transition-colors text-[16px] bg-primary text-white font-bold" href="서버관리자_역할관리.html"');


// Replace the main table content with Role Management specific HTML and JS
const tableReplacement = `
<!-- Role Management Controls -->
<div class="flex items-center justify-between mb-4 mt-8">
    <div class="flex gap-2">
        <button id="bulkApproveBtn" class="px-4 py-2 bg-green-600 text-white font-bold rounded-lg text-[14px] shadow-sm hover:bg-green-700 transition-colors">일괄 승인</button>
        <button id="bulkRejectBtn" class="px-4 py-2 bg-red-600 text-white font-bold rounded-lg text-[14px] shadow-sm hover:bg-red-700 transition-colors">일괄 반려</button>
    </div>
</div>

<!-- Table -->
<div class="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm mb-12">
    <table class="w-full text-left border-collapse">
        <thead>
            <tr class="bg-surface-soft border-b border-gray-200">
                <th class="p-4 text-[14px] font-bold text-ink/70 w-[50px] text-center">
                    <input type="checkbox" id="selectAllCheckbox" class="w-4 h-4 cursor-pointer accent-primary">
                </th>
                <th class="p-4 text-[14px] font-bold text-ink/70 text-center">아이디 (이메일)</th>
                <th class="p-4 text-[14px] font-bold text-ink/70 text-center">신청 권한</th>
                <th class="p-4 text-[14px] font-bold text-ink/70 text-center">상태</th>
                <th class="p-4 text-[14px] font-bold text-ink/70 text-center">작업</th>
            </tr>
        </thead>
        <tbody id="roleTableBody" class="divide-y divide-gray-100">
            <!-- JS injected rows -->
        </tbody>
    </table>
</div>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        let pendingRequests = JSON.parse(localStorage.getItem('roleRequests')) || [];
        const tbody = document.getElementById('roleTableBody');
        const selectAll = document.getElementById('selectAllCheckbox');
        const bulkApproveBtn = document.getElementById('bulkApproveBtn');
        const bulkRejectBtn = document.getElementById('bulkRejectBtn');
        
        const renderTable = () => {
            tbody.innerHTML = '';
            if(pendingRequests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-ink/50 text-[14px]">현재 대기 중인 권한 요청이 없습니다.</td></tr>';
                return;
            }
            
            pendingRequests.forEach((req, idx) => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 transition-colors';
                tr.innerHTML = \`
                    <td class="p-4 text-center">
                        <input type="checkbox" class="row-checkbox w-4 h-4 cursor-pointer accent-primary" data-index="\${idx}">
                    </td>
                    <td class="p-4 text-[15px] font-bold text-ink text-center">\${req.email}</td>
                    <td class="p-4 text-[14px] text-ink/70 text-center"><span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">\${req.requestedRole}</span></td>
                    <td class="p-4 text-center"><span class="text-orange-600 font-bold text-[13px] bg-orange-100 px-2 py-1 rounded-md">대기 중</span></td>
                    <td class="p-4 flex gap-2 justify-center">
                        <button class="px-3 py-1.5 bg-green-500 text-white font-bold rounded-lg text-[13px] hover:bg-green-600 transition-colors btn-approve" data-index="\${idx}">승인</button>
                        <button class="px-3 py-1.5 bg-red-500 text-white font-bold rounded-lg text-[13px] hover:bg-red-600 transition-colors btn-reject" data-index="\${idx}">반려</button>
                    </td>
                \`;
                tbody.appendChild(tr);
            });
        };
        
        renderTable();
        
        const showToast = (message) => {
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-10 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg bg-blue-600 text-white font-bold text-[15px] z-[10000] transition-all duration-300';
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            toast.innerText = message;
            document.body.appendChild(toast);
            requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translate(-50%, 0)'; });
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, -20px)'; setTimeout(() => toast.remove(), 300); }, 3000);
        };
        
        const approveRole = (index) => {
            const req = pendingRequests[index];
            let userGrantedRoles = JSON.parse(localStorage.getItem(\`grantedRoles_\${req.email}\`)) || [];
            if (userGrantedRoles.length === 0) {
                let r = '교사'; // Changed from 일반 교원 to 교사 based on user request
                if (req.email === 'test@gbe.kr') r = '서버 관리자';
                else if (req.email === 'test1@gbe.kr') r = '학교 관리자';
                else if (req.email === 'test2@gbe.kr') r = '업무배송 담당자';
                else if (req.email === 'test3@gbe.kr') r = '멘토';
                else if (req.email === 'test4@gbe.kr') r = '장학사';
                userGrantedRoles.push(r);
            }
            if (!userGrantedRoles.includes(req.requestedRole)) {
                userGrantedRoles.push(req.requestedRole);
                localStorage.setItem(\`grantedRoles_\${req.email}\`, JSON.stringify(userGrantedRoles));
            }
        };
        
        tbody.addEventListener('click', (e) => {
            if(e.target.classList.contains('btn-approve')) {
                const idx = e.target.getAttribute('data-index');
                approveRole(idx);
                pendingRequests.splice(idx, 1);
                localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
                renderTable();
                showToast('승인되었습니다.');
            } else if(e.target.classList.contains('btn-reject')) {
                const idx = e.target.getAttribute('data-index');
                pendingRequests.splice(idx, 1);
                localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
                renderTable();
                showToast('반려되었습니다.');
            }
        });
        
        selectAll.addEventListener('change', (e) => {
            document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
        });
        
        const getSelectedIndices = () => {
            return Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => parseInt(cb.getAttribute('data-index'))).sort((a,b)=>b-a);
        };
        
        bulkApproveBtn.addEventListener('click', () => {
            const indices = getSelectedIndices();
            if(indices.length === 0) return showToast('선택된 항목이 없습니다.');
            indices.forEach(idx => approveRole(idx));
            indices.forEach(idx => pendingRequests.splice(idx, 1));
            localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
            selectAll.checked = false;
            renderTable();
            showToast(\`\${indices.length}건이 일괄 승인되었습니다.\`);
        });
        
        bulkRejectBtn.addEventListener('click', () => {
            const indices = getSelectedIndices();
            if(indices.length === 0) return showToast('선택된 항목이 없습니다.');
            indices.forEach(idx => pendingRequests.splice(idx, 1));
            localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
            selectAll.checked = false;
            renderTable();
            showToast(\`\${indices.length}건이 일괄 반려되었습니다.\`);
        });
    });
</script>
`;

// Replace from <!-- Search & Filter Bar --> down to the end of <!-- Role Management Modal --> entirely
content = content.replace(/<!-- Search & Filter Bar -->[\s\S]*?(?=<\/main>)/, tableReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Role page rebuilt');
