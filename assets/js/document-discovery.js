(function () {
    'use strict';

    const API_BASE = String((window.EF_CONFIG && window.EF_CONFIG.apiBase) || '').replace(/\/$/, '');
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const ALLOWED = new Set(['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']);
    const contentRoot = document.querySelector('#global-layout-wrapper > .flex-1.min-w-0');
    if (!contentRoot) return;

    const pageHeader = contentRoot.querySelector(':scope > .mb-lg');
    const sourceCards = Array.from(contentRoot.querySelectorAll('#searchResultsList > a')).map(function (card) {
        return {
            title: card.dataset.title || '',
            description: card.dataset.desc || '',
            type: card.dataset.doctype || '문서',
            department: card.dataset.dept || '',
            tags: card.dataset.tags || '',
            url: card.getAttribute('href') === '서식 자료실_한글파일서식선택.html'
                ? '서식자료실_스마트 계획서 변환.html'
                : safeUrl(card.getAttribute('href'))
        };
    });
    if (!pageHeader) return;

    document.title = 'AI 문서 탐색 | 이지플로우 (EasyFlow) - 경상북도교육청';
    pageHeader.querySelector('h1').textContent = 'AI 문서 탐색';
    pageHeader.querySelector('p').textContent = '공문 캡처·공문·계획서·서식을 올리면 내용을 분석해 관련 서식과 참고 계획서를 함께 추천합니다.';
    Array.from(contentRoot.children).forEach(function (child) {
        if (child !== pageHeader) child.hidden = true;
    });

    const state = { files: [], busy: false, workCategory: '' };
    const ui = buildWorkspace();
    pageHeader.insertAdjacentElement('afterend', ui.root);
    bindEvents();
    renderFiles();
    renderEmptyResult();

    function buildWorkspace() {
        const style = document.createElement('style');
        style.textContent = [
            '.document-discovery{display:grid;gap:20px}',
            '.discovery-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:20px;align-items:stretch}',
            '.discovery-card{background:#fff;border:1px solid #e5e8eb;border-radius:20px;padding:24px;box-shadow:0 6px 20px rgba(17,18,20,.04)}',
            '.discovery-upload-card{display:flex;flex-direction:column}',
            '.discovery-drop{flex:1;min-height:180px;margin-top:18px;border:2px dashed #c4c6d4;border-radius:16px;background:#fbfcfd;padding:22px 24px;display:flex;align-items:center;justify-content:center;gap:15px;text-align:left;cursor:pointer;transition:.18s ease}',
            '.discovery-drop:hover,.discovery-drop.is-dragging{border-color:#003893;background:#f4f7ff}',
            '.discovery-drop-copy{min-width:0}.discovery-drop-copy strong{display:block;color:#111214;font-size:14px}.discovery-drop-copy span{display:block;margin-top:3px;color:#868b94;font-size:11px}.discovery-drop.has-files{flex:none;min-height:72px;padding:10px 14px}',
            '.discovery-file-list{display:grid;gap:8px;margin-top:12px}',
            '.discovery-file{display:flex;align-items:center;gap:10px;border:1px solid #e5e8eb;border-radius:12px;padding:10px 12px;background:#fff}',
            '.discovery-flow{display:grid;gap:10px;margin-top:18px}',
            '.discovery-flow-item{display:flex;gap:12px;align-items:flex-start;padding:13px;border-radius:14px;background:#f8f9fa}',
            '.discovery-number{width:28px;height:28px;display:grid;place-items:center;flex:none;border-radius:999px;background:#eaf1ff;color:#003893;font-size:12px;font-weight:800}',
            '.discovery-query{display:flex;gap:10px;margin-top:14px}',
            '.discovery-query input{flex:1;min-width:0;border:1px solid #d9dce2;border-radius:12px;padding:12px 14px;font-size:14px}',
            '.discovery-primary{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:12px;background:#003893;color:#fff;padding:10px 18px;font-size:13px;font-weight:800}',
            '.discovery-primary:disabled{opacity:.45;cursor:not-allowed}',
            '.discovery-work-label{display:flex;align-items:center;gap:6px;margin-top:12px;color:#343840;font-size:12px;font-weight:800}.discovery-work-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.discovery-example{margin-top:8px;color:#747985;font-size:11px;line-height:1.55}',
            '.discovery-chip{border:1px solid #d9dce2;border-radius:999px;background:#fff;padding:7px 11px;font-size:11px;color:#4e535e;transition:.15s ease}.discovery-chip:hover,.discovery-chip.is-selected{border-color:#003893;background:#eaf1ff;color:#003893}.discovery-chip.is-selected{font-weight:800}',
            '.discovery-results{min-height:210px}',
            '.discovery-recommendation{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:start;border:1px solid #e5e8eb;border-radius:16px;padding:16px;background:#fff}',
            '.discovery-type{border-radius:999px;background:#eaf1ff;color:#003893;padding:5px 9px;font-size:10px;font-weight:800;white-space:nowrap}',
            '.discovery-link{align-self:center;color:#003893;font-size:12px;font-weight:800;white-space:nowrap}',
            '@media(max-width:1050px){.discovery-hero{grid-template-columns:1fr}.discovery-drop{min-height:150px}}',
            '@media(max-width:640px){.discovery-card{padding:18px}.discovery-drop{min-height:132px;margin-top:14px;padding:18px;align-items:center;flex-wrap:wrap}.discovery-drop.has-files{min-height:68px}.discovery-query{flex-direction:column}.discovery-recommendation{grid-template-columns:1fr}.discovery-link{justify-self:start}}'
        ].join('');
        document.head.appendChild(style);

        const root = el('section', 'document-discovery');
        root.id = 'documentDiscovery';

        const hero = el('div', 'discovery-hero');
        const uploadCard = el('section', 'discovery-card discovery-upload-card');
        uploadCard.append(
            heading('document_search', '공문과 업무 문서를 올려주세요', '캡처 이미지, 공문, 계획서, 서식을 최대 5개까지 함께 비교할 수 있습니다.')
        );
        const dropzone = el('div', 'discovery-drop');
        dropzone.id = 'documentDiscoveryDropzone';
        dropzone.tabIndex = 0;
        dropzone.setAttribute('role', 'button');
        dropzone.setAttribute('aria-label', '분석할 문서 파일 선택');
        const dropIcon = icon('upload_file', '27px');
        dropIcon.style.cssText = 'width:42px;height:42px;display:grid;place-items:center;flex:none;border-radius:12px;background:#eaf1ff;color:#003893';
        const dropCopy = el('span', 'discovery-drop-copy');
        const dropTitle = el('strong');
        dropTitle.textContent = '분석할 문서를 선택하세요';
        const dropHelp = el('span');
        dropHelp.textContent = 'PDF, HWP/HWPX, DOC/DOCX, JPG/PNG · 최대 5개 · 파일당 20MB';
        dropCopy.append(dropTitle, dropHelp);
        dropzone.append(dropIcon, dropCopy, icon('add_circle', '22px'));
        const fileInput = el('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.pdf,.hwp,.hwpx,.doc,.docx,.jpg,.jpeg,.png,.webp';
        fileInput.hidden = true;
        const fileList = el('div', 'discovery-file-list');
        fileList.id = 'documentDiscoveryFiles';
        uploadCard.append(dropzone, fileInput, fileList);

        const guideCard = el('aside', 'discovery-card');
        guideCard.append(heading('route', '한 번 올리고, 관련 자료까지 찾습니다', '검색과 공문 분석을 나누지 않고 하나의 흐름으로 처리합니다.'));
        const flow = el('div', 'discovery-flow');
        [
            ['1', '문서 내용 파악', 'OCR·문서 파싱으로 목적, 업무 분야, 핵심 키워드를 찾습니다.'],
            ['2', '관련 자료 탐색', '키워드 검색과 의미 검색 결과를 합쳐 서식·계획서 후보를 찾습니다.'],
            ['3', '추천 근거 확인', '왜 추천했는지 관련 문장과 자료 유형을 함께 표시합니다.']
        ].forEach(function (item) {
            const row = el('div', 'discovery-flow-item');
            const number = el('span', 'discovery-number');
            number.textContent = item[0];
            const copy = el('div');
            const title = el('strong');
            title.textContent = item[1];
            title.style.cssText = 'display:block;color:#111214;font-size:13px';
            const text = el('p');
            text.textContent = item[2];
            text.style.cssText = 'margin-top:3px;color:#686d77;font-size:11px;line-height:1.55';
            copy.append(title, text);
            row.append(number, copy);
            flow.appendChild(row);
        });
        guideCard.appendChild(flow);
        hero.append(uploadCard, guideCard);

        const requestCard = el('section', 'discovery-card');
        requestCard.append(heading('search', '찾고 싶은 업무를 함께 적어주세요', '파일만 올려도 되고, 필요한 자료를 한 문장으로 덧붙이면 추천 범위를 더 정확히 좁힐 수 있습니다.'));
        const queryWrap = el('div', 'discovery-query');
        const queryInput = el('input');
        queryInput.id = 'documentDiscoveryQuery';
        queryInput.type = 'text';
        queryInput.placeholder = '예: 현장체험학습 공문을 처리할 때 필요한 안전점검표와 계획서';
        const analyzeButton = el('button', 'discovery-primary');
        analyzeButton.type = 'button';
        analyzeButton.id = 'documentDiscoveryAnalyze';
        analyzeButton.append(icon('auto_awesome', '18px'), document.createTextNode('분석하고 추천받기'));
        queryWrap.append(queryInput, analyzeButton);
        const example = el('p', 'discovery-example');
        example.textContent = '입력 예시: 현장체험학습 공문에서 제출 서류를 확인하고 안전계획서·동의서 찾기';
        const workLabel = el('div', 'discovery-work-label');
        workLabel.append(icon('workspaces', '17px'), document.createTextNode('자주 찾는 학교 업무'));
        const quick = el('div', 'discovery-work-list');
        [
            ['academic', '학사 운영', '학사 일정과 교육과정 운영에 필요한 계획서와 서식'],
            ['student', '학생 생활', '학생 생활교육과 상담 업무에 필요한 서식'],
            ['field-trip', '현장체험학습', '현장체험학습 운영에 필요한 안전 서류와 계획서'],
            ['after-school', '방과후학교', '방과후학교 운영과 강사 계약에 필요한 자료'],
            ['committee', '학교운영위원회', '학교운영위원회 안건 처리에 필요한 계획과 서식'],
            ['budget', '예산·계약·품의', '예산 집행과 계약 및 품의에 필요한 참고 문서'],
            ['safety', '안전·보건', '학교 안전과 보건 업무에 필요한 점검표와 계획서'],
            ['training', '교직원 연수', '교직원 연수 운영에 필요한 계획서와 결과 서식']
        ].forEach(function (option) {
            const button = el('button', 'discovery-chip');
            button.type = 'button';
            button.dataset.workCategory = option[0];
            button.setAttribute('aria-pressed', 'false');
            button.textContent = option[1];
            button.addEventListener('click', function () {
                state.workCategory = option[0];
                Array.from(quick.children).forEach(function (chip) {
                    const selected = chip === button;
                    chip.classList.toggle('is-selected', selected);
                    chip.setAttribute('aria-pressed', String(selected));
                });
                queryInput.value = option[2];
                queryInput.focus();
            });
            quick.appendChild(button);
        });
        requestCard.append(queryWrap, example, workLabel, quick);
        const resultCard = el('section', 'discovery-card discovery-results');
        const resultHeader = el('div');
        resultHeader.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px';
        const resultHeading = heading('recommend', '관련 서식 및 계획서 추천', '첨부 문서와 입력한 업무 내용에 근거한 추천 결과를 보여줍니다.');
        const status = el('span');
        status.id = 'documentDiscoveryStatus';
        status.textContent = '분석 대기';
        status.style.cssText = 'flex:none;border-radius:999px;background:#f2f4f6;color:#686d77;padding:6px 10px;font-size:10px;font-weight:800';
        resultHeader.append(resultHeading, status);
        const result = el('div');
        result.id = 'documentDiscoveryResult';
        result.setAttribute('aria-live', 'polite');
        resultCard.append(resultHeader, result);

        root.append(hero, requestCard, resultCard);
        return { root, dropzone, fileInput, fileList, queryInput, quick, analyzeButton, status, result };
    }

    function bindEvents() {
        ui.dropzone.addEventListener('click', function () { ui.fileInput.click(); });
        ui.dropzone.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ui.fileInput.click(); }
        });
        ['dragenter', 'dragover'].forEach(function (name) {
            ui.dropzone.addEventListener(name, function (event) { event.preventDefault(); ui.dropzone.classList.add('is-dragging'); });
        });
        ['dragleave', 'drop'].forEach(function (name) {
            ui.dropzone.addEventListener(name, function (event) { event.preventDefault(); ui.dropzone.classList.remove('is-dragging'); });
        });
        ui.dropzone.addEventListener('drop', function (event) { addFiles(event.dataTransfer.files); });
        ui.fileInput.addEventListener('change', function () { addFiles(ui.fileInput.files); ui.fileInput.value = ''; });
        ui.analyzeButton.addEventListener('click', analyzeAndRecommend);
        ui.queryInput.addEventListener('input', function () {
            state.workCategory = '';
            Array.from(ui.quick.children).forEach(function (chip) {
                chip.classList.remove('is-selected');
                chip.setAttribute('aria-pressed', 'false');
            });
        });
        ui.queryInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') { event.preventDefault(); analyzeAndRecommend(); }
        });
    }

    function addFiles(fileList) {
        Array.from(fileList || []).forEach(function (file) {
            if (state.files.length >= MAX_FILES) return;
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            if (!ALLOWED.has(extension)) { notify('지원하지 않는 파일이 포함되어 있습니다: ' + file.name); return; }
            if (file.size > MAX_FILE_SIZE) { notify('20MB를 초과한 파일입니다: ' + file.name); return; }
            if (!state.files.some(function (saved) { return saved.name === file.name && saved.size === file.size; })) state.files.push(file);
        });
        renderFiles();
    }

    function renderFiles() {
        ui.fileList.replaceChildren();
        ui.dropzone.classList.toggle('has-files', state.files.length > 0);
        if (!state.files.length) return;
        state.files.forEach(function (file, index) {
            const row = el('div', 'discovery-file');
            const fileIcon = icon('description', '20px');
            fileIcon.style.color = '#003893';
            const copy = el('div');
            copy.style.cssText = 'flex:1;min-width:0';
            const name = el('strong');
            name.textContent = file.name;
            name.style.cssText = 'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#111214';
            const meta = el('span');
            meta.textContent = formatSize(file.size) + ' · 아직 분석하지 않음';
            meta.style.cssText = 'display:block;margin-top:2px;font-size:10px;color:#868b94';
            copy.append(name, meta);
            const remove = el('button');
            remove.type = 'button';
            remove.setAttribute('aria-label', file.name + ' 제거');
            remove.appendChild(icon('close', '18px'));
            remove.addEventListener('click', function () { state.files.splice(index, 1); renderFiles(); });
            row.append(fileIcon, copy, remove);
            ui.fileList.appendChild(row);
        });
    }

    async function analyzeAndRecommend() {
        if (state.busy) return;
        const query = ui.queryInput.value.trim();
        if (!state.files.length && !query) { notify('분석할 문서를 올리거나 찾고 싶은 업무를 적어주세요.'); return; }
        if (!state.files.length) { renderLocalSearch(query); return; }

        setBusy(true);
        try {
            if (location.protocol === 'file:') throw new Error('LOCAL_PREVIEW');
            const body = new FormData();
            state.files.forEach(function (file) { body.append('files', file, file.name); });
            body.append('query', query);
            body.append('workCategory', state.workCategory);
            body.append('mode', 'related_document_recommendation');
            const response = await fetch(API_BASE + '/api/documents/recommend', { method: 'POST', credentials: 'same-origin', body: body });
            if (!response.ok) throw new Error('HTTP_' + response.status);
            const payload = await response.json();
            if (!payload || !payload.data || !Array.isArray(payload.data.recommendations)) throw new Error('INVALID_RESPONSE');
            renderRecommendations(payload.data);
        } catch (error) {
            renderUnavailable(error);
        } finally {
            setBusy(false);
        }
    }

    function renderLocalSearch(query) {
        const terms = query.toLowerCase().split(/\s+/).filter(function (term) { return term.length > 1; });
        const matches = sourceCards.map(function (item) {
            const haystack = [item.title, item.description, item.type, item.department, item.tags].join(' ').toLowerCase();
            const score = terms.reduce(function (sum, term) { return sum + (haystack.includes(term) ? 1 : 0); }, 0);
            return { item: item, score: score };
        }).filter(function (entry) { return entry.score > 0; }).sort(function (a, b) { return b.score - a.score; });
        ui.status.textContent = '키워드 검색';
        if (!matches.length) {
            renderNotice('search_off', '일치하는 등록 자료가 없습니다.', '첨부 문서를 올리면 문서 내용 기반 추천을 요청할 수 있습니다.');
            return;
        }
        const data = { summary: '입력한 업무 내용과 등록 자료의 제목·설명을 비교했습니다.', recommendations: matches.map(function (entry) {
            return Object.assign({}, entry.item, { reason: '입력한 검색어와 등록 자료의 제목 또는 설명이 일치합니다.' });
        }) };
        renderRecommendations(data, true);
    }

    function renderRecommendations(data, localOnly) {
        ui.status.textContent = localOnly ? '키워드 검색 완료' : '문서 추천 완료';
        ui.status.style.background = '#ecfdf3';
        ui.status.style.color = '#05603a';
        const wrap = el('div');
        wrap.style.cssText = 'display:grid;gap:12px';
        if (data.summary) {
            const summary = el('div');
            summary.style.cssText = 'border-radius:14px;background:#f4f7ff;border:1px solid #d8e3fb;padding:14px;color:#343840;font-size:12px;line-height:1.6';
            summary.textContent = data.summary;
            wrap.appendChild(summary);
        }
        data.recommendations.forEach(function (recommendation) {
            const row = el('article', 'discovery-recommendation');
            const type = el('span', 'discovery-type');
            type.textContent = recommendation.type || recommendation.documentType || '관련 자료';
            const copy = el('div');
            const title = el('h3');
            title.textContent = recommendation.title || recommendation.name || '제목 없는 자료';
            title.style.cssText = 'font-size:14px;font-weight:800;color:#111214';
            const reason = el('p');
            reason.textContent = recommendation.reason || recommendation.evidence || '첨부 문서의 업무 내용과 관련된 자료입니다.';
            reason.style.cssText = 'margin-top:5px;color:#686d77;font-size:11px;line-height:1.55';
            copy.append(title, reason);
            const url = safeUrl(recommendation.url || recommendation.openUrl || '');
            if (url) {
                const link = el('a', 'discovery-link');
                link.href = url;
                link.textContent = '자료 열기 →';
                row.append(type, copy, link);
            } else {
                const pending = el('span', 'discovery-link');
                pending.textContent = '연결 준비';
                row.append(type, copy, pending);
            }
            wrap.appendChild(row);
        });
        ui.result.replaceChildren(wrap);
    }

    function renderUnavailable(error) {
        ui.status.textContent = '추천 서버 연결 필요';
        ui.status.style.background = '#fff7e6';
        ui.status.style.color = '#8a5200';
        renderNotice('cloud_off', '문서 추천 서버가 아직 연결되지 않았습니다.', '선택한 파일의 이름과 크기만 확인했으며, 내용을 추측해 추천하지 않았습니다. 서버 연결 후 같은 화면에서 관련 서식과 계획서가 표시됩니다.');
        if (error && error.message !== 'LOCAL_PREVIEW') console.warn('문서 추천 요청 실패', error);
    }

    function renderEmptyResult() {
        renderNotice('find_in_page', '분석할 문서를 기다리고 있습니다.', '공문 캡처나 업무 문서를 올리면 관련 서식·계획서 추천이 이곳에 표시됩니다.');
    }

    function renderNotice(iconName, titleText, descriptionText) {
        const empty = el('div');
        empty.style.cssText = 'min-height:145px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#686d77';
        const noticeIcon = icon(iconName, '42px');
        noticeIcon.style.color = '#9a9ea6';
        const title = el('strong');
        title.textContent = titleText;
        title.style.cssText = 'margin-top:10px;color:#343840;font-size:14px';
        const description = el('p');
        description.textContent = descriptionText;
        description.style.cssText = 'max-width:560px;margin-top:6px;font-size:11px;line-height:1.6';
        empty.append(noticeIcon, title, description);
        ui.result.replaceChildren(empty);
    }

    function setBusy(busy) {
        state.busy = busy;
        ui.analyzeButton.disabled = busy;
        ui.analyzeButton.lastChild.textContent = busy ? ' 분석 중' : '분석하고 추천받기';
        if (busy) {
            ui.status.textContent = '문서 분석 중';
            ui.status.style.background = '#eaf1ff';
            ui.status.style.color = '#003893';
            renderNotice('progress_activity', '문서 내용과 관련 자료를 찾고 있습니다.', '문서 파싱과 검색이 끝나면 추천 근거와 함께 결과를 보여드립니다.');
        }
    }

    function heading(iconName, titleText, descriptionText) {
        const wrap = el('div');
        const title = el('h2');
        title.style.cssText = 'display:flex;align-items:center;gap:8px;color:#111214;font-size:17px;font-weight:800';
        const titleIcon = icon(iconName, '21px');
        titleIcon.style.color = '#003893';
        title.append(titleIcon, document.createTextNode(titleText));
        const description = el('p');
        description.textContent = descriptionText;
        description.style.cssText = 'margin-top:6px;color:#686d77;font-size:12px;line-height:1.6';
        wrap.append(title, description);
        return wrap;
    }

    function el(tagName, className) {
        const node = document.createElement(tagName || 'div');
        if (className) node.className = className;
        return node;
    }

    function icon(name, size) {
        const node = el('span', 'material-symbols-outlined');
        node.textContent = name;
        if (size) node.style.fontSize = size;
        return node;
    }

    function formatSize(bytes) {
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
        return Math.max(1, Math.round(bytes / 1024)) + 'KB';
    }

    function safeUrl(value) {
        const url = String(value || '').trim();
        if (!url || url === '#') return '';
        if (/^(?:https?:\/\/|[^:/?#]+\.html(?:[?#].*)?$)/i.test(url)) return url;
        return '';
    }

    function notify(message) {
        if (window.EF_MODAL && typeof window.EF_MODAL.alert === 'function') window.EF_MODAL.alert(message);
        else window.alert(message);
    }
})();
