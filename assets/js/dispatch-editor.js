(function () {
    'use strict';

    const STORAGE_KEY = 'ef_mail_data';
    const state = {
        groupId: '',
        items: [],
        originalFileDisplay: ''
    };

    const form = document.getElementById('mailSendForm');
    if (!form) return;

    const submitButton = form.querySelector('button[type="submit"]');
    const cancelButton = form.querySelector('button[type="reset"]');
    const editorBanner = createEditorBanner();
    const sentSection = createSentSection();

    form.prepend(editorBanner);
    form.parentElement.insertAdjacentElement('afterend', sentSection.section);

    if (cancelButton) {
        cancelButton.type = 'button';
        cancelButton.removeAttribute('onclick');
        cancelButton.addEventListener('click', cancelEdit);
    }

    window.submitMailForm = submitMailForm;
    renderSentList();

    function createEditorBanner() {
        const banner = document.createElement('div');
        banner.id = 'dispatchEditBanner';
        banner.className = 'hidden rounded-xl border border-primary/20 bg-primary/5 px-md py-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs';

        const textWrap = document.createElement('div');
        textWrap.className = 'flex items-start gap-xs';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-primary text-[20px]';
        icon.textContent = 'edit_note';
        const text = document.createElement('div');
        const title = document.createElement('p');
        title.className = 'font-bold text-[14px] text-ink';
        title.textContent = '등록한 업무를 수정하고 있습니다.';
        const description = document.createElement('p');
        description.className = 'text-[12px] text-ink/60 mt-0.5';
        description.textContent = '수정 저장 시 선택한 업무 분야 전체에 변경 내용이 반영됩니다.';
        text.append(title, description);
        textWrap.append(icon, text);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'text-[13px] font-bold text-primary hover:underline self-start sm:self-auto';
        close.textContent = '수정 취소';
        close.addEventListener('click', cancelEdit);
        banner.append(textWrap, close);
        return banner;
    }

    function createSentSection() {
        const section = document.createElement('section');
        section.className = 'bg-white rounded-2xl shadow-sm border border-gray-200 p-lg sm:p-xl mt-lg';
        section.setAttribute('aria-labelledby', 'sentDispatchHeading');

        const header = document.createElement('div');
        header.className = 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-xs mb-base';
        const headingWrap = document.createElement('div');
        const heading = document.createElement('h2');
        heading.id = 'sentDispatchHeading';
        heading.className = 'text-[20px] font-bold text-ink';
        heading.textContent = '내가 등록한 업무';
        const description = document.createElement('p');
        description.className = 'text-[13px] text-ink/60 mt-1';
        description.textContent = '등록한 배송 내용을 확인하고 수정하거나 삭제할 수 있습니다.';
        headingWrap.append(heading, description);

        const count = document.createElement('span');
        count.id = 'sentDispatchCount';
        count.className = 'text-[12px] font-bold text-primary bg-primary/5 rounded-full px-sm py-1 self-start';
        header.append(headingWrap, count);

        const list = document.createElement('div');
        list.id = 'sentDispatchList';
        list.className = 'flex flex-col gap-sm';
        section.append(header, list);
        return { section, list, count };
    }

    function readMailData() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn('업무 배송 데이터를 읽지 못했습니다.', error);
            return [];
        }
    }

    function writeMailData(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }

    function getCurrentUserEmail() {
        return localStorage.getItem('currentUser') || '';
    }

    function groupKey(item) {
        return item.dispatchGroupId || item.id;
    }

    function getEditableGroups() {
        const email = getCurrentUserEmail();
        const groups = new Map();
        readMailData().forEach(item => {
            if (!item || !item.id) return;
            if (item.senderEmail && email && item.senderEmail !== email) return;
            const key = groupKey(item);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });
        return Array.from(groups.entries()).map(([id, items]) => ({ id, items }));
    }

    function renderSentList() {
        const groups = getEditableGroups();
        sentSection.count.textContent = groups.length + '건';
        sentSection.list.replaceChildren();

        if (!groups.length) {
            const empty = document.createElement('div');
            empty.className = 'rounded-xl bg-surface-soft border border-gray-100 px-md py-xl text-center';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[28px] text-ink/30';
            icon.textContent = 'outbox';
            const text = document.createElement('p');
            text.className = 'text-[14px] text-ink/55 mt-xs';
            text.textContent = '아직 등록한 업무가 없습니다.';
            empty.append(icon, text);
            sentSection.list.appendChild(empty);
            return;
        }

        groups.forEach(group => sentSection.list.appendChild(createSentCard(group)));
    }

    function createSentCard(group) {
        const primary = group.items[0];
        const categories = unique(group.items.map(item => item.category).filter(Boolean));
        const card = document.createElement('article');
        card.className = 'rounded-xl border border-gray-200 px-md py-base hover:border-primary/30 transition-colors';

        const top = document.createElement('div');
        top.className = 'flex flex-col lg:flex-row lg:items-start lg:justify-between gap-sm';
        const info = document.createElement('div');
        info.className = 'min-w-0';
        const badgeRow = document.createElement('div');
        badgeRow.className = 'flex flex-wrap items-center gap-xs mb-xs';
        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'text-[11px] font-bold text-primary bg-primary/5 rounded-full px-sm py-1';
        categoryBadge.textContent = categories.length ? categories.join(' · ') : '업무 분야 미지정';
        const date = document.createElement('span');
        date.className = 'text-[12px] text-ink/45';
        date.textContent = (primary.date || '등록일 미상') + (primary.updatedAt ? ' · 수정됨' : '');
        badgeRow.append(categoryBadge, date);

        const title = document.createElement('h3');
        title.className = 'text-[16px] font-bold text-ink truncate';
        title.textContent = primary.title || '제목 없음';
        const description = document.createElement('p');
        description.className = 'text-[13px] text-ink/60 mt-1 line-clamp-2';
        description.textContent = primary.desc || '상세 내용 없음';
        const meta = document.createElement('p');
        meta.className = 'text-[12px] text-ink/45 mt-xs';
        meta.textContent = buildMeta(primary);
        info.append(badgeRow, title, description, meta);

        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-xs shrink-0';
        const edit = actionButton('edit', '수정', false);
        edit.addEventListener('click', () => beginEdit(group.id));
        const remove = actionButton('delete', '삭제', true);
        remove.addEventListener('click', () => deleteGroup(group.id));
        actions.append(edit, remove);
        top.append(info, actions);
        card.appendChild(top);
        return card;
    }

    function actionButton(iconName, label, danger) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'inline-flex items-center gap-1 rounded-lg border px-sm py-xs text-[13px] font-bold transition-colors ' +
            (danger ? 'border-danger/20 text-danger hover:bg-danger/5' : 'border-gray-200 text-ink/65 hover:border-primary/30 hover:text-primary');
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[16px]';
        icon.textContent = iconName;
        button.append(icon, document.createTextNode(label));
        return button;
    }

    function buildMeta(item) {
        const period = item.taskStart || item.taskEnd
            ? '처리기간 ' + (item.taskStart || '미정') + ' ~ ' + (item.taskEnd || '미정')
            : '처리기간 미지정';
        const files = item.file ? ' · 첨부 ' + item.file.split(',').filter(Boolean).length + '개' : '';
        const links = Array.isArray(item.links) && item.links.length ? ' · 링크 ' + item.links.length + '개' : '';
        return period + files + links;
    }

    function beginEdit(id) {
        const group = getEditableGroups().find(entry => entry.id === id);
        if (!group) return;
        const primary = group.items[0];
        state.groupId = id;
        state.items = group.items.slice();
        state.originalFileDisplay = primary.file || '';

        document.querySelectorAll('input[name="taskCategory"]').forEach(input => {
            input.checked = group.items.some(item => item.category === input.value);
        });
        setValue('mailTitleInput', primary.title);
        setValue('mailDescInput', primary.desc);
        setValue('taskStartDate', primary.taskStart);
        setValue('taskEndDate', primary.taskEnd);
        setValue('sendTimingSelect', primary.dispatchTiming || 'now');
        window.sendTimingChanged(primary.dispatchTiming || 'now');
        setValue('sendCustomDate', primary.dispatchCustomAt);

        renderStoredFiles(state.originalFileDisplay);
        document.getElementById('sendLinkChips').replaceChildren();
        unique(Array.isArray(primary.links) ? primary.links : []).forEach(addLinkChip);
        setEditingUi(true);
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('mailTitleInput').focus({ preventScroll: true });
    }

    async function deleteGroup(id) {
        const group = getEditableGroups().find(entry => entry.id === id);
        if (!group) return;
        const title = group.items[0].title || '선택한 업무';
        const confirmed = await EF_MODAL.confirm('“' + title + '” 등록 건을 삭제할까요? 수신자의 업무 우편함에서도 함께 사라집니다.', {
            confirmLabel: '삭제',
            cancelLabel: '취소',
            danger: true
        });
        if (!confirmed) return;
        const ids = new Set(group.items.map(item => item.id));
        writeMailData(readMailData().filter(item => !ids.has(item.id)));
        if (state.groupId === id) resetEditor();
        renderSentList();
        showDispatchToast('등록한 업무를 삭제했습니다.');
    }

    function submitMailForm(event) {
        event.preventDefault();
        const selected = Array.from(document.querySelectorAll('input[name="taskCategory"]:checked'));
        if (!selected.length) {
            EF_MODAL.alert('발송할 업무 분야를 최소 1개 이상 선택해주세요.');
            return;
        }

        const categories = selected.map(input => input.value);
        const title = getValue('mailTitleInput').trim();
        const desc = getValue('mailDescInput').trim();
        const fileInput = document.getElementById('sendFileInput');
        const newFiles = fileInput.files ? Array.from(fileInput.files).map(file => file.name) : [];
        const fileDisplay = newFiles.length ? newFiles.join(', ') : state.originalFileDisplay;
        const links = Array.from(document.querySelectorAll('#sendLinkChips a')).map(link => link.href);
        const taskStart = getValue('taskStartDate');
        const taskEnd = getValue('taskEndDate');
        const dispatchTiming = getValue('sendTimingSelect');
        const dispatchCustomAt = getValue('sendCustomDate');
        const dueBadge = window.computeDueBadge(taskEnd);
        const email = getCurrentUserEmail();
        const senderDept = localStorage.getItem('org_' + email) || '해당부서';
        const today = formatToday();
        let mailData = readMailData();

        const isEditing = Boolean(state.groupId);
        const groupId = state.groupId || createId('dispatch');
        const originalByCategory = new Map(state.items.map(item => [item.category, item]));
        const originalIds = new Set(state.items.map(item => item.id));
        if (isEditing) mailData = mailData.filter(item => !originalIds.has(item.id));

        const entries = categories.map(category => {
            const original = originalByCategory.get(category) || {};
            return {
                id: original.id || createId('mail'),
                dispatchGroupId: groupId,
                senderEmail: email,
                dept: senderDept,
                category,
                date: original.date || today,
                title,
                desc,
                file: fileDisplay,
                links,
                taskStart,
                taskEnd,
                dispatchTiming,
                dispatchCustomAt,
                due: dueBadge.label,
                dueTone: dueBadge.tone,
                read: original.read || false,
                updatedAt: isEditing ? new Date().toISOString() : ''
            };
        });

        writeMailData(entries.concat(mailData));
        resetEditor();
        renderSentList();
        showDispatchToast(isEditing ? '등록한 업무를 수정했습니다.' : '업무 우편이 성공적으로 등록(배송)되었습니다.');
    }

    function cancelEdit() {
        const wasEditing = Boolean(state.groupId);
        resetEditor();
        if (wasEditing) showDispatchToast('수정을 취소했습니다.');
    }

    function resetEditor() {
        state.groupId = '';
        state.items = [];
        state.originalFileDisplay = '';
        form.reset();
        document.querySelectorAll('input[name="taskCategory"]').forEach(input => { input.checked = false; });
        document.getElementById('sendFileInput').value = '';
        window.sendResetForm();
        setEditingUi(false);
    }

    function setEditingUi(editing) {
        editorBanner.classList.toggle('hidden', !editing);
        if (submitButton) {
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[18px]';
            icon.textContent = editing ? 'save' : 'send';
            submitButton.replaceChildren(icon, document.createTextNode(editing ? '수정 저장하기' : '배송 등록하기'));
        }
        if (cancelButton) cancelButton.textContent = editing ? '수정 취소' : '입력 초기화';
    }

    function renderStoredFiles(fileDisplay) {
        const chips = document.getElementById('sendFileChips');
        const text = document.getElementById('sendDropzoneText');
        chips.replaceChildren();
        const names = String(fileDisplay || '').split(',').map(value => value.trim()).filter(Boolean);
        text.textContent = names.length ? '기존 첨부 ' + names.length + '개 · 새 파일 선택 시 교체' : '클릭하여 파일 선택 또는 여기로 드래그';
        names.forEach(name => {
            const chip = document.createElement('span');
            chip.className = 'inline-flex items-center gap-xxs px-sm py-1 rounded-full bg-surface-strong text-[13px] text-ink/70';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[14px]';
            icon.textContent = 'description';
            chip.append(icon, document.createTextNode(name));
            chips.appendChild(chip);
        });
    }

    function addLinkChip(url) {
        const input = document.getElementById('sendLinkInput');
        input.value = url;
        window.sendAddLink();
    }

    function showDispatchToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            Array.from(toast.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
            toast.appendChild(document.createTextNode(' ' + message));
        }
        window.showToast();
    }

    function setValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    }

    function getValue(id) {
        const element = document.getElementById(id);
        return element ? element.value : '';
    }

    function unique(values) {
        return Array.from(new Set(values));
    }

    function createId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + '-' + window.crypto.randomUUID();
        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    }

    function formatToday() {
        return new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
    }
})();
