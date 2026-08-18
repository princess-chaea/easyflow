(function () {
    'use strict';

    if (!window.EF_RAG_CONTRIBUTIONS) return;

    var organization = EF_RAG_CONTRIBUTIONS.organizationFor();
    var activeGroup = null;
    var representativeOptions = [];
    var reviewSection = null;
    var schoolLevelLabels = { all: '공통', early: '유·초등', secondary: '중·고등', kindergarten: '유치원', elementary: '초등', middle: '중학교', high: '고등학교' };
    var workCategories = window.EF_WORK_CATEGORIES ? EF_WORK_CATEGORIES.forCurrentUser() : ['교무', '학적', '연구', '학력', '학생부', '생활', '안전', '체육', '정보', '보건'];
    var currentSchoolType = window.EF_WORK_CATEGORIES ? EF_WORK_CATEGORIES.currentSchoolType() : 'elementary';

    function escapeHtml(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function formatDate(value) {
        if (!value) return '-';
        try { return new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }); }
        catch (error) { return value; }
    }

    function currentItems() {
        return EF_RAG_CONTRIBUTIONS.byOrganization(organization).filter(function (item) {
            return item.status !== 'WITHDRAWN';
        });
    }

    function pendingItems() {
        return currentItems().filter(function (item) {
            return ['SUBMITTED', 'UNDER_REVIEW'].indexOf(item.status) !== -1;
        });
    }

    function reviewGroups() {
        return EF_RAG_CONTRIBUTIONS.similarityGroups(pendingItems());
    }

    function createReviewSection() {
        injectStyles();
        var hint = document.getElementById('ragChecklistHint');
        if (!hint) return null;
        var section = document.createElement('section');
        section.id = 'schoolRagReviewQueue';
        section.className = 'school-rag-section';
        section.innerHTML = `
            <div class="school-rag-head"><div><p class="school-rag-eyebrow">USER CONTRIBUTION REVIEW</p><h2>사용자 자료 승인 대기함</h2><p>같은 학교의 요청만 검토하며 유사 자료는 대표본 중심으로 묶어 승인할 수 있습니다.</p></div><span id="schoolRagPendingBadge">0건 대기</span></div>
            <div class="school-rag-stats" id="schoolRagStats"></div>
            <div class="school-rag-queue" id="schoolRagQueue"></div>`;
        hint.insertAdjacentElement('afterend', section);
        buildReviewModal();
        return section;
    }

    function renderStats(items) {
        var counts = {
            pending: items.filter(function (item) { return ['SUBMITTED', 'UNDER_REVIEW'].indexOf(item.status) !== -1; }).length,
            changes: items.filter(function (item) { return item.status === 'CHANGES_REQUESTED'; }).length,
            approved: items.filter(function (item) { return ['APPROVED', 'INDEXING', 'ACTIVE'].indexOf(item.status) !== -1; }).length,
            promotion: items.filter(function (item) { return item.promotionStatus === 'SUBMITTED'; }).length
        };
        reviewSection.querySelector('#schoolRagStats').innerHTML =
            statCard('pending_actions', '검토 대기', counts.pending, 'warning') +
            statCard('edit_document', '보완 요청', counts.changes, 'primary') +
            statCard('verified', '학교 승인', counts.approved, 'success') +
            statCard('upgrade', '광역 승격 대기', counts.promotion, 'secondary');
        reviewSection.querySelector('#schoolRagPendingBadge').textContent = counts.pending + '건 대기';
    }

    function statCard(icon, label, count, tone) {
        return '<div class="school-rag-stat ' + tone + '"><span class="material-symbols-outlined">' + icon + '</span><div><strong>' + count + '</strong><small>' + label + '</small></div></div>';
    }

    function renderQueue() {
        if (!reviewSection) return;
        var items = currentItems();
        var groups = reviewGroups();
        renderStats(items);
        var queue = reviewSection.querySelector('#schoolRagQueue');
        queue.innerHTML = '';
        if (!groups.length) {
            queue.innerHTML = '<div class="school-rag-empty"><span class="material-symbols-outlined">task_alt</span><p>현재 검토 대기 중인 사용자 자료가 없습니다.</p></div>';
        } else {
            groups.forEach(function (group) { queue.appendChild(createGroupCard(group)); });
        }
        renderManagedSources(items);
    }

    function createGroupCard(group) {
        var representative = group.representative;
        var related = [];
        group.members.forEach(function (item) {
            var resources = Array.isArray(item.relatedResources) && item.relatedResources.length
                ? item.relatedResources
                : [{ id: item.resourceId, name: item.resourceName, hash: item.fileHash || '' }];
            resources.forEach(function (resource) {
                if (!related.some(function (saved) { return saved.id === resource.id; })) related.push(resource);
            });
        });
        var card = document.createElement('article');
        card.className = 'school-rag-group';
        var names = group.members.map(function (item) { return item.resourceName; });
        card.innerHTML = `
            <div class="school-rag-group-top">
                <div class="school-rag-file-icon"><span class="material-symbols-outlined">folder_copy</span></div>
                <div class="school-rag-copy"><div class="school-rag-tags"><span>검토 대기</span><span>${group.members.length > 1 ? '유사자료 ' + group.members.length + '건' : '단일 자료'}</span>${group.exactDuplicateCount ? '<span>완전 중복 ' + group.exactDuplicateCount + '건</span>' : ''}</div><h3></h3><p></p></div>
                <button type="button" class="school-rag-review-btn">${group.members.length > 1 ? '묶음 검토' : '검토하기'}</button>
            </div>
            <details><summary>제출 자료와 버전 보기</summary><div class="school-rag-member-list"></div></details>`;
        card.querySelector('h3').textContent = representative.resourceName;
        var groupTags = card.querySelectorAll('.school-rag-tags span');
        if (groupTags[1]) groupTags[1].textContent = related.length > 1 || group.members.length > 1 ? '관련 버전 ' + related.length + '개' : '단일 자료';
        card.querySelector('.school-rag-review-btn').textContent = related.length > 1 || group.members.length > 1 ? '묶음 검토' : '검토하기';
        var levels = (representative.schoolLevels || ['all']).map(function (level) { return schoolLevelLabels[level] || level; }).join('·');
        card.querySelector('.school-rag-copy>p').textContent = representative.organization + ' · ' + representative.category + ' · ' + levels + ' · ' + (representative.referenceYear || '연도 미지정') + ' · ' + formatDate(representative.submittedAt);
        var memberList = card.querySelector('.school-rag-member-list');
        related.forEach(function (resource, index) {
            var row = document.createElement('div');
            row.innerHTML = '<span class="material-symbols-outlined">' + (index === 0 ? 'star' : 'description') + '</span><div><strong></strong><small></small></div>';
            row.querySelector('strong').textContent = resource.name;
            row.querySelector('small').textContent = index === 0 ? '자동 추천 대표본' : '같은 업무의 유사·개정 자료';
            memberList.appendChild(row);
        });
        card.querySelector('.school-rag-review-btn').addEventListener('click', function () { openReviewModal(group); });
        return card;
    }

    function buildReviewModal() {
        if (document.getElementById('schoolRagReviewModal')) return;
        var modal = document.createElement('div');
        modal.id = 'schoolRagReviewModal';
        modal.className = 'school-rag-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="school-rag-dialog">
                <div class="school-rag-dialog-head"><div><p>RAG REVIEW</p><h3>자료 묶음 검토</h3></div><button type="button" data-close><span class="material-symbols-outlined">close</span></button></div>
                <div class="school-rag-dialog-body">
                    <div class="school-rag-auto-checks"><div><span class="material-symbols-outlined">verified_user</span><strong>보안·악성파일 검사</strong><small>백엔드 연결 전 데모 확인</small></div><div><span class="material-symbols-outlined">person_off</span><strong>개인정보 탐지</strong><small>백엔드 연결 전 데모 확인</small></div><div><span class="material-symbols-outlined">content_copy</span><strong>중복·유사도 분석</strong><small id="schoolRagSimilarityResult"></small></div></div>
                    <label><span>승인할 대표 자료</span><select id="schoolRagRepresentative"></select></label>
                    <div class="school-rag-request-info" id="schoolRagRequestInfo"></div>
                    <label><span>검토 의견</span><textarea id="schoolRagReviewReason" rows="3" placeholder="승인 근거 또는 보완·반려 사유를 입력하세요."></textarea></label>
                </div>
                <div class="school-rag-dialog-actions"><button type="button" data-decision="reject" class="danger">반려</button><button type="button" data-decision="request_changes" class="outline">보완 요청</button><button type="button" data-decision="approve" class="primary">대표본 승인</button></div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('[data-close]').addEventListener('click', closeReviewModal);
        modal.addEventListener('click', function (event) { if (event.target === modal) closeReviewModal(); });
        modal.querySelectorAll('[data-decision]').forEach(function (button) {
            button.addEventListener('click', function () { decide(button.dataset.decision); });
        });
    }

    function openReviewModal(group) {
        activeGroup = group;
        representativeOptions = [];
        var modal = document.getElementById('schoolRagReviewModal');
        var select = modal.querySelector('#schoolRagRepresentative');
        select.innerHTML = '';
        group.members.forEach(function (item) {
            var resources = Array.isArray(item.relatedResources) && item.relatedResources.length
                ? item.relatedResources
                : [{ id: item.resourceId, name: item.resourceName, hash: item.fileHash || '' }];
            resources.forEach(function (resource) {
                if (representativeOptions.some(function (candidate) { return candidate.resource.id === resource.id; })) return;
                representativeOptions.push({ submissionId: item.id, resource: resource });
                var option = document.createElement('option');
                option.value = String(representativeOptions.length - 1);
                option.textContent = resource.name + ' · ' + item.requesterEmail;
                select.appendChild(option);
            });
        });
        var recommendedIndex = representativeOptions.findIndex(function (candidate) {
            return candidate.submissionId === group.representative.id && candidate.resource.id === group.representative.resourceId;
        });
        select.value = String(recommendedIndex >= 0 ? recommendedIndex : 0);
        modal.querySelector('#schoolRagSimilarityResult').textContent = representativeOptions.length > 1 ? '유사·개정 후보 ' + representativeOptions.length + '건 · 대표본 추천 완료' : '유사 후보 없음';
        var representative = group.representative;
        var levels = (representative.schoolLevels || ['all']).map(function (level) { return schoolLevelLabels[level] || level; }).join('·');
        modal.querySelector('#schoolRagRequestInfo').innerHTML =
            '<strong>요청 정보</strong><p>' + escapeHtml(representative.description || '설명 없음') + '</p><span>분야 ' + escapeHtml(representative.category) + ' · 학교급 ' + escapeHtml(levels) + ' · 기준연도 ' + escapeHtml(representative.referenceYear || '미지정') + ' · 희망 범위 ' + (representative.requestedScope === 'regional' ? '교육지원청·교육청 전체' : '우리 학교') + '</span>';
        modal.querySelector('#schoolRagReviewReason').value = '';
        modal.hidden = false;
    }

    function closeReviewModal() {
        activeGroup = null;
        var modal = document.getElementById('schoolRagReviewModal');
        if (modal) modal.hidden = true;
    }

    function decide(decision) {
        if (!activeGroup) return;
        var selectedIndex = Number(document.getElementById('schoolRagRepresentative').value);
        var selected = representativeOptions[selectedIndex];
        if (!selected) { EF_MODAL.alert('대표 자료를 선택해 주세요.'); return; }
        var reason = document.getElementById('schoolRagReviewReason').value.trim();
        if (decision !== 'approve' && !reason) {
            EF_MODAL.alert('보완 또는 반려 사유를 입력해 주세요.');
            return;
        }
        try {
            EF_RAG_CONTRIBUTIONS.selectRepresentative(selected.submissionId, selected.resource);
            if (decision === 'approve' && activeGroup.members.length > 1) {
                EF_RAG_CONTRIBUTIONS.schoolConsolidate(activeGroup.members.map(function (item) { return item.id; }), selected.submissionId, reason || '유사자료 대표본 승인');
            } else if (decision === 'approve') {
                EF_RAG_CONTRIBUTIONS.schoolReview(selected.submissionId, 'approve', reason || '학교 범위 승인');
            } else {
                activeGroup.members.forEach(function (item) {
                    EF_RAG_CONTRIBUTIONS.schoolReview(item.id, decision, reason);
                });
            }
            closeReviewModal();
            renderQueue();
            EF_MODAL.alert(decision === 'approve' ? '대표 자료를 승인했습니다. 승인 전 중복 자료는 대표본에 묶어 정리했습니다.' : (decision === 'reject' ? '자료를 반려했습니다.' : '보완을 요청했습니다.'));
        } catch (error) {
            EF_MODAL.alert(error.message);
        }
    }

    function renderManagedSources(items) {
        var container = document.getElementById('ragUploadList');
        var count = document.getElementById('ragUploadCount');
        if (!container) return;
        var managed = items.filter(function (item) {
            return ['APPROVED', 'INDEXING', 'ACTIVE', 'CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED'].indexOf(item.status) !== -1;
        }).sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
        if (count) count.textContent = managed.length + '건';
        var heading = container.parentElement.querySelector('h3');
        if (heading) heading.textContent = '검토·승인 이력';
        if (!managed.length) {
            container.innerHTML = '<p class="p-xl text-center font-body-sm text-body-sm text-muted">아직 검토 이력이 없습니다.</p>';
            return;
        }
        container.innerHTML = managed.map(function (item) {
            var meta = EF_RAG_CONTRIBUTIONS.statusMeta(item.status);
            var merged = item.mergedIntoSubmissionId ? ' · 대표 자료에 통합' : '';
            var promotion = item.promotionStatus === 'SUBMITTED' ? ' · 광역 승격 대기' : '';
            return '<div class="flex items-center gap-base px-xl py-base"><div class="w-10 h-10 bg-primary-fixed rounded-lg flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined">description</span></div><div class="flex-1 min-w-0"><p class="font-body-strong text-body-strong text-on-surface truncate">' + escapeHtml(item.resourceName) + '</p><p class="font-caption text-caption text-muted">' + escapeHtml(item.requesterEmail) + ' · ' + escapeHtml(formatDate(item.updatedAt)) + escapeHtml(merged + promotion) + '</p></div><span class="px-sm py-xxs rounded-full font-caption-strong text-[11px] shrink-0 ' + meta.className + '">' + meta.label + '</span></div>';
        }).join('');
    }

    async function hashFile(file) {
        if (!window.crypto || !window.crypto.subtle) return [file.name, file.size, file.lastModified].join(':');
        var digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    }

    function replaceUploadHandlers() {
        var oldZone = document.getElementById('ragDropZone');
        if (!oldZone) return;
        var zone = oldZone.cloneNode(true);
        oldZone.replaceWith(zone);
        var input = zone.querySelector('#ragFileInput');
        var status = document.getElementById('ragUploadStatus');
        var progress = document.getElementById('ragUploadProgress');
        var metaBar = document.createElement('div');
        metaBar.className = 'school-rag-upload-meta';
        metaBar.innerHTML = `<label><span>적용 학교급</span><select id='schoolUploadSchoolLevel'><option value='all'>공통</option><option value='early'>유·초등</option><option value='secondary'>중·고등</option></select></label><label><span>기준연도</span><input id='schoolUploadReferenceYear' type='number' min='2000' max='2100' value='${new Date().getFullYear()}'></label><label><span>업무분야</span><select id='schoolUploadCategory'></select></label>`;
        zone.insertAdjacentElement('beforebegin', metaBar);
        var uploadCategory = metaBar.querySelector('#schoolUploadCategory');
        workCategories.forEach(function (category) {
            var option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            uploadCategory.appendChild(option);
        });
        var uploadSchoolLevel = metaBar.querySelector('#schoolUploadSchoolLevel');
        var currentGroup = window.EF_WORK_CATEGORIES ? EF_WORK_CATEGORIES.categoryGroup(currentSchoolType) : 'early';
        uploadSchoolLevel.value = currentGroup === 'secondary' ? 'secondary' : (currentGroup === 'common' ? 'all' : 'early');
        zone.querySelector('.font-title-md').textContent = '학교 공식 자료를 검토 대기로 등록';
        zone.querySelector('.text-muted').textContent = '등록 후 아래 승인 대기함에서 검토해야 하며 자동 벡터화되지 않습니다.';

        async function handle(files) {
            var selected = Array.from(files || []);
            if (!selected.length) return;
            var ok = await EF_MODAL.confirm('선택한 ' + selected.length + '개 파일을 학교 자료 검토 대기로 등록할까요?', { confirmLabel: '검토 대기 등록' });
            if (!ok) return;
            for (var index = 0; index < selected.length; index += 1) {
                var file = selected[index];
                status.textContent = file.name + ' 중복 확인 중...';
                progress.style.width = Math.round((index / selected.length) * 100) + '%';
                var hash = await hashFile(file);
                EF_RAG_CONTRIBUTIONS.submit({ id: 'school-resource-' + Date.now() + '-' + index, name: file.name, size: file.size + ' bytes', hash: hash }, {
                    origin: 'school_admin_upload', category: document.getElementById('schoolUploadCategory').value || '교무', schoolLevels: [document.getElementById('schoolUploadSchoolLevel').value], referenceYear: document.getElementById('schoolUploadReferenceYear').value, description: '학교관리자 직접 등록 자료', requestedScope: 'organization', hasDistributionRights: true, containsNoPersonalData: true
                });
            }
            progress.style.width = '100%';
            status.textContent = '검토 대기 등록 완료 · 승인 전 RAG 미반영';
            renderQueue();
            setTimeout(function () { progress.style.width = '0%'; status.textContent = '대기 중'; }, 2500);
        }

        ['dragenter', 'dragover'].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.add('border-primary', 'bg-primary-fixed'); }); });
        ['dragleave', 'drop'].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove('border-primary', 'bg-primary-fixed'); }); });
        zone.addEventListener('drop', function (event) { handle(event.dataTransfer.files); });
        input.addEventListener('change', function () { handle(this.files); this.value = ''; });
    }

    function updatePageCopy() {
        var heading = document.querySelector('main h1');
        var lead = heading && heading.nextElementSibling;
        if (heading) heading.textContent = 'RAG 자료 검토·갱신';
        if (lead) lead.textContent = '우리 학교 사용자 자료를 검토하고 유사 자료를 대표본 중심으로 정리한 뒤 승인합니다.';
        document.querySelectorAll('a[href$="학교관리자_RAG데이터갱신.html"]').forEach(function (link) {
            if (link.textContent.trim() === 'RAG 데이터 갱신') link.textContent = 'RAG 자료 검토·갱신';
        });
    }

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = `
            .school-rag-section{background:#fff;border:1px solid #e1e4e8;border-radius:16px;margin-bottom:20px;overflow:hidden;box-shadow:0 6px 22px rgba(17,18,20,.06)}.school-rag-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:20px;border-bottom:1px solid #e8eaed}.school-rag-eyebrow{font-size:10px;font-weight:900;letter-spacing:.12em;color:#0b57d0}.school-rag-head h2{font-size:20px;font-weight:800;color:#111214;margin-top:3px}.school-rag-head p:not(.school-rag-eyebrow){font-size:12px;color:#69707c;margin-top:5px}.school-rag-head>span{border-radius:999px;background:#fff7e6;color:#8a5200;padding:6px 9px;font-size:11px;font-weight:800}.school-rag-upload-meta{display:grid;grid-template-columns:1fr 1fr 2fr;gap:8px;margin-bottom:10px}.school-rag-upload-meta label{display:flex;flex-direction:column;gap:4px}.school-rag-upload-meta span{font-size:10px;font-weight:800;color:#596273}.school-rag-upload-meta select,.school-rag-upload-meta input{border:1px solid #cbd0d8;border-radius:9px;padding:8px;font-size:11px;background:#fff}
            .school-rag-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 20px;background:#f8f9fb}.school-rag-stat{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e1e4e8;border-radius:10px;padding:9px}.school-rag-stat .material-symbols-outlined{font-size:19px}.school-rag-stat strong{display:block;font-size:16px}.school-rag-stat small{display:block;font-size:9px;color:#7c8490}.school-rag-stat.warning{color:#9a5b00}.school-rag-stat.primary{color:#064aa7}.school-rag-stat.success{color:#05603a}.school-rag-stat.secondary{color:#6d3fc0}
            .school-rag-queue{padding:16px 20px;display:flex;flex-direction:column;gap:9px}.school-rag-group{border:1px solid #dfe3e8;border-radius:12px;padding:13px}.school-rag-group-top{display:flex;align-items:flex-start;gap:10px}.school-rag-file-icon{width:38px;height:38px;border-radius:10px;background:#eaf1ff;color:#064aa7;display:grid;place-items:center}.school-rag-copy{flex:1;min-width:0}.school-rag-tags{display:flex;gap:4px;flex-wrap:wrap}.school-rag-tags span{background:#f2f4f7;border-radius:999px;padding:3px 6px;font-size:9px;font-weight:800;color:#596273}.school-rag-copy h3{font-size:13px;font-weight:800;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.school-rag-copy>p{font-size:10px;color:#7c8490;margin-top:3px}.school-rag-review-btn{border:0;border-radius:9px;background:#064aa7;color:#fff;padding:8px 10px;font-size:11px;font-weight:800}.school-rag-group details{margin-top:9px;border-top:1px solid #eef0f3;padding-top:7px}.school-rag-group summary{font-size:10px;color:#42618a;cursor:pointer}.school-rag-member-list>div{display:flex;gap:7px;align-items:flex-start;padding:7px 2px;border-top:1px solid #f0f1f3}.school-rag-member-list .material-symbols-outlined{font-size:15px;color:#0b57d0}.school-rag-member-list strong{display:block;font-size:10px}.school-rag-member-list small{display:block;font-size:9px;color:#7c8490}.school-rag-empty{text-align:center;padding:24px;color:#7c8490}.school-rag-empty p{font-size:11px;margin-top:4px}
            .school-rag-modal{position:fixed;inset:0;z-index:150;background:rgba(17,18,20,.58);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:14px}.school-rag-modal[hidden]{display:none}.school-rag-dialog{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:17px;box-shadow:0 24px 70px rgba(0,0,0,.28)}.school-rag-dialog-head{display:flex;justify-content:space-between;padding:17px 20px;border-bottom:1px solid #e1e4e8}.school-rag-dialog-head p{font-size:9px;font-weight:900;letter-spacing:.12em;color:#0b57d0}.school-rag-dialog-head h3{font-size:19px;font-weight:800}.school-rag-dialog-head button{border:0;background:transparent}.school-rag-dialog-body{padding:18px 20px;display:flex;flex-direction:column;gap:13px}.school-rag-auto-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.school-rag-auto-checks>div{border:1px solid #dfe3e8;background:#f8f9fb;border-radius:10px;padding:10px}.school-rag-auto-checks .material-symbols-outlined{font-size:18px;color:#05603a}.school-rag-auto-checks strong{display:block;font-size:10px;margin-top:4px}.school-rag-auto-checks small{display:block;font-size:9px;color:#7c8490;margin-top:2px}.school-rag-dialog label{display:flex;flex-direction:column;gap:5px}.school-rag-dialog label>span{font-size:11px;font-weight:800}.school-rag-dialog select,.school-rag-dialog textarea{border:1px solid #cbd0d8;border-radius:9px;padding:9px;font-size:12px}.school-rag-request-info{background:#f4f7fd;border:1px solid #cfdbf4;border-radius:10px;padding:10px}.school-rag-request-info strong{font-size:11px}.school-rag-request-info p{font-size:11px;line-height:1.5;margin-top:4px}.school-rag-request-info span{font-size:9px;color:#667085}.school-rag-dialog-actions{display:flex;justify-content:flex-end;gap:7px;padding:14px 20px;border-top:1px solid #e1e4e8}.school-rag-dialog-actions button{border-radius:999px;padding:9px 14px;font-size:11px;font-weight:800}.school-rag-dialog-actions .danger{border:1px solid #d92d20;background:#fff;color:#b42318}.school-rag-dialog-actions .outline{border:1px solid #cbd0d8;background:#fff;color:#596273}.school-rag-dialog-actions .primary{border:0;background:#064aa7;color:#fff}
            @media(max-width:760px){.school-rag-upload-meta{grid-template-columns:1fr}.school-rag-stats{grid-template-columns:repeat(2,1fr)}.school-rag-auto-checks{grid-template-columns:1fr}.school-rag-group-top{flex-wrap:wrap}.school-rag-review-btn{width:100%}}`;
        document.head.appendChild(style);
    }

    function init() {
        updatePageCopy();
        reviewSection = createReviewSection();
        replaceUploadHandlers();
        renderQueue();
        window.addEventListener(EF_RAG_CONTRIBUTIONS.eventName, renderQueue);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
