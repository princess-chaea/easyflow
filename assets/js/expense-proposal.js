(function () {
    'use strict';

    const API_BASE = String((window.EF_CONFIG && window.EF_CONFIG.apiBase) || '').replace(/\/$/, '');
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const ALLOWED_EXTENSIONS = new Set(['pdf', 'hwp', 'hwpx', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png', 'webp']);
    const MODES = {
        A: {
            label: '유형 A · 관련 문서 있음',
            description: '관련 문서번호를 나중에 입력할 수 있는 품의서 초안을 만듭니다.'
        },
        B: {
            label: '유형 B · 관련 문서 없음',
            description: '관련 문서 없이 바로 사용할 수 있는 품의서 초안을 만듭니다.'
        },
        ITEMS: {
            label: '품목내역 파일만',
            description: '품의서 본문 없이 K-에듀파인 업로드용 CSV만 만듭니다.'
        }
    };

    const state = {
        mode: 'A',
        file: null,
        result: null,
        busy: false
    };

    const byId = id => document.getElementById(id);
    const modeButtons = Array.from(document.querySelectorAll('[data-expense-mode]'));

    function showToast(message, type) {
        const toast = byId('expenseToast');
        const icon = toast.querySelector('[data-toast-icon]');
        const text = toast.querySelector('[data-toast-text]');
        toast.dataset.type = type || 'success';
        icon.textContent = type === 'error' ? 'error' : 'check_circle';
        text.textContent = message;
        toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => {
            toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
        }, 3000);
    }

    function setStep(step) {
        document.querySelectorAll('[data-expense-step]').forEach(node => {
            const value = Number(node.dataset.expenseStep);
            node.classList.toggle('is-active', value === step);
            node.classList.toggle('is-complete', value < step);
        });
    }

    function setMode(mode) {
        if (!MODES[mode]) return;
        state.mode = mode;
        modeButtons.forEach(button => {
            const selected = button.dataset.expenseMode === mode;
            button.setAttribute('aria-pressed', String(selected));
            button.classList.toggle('is-selected', selected);
        });
        byId('expenseModeSummary').textContent = MODES[mode].label;
        byId('expenseModeDescription').textContent = MODES[mode].description;
        byId('draftResultPanel').hidden = mode === 'ITEMS';

        setStep(state.file ? 2 : 1);
    }

    function getExtension(fileName) {
        const index = String(fileName || '').lastIndexOf('.');
        return index === -1 ? '' : fileName.slice(index + 1).toLowerCase();
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 1024) return (bytes || 0) + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function chooseFile(file) {
        if (!file) return;
        const extension = getExtension(file.name);
        if (!ALLOWED_EXTENSIONS.has(extension)) {
            showToast('지원하지 않는 파일 형식입니다.', 'error');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showToast('파일은 20MB 이하만 올릴 수 있습니다.', 'error');
            return;
        }

        state.file = file;
        state.result = null;
        byId('expenseResult').hidden = true;
        byId('expenseFileEmpty').hidden = true;
        byId('expenseFileSelected').hidden = false;
        byId('expenseDropzone').classList.add('has-file');
        byId('expenseFileName').textContent = file.name;
        byId('expenseFileMeta').textContent = extension.toUpperCase() + ' · ' + formatBytes(file.size);
        byId('expenseAnalyzeButton').disabled = false;
        byId('expenseAnalyzeStatus').textContent = '파일을 확인했습니다. 분석을 시작해 주세요.';
        setStep(2);

    }

    function resetFile() {
        state.file = null;
        state.result = null;
        byId('expenseFileInput').value = '';
        byId('expenseFileEmpty').hidden = false;
        byId('expenseFileSelected').hidden = true;
        byId('expenseDropzone').classList.remove('has-file');
        byId('expenseAnalyzeButton').disabled = true;
        byId('expenseResult').hidden = true;
        byId('expenseAnalyzeStatus').textContent = '분석할 견적서 파일을 선택해 주세요.';
        setStep(1);
    }

    function parseNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const normalized = String(value == null ? '' : value).replace(/[^0-9.-]/g, '');
        const number = Number(normalized);
        return Number.isFinite(number) ? number : 0;
    }

    function parseCsvRows(text) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        const source = String(text || '').replace(/^\uFEFF/, '');

        for (let i = 0; i < source.length; i += 1) {
            const char = source[i];
            if (quoted) {
                if (char === '"' && source[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    field += char;
                }
                continue;
            }
            if (char === '"') {
                quoted = true;
            } else if (char === ',') {
                row.push(field.trim());
                field = '';
            } else if (char === '\n') {
                row.push(field.trim());
                if (row.some(Boolean)) rows.push(row);
                row = [];
                field = '';
            } else if (char !== '\r') {
                field += char;
            }
        }
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        return rows;
    }

    function findHeaderIndex(headers, candidates) {
        const normalized = headers.map(header => String(header || '').replace(/\s+/g, '').toLowerCase());
        for (const candidate of candidates) {
            const index = normalized.indexOf(candidate.replace(/\s+/g, '').toLowerCase());
            if (index !== -1) return index;
        }
        return -1;
    }

    async function analyzeCsvLocally(file) {
        const rows = parseCsvRows(await file.text());
        if (rows.length < 2) {
            throw new Error('CSV에 분석할 품목 행이 없습니다.');
        }
        const headers = rows[0];
        const indexes = {
            content: findHeaderIndex(headers, ['내용', '품명', '상품명', '제품명', '품목', '물품명']),
            specification: findHeaderIndex(headers, ['규격', '옵션', '사양']),
            unit: findHeaderIndex(headers, ['단위']),
            quantity: findHeaderIndex(headers, ['수량', '개수', '주문수량']),
            unitPrice: findHeaderIndex(headers, ['예상단가', '단가', '가격', '판매가']),
            amount: findHeaderIndex(headers, ['금액', '합계', '공급가액', '총액'])
        };
        if (indexes.content === -1) {
            throw new Error('품명 열을 찾지 못했습니다. 내용·품명·상품명 중 하나의 열이 필요합니다.');
        }

        const items = rows.slice(1).map(row => {
            const quantity = indexes.quantity === -1 ? 1 : parseNumber(row[indexes.quantity]) || 1;
            const unitPrice = indexes.unitPrice === -1 ? 0 : parseNumber(row[indexes.unitPrice]);
            const amount = indexes.amount === -1 ? quantity * unitPrice : parseNumber(row[indexes.amount]);
            return {
                content: String(row[indexes.content] || '').trim(),
                specification: indexes.specification === -1 ? '' : String(row[indexes.specification] || '').trim(),
                unit: indexes.unit === -1 ? '' : String(row[indexes.unit] || '').trim(),
                quantity,
                unitPrice: unitPrice || (quantity ? amount / quantity : 0),
                amount
            };
        }).filter(item => item.content);

        if (!items.length) throw new Error('CSV에서 유효한 품목을 찾지 못했습니다.');
        return {
            source: { fileName: file.name, parser: 'browser-csv' },
            items,
            totalAmount: items.reduce((sum, item) => sum + item.amount, 0)
        };
    }

    async function analyzeWithBackend(file) {
        if (location.protocol === 'file:' && !API_BASE) {
            throw new Error('문서 분석 서버가 연결되지 않았습니다.');
        }
        const body = new FormData();
        body.append('file', file, file.name);
        body.append('draftType', state.mode === 'ITEMS' ? 'items_only' : state.mode);
        body.append('workContext', byId('expenseWorkContext').value.trim());

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 45000);
        try {
            const response = await fetch(API_BASE + '/api/expense-proposals/analyze', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
                body,
                signal: controller.signal
            });
            if (!response.ok) {
                let message = '견적서 분석에 실패했습니다.';
                try {
                    const errorBody = await response.json();
                    message = (errorBody.error && errorBody.error.message) || errorBody.message || message;
                } catch (error) {
                    // 표준 오류 본문이 아닐 때는 기본 안내를 사용한다.
                }
                throw new Error(message);
            }
            const json = await response.json();
            return json.data || json;
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function normalizeItem(raw) {
        const quantity = Math.max(0, parseNumber(raw.quantity == null ? raw.qty : raw.quantity));
        const unitPrice = Math.max(0, parseNumber(raw.unitPrice == null ? raw.expectedUnitPrice : raw.unitPrice));
        const amount = Math.max(0, parseNumber(raw.amount == null ? raw.total : raw.amount)) || quantity * unitPrice;
        return {
            content: String(raw.content || raw.name || raw.itemName || raw.title || '').trim(),
            specification: String(raw.specification || raw.spec || '').trim(),
            unit: String(raw.unit || '').trim(),
            quantity: quantity || 1,
            unitPrice: unitPrice || (quantity ? amount / quantity : 0),
            amount
        };
    }

    function normalizeResult(raw) {
        const source = raw.source || {};
        const rawItems = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.lineItems) ? raw.lineItems : []);
        const items = rawItems.map(normalizeItem).filter(item => item.content);
        if (!items.length) throw new Error('분석 결과에 품목 정보가 없습니다.');
        return {
            source: {
                fileName: String(source.fileName || (state.file && state.file.name) || ''),
                supplier: String(source.supplier || raw.supplier || ''),
                quoteDate: String(source.quoteDate || raw.quoteDate || ''),
                parser: String(source.parser || 'server')
            },
            items,
            suggestedTitle: String(raw.suggestedTitle || raw.title || ''),
            purpose: String(raw.purpose || ''),
            totalAmount: Math.max(0, parseNumber(raw.totalAmount)) || items.reduce((sum, item) => sum + item.amount, 0)
        };
    }

    function startManualEntry() {
        state.result = normalizeResult({
            source: { fileName: state.file ? state.file.name : '직접 입력', parser: 'manual' },
            items: [{ content: '품목명을 입력하세요', specification: '', unit: '', quantity: 1, unitPrice: 0, amount: 0 }]
        });
        renderResult();
    }

    function setBusy(busy) {
        state.busy = busy;
        byId('expenseAnalyzeButton').disabled = busy || !state.file;
        byId('expenseAnalyzeSpinner').hidden = !busy;
        byId('expenseAnalyzeLabel').textContent = busy ? '견적서 분석 중' : '견적서 분석 시작';
    }

    async function analyzeExpenseFile() {
        if (state.busy) return;
        if (!state.file) {
            showToast('먼저 견적서 파일을 선택해주세요.', 'error');
            return;
        }

        setBusy(true);
        setStep(3);
        byId('expenseAnalyzeStatus').textContent = '업로드한 견적서의 품목과 금액을 확인하고 있습니다.';

        try {
            const extension = getExtension(state.file.name);
            const raw = extension === 'csv' ? await analyzeCsvLocally(state.file) : await analyzeWithBackend(state.file);
            state.result = normalizeResult(raw);
            renderResult();
            byId('expenseAnalyzeStatus').textContent = '분석이 끝났습니다. 품목과 금액을 검토해 주세요.';
            showToast('견적서 분석이 완료되었습니다.');
        } catch (error) {
            let message = error && error.name === 'AbortError'
                ? '분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
                : (error.message || '견적서 분석에 실패했습니다.');
            if (/page could not be found|failed to fetch|404/i.test(message)) {
                message = '견적서 분석 서버가 아직 연결되지 않았습니다.';
            }
            byId('expenseAnalyzeStatus').textContent = message + ' 품목 직접 입력으로 계속할 수 있습니다.';
            setStep(2);
            showToast(message, 'error');
        } finally {
            setBusy(false);
        }
    }

    function formatNumber(value) {
        return Math.round(parseNumber(value)).toLocaleString('ko-KR');
    }

    function groupToKorean(group) {
        const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
        const units = ['', '십', '백', '천'];
        let result = '';
        for (let position = 3; position >= 0; position -= 1) {
            const divisor = Math.pow(10, position);
            const digit = Math.floor(group / divisor) % 10;
            if (!digit) continue;
            if (digit !== 1 || position === 0) result += digits[digit];
            result += units[position];
        }
        return result;
    }

    function numberToKorean(value) {
        const number = Math.max(0, Math.floor(parseNumber(value)));
        if (!number) return '영';
        const bigUnits = ['', '만', '억', '조', '경'];
        let remaining = number;
        let unitIndex = 0;
        const parts = [];
        while (remaining > 0 && unitIndex < bigUnits.length) {
            const group = remaining % 10000;
            if (group) parts.unshift(groupToKorean(group) + bigUnits[unitIndex]);
            remaining = Math.floor(remaining / 10000);
            unitIndex += 1;
        }
        return parts.join('');
    }

    function suggestPurpose(items, workContext) {
        const names = items.map(item => String(item.content || '').trim()).filter(Boolean);
        const text = names.join(' ').toLowerCase();
        const context = String(workContext || '').replace(/\s+/g, ' ').trim();
        if (context) return context + ' 추진을 위한 ' + (names[0] || '필요 물품') + ' 구입';
        if (/마우스|키보드|모니터|노트북|태블릿|컴퓨터|프린터|복사기|토너|usb|케이블|공유기|네트워크|소프트웨어/.test(text)) return '학교 정보화 및 행정 업무의 원활한 추진';
        if (/도서|교구|학습|실험|수업|교육|과학|미술|음악|체육/.test(text)) return '학생 교육 활동의 원활한 운영 지원';
        if (/청소|세제|위생|방역|소독|마스크|보건/.test(text)) return '쾌적하고 위생적인 교육 환경 조성';
        if (/시설|보수|수리|전구|조명|공구|소방|안전/.test(text)) return '안전하고 쾌적한 교육 환경 조성';
        if (/연수|행사|회의|홍보|현수막/.test(text)) return '학교 행사 및 교직원 업무의 원활한 운영';
        if (/사무|문구|용지|파일|봉투|스테이플러/.test(text)) return '학교 행정 업무의 원활한 추진';
        const representative = names[0] || '필요 물품';
        return representative + ' 구입을 통한 학교 업무 지원';
    }

    function suggestTitle(items) {
        const first = String(items[0] && items[0].content || '물품').replace(/\s+/g, ' ').trim();
        const shortName = first.length > 24 ? first.slice(0, 24).trim() : first;
        return shortName + (items.length > 1 ? ' 외 ' + (items.length - 1) + '종 구입' : ' 구입');
    }

    function recalculateResult() {
        if (!state.result) return;
        state.result.items.forEach(item => {
            item.quantity = Math.max(0, parseNumber(item.quantity));
            item.unitPrice = Math.max(0, parseNumber(item.unitPrice));
            item.amount = item.quantity * item.unitPrice;
        });
        state.result.totalAmount = state.result.items.reduce((sum, item) => sum + item.amount, 0);
        byId('expenseTotalAmount').textContent = formatNumber(state.result.totalAmount) + '원';
        byId('expenseItemCount').textContent = state.result.items.length + '건';
    }

    function buildDraft(options) {
        if (!state.result) return;
        recalculateResult();
        const items = state.result.items;
        const refreshSuggestions = Boolean(options && options.refreshSuggestions);
        const suggestedTitle = refreshSuggestions ? suggestTitle(items) : (state.result.suggestedTitle || suggestTitle(items));
        const suggestedPurpose = refreshSuggestions ? suggestPurpose(items, byId('expenseWorkContext').value) : (state.result.purpose || suggestPurpose(items, byId('expenseWorkContext').value));
        const title = refreshSuggestions ? suggestedTitle : (byId('expenseDraftTitle').value.trim() || suggestedTitle);
        const purpose = refreshSuggestions ? suggestedPurpose : (byId('expensePurpose').value.trim() || suggestedPurpose);
        const representative = items[0] ? items[0].content : '물품';
        const otherCount = Math.max(0, items.length - 1);
        const amount = state.result.totalAmount;
        const basis = items.map(item => {
            const unit = item.unit ? item.unit : '개';
            return formatNumber(item.unitPrice) + '원 × ' + formatNumber(item.quantity) + unit + ' = ' + formatNumber(item.amount) + '원';
        }).join(', ');
        let body;
        if (state.mode === 'A') {
            body = '1. 관련: 문서번호\n' +
                '2. ' + title + '을 아래와 같이 추진하고자 합니다.\n' +
                '  가. 목적: ' + purpose + '\n' +
                '  나. 품명: ' + representative + ' 외 ' + otherCount + '종\n' +
                '  다. 소요 예산: 금' + formatNumber(amount) + '원(금' + numberToKorean(amount) + '원)\n' +
                '  라. 산출 근거: ' + basis + ' (필요시 작성하거나 삭제하세요.)\n\n' +
                '붙임  지출품의서 1부.  끝.';
        } else {
            body = title + '을 아래와 같이 추진하고자 합니다.\n' +
                '1. 목적: ' + purpose + '\n' +
                '2. 품명: ' + representative + ' 외 ' + otherCount + '종\n' +
                '3. 소요 예산: 금' + formatNumber(amount) + '원(금' + numberToKorean(amount) + '원)\n' +
                '4. 산출 근거: ' + basis + ' (필요시 작성하거나 삭제하세요.)\n\n' +
                '붙임  지출품의서 1부.  끝.';
        }
        byId('expenseDraftTitle').value = title;
        byId('expensePurpose').value = purpose;
        byId('expenseDraftBody').value = body;
    }

    function createTextInput(value, label, onInput) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value == null ? '' : value;
        input.setAttribute('aria-label', label);
        input.className = 'expense-table-input';
        input.addEventListener('input', () => onInput(input.value));
        return input;
    }

    function renderItemsTable() {
        const body = byId('expenseItemsBody');
        body.replaceChildren();
        state.result.items.forEach((item, index) => {
            const row = document.createElement('tr');

            const contentCell = document.createElement('td');
            contentCell.appendChild(createTextInput(item.content, '품명', value => { item.content = value; }));

            const specCell = document.createElement('td');
            specCell.appendChild(createTextInput(item.specification, '규격', value => { item.specification = value; }));

            const unitCell = document.createElement('td');
            unitCell.appendChild(createTextInput(item.unit, '단위', value => { item.unit = value; }));

            const quantityCell = document.createElement('td');
            quantityCell.appendChild(createTextInput(item.quantity, '수량', value => {
                item.quantity = parseNumber(value);
                recalculateResult();
                renderAmountCell(row, item);
            }));

            const priceCell = document.createElement('td');
            priceCell.appendChild(createTextInput(item.unitPrice, '예상단가', value => {
                item.unitPrice = parseNumber(value);
                recalculateResult();
                renderAmountCell(row, item);
            }));

            const amountCell = document.createElement('td');
            amountCell.dataset.amountCell = 'true';
            amountCell.className = 'expense-amount-cell';
            amountCell.textContent = formatNumber(item.amount) + '원';

            const actionCell = document.createElement('td');
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'expense-row-remove';
            remove.setAttribute('aria-label', (index + 1) + '번째 품목 삭제');
            remove.innerHTML = '<span class="material-symbols-outlined">delete</span>';
            remove.addEventListener('click', () => {
                if (state.result.items.length === 1) {
                    showToast('품목은 최소 1개가 필요합니다.', 'error');
                    return;
                }
                state.result.items.splice(index, 1);
                recalculateResult();
                renderItemsTable();
            });
            actionCell.appendChild(remove);

            row.append(contentCell, specCell, unitCell, quantityCell, priceCell, amountCell, actionCell);
            body.appendChild(row);
        });
    }

    function renderAmountCell(row, item) {
        const cell = row.querySelector('[data-amount-cell]');
        if (cell) cell.textContent = formatNumber(item.amount) + '원';
    }

    function renderResult() {
        recalculateResult();
        byId('expenseResult').hidden = false;
        byId('expenseSourceFile').textContent = state.result.source.fileName || '업로드 견적서';
        byId('expenseSupplier').textContent = state.result.source.supplier || '견적서에서 확인 필요';
        byId('expenseQuoteDate').textContent = state.result.source.quoteDate || '견적서에서 확인 필요';
        byId('expenseDraftTitle').value = state.result.suggestedTitle || suggestTitle(state.result.items);
        byId('expensePurpose').value = state.result.purpose || suggestPurpose(state.result.items, byId('expenseWorkContext').value);
        byId('draftResultPanel').hidden = state.mode === 'ITEMS';
        renderItemsTable();
        buildDraft();
        setStep(4);
        byId('expenseResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function addItem() {
        if (!state.result) return;
        state.result.items.push({ content: '', specification: '', unit: '', quantity: 1, unitPrice: 0, amount: 0 });
        recalculateResult();
        renderItemsTable();
    }

    function escapeCsv(value) {
        const text = String(value == null ? '' : value);
        return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }

    function downloadBlob(content, type, fileName) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadItemsCsv() {
        if (!state.result) return;
        recalculateResult();
        const rows = [['내용', '규격', '단위', '수량', '예상단가']];
        state.result.items.forEach(item => {
            rows.push([item.content, item.specification, item.unit, item.quantity, Math.round(item.unitPrice)]);
        });
        const csv = '\uFEFF' + rows.map(row => row.map(escapeCsv).join(',')).join('\r\n') + '\r\n';
        downloadBlob(csv, 'text/csv;charset=utf-8', 'K에듀파인_품목내역_' + new Date().toISOString().slice(0, 10) + '.csv');
        showToast('K-에듀파인 품목내역 CSV를 만들었습니다.');
    }


    async function copyText(text, successMessage) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        showToast(successMessage);
    }

    function bindEvents() {
        modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.expenseMode)));

        const fileInput = byId('expenseFileInput');
        fileInput.addEventListener('change', event => chooseFile(event.target.files && event.target.files[0]));
        byId('expenseFileButton').addEventListener('click', () => fileInput.click());
        byId('expenseFileRemove').addEventListener('click', resetFile);
        byId('expenseAnalyzeButton').addEventListener('click', analyzeExpenseFile);
        byId('expenseManualButton').addEventListener('click', startManualEntry);

        const dropzone = byId('expenseDropzone');
        ['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, event => {
            event.preventDefault();
            dropzone.classList.add('is-dragging');
        }));
        ['dragleave', 'drop'].forEach(name => dropzone.addEventListener(name, event => {
            event.preventDefault();
            dropzone.classList.remove('is-dragging');
        }));
        dropzone.addEventListener('drop', event => chooseFile(event.dataTransfer.files && event.dataTransfer.files[0]));

        byId('expenseAddItem').addEventListener('click', addItem);
        byId('expenseRegenerate').addEventListener('click', () => {
            buildDraft({ refreshSuggestions: true });
            showToast('수정한 품목 기준으로 품의서를 다시 만들었습니다.');
        });
        byId('expenseDownloadCsv').addEventListener('click', downloadItemsCsv);
        byId('expenseCopyTitle').addEventListener('click', () => copyText(byId('expenseDraftTitle').value, '제목을 복사했습니다.'));
        byId('expenseCopyBody').addEventListener('click', () => copyText(byId('expenseDraftBody').value, '본문을 복사했습니다.'));

    }

    function initialize() {
        bindEvents();
        setMode('A');
        setStep(1);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
