(function () {
    const tableBody = document.getElementById('memberTableBody');
    if (!tableBody) return;

    // 1. Initialize Mock Users if not exists
    let mockUsers = JSON.parse(localStorage.getItem('mockUsers'));
    
    if (!mockUsers) {
        mockUsers = [
            { name: '김철수', id: 'chulsoo', email: 'chulsoo@test.com', org: '경상북도교육청연구원', dept: '정보화운영실', roles: ['서버 관리자'], joinDate: '2023.03.12', status: '활성' },
            { name: '이영희', id: 'younghee', email: 'younghee@test.com', org: '안동초등학교', dept: '교무실', roles: ['학교 관리자'], joinDate: '2023.05.20', status: '활성' },
            { name: '박민수', id: 'minsoo', email: 'minsoo@test.com', org: '구미정보고등학교', dept: '교육연구부', roles: ['교직원'], joinDate: '2024.01.15', status: '비활성' },
            { name: '정소라', id: 'sora', email: 'sora@test.com', org: '경상북도교육청', dept: '초등교육과', roles: ['장학사'], joinDate: '2022.11.02', status: '활성' },
            { name: '최진우', id: 'jinwoo', email: 'jinwoo@test.com', org: '포항제철고등학교', dept: '정보화부', roles: ['멘토'], joinDate: '2023.08.19', status: '활성' }
        ];

        // If there's a currentUser in localStorage, add them to mock database
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser) {
            const currentRoles = JSON.parse(localStorage.getItem('grantedRoles')) || ['교직원'];
            // Check if currentUser is already in mockUsers by email
            if (!mockUsers.find(u => u.email === currentUser.email)) {
                mockUsers.unshift({
                    name: currentUser.name || '내 계정',
                    id: currentUser.email.split('@')[0],
                    email: currentUser.email,
                    org: currentUser.org || '소속 미설정',
                    dept: currentUser.dept || '부서 미설정',
                    roles: currentRoles,
                    joinDate: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
                    status: '활성'
                });
            }
        }
        localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
    } else {
        // Sync currentUser roles if they exist
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser) {
            const currentRoles = JSON.parse(localStorage.getItem('grantedRoles')) || ['교직원'];
            const userIndex = mockUsers.findIndex(u => u.email === currentUser.email);
            if (userIndex !== -1) {
                mockUsers[userIndex].roles = currentRoles;
            } else {
                mockUsers.unshift({
                    name: currentUser.name || '내 계정',
                    id: currentUser.email.split('@')[0],
                    email: currentUser.email,
                    org: currentUser.org || '소속 미설정',
                    dept: currentUser.dept || '부서 미설정',
                    roles: currentRoles,
                    joinDate: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
                    status: '활성'
                });
            }
            localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
        }
    }

    // Role color mapping
    const roleColors = {
        '서버 관리자': 'bg-primary/10 text-primary',
        '학교 관리자': 'bg-secondary-container/20 text-on-secondary-container',
        '교직원': 'bg-surface-container-highest text-on-surface-variant',
        '장학사': 'bg-blue-100 text-blue-700',
        '멘토': 'bg-purple-100 text-purple-700'
    };

    function renderTable() {
        tableBody.innerHTML = '';
        const roleRequests = JSON.parse(localStorage.getItem('roleRequests')) || {};
        const mockUsers = JSON.parse(localStorage.getItem('mockUsers')) || [];

        mockUsers.forEach((user, index) => {
            const requests = roleRequests[user.email] || [];
            
            // Build Roles HTML
            const rolesHtml = user.roles.map(r => 
                `<span class="px-sm py-xxs rounded-full ${roleColors[r] || 'bg-gray-100 text-gray-700'} font-caption-strong mb-1 inline-block mr-1">${r}</span>`
            ).join('');

            // Build Management HTML (Requests)
            let manageHtml = '<span class="text-muted text-[13px]">요청 없음</span>';
            if (requests.length > 0) {
                manageHtml = requests.map(reqRole => `
                    <div class="flex items-center justify-between bg-orange-50 border border-orange-200 p-1.5 rounded-lg mb-1 gap-2">
                        <span class="text-[12px] font-bold text-orange-700">${reqRole} 요청</span>
                        <div class="flex gap-1">
                            <button class="bg-success text-white px-2 py-0.5 rounded text-[11px] hover:bg-success/80 transition-colors" onclick="window.approveRole('${user.email}', '${reqRole}')">승인</button>
                            <button class="bg-danger text-white px-2 py-0.5 rounded text-[11px] hover:bg-danger/80 transition-colors" onclick="window.rejectRole('${user.email}', '${reqRole}')">거절</button>
                        </div>
                    </div>
                `).join('');
            }

            const statusHtml = user.status === '활성' 
                ? `<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-success/10 text-success font-caption-strong"><span class="w-1.5 h-1.5 rounded-full bg-success"></span> 활성</span>`
                : `<span class="inline-flex items-center gap-xs px-sm py-xxs rounded-full bg-muted/10 text-muted font-caption-strong"><span class="w-1.5 h-1.5 rounded-full bg-muted"></span> 비활성</span>`;

            const initial = user.name.charAt(0);
            
            const tr = document.createElement('tr');
            tr.className = 'stagger-in transition-table-row';
            tr.style.animationDelay = `${index * 0.05}s`;
            
            tr.innerHTML = `
                <td class="px-lg py-base">
                    <div class="flex items-center gap-sm">
                        <div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-bold">${initial}</div>
                        <div>
                            <div class="font-body-strong text-body-strong">${user.name}</div>
                            <div class="font-caption text-caption text-muted">${user.id}</div>
                        </div>
                    </div>
                </td>
                <td class="px-lg py-base">
                    <div class="font-body-md text-body-md text-on-surface-variant">${user.org}</div>
                    <div class="font-caption text-caption text-muted">${user.dept}</div>
                </td>
                <td class="px-lg py-base">
                    ${rolesHtml}
                </td>
                <td class="px-lg py-base font-number-display text-caption text-muted">${user.joinDate}</td>
                <td class="px-lg py-base text-center">
                    ${statusHtml}
                </td>
                <td class="px-lg py-base min-w-[200px]">
                    ${manageHtml}
                </td>
            `;
            
            tableBody.appendChild(tr);
        });
    }

    // Global Functions for inline onclick handlers
    window.approveRole = function(email, role) {
        // 1. Remove from requests
        const roleRequests = JSON.parse(localStorage.getItem('roleRequests')) || {};
        if (roleRequests[email]) {
            roleRequests[email] = roleRequests[email].filter(r => r !== role);
            if (roleRequests[email].length === 0) delete roleRequests[email];
            localStorage.setItem('roleRequests', JSON.stringify(roleRequests));
        }

        // 2. Add to user's roles
        let mockUsers = JSON.parse(localStorage.getItem('mockUsers')) || [];
        const userIndex = mockUsers.findIndex(u => u.email === email);
        if (userIndex !== -1) {
            if (!mockUsers[userIndex].roles.includes(role)) {
                mockUsers[userIndex].roles.push(role);
            }
            localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
        }

        // 3. If it's the current user, update their global grantedRoles
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.email === email) {
            const currentRoles = JSON.parse(localStorage.getItem('grantedRoles')) || ['교직원'];
            if (!currentRoles.includes(role)) {
                currentRoles.push(role);
                localStorage.setItem('grantedRoles', JSON.stringify(currentRoles));
            }
        }

        alert(`${role} 권한을 승인했습니다.`);
        renderTable();
    };

    window.rejectRole = function(email, role) {
        // Remove from requests
        const roleRequests = JSON.parse(localStorage.getItem('roleRequests')) || {};
        if (roleRequests[email]) {
            roleRequests[email] = roleRequests[email].filter(r => r !== role);
            if (roleRequests[email].length === 0) delete roleRequests[email];
            localStorage.setItem('roleRequests', JSON.stringify(roleRequests));
        }

        alert(`${role} 권한 요청을 거절했습니다.`);
        renderTable();
    };

    // Initial render
    renderTable();
})();
