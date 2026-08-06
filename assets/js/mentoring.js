/**
 * EF_MENTOR_ROSTER — 멘토 계정별 담당 업무분야(사업) 배정.
 * 서버관리자_멘토배정관리.html에서 관리하고, 마이페이지(카테고리→멘토 라우팅)와
 * 멘토상담함(로그인한 멘토의 표시 이름)이 함께 읽는다. localStorage 'ef_mentor_roster'.
 */
const EF_MENTOR_ROSTER = (function () {
    const KEY = 'ef_mentor_roster';
    const SEED = [
        { email: 'test3@gbe.kr', name: '이민수 수석교사', categories: ['교무', '학적', '연구', '학력', '학생부', '인성', '진로', '상담'] },
        { email: 'test6@gbe.kr', name: '박서연 장학사', categories: ['복지', '안전', '생활', '민주', '자치', '늘봄', '다문화', '보건', '영양'] },
        { email: 'test7@gbe.kr', name: '김도윤 주무관', categories: ['정보', '과학', '특수', '영재', '환경', '체육', '체험', '문화예술', '학부모', '독서', '국제', '영어'] },
    ];

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to reseed */ }
        localStorage.setItem(KEY, JSON.stringify(SEED));
        return SEED.slice();
    }
    function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

    return {
        all() { return load(); },
        byEmail(email) { return load().find(m => m.email === email) || null; },
        mentorsForCategory(category) { return load().filter(m => m.categories.includes(category)); },
        setAssignment(email, name, categories) {
            const list = load();
            const existing = list.find(m => m.email === email);
            if (existing) {
                existing.name = name || existing.name;
                existing.categories = categories;
            } else {
                list.push({ email, name: name || email.split('@')[0], categories });
            }
            save(list);
        },
        remove(email) { save(load().filter(m => m.email !== email)); },
    };
})();
window.EF_MENTOR_ROSTER = EF_MENTOR_ROSTER;

/**
 * EF_MENTORING — 멘토 상담 신청/대화 저장소 (localStorage 'ef_mentoring').
 * 인생도서관_마이페이지.html(멘토 찾기·신청)과 인생도서관_멘토상담함.html(멘토의 응답)이 함께 쓴다.
 * category는 업무배송_업무발송.html/서식자료실_통합검색.html과 동일한 초등 기준 업무 분야 태그(30종)
 * 중 하나이며, EF_MENTOR_ROSTER를 통해 해당 카테고리를 담당하는 멘토에게 라우팅된다.
 * 단발성 질문 1개 + 답변 1개가 아니라, 메시지가 계속 쌓이는 대화 스레드(messages)로 관리한다 —
 * 상담 일지 출력/추후 조회에는 "쪽지"보다 대화 기록이 더 적합하기 때문.
 */
