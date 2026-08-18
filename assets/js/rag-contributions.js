(function (global) {
    'use strict';

    var STORAGE_KEY = 'ef_rag_submissions_v1';
    var EVENT_NAME = 'ef:rag-submissions-changed';
    var VALID_STATUSES = [
        'PRIVATE', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED',
        'REJECTED', 'APPROVED', 'INDEXING', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN'
    ];

    function nowIso() {
        return new Date().toISOString();
    }

    function makeId(prefix) {
        return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function readList() {
        try {
            var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(value) ? value.map(normalize) : [];
        } catch (error) {
            console.warn('RAG 검토 요청 목록을 읽지 못했습니다.', error);
            return [];
        }
    }

    function writeList(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { count: list.length } }));
        return list;
    }

    function normalize(item) {
        var normalized = item && typeof item === 'object' ? item : {};
        if (VALID_STATUSES.indexOf(normalized.status) === -1) normalized.status = 'SUBMITTED';
        normalized.history = Array.isArray(normalized.history) ? normalized.history : [];
        normalized.version = Number(normalized.version) || 1;
        normalized.requestedScope = normalized.requestedScope === 'regional' ? 'regional' : 'organization';
        normalized.approvedScope = normalized.approvedScope || null;
        normalized.promotionStatus = normalized.promotionStatus || null;
        normalized.schoolLevels = Array.isArray(normalized.schoolLevels) && normalized.schoolLevels.length ? normalized.schoolLevels : ['all'];
        normalized.referenceYear = normalized.referenceYear ? String(normalized.referenceYear) : '';
        normalized.documentFamilyId = normalized.documentFamilyId || normalized.groupId || null;
        return normalized;
    }

    function currentEmail() {
        return localStorage.getItem('currentUser') || 'guest';
    }

    function organizationFor(email) {
        var target = email || currentEmail();
        return localStorage.getItem('org_' + target) || '기본기관';
    }

    function actor(email) {
        var actorEmail = email || currentEmail();
        return {
            email: actorEmail,
            organization: organizationFor(actorEmail)
        };
    }

    function transition(item, status, by, note) {
        var at = nowIso();
        item.status = status;
        item.updatedAt = at;
        item.history.push({ status: status, by: by || currentEmail(), note: note || '', at: at });
    }

    function get(id) {
        return readList().find(function (item) { return item.id === id; }) || null;
    }

    function findByResource(resourceId, email) {
        var owner = email || currentEmail();
        return readList().filter(function (item) {
            return item.resourceId === resourceId && item.requesterEmail === owner;
        }).sort(function (a, b) {
            return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        })[0] || null;
    }

    function normalizeTitle(name) {
        return String(name || '').toLowerCase()
            .replace(/\.(hwp|hwpx|pdf|docx?|txt|xlsx?)$/i, '')
            .replace(/20\d{2}/g, ' ')
            .replace(/(최종|수정|개정|사본|복사본|ver|version|v)\s*\d*/gi, ' ')
            .replace(/[^0-9a-z가-힣]+/g, ' ')
            .trim();
    }

    function titleSimilarity(left, right) {
        var a = normalizeTitle(left).split(/\s+/).filter(Boolean);
        var b = normalizeTitle(right).split(/\s+/).filter(Boolean);
        if (!a.length || !b.length) return 0;
        var bSet = new Set(b);
        var intersection = a.filter(function (token) { return bSet.has(token); }).length;
        var union = new Set(a.concat(b)).size;
        return union ? intersection / union : 0;
    }

    function schoolLevelsOverlap(left, right) {
        var a = Array.isArray(left.schoolLevels) && left.schoolLevels.length ? left.schoolLevels : ['all'];
        var b = Array.isArray(right.schoolLevels) && right.schoolLevels.length ? right.schoolLevels : ['all'];
        if (a.indexOf('all') !== -1 || b.indexOf('all') !== -1) return true;
        function group(level) {
            if (['early', 'kindergarten', 'elementary'].indexOf(level) !== -1) return 'early';
            if (['secondary', 'middle', 'high'].indexOf(level) !== -1) return 'secondary';
            return level;
        }
        return a.some(function (level) { return b.some(function (other) { return group(level) === group(other); }); });
    }

    function similarityGroups(items) {
        var list = (items || []).slice();
        var parent = list.map(function (_, index) { return index; });
        function root(index) {
            while (parent[index] !== index) {
                parent[index] = parent[parent[index]];
                index = parent[index];
            }
            return index;
        }
        function join(a, b) {
            var left = root(a);
            var right = root(b);
            if (left !== right) parent[right] = left;
        }
        list.forEach(function (item, i) {
            list.slice(i + 1).forEach(function (other, offset) {
                var j = i + 1 + offset;
                var sameGroup = item.groupId && other.groupId && item.groupId === other.groupId;
                var sameHash = item.fileHash && other.fileHash && item.fileHash === other.fileHash;
                var similarTitle = schoolLevelsOverlap(item, other) && titleSimilarity(item.resourceName, other.resourceName) >= 0.58;
                if (sameGroup || sameHash || similarTitle) join(i, j);
            });
        });
        var grouped = {};
        list.forEach(function (item, index) {
            var key = String(root(index));
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return Object.keys(grouped).map(function (key) {
            var members = grouped[key].sort(function (a, b) {
                var yearA = Number((String(a.resourceName).match(/20\d{2}/) || ['0'])[0]);
                var yearB = Number((String(b.resourceName).match(/20\d{2}/) || ['0'])[0]);
                if (yearA !== yearB) return yearB - yearA;
                return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
            });
            return {
                id: members[0].groupId || 'similar-' + key,
                representative: members[0],
                members: members,
                exactDuplicateCount: members.reduce(function (count, item, index) {
                    return count + members.slice(index + 1).filter(function (other) {
                        return item.fileHash && other.fileHash && item.fileHash === other.fileHash;
                    }).length;
                }, 0)
            };
        }).sort(function (a, b) {
            return String(b.representative.updatedAt || '').localeCompare(String(a.representative.updatedAt || ''));
        });
    }

    function submit(resource, options) {
        if (!resource || !resource.id || !resource.name) throw new Error('자료 정보가 올바르지 않습니다.');
        options = options || {};
        if (!options.hasDistributionRights || !options.containsNoPersonalData) {
            throw new Error('자료 권리와 개인정보 확인이 필요합니다.');
        }

        var list = readList();
        var owner = actor(options.requesterEmail);
        var existing = list.filter(function (item) {
            var sameResource = item.resourceId === resource.id;
            var sameGroup = options.groupId && item.groupId === options.groupId;
            return (sameResource || sameGroup) && item.requesterEmail === owner.email && item.status !== 'WITHDRAWN';
        }).sort(function (a, b) {
            return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        })[0];
        var at = nowIso();

        if (existing) {
            if (['CHANGES_REQUESTED', 'REJECTED'].indexOf(existing.status) === -1) {
                throw new Error('이미 검토 중이거나 승인된 자료입니다.');
            }
            existing.version += 1;
            existing.resourceId = resource.id;
            existing.resourceName = resource.name;
            existing.resourceSize = resource.size || '';
            existing.fileHash = resource.hash || existing.fileHash || '';
            existing.groupId = options.groupId || existing.groupId || null;
            existing.relatedResources = Array.isArray(options.relatedResources) ? options.relatedResources : (existing.relatedResources || []);
            existing.category = options.category || existing.category || '기타';
            existing.schoolLevels = Array.isArray(options.schoolLevels) && options.schoolLevels.length ? options.schoolLevels : (existing.schoolLevels || ['all']);
            existing.referenceYear = options.referenceYear ? String(options.referenceYear) : (existing.referenceYear || '');
            existing.documentFamilyId = options.documentFamilyId || options.groupId || existing.documentFamilyId || null;
            existing.description = options.description || '';
            existing.requestedScope = options.requestedScope === 'regional' ? 'regional' : 'organization';
            existing.attestations = {
                hasDistributionRights: true,
                containsNoPersonalData: true,
                consentTextVersion: '2026-08-18'
            };
            existing.reviewReason = '';
            existing.promotionStatus = null;
            existing.approvedScope = null;
            transition(existing, 'SUBMITTED', owner.email, '사용자 보완 후 재신청');
            writeList(list);
            return existing;
        }

        var item = normalize({
            id: makeId('rag-sub'),
            resourceId: resource.id,
            resourceName: resource.name,
            resourceSize: resource.size || '',
            fileHash: resource.hash || '',
            groupId: options.groupId || null,
            relatedResources: Array.isArray(options.relatedResources) ? options.relatedResources : [],
            duplicateCount: Number(options.duplicateCount) || 0,
            schoolLevels: Array.isArray(options.schoolLevels) && options.schoolLevels.length ? options.schoolLevels : ['all'],
            referenceYear: options.referenceYear ? String(options.referenceYear) : '',
            documentFamilyId: options.documentFamilyId || options.groupId || null,
            requesterEmail: owner.email,
            organization: owner.organization,
            origin: options.origin || 'user_resource',
            category: options.category || '기타',
            description: options.description || '',
            requestedScope: options.requestedScope === 'regional' ? 'regional' : 'organization',
            approvedScope: null,
            promotionStatus: null,
            status: 'SUBMITTED',
            version: 1,
            attestations: {
                hasDistributionRights: true,
                containsNoPersonalData: true,
                consentTextVersion: '2026-08-18'
            },
            submittedAt: at,
            updatedAt: at,
            withdrawnAt: null,
            reviewReason: '',
            schoolReview: null,
            serverReview: null,
            history: [{ status: 'SUBMITTED', by: owner.email, note: 'AI 참고자료 반영 검토 요청', at: at }]
        });
        list.push(item);
        writeList(list);
        return item;
    }

    function submitSchoolUpload(file, options) {
        options = options || {};
        return submit({
            id: options.resourceId || makeId('school-resource'),
            name: file.name,
            size: options.sizeLabel || String(file.size || 0)
        }, {
            requesterEmail: options.requesterEmail || currentEmail(),
            origin: 'school_admin_upload',
            category: options.category || '학교 행정 자료',
            description: options.description || '학교관리자 직접 등록 자료',
            requestedScope: options.requestedScope || 'organization',
            schoolLevels: options.schoolLevels || ['all'],
            referenceYear: options.referenceYear || String(new Date().getFullYear()),
            hasDistributionRights: true,
            containsNoPersonalData: true
        });
    }

    function schoolReview(id, decision, reason, reviewerEmail) {
        var list = readList();
        var item = list.find(function (entry) { return entry.id === id; });
        if (!item) throw new Error('검토 요청을 찾을 수 없습니다.');
        var reviewer = actor(reviewerEmail);
        if (item.organization !== reviewer.organization) throw new Error('다른 기관의 자료는 검토할 수 없습니다.');
        if (['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'].indexOf(item.status) === -1) {
            throw new Error('현재 상태에서는 검토 결정을 저장할 수 없습니다.');
        }
        var at = nowIso();
        item.reviewReason = reason || '';
        item.schoolReview = { decision: decision, reason: reason || '', reviewerEmail: reviewer.email, reviewedAt: at };

        if (decision === 'approve') {
            item.approvedScope = 'organization';
            item.promotionStatus = item.requestedScope === 'regional' ? 'SUBMITTED' : null;
            transition(item, 'APPROVED', reviewer.email, item.promotionStatus ? '학교 승인 및 광역 공유 승격 요청' : '학교 범위 승인');
        } else if (decision === 'request_changes') {
            transition(item, 'CHANGES_REQUESTED', reviewer.email, reason || '보완 요청');
        } else if (decision === 'reject') {
            transition(item, 'REJECTED', reviewer.email, reason || '반려');
        } else {
            throw new Error('지원하지 않는 검토 결정입니다.');
        }
        writeList(list);
        return item;
    }

    function serverPromotionReview(id, decision, reason, reviewerEmail) {
        var list = readList();
        var item = list.find(function (entry) { return entry.id === id; });
        if (!item) throw new Error('승격 요청을 찾을 수 없습니다.');
        if (item.promotionStatus !== 'SUBMITTED') throw new Error('광역 승인 대기 상태가 아닙니다.');
        var at = nowIso();
        var reviewer = reviewerEmail || currentEmail();
        item.promotionStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        item.approvedScope = decision === 'approve' ? 'regional' : 'organization';
        item.serverReview = { decision: decision, reason: reason || '', reviewerEmail: reviewer, reviewedAt: at };
        item.updatedAt = at;
        item.history.push({
            status: item.status,
            by: reviewer,
            note: decision === 'approve' ? '광역 공유 범위 승인' : '광역 승격 반려·학교 범위 유지',
            at: at
        });
        writeList(list);
        return item;
    }

    function schoolConsolidate(ids, representativeId, reason, reviewerEmail) {
        var list = readList();
        var selected = list.filter(function (item) { return ids.indexOf(item.id) !== -1; });
        var representative = selected.find(function (item) { return item.id === representativeId; });
        if (!representative) throw new Error('대표 자료를 선택해 주세요.');
        var reviewer = actor(reviewerEmail);
        if (selected.some(function (item) { return item.organization !== reviewer.organization; })) {
            throw new Error('다른 기관의 자료는 묶어서 검토할 수 없습니다.');
        }
        var at = nowIso();
        selected.forEach(function (item) {
            if (item.id === representative.id) {
                item.approvedScope = 'organization';
                item.promotionStatus = item.requestedScope === 'regional' ? 'SUBMITTED' : null;
                item.schoolReview = { decision: 'approve', reason: reason || '유사자료 대표본 승인', reviewerEmail: reviewer.email, reviewedAt: at };
                transition(item, 'APPROVED', reviewer.email, '유사자료 묶음의 대표본 승인');
                return;
            }
            item.mergedIntoSubmissionId = representative.id;
            item.reviewReason = '대표 자료 ' + representative.resourceName + '에 묶어 정리됨';
            item.schoolReview = { decision: 'reject', reason: item.reviewReason, reviewerEmail: reviewer.email, reviewedAt: at };
            transition(item, 'REJECTED', reviewer.email, item.reviewReason);
        });
        writeList(list);
        return representative;
    }

    function selectRepresentative(id, resource, reviewerEmail) {
        var list = readList();
        var item = list.find(function (entry) { return entry.id === id; });
        if (!item) throw new Error('대표본을 바꿀 제출 자료를 찾을 수 없습니다.');
        var reviewer = actor(reviewerEmail);
        if (item.organization !== reviewer.organization) throw new Error('다른 기관 자료의 대표본을 바꿀 수 없습니다.');
        item.resourceId = resource.id;
        item.resourceName = resource.name;
        item.fileHash = resource.hash || item.fileHash || '';
        item.updatedAt = nowIso();
        item.history.push({ status: item.status, by: reviewer.email, note: '유사자료 묶음 대표본 선택: ' + resource.name, at: item.updatedAt });
        writeList(list);
        return item;
    }

    function withdraw(id, byEmail) {
        var list = readList();
        var item = list.find(function (entry) { return entry.id === id; });
        if (!item) throw new Error('철회할 요청을 찾을 수 없습니다.');
        var by = byEmail || currentEmail();
        if (item.requesterEmail !== by && item.organization !== organizationFor(by)) {
            throw new Error('철회 권한이 없습니다.');
        }
        item.withdrawnAt = nowIso();
        item.promotionStatus = item.promotionStatus === 'SUBMITTED' ? 'WITHDRAWN' : item.promotionStatus;
        transition(item, 'WITHDRAWN', by, '사용자 요청 또는 관리자 조치로 RAG 활용 철회');
        writeList(list);
        return item;
    }

    function statusMeta(status) {
        var map = {
            PRIVATE: { label: '개인 자료', className: 'bg-surface-strong text-ink/60' },
            SUBMITTED: { label: '검토 대기', className: 'bg-warning/10 text-warning' },
            UNDER_REVIEW: { label: '검토 중', className: 'bg-primary/10 text-primary' },
            CHANGES_REQUESTED: { label: '보완 필요', className: 'bg-warning/10 text-warning' },
            REJECTED: { label: '반려됨', className: 'bg-danger/10 text-danger' },
            APPROVED: { label: '승인·색인 대기', className: 'bg-secondary/10 text-secondary' },
            INDEXING: { label: '색인 중', className: 'bg-primary/10 text-primary' },
            ACTIVE: { label: 'AI 참고자료 반영 중', className: 'bg-success/10 text-success' },
            SUSPENDED: { label: '활용 중지', className: 'bg-danger/10 text-danger' },
            WITHDRAWN: { label: '철회됨', className: 'bg-surface-strong text-ink/50' }
        };
        return map[status] || map.PRIVATE;
    }

    global.EF_RAG_CONTRIBUTIONS = {
        storageKey: STORAGE_KEY,
        eventName: EVENT_NAME,
        all: readList,
        get: get,
        mine: function (email) {
            var owner = email || currentEmail();
            return readList().filter(function (item) { return item.requesterEmail === owner; });
        },
        byOrganization: function (organization) {
            var org = organization || organizationFor();
            return readList().filter(function (item) { return item.organization === org; });
        },
        promotionQueue: function () {
            return readList().filter(function (item) { return item.promotionStatus === 'SUBMITTED'; });
        },
        findByResource: findByResource,
        findByGroup: function (groupId, email) {
            var owner = email || currentEmail();
            return readList().filter(function (item) {
                return item.groupId === groupId && item.requesterEmail === owner;
            }).sort(function (a, b) {
                return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
            })[0] || null;
        },
        submit: submit,
        submitSchoolUpload: submitSchoolUpload,
        schoolReview: schoolReview,
        schoolConsolidate: schoolConsolidate,
        selectRepresentative: selectRepresentative,
        serverPromotionReview: serverPromotionReview,
        withdraw: withdraw,
        statusMeta: statusMeta,
        normalizeTitle: normalizeTitle,
        titleSimilarity: titleSimilarity,
        similarityGroups: similarityGroups,
        currentEmail: currentEmail,
        organizationFor: organizationFor
    };
})(window);
