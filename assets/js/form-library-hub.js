(function () {
    'use strict';

    const contentRoot = document.querySelector('#global-layout-wrapper > .flex-1.min-w-0');
    if (!contentRoot) return;

    const pageHeader = contentRoot.querySelector(':scope > .mb-lg');
    const searchPanel = contentRoot.querySelector(':scope > section');
    if (!pageHeader || !searchPanel) return;

    searchPanel.id = 'formSearchPanel';
    const tabs = createTabs();
    const analysisPanel = createAnalysisPanel();
    pageHeader.insertAdjacentElement('afterend', tabs.root);
    searchPanel.insertAdjacentElement('afterend', analysisPanel.root);

    let selectedFile = null;
    tabs.search.addEventListener('click', function () { setView('search', true); });
    tabs.analysis.addEventListener('click', function () { setView('analysis', true); });
    window.addEventListener('hashchange', syncViewFromHash);

    analysisPanel.dropzone.addEventListener('click', function () { analysisPanel.fileInput.click(); });
    analysisPanel.dropzone.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            analysisPanel.fileInput.click();
        }
    });
    analysisPanel.dropzone.addEventListener('dragover', function (event) {
        event.preventDefault();
        analysisPanel.dropzone.classList.add('border-primary', 'bg-primary/5');
    });
    analysisPanel.dropzone.addEventListener('dragleave', function () {
        analysisPanel.dropzone.classList.remove('border-primary', 'bg-primary/5');
    });
    analysisPanel.dropzone.addEventListener('drop', function (event) {
        event.preventDefault();
        analysisPanel.dropzone.classList.remove('border-primary', 'bg-primary/5');
        selectFile(event.dataTransfer.files && event.dataTransfer.files[0]);
    });
    analysisPanel.fileInput.addEventListener('change', function () {
        selectFile(analysisPanel.fileInput.files && analysisPanel.fileInput.files[0]);
    });
    analysisPanel.analyzeButton.addEventListener('click', analyzeDocument);

    syncViewFromHash();

    function createTabs() {
        const root = document.createElement('div');
        root.className = 'inline-flex items-center gap-1 rounded-xl bg-surface-soft border border-hairline p-1 mb-base self-start';
        root.setAttribute('role', 'tablist');
        root.setAttribute('aria-label', '서식 자료실 작업 선택');
        const search = tabButton('search', 'search', '서식 찾기');
        const analysis = tabButton('document_scanner', 'analysis', '공문 분석');
        root.append(search, analysis);
        return { root, search, analysis };
    }

    function tabButton(iconName, view, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.view = view;
        button.className = 'min-h-[40px] px-md rounded-lg text-[14px] font-bold flex items-center gap-xs transition-colors';
        button.setAttribute('role', 'tab');
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[18px]';
        icon.textContent = iconName;
        button.append(icon, document.createTextNode(label));
        return button;
    }

    function createAnalysisPanel() {
        const root = document.createElement('section');
        root.id = 'documentAnalysisPanel';
        root.className = 'hidden max-w-[1100px] py-md';
        root.setAttribute('role', 'tabpanel');
        root.setAttribute('aria-labelledby', 'formHubAnalysisTab');

        const intro = document.createElement('div');
        intro.className = 'mb-lg';
        const title = document.createElement('h2');
        title.className = 'text-[24px] font-bold text-ink';
        title.textContent = '공문 분석';
        const description = document.createElement('p');
        description.className = 'text-[14px] text-ink/65 mt-xs';
        description.textContent = '공문 파일을 올리면 핵심 내용, 처리 기한, 해야 할 일과 필요한 서식을 한 화면에서 정리합니다.';
        intro.append(title, description);

        const layout = document.createElement('div');
        layout.className = 'grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-lg items-start';

        const uploadCard = document.createElement('div');
        uploadCard.className = 'bg-white rounded-2xl border border-hairline shadow-sm p-lg';
        const uploadTitle = document.createElement('h3');
        uploadTitle.className = 'text-[16px] font-bold text-ink flex items-center gap-xs';
        const uploadIcon = document.createElement('span');
        uploadIcon.className = 'material-symbols-outlined text-primary text-[20px]';
        uploadIcon.textContent = 'upload_file';
        uploadTitle.append(uploadIcon, document.createTextNode('분석할 공문 올리기'));

        const uploadHelp = document.createElement('p');
        uploadHelp.className = 'text-[12px] text-ink/50 mt-xs mb-base';
        uploadHelp.textContent = 'PDF, HWP/HWPX, DOC/DOCX, JPG/PNG · 최대 20MB';

        const dropzone = document.createElement('div');
        dropzone.id = 'integratedOcrDropzone';
        dropzone.className = 'min-h-[210px] rounded-2xl border-2 border-dashed border-hairline bg-surface-soft/50 p-lg flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors';
        dropzone.tabIndex = 0;
        dropzone.setAttribute('role', 'button');
        dropzone.setAttribute('aria-label', '공문 파일 선택');
        const dropIcon = document.createElement('span');
        dropIcon.className = 'material-symbols-outlined text-[38px] text-primary';
        dropIcon.textContent = 'document_scanner';
        const dropTitle = document.createElement('p');
        dropTitle.id = 'integratedOcrFileLabel';
        dropTitle.className = 'text-[14px] font-bold text-ink mt-sm';
        dropTitle.textContent = '클릭하거나 파일을 끌어다 놓으세요';
        const dropDescription = document.createElement('p');
        dropDescription.className = 'text-[12px] text-ink/45 mt-1';
        dropDescription.textContent = '업로드 전에는 서버로 전송되지 않습니다.';
        dropzone.append(dropIcon, dropTitle, dropDescription);

        const fileInput = document.createElement('input');
        fileInput.id = 'integratedOcrFileInput';
        fileInput.type = 'file';
        fileInput.className = 'hidden';
        fileInput.accept = '.pdf,.hwp,.hwpx,.doc,.docx,.jpg,.jpeg,.png';

        const analyzeButton = document.createElement('button');
        analyzeButton.id = 'integratedOcrAnalyzeButton';
        analyzeButton.type = 'button';
        analyzeButton.disabled = true;
        analyzeButton.className = 'w-full min-h-[44px] mt-base rounded-xl bg-primary text-white text-[14px] font-bold flex items-center justify-center gap-xs hover:bg-primary-active disabled:opacity-45 disabled:cursor-not-allowed transition-colors';
        const analyzeIcon = document.createElement('span');
        analyzeIcon.className = 'material-symbols-outlined text-[18px]';
        analyzeIcon.textContent = 'auto_awesome';
        analyzeButton.append(analyzeIcon, document.createTextNode('공문 분석하기'));
        uploadCard.append(uploadTitle, uploadHelp, dropzone, fileInput, analyzeButton);

        const resultCard = document.createElement('div');
        resultCard.className = 'bg-white rounded-2xl border border-hairline shadow-sm p-lg min-h-[390px]';
        const resultHeader = document.createElement('div');
        resultHeader.className = 'flex items-center justify-between gap-sm mb-base';
        const resultTitle = document.createElement('h3');
        resultTitle.className = 'text-[16px] font-bold text-ink flex items-center gap-xs';
        const resultIcon = document.createElement('span');
        resultIcon.className = 'material-symbols-outlined text-primary text-[20px]';
        resultIcon.textContent = 'summarize';
        resultTitle.append(resultIcon, document.createTextNode('분석 결과'));
        const status = document.createElement('span');
        status.id = 'integratedOcrStatus';
        status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-surface-strong text-ink/55';
        status.textContent = '파일 대기';
        resultHeader.append(resultTitle, status);

        const result = document.createElement('div');
        result.id = 'integratedOcrResult';
        result.className = 'min-h-[300px] flex items-center justify-center';
        result.setAttribute('aria-live', 'polite');
        result.appendChild(emptyResult());
        resultCard.append(resultHeader, result);

        layout.append(uploadCard, resultCard);
        root.append(intro, layout);
        return { root, dropzone, fileInput, analyzeButton, fileLabel: dropTitle, status, result };
    }

    function emptyResult() {
        const empty = document.createElement('div');
        empty.className = 'text-center text-ink/40 max-w-sm';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-[42px]';
        icon.textContent = 'description';
        const text = document.createElement('p');
        text.className = 'text-[13px] mt-xs leading-relaxed';
        text.textContent = '공문을 선택하면 파일을 확인한 뒤 분석을 시작할 수 있습니다.';
        empty.append(icon, text);
        return empty;
    }

    function setView(view, updateHash) {
        const analysis = view === 'analysis';
        searchPanel.classList.toggle('hidden', analysis);
        analysisPanel.root.classList.toggle('hidden', !analysis);
        styleTab(tabs.search, !analysis);
        styleTab(tabs.analysis, analysis);
        if (updateHash) {
            const next = analysis ? '#document-analysis' : '#search';
            if (window.location.hash !== next) history.replaceState(null, '', next);
        }
    }

    function styleTab(button, active) {
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        button.classList.toggle('bg-white', active);
        button.classList.toggle('text-primary', active);
        button.classList.toggle('shadow-sm', active);
        button.classList.toggle('text-ink/55', !active);
        button.classList.toggle('hover:text-ink', !active);
    }

    function syncViewFromHash() {
        setView(window.location.hash === '#document-analysis' ? 'analysis' : 'search', false);
    }

    function selectFile(file) {
        if (!file) return;
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const allowed = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
        if (!allowed.includes(extension)) {
            notify('지원하지 않는 파일 형식입니다. PDF, HWP/HWPX, DOC/DOCX, JPG/PNG 파일을 선택해 주세요.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            notify('파일은 최대 20MB까지 올릴 수 있습니다.');
            return;
        }
        selectedFile = file;
        analysisPanel.fileLabel.textContent = file.name + ' · ' + formatSize(file.size);
        analysisPanel.analyzeButton.disabled = false;
        analysisPanel.status.textContent = '분석 준비';
        analysisPanel.status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-primary/10 text-primary';
        analysisPanel.result.replaceChildren(fileReadyResult(file));
    }

    function fileReadyResult(file) {
        const wrap = document.createElement('div');
        wrap.className = 'w-full rounded-xl bg-surface-soft border border-hairline p-md';
        const title = document.createElement('p');
        title.className = 'text-[14px] font-bold text-ink';
        title.textContent = file.name;
        const meta = document.createElement('p');
        meta.className = 'text-[12px] text-ink/50 mt-1';
        meta.textContent = formatSize(file.size) + ' · 아직 분석하지 않음';
        const help = document.createElement('p');
        help.className = 'text-[12px] text-ink/60 mt-sm leading-relaxed';
        help.textContent = '“공문 분석하기”를 누르면 보안 검증 후 분석 서버로 전송됩니다.';
        wrap.append(title, meta, help);
        return wrap;
    }

    async function analyzeDocument() {
        if (!selectedFile) {
            notify('먼저 분석할 공문 파일을 선택해 주세요.');
            return;
        }
        setAnalyzing(true);
        try {
            if (window.location.protocol === 'file:') throw new Error('LOCAL_PREVIEW');
            const body = new FormData();
            body.append('file', selectedFile);
            body.append('mode', 'official_document_summary');
            const response = await fetch('/api/documents/analyze', { method: 'POST', body });
            if (!response.ok) throw new Error('HTTP_' + response.status);
            const payload = await response.json();
            if (!payload || !payload.data || typeof payload.data.summary !== 'string') throw new Error('INVALID_RESPONSE');
            renderAnalysis(payload.data);
        } catch (error) {
            renderUnavailable(error);
        } finally {
            setAnalyzing(false);
        }
    }

    function setAnalyzing(analyzing) {
        analysisPanel.analyzeButton.disabled = analyzing;
        analysisPanel.status.textContent = analyzing ? '분석 중' : analysisPanel.status.textContent;
        if (analyzing) {
            const loading = document.createElement('div');
            loading.className = 'text-center text-primary';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[34px] animate-spin';
            icon.textContent = 'progress_activity';
            const text = document.createElement('p');
            text.className = 'text-[13px] font-bold mt-xs';
            text.textContent = '공문 내용을 안전하게 분석하고 있습니다.';
            loading.append(icon, text);
            analysisPanel.result.replaceChildren(loading);
        }
    }

    function renderUnavailable(error) {
        analysisPanel.status.textContent = '서버 연결 필요';
        analysisPanel.status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-warning/10 text-warning';
        const wrap = document.createElement('div');
        wrap.className = 'w-full rounded-xl border border-warning/25 bg-warning/5 p-md';
        const title = document.createElement('p');
        title.className = 'text-[14px] font-bold text-ink flex items-center gap-xs';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-warning text-[18px]';
        icon.textContent = 'cloud_off';
        title.append(icon, document.createTextNode('공문 분석 서버가 아직 연결되지 않았습니다.'));
        const description = document.createElement('p');
        description.className = 'text-[12px] text-ink/60 mt-xs leading-relaxed';
        description.textContent = '파일명과 크기만 확인했으며 공문 내용은 추측하지 않았습니다. 백엔드 연결 후 같은 화면에서 분석 결과가 표시됩니다.';
        const file = document.createElement('p');
        file.className = 'text-[12px] font-bold text-ink/70 mt-sm break-all';
        file.textContent = selectedFile.name + ' · ' + formatSize(selectedFile.size);
        wrap.append(title, description, file);
        analysisPanel.result.replaceChildren(wrap);
        if (error && error.message !== 'LOCAL_PREVIEW') console.warn('공문 분석 요청 실패', error);
    }

    function renderAnalysis(data) {
        analysisPanel.status.textContent = '분석 완료';
        analysisPanel.status.className = 'text-[11px] font-bold rounded-full px-sm py-1 bg-success/10 text-success';
        const wrap = document.createElement('div');
        wrap.className = 'w-full space-y-md';
        wrap.appendChild(resultBlock('핵심 요약', data.summary));

        const actionItems = Array.isArray(data.actionItems) ? data.actionItems.filter(Boolean) : [];
        if (actionItems.length) wrap.appendChild(resultList('해야 할 일', actionItems));
        const dueDates = Array.isArray(data.dueDates) ? data.dueDates.filter(Boolean) : [];
        if (dueDates.length) wrap.appendChild(resultList('처리 기한', dueDates));
        const templates = Array.isArray(data.suggestedTemplates) ? data.suggestedTemplates.filter(Boolean) : [];
        if (templates.length) wrap.appendChild(resultList('추천 서식', templates));
        analysisPanel.result.replaceChildren(wrap);
    }

    function resultBlock(titleText, content) {
        const block = document.createElement('div');
        block.className = 'rounded-xl bg-primary/5 border border-primary/10 p-md';
        const title = document.createElement('p');
        title.className = 'text-[12px] font-bold text-primary';
        title.textContent = titleText;
        const text = document.createElement('p');
        text.className = 'text-[13px] text-ink leading-relaxed mt-xs whitespace-pre-line';
        text.textContent = content;
        block.append(title, text);
        return block;
    }

    function resultList(titleText, items) {
        const block = document.createElement('div');
        const title = document.createElement('p');
        title.className = 'text-[12px] font-bold text-ink/65 mb-xs';
        title.textContent = titleText;
        const list = document.createElement('ul');
        list.className = 'space-y-xs';
        items.forEach(function (item) {
            const row = document.createElement('li');
            row.className = 'flex items-start gap-xs text-[13px] text-ink/75';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-primary text-[16px] mt-[1px]';
            icon.textContent = 'check_circle';
            const text = document.createElement('span');
            text.textContent = typeof item === 'string' ? item : (item.label || item.title || JSON.stringify(item));
            row.append(icon, text);
            list.appendChild(row);
        });
        block.append(title, list);
        return block;
    }

    function notify(message) {
        if (window.EF_MODAL && typeof window.EF_MODAL.alert === 'function') window.EF_MODAL.alert(message);
    }

    function formatSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0KB';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
        return Math.max(1, Math.round(bytes / 1024)) + 'KB';
    }
})();
