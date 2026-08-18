(function () {
    'use strict';

    if (!window.EF_RAG_CONTRIBUTIONS) return;

    var email = EF_RAG_CONTRIBUTIONS.currentEmail();
    var storageKey = 'ef_smart_plan_sources_' + email;
    var activeGroupId = null;
    var allowedExtensions = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'txt', 'xls', 'xlsx'];
    var maxFileSize = 50 * 1024 * 1024;
    var categories = window.EF_WORK_CATEGORIES ? EF_WORK_CATEGORIES.forCurrentUser() : ['교무', '학적', '연구', '학력', '학생부', '생활', '안전', '체육', '정보', '보건'];
    var currentSchoolType = window.EF_WORK_CATEGORIES ? EF_WORK_CATEGORIES.currentSchoolType() : 'elementary';
    var currentCategoryGroup = window.EF_WORK_CATEGORIES ? EF_WORK_CATEGORIES.categoryGroup(currentSchoolType) : 'early';
    var defaultSchoolLevels = currentCategoryGroup === 'secondary' ? ['secondary'] : (currentCategoryGroup === 'common' ? ['all'] : ['early']);
    var schoolLevelLabels = { all: '공통', early: '유·초등', secondary: '중·고등', kindergarten: '유치원', elementary: '초등', middle: '중학교', high: '고등학교' };
    var panel = createPanel();

    function loadSources() {
        try {
            var value = JSON.parse(localStorage.getItem(storageKey) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn('스마트 계획서 참고자료를 읽지 못했습니다.', error);
            return [];
        }
    }

    function saveSources(sources) {
        localStorage.setItem(storageKey, JSON.stringify(sources));
    }

    function makeId(prefix) {
        return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    }

    function extensionOf(name) {
        return String(name || '').split('.').pop().toLowerCase();
    }

    function sizeLabel(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async function fileHash(file) {
        if (window.crypto && window.crypto.subtle) {
            var digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
            return Array.from(new Uint8Array(digest)).map(function (byte) {
                return byte.toString(16).padStart(2, '0');
            }).join('');
        }
        return [file.name, file.size, file.lastModified].join(':');
    }

    function validateFile(file) {
        var extension = extensionOf(file.name);
        if (allowedExtensions.indexOf(extension) === -1) throw new Error('PDF, HWP/HWPX, DOC(X), TXT, XLS(X) 파일만 추가할 수 있습니다.');
        if (!file.size) throw new Error('내용이 없는 파일은 추가할 수 없습니다.');
        if (file.size > maxFileSize) throw new Error('50MB 이하 파일만 추가할 수 있습니다.');
    }

    function regroup(sources) {
        var groups = [];
        sources.sort(function (a, b) { return String(a.addedAt).localeCompare(String(b.addedAt)); });
        sources.forEach(function (source) {
            var target = groups.find(function (group) {
                return group.some(function (member) {
                    return (source.hash && source.hash === member.hash) || EF_RAG_CONTRIBUTIONS.titleSimilarity(source.name, member.name) >= 0.58;
                });
            });
            if (!target) {
                target = [];
                groups.push(target);
            }
            target.push(source);
        });
        groups.forEach(function (members) {
            var existingGroupId = members.map(function (item) { return item.groupId; }).find(Boolean);
            var groupId = existingGroupId || makeId('source-group');
            members.forEach(function (item) { item.groupId = groupId; });
        });
        return sources;
    }

    function scoreSource(source) {
        var year = Number((String(source.name).match(/20\d{2}/) || ['0'])[0]);
        var role = source.role === 'working_document' ? 10000000000000 : 0;
        return role + year * 1000000000 + new Date(source.lastUsedAt || source.addedAt || 0).getTime() / 100000;
    }

    function groupedSources() {
        var byGroup = {};
        loadSources().forEach(function (source) {
            var key = source.groupId || source.id;
            if (!byGroup[key]) byGroup[key] = [];
            byGroup[key].push(source);
        });
        return Object.keys(byGroup).map(function (groupId) {
            var members = byGroup[groupId].sort(function (a, b) { return scoreSource(b) - scoreSource(a); });
            return {
                id: groupId,
                representative: members[0],
                members: members,
                duplicateCount: members.reduce(function (sum, item) { return sum + (Number(item.duplicateCount) || 0); }, 0)
            };
        }).sort(function (a, b) { return scoreSource(b.representative) - scoreSource(a.representative); });
    }

    async function addFile(file, role) {
        validateFile(file);
        setPanelMessage(file.name + ' 중복 여부와 유사 자료를 확인하는 중입니다.', 'busy');
        var hash = await fileHash(file);
        var sources = loadSources();
        var duplicate = sources.find(function (source) { return source.hash === hash; });
        if (duplicate) {
            duplicate.duplicateCount = (Number(duplicate.duplicateCount) || 0) + 1;
            duplicate.lastUsedAt = new Date().toISOString();
            saveSources(regroup(sources));
            render();
            setPanelMessage('같은 파일은 다시 저장하지 않고 기존 자료에 사용 횟수를 합쳤습니다.', 'success');
            return duplicate;
        }
        var now = new Date().toISOString();
        sources.push({
            id: makeId('smart-source'),
            name: file.name,
            size: file.size,
            sizeLabel: sizeLabel(file.size),
            extension: extensionOf(file.name),
            hash: hash,
            role: role || 'reference',
            groupId: null,
            duplicateCount: 0,
            addedAt: now,
            lastUsedAt: now
        });
        saveSources(regroup(sources));
        render();
        setPanelMessage('참고자료를 추가했습니다. 유사한 제목과 버전은 한 묶음으로 정리했습니다.', 'success');
        return sources[sources.length - 1];
    }

    function createPanel() {
        injectStyles();
        var right = document.querySelector('.smart-plan-right');
        if (!right) return null;
        var root = document.createElement('section');
        root.id = 'smartPlanRagSources';
        root.className = 'smart-source-card';
        root.innerHTML = `
            <div class="smart-source-header">
                <div><h2>참고자료·RAG 후보</h2><p>계획서 작업에 쓴 자료를 모으고 비슷한 문서는 대표본 중심으로 정리합니다.</p></div>
                <button type="button" id="smartSourceAdd"><span class="material-symbols-outlined">add</span>자료 추가</button>
                <input type="file" id="smartSourceInput" multiple hidden accept=".pdf,.hwp,.hwpx,.doc,.docx,.txt,.xls,.xlsx">
            </div>
            <div class="smart-source-notice"><span class="material-symbols-outlined">shield_lock</span><span>추가한 자료는 기본적으로 개인 작업 자료입니다. 별도 요청과 관리자 승인 전에는 RAG에 반영되지 않습니다.</span></div>
            <p class="smart-source-summary" id="smartSourceSummary"></p>
            <p class="smart-source-message" id="smartSourceMessage" aria-live="polite"></p>
            <div class="smart-source-list" id="smartSourceList"></div>`;
        right.appendChild(root);
        root.querySelector('#smartSourceAdd').addEventListener('click', function () {
            root.querySelector('#smartSourceInput').click();
        });
        root.querySelector('#smartSourceInput').addEventListener('change', async function () {
            var files = Array.from(this.files || []);
            for (var index = 0; index < files.length; index += 1) {
                try { await addFile(files[index], 'reference'); }
                catch (error) { setPanelMessage(error.message, 'error'); }
            }
            this.value = '';
        });
        buildRequestModal();
        render();
        return root;
    }

    function createGroupCard(group) {
        var submission = EF_RAG_CONTRIBUTIONS.findByGroup(group.id) || EF_RAG_CONTRIBUTIONS.findByResource(group.representative.id);
        var meta = EF_RAG_CONTRIBUTIONS.statusMeta(submission ? submission.status : 'PRIVATE');
        var article = document.createElement('article');
        article.className = 'smart-source-group';
        var header = document.createElement('div');
        header.className = 'smart-source-group-head';
        var titleWrap = document.createElement('div');
        titleWrap.className = 'smart-source-group-title';
        var title = document.createElement('strong');
        title.textContent = group.representative.name;
        var facts = document.createElement('span');
        facts.textContent = '대표본 · 관련 버전 ' + group.members.length + '개' + (group.duplicateCount ? ' · 완전 중복 ' + group.duplicateCount + '건 합침' : '');
        if (submission) facts.textContent += ' · ' + (submission.schoolLevels || ['all']).map(function (level) { return schoolLevelLabels[level] || level; }).join('·') + ' · ' + (submission.referenceYear || '연도 미지정');
        titleWrap.append(title, facts);
        var badge = document.createElement('span');
        badge.className = 'smart-source-badge ' + meta.className;
        badge.textContent = meta.label;
        header.append(titleWrap, badge);

        var versions = document.createElement('details');
        versions.className = 'smart-source-versions';
        var summary = document.createElement('summary');
        summary.textContent = group.members.length > 1 ? '묶인 자료와 버전 보기' : '자료 정보 보기';
        var list = document.createElement('div');
        group.members.forEach(function (source, index) {
            var row = document.createElement('div');
            row.className = 'smart-source-version';
            var copy = document.createElement('span');
            copy.textContent = (index === 0 ? '대표 · ' : '') + source.name + ' · ' + source.sizeLabel;
            var remove = document.createElement('button');
            remove.type = 'button';
            remove.title = '참고자료에서 제거';
            remove.innerHTML = '<span class="material-symbols-outlined">close</span>';
            remove.addEventListener('click', function () { removeSource(source, submission); });
            row.append(copy, remove);
            list.appendChild(row);
        });
        versions.append(summary, list);

        var actionRow = document.createElement('div');
        actionRow.className = 'smart-source-actions';
        var detail = document.createElement('p');
        detail.textContent = submissionDetail(submission);
        actionRow.appendChild(detail);
        var action = document.createElement('button');
        action.type = 'button';
        if (!submission || ['WITHDRAWN', 'CHANGES_REQUESTED', 'REJECTED'].indexOf(submission.status) !== -1) {
            action.className = 'primary';
            action.textContent = submission && submission.status !== 'WITHDRAWN' ? '보완 후 재요청' : 'RAG 검토 요청';
            action.addEventListener('click', function () { openRequestModal(group, submission); });
        } else {
            action.className = 'secondary';
            action.textContent = submission.status === 'SUBMITTED' ? '검토 요청 취소' : 'RAG 반영 철회';
            action.addEventListener('click', function () { withdrawSubmission(submission); });
        }
        actionRow.appendChild(action);
        article.append(header, versions, actionRow);
        return article;
    }

    function submissionDetail(submission) {
        if (!submission) return '현재는 개인 참고자료 묶음입니다.';
        if (submission.status === 'CHANGES_REQUESTED' || submission.status === 'REJECTED') return submission.reviewReason || '관리자 의견을 반영해 다시 요청할 수 있습니다.';
        if (submission.promotionStatus === 'SUBMITTED') return '학교 승인 완료 · 광역 공유 승인 대기';
        if (submission.promotionStatus === 'APPROVED') return '교육지원청·교육청 공유 범위 승인 완료';
        if (submission.promotionStatus === 'REJECTED') return '광역 승격 반려 · 우리 학교 범위 유지';
        if (submission.status === 'APPROVED') return '우리 학교 승인 완료 · 백엔드 색인 대기';
        if (submission.status === 'ACTIVE') return '승인 범위에서 AI 답변 근거로 사용 중';
        if (submission.status === 'WITHDRAWN') return 'RAG 활용 철회 완료';
        return '관리자 검토 전에는 AI 답변에 사용되지 않습니다.';
    }

    function render() {
        if (!panel) return;
        var groups = groupedSources();
        var sourceCount = groups.reduce(function (sum, group) { return sum + group.members.length; }, 0);
        var duplicateCount = groups.reduce(function (sum, group) { return sum + group.duplicateCount; }, 0);
        panel.querySelector('#smartSourceSummary').textContent = '자료 ' + sourceCount + '개 → 유사 묶음 ' + groups.length + '개' + (duplicateCount ? ' · 완전 중복 ' + duplicateCount + '건 저장 절감' : '');
        var list = panel.querySelector('#smartSourceList');
        list.innerHTML = '';
        if (!groups.length) {
            list.innerHTML = '<div class="smart-source-empty"><span class="material-symbols-outlined">folder_open</span><p>계획서 작업 문서나 참고자료를 추가하면 이곳에서 정리합니다.</p></div>';
            return;
        }
        groups.forEach(function (group) { list.appendChild(createGroupCard(group)); });
    }

    function setPanelMessage(message, kind) {
        if (!panel) return;
        var element = panel.querySelector('#smartSourceMessage');
        element.textContent = message || '';
        element.dataset.kind = kind || '';
    }

    function buildRequestModal() {
        if (document.getElementById('smartSourceRagModal')) return;
        var modal = document.createElement('div');
        modal.id = 'smartSourceRagModal';
        modal.className = 'smart-source-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="smart-source-dialog">
                <div class="smart-source-dialog-head"><div><h3>AI 참고자료 반영 검토 요청</h3><p id="smartSourceModalName"></p></div><button type="button" data-close><span class="material-symbols-outlined">close</span></button></div>
                <form id="smartSourceRagForm">
                    <div class="smart-source-dialog-notice">유사 자료는 대표본과 관련 버전 정보로 함께 제출됩니다. 관리자가 대표본을 바꾸거나 중복 자료를 묶어 승인할 수 있습니다.</div>
                    <label><span>업무 분야</span><select id="smartSourceCategory" required></select></label>
                    <label><span>희망 공유 범위</span><select id="smartSourceScope"><option value="organization">우리 학교</option><option value="regional">교육지원청·교육청 전체 검토 요청</option></select></label>
                    <label><span>활용 설명</span><textarea id="smartSourceDescription" rows="3" required placeholder="이 자료 묶음이 어떤 계획서 업무에 도움이 되는지 적어주세요."></textarea></label>
                    <label class="check"><input type="checkbox" id="smartSourceRights" required><span>이 자료를 요청 범위에서 공유·활용할 권한이 있습니다.</span></label>
                    <label class="check"><input type="checkbox" id="smartSourcePrivacy" required><span>학생·학부모·교직원 개인정보와 민감정보가 포함되지 않았습니다.</span></label>
                    <div class="smart-source-dialog-actions"><button type="button" data-close>취소</button><button type="submit">관리자 검토 요청</button></div>
                </form>
            </div>`;
        document.body.appendChild(modal);
        var select = modal.querySelector('#smartSourceCategory');
        categories.forEach(function (category) {
            var option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
        var categoryLabel = select.closest('label');
        var levels = document.createElement('fieldset');
        levels.className = 'smart-source-levels';
        levels.innerHTML = `<legend>적용 학교급 <small>복수 선택 가능</small></legend><label><input type='checkbox' name='smartSourceSchoolLevel' value='all'><span>공통</span></label><label><input type='checkbox' name='smartSourceSchoolLevel' value='early'><span>유·초등</span></label><label><input type='checkbox' name='smartSourceSchoolLevel' value='secondary'><span>중·고등</span></label>`;
        categoryLabel.insertAdjacentElement('afterend', levels);
        var yearLabel = document.createElement('label');
        yearLabel.innerHTML = `<span>기준연도</span><input type='number' id='smartSourceReferenceYear' min='2000' max='2100' required><small>문서가 적용되는 연도입니다. 파일을 저장한 연도와 다를 수 있습니다.</small>`;
        levels.insertAdjacentElement('afterend', yearLabel);
        modal.querySelectorAll('[data-close]').forEach(function (button) { button.addEventListener('click', closeRequestModal); });
        modal.addEventListener('click', function (event) { if (event.target === modal) closeRequestModal(); });
        modal.querySelectorAll('[name=smartSourceSchoolLevel]').forEach(function (checkbox) {
            checkbox.addEventListener('change', function () {
                var all = modal.querySelector('[name=smartSourceSchoolLevel][value=all]');
                if (this.value === 'all' && this.checked) {
                    modal.querySelectorAll('[name=smartSourceSchoolLevel]:not([value=all])').forEach(function (item) { item.checked = false; });
                } else if (this.checked) {
                    all.checked = false;
                }
            });
        });
        modal.querySelector('form').addEventListener('submit', submitRequest);
    }

    function openRequestModal(group, submission) {
        activeGroupId = group.id;
        var modal = document.getElementById('smartSourceRagModal');
        modal.querySelector('#smartSourceModalName').textContent = group.representative.name + ' 외 ' + Math.max(0, group.members.length - 1) + '개 버전';
        modal.querySelector('#smartSourceCategory').value = submission ? submission.category : '기타';
        var savedLevels = submission && Array.isArray(submission.schoolLevels) && submission.schoolLevels.length ? submission.schoolLevels : defaultSchoolLevels;
        modal.querySelectorAll('[name=smartSourceSchoolLevel]').forEach(function (checkbox) { checkbox.checked = savedLevels.indexOf(checkbox.value) !== -1; });
        modal.querySelector('#smartSourceReferenceYear').value = submission && submission.referenceYear ? submission.referenceYear : String(new Date().getFullYear());
        modal.querySelector('#smartSourceScope').value = submission ? submission.requestedScope : 'organization';
        modal.querySelector('#smartSourceDescription').value = submission ? submission.description : '';
        modal.querySelector('#smartSourceRights').checked = false;
        modal.querySelector('#smartSourcePrivacy').checked = false;
        modal.hidden = false;
    }

    function closeRequestModal() {
        activeGroupId = null;
        var modal = document.getElementById('smartSourceRagModal');
        if (modal) modal.hidden = true;
    }

    function submitRequest(event) {
        event.preventDefault();
        var group = groupedSources().find(function (item) { return item.id === activeGroupId; });
        if (!group) return;
        try {
            var schoolLevels = Array.from(document.querySelectorAll('[name=smartSourceSchoolLevel]:checked')).map(function (item) { return item.value; });
            if (!schoolLevels.length) throw new Error('적용 학교급을 하나 이상 선택해 주세요.');
            EF_RAG_CONTRIBUTIONS.submit({
                id: group.representative.id,
                name: group.representative.name,
                size: group.representative.sizeLabel,
                hash: group.representative.hash
            }, {
                groupId: group.id,
                documentFamilyId: group.id,
                relatedResources: group.members.map(function (item) { return { id: item.id, name: item.name, hash: item.hash }; }),
                duplicateCount: group.duplicateCount,
                category: document.getElementById('smartSourceCategory').value,
                schoolLevels: schoolLevels,
                referenceYear: document.getElementById('smartSourceReferenceYear').value,
                requestedScope: document.getElementById('smartSourceScope').value,
                description: document.getElementById('smartSourceDescription').value.trim(),
                hasDistributionRights: document.getElementById('smartSourceRights').checked,
                containsNoPersonalData: document.getElementById('smartSourcePrivacy').checked
            });
            closeRequestModal();
            render();
            setPanelMessage('관리자 검토를 요청했습니다. 승인 전에는 AI 답변에 사용되지 않습니다.', 'success');
        } catch (error) {
            setPanelMessage(error.message, 'error');
        }
    }

    function withdrawSubmission(submission) {
        var message = submission.status === 'SUBMITTED' ? '검토 요청을 취소하시겠습니까?' : 'RAG 반영을 철회하시겠습니까?';
        confirmAction(message).then(function (ok) {
            if (!ok) return;
            EF_RAG_CONTRIBUTIONS.withdraw(submission.id);
            render();
            setPanelMessage('RAG 활용 요청을 철회했습니다.', 'success');
        });
    }

    function removeSource(source, submission) {
        var needsWithdraw = submission && submission.status !== 'WITHDRAWN';
        var message = needsWithdraw ? '검토 중이거나 승인된 묶음입니다. RAG 요청을 철회하고 이 자료를 제거할까요?' : '이 참고자료를 목록에서 제거할까요?';
        confirmAction(message).then(function (ok) {
            if (!ok) return;
            if (needsWithdraw) EF_RAG_CONTRIBUTIONS.withdraw(submission.id);
            var sources = loadSources().filter(function (item) { return item.id !== source.id; });
            saveSources(regroup(sources));
            render();
            setPanelMessage('참고자료를 제거했습니다.', 'success');
        });
    }

    function confirmAction(message) {
        if (window.EF_MODAL && typeof window.EF_MODAL.confirm === 'function') return window.EF_MODAL.confirm(message, { confirmLabel: '확인' });
        return Promise.resolve(window.confirm(message));
    }

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = `
            .smart-plan-right{display:flex;flex-direction:column;gap:16px}.smart-source-card{background:#fff;border:1px solid #e1e4e8;border-radius:16px;box-shadow:0 8px 28px rgba(17,18,20,.08);padding:18px}
            .smart-source-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}.smart-source-header h2{font-size:18px;font-weight:800;color:#111214}.smart-source-header p{font-size:11px;color:#6b7280;line-height:1.5;margin-top:4px}.smart-source-header button{display:flex;align-items:center;gap:3px;border:0;border-radius:9px;background:#064aa7;color:#fff;padding:8px 10px;font-size:11px;font-weight:800}.smart-source-header .material-symbols-outlined{font-size:16px}
            .smart-source-notice{display:flex;gap:6px;align-items:flex-start;background:#f4f7fd;border:1px solid #cfdbf4;border-radius:9px;padding:9px;margin-top:12px;font-size:10px;line-height:1.5;color:#395274}.smart-source-notice .material-symbols-outlined{font-size:15px}.smart-source-summary{font-size:11px;font-weight:800;color:#475569;margin:11px 0 3px}.smart-source-message{min-height:18px;font-size:10px;color:#64748b}.smart-source-message[data-kind=success]{color:#05603a}.smart-source-message[data-kind=error]{color:#b42318}.smart-source-message[data-kind=busy]{color:#064aa7}
            .smart-source-list{display:flex;flex-direction:column;gap:8px}.smart-source-group{border:1px solid #e1e4e8;border-radius:11px;padding:10px}.smart-source-group-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.smart-source-group-title{min-width:0}.smart-source-group-title strong{display:block;font-size:12px;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.smart-source-group-title span{display:block;font-size:9px;color:#7c8490;margin-top:3px}.smart-source-badge{flex:none;border-radius:999px;padding:4px 6px;font-size:9px;font-weight:800}.smart-source-versions{margin-top:8px}.smart-source-versions summary{font-size:10px;color:#42618a;cursor:pointer}.smart-source-version{display:flex;align-items:center;gap:4px;padding:5px 0;border-top:1px solid #eef0f3;font-size:9px;color:#667085}.smart-source-version span{min-width:0;flex:1;word-break:break-all}.smart-source-version button{border:0;background:transparent;color:#9aa0aa}.smart-source-version .material-symbols-outlined{font-size:14px}.smart-source-actions{display:flex;align-items:end;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #eef0f3}.smart-source-actions p{font-size:9px;line-height:1.4;color:#667085}.smart-source-actions button{flex:none;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:800}.smart-source-actions button.primary{border:0;background:#064aa7;color:#fff}.smart-source-actions button.secondary{border:1px solid #d7dce3;background:#fff;color:#667085}.smart-source-empty{text-align:center;padding:20px 8px;color:#89909a}.smart-source-empty .material-symbols-outlined{font-size:28px}.smart-source-empty p{font-size:10px;line-height:1.5;margin-top:5px}
            .smart-source-modal{position:fixed;inset:0;z-index:140;background:rgba(17,18,20,.58);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:14px}.smart-source-modal[hidden]{display:none}.smart-source-dialog{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.25)}.smart-source-dialog-head{display:flex;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid #e1e4e8}.smart-source-dialog-head h3{font-size:18px;font-weight:800}.smart-source-dialog-head p{font-size:11px;color:#667085;margin-top:3px}.smart-source-dialog-head button{border:0;background:transparent}.smart-source-dialog form{display:flex;flex-direction:column;gap:12px;padding:18px}.smart-source-dialog-notice{background:#f4f7fd;border:1px solid #cfdbf4;border-radius:9px;padding:10px;font-size:11px;line-height:1.55;color:#395274}.smart-source-dialog label{display:flex;flex-direction:column;gap:5px}.smart-source-dialog label>span{font-size:12px;font-weight:800}.smart-source-dialog select,.smart-source-dialog textarea,.smart-source-dialog input[type=number]{border:1px solid #cbd0d8;border-radius:9px;padding:9px;font-size:12px}.smart-source-dialog label>small{font-size:9px;color:#7c8490}.smart-source-levels{display:flex;flex-wrap:wrap;gap:7px;border:1px solid #e1e4e8;border-radius:10px;padding:10px}.smart-source-levels legend{font-size:12px;font-weight:800;padding:0 3px}.smart-source-levels legend small{font-size:9px;font-weight:500;color:#7c8490}.smart-source-levels label{display:flex;flex-direction:row;align-items:center;gap:4px;border:1px solid #d7dce3;border-radius:999px;padding:5px 8px}.smart-source-levels label>span{font-size:10px}.smart-source-dialog label.check{flex-direction:row;align-items:flex-start;font-size:11px;color:#596273}.smart-source-dialog label.check>span{font-size:11px;font-weight:500}.smart-source-dialog-actions{display:flex;justify-content:flex-end;gap:6px;padding-top:10px;border-top:1px solid #e1e4e8}.smart-source-dialog-actions button{border:0;border-radius:999px;padding:9px 14px;font-size:11px;font-weight:800}.smart-source-dialog-actions button:last-child{background:#064aa7;color:#fff}
            @media(max-width:960px){.smart-plan-right{position:static}.smart-source-card{order:2}}`;
        document.head.appendChild(style);
    }

    window.addEventListener('ef:smart-plan-file-opened', function (event) {
        if (!event.detail || !event.detail.file) return;
        addFile(event.detail.file, 'working_document').catch(function (error) { setPanelMessage(error.message, 'error'); });
    });
    window.addEventListener(EF_RAG_CONTRIBUTIONS.eventName, render);
})();