const EF_MENTORING = (function () {
    const KEY = 'ef_mentoring';
    const SEED = [
        { id: 1, email: 'test5@gbe.kr', name: '김경북', school: '경북초등학교', category: '인성', title: '교원 복무 및 연수 신청 절차 문의', mentorEmail: 'test3@gbe.kr', mentorName: '이민수 수석교사', status: '신규', messages: [{ from: 'mentee', text: '연수 신청 시 복무 처리 순서가 헷갈립니다. 순서를 알려주세요.', at: '2026-08-01 14:20' }] },
        { id: 2, email: 'test4@gbe.kr', name: '이교육', school: '안동중학교', category: '정보', title: 'NEIS 학적 변동 처리 관련 상담', mentorEmail: 'test7@gbe.kr', mentorName: '김도윤 주무관', status: '신규', messages: [{ from: 'mentee', text: '전학생 학적 처리 시 주의할 점이 궁금합니다.', at: '2026-08-01 09:45' }] },
        { id: 3, email: 'test1@gbe.kr', name: '최미래', school: '구미고등학교', category: '복지', title: '학교 회계 예산 편성 원칙 문의', mentorEmail: 'test6@gbe.kr', mentorName: '박서연 장학사', status: '진행중', messages: [{ from: 'mentee', text: '학교 회계 예산 편성 시 우선순위를 정하는 기준이 궁금합니다.', at: '2026-07-30 16:10' }] },
        { id: 4, email: 'test2@gbe.kr', name: '정성실', school: '포항여자중학교', category: '안전', title: '학교폭력 대응 절차 및 매뉴얼 확인', mentorEmail: 'test6@gbe.kr', mentorName: '박서연 장학사', status: '진행중', messages: [{ from: 'mentee', text: '학교폭력 신고 접수 후 처리 흐름을 확인하고 싶습니다.', at: '2026-07-29 11:05' }] },
    ];

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to reseed */ }
        localStorage.setItem(KEY, JSON.stringify(SEED));
        return SEED.slice();
    }
    function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
    function nowStr() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    }

    return {
        all() { return load(); },
        allByEmail(email) { return load().filter(q => q.email === email); },
        byMentorEmail(mentorEmail) { return load().filter(q => q.mentorEmail === mentorEmail); },
        get(id) { return load().find(q => q.id === id) || null; },
        firstMessage(thread) { return (thread.messages && thread.messages[0]) || null; },
        lastMessage(thread) { return (thread.messages && thread.messages[thread.messages.length - 1]) || null; },
        createdAt(thread) { const m = this.firstMessage(thread); return m ? m.at : ''; },
        lastActivityAt(thread) { const m = this.lastMessage(thread); return m ? m.at : ''; },
        add({ email, name, school, category, title, content, mentorEmail, mentorName }) {
            const list = load();
            const nextId = list.reduce((max, q) => Math.max(max, q.id), 0) + 1;
            const entry = {
                id: nextId, email, name, school, category, title,
                mentorEmail: mentorEmail || null, mentorName: mentorName || null,
                status: '신규',
                messages: [{ from: 'mentee', text: content, at: nowStr() }],
            };
            list.push(entry);
            save(list);
            return entry;
        },
        addMessage(id, from, text) {
            const list = load();
            const item = list.find(q => q.id === id);
            if (!item) return null;
            item.messages.push({ from, text, at: nowStr() });
            if (from === 'mentor' && item.status === '신규') item.status = '진행중';
            save(list);
            return item;
        },
        addFileMessage(id, from, fileName) {
            const list = load();
            const item = list.find(q => q.id === id);
            if (!item) return null;
            item.messages.push({ from, type: 'file', fileName, at: nowStr() });
            if (from === 'mentor' && item.status === '신규') item.status = '진행중';
            save(list);
            return item;
        },
        markComplete(id) {
            const list = load();
            const item = list.find(q => q.id === id);
            if (!item) return null;
            item.status = '완료';
            save(list);
            return item;
        },
        reopen(id) {
            const list = load();
            const item = list.find(q => q.id === id);
            if (!item) return null;
            item.status = '진행중';
            save(list);
            return item;
        },
    };
})();
window.EF_MENTORING = EF_MENTORING;

/**
 * EF_APPOINTMENT — 멘토별 화상 상담 가용 시간(slot)과 예약(booking) 저장소.
 * 멘토(상담함)가 시간대를 등록해두면(특정 날짜 1회성, 또는 요일 반복), 멘티(마이페이지)가 상담
 * 신청 시 그 멘토의 열린 시간 중 하나를 골라 예약할 수 있다. 멘토마다 슬롯이 분리되어 있다
 * (mentorEmail). localStorage 'ef_mentor_slots' / 'ef_appointments'.
 */
