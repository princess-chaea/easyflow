(function () {
    'use strict';

    if (!window.EF_RAG_CONTRIBUTIONS) return;

    var section = null;
    var activeGroup = null;
    var schoolLevelLabels = { all: '공통', early: '유·초등', secondary: '중·고등', kindergarten: '유치원', elementary: '초등', middle: '중학교', high: '고등학교' };

    function escapeHtml(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function promotionGroups() {
        return EF_RAG_CONTRIBUTIONS.similarityGroups(EF_RAG_CONTRIBUTIONS.promotionQueue());
    }

    function createSection() {
        injectStyles();
        var uploadGrid = document.getElementById('drop-zone');
        uploadGrid = uploadGrid && uploadGrid.closest('.grid');
        if (!uploadGrid) return null;
        var root = document.createElement('section');
        root.id = 'serverRagPromotionQueue';
        root.className = 'server-rag-section';
        root.innerHTML = `
            <div class="server-rag-head"><div><p>REGIONAL KNOWLEDGE REVIEW</p><h2>광역 공유 승격 승인</h2><span>학교에서 1차 승인한 자료 중 교육지원청·교육청 전체 공유 요청을 검토합니다.</span></div><strong id="serverRagPendingCount">0건 대기</strong></div>
            <div class="server-rag-summary" id="serverRagSummary"></div>
            <div class="server-rag-list" id="serverRagList"></div>`;
        uploadGrid.insertAdjacentElement('beforebegin', root);
        buildModal();
        return root;
    }

    function render() {
        if (!section) return;
        var groups = promotionGroups();
        var total = groups.reduce(function (sum, group) { return sum + group.members.length; }, 0);
        var organizations = new Set();
        groups.forEach(function (group) { group.members.forEach(function (item) { organizations.add(item.organization); }); });
        section.querySelector('#serverRagPendingCount').textContent = total + '건 대기';
        section.querySelector('#serverRagSummary').innerHTML =
            '<div><span class="material-symbols-outlined">pending_actions</span><strong>' + total + '</strong><small>승격 요청</small></div>' +
            '<div><span class="material-symbols-outlined">folder_copy</span><strong>' + groups.length + '</strong><small>유사자료 묶음</small></div>' +
            '<div><span class="material-symbols-outlined">domain</span><strong>' + organizations.size + '</strong><small>요청 기관</small></div>';
        var list = section.querySelector('#serverRagList');
        list.innerHTML = '';
        if (!groups.length) {
            list.innerHTML = '<div class="server-rag-empty"><span class="material-symbols-outlined">task_alt</span><p>현재 광역 공유 승인 대기 자료가 없습니다.</p></div>';
        } else {
            groups.forEach(function (group) { list.appendChild(createGroupCard(group)); });
        }
        renderPromotedSources();
    }

    function createGroupCard(group) {
        var representative = group.representative;
        var organizations = Array.from(new Set(group.members.map(function (item) { return item.organization; })));
        var card = document.createElement('article');
        card.className = 'server-rag-group';
        card.innerHTML = `
            <div class="server-rag-group-icon"><span class="material-symbols-outlined">upgrade</span></div>
            <div class="server-rag-group-copy"><div><span>학교 승인 완료</span><span>${group.members.length > 1 ? '유사자료 ' + group.members.length + '건' : '단일 자료'}</span></div><h3></h3><p></p></div>
            <button type="button">${group.members.length > 1 ? '대표본 검토' : '승격 검토'}</button>`;
        card.querySelector('h3').textContent = representative.resourceName;
        var levels = (representative.schoolLevels || ['all']).map(function (level) { return schoolLevelLabels[level] || level; }).join('·');
        card.querySelector('p').textContent = organizations.join(', ') + ' · ' + representative.category + ' · ' + levels + ' · ' + (representative.referenceYear || '연도 미지정');
        card.querySelector('button').addEventListener('click', function () { openModal(group); });
        return card;
    }

    function buildModal() {
        if (document.getElementById('serverRagPromotionModal')) return;
        var modal = document.createElement('div');
        modal.id = 'serverRagPromotionModal';
        modal.className = 'server-rag-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="server-rag-dialog">
                <div class="server-rag-dialog-head"><div><p>REGIONAL SCOPE REVIEW</p><h3>광역 공유 대표본 검토</h3></div><button type="button" data-close><span class="material-symbols-outlined">close</span></button></div>
                <div class="server-rag-dialog-body">
                    <div class="server-rag-rule"><span class="material-symbols-outlined">account_tree</span><p>비슷한 자료가 여러 학교에서 올라온 경우 대표본 한 건만 광역 범위로 승인하고, 나머지는 각 학교 범위 승인을 유지합니다.</p></div>
                    <label><span>광역 공유 대표 자료</span><select id="serverRagRepresentative"></select></label>
                    <div class="server-rag-members" id="serverRagMembers"></div>
                    <label><span>최종 검토 의견</span><textarea id="serverRagReason" rows="3" placeholder="승인 근거 또는 광역 승격 반려 사유를 입력하세요."></textarea></label>
                </div>
                <div class="server-rag-dialog-actions"><button type="button" class="danger" data-decision="reject">전체 광역 승격 반려</button><button type="button" class="primary" data-decision="approve">대표본 광역 승인</button></div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('[data-close]').addEventListener('click', closeModal);
        modal.addEventListener('click', function (event) { if (event.target === modal) closeModal(); });
        modal.querySelectorAll('[data-decision]').forEach(function (button) {
            button.addEventListener('click', function () { decide(button.dataset.decision); });
        });
    }

    function openModal(group) {
        activeGroup = group;
        var modal = document.getElementById('serverRagPromotionModal');
        var select = modal.querySelector('#serverRagRepresentative');
        var members = modal.querySelector('#serverRagMembers');
        select.innerHTML = '';
        members.innerHTML = '';
        group.members.forEach(function (item) {
            var option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.resourceName + ' · ' + item.organization;
            select.appendChild(option);
            var row = document.createElement('div');
            row.innerHTML = '<span class="material-symbols-outlined">verified</span><div><strong></strong><small></small></div>';
            row.querySelector('strong').textContent = item.resourceName;
            var levels = (item.schoolLevels || ['all']).map(function (level) { return schoolLevelLabels[level] || level; }).join('·');
            row.querySelector('small').textContent = item.organization + ' · ' + levels + ' · ' + (item.referenceYear || '연도 미지정') + ' · 학교 승인자 ' + ((item.schoolReview && item.schoolReview.reviewerEmail) || '-');
            members.appendChild(row);
        });
        select.value = group.representative.id;
        modal.querySelector('#serverRagReason').value = '';
        modal.hidden = false;
    }

    function closeModal() {
        activeGroup = null;
        var modal = document.getElementById('serverRagPromotionModal');
        if (modal) modal.hidden = true;
    }

    function decide(decision) {
        if (!activeGroup) return;
        var reason = document.getElementById('serverRagReason').value.trim();
        if (decision === 'reject' && !reason) {
            EF_MODAL.alert('광역 승격 반려 사유를 입력해 주세요.');
            return;
        }
        var representativeId = document.getElementById('serverRagRepresentative').value;
        try {
            activeGroup.members.forEach(function (item) {
                var approve = decision === 'approve' && item.id === representativeId;
                var itemReason = approve ? (reason || '유사자료 대표본 광역 승인') : (decision === 'approve' ? '유사자료 대표본에 광역 공유를 통합하고 학교 범위는 유지' : reason);
                EF_RAG_CONTRIBUTIONS.serverPromotionReview(item.id, approve ? 'approve' : 'reject', itemReason);
            });
            closeModal();
            render();
            EF_MODAL.alert(decision === 'approve' ? '대표 자료를 광역 범위로 승인했습니다. 유사 자료는 학교 범위 승인을 유지합니다.' : '선택한 묶음의 광역 승격을 반려했습니다. 학교 범위 승인은 유지됩니다.');
        } catch (error) {
            EF_MODAL.alert(error.message);
        }
    }

    function renderPromotedSources() {
        var body = document.getElementById('dsTableBody');
        if (!body) return;
        body.querySelectorAll('[data-user-rag-source]').forEach(function (row) { row.remove(); });
        var promoted = EF_RAG_CONTRIBUTIONS.all().filter(function (item) { return item.promotionStatus === 'APPROVED'; });
        promoted.reverse().forEach(function (item) {
            var row = document.createElement('tr');
            row.setAttribute('data-user-rag-source', item.id);
            row.className = 'hover:bg-surface-container-low transition-colors';
            row.innerHTML =
                '<td class="px-xl py-lg"><div class="flex items-center gap-base"><div class="w-10 h-10 bg-secondary-fixed rounded-lg flex items-center justify-center text-on-secondary-fixed-variant"><span class="material-symbols-outlined">group_work</span></div><div><div class="font-body-strong text-body-strong">' + escapeHtml(item.resourceName) + '</div><div class="font-caption text-caption text-muted">사용자 기여 · ' + escapeHtml(item.organization) + '</div></div></div></td>' +
                '<td class="px-xl py-lg"><span class="font-body-sm text-body-sm text-on-surface-variant">User Contribution</span></td>' +
                '<td class="px-xl py-lg"><div class="flex items-center gap-xs"><span class="w-2 h-2 rounded-full bg-warning"></span><span class="font-body-sm text-body-sm text-warning font-bold">Index Pending</span></div></td>' +
                '<td class="px-xl py-lg"><div class="font-number-display text-body-sm">' + escapeHtml(new Date(item.updatedAt).toLocaleDateString('ko-KR')) + '</div></td>' +
                '<td class="px-xl py-lg"><div class="font-number-display text-body-sm text-muted">백엔드 산정</div></td>' +
                '<td class="px-xl py-lg text-right"><span class="text-[11px] font-bold text-secondary">광역 승인 완료</span></td>';
            body.insertBefore(row, body.firstChild);
        });
    }

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = `
            .server-rag-section{background:#fff;border:1px solid #dedfe3;border-radius:16px;overflow:hidden;margin-bottom:20px;box-shadow:0 7px 24px rgba(17,18,20,.06)}.server-rag-head{display:flex;justify-content:space-between;gap:16px;padding:20px;border-bottom:1px solid #e5e7eb}.server-rag-head p{font-size:9px;font-weight:900;letter-spacing:.13em;color:#6d3fc0}.server-rag-head h2{font-size:20px;font-weight:800;margin-top:3px}.server-rag-head span{display:block;font-size:12px;color:#69707c;margin-top:5px}.server-rag-head>strong{height:max-content;border-radius:999px;background:#f1eafe;color:#6d3fc0;padding:6px 9px;font-size:11px}
            .server-rag-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:13px 20px;background:#f8f9fb}.server-rag-summary>div{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e1e4e8;border-radius:10px;padding:9px}.server-rag-summary .material-symbols-outlined{font-size:19px;color:#6d3fc0}.server-rag-summary strong{font-size:16px}.server-rag-summary small{font-size:9px;color:#7c8490;margin-left:4px}.server-rag-list{padding:15px 20px;display:flex;flex-direction:column;gap:8px}.server-rag-group{display:flex;gap:10px;align-items:flex-start;border:1px solid #dfe3e8;border-radius:11px;padding:12px}.server-rag-group-icon{width:38px;height:38px;border-radius:10px;background:#f1eafe;color:#6d3fc0;display:grid;place-items:center}.server-rag-group-copy{flex:1;min-width:0}.server-rag-group-copy>div{display:flex;gap:4px}.server-rag-group-copy span{border-radius:999px;background:#f2f4f7;padding:3px 6px;font-size:9px;font-weight:800;color:#596273}.server-rag-group-copy h3{font-size:13px;font-weight:800;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.server-rag-group-copy p{font-size:10px;color:#7c8490;margin-top:3px}.server-rag-group>button{border:0;border-radius:9px;background:#6d3fc0;color:#fff;padding:8px 10px;font-size:11px;font-weight:800}.server-rag-empty{text-align:center;padding:23px;color:#7c8490}.server-rag-empty p{font-size:11px;margin-top:4px}
            .server-rag-modal{position:fixed;inset:0;z-index:160;background:rgba(17,18,20,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:14px}.server-rag-modal[hidden]{display:none}.server-rag-dialog{width:min(690px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:17px;box-shadow:0 24px 70px rgba(0,0,0,.28)}.server-rag-dialog-head{display:flex;justify-content:space-between;padding:17px 20px;border-bottom:1px solid #e1e4e8}.server-rag-dialog-head p{font-size:9px;font-weight:900;letter-spacing:.13em;color:#6d3fc0}.server-rag-dialog-head h3{font-size:19px;font-weight:800}.server-rag-dialog-head button{border:0;background:transparent}.server-rag-dialog-body{padding:18px 20px;display:flex;flex-direction:column;gap:13px}.server-rag-rule{display:flex;gap:8px;background:#f7f3ff;border:1px solid #ddd0f7;border-radius:10px;padding:11px;color:#58369c}.server-rag-rule p{font-size:11px;line-height:1.5}.server-rag-dialog label{display:flex;flex-direction:column;gap:5px}.server-rag-dialog label>span{font-size:11px;font-weight:800}.server-rag-dialog select,.server-rag-dialog textarea{border:1px solid #cbd0d8;border-radius:9px;padding:9px;font-size:12px}.server-rag-members{border:1px solid #e1e4e8;border-radius:10px;overflow:hidden}.server-rag-members>div{display:flex;gap:7px;padding:9px;border-top:1px solid #eef0f3}.server-rag-members>div:first-child{border-top:0}.server-rag-members .material-symbols-outlined{font-size:17px;color:#05603a}.server-rag-members strong{display:block;font-size:10px}.server-rag-members small{display:block;font-size:9px;color:#7c8490}.server-rag-dialog-actions{display:flex;justify-content:flex-end;gap:7px;padding:14px 20px;border-top:1px solid #e1e4e8}.server-rag-dialog-actions button{border-radius:999px;padding:9px 14px;font-size:11px;font-weight:800}.server-rag-dialog-actions .danger{border:1px solid #d92d20;background:#fff;color:#b42318}.server-rag-dialog-actions .primary{border:0;background:#6d3fc0;color:#fff}
            @media(max-width:700px){.server-rag-summary{grid-template-columns:1fr}.server-rag-group{flex-wrap:wrap}.server-rag-group>button{width:100%}}`;
        document.head.appendChild(style);
    }

    function init() {
        section = createSection();
        render();
        window.addEventListener(EF_RAG_CONTRIBUTIONS.eventName, render);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
