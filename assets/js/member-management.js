(function () {
    const tableBody = document.getElementById('memberTableBody');
    if (!tableBody) return;

    // currentUser는 로그인 시 이메일 문자열로 저장됨(auth.js) - 예전 코드는 이걸 JSON.parse해서
    // 실사용자 로그인 상태에서 항상 예외가 났음(개발 중엔 currentUser가 비어 있어 드러나지 않았을 뿐).
    // roleRequests/grantedRoles도 서버관리자_역할관리.html·auth.js와 다른 모양(전역 키, 객체 형태)을
    // 쓰고 있어 그쪽에서 승인해도 이 화면에, 이 화면에서 승인해도 실제 권한(auth.js)에 반영되지
    // 않았음 - 아래에서 모두 같은 규약(roleRequests=배열, grantedRoles_<email>=사용자별)으로 통일.

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
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            const currentRoles = JSON.parse(localStorage.getItem('grantedRoles_' + currentUser)) || ['교직원'];
            // Check if currentUser is already in mockUsers by email
            if (!mockUsers.find(u => u.email === currentUser)) {
                mockUsers.unshift({
                    name: currentUser.split('@')[0],
                    id: currentUser.split('@')[0],
                    email: currentUser,
                    org: localStorage.getItem('org_' + currentUser) || '소속 미설정',
                    dept: localStorage.getItem('rank_' + currentUser) || '부서 미설정',
                    roles: currentRoles,
                    joinDate: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, ''),
                    status: '활성'
                });
            }
        }
        localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
    } else {
        // Sync currentUser roles if they exist
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            const currentRoles = JSON.parse(localStorage.getItem('grantedRoles_' + currentUser)) || ['교직원'];
            const userIndex = mockUsers.findIndex(u => u.email === currentUser);
            if (userIndex !== -1) {
                mockUsers[userIndex].roles = currentRoles;
            } else {
                mockUsers.unshift({
                    name: currentUser.split('@')[0],
                    id: currentUser.split('@')[0],
                    email: currentUser,
                    org: localStorage.getItem('org_' + currentUser) || '소속 미설정',
                    dept: localStorage.getItem('rank_' + currentUser) || '부서 미설정',
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

    function loadRoleRequests() {
        // roleRequests는 배열 [{email, requestedRole}] - 회원가입/profile-modal.js/역할관리.html과 동일 규약
        const raw = JSON.parse(localStorage.getItem('roleRequests'));
        return Array.isArray(raw) ? raw : [];
    }

    function renderTable() {
        tableBody.innerHTML = '';
        const roleRequests = loadRoleRequests();
        const mockUsers = JSON.parse(localStorage.getItem('mockUsers')) || [];

        mockUsers.forEach((user, index) => {
            const requests = roleRequests.filter(r => r.email === user.email);

            // Build Roles HTML
            const rolesHtml = user.roles.map(r =>
                `<span class="px-sm py-xxs rounded-full ${roleColors[r] || 'bg-gray-100 text-gray-700'} font-caption-strong mb-1 inline-block mr-1">${r}</span>`
            ).join('');

            // Build Management HTML (Requests)
            let manageHtml = '<span class="text-muted text-[13px]">요청 없음</span>';
            if (requests.length > 0) {
                manageHtml = requests.map(req => `
                    <div class="flex items-center justify-between bg-orange-50 border border-orange-200 p-1.5 rounded-lg mb-1 gap-2">
                        <span class="text-[12px] font-bold text-orange-700">${req.requestedRole} 요청</span>
                        <div class="flex gap-1">
                            <button class="bg-success text-white px-2 py-0.5 rounded text-[11px] hover:bg-success/80 transition-colors" onclick="window.approveRole('${user.email}', '${req.requestedRole}')">승인</button>
                            <button class="bg-danger text-white px-2 py-0.5 rounded text-[11px] hover:bg-danger/80 transition-colors" onclick="window.rejectRole('${user.email}', '${req.requestedRole}')">거절</button>
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
    window.approveRole = function (email, role) {
        // 1. Remove from requests (배열에서 해당 항목만 제거)
        const roleRequests = loadRoleRequests().filter(r => !(r.email === email && r.requestedRole === role));
        localStorage.setItem('roleRequests', JSON.stringify(roleRequests));

        // 2. Add to user's roles (관리 화면 표시용 mockUsers)
        let mockUsers = JSON.parse(localStorage.getItem('mockUsers')) || [];
        const userIndex = mockUsers.findIndex(u => u.email === email);
        if (userIndex !== -1) {
            if (!mockUsers[userIndex].roles.includes(role)) {
                mockUsers[userIndex].roles.push(role);
            }
            localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
        }

        // 3. 실제 권한 판정(auth.js의 EF_ROLE)이 읽는 사용자별 키에 반영
        const grantedRoles = JSON.parse(localStorage.getItem('grantedRoles_' + email)) || ['교직원'];
        if (!grantedRoles.includes(role)) {
            grantedRoles.push(role);
            localStorage.setItem('grantedRoles_' + email, JSON.stringify(grantedRoles));
        }

        alert(`${role} 권한을 승인했습니다.`);
        renderTable();
    };

    window.rejectRole = function (email, role) {
        const roleRequests = loadRoleRequests().filter(r => !(r.email === email && r.requestedRole === role));
        localStorage.setItem('roleRequests', JSON.stringify(roleRequests));

        alert(`${role} 권한 요청을 거절했습니다.`);
        renderTable();
    };

    // Initial render
    renderTable();
})();
