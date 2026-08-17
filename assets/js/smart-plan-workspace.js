(function () {
    'use strict';

    const header = document.querySelector('.page-header');
    const review = document.getElementById('document-agent-demo');
    const editor = document.getElementById('web-hwp-editor-card');

    if (!header || !editor) return;

    const STORAGE_KEY = 'ef_smart_plan_workspace';
    const saved = readState();
    const state = {
        mode: saved.mode === 'edit' ? 'edit' : 'plan',
        planNotes: Array.isArray(saved.planNotes) ? saved.planNotes.slice(-12) : [],
        conversationId: saved.conversationId || newConversationId(),
        busy: false
    };

    document.title = '스마트 계획서 | 이지플로우 (EasyFlow)';
    const heading = header.querySelector('h1');
    const lead = header.querySelector('p');
    if (heading) heading.textContent = '스마트 계획서';
    if (lead) lead.textContent = '왼쪽에서 한글 문서를 직접 편집하고, 오른쪽 AI와 계획을 세운 뒤 변경할 부분을 검토하세요.';

    injectStyles();
    const ui = createWorkspace();
    header.insertAdjacentElement('afterend', ui.root);
    if (review) {
        review.hidden = true;
        review.setAttribute('aria-hidden', 'true');
    }
    ui.left.append(editor);
    ui.right.append(ui.chat);
    ui.planButton.addEventListener('click', function () { setMode('plan'); });
    ui.editButton.addEventListener('click', function () { setMode('edit'); });
    ui.form.addEventListener('submit', submitMessage);
    renderMode();
    addMessage('assistant', '먼저 계획 모드에서 목적과 조건을 정리해 보세요. 같은 대화에서 수정 모드로 바꾸면 정리한 내용을 이어받아 변경 후보를 보여드립니다.');

    function createWorkspace() {
        const root = make('section', 'smart-plan-workspace');
        root.id = 'smartPlanWorkspace';
        const left = make('div', 'smart-plan-left');
        left.setAttribute('aria-label', '문서 편집 및 변경 검토');
        const right = make('aside', 'smart-plan-right');
        right.setAttribute('aria-label', '계획서 AI 대화');
        const chat = make('section', 'smart-plan-chat-card');
        chat.id = 'smartPlanChat';

        const chatHeader = make('div', 'smart-plan-chat-header');
        const titleGroup = make('div');
        const title = make('h2', '', '계획서 AI 도우미');
        const description = make('p', '', '계획 모드의 내용을 수정 모드에서도 그대로 이어서 사용합니다.');
        titleGroup.append(title, description);
        const status = make('span', 'smart-plan-status', location.protocol === 'file:' ? 'AI 서버 연결 전' : 'AI 요청 준비');
        chatHeader.append(titleGroup, status);

        const modes = make('div', 'smart-plan-modes');
        modes.setAttribute('role', 'tablist');
        modes.setAttribute('aria-label', '계획서 작업 모드');
        const planButton = modeButton('lightbulb', 'plan', '계획 모드');
        const editButton = modeButton('edit_note', 'edit', '수정 모드');
        modes.append(planButton, editButton);

        const context = make('div', 'smart-plan-context');
        context.id = 'smartPlanContext';
        const messages = make('div', 'smart-plan-messages');
        messages.id = 'smartPlanChatMessages';
        messages.setAttribute('aria-live', 'polite');
        const quick = make('div', 'smart-plan-quick-prompts');

        const form = document.createElement('form');
        form.className = 'smart-plan-form';
        const input = document.createElement('textarea');
        input.id = 'smartPlanChatInput';
        input.rows = 4;
        input.setAttribute('aria-label', '계획서 AI 도우미에게 요청');
        const send = document.createElement('button');
        send.type = 'submit';
        send.id = 'smartPlanChatSend';
        send.append(make('span', 'material-symbols-outlined', 'send'), document.createTextNode('보내기'));
        form.append(input, send);

        const privacy = make('p', 'smart-plan-privacy');
        privacy.append(make('span', 'material-symbols-outlined', 'shield_lock'), document.createTextNode('AI가 제안한 변경은 확인 전까지 문서에 반영하지 않습니다.'));
        chat.append(chatHeader, modes, context, messages, quick, form, privacy);
        root.append(left, right);
        return { root, left, right, chat, status, planButton, editButton, context, messages, quick, form, input, send };
    }

    function modeButton(icon, mode, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.chatMode = mode;
        button.setAttribute('role', 'tab');
        button.append(make('span', 'material-symbols-outlined', icon), document.createTextNode(label));
        return button;
    }

    function setMode(mode) {
        if (state.mode === mode) return;
        state.mode = mode;
        saveState();
        renderMode();
        ui.input.focus();
    }

    function renderMode() {
        [ui.planButton, ui.editButton].forEach(function (button) {
            const active = button.dataset.chatMode === state.mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        ui.context.replaceChildren();
        if (state.mode === 'plan') {
            ui.input.placeholder = '예: 교직원 대상 AI 활용 연수 계획을 만들고 싶어. 7월 중 2시간, 실습 중심으로 구성해 줘.';
            ui.context.append(make('strong', '', '계획 모드'), make('span', '', '목적·대상·일정·주요 활동을 대화로 정리합니다.'));
        } else {
            ui.input.placeholder = '예: 계획 모드에서 정리한 내용으로 본문을 수정하고, 표와 서식은 유지해 줘.';
            ui.context.append(make('strong', '', '수정 모드'), make('span', '', state.planNotes.length ? '계획 모드 메모 ' + state.planNotes.length + '개를 이어받았습니다.' : '계획 조건을 정리하거나 바로 수정 내용을 입력하세요.'));
        }
        renderQuickPrompts();
    }

    function renderQuickPrompts() {
        ui.quick.replaceChildren();
        const prompts = state.mode === 'plan'
            ? ['교직원 연수 계획의 뼈대를 잡아줘', '목적·대상·일정·주요 활동을 점검해줘', '예산과 준비물 항목도 포함해줘']
            : ['계획 내용으로 본문을 수정해줘', '연수 일시와 주요 내용만 수정해줘', '표와 나머지 서식은 유지해줘'];
        prompts.forEach(function (text) {
            const button = make('button', '', text);
            button.type = 'button';
            button.addEventListener('click', function () {
                ui.input.value = text;
                ui.input.focus();
            });
            ui.quick.append(button);
        });
    }

    async function submitMessage(event) {
        event.preventDefault();
        if (state.busy) return;
        const message = ui.input.value.trim();
        if (!message) {
            if (window.EF_MODAL) window.EF_MODAL.alert('계획서에 요청할 내용을 입력해 주세요.');
            return;
        }
        addMessage('user', message);
        ui.input.value = '';
        setBusy(true);
        try {
            if (location.protocol === 'file:') throw new Error('LOCAL_PREVIEW');
            const response = await fetch('/api/documents/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: state.conversationId,
                    intent: state.mode,
                    message: message,
                    planContext: state.planNotes,
                    documentContext: state.mode === 'edit' ? {
                        documentId: 'current-or-selected-document',
                        inputScope: 'selected_context_only'
                    } : null
                })
            });
            if (!response.ok) throw new Error('HTTP_' + response.status);
            const payload = await response.json();
            if (!payload || !payload.data || typeof payload.data.reply !== 'string') throw new Error('INVALID_RESPONSE');
            if (payload.data.conversationId) state.conversationId = payload.data.conversationId;
            if (state.mode === 'plan') rememberPlan(message);
            if (state.mode === 'edit' && payload.data.proposedInstruction) showCandidates(payload.data.proposedInstruction, payload.data.changes);
            saveState();
            addMessage('assistant', payload.data.reply);
            if (state.mode === 'edit' && Array.isArray(payload.data.changes)) showChangeNotice(payload.data.changes);
            setStatus('AI 응답 완료', 'success');
        } catch (error) {
            handleOffline(message, error);
        } finally {
            setBusy(false);
        }
    }

    function handleOffline(message, error) {
        setStatus('AI 서버 연결 필요', 'warning');
        if (state.mode === 'plan') {
            rememberPlan(message);
            saveState();
            renderMode();
            addMessage('assistant', '계획 조건을 대화 맥락에 저장했습니다. AI 서버가 연결되기 전에는 초안을 임의로 만들지 않습니다. 수정 모드로 전환하면 이 내용을 포함해 변경 후보를 준비합니다.');
        } else {
            showCandidates(composeInstruction(message), []);
            addMessage('assistant', '수정 요청을 정리했습니다. AI 서버가 연결되면 현재 문서에서 정확한 변경 위치와 바뀔 문장을 찾아 보여드립니다. 지금은 내용을 임의로 만들거나 문서에 반영하지 않습니다.');
        }
        if (error && error.message !== 'LOCAL_PREVIEW') console.warn('계획서 도우미 요청 실패', error);
    }

    function rememberPlan(message) {
        if (state.planNotes[state.planNotes.length - 1] !== message) state.planNotes.push(message);
        state.planNotes = state.planNotes.slice(-12);
    }

    function composeInstruction(message) {
        if (!state.planNotes.length) return message;
        return '[계획 모드에서 정리한 내용]\n' +
            state.planNotes.map(function (note, index) { return (index + 1) + '. ' + note; }).join('\n') +
            '\n\n[이번 수정 요청]\n' + message;
    }

    function showCandidates(instruction, changes) {
        state.pendingInstruction = instruction;
        showChangeNotice(Array.isArray(changes) ? changes : []);
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showChangeNotice(changes) {
        const old = ui.chat.querySelector('.smart-plan-change-notice');
        if (old) old.remove();
        const items = Array.isArray(changes) ? changes : [];
        const notice = make('div', 'smart-plan-change-notice');
        notice.append(make('strong', '', items.length ? '웹 편집기에서 확인할 변경 후보' : '수정 요청 접수'));
        const list = make('div', 'smart-plan-change-list');
        items.forEach(function (change) {
            const button = make('button', '', change.label || change.summary || change.id || '변경 후보');
            button.type = 'button';
            button.addEventListener('click', function () {
                editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            list.append(button);
        });
        if (!items.length) list.append(make('span', '', 'AI 서버 연결 후 현재 문서에서 변경 위치를 찾습니다.'));
        notice.append(list, make('small', '', items.length ? '후보만 제시되었습니다. 실제 반영 전 바뀔 문장을 한 번 더 확인합니다.' : '입력한 요청은 유지되며, 임의의 연도·날짜·문장을 만들지 않습니다.'));
        ui.context.insertAdjacentElement('afterend', notice);
    }
    function addMessage(role, text) {
        const row = make('div', 'smart-plan-message ' + role);
        const bubble = make('div', 'smart-plan-bubble');
        bubble.append(make('p', '', text));
        row.append(bubble);
        ui.messages.append(row);
        ui.messages.scrollTop = ui.messages.scrollHeight;
    }

    function setBusy(busy) {
        state.busy = busy;
        ui.send.disabled = busy;
        ui.input.disabled = busy;
        const icon = ui.send.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = busy ? 'progress_activity' : 'send';
            icon.classList.toggle('is-spinning', busy);
        }
    }

    function setStatus(text, kind) {
        ui.status.textContent = text;
        ui.status.dataset.kind = kind;
    }

    function saveState() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                mode: state.mode,
                planNotes: state.planNotes,
                conversationId: state.conversationId
            }));
        } catch (error) {
            console.warn('계획서 대화 상태를 저장하지 못했습니다.', error);
        }
    }

    function readState() {
        try {
            return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
        } catch (error) {
            return {};
        }
    }

    function newConversationId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        return 'smart-plan-' + Date.now().toString(36);
    }

    function make(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (typeof text === 'string') node.textContent = text;
        return node;
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = [
            '.smart-plan-workspace{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(340px,.78fr);gap:20px;align-items:start}',
            '.smart-plan-left{display:flex;flex-direction:column;gap:20px;min-width:0}.smart-plan-left>.card{margin:0}',
            '.smart-plan-right{min-width:0;position:sticky;top:88px}',
            '.smart-plan-chat-card{background:#fff;border:1px solid #e1e4e8;border-radius:16px;box-shadow:0 8px 28px rgba(17,18,20,.08);padding:18px}',
            '.smart-plan-chat-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}',
            '.smart-plan-chat-header h2{font-size:19px;font-weight:800;color:#111214;margin:0 0 5px}.smart-plan-chat-header p{font-size:12px;line-height:1.55;color:#6b7280}',
            '.smart-plan-status{flex:none;border-radius:999px;padding:5px 8px;background:#fff7e6;color:#8a5200;font-size:10px;font-weight:800}.smart-plan-status[data-kind="success"]{background:#ecfdf3;color:#05603a}',
            '.smart-plan-modes{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#f6f7f9;border:1px solid #e1e4e8;border-radius:11px;padding:4px;margin-top:14px}',
            '.smart-plan-modes button{min-height:40px;border:0;border-radius:8px;background:transparent;color:#69707c;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer}',
            '.smart-plan-modes button.is-active{background:#fff;color:#0046a8;box-shadow:0 1px 4px rgba(17,18,20,.1)}',
            '.smart-plan-context{display:flex;flex-direction:column;gap:2px;border-left:3px solid #0b57d0;background:#f4f7fd;padding:10px 12px;margin-top:12px;border-radius:4px 9px 9px 4px}',
            '.smart-plan-context strong{font-size:12px;color:#003893}.smart-plan-context span{font-size:11px;line-height:1.5;color:#596273}',
            '.smart-plan-change-notice{border:1px solid #bfd0f4;background:#f8faff;border-radius:10px;padding:10px;margin-top:9px}.smart-plan-change-notice strong{font-size:12px;color:#1f2937}.smart-plan-change-notice small{display:block;font-size:10px;line-height:1.45;color:#69707c;margin-top:6px}',
            '.smart-plan-change-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.smart-plan-change-list button{border:1px solid #c7d3f0;background:#fff;color:#003893;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:700;cursor:pointer}',
            '.smart-plan-messages{display:flex;flex-direction:column;gap:9px;min-height:220px;max-height:420px;overflow-y:auto;background:#f7f8fa;border:1px solid #e6e8ec;border-radius:12px;padding:12px;margin-top:12px}',
            '.smart-plan-message{display:flex;justify-content:flex-start}.smart-plan-message.user{justify-content:flex-end}',
            '.smart-plan-bubble{max-width:91%;background:#fff;border:1px solid #e1e4e8;border-radius:14px 14px 14px 4px;padding:10px 12px;color:#414752;font-size:12px;line-height:1.58}',
            '.smart-plan-message.user .smart-plan-bubble{background:#064aa7;border-color:#064aa7;color:#fff;border-radius:14px 14px 4px 14px}.smart-plan-bubble p{white-space:pre-line;margin:0}',
            '.smart-plan-quick-prompts{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.smart-plan-quick-prompts button{border:1px solid #dfe3e8;background:#fff;color:#596273;border-radius:999px;padding:6px 8px;font-size:10px;cursor:pointer}',
            '.smart-plan-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:end;margin-top:9px}.smart-plan-form textarea{width:100%;min-height:88px;border:1.5px solid #b8bec7;border-radius:11px;padding:10px 11px;font-size:13px;line-height:1.55;resize:vertical;outline:none}',
            '.smart-plan-form textarea:focus{border-color:#064aa7;box-shadow:0 0 0 2px rgba(6,74,167,.1)}.smart-plan-form button{min-height:44px;border:0;border-radius:10px;background:#064aa7;color:#fff;padding:0 13px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:4px;cursor:pointer}.smart-plan-form button:disabled{opacity:.5;cursor:not-allowed}',
            '.smart-plan-privacy{display:flex;align-items:flex-start;gap:4px;color:#8a9099;font-size:10px;line-height:1.45;margin-top:8px}.smart-plan-privacy .material-symbols-outlined{font-size:14px}',
            '.is-spinning{animation:smart-plan-spin 1s linear infinite}@keyframes smart-plan-spin{to{transform:rotate(360deg)}}',
            '@media(max-width:1180px){.smart-plan-workspace{grid-template-columns:minmax(0,1fr) 340px}}',
            '@media(max-width:960px){.smart-plan-workspace{grid-template-columns:1fr}.smart-plan-right{position:static;order:1}.smart-plan-left{order:2}.smart-plan-messages{min-height:170px;max-height:300px}}',
            '@media(max-width:560px){.smart-plan-form{grid-template-columns:1fr}.smart-plan-form button{width:100%}}'
        ].join('');
        document.head.append(style);
    }
})();