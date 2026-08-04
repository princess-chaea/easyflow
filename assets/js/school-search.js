/**
 * ─────────────────────────────────────────────────────────
 *  EasyFlow — 경북교육청 산하 기관·학교 검색 (NEIS Open API)
 *  사용법:
 *    initSchoolSearch(inputId, hiddenId, options?)
 *    - inputId  : 검색어 입력 필드 ID
 *    - hiddenId : 선택된 학교 코드를 저장할 hidden input ID (없으면 생략)
 *    - options  : { onSelect: fn(school) }
 * ─────────────────────────────────────────────────────────
 */

const EF_SCHOOL = (() => {
  const NEIS_BASE = 'https://open.neis.go.kr/hub/schoolInfo';
  const GB_CODE   = 'R10';  // 경상북도교육청
  const DEBOUNCE  = 280;    // ms

  // 비공개 API KEY 없이도 하루 1000건 무료 (충분)
  // 추후 키 발급 시 : const API_KEY = 'YOUR_KEY_HERE';

  let _timer = null;
  let _lastQuery = '';

  /** NEIS API 호출 → 학교 배열 반환 */
  async function fetchSchools(keyword) {
    if (!keyword || keyword.trim().length < 1) return [];
    const url = `${NEIS_BASE}?Type=json&pIndex=1&pSize=20&ATPT_OFCDC_SC_CODE=${GB_CODE}&SCHUL_NM=${encodeURIComponent(keyword.trim())}`;
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
          ${s.SCHUL_KND_SC_NM === '초등학교' ? '초' : s.SCHUL_KND_SC_NM === '중학교' ? '중' : s.SCHUL_KND_SC_NM === '고등학교' ? '고' : '기'}
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[14px] font-bold text-ink truncate">${s.SCHUL_NM}</span>
          <span class="block text-[12px] text-muted truncate">${s.LCTN_SC_NM} · ${s.ORG_RDNMA || ''}</span>
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
    if (!input.placeholder) input.placeholder = '학교명 입력 (예: 아천초)';

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
        const schools = await fetchSchools(q);
        setStatus(schools.length ? `${schools.length}개 기관/학교 검색됨` : '검색 결과가 없습니다', false);

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
