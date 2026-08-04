
    /* ═══════════════════════════════════════════════════════════════════════
       이지플로우 — 스마트 공문 달력
       담당: 권동신 (아천초등학교)
       ═══════════════════════════════════════════════════════════════════════ */

    /* ───────── 설정 ───────── */
    const NEIS = {
      KEY: 'de0d40e40d9f4c9b954b0e0ca1161bfa',
      BASE: 'https://open.neis.go.kr/hub'
    };
    let SCHOOL = { atpt: 'R10', code: '8781066', name: '아천초등학교', office: '경상북도교육청', area: '김천' };
    try { SCHOOL = { ...SCHOOL, ...JSON.parse(localStorage.getItem('ef_school') || '{}') }; } catch (e) { }

    /* 화면 곳곳의 학교명 라벨 동기화 (설정 메뉴 · 달력 툴바 칩) */
    function syncSchoolLabels() {
      ['settingsSchoolName', 'schoolChipName'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = SCHOOL.name;
      });
    }

    /* ───────── 부서 ─────────
       색상은 전부 DESIGN.md 공식 토큰에서만 가져옵니다(새 색 추가 없음).
       교무실·행정실·연구실 3색은 팀장님 홈 화면의 '이번 주 업무 배송 일정' 위젯과 동일합니다. */
    const BASE_DEPTS = {
      '교무실': { color: '#00a261', icon: 'edit_note' },       // success   — 홈 화면 매칭
      '행정실': { color: '#003893', icon: 'account_balance' },  // primary   — 홈 화면 매칭
      '연구실': { color: '#ff9000', icon: 'science' },          // warning   — 홈 화면 매칭
      '보건실': { color: '#df2c2c', icon: 'health_and_safety' },// danger
      '급식실': { color: '#ffb800', icon: 'restaurant' },       // accent-gold
      '정보부': { color: '#002463', icon: 'dns' },              // primary-active
      '생활안전부': { color: '#4e535e', icon: 'shield_person' }     // body
    };
    /* 사용자 편집(색 변경·부서 추가)은 ef_depts 오버레이로 저장 — 기본값은 항상 복원 가능 */
    let DEPTS = {}, DEPT_LIST = [];
    function loadDepts() {
      let ov = {};
      try { ov = JSON.parse(localStorage.getItem('ef_depts') || '{}'); } catch (e) { }
      DEPTS = {};
      Object.entries(BASE_DEPTS).forEach(([k, v]) => {
        DEPTS[k] = { ...v, color: (ov[k] && ov[k].color) || v.color };
      });
      Object.entries(ov).forEach(([k, v]) => {
        if (!BASE_DEPTS[k] && v && v.custom) DEPTS[k] = { color: v.color, icon: v.icon || 'group', custom: true };
      });
      DEPT_LIST = Object.keys(DEPTS);
    }
    function saveDeptOverrides() {
      const ov = {};
      Object.entries(DEPTS).forEach(([k, v]) => {
        if (BASE_DEPTS[k]) { if (v.color !== BASE_DEPTS[k].color) ov[k] = { color: v.color }; }
        else ov[k] = { color: v.color, icon: v.icon, custom: true };
      });
      localStorage.setItem('ef_depts', JSON.stringify(ov));
    }
    loadDepts();

    /* ───────── 사용자 표시 설정 (localStorage 저장) ─────────
       "사용자들이 자기 입맛대로 볼 수 있게" — 이 화면의 모든 표시 방식을 교사가 직접 고릅니다. */
    const DEFAULTS = {
      colorBy: 'status',   // status | dept        색상 기준
      showNeis: true,       //                      학사일정 표시
      showDone: false,      //                      완료 업무 표시
      urgentOnly: false,      //                      기한 엄수 업무만
      showWeekend: true,      //                      주말 표시
      perCell: 2,          // 2 | 3 | 5 | 99       셀당 업무 표시 개수
      density: 'cozy',     // compact | cozy | airy  밀도
      fontScale: 'normal',   // normal | large | xl  글자 크기 (xl = 아주 크게, 화면 15% 확대)
      range: 'month',    // month | 2w | 1m | term  목록 뷰 기간
      theme: 'light',    // light | dark         화면 모드
      sidebar: 'open'      // open | closed        사이드바 접기
    };
    let S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ef_settings') || '{}') };
    function saveSettings() { localStorage.setItem('ef_settings', JSON.stringify(S)); }

    /* ───────── 상태 ───────── */
    const today = new Date();
    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    let selectedDate = fmt(today);
    /* 375px에서는 월간 달력의 셀 폭이 46px까지 좁아져 업무명이 죽습니다.
       좁은 화면은 정보 손실이 없는 '목록' 뷰로 시작하고,
       사용자가 직접 뷰를 고르기 전까지는 화면 폭 변화에 따라 자동으로 따라갑니다. */
    const isNarrow = () => window.matchMedia('(max-width: 767px)').matches;
    let view = 'month';
    let userChoseView = true;
    let neisCache = {};          // 'YYYY-MM' → [{date, name, content, kind}]
    let activeDepts = new Set(DEPT_LIST);
    let searchTerm = '';
    let openTask = null;
    const done = new Set(JSON.parse(localStorage.getItem('ef_done') || '[]'));

    /* ───────── 유틸 ───────── */
    function fmt(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
    function ymd(s) { return s.replace(/-/g, ''); }
    function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
    const WD = ['일', '월', '화', '수', '목', '금', '토'];

    function toast(msg, icon) {
      const t = document.getElementById('toast');
      t.innerHTML = (icon ? '<span class="material-symbols-outlined text-[18px] mr-xxs align-middle">' + icon + '</span>' : '') + msg;
      t.classList.remove('hidden');
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
    }
    function saveDone() { localStorage.setItem('ef_done', JSON.stringify([...done])); }
    function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    /* 업무 고유키 — 연도가 바뀌어도 같은 업무는 같은 키 */
    function taskKey(t, dateStr) { return t.id + '@' + dateStr; }
  