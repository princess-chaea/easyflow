
    // 이지플로우 커스텀: 캘린더 일정 클릭 시 상세 모달 띄우기
    document.addEventListener('DOMContentLoaded', () => {
        const body = document.body;
        // 일정 요소들에 클릭 이벤트 위임 (예: bg-primary/5, bg-success/5 등 일정 박스들)
        body.addEventListener('click', (e) => {
            const eventBox = e.target.closest('.cursor-pointer.rounded-xl.border-l-4');
            if (eventBox && !eventBox.closest('#eventDetailModal') && !eventBox.closest('#eventModal')) {
                // 이벤트 박스를 클릭했을 때 모달 열기
                const modal = document.getElementById('eventDetailModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    // 애니메이션 효과 적용
                    const content = modal.querySelector('.anim-pop');
                    if (content) {
                        content.style.transform = 'scale(0.95)';
                        content.style.opacity = '0';
                        setTimeout(() => {
                            content.style.transition = 'all 0.2s ease-out';
                            content.style.transform = 'scale(1)';
                            content.style.opacity = '1';
                        }, 10);
                    }
                }
            }
        });
    });

    /* ── 구글 캘린더 연동 설정 모달 (gcalModal) ── */
    function gcalShowState(id) {
        document.querySelectorAll('#gcalModal > div > section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    }
    function devShowState(id) { gcalShowState(id); }

    function openPermissionModal(mode) {
        const granted = confirm('이지플로우가 다음 권한에 접근하도록 허용하시겠습니까?\n\n· Google 캘린더 읽기\n· Google 캘린더 쓰기\n\n허용을 누르면 계정이 연동됩니다.');
        if (!granted) {
            gcalShowState('stateError');
            return;
        }
        document.getElementById('connectedAccount').textContent = 'yourschool@gedu.kr 계정과 연결됨';
        document.getElementById('lastSyncText').textContent = '마지막 동기화: 방금 전';
        gcalShowState('stateConnected');
        toast(mode === 'reauth' ? '재인증이 완료되어 동기화를 다시 시작합니다' : '구글 계정 연동이 완료되었습니다', 'check_circle');
    }

    function changeAccount() {
        if (!confirm('연결된 계정을 해제하고 다른 계정으로 다시 연동하시겠습니까?')) return;
        gcalShowState('stateDisconnected');
        toast('계정 연결을 해제했습니다. 새 계정으로 연동해 주세요', 'swap_horiz');
    }

    function disconnect() {
        if (!confirm('구글 캘린더 연동을 해제하시겠습니까? 지금까지 동기화된 일정은 구글 캘린더에 남아 있습니다.')) return;
        gcalShowState('stateDisconnected');
        toast('구글 캘린더 연동을 해제했습니다', 'link_off');
    }

    function toggleSync(btn) {
        const on = btn.getAttribute('aria-checked') === 'true';
        const next = !on;
        btn.setAttribute('aria-checked', String(next));
        btn.classList.toggle('bg-primary', next);
        btn.classList.toggle('bg-outline-variant', !next);
        const thumb = btn.querySelector('.toggle-thumb');
        thumb.classList.toggle('translate-x-5', next);
        thumb.classList.toggle('translate-x-0', !next);
    }

    function syncNow() {
        const btn = document.getElementById('syncNowBtn');
        const icon = btn.querySelector('.material-symbols-outlined');
        icon.classList.add('animate-spin');
        setTimeout(() => {
            icon.classList.remove('animate-spin');
            document.getElementById('lastSyncText').textContent = '마지막 동기화: 방금 전';
            toast('구글 캘린더로 동기화를 완료했습니다', 'sync');
        }, 600);
    }

    function showToast() {
        toast('연동 설정을 저장했습니다', 'check_circle');
    }

    /* ── Outlook 연동 모달 스크립트 ── */
function outlookShowState(id) {
        document.querySelectorAll('#outlookModal > div > section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    }
    function devOutlookShowState(id) { outlookShowState(id); }

    function openOutlookPermissionModal(mode) {
        const granted = confirm('이지플로우가 다음 권한에 접근하도록 허용하시겠습니까?\n\n· Outlook 캘린더 읽기\n· Outlook 캘린더 쓰기\n\n허용을 누르면 계정이 연동됩니다.');
        if (!granted) {
            outlookShowState('outlookStateError');
            return;
        }
        document.getElementById('outlookConnectedAccount').textContent = 'yourschool@outlook.kr 계정과 연결됨';
        document.getElementById('outlookLastSyncText').textContent = '마지막 동기화: 방금 전';
        outlookShowState('outlookStateConnected');
        toast(mode === 'reauth' ? '재인증이 완료되어 동기화를 다시 시작합니다' : 'Microsoft 계정 연동이 완료되었습니다', 'check_circle');
    }

    function changeOutlookAccount() {
        if (!confirm('연결된 계정을 해제하고 다른 계정으로 다시 연동하시겠습니까?')) return;
        outlookShowState('outlookStateDisconnected');
        toast('계정 연결을 해제했습니다. 새 계정으로 연동해 주세요', 'swap_horiz');
    }

    function disconnectOutlook() {
        if (!confirm('Outlook 캘린더 연동을 해제하시겠습니까? 지금까지 동기화된 일정은 Outlook 캘린더에 남아 있습니다.')) return;
        outlookShowState('outlookStateDisconnected');
        toast('Outlook 캘린더 연동을 해제했습니다', 'link_off');
    }

    function toggleOutlookSync(btn) {
        const on = btn.getAttribute('aria-checked') === 'true';
        const next = !on;
        btn.setAttribute('aria-checked', String(next));
        btn.classList.toggle('bg-primary', next);
        btn.classList.toggle('bg-outline-variant', !next);
        const thumb = btn.querySelector('.toggle-thumb');
        thumb.classList.toggle('translate-x-5', next);
        thumb.classList.toggle('translate-x-0', !next);
    }

    function syncOutlookNow() {
        const btn = document.getElementById('syncOutlookNowBtn');
        const icon = btn.querySelector('.material-symbols-outlined');
        icon.classList.add('animate-spin');
        setTimeout(() => {
            icon.classList.remove('animate-spin');
            document.getElementById('outlookLastSyncText').textContent = '마지막 동기화: 방금 전';
            toast('Outlook 캘린더로 동기화를 완료했습니다', 'sync');
        }, 600);
    }

    function showOutlookToast() {
        toast('연동 설정을 저장했습니다', 'check_circle');
    }
