const RHWP_MODULE_URL = new URL('../vendor/rhwp-editor/index.js', import.meta.url).href;
const RHWP_STUDIO_URL = new URL('../../rhwp/index.html', import.meta.url).href;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const fileInput = document.getElementById('web-hwp-file');
const openButton = document.getElementById('btn-web-hwp-open');
const reopenButton = document.getElementById('btn-web-hwp-reopen');
const fullscreenButton = document.getElementById('btn-web-hwp-fullscreen');
const saveHwpButton = document.getElementById('btn-web-hwp-save-hwp');
const saveHwpxButton = document.getElementById('btn-web-hwp-save-hwpx');
const dropZone = document.getElementById('web-hwp-drop-zone');
const status = document.getElementById('web-hwp-status');
const workspace = document.getElementById('web-hwp-workspace');
const fileName = document.getElementById('web-hwp-filename');
const pageInfo = document.getElementById('web-hwp-page-info');
const editorCard = document.getElementById('web-hwp-editor-card');

let editor = null;
let currentFile = null;

function setStatus(message, type) {
    status.textContent = message;
    status.classList.remove('success', 'error');
    if (type) status.classList.add(type);
}

function setBusy(busy, message) {
    openButton.disabled = busy;
    reopenButton.disabled = busy;
    fullscreenButton.disabled = busy || !currentFile;
    saveHwpButton.disabled = busy || !currentFile;
    saveHwpxButton.disabled = busy || !currentFile;
    if (message) setStatus(message);
}

function readableError(error) {
    const raw = error && error.message ? error.message : String(error || '');
    if (/파일을 선택|내용이 없는|50MB|HWP 또는 HWPX|실제 형식|HWP 저장 전/.test(raw)) return raw;
    if (/timeout|timed out/i.test(raw)) return '편집기 응답이 늦어지고 있습니다. 잠시 뒤 다시 시도해 주세요.';
    if (/failed to fetch|network|load/i.test(raw)) return '웹 편집기를 불러오지 못했습니다. 사이트 배포 파일과 인터넷 연결을 확인해 주세요.';
    if (/opaque|null origin|file:/i.test(raw)) return '이 편집기는 웹 주소(http/https)에서만 열립니다. 사이트 주소로 접속해 주세요.';
    return '파일을 열거나 저장하지 못했습니다. 다른 사본으로 다시 시도해 주세요. (' + raw + ')';
}

async function validateFile(file) {
    if (!file) throw new Error('파일을 선택해 주세요.');
    if (file.size <= 0) throw new Error('내용이 없는 파일입니다.');
    if (file.size > MAX_FILE_SIZE) throw new Error('50MB 이하의 파일만 열 수 있습니다.');

    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (extension !== 'hwp' && extension !== 'hwpx') {
        throw new Error('HWP 또는 HWPX 파일만 선택해 주세요.');
    }

    const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isHwp = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
        .every(function (value, index) { return signature[index] === value; });
    const isHwpx = signature[0] === 0x50 && signature[1] === 0x4b;
    if ((extension === 'hwp' && !isHwp) || (extension === 'hwpx' && !isHwpx)) {
        throw new Error('파일 이름과 실제 형식이 맞지 않습니다. 원본 파일을 다시 확인해 주세요.');
    }
}

async function ensureEditor() {
    if (editor) return editor;
    if (location.protocol === 'file:') {
        throw new Error('file: 주소에서는 웹 편집기를 연결할 수 없습니다.');
    }
    workspace.hidden = false;
    const module = await import(RHWP_MODULE_URL);
    editor = await module.createEditor('#web-hwp-editor', {
        studioUrl: RHWP_STUDIO_URL,
        renderer: 'auto',
        height: '720px',
        requestTimeoutMs: 90000
    });
    return editor;
}

