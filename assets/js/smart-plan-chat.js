(function () {
    'use strict';

    const pageHeader = document.querySelector('.page-header');
    const demo = document.getElementById('document-agent-demo');
    const agentPrompt = document.getElementById('agent-prompt');
    if (!pageHeader || !demo || !agentPrompt) return;

    const state = { mode: 'edit', busy: false };
    const ui = createChatCard();
    pageHeader.insertAdjacentElement('afterend', ui.root);

    ui.planMode.addEventListener('click', function () { changeMode('plan'); });
    ui.editMode.addEventListener('click', function () { changeMode('edit'); });
    ui.form.addEventListener('submit', sendMessage);
    renderQuickPrompts();
    appendAssistant('현재 계획에서 바꾸고 싶은 내용과 반드시 유지할 부분을 함께 적어주세요. 요청을 아래 수정 검토 흐름으로 안전하게 옮겨드립니다.');

    function createChatCard() {
        const root = document.createElement('section');
        root.id = 'smartPlanChat';
        root.className = 'card';
        root.setAttribute('aria-labelledby', 'smartPlanChatTitle');
        root.style.marginBottom = '20px';

        const header = document.createElement('div');
        header.className = 'flex flex-col lg:flex-row lg:items-start lg:justify-between gap-base';
        const titleWrap = document.createElement('div');
        const eyebrow = document.createElement('div');
        eyebrow.className = 'flex items-center gap-xs mb-xs';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-primary text-[21px]';
        icon.textContent = 'forum';
        const title = document.createElement('h2');
        title.id = 'smartPlanChatTitle';
        title.className = 'text-[20px] font-extrabold text-ink';
        title.textContent = '계획서 AI 도우미';
        eyebrow.append(icon, title);
        const description = document.createElement('p');
        description.className = 'text-[13px] text-ink/60 leading-relaxed';
        description.textContent = '대화로 계획의 뼈대를 잡거나, 기존 계획서에서 바꿀 내용을 요청할 수 있습니다.';
        titleWrap.append(eyebrow, description);

        const status = document.createElement('span');
        status.id = 'smartPlanChatStatus';
        status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-warning/10 text-warning self-start';
        status.textContent = window.location.protocol === 'file:' ? 'AI 서버 연결 전' : 'AI 요청 준비';
        header.append(titleWrap, status);

        const modes = document.createElement('div');
        modes.className = 'grid grid-cols-2 gap-1 rounded-xl bg-surface-soft border border-hairline p-1 mt-base';
        modes.setAttribute('role', 'tablist');
        modes.setAttribute('aria-label', '계획서 도우미 작업');
        const planMode = modeButton('add_notes', 'plan', '새 계획 만들기');
        const editMode = modeButton('edit_note', 'edit', '현재 계획 수정');
        modes.append(planMode, editMode);

        const conversation = document.createElement('div');
        conversation.id = 'smartPlanChatMessages';
        conversation.className = 'mt-base rounded-2xl bg-surface-soft/70 border border-hairline p-md min-h-[180px] max-h-[340px] overflow-y-auto flex flex-col gap-sm';
        conversation.setAttribute('aria-live', 'polite');

        const quickPrompts = document.createElement('div');
        quickPrompts.id = 'smartPlanQuickPrompts';
        quickPrompts.className = 'flex flex-wrap gap-xs mt-sm';

        const form = document.createElement('form');
        form.className = 'mt-sm flex flex-col sm:flex-row gap-xs items-stretch sm:items-end';
        const inputWrap = document.createElement('label');
        inputWrap.className = 'flex-1';
        const inputLabel = document.createElement('span');
        inputLabel.className = 'sr-only';
        inputLabel.textContent = '계획서 도우미에게 요청';
        const input = document.createElement('textarea');
        input.id = 'smartPlanChatInput';
        input.rows = 3;
        input.className = 'w-full border border-gray-300 rounded-xl px-md py-sm text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none';
        input.placeholder = '예: 연수 목적과 대상을 정리하고, 2026년 7월 일정으로 수정해 줘.';
        inputWrap.append(inputLabel, input);

        const send = document.createElement('button');
        send.id = 'smartPlanChatSend';
        send.type = 'submit';
        send.className = 'min-h-[44px] px-lg rounded-xl bg-primary text-white text-[14px] font-bold hover:bg-primary-active disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-xs';
        const sendIcon = document.createElement('span');
        sendIcon.className = 'material-symbols-outlined text-[18px]';
        sendIcon.textContent = 'send';
        send.append(sendIcon, document.createTextNode('보내기'));
        form.append(inputWrap, send);

        const privacy = document.createElement('p');
        privacy.className = 'text-[11px] text-ink/45 mt-xs flex items-start gap-1';
        const privacyIcon = document.createElement('span');
        privacyIcon.className = 'material-symbols-outlined text-[14px] mt-[1px]';
        privacyIcon.textContent = 'shield_lock';
        privacy.append(privacyIcon, document.createTextNode('실제 연동 시에도 선택한 요청과 필요한 문서 문맥만 전송하며, 전체 문서를 기본 전송하지 않습니다.'));

        root.append(header, modes, conversation, quickPrompts, form, privacy);
        return { root, status, planMode, editMode, conversation, quickPrompts, form, input, send };
    }

    function modeButton(iconName, mode, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.chatMode = mode;
        button.className = 'min-h-[40px] px-sm rounded-lg text-[13px] font-bold flex items-center justify-center gap-xs transition-colors';
        button.setAttribute('role', 'tab');
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[17px]';
        icon.textContent = iconName;
        button.append(icon, document.createTextNode(label));
        return button;
    }

    function changeMode(mode) {
        if (state.mode === mode) return;
        state.mode = mode;
        styleModes();
        renderQuickPrompts();
        if (mode === 'plan') {
            ui.input.placeholder = '예: 교직원 대상 AI 활용 연수 계획을 만들고 싶어. 7월 중 2시간, 실습 중심으로 구성해 줘.';
            appendAssistant('새 계획의 목적, 대상, 일정, 장소와 주요 활동을 알려주세요. 빠진 항목을 확인하고 초안 생성 요청으로 정리합니다.');
        } else {
            ui.input.placeholder = '예: 2025학년도를 2026학년도로 바꾸고, 표와 서식은 유지해 줘.';
            appendAssistant('현재 계획에서 바꿀 내용과 유지할 부분을 알려주세요. 요청을 기존 수정 검토 흐름으로 옮깁니다.');
        }
        ui.input.focus();
    }

    function styleModes() {
        [ui.planMode, ui.editMode].forEach(function (button) {
            const active = button.dataset.chatMode === state.mode;
            button.setAttribute('aria-selected', String(active));
            button.classList.toggle('bg-white', active);
            button.classList.toggle('text-primary', active);
            button.classList.toggle('shadow-sm', active);
            button.classList.toggle('text-ink/55', !active);
            button.classList.toggle('hover:text-ink', !active);
        });
    }

    function renderQuickPrompts() {
        styleModes();
        ui.quickPrompts.replaceChildren();
        const prompts = state.mode === 'plan'
            ? ['교직원 연수 계획의 뼈대를 잡아줘', '목적·대상·일정·주요 활동을 점검해줘', '예산과 준비물 항목도 포함해줘']
            : ['2025학년도를 2026학년도로 바꿔줘', '연수 일시와 주요 내용만 수정해줘', '표와 나머지 서식은 그대로 유지해줘'];
        prompts.forEach(function (prompt) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'px-sm py-1 rounded-full border border-hairline bg-white text-[12px] text-ink/65 hover:border-primary hover:text-primary transition-colors';
            button.textContent = prompt;
            button.addEventListener('click', function () {
                ui.input.value = prompt;
                ui.input.focus();
            });
            ui.quickPrompts.appendChild(button);
        });
    }

    async function sendMessage(event) {
        event.preventDefault();
        if (state.busy) return;
        const message = ui.input.value.trim();
        if (!message) {
            if (window.EF_MODAL) window.EF_MODAL.alert('계획서에 요청할 내용을 입력해 주세요.');
            return;
        }
        appendUser(message);
        ui.input.value = '';
        setBusy(true);
        try {
            if (window.location.protocol === 'file:') throw new Error('LOCAL_PREVIEW');
            const response = await fetch('/api/documents/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent: state.mode,
                    message,
                    documentContext: state.mode === 'edit' ? {
                        documentId: 'current-or-selected-document',
                        inputScope: 'selected_context_only'
                    } : null
                })
            });
            if (!response.ok) throw new Error('HTTP_' + response.status);
            const payload = await response.json();
            if (!payload || !payload.data || typeof payload.data.reply !== 'string') throw new Error('INVALID_RESPONSE');
            if (payload.data.proposedInstruction) moveToEditRequest(payload.data.proposedInstruction, false);
            appendAssistant(payload.data.reply, payload.data.proposedInstruction ? createMoveAction(payload.data.proposedInstruction) : null);
            ui.status.textContent = 'AI 응답 완료';
            ui.status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-success/10 text-success self-start';
        } catch (error) {
            handleOfflineRequest(message, error);
        } finally {
            setBusy(false);
        }
    }

    function handleOfflineRequest(message, error) {
        ui.status.textContent = 'AI 서버 연결 필요';
        ui.status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-warning/10 text-warning self-start';
        if (state.mode === 'edit') {
            moveToEditRequest(message, false);
            appendAssistant('요청을 아래 “바꿀 내용” 입력란에 옮겼습니다. 실제 AI 분석 대신 예시 문서의 변경 검토 흐름을 사용할 수 있습니다.', createMoveAction(message));
        } else {
            sessionStorage.setItem('ef_smart_plan_brief', message);
            appendAssistant('새 계획 요청을 임시 보관했습니다. 초안 생성 서버가 연결되기 전에는 내용을 임의로 만들지 않습니다. 목적·대상·일정·주요 활동을 포함했는지 확인해 주세요.', createMoveAction(message));
        }
        if (error && error.message !== 'LOCAL_PREVIEW') console.warn('계획서 도우미 요청 실패', error);
    }

    function moveToEditRequest(message, scroll) {
        agentPrompt.value = message;
        agentPrompt.dispatchEvent(new Event('input', { bubbles: true }));
        if (scroll) {
            demo.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const detect = document.getElementById('btn-agent-detect');
            if (detect && document.getElementById('agent-detected').style.display === 'none') detect.click();
            setTimeout(function () { agentPrompt.focus({ preventScroll: true }); }, 650);
        }
    }

    function createMoveAction(message) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mt-xs px-sm py-1 rounded-full bg-white border border-primary/20 text-primary text-[12px] font-bold hover:bg-primary/5';
        button.textContent = '수정 검토 흐름으로 이동';
        button.addEventListener('click', function () { moveToEditRequest(message, true); });
        return button;
    }

    function appendAssistant(text, action) {
        appendMessage('assistant', text, action);
    }

    function appendUser(text) {
        appendMessage('user', text, null);
    }

    function appendMessage(role, text, action) {
        const row = document.createElement('div');
        row.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');
        const bubble = document.createElement('div');
        bubble.className = 'max-w-[88%] rounded-2xl px-md py-sm text-[13px] leading-relaxed ' +
            (role === 'user' ? 'bg-primary text-white rounded-br-md' : 'bg-white border border-hairline text-ink/75 rounded-bl-md');
        const message = document.createElement('p');
        message.className = 'whitespace-pre-line';
        message.textContent = text;
        bubble.appendChild(message);
        if (action) bubble.appendChild(action);
        row.appendChild(bubble);
        ui.conversation.appendChild(row);
        ui.conversation.scrollTop = ui.conversation.scrollHeight;
    }

    function setBusy(busy) {
        state.busy = busy;
        ui.send.disabled = busy;
        ui.input.disabled = busy;
        const icon = ui.send.querySelector('.material-symbols-outlined');
        icon.textContent = busy ? 'progress_activity' : 'send';
        icon.classList.toggle('animate-spin', busy);
    }
})();
