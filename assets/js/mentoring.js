/**
 * EF_MENTORING — 멘토 상담 신청/답변 데이터 저장소 (localStorage 'ef_mentoring').
 * 인생도서관_마이페이지.html(멘토 찾기·신청)과 인생도서관_멘토상담함.html(멘토의 답변)이
 * 함께 쓴다. category는 업무배송_업무발송.html/서식자료실_통합검색.html과 동일한
 * 초등 기준 업무 분야 태그(30종) 중 하나를 쓴다.
 */
const EF_MENTORING = (function () {
    const KEY = 'ef_mentoring';
    const SEED = [
        { id: 1, email: 'test5@gbe.kr', name: '김경북', school: '경북초등학교', category: '인성', title: '교원 복무 및 연수 신청 절차 문의', content: '연수 신청 시 복무 처리 순서가 헷갈립니다. 순서를 알려주세요.', date: '2026-08-01 14:20', status: '신규', answer: null },
        { id: 2, email: 'test4@gbe.kr', name: '이교육', school: '안동중학교', category: '정보', title: 'NEIS 학적 변동 처리 관련 상담', content: '전학생 학적 처리 시 주의할 점이 궁금합니다.', date: '2026-08-01 09:45', status: '신규', answer: null },
        { id: 3, email: 'test1@gbe.kr', name: '최미래', school: '구미고등학교', category: '복지', title: '학교 회계 예산 편성 원칙 문의', content: '학교 회계 예산 편성 시 우선순위를 정하는 기준이 궁금합니다.', date: '2026-07-30 16:10', status: '답변대기', answer: null },
        { id: 4, email: 'test2@gbe.kr', name: '정성실', school: '포항여자중학교', category: '안전', title: '학교폭력 대응 절차 및 매뉴얼 확인', content: '학교폭력 신고 접수 후 처리 흐름을 확인하고 싶습니다.', date: '2026-07-29 11:05', status: '답변대기', answer: null },
    ];

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to reseed */ }
        localStorage.setItem(KEY, JSON.stringify(SEED));
        return SEED.slice();
    }

    function save(list) {
        localStorage.setItem(KEY, JSON.stringify(list));
    }

    return {
        all() { return load(); },
        allByEmail(email) { return load().filter(q => q.email === email); },
        add({ email, name, school, category, title, content }) {
            const list = load();
            const nextId = list.reduce((max, q) => Math.max(max, q.id), 0) + 1;
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const entry = {
                id: nextId, email, name, school, category, title, content,
                date: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
                status: '신규', answer: null,
            };
            list.push(entry);
            save(list);
            return entry;
        },
        respond(id, answerText) {
            const list = load();
            const item = list.find(q => q.id === id);
            if (!item) return null;
            item.answer = answerText;
            item.status = '답변완료';
            save(list);
            return item;
        },
    };
})();
window.EF_MENTORING = EF_MENTORING;
