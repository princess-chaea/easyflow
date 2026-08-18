(function (global) {
    'use strict';

    var EARLY = [
        '교무', '학적', '연구', '학력', '학생부',
        '인성', '진로', '민주', '생활', '생명',
        '자치', '복지', '늘봄', '다문화', '체육',
        '안전', '체험', '정보', '특수', '과학',
        '영재', '환경', '문화예술', '학부모', '보건',
        '영양', '상담', '독서', '국제', '영어'
    ];

    var SECONDARY = [
        '교무', '학적', '연구', '학력', '교육과정',
        '학생부', '생활', '생명', '자치', '인성',
        '진로', '민주', '체험', '안전', '체육',
        '복지', '다문화', '정보', '특수', '과학',
        '영재', '환경', '학부모', '보건',
        '영양', '상담', '독서', '국제', '영어'
    ];

    function unique(values) {
        return Array.from(new Set(values));
    }

    function normalizeSchoolType(value) {
        var text = String(value || '').replace(/\s+/g, '');
        if (/유치원/.test(text)) return 'kindergarten';
        if (/초등학교|초등/.test(text)) return 'elementary';
        if (/중학교|중등/.test(text)) return 'middle';
        if (/고등학교|고등/.test(text)) return 'high';
        if (/기관|부서|교육청|교육지원청/.test(text)) return 'common';
        return 'unknown';
    }

    function inferFromOrganization(value) {
        var text = String(value || '').replace(/\s+/g, '');
        if (/유치원$|유치원/.test(text)) return 'kindergarten';
        if (/초등학교$|초등/.test(text)) return 'elementary';
        if (/중학교$|중등/.test(text)) return 'middle';
        if (/고등학교$|고등/.test(text)) return 'high';
        if (/교육청|교육지원청|교육원|연구원|직속기관|센터|과$|담당관$/.test(text)) return 'common';
        return 'unknown';
    }

    function currentSchoolType(email) {
        var owner = email || localStorage.getItem('currentUser') || '';
        var explicit = localStorage.getItem('school_type_' + owner);
        var normalized = normalizeSchoolType(explicit);
        if (normalized !== 'unknown') return normalized;

        var organization = localStorage.getItem('org_' + owner) || '';
        normalized = inferFromOrganization(organization);
        if (normalized !== 'unknown') return normalized;

        try {
            var calendarSchool = JSON.parse(localStorage.getItem('ef_school') || '{}');
            normalized = normalizeSchoolType(calendarSchool.SCHUL_KND_SC_NM || calendarSchool.schoolType || calendarSchool.name);
            if (normalized !== 'unknown') return normalized;
        } catch (error) {
            console.warn('학교급 정보를 읽지 못했습니다.', error);
        }
        return 'elementary';
    }

    function categoryGroup(schoolType) {
        var normalized = normalizeSchoolType(schoolType);
        if (normalized === 'unknown') normalized = schoolType || 'elementary';
        if (normalized === 'middle' || normalized === 'high' || normalized === 'secondary') return 'secondary';
        if (normalized === 'common') return 'common';
        return 'early';
    }

    function forSchoolType(schoolType) {
        var group = categoryGroup(schoolType);
        if (group === 'secondary') return SECONDARY.slice();
        if (group === 'common') return unique(EARLY.concat(SECONDARY));
        return EARLY.slice();
    }

    function forCurrentUser(email) {
        return forSchoolType(currentSchoolType(email));
    }

    function groupLabel(schoolType) {
        var group = categoryGroup(schoolType);
        if (group === 'secondary') return '중·고등 기준';
        if (group === 'common') return '공통·기관 기준';
        return '유·초등 기준';
    }

    function ragScopesForSchoolType(schoolType) {
        var normalized = normalizeSchoolType(schoolType);
        if (normalized === 'unknown') normalized = schoolType || 'elementary';
        if (normalized === 'kindergarten' || normalized === 'elementary' || normalized === 'early') return ['early', 'all'];
        if (normalized === 'middle' || normalized === 'high' || normalized === 'secondary') return ['secondary', 'all'];
        return ['all'];
    }

    function applyPageLabels(schoolType) {
        if (!document.body) return;
        var label = groupLabel(schoolType || currentSchoolType());
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
            if (!node.parentElement || /^(SCRIPT|STYLE)$/.test(node.parentElement.tagName)) continue;
            if (node.nodeValue.indexOf('초등 기준') !== -1) {
                node.nodeValue = node.nodeValue.replace(/초등 기준/g, label);
            }
        }
    }

    global.EF_WORK_CATEGORIES = {
        early: EARLY.slice(),
        secondary: SECONDARY.slice(),
        all: unique(EARLY.concat(SECONDARY)),
        normalizeSchoolType: normalizeSchoolType,
        inferFromOrganization: inferFromOrganization,
        currentSchoolType: currentSchoolType,
        categoryGroup: categoryGroup,
        forSchoolType: forSchoolType,
        forCurrentUser: forCurrentUser,
        groupLabel: groupLabel,
        ragScopesForSchoolType: ragScopesForSchoolType,
        applyPageLabels: applyPageLabels
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { applyPageLabels(); });
    else applyPageLabels();
})(window);
