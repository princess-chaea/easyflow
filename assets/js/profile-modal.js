(function() {
    // 1. Fetch User Data
    const currentUser = localStorage.getItem('currentUser');
    const currentRole = localStorage.getItem('currentRole');
    if (!currentUser) return;

    // Mapping avatar
    let avatarSeed = 'Felix';
    if (currentUser === 'test@gbe.kr') avatarSeed = 'Mimi';
    else if (currentUser === 'test1@gbe.kr') avatarSeed = 'Snuggles';
    else if (currentUser === 'test2@gbe.kr') avatarSeed = 'Buster';
    else if (currentUser === 'test3@gbe.kr') avatarSeed = 'Oliver';
    else if (currentUser === 'test4@gbe.kr') avatarSeed = 'Bella';
    else if (currentUser === 'test5@gbe.kr') avatarSeed = 'Simba';

    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`;

    // Replace header avatar
    const headerImages = document.querySelectorAll('header img');
    headerImages.forEach(img => {
        if (img.src.includes('avataaars/svg') || img.src.includes('googleusercontent')) {
            img.src = avatarUrl;
        }
    });

    // 2. Remove Gear Icon globally
    const gearIcons = document.querySelectorAll('a[href="공통_프로필수정.html"] span[data-icon="settings"], a[aria-label="설정"]');
    gearIcons.forEach(icon => {
        const parent = icon.closest('a');
        if (parent) parent.remove();
        else icon.remove();
    });

    // 3. Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/profile-modal.css';
    document.head.appendChild(link);

    // Load Local Storage
    let grantedRoles = JSON.parse(localStorage.getItem(`grantedRoles_${currentUser}`)) || [currentRole];
    let pendingRequests = JSON.parse(localStorage.getItem('roleRequests')) || [];

    // Admin Check
    const isAdmin = (currentRole === '서버관리자' || currentRole === '장학사');

    // 4. Build Modal HTML
    const modalHTML = `
    <div id="profileModalOverlay">
        <div id="profileModalContent">
            <div class="p-8 border-b border-gray-100 flex items-center justify-between bg-surface-soft/30 rounded-t-3xl">
                <div>
                    <h1 class="text-[24px] font-bold text-ink mb-1">내 프로필 설정</h1>
                    <p class="text-[14px] text-ink/60">개인정보, 시스템 권한, 그리고 알림 수신 여부를 관리합니다.</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.location.href='공통_로그인.html'" class="px-4 py-2 border border-gray-300 rounded-xl text-ink/70 font-bold hover:bg-gray-50 transition-colors text-[14px] flex items-center gap-1">
                        <span class="material-symbols-outlined text-[18px]">logout</span> 로그아웃
                    </button>
                    <button id="pmCloseBtn" class="pm-close-btn p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <span class="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>
            </div>

            <div class="p-8 flex flex-col gap-8">
                <!-- 아바타 및 기본 정보 -->
                <section class="flex flex-col sm:flex-row gap-8 items-start">
                    <div class="flex flex-col items-center gap-3 shrink-0">
                        <div class="relative group cursor-pointer">
                            <div class="w-28 h-28 rounded-full overflow-hidden border-4 border-surface shadow-sm group-hover:opacity-80 transition-opacity">
                                <img src="${avatarUrl}" alt="프로필" class="w-full h-full object-cover">
                            </div>
                            <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span class="material-symbols-outlined text-white text-[28px]">photo_camera</span>
                            </div>
                        </div>
                        <button class="text-[13px] font-bold text-primary hover:underline">이미지 변경</button>
                    </div>

                    <div class="flex-1 flex flex-col gap-4 w-full">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[14px] font-bold text-ink">이름</label>
                            <input type="text" value="${currentUser.split('@')[0]}" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-surface-soft" readonly>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[14px] font-bold text-ink">GBE 이메일 (아이디)</label>
                            <input type="text" value="${currentUser}" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-surface-soft text-ink/60" readonly>
                        </div>
                    </div>
                </section>

                <hr class="border-gray-100">

                <!-- 현재 역할(권한) 상태 -->
                <section class="flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-[18px] font-bold text-ink">시스템 부여 역할 (권한)</h2>
                    </div>
                    
                    <div class="bg-surface-soft rounded-xl p-4 border border-gray-200">
                        <div class="flex flex-wrap gap-2 mb-3" id="pmGrantedRolesContainer">
                            ${grantedRoles.map(role => `<span class="bg-primary text-white px-3 py-1 rounded-full text-[14px] font-bold shadow-sm">${role}</span>`).join('')}
                        </div>
                        
                        <div id="pmPendingRolesContainer">
                            ${pendingRequests.filter(r => r.email === currentUser).map(r => `
                                <p class="text-[13px] text-ink/60 mt-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[16px] text-orange-500">pending</span> 
                                    <strong>'${r.requestedRole}'</strong> 권한 승인 대기 중입니다.
                                </p>
                            `).join('')}
                        </div>
                        
                        <div class="mt-4 flex gap-2">
                            <select id="pmRoleRequestSelect" class="border border-gray-300 rounded-lg px-3 py-1.5 text-[14px] focus:border-primary focus:outline-none flex-1">
                                <option value="">추가 권한 신청하기...</option>
                                <option value="학교관리자">학교관리자</option>
                                <option value="업무배송 담당자">업무배송 담당자</option>
                                <option value="인생 도서관 멘토">인생 도서관 멘토</option>
                                <option value="장학사">장학사</option>
                                <option value="서버관리자">서버관리자</option>
                            </select>
                            <button id="pmRequestRoleBtn" class="bg-ink text-white px-4 py-1.5 rounded-lg text-[14px] font-bold hover:bg-ink/80 transition-colors">신청</button>
                        </div>
                    </div>
                </section>

                ${isAdmin ? `
                <hr class="border-gray-100">
                <!-- 관리자용: 권한 요청 관리 -->
                <section class="flex flex-col gap-4">
                    <h2 class="text-[18px] font-bold text-primary flex items-center gap-1">
                        <span class="material-symbols-outlined text-[20px]">admin_panel_settings</span> 권한 요청 관리 (관리자 전용)
                    </h2>
                    <div class="bg-orange-50 rounded-xl p-4 border border-orange-200">
                        ${pendingRequests.length === 0 ? '<p class="text-[13px] text-ink/60">현재 대기 중인 요청이 없습니다.</p>' : ''}
                        <ul class="flex flex-col gap-3">
                            ${pendingRequests.map((req, idx) => `
                                <li class="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-orange-100">
                                    <div class="flex flex-col">
                                        <span class="text-[14px] font-bold text-ink">${req.email}</span>
                                        <span class="text-[13px] text-ink/70">신청 권한: <strong>${req.requestedRole}</strong></span>
                                    </div>
                                    <div class="flex gap-2">
                                        <button class="pm-approve-btn px-3 py-1 bg-success/10 text-success font-bold text-[13px] rounded-md hover:bg-success hover:text-white transition-colors" data-index="${idx}" data-email="${req.email}" data-role="${req.requestedRole}">승인</button>
                                        <button class="pm-reject-btn px-3 py-1 bg-danger/10 text-danger font-bold text-[13px] rounded-md hover:bg-danger hover:text-white transition-colors" data-index="${idx}">반려</button>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </section>
                ` : ''}

                <div class="flex justify-end mt-4">
                    <button id="pmSaveCloseBtn" class="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-active transition-colors">
                        확인 및 닫기
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById('profileModalOverlay');
    const closeBtn = document.getElementById('pmCloseBtn');
    const saveBtn = document.getElementById('pmSaveCloseBtn');
    const requestBtn = document.getElementById('pmRequestRoleBtn');
    const roleSelect = document.getElementById('pmRoleRequestSelect');

    // 5. Override Dropdown '프로필 수정' links to open modal
    const profileLinks = document.querySelectorAll('a[href="공통_프로필수정.html"]');
    profileLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            overlay.classList.add('active');
        });
    });

    const closeModal = () => {
        overlay.classList.remove('active');
    };

    closeBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal();
    });

    // 6. Role Request Logic
    if (requestBtn) {
        requestBtn.addEventListener('click', () => {
            const requestedRole = roleSelect.value;
            if (!requestedRole) return;
            if (grantedRoles.includes(requestedRole)) {
                alert('이미 보유한 권한입니다.');
                return;
            }
            
            const req = { email: currentUser, requestedRole };
            pendingRequests.push(req);
            localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
            alert('권한 신청이 완료되었습니다. 관리자 승인을 대기합니다.');
            location.reload(); // Quick refresh to update UI
        });
    }

    // 7. Admin Approve/Reject Logic
    document.querySelectorAll('.pm-approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            const targetEmail = e.target.getAttribute('data-email');
            const targetRole = e.target.getAttribute('data-role');

            let userGrantedRoles = JSON.parse(localStorage.getItem(`grantedRoles_${targetEmail}`)) || [];
            // If they are approving a base role and haven't loaded base, default to their initial
            if (userGrantedRoles.length === 0) {
                // Approximate initial role
                let r = '일반 교원';
                if (targetEmail === 'test@gbe.kr') r = '서버관리자';
                else if (targetEmail === 'test1@gbe.kr') r = '학교관리자';
                else if (targetEmail === 'test2@gbe.kr') r = '업무배송 담당자';
                else if (targetEmail === 'test3@gbe.kr') r = '인생 도서관 멘토';
                else if (targetEmail === 'test4@gbe.kr') r = '장학사';
                userGrantedRoles.push(r);
            }
            
            if (!userGrantedRoles.includes(targetRole)) {
                userGrantedRoles.push(targetRole);
            }
            localStorage.setItem(`grantedRoles_${targetEmail}`, JSON.stringify(userGrantedRoles));
            
            pendingRequests.splice(idx, 1);
            localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
            
            alert(`${targetEmail} 님의 [${targetRole}] 권한을 승인했습니다.`);
            location.reload();
        });
    });

    document.querySelectorAll('.pm-reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            pendingRequests.splice(idx, 1);
            localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
            alert('요청을 반려했습니다.');
            location.reload();
        });
    });

})();
