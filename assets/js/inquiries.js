/**
 * EF_INQUIRY — 1:1 문의 데이터 저장소 (localStorage 'ef_inquiries').
 * 안내센터_시스템 안내.html(문의 등록·본인 문의 확인)과
 * 안내센터_1대1문의관리.html(서버관리자/장학사/멘토의 답변)이 함께 쓴다.
 */
const EF_INQUIRY = (function () {
    const KEY = 'ef_inquiries';
    const SEED = [
        { id: 1, email: 'test5@gbe.kr', type: '시스템 오류', title: '나이스 데이터 연동 오류 문의', content: '스마트 공문 달력에서 기준 학교를 변경했는데도 나이스 학사일정이 예전 학교 기준으로 계속 표시됩니다. 확인 부탁드립니다.', date: '2024.05.20', status: '접수완료', answer: null },
        { id: 2, email: 'test1@gbe.kr', type: '기타', title: 'AI Cockpit 대시보드 권한 설정 문의', content: '부장 교사도 AI Cockpit 대시보드의 부서별 통계를 볼 수 있게 권한을 열어줄 수 있나요?', date: '2024.05.18', status: '답변완료', answer: "네, 가능합니다. 서버 관리자 ▸ 회원 관리에서 해당 선생님의 역할을 '학교 관리자'로 변경해 주시면 대시보드 열람 권한이 함께 부여됩니다." },
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
        add({ email, type, title, content }) {
            const list = load();
            const nextId = list.reduce((max, q) => Math.max(max, q.id), 0) + 1;
            const entry = {
                id: nextId, email, type, title, content,
                date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
                status: '접수완료', answer: null,
            };
            list.push(entry);
            save(list);
            return entry;
        },
        answer(id, answerText) {
            const list = load();
            const item = list.find(q => q.id === id);
            if (!item) return null;
            item.answer = answerText;
            item.status = '답변완료';
            item.answeredBy = localStorage.getItem('currentUser') || null;
            item.answeredAt = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
            save(list);
            return item;
        },
    };
})();
window.EF_INQUIRY = EF_INQUIRY;