async function openFile(file) {
    try {
        setBusy(true, '파일 형식을 확인하고 있습니다...');
        await validateFile(file);
        setStatus('웹 편집기를 준비하는 중입니다. 처음 한 번은 조금 걸릴 수 있습니다...');
        const activeEditor = await ensureEditor();
        setStatus('문서를 여는 중입니다...');
        const result = await activeEditor.loadFile(await file.arrayBuffer(), file.name, {
            skipUnsavedGuard: false,
            suppressDialogs: true
        });
        currentFile = file;
        fileName.textContent = file.name;
        const count = result && Number.isFinite(result.pageCount)
            ? result.pageCount
            : await activeEditor.pageCount();
        pageInfo.textContent = count + '쪽 · 편집한 뒤 원하는 형식으로 수정본을 저장하세요.';
        setStatus('문서를 열었습니다. 아래 편집 화면에서 바로 수정할 수 있습니다.', 'success');
        dropZone.hidden = true;
        workspace.hidden = false;
        workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        setStatus(readableError(error), 'error');
        if (!editor) workspace.hidden = true;
    } finally {
        setBusy(false);
        fileInput.value = '';
    }
}

function updateFullscreenButton() {
    const active = document.fullscreenElement === editorCard;
    fullscreenButton.setAttribute('aria-pressed', String(active));
    const icon = fullscreenButton.querySelector('.material-symbols-outlined');
    const label = fullscreenButton.querySelector('span:last-child');
    if (icon) icon.textContent = active ? 'fullscreen_exit' : 'fullscreen';
    if (label) label.textContent = active ? '전체화면 닫기' : '전체화면';
}

async function toggleFullscreen() {
    try {
        if (!document.fullscreenElement) {
            if (!editorCard.requestFullscreen) throw new Error('FULLSCREEN_UNAVAILABLE');
            await editorCard.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        setStatus('이 브라우저에서는 전체화면을 열 수 없습니다. 브라우저를 최신 버전으로 업데이트해 주세요.', 'error');
    }
}
function downloadBytes(bytes, format) {
    const baseName = currentFile.name.replace(/\.(hwp|hwpx)$/i, '');
    const outputName = baseName + '_수정본.' + format;
    const mime = format === 'hwp'
        ? 'application/x-hwp'
        : 'application/vnd.hancom.hwpx';
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = outputName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    return outputName;
}

async function saveFile(format) {
    if (!editor || !currentFile) {
        setStatus('먼저 편집할 파일을 열어주세요.', 'error');
        return;
    }
    try {
        setBusy(true, format.toUpperCase() + ' 수정본을 준비하고 있습니다...');
        if (format === 'hwp') {
            const verify = await editor.exportHwpVerify();
            if (!verify.recovered || verify.pageCountBefore !== verify.pageCountAfter) {
                throw new Error('HWP 저장 전 문서 확인을 통과하지 못했습니다. HWPX 수정본으로 저장해 주세요.');
            }
        }
        const bytes = format === 'hwp' ? await editor.exportHwp() : await editor.exportHwpx();
        const outputName = downloadBytes(bytes, format);
        try {
            await editor.notifySaved(outputName);
        } catch (notifyError) {
            // 구버전 편집기는 저장 완료 알림을 지원하지 않을 수 있습니다.
        }
        setStatus(outputName + ' 다운로드를 시작했습니다. 원본 파일은 그대로 있습니다.', 'success');
    } catch (error) {
        setStatus(readableError(error), 'error');
    } finally {
        setBusy(false);
    }
}

openButton.addEventListener('click', function () { fileInput.click(); });
reopenButton.addEventListener('click', function () { fileInput.click(); });
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFullscreenButton);
fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) openFile(fileInput.files[0]);
});
saveHwpButton.addEventListener('click', function () { saveFile('hwp'); });
saveHwpxButton.addEventListener('click', function () { saveFile('hwpx'); });

['dragenter', 'dragover'].forEach(function (eventName) {
    dropZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropZone.classList.add('dragover');
    });
});
['dragleave', 'drop'].forEach(function (eventName) {
    dropZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropZone.classList.remove('dragover');
    });
});
dropZone.addEventListener('drop', function (event) {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) openFile(file);
});

if (location.protocol === 'file:') {
    setStatus('웹 편집 기능은 사이트 주소(http/https)로 접속했을 때 사용할 수 있습니다.', 'error');
}
setBusy(false);
