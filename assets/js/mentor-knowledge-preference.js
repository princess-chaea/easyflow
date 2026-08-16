(function () {
    'use strict';

    const STORAGE_KEY = 'ef_mentoring_knowledge_preferences';
    const messageList = document.getElementById('maMessageList');
    const originalOpen = window.openMentorAnswerModal;
    if (!messageList || typeof originalOpen !== 'function') return;

    let activeThreadId = null;
    const panel = createPanel();
    messageList.insertAdjacentElement('afterend', panel.root);

    window.openMentorAnswerModal = function (id) {
        activeThreadId = id;
        originalOpen(id);
        renderPreference();
    };

    window.EF_MENTOR_KNOWLEDGE_PREFS = {
        all: loadPreferences,
        get: getPreference
    };

    function createPanel() {
        const root = document.createElement('section');
        root.id = 'maKnowledgePreference';
        root.className = 'rounded-xl border border-hairline bg-surface-soft/60 px-md py-sm';
        root.setAttribute('aria-labelledby', 'maKnowledgePreferenceTitle');

        const header = document.createElement('div');
        header.className = 'flex flex-wrap items-center justify-between gap-xs';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'flex items-center gap-xs';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[18px] text-primary';
        icon.textContent = 'privacy_tip';
        const title = document.createElement('h4');
        title.id = 'maKnowledgePreferenceTitle';
        title.className = 'text-[13px] font-bold text-ink';
        title.textContent = 'AI 지식 개선 활용';
        titleWrap.append(icon, title);

        const status = document.createElement('span');
        status.id = 'maKnowledgePreferenceStatus';
        status.className = 'text-[11px] font-bold rounded-full px-sm py-1';
        header.append(titleWrap, status);

        const description = document.createElement('p');
        description.className = 'text-[11px] text-ink/55 leading-relaxed mt-xs';
        description.textContent = '기본값은 반영 안 함입니다. 요청하더라도 대화 원문은 사용하지 않고, 개인정보를 제거한 상담 요약만 관리자 검토 대상으로 표시합니다.';

        const actions = document.createElement('div');
        actions.className = 'grid grid-cols-1 sm:grid-cols-2 gap-xs mt-sm';
        const excludeButton = preferenceButton('block', '반영 안 함');
        const requestButton = preferenceButton('fact_check', '익명화 요약 검토 요청');
        excludeButton.id = 'maKnowledgeExcludeBtn';
        requestButton.id = 'maKnowledgeRequestBtn';
        excludeButton.addEventListener('click', excludeFromKnowledgeUse);
        requestButton.addEventListener('click', requestKnowledgeReview);
        actions.append(excludeButton, requestButton);

        root.append(header, description, actions);
        return { root, status, excludeButton, requestButton };
    }

    function preferenceButton(iconName, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'min-h-[36px] px-sm py-xs rounded-lg border text-[12px] font-bold transition-colors flex items-center justify-center gap-1';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[16px]';
        icon.textContent = iconName;
        button.append(icon, document.createTextNode(label));
        return button;
    }

    function loadPreferences() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch (error) {
            console.warn('상담 지식 활용 설정을 읽지 못했습니다.', error);
            return {};
        }
    }

    function getPreference(threadId) {
        const saved = loadPreferences()[String(threadId)];
        if (saved && (saved.status === 'excluded' || saved.status === 'review_requested')) return saved;
        return {
            threadId,
            status: 'excluded',
            scope: 'none',
            explicit: false,
            decidedBy: '',
            decidedAt: ''
        };
    }

    function savePreference(status) {
        if (activeThreadId === null) return null;
        const preferences = loadPreferences();
        const entry = {
            threadId: activeThreadId,
            status,
            scope: status === 'review_requested' ? 'anonymized_summary_only' : 'none',
            explicit: true,
            decidedBy: localStorage.getItem('currentUser') || '',
            decidedAt: new Date().toISOString()
        };
        preferences[String(activeThreadId)] = entry;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        renderPreference();
        return entry;
    }

    function excludeFromKnowledgeUse() {
        savePreference('excluded');
        showNotice('이 대화는 AI 지식 개선에 반영하지 않습니다.');
    }

    async function requestKnowledgeReview() {
        const confirmed = await EF_MODAL.confirm(
            '대화 원문은 사용하지 않고 개인정보를 제거한 상담 요약만 관리자 검토 대상으로 표시합니다. 계속할까요?',
            { confirmLabel: '검토 요청', cancelLabel: '취소' }
        );
        if (!confirmed) return;
        savePreference('review_requested');
        showNotice('익명화 요약의 지식 개선 검토를 요청했습니다.');
    }

    function renderPreference() {
        if (activeThreadId === null) return;
        const preference = getPreference(activeThreadId);
        const requested = preference.status === 'review_requested';

        panel.status.textContent = requested ? '검토 요청됨' : (preference.explicit ? '반영 안 함' : '반영 안 함 · 기본');
        panel.status.className = 'text-[11px] font-bold rounded-full px-sm py-1 ' +
            (requested ? 'bg-primary/10 text-primary' : 'bg-surface-strong text-ink/60');

        setButtonState(panel.excludeButton, !requested, false);
        setButtonState(panel.requestButton, requested, true);
    }

    function setButtonState(button, active, primary) {
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('bg-primary', active && primary);
        button.classList.toggle('text-white', active && primary);
        button.classList.toggle('border-primary', active);
        button.classList.toggle('bg-white', active && !primary);
        button.classList.toggle('text-ink', active && !primary);
        button.classList.toggle('border-hairline', !active);
        button.classList.toggle('text-ink/55', !active);
        button.classList.toggle('hover:border-primary/40', !active);
    }

    function showNotice(message) {
        if (window.EF_MODAL && typeof window.EF_MODAL.alert === 'function') {
            window.EF_MODAL.alert(message);
            return;
        }
        if (typeof EF_MODAL !== 'undefined' && typeof EF_MODAL.alert === 'function') EF_MODAL.alert(message);
    }
})();
