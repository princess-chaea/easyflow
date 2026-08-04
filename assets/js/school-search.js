/**
 * ─────────────────────────────────────────────────────────
 *  EasyFlow — 경북교육청 산하 기관 및 부서·학교 검색
 *  (NEIS Open API 학교 검색 + 경북교육청 조직 데이터 로컬 검색)
 *  사용법:
 *    initSchoolSearch(inputId, hiddenId, options?)
 *    - inputId  : 검색어 입력 필드 ID
 *    - hiddenId : 선택된 학교/기관 코드를 저장할 hidden input ID (없으면 생략)
 *    - options  : { onSelect: fn(school) }
 * ─────────────────────────────────────────────────────────
 */

const EF_SCHOOL = (() => {
  const NEIS_BASE = 'https://open.neis.go.kr/hub/schoolInfo';
  const GB_CODE   = 'R10';  // 경상북도교육청
  const DEBOUNCE  = 280;    // ms

  // 나이스 교육정보 개방 포털 API키 (하루 1000건)
  const API_KEY = '04f275416e194b508bbd3ad51e42d887';

  let _timer = null;
  let _lastQuery = '';

  /**
   * 경북교육청 산하 기관 및 부서 데이터
   * (학교는 학교명으로 가입 가능하지만, 본청/직속기관/교육지원청은
   *  단일 조직명("경상북도교육청")으로 묶으면 너무 많은 인원이 섞이므로
   *  달력을 부서 단위로 관리할 수 있도록 부서 단위까지 검색 가능하게 구성)
   * 출처: https://www.gbe.kr/edupia/cm/cntnts/cntntsView.do?mi=14764&cntntsId=7214
   */
  const ORG_DATA = (() => {
    const list = [];
    let seq = 0;
    const add = (name, breadcrumb, category) => {
      list.push({ name, breadcrumb: breadcrumb || '', category, code: `ORG-${category}-${seq++}` });
    };

    // ── 본청 (담당관/국별 부서) ──────────────────────────────
    [
      ['소통협력관', ''],
      ['감사관', ''],
      ['기획예산관', ''],
      ['유초등교육과', '교육국'],
      ['중등교육과', '교육국'],
      ['체육건강과', '교육국'],
      ['학생생활과', '교육국'],
      ['창의인재과', '교육국'],
      ['미래정보교육과', '정책국'],
      ['행복교육지원과', '정책국'],
      ['교육안전과', '정책국'],
      ['총무과', '행정국'],
      ['행정과', '행정국'],
      ['학교지원과', '행정국'],
      ['재무과', '행정국'],
      ['시설과', '행정국'],
      ['미래학교추진단', '행정국'],
    ].forEach(([n, bureau]) => add(n, bureau, '본청'));

    // ── 직속기관 (사업소 8 + 도서관 4) ────────────────────────
    const institutions = [
      ['경상북도교육청연구원', '안동시', ['교육과정부', '교육지원부', '정책연구부', '총무부']],
      ['경상북도교육청연수원', '구미시', ['중등연수부', '유초등연수부', '총무부']],
      ['경상북도교육청정보센터', '경산시', ['총무과', '정보화과', '문헌정보과']],
      ['화랑교육원', '경주시', ['교학부', '총무부']],
      ['경상북도교육청과학원', '포항시', ['운영부', '총무부', '수학문화관']],
      ['경상북도교육청문화원', '포항시', ['문화예술부', '총무부']],
      ['경상북도교육청해양수련원', '영덕군', ['총무과', '운영과']],
      ['경상북도교육청발명인공지능교육원', '경주시·구미시·의성군', ['운영기획과', '총무과', '메이커교육관', '인공지능교육관']],
      ['경상북도교육청구미도서관', '구미시', ['총무과', '문헌정보과']],
      ['경상북도교육청안동도서관', '안동시', []],
      ['경상북도교육청상주도서관', '상주시', []],
      ['경상북도교육청영주선비도서관', '영주시', []],
    ];
    institutions.forEach(([n, loc, subs]) => {
      add(n, loc, '직속기관');
      subs.forEach(s => add(s, `${n} · ${loc}`, '직속기관'));
    });

    // ── 교육지원청 (22청) ──────────────────────────────────
    const eduOffices = [
      ['포항', [['유초등교육과', '교육지원국'], ['중등교육과', '교육지원국'], ['평생교육건강과', '교육지원국'], ['행정지원과', '행정지원국'], ['재정지원과', '행정지원국'], ['교육시설과', '행정지원국']]],
      ['구미', [['교육지원과'], ['평생교육건강과'], ['행정지원과'], ['재정지원과'], ['시설거점지원센터']]],
      ['경주', [['교육지원과'], ['평생교육건강과'], ['행정지원과'], ['시설거점지원센터']]],
      ['안동', [['교육지원과'], ['평생교육건강과'], ['행정지원과'], ['시설거점지원센터']]],
      ['경산', [['교육지원과'], ['평생교육건강과'], ['행정지원과'], ['시설거점지원센터']]],
      ['김천', [['교육지원과'], ['행정지원과'], ['시설거점지원센터']]],
      ['영주', [['교육지원과'], ['행정지원과']]],
      ['영천', [['교육지원과'], ['행정지원과']]],
      ['상주', [['교육지원과'], ['행정지원과']]],
      ['문경', [['교육지원과'], ['행정지원과']]],
      ['의성', [['교육지원과'], ['행정지원과']]],
      ['청송', [['교육지원과'], ['행정지원과']]],
      ['영양', [['교육지원과'], ['행정지원과']]],
      ['영덕', [['교육지원과'], ['행정지원과']]],
      ['청도', [['교육지원과'], ['행정지원과']]],
      ['고령', [['교육지원과'], ['행정지원과']]],
      ['성주', [['교육지원과'], ['행정지원과']]],
      ['칠곡', [['교육지원과'], ['행정지원과']]],
      ['예천', [['교육지원과'], ['행정지원과']]],
      ['봉화', [['교육지원과'], ['행정지원과']]],
      ['울진', [['교육지원과'], ['행정지원과']]],
      ['울릉', [['교육지원과'], ['행정지원과']]],
    ];
    eduOffices.forEach(([region, depts]) => {
      const orgName = `${region}교육지원청`;
      add(orgName, '', '교육지원청');
      depts.forEach(([d, bureau]) => add(d, bureau ? `${orgName} · ${bureau}` : orgName, '교육지원청'));
    });

    return list;
  })();

  /** 로컬 조직 데이터에서 기관/부서명 검색 */
  function searchOrgData(keyword) {
    const kw = keyword.trim();
    if (!kw) return [];
    return ORG_DATA
      .filter(o => o.name.includes(kw) || o.breadcrumb.includes(kw))
      .slice(0, 8)
      .map(o => ({
        SCHUL_NM: o.name,
        SCHUL_KND_SC_NM: '기관·부서',
        LCTN_SC_NM: o.category,
        ORG_RDNMA: o.breadcrumb,
        SD_SCHUL_CODE: o.code,
      }));
  }

  /** NEIS API 호출 → 학교 배열 반환 */
  async function fetchSchools(keyword) {
    if (!keyword || keyword.trim().length < 1) return [];
    const url = `${NEIS_BASE}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=12&ATPT_OFCDC_SC_CODE=${GB_CODE}&SCHUL_NM=${encodeURIComponent(keyword.trim())}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const rows = json?.schoolInfo?.[1]?.row;
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  /** 드롭다운 엘리먼트 생성/갱신 */
  function buildDropdown(anchor, schools, onPick) {
    let dd = document.getElementById('ef-school-dropdown');
    if (!dd) {
      dd = document.createElement('div');
      dd.id = 'ef-school-dropdown';
      dd.className = [
        'absolute z-[200] left-0 right-0 mt-1',
        'bg-white border border-gray-200 rounded-2xl shadow-xl',
        'overflow-hidden max-h-[280px] overflow-y-auto',
        'divide-y divide-gray-100'
      ].join(' ');
      dd.style.top = '100%';
      document.body.appendChild(dd);
    }

    if (!schools.length) {
      dd.classList.add('hidden');
      return;
    }

    // 위치 계산
    const rect = anchor.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    dd.style.left = (rect.left + window.scrollX) + 'px';
    dd.style.width = rect.width + 'px';
    dd.style.removeProperty('display');
    dd.classList.remove('hidden');

    dd.innerHTML = schools.map((s, i) => `
      <button type="button"
        class="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-center gap-3 group"
        data-idx="${i}">
        <span class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-[12px] font-bold group-hover:bg-primary group-hover:text-white transition-colors">
          ${s.SCHUL_KND_SC_NM === '초등학교' ? '초' : s.SCHUL_KND_SC_NM === '중학교' ? '중' : s.SCHUL_KND_SC_NM === '고등학교' ? '고' : s.SCHUL_KND_SC_NM === '기관·부서' ? '청' : '기'}
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[14px] font-bold text-ink truncate">${s.SCHUL_NM}</span>
          <span class="block text-[12px] text-muted truncate">${s.LCTN_SC_NM}${s.ORG_RDNMA ? ' · ' + s.ORG_RDNMA : ''}</span>
        </span>
        <span class="text-[11px] text-muted shrink-0 hidden group-hover:block">선택</span>
      </button>`).join('');

    dd.querySelectorAll('button').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        onPick(schools[i]);
        dd.classList.add('hidden');
      });
    });

    // 외부 클릭 시 닫기
    const outsideClick = (e) => {
      if (!dd.contains(e.target) && e.target !== anchor) {
        dd.classList.add('hidden');
        document.removeEventListener('click', outsideClick);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideClick), 100);
  }

  function closeDropdown() {
    const dd = document.getElementById('ef-school-dropdown');
    if (dd) dd.classList.add('hidden');
  }

  /**
   * 메인 초기화 함수
   * @param {string} inputId - 사용자 입력 필드 ID
   * @param {string|null} hiddenId - 학교코드 저장 hidden input ID (선택)
   * @param {{ onSelect?: function }} options
   */
  function initSchoolSearch(inputId, hiddenId = null, options = {}) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // 상위 요소에 relative 추가 (위치 기준)
    const wrapper = input.closest('div') || input.parentElement;
    if (wrapper && !wrapper.style.position) wrapper.style.position = 'relative';

    // 검색 힌트 텍스트
    if (!input.placeholder) input.placeholder = '학교명 또는 기관·부서명 입력 (예: 아천초, 미래정보교육과)';

    let statusEl = input.nextElementSibling;
    if (!statusEl || statusEl.tagName !== 'P') {
      statusEl = document.createElement('p');
      statusEl.className = 'text-[12px] text-muted mt-1 hidden';
      input.insertAdjacentElement('afterend', statusEl);
    }

    const setStatus = (msg, isLoading = false) => {
      statusEl.textContent = msg;
      statusEl.classList.toggle('hidden', !msg);
      statusEl.className = [
        'text-[12px] mt-1',
        isLoading ? 'text-muted' : 'text-green-600',
        !msg ? 'hidden' : ''
      ].join(' ');
    };

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (_timer) clearTimeout(_timer);
      if (q === _lastQuery) return;
      _lastQuery = q;

      if (q.length < 1) { closeDropdown(); setStatus(''); return; }

      setStatus('검색 중…', true);
      _timer = setTimeout(async () => {
        const [neisSchools, orgs] = await Promise.all([fetchSchools(q), Promise.resolve(searchOrgData(q))]);
        const schools = [...orgs, ...neisSchools];
        setStatus(schools.length ? `${schools.length}개 학교·기관 검색됨` : '검색 결과가 없습니다', false);

        buildDropdown(input, schools, (school) => {
          input.value = school.SCHUL_NM;
          _lastQuery = school.SCHUL_NM;
          if (hiddenId) {
            let hidden = document.getElementById(hiddenId);
            if (!hidden) {
              hidden = document.createElement('input');
              hidden.type = 'hidden';
              hidden.id = hiddenId;
              hidden.name = hiddenId;
              input.parentElement.appendChild(hidden);
            }
            hidden.value = school.SD_SCHUL_CODE;
          }
          // 추가 메타 저장 (학교 종류, 주소 등)
          input.dataset.schoolCode = school.SD_SCHUL_CODE;
          input.dataset.schoolType = school.SCHUL_KND_SC_NM;
          input.dataset.schoolAddr = school.ORG_RDNMA || '';

          setStatus(`✓ ${school.SCHUL_NM} 선택됨`);
          if (typeof options.onSelect === 'function') options.onSelect(school);
        });
      }, DEBOUNCE);
    });

    // ESC 키로 드롭다운 닫기
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown();
    });
  }

  return { initSchoolSearch, fetchSchools, closeDropdown };
})();

// 전역 노출
window.EF_SCHOOL = EF_SCHOOL;
