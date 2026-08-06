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

/**
 * EF_APPOINTMENT — 멘토의 화상 상담 가용 시간(slot)과 예약(booking) 저장소.
 * 멘토 상담함(멘토)이 시간대를 등록해두면, 마이페이지(멘티)가 상담 신청 시 그 시간대 중
 * 하나를 골라 예약할 수 있다. 멘토는 1인 모델(멘토 상담함 = 단일 사서함)이라 슬롯도 전역 공유.
 * localStorage 'ef_mentor_slots' / 'ef_appointments'.
 */
const EF_APPOINTMENT = (function () {
    const SLOT_KEY = 'ef_mentor_slots';
    const APPT_KEY = 'ef_appointments';
    const SLOT_SEED = [
        { id: 1, date: '2026-08-08', time: '15:00', booked: true },
        { id: 2, date: '2026-08-10', time: '10:00', booked: false },
        { id: 3, date: '2026-08-12', time: '14:00', booked: false },
    ];
    const APPT_SEED = [
        { id: 1, slotId: 1, requestId: 3, menteeEmail: 'test1@gbe.kr', menteeName: '최미래', menteeSchool: '구미고등학교', mentorName: '이민수 수석교사', date: '2026-08-08', time: '15:00', platform: 'zoom', joinLink: '', meetingId: '987 6543 2101', meetingPassword: '246810', status: 'confirmed' },
    ];
    const PLATFORM_LABELS = { zoom: 'Zoom', teams: 'Microsoft Teams', other: '기타 화상회의' };

    function loadSlots() {
        try {
            const raw = localStorage.getItem(SLOT_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to reseed */ }
        localStorage.setItem(SLOT_KEY, JSON.stringify(SLOT_SEED));
        return SLOT_SEED.slice();
    }
    function saveSlots(list) { localStorage.setItem(SLOT_KEY, JSON.stringify(list)); }

    function loadAppts() {
        try {
            const raw = localStorage.getItem(APPT_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to reseed */ }
        localStorage.setItem(APPT_KEY, JSON.stringify(APPT_SEED));
        return APPT_SEED.slice();
    }
    function saveAppts(list) { localStorage.setItem(APPT_KEY, JSON.stringify(list)); }

    return {
        slots() { return loadSlots().slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); },
        openSlots() { return this.slots().filter(s => !s.booked); },
        addSlot(date, time) {
            const list = loadSlots();
            const nextId = list.reduce((max, s) => Math.max(max, s.id), 0) + 1;
            const slot = { id: nextId, date, time, booked: false };
            list.push(slot);
            saveSlots(list);
            return slot;
        },
        removeSlot(id) {
            const list = loadSlots();
            const slot = list.find(s => s.id === id);
            if (!slot || slot.booked) return false; // 예약이 걸린 슬롯은 먼저 예약을 취소해야 함
            saveSlots(list.filter(s => s.id !== id));
            return true;
        },
        all() { return loadAppts(); },
        upcomingAll() {
            const now = new Date();
            return loadAppts()
                .filter(a => a.status === 'confirmed' && new Date(a.date + 'T' + a.time) >= now)
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        upcomingByEmail(email) { return this.upcomingAll().filter(a => a.menteeEmail === email); },
        byRequestId(requestId) { return loadAppts().find(a => a.requestId === requestId && a.status === 'confirmed') || null; },
        platformLabel(platform) { return PLATFORM_LABELS[platform] || PLATFORM_LABELS.zoom; },
        book({ slotId, requestId, menteeEmail, menteeName, menteeSchool, mentorName, platform, joinLink, meetingId, meetingPassword }) {
            const slots = loadSlots();
            const slot = slots.find(s => s.id === slotId);
            if (!slot || slot.booked) return null;
            slot.booked = true;
            saveSlots(slots);

            const appts = loadAppts();
            const nextId = appts.reduce((max, a) => Math.max(max, a.id), 0) + 1;
            const appt = {
                id: nextId, slotId, requestId: requestId || null,
                menteeEmail, menteeName, menteeSchool,
                mentorName: mentorName || '이민수 수석교사',
                date: slot.date, time: slot.time,
                platform: platform || 'zoom', joinLink: joinLink || '', meetingId: meetingId || '', meetingPassword: meetingPassword || '',
                status: 'confirmed',
            };
            appts.push(appt);
            saveAppts(appts);
            return appt;
        },
        setMeetingInfo(id, { platform, joinLink, meetingId, meetingPassword }) {
            const appts = loadAppts();
            const appt = appts.find(a => a.id === id);
            if (!appt) return null;
            appt.platform = platform || 'zoom';
            appt.joinLink = joinLink || '';
            appt.meetingId = meetingId || '';
            appt.meetingPassword = meetingPassword || '';
            saveAppts(appts);
            return appt;
        },
        cancel(id) {
            const appts = loadAppts();
            const appt = appts.find(a => a.id === id);
            if (!appt) return null;
            appt.status = 'cancelled';
            saveAppts(appts);
            const slots = loadSlots();
            const slot = slots.find(s => s.id === appt.slotId);
            if (slot) { slot.booked = false; saveSlots(slots); }
            return appt;
        },
    };
})();
window.EF_APPOINTMENT = EF_APPOINTMENT;
