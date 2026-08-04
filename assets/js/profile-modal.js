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
    if (!grantedRoles.includes('교직원')) {
        grantedRoles.unshift('교직원');
    }
    let pendingRequests = JSON.parse(localStorage.getItem('roleRequests')) || [];
    
    // Retrieve stored org and rank or default to empty
    let userOrg = localStorage.getItem(`org_${currentUser}`) || '';
    let userRank = localStorage.getItem(`rank_${currentUser}`) || '';
    
    const allRoles = ['학교 관리자', '업무배송 담당자', '멘토', '장학사', '서버 관리자'];
    const normalizeRole = r => r.replace(/\s+/g, '');
    const normalizedGranted = grantedRoles.map(normalizeRole);
    const availableRoles = allRoles.filter(r => !normalizedGranted.includes(normalizeRole(r)));
    

    // Custom Toast function
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-10 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg text-white font-bold text-[15px] z-[10000] transition-all duration-300 ${type === 'success' ? 'bg-primary' : 'bg-danger'}`;
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        toast.innerText = message;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, 0)';
        });
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // 4. Build Modal HTML (Removed Admin Section)
    const modalHTML = `
    <div id="profileModalOverlay">
        <div id="profileModalContent">
            <div class="p-8 border-b border-gray-100 flex items-center justify-between bg-surface-soft/30 rounded-t-3xl">
                <div>
                    <h1 class="text-[24px] font-bold text-ink mb-1">내 프로필 설정</h1>
                    <p class="text-[14px] text-ink/60">개인정보, 시스템 권한, 그리고 알림 수신 여부를 관리합니다.</p>
                </div>
                <div class="flex items-center gap-3">
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
                        <div class="flex flex-col sm:flex-row gap-4 w-full">
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink" for="pmOrgInput">기관 및 부서</label>
                                <div class="relative">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-muted pointer-events-none">search</span>
                                    <input type="text" id="pmOrgInput" value="${userOrg}" placeholder="학교명 또는 기관·부서명 입력 (예: 아천초, 미래정보교육과)" autocomplete="off" class="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-white">
                                </div>
                                <input type="hidden" id="pmOrgSchoolCode">
                            </div>
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">직위</label>
                                <input type="text" id="pmRankInput" value="${userRank}" placeholder="예) 장학사, 주무관" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-white">
                            </div>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-4 w-full">
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">이름</label>
                                <input type="text" value="${currentUser.split('@')[0]}" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-surface-soft" readonly>
                            </div>
                            <div class="flex flex-col gap-1.5 flex-1">
                                <label class="text-[14px] font-bold text-ink">GBE 이메일 (아이디)</label>
                                <input type="text" value="${currentUser}" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary transition-colors bg-surface-soft text-ink/60" readonly>
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
                        
                        ${availableRoles.length > 0 ? `
                        <div class="mt-4 flex gap-2">
                            <select id="pmRoleRequestSelect" class="border border-gray-300 rounded-lg px-3 py-1.5 text-[14px] focus:border-primary focus:outline-none flex-1">
                                <option value="">추가 권한 신청하기...</option>
                                ${availableRoles.map(r => `<option value="${r}">${r}</option>`).join('')}
                            </select>
                            <button id="pmRequestRoleBtn" class="bg-ink text-white px-4 py-1.5 rounded-lg text-[14px] font-bold hover:bg-ink/80 transition-colors">신청</button>
                        </div>
                        ` : `<div class="mt-4 text-[13px] text-ink/60">모든 권한을 보유하고 있습니다.</div>`}
                    </div>
                </section>



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

    // NEIS 학교 자동완성 초기화 (school-search.js가 로드된 경우에만)
    if (window.EF_SCHOOL) {
        EF_SCHOOL.initSchoolSearch('pmOrgInput', 'pmOrgSchoolCode');
    }

    const overlay = document.getElementById('profileModalOverlay');
    const closeBtn = document.getElementById('pmCloseBtn');
    const saveBtn = document.getElementById('pmSaveCloseBtn');
    const requestBtn = document.getElementById('pmRequestRoleBtn');
    const roleSelect = document.getElementById('pmRoleRequestSelect');

    // 5. Override Dropdown '프로필 설정' links to open modal
    const profileLinks = document.querySelectorAll('a[href="공통_프로필수정.html"]');
    profileLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            overlay.classList.add('active');
            
            // Hide the dropdown menu when modal opens
            const profileMenu = document.querySelector('.profile-dropdown-menu');
            if(profileMenu) {
                profileMenu.style.opacity = '0';
                profileMenu.style.visibility = 'hidden';
            }
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
                showToast('이미 보유한 권한입니다.', 'danger');
                return;
            }
            
            // Check if already requested
            const alreadyRequested = pendingRequests.some(r => r.email === currentUser && r.requestedRole === requestedRole);
            if (alreadyRequested) {
                showToast('이미 승인 대기 중인 권한입니다.', 'danger');
                return;
            }
            
            const req = { email: currentUser, requestedRole, id: Date.now() };
            pendingRequests.push(req);
            localStorage.setItem('roleRequests', JSON.stringify(pendingRequests));
            showToast('권한 신청이 완료되었습니다.');
            
            // Update DOM instead of reloading
            const pendingContainer = document.getElementById('pmPendingRolesContainer');
            if (pendingContainer) {
                pendingContainer.insertAdjacentHTML('beforeend', `
                    <p class="text-[13px] text-ink/60 mt-1 flex items-center gap-1">
                        <span class="material-symbols-outlined text-[16px] text-orange-500">pending</span> 
                        <strong>'${requestedRole}'</strong> 권한 승인 대기 중입니다.
                    </p>
                `);
            }
            
            const optionToRemove = roleSelect.querySelector(`option[value="${requestedRole}"]`);
            if (optionToRemove) optionToRemove.remove();
            
            roleSelect.value = '';
        });
    }
})();