const EF_APPOINTMENT = (function () {
    const SLOT_KEY = 'ef_mentor_slots';
    const APPT_KEY = 'ef_appointments';
    const SLOT_SEED = [
        { id: 1, mentorEmail: 'test6@gbe.kr', date: '2026-08-08', time: '15:00', booked: true },
        { id: 2, mentorEmail: 'test3@gbe.kr', date: '2026-08-10', time: '10:00', booked: false },
        { id: 3, mentorEmail: 'test7@gbe.kr', date: '2026-08-12', time: '14:00', booked: false },
    ];
    const APPT_SEED = [
        { id: 1, slotId: 1, requestId: 3, mentorEmail: 'test6@gbe.kr', mentorName: '박서연 장학사', menteeEmail: 'test1@gbe.kr', menteeName: '최미래', menteeSchool: '구미고등학교', date: '2026-08-08', time: '15:00', platform: 'zoom', joinLink: '', meetingId: '987 6543 2101', meetingPassword: '246810', status: 'confirmed' },
    ];
    const PLATFORM_LABELS = { zoom: 'Zoom', teams: 'Microsoft Teams', other: '기타 화상회의' };
    const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

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
    function pad(n) { return String(n).padStart(2, '0'); }

    return {
        weekdayNames() { return WEEKDAY_NAMES.slice(); },
        // mentorEmail을 생략하면 전체 멘토의 슬롯을 반환한다(관리자 용도).
        slots(mentorEmail) {
            const list = loadSlots().filter(s => !mentorEmail || s.mentorEmail === mentorEmail);
            return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        },
        openSlots(mentorEmail) { return this.slots(mentorEmail).filter(s => !s.booked); },
        addSlot(mentorEmail, date, time) {
            const list = loadSlots();
            const nextId = list.reduce((max, s) => Math.max(max, s.id), 0) + 1;
            const slot = { id: nextId, mentorEmail, date, time, booked: false };
            list.push(slot);
            saveSlots(list);
            return slot;
        },
        // 요일 반복 등록 — weekday(0=일요일~6=토요일) + time('HH:MM')로 앞으로 weeksAhead주치의
        // 실제 예약 가능한 날짜 슬롯을 한 번에 생성한다(이미 있는 날짜는 중복 생성하지 않음).
        addRecurringSlots(mentorEmail, weekday, time, weeksAhead) {
            const list = loadSlots();
            let nextId = list.reduce((max, s) => Math.max(max, s.id), 0);
            const created = [];
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
            for (let i = 0; i < weeksAhead; i++) {
                const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
                const exists = list.some(s => s.mentorEmail === mentorEmail && s.date === dateStr && s.time === time);
                if (!exists) {
                    nextId += 1;
                    const slot = { id: nextId, mentorEmail, date: dateStr, time, booked: false };
                    list.push(slot);
                    created.push(slot);
                }
                d.setDate(d.getDate() + 7);
            }
            saveSlots(list);
            return created;
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
        upcomingByMentor(mentorEmail) { return this.upcomingAll().filter(a => a.mentorEmail === mentorEmail); },
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
                mentorEmail: slot.mentorEmail, mentorName: mentorName || '',
                menteeEmail, menteeName, menteeSchool,
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

/**
 * EF_CONSULT_LOG — "복잡한 상담"을 마친 뒤 멘토가 남기는 상담 일지.
 * 멘토상담함.html의 "월별 상담일지 출력"이 이 데이터를 로그인한 멘토 + 선택한 달 기준으로 모아
 * 인쇄한다. localStorage 'ef_consult_logs'.
 */
const EF_CONSULT_LOG = (function () {
    const KEY = 'ef_consult_logs';
    const SEED = [
        { id: 1, mentorEmail: 'test3@gbe.kr', requestId: null, menteeName: '', category: '교무', date: '2026-05-02', summary: '교원 복무 규정 중 특별휴가(경조사) 관련 지침 질의 및 필요 서류 문의', action: '복무 지침 문서 안내 및 서류 목록 전달', status: '완료' },
        { id: 2, mentorEmail: 'test6@gbe.kr', requestId: null, menteeName: '', category: '안전', date: '2026-05-10', summary: '학교 폭력 사안 접수 시 초기 대응 절차 및 전담기구 구성 요건 문의', action: '초기 대응 절차 매뉴얼 공유', status: '완료' },
        { id: 3, mentorEmail: 'test6@gbe.kr', requestId: null, menteeName: '', category: '복지', date: '2026-05-21', summary: '현장체험학습 예산 집행 품의 작성 시 유의사항 및 여비 정산 규정', action: '예산 담당 부서 연계 예정', status: '대기' },
    ];

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to reseed */ }
        localStorage.setItem(KEY, JSON.stringify(SEED));
        return SEED.slice();
    }
    function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

    return {
        all() { return load(); },
        byMentorEmail(mentorEmail) { return load().filter(l => l.mentorEmail === mentorEmail); },
        byMentorAndMonth(mentorEmail, yyyyMm) {
            return load()
                .filter(l => l.mentorEmail === mentorEmail && l.date.indexOf(yyyyMm) === 0)
                .sort((a, b) => a.date.localeCompare(b.date));
        },
        byRequestId(requestId) { return load().find(l => l.requestId === requestId) || null; },
        upsert({ id, mentorEmail, requestId, menteeName, category, date, summary, action, status }) {
            const list = load();
            if (id) {
                const item = list.find(l => l.id === id);
                if (item) {
                    Object.assign(item, { menteeName, category, date, summary, action, status });
                    save(list);
                    return item;
                }
            }
            const nextId = list.reduce((max, l) => Math.max(max, l.id), 0) + 1;
            const entry = { id: nextId, mentorEmail, requestId: requestId || null, menteeName, category, date, summary, action, status: status || '완료' };
            list.push(entry);
            save(list);
            return entry;
        },
        remove(id) { save(load().filter(l => l.id !== id)); },
    };
})();
window.EF_CONSULT_LOG = EF_CONSULT_LOG;
