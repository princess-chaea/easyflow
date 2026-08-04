/**
 * EF_MODAL — 사이트 전체에서 쓰는 공용 확인/알림 모달.
 * 네이티브 confirm()/alert()를 대체하며, 의도(확인·삭제 등) 버튼은 왼쪽,
 * 취소 버튼은 오른쪽에 오도록 통일한다.
 *   EF_MODAL.confirm(message, { confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 *   EF_MODAL.alert(message, { confirmLabel }) -> Promise<void>
 */
const EF_MODAL = (function () {
    let el = null;

    // 네이티브 <dialog> + showModal()로 구현 — 브라우저의 top-layer에 뜨기 때문에
    // 이미 열려 있는 다른 <dialog>(구글/아웃룩 연동 모달 등) 위에도 항상 정상적으로 표시된다.
    function ensure() {
        if (el || !document.body) return el;
        el = document.createElement('dialog');
        el.id = 'ef-modal-root';
        el.className = 'rounded-2xl shadow-2xl border-0 p-0 w-[90vw] max-w-[380px] backdrop:bg-black/40 backdrop:backdrop-blur-sm';
        el.innerHTML = [
            '<div class="p-lg flex flex-col gap-lg animate-fade-in-up">',
            '<p class="text-[15px] text-ink leading-relaxed whitespace-pre-line" data-ef-message></p>',
            '<div class="flex items-center gap-xs" data-ef-actions>',
            '<button type="button" class="flex-1 px-lg py-sm rounded-xl font-bold text-[14px] transition-colors text-white" data-ef-confirm></button>',
            '<button type="button" class="flex-1 px-lg py-sm rounded-xl font-bold text-[14px] bg-surface-strong text-ink hover:bg-hairline transition-colors" data-ef-cancel>취소</button>',
            '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(el);
        if (!document.getElementById('ef-modal-style')) {
            const style = document.createElement('style');
            style.id = 'ef-modal-style';
            style.textContent = '@keyframes efModalFadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}#ef-modal-root{margin:auto}#ef-modal-root .animate-fade-in-up{animation:efModalFadeInUp .2s ease-out forwards}';
            document.head.appendChild(style);
        }
        return el;
    }

    function open(message, { confirmLabel = '확인', cancelLabel = '취소', danger = false, showCancel = true } = {}) {
        return new Promise(resolve => {
            const root = ensure();
            if (!root) { resolve(true); return; } // body 없는 극단적 상황 대비 폴백

            root.querySelector('[data-ef-message]').textContent = message;
            const confirmBtn = root.querySelector('[data-ef-confirm]');
            const cancelBtn = root.querySelector('[data-ef-cancel]');
            confirmBtn.textContent = confirmLabel;
            confirmBtn.className = 'flex-1 px-lg py-sm rounded-xl font-bold text-[14px] transition-colors text-white ' + (danger ? 'bg-danger hover:opacity-90' : 'bg-primary hover:bg-primary-active');
            cancelBtn.textContent = cancelLabel;
            cancelBtn.classList.toggle('hidden', !showCancel);

            const onConfirm = () => root.close('confirm');
            const onCancel = () => root.close('cancel');
            const onBackdrop = (e) => { if (e.target === root) onCancel(); }; // dialog 바깥(backdrop) 클릭 감지
            const onClose = () => {
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                root.removeEventListener('click', onBackdrop);
                root.removeEventListener('close', onClose);
                resolve(root.returnValue === 'confirm');
            };

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            root.addEventListener('click', onBackdrop);
            root.addEventListener('close', onClose);

            root.returnValue = ''; // ESC로 닫히면(cancel 이벤트) returnValue가 갱신되지 않으므로 매번 초기화
            root.showModal();
        });
    }

    return {
        confirm(message, opts) { return open(message, { ...opts, showCancel: true }); },
        alert(message, opts) { return open(message, { ...opts, showCancel: false }); },
    };
})();
window.EF_MODAL = EF_MODAL;

/**
 * EF_ROLE — 사이트 전체 역할(권한) 판정.
 * currentRole(로그인 시 부여된 기본 역할) + grantedRoles_<email>(서버관리자_역할관리.html에서
 * 승인된 추가 역할)을 합산해 "이 세션이 실질적으로 가진 역할 목록"을 계산한다.
 * 파일마다 '서버관리자'/'서버 관리자'처럼 공백 표기가 달라 항상 공백을 제거하고 비교한다.
 */
const EF_ROLE = {
    _norm(r) { return String(r || '').replace(/\s+/g, ''); },
    effective() {
        const email = localStorage.getItem('currentUser');
        const base = localStorage.getItem('currentRole');
        let granted = [];
        if (email) {
            try { granted = JSON.parse(localStorage.getItem('grantedRoles_' + email)) || []; } catch (e) { granted = []; }
        }
        return [base, '교직원', ...granted].filter(Boolean).map(this._norm);
    },
    is(...roles) {
        const eff = this.effective();
        return roles.some(r => eff.includes(this._norm(r)));
    },
};
window.EF_ROLE = EF_ROLE;

// 역할 제한이 필요한 페이지 — 직접 URL로 접근해도 막는다 (서버관리자는 모든 화면에 접근 가능한 최상위 권한)
const PAGE_ROLE_REQUIREMENTS = {
    '서버관리자_대시보드.html': ['서버관리자'],
    '서버관리자_회원관리.html': ['서버관리자'],
    '서버관리자_역할관리.html': ['서버관리자'],
    '서버관리자_RAG데이터관리.html': ['서버관리자'],
    '서버관리자_리소스 모니터링.html': ['서버관리자'],
    '서버관리자_보안설정.html': ['서버관리자'],
    '서버관리자_푸터관리.html': ['서버관리자'],
    '학교관리자_대시보드.html': ['학교관리자', '서버관리자'],
    '학교관리자_RAG데이터갱신.html': ['학교관리자', '서버관리자'],
    '학교관리자_데이터 리포트.html': ['학교관리자', '서버관리자'],
    '학교관리자_학교통합관리.html': ['학교관리자', '서버관리자'],
    '인생도서관_멘토상담함.html': ['멘토', '서버관리자'],
    '인생도서관_장학사 및 업무담당자 통합 대시보드.html': ['장학사', '업무배송 담당자', '서버관리자'],
    '업무배송_업무발송.html': ['업무배송 담당자', '서버관리자'],
    '안내센터_1대1문의관리.html': ['장학사', '멘토', '서버관리자'],
};
// 역할별로 숨겨야 하는 GNB/LNB 링크 — href 기준으로 페이지 내 모든 위치를 한 번에 처리
const ROLE_GATED_LINKS = [
    { href: '서버관리자_대시보드.html', roles: ['서버관리자'] },
    { href: '학교관리자_대시보드.html', roles: ['학교관리자'] },
    { href: '업무배송_업무발송.html', roles: ['업무배송 담당자'] },
    { href: '인생도서관_멘토상담함.html', roles: ['멘토'] },
    { href: '인생도서관_장학사 및 업무담당자 통합 대시보드.html', roles: ['장학사', '업무배송 담당자'] },
    { href: '안내센터_1대1문의관리.html', roles: ['장학사', '멘토'] },
];

(function() {
    const currentPath = decodeURIComponent(window.location.pathname);
    const isLoginPage = currentPath.includes('공통_로그인.html');
    const isSignupPage = currentPath.includes('공통_회원가입.html');

    const currentUser = localStorage.getItem('currentUser');

    // 1. Session check
    if (!currentUser && !isLoginPage && !isSignupPage) {
        window.location.href = '공통_로그인.html';
        return;
    }

    if (currentUser && isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    // 1-2. 역할 제한 페이지 직접 접근 차단
    if (currentUser) {
        const requiredPage = Object.keys(PAGE_ROLE_REQUIREMENTS).find(page => currentPath.includes(page));
        if (requiredPage && !EF_ROLE.is(...PAGE_ROLE_REQUIREMENTS[requiredPage])) {
            sessionStorage.setItem('ef_accessDenied', '이 페이지는 ' + PAGE_ROLE_REQUIREMENTS[requiredPage].join('/') + ' 권한이 있어야 접근할 수 있습니다.');
            window.location.href = 'index.html';
            return;
        }
    }

    // 2. Setup RBAC on page load (Wait for DOM)
    document.addEventListener('DOMContentLoaded', () => {
        if (!currentUser) return;

        // 권한 없는 페이지로 접근을 시도해 index.html로 돌아온 경우 안내
        const deniedMsg = sessionStorage.getItem('ef_accessDenied');
        if (deniedMsg) {
            sessionStorage.removeItem('ef_accessDenied');
            EF_MODAL.alert(deniedMsg);
        }

        // Apply RBAC to Header Menus if they exist

        // 2-1. 역할별 GNB/LNB 링크 숨김
        ROLE_GATED_LINKS.forEach(({ href, roles }) => {
            if (EF_ROLE.is('서버관리자', ...roles)) return;
            document.querySelectorAll('a[href="' + href + '"]').forEach(a => { a.style.display = 'none'; });
        });

        const adminMenuHeader = Array.from(document.querySelectorAll('.px-base.py-1')).find(el => el.textContent.includes('관리자 메뉴'));

        // Hide "관리자 메뉴" separator if neither is visible
        if (adminMenuHeader && !EF_ROLE.is('서버관리자', '학교관리자')) {
            adminMenuHeader.style.display = 'none';
            // Also hide the border line above it if possible
            const borderLine = adminMenuHeader.previousElementSibling;
            if (borderLine && borderLine.classList.contains('border-t')) {
                borderLine.style.display = 'none';
            }
        }

        // 2-3. Logout — 확인 모달에서 확정된 경우에만 스토리지를 비우고 로그인 페이지로 명시적으로 이동.
        // (이전에는 confirm()의 inline onclick과 별도의 addEventListener로 나뉘어 있어,
        //  취소를 눌러도 addEventListener가 항상 실행되어 currentUser가 지워지는 버그가 있었음)
        const logoutLinks = document.querySelectorAll('a[href="공통_로그인.html"]');
        logoutLinks.forEach(link => {
            if (link.innerText.includes('로그아웃')) {
                link.removeAttribute('onclick');
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    EF_MODAL.confirm('로그아웃 하시겠습니까?', { confirmLabel: '로그아웃', danger: true }).then(ok => {
                        if (!ok) return;
                        localStorage.removeItem('currentUser');
                        localStorage.removeItem('currentRole');
                        window.location.href = '공통_로그인.html';
                    });
                });
            }
        });

        // Profile Dropdown Click Toggle
        const profileTrigger = document.querySelector('.profile-dropdown-trigger');
        const profileMenu = document.querySelector('.profile-dropdown-menu');
        if (profileTrigger && profileMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = profileMenu.style.opacity === '1';
                if (isVisible) {
                    profileMenu.style.opacity = '0';
                    profileMenu.style.visibility = 'hidden';
                } else {
                    profileMenu.style.opacity = '1';
                    profileMenu.style.visibility = 'visible';
                }
            });
            
            document.addEventListener('click', (e) => {
                if (!profileTrigger.contains(e.target) && !profileMenu.contains(e.target)) {
                    profileMenu.style.opacity = '0';
                    profileMenu.style.visibility = 'hidden';
                }
            });
        }

        // Load School Search Script (NEIS API)
        const ssScript = document.createElement('script');
        ssScript.src = 'assets/js/school-search.js';
        document.body.appendChild(ssScript);

        // Load Profile Modal Script dynamically (after school-search)
        ssScript.onload = () => {
            const pmScript = document.createElement('script');
            pmScript.src = 'assets/js/profile-modal.js';
            document.body.appendChild(pmScript);
        };
        // Fallback if school-search.js already loaded
        ssScript.onerror = () => {
            const pmScript = document.createElement('script');
            pmScript.src = 'assets/js/profile-modal.js';
            document.body.appendChild(pmScript);
        };
        
    });
})();
