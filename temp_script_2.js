
    /* ═══════════════════════════════════════════════════════════════════════
       업무 → 실제 날짜 매핑
       ───────────────────────────────────────────────────────────────────────
       업무배송은 '몇 월 몇 주차'로 도착합니다. 실제 기한 날짜는 없으므로
       해당 주의 평일(월~금)에 고르게 분산 배치합니다.
       ※ 서버 구현 시에는 실제 배송일 + 학사일정(휴업일 제외)로 대체하세요.
       ═══════════════════════════════════════════════════════════════════════ */
    const WEEKDAY_SLOT = (() => {
      const bucket = {}, slot = {};
      TASKS.forEach(t => {
        const k = t.m + '-' + t.w;
        bucket[k] = (bucket[k] || 0);
        // 월~금(1~5)을 순환. 필수 업무는 주 앞쪽(월·화)에 배치해 여유를 둔다.
        slot[t.id] = t.p === 3 ? (bucket[k] % 3) + 1 : (bucket[k] % 4) + 2;
        bucket[k]++;
      });
      return slot;
    })();

    function dueDateOf(task, year) {
      const first = new Date(year, task.m - 1, 1);
      const wd = WEEKDAY_SLOT[task.id] || 5;              // 목표 요일 (1=월 … 5=금)
      let d = 1 + ((wd - first.getDay()) + 7) % 7;        // 해당 월 첫 번째 wd요일
      d += (task.w - 1) * 7;
      const last = new Date(year, task.m, 0).getDate();
      while (d > last) d -= 7;                            // 달을 넘으면 한 주 당김
      return fmt(new Date(year, task.m - 1, d));
    }

    /* 특정 월(YYYY, M)에 속하는 업무 목록 */
    function tasksOfMonth(year, month) {
      return TASKS.filter(t => t.m === month).map(t => ({ ...t, due: dueDateOf(t, year) }));
    }

    /* 특정 날짜의 업무 */
    function tasksOfDate(dateStr) {
      const d = parse(dateStr);
      return tasksOfMonth(d.getFullYear(), d.getMonth() + 1).filter(t => t.due === dateStr);
    }

    /* 필터 적용 */
    function passFilter(t) {
      if (!activeDepts.has(t.dept)) return false;
      if (S.urgentOnly && t.p < 3) return false;
      if (!S.showDone && done.has(taskKey(t, t.due))) return false;
      if (searchTerm) {
        const hay = (t.title + t.desc + t.dept + t.f.map(x => x.n).join(' ')).toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }
      return true;
    }

    /* 칩 색 — 사용자가 고른 '색상 기준'에 따라 상태색 또는 부서색 */
    function chipColor(t, st) { return S.colorBy === 'dept' ? DEPTS[t.dept].color : st.color; }

    /* 상태 색상 — 공식 팔레트 4색만 사용. 색은 오직 '상태'를 뜻합니다.
       label = 넓은 곳(패널·목록·모달)용, short = 좁은 달력 칩용 */
    function statusOf(t) {
      if (done.has(taskKey(t, t.due))) return { color: '#00a261', label: '완료', short: '완료', icon: 'check_circle' };
      const dd = daysBetween(fmt(today), t.due);
      if (dd < 0) return { color: '#df2c2c', label: '기한 경과', short: '경과', icon: 'error' };
      if (dd <= 3) return { color: '#df2c2c', label: 'D-' + dd, short: 'D-' + dd, icon: 'priority_high' };
      if (t.p === 3) return { color: '#ff9000', label: 'D-' + dd, short: 'D-' + dd, icon: 'flag' };
      return { color: '#003893', label: 'D-' + dd, short: 'D-' + dd, icon: 'schedule' };
    }

    /* ═══════════════════════════════════════════════════════════════════════
       NEIS 학사일정 연동
       ═══════════════════════════════════════════════════════════════════════ */
    async function loadNeis(year, month) {
      const key = year + '-' + String(month).padStart(2, '0');
      if (neisCache[key]) return neisCache[key];

      const from = year + String(month).padStart(2, '0') + '01';
      const lastDay = new Date(year, month, 0).getDate();
      const to = year + String(month).padStart(2, '0') + String(lastDay).padStart(2, '0');

      const url = NEIS.BASE + '/SchoolSchedule?KEY=' + NEIS.KEY + '&Type=json&pIndex=1&pSize=300'
        + '&ATPT_OFCDC_SC_CODE=' + SCHOOL.atpt + '&SD_SCHUL_CODE=' + SCHOOL.code
        + '&AA_FROM_YMD=' + from + '&AA_TO_YMD=' + to;

      try {
        const res = await fetch(url);
        const json = await res.json();
        const rows = json?.SchoolSchedule?.[1]?.row || [];
        const list = rows.map(r => ({
          date: r.AA_YMD.slice(0, 4) + '-' + r.AA_YMD.slice(4, 6) + '-' + r.AA_YMD.slice(6, 8),
          name: r.EVENT_NM,
          content: r.EVENT_CNTNT || '',
          kind: r.SBTR_DD_SC_NM || '해당없음'
        }));
        neisCache[key] = list;
        return list;
      } catch (e) {
        console.warn('[NEIS] 조회 실패 — 오프라인이거나 네트워크가 차단되었습니다.', e);
        neisCache[key] = [];
        return [];
      }
    }

    function neisOfDate(dateStr) {
      const key = dateStr.slice(0, 7);
      return (neisCache[key] || []).filter(e => e.date === dateStr);
    }

    /* ═══════════════════════════════════════════════════════════════════════
       렌더링 — 월간 달력
       ═══════════════════════════════════════════════════════════════════════ */
    async function render() {
      const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
      const card = document.getElementById('calendarCard');
      const loading = document.getElementById('calLoading');

      document.getElementById('calTitle').textContent = y + '년 ' + m + '월';
      card.setAttribute('aria-busy', 'true');
      loading.classList.remove('hidden');

      try {
        await loadNeis(y, m);

        if (view === 'list') renderList(y, m);
        else renderGrid(y, m, view === 'week');

        renderKPI(y, m);
        renderToday();
        renderPrepForms();
        renderDeptFilters();
      } finally {
        loading.classList.add('hidden');
        card.setAttribute('aria-busy', 'false');
      }
    }

    function renderGrid(y, m, weekOnly) {
      const grid = document.getElementById('calGrid');
      const listEl = document.getElementById('listView');
      document.getElementById('calendarViewport').classList.remove('hidden');
      listEl.classList.add('hidden');
      grid.innerHTML = '';

      const showNeis = S.showNeis;
      const first = new Date(y, m - 1, 1);
      let start = addDays(first, -first.getDay());
      let weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);

      if (weekOnly) {
        const sel = parse(selectedDate);
        start = addDays(sel, -sel.getDay());
        weeks = 1;
      }

      for (let i = 0; i < weeks * 7; i++) {
        const d = addDays(start, i);
        const ds = fmt(d);
        const outside = !weekOnly && d.getMonth() !== m - 1;
        const isToday = ds === fmt(today);
        const isSel = ds === selectedDate;

        const dayTasks = tasksOfDate(ds).filter(passFilter);
        const dayNeis = showNeis ? neisOfDate(ds) : [];
        const holiday = dayNeis.some(e => e.kind === '공휴일');

        const cell = document.createElement('div');
        cell.className = 'cal-cell wd-' + d.getDay() + ' border-b border-r border-hairline cursor-pointer relative'
          + (outside ? ' is-outside' : '')
          + (isSel ? ' is-selected' : '');
        if (weekOnly) cell.style.minHeight = '360px';
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일, 업무 ' + dayTasks.length + '건');

        const dowColor = holiday || d.getDay() === 0 ? 'text-danger' : (d.getDay() === 6 ? 'text-primary' : 'text-ink');

        let html = '<div class="flex items-center justify-between mb-xxs">'
          + '<span class="daynum font-mono text-body-sm tnum ' + dowColor + (isToday ? ' bg-primary text-on-primary rounded-full w-6 h-6 grid place-items-center' : '') + '">'
          + d.getDate() + '</span>';
        if (dayTasks.length > 2) html += '<span class="text-caption-strong text-muted tnum">' + dayTasks.length + '</span>';
        html += '</div>';

        // NEIS 학사일정
        dayNeis.forEach(e => {
          html += '<div class="flex items-start gap-xxs mb-xxs text-caption leading-tight ' + (e.kind === '공휴일' ? 'text-danger' : 'text-primary') + '" title="' + esc(e.name) + '">'
            + '<span class="material-symbols-outlined text-[13px] mt-[1px] shrink-0">' + (e.kind === '공휴일' ? 'celebration' : 'school') + '</span>'
            + '<span class="truncate min-w-0">' + esc(e.name) + '</span></div>';
        });

        // 내 일정 칩 (개인 플래너) — 업무 칩과 같은 규격, person 아이콘으로 구분
        eventsOfDate(ds).forEach(ev => {
          html += '<button class="task-chip w-full text-left rounded-sm" '
            + 'style="--chip-color:' + ev.color + '" title="' + esc(ev.title) + '" data-event="' + ev.id + '">'
            + '<span class="chip-meta flex items-center gap-xxs text-caption whitespace-nowrap mb-xxs">'
            + '<span class="material-symbols-outlined text-[13px] shrink-0" style="color:' + ev.color + '">person</span>'
            + '<span class="truncate min-w-0 font-semibold" style="color:' + ev.color + '">' + esc(ev.cat) + '</span>'
            + (ev.allDay ? '' : '<span class="ml-auto font-mono tnum shrink-0 text-muted">' + ev.timeS + '</span>')
            + '</span>'
            + '<span class="chip-title line-clamp-2 text-caption leading-snug text-ink">' + esc(ev.title) + '</span>'
            + '</button>';
        });

        // 업무 칩 — 팀장님 홈 화면 위젯과 동일한 처리(4px 바 + 5% 틴트)
        const limit = weekOnly ? 99 : S.perCell;
        dayTasks.slice(0, limit).forEach(t => {
          const st = statusOf(t);
          const isDone = done.has(taskKey(t, t.due));
          html += '<button class="task-chip w-full text-left rounded-sm" '
            + 'style="--chip-color:' + chipColor(t, st) + '" title="' + esc(t.title) + '" '
            + 'data-task="' + t.id + '" data-due="' + t.due + '">'
            + '<span class="chip-meta flex items-center gap-xxs text-caption whitespace-nowrap mb-xxs">'
            + '<span class="truncate min-w-0 font-semibold" style="color:' + DEPTS[t.dept].color + '">' + esc(t.dept) + '</span>'
            + '<span class="ml-auto font-mono tnum shrink-0" style="color:' + st.color + '">● ' + st.short + '</span>'
            + '</span>'
            /* line-clamp 는 display:-webkit-box 를 쓰므로 block 클래스를 함께 주면 안 됨 */
            + '<span class="chip-title line-clamp-2 text-caption leading-snug '
            + (isDone ? 'line-through opacity-60 text-body' : 'text-ink') + '">' + esc(t.title) + '</span>'
            + '</button>';
        });
        if (!weekOnly && dayTasks.length > limit) {
          html += '<button class="w-full text-left text-caption text-primary hover:underline pl-xs py-xxs" data-more="1">'
            + '+' + (dayTasks.length - limit) + '건 더보기</button>';
        }

        cell.innerHTML = html;
        cell.addEventListener('click', ev => {
          const evChip = ev.target.closest('[data-event]');
          if (evChip) { openEventModal(ds, EVENTS.find(x => x.id === evChip.dataset.event)); return; }
          const chip = ev.target.closest('[data-task]');
          if (chip) { openTaskModal(chip.dataset.task, chip.dataset.due); return; }
          selectDate(ds);
        });
        /* 빈 곳 더블클릭 → 그 날짜로 새 일정 바로 추가 (개인 플래너) */
        cell.addEventListener('dblclick', ev => {
          if (ev.target.closest('[data-task],[data-event]')) return;
          openEventModal(ds);
        });
        cell.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectDate(ds); }
        });
        grid.appendChild(cell);
      }
    }

    /* 목록 뷰의 기간 범위 — 사용자가 고른 S.range 에 따라 대상 업무를 모은다 */
    function tasksInRange(y, m) {
      const todayStr = fmt(today);
      const monthsOf = n => {
        const out = [];
        for (let i = 0; i < n; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
          out.push(...tasksOfMonth(d.getFullYear(), d.getMonth() + 1));
        }
        return out;
      };
      let list, label;
      switch (S.range) {
        case '2w':
          list = monthsOf(2).filter(t => { const dd = daysBetween(todayStr, t.due); return dd >= 0 && dd <= 14; });
          label = '오늘부터 2주'; break;
        case '1m':
          list = monthsOf(3).filter(t => { const dd = daysBetween(todayStr, t.due); return dd >= 0 && dd <= 31; });
          label = '오늘부터 1개월'; break;
        case 'term': {
          // 1학기 3~8월 / 2학기 9~2월
          const mm = today.getMonth() + 1;
          const months = (mm >= 3 && mm <= 8) ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 12, 1, 2];
          list = months.flatMap(k => {
            const yr = (months[0] === 9 && k <= 2) ? today.getFullYear() + 1 : today.getFullYear();
            return tasksOfMonth(yr, k);
          });
          label = (mm >= 3 && mm <= 8) ? '1학기 전체 (3~8월)' : '2학기 전체 (9~2월)'; break;
        }
        case 'year':
          list = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2].flatMap(k =>
            tasksOfMonth(k <= 2 ? today.getFullYear() + 1 : today.getFullYear(), k));
          label = '학사연도 전체 (3월~다음해 2월)'; break;
        default:
          list = tasksOfMonth(y, m); label = y + '년 ' + m + '월'; break;
      }
      return { list, label };
    }

    /* 목록(타임라인) 뷰 */
    function renderList(y, m) {
      const listEl = document.getElementById('listView');
      document.getElementById('calendarViewport').classList.add('hidden');
      listEl.classList.remove('hidden');

      const { list, label } = tasksInRange(y, m);
      const items = list.filter(passFilter).sort((a, b) => a.due.localeCompare(b.due));

      const head = '<div class="px-md py-sm bg-surface-soft border-b border-hairline flex items-center justify-between gap-xs flex-wrap">'
        + '<span class="text-caption text-body"><b class="text-ink">' + esc(label) + '</b> · 업무 '
        + '<b class="text-ink font-mono tnum">' + items.length + '</b>건</span>'
        + '<span class="text-caption text-muted">기한이 이른 순</span></div>';

      if (!items.length) {
        listEl.innerHTML = head
          + '<div class="py-xxl text-center"><span class="material-symbols-outlined text-[40px] text-muted-soft">filter_alt_off</span>'
          + '<p class="text-body-sm text-muted mt-xs">조건에 맞는 업무가 없습니다.</p>'
          + '<p class="text-caption text-muted-soft mt-xxs">기간을 넓히거나 부서 필터를 확인해 보세요.</p></div>';
        return;
      }
      document.getElementById('btnSidebar').addEventListener('click', () => {
        S.sidebar = S.sidebar === 'open' ? 'closed' : 'open';
        saveSettings(); applySettings();
      });

      listEl.innerHTML = head + items.map(t => {
        const st = statusOf(t);
        const d = parse(t.due);
        const isDone = done.has(taskKey(t, t.due));
        return '<button class="w-full text-left px-md py-base hover:bg-surface-soft transition-colors flex items-start gap-base group" data-task="' + t.id + '" data-due="' + t.due + '">'
          + '<div class="shrink-0 w-14 text-center">'
          + (S.range === 'month' ? '' : '<div class="text-caption text-muted tnum">' + (d.getMonth() + 1) + '월</div>')
          + '<div class="font-mono text-title-md text-ink tnum">' + d.getDate() + '</div>'
          + '<div class="text-caption text-muted">' + WD[d.getDay()] + '</div>'
          + '</div>'
          + '<div class="w-[3px] self-stretch rounded-pill shrink-0" style="background:' + st.color + '"></div>'
          + '<div class="flex-1 min-w-0">'
          + '<div class="flex items-center gap-xs flex-wrap">'
          + '<span class="text-caption-strong px-xs py-xxs rounded-xs bg-surface-strong text-ink">' + esc(t.dept) + '</span>'
          + (t.p === 3 ? '<span class="text-caption-strong text-danger">필수</span>' : '')
          + '<span class="text-caption text-muted flex items-center gap-xxs"><span class="material-symbols-outlined text-[14px]">schedule</span>' + esc(t.est) + '</span>'
          + '</div>'
          + '<h3 class="text-title-sm mt-xxs ' + (isDone ? 'line-through text-muted' : 'text-ink') + '">' + esc(t.title) + '</h3>'
          + '<p class="text-body-sm text-body mt-xxs line-clamp-2">' + esc(t.desc) + '</p>'
          + '<div class="flex items-center gap-xs mt-xs flex-wrap">'
          + t.f.slice(0, 3).map(x => '<span class="text-caption text-muted flex items-center gap-xxs"><span class="material-symbols-outlined text-[14px]">description</span>' + esc(x.n) + '</span>').join('')
          + (t.f.length > 3 ? '<span class="text-caption text-muted">외 ' + (t.f.length - 3) + '건</span>' : '')
          + '</div>'
          + '</div>'
          + '<div class="shrink-0 text-right">'
          + '<span class="font-mono text-caption-strong tnum" style="color:' + st.color + '">● ' + st.label + '</span>'
          + '<div class="text-caption text-primary mt-xxs flex items-center justify-end gap-xxs">'
          + '<span class="hidden sm:inline">자세히</span>'
          + '<span class="material-symbols-outlined text-[16px]">chevron_right</span>'
          + '</div>'
          + '</div>'
          + '</button>';
      }).join('');

      listEl.querySelectorAll('[data-task]').forEach(b =>
        b.addEventListener('click', () => openTaskModal(b.dataset.task, b.dataset.due)));
    }

    /* ═══════════════════════════════════════════════════════════════════════
       KPI · 오늘의 필수 업무 · 부서 필터
       ═══════════════════════════════════════════════════════════════════════ */
    /* 오늘부터 n일 이내의 업무 — 달 경계를 넘어 조회 */
    function tasksAhead(days) {
      const todayStr = fmt(today);
      const out = [];
      for (let i = 0; i <= 2; i++) {                       // 이번 달 + 다음 2개월
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        tasksOfMonth(d.getFullYear(), d.getMonth() + 1).forEach(t => {
          const dd = daysBetween(todayStr, t.due);
          if (dd >= 0 && dd <= days && !done.has(taskKey(t, t.due))) out.push(t);
        });
      }
      return out.sort((a, b) => a.due.localeCompare(b.due));
    }

    function renderKPI(y, m) {
      const all = tasksOfMonth(y, m);

      // ① 이번 달 배송 업무
      document.getElementById('kpiWeek').textContent = all.length;
      const must = all.filter(t => t.p === 3).length;
      document.getElementById('kpiWeekSub').textContent = all.length
        ? '이 중 ' + must + '건이 기한 엄수 업무입니다'
        : '이 달에 배송된 업무가 없습니다';

      // ② 앞으로 7일 이내 (달 경계 넘어 조회)
      const urgent = tasksAhead(7);
      document.getElementById('kpiUrgent').textContent = urgent.length;
      document.getElementById('kpiUrgentSub').textContent = urgent.length
        ? (() => {
          const d = parse(urgent[0].due);
          return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + urgent[0].title.slice(0, 18) + (urgent[0].title.length > 18 ? '…' : '');
        })()
        : '일주일 내 마감 업무가 없습니다';

      const nk = (neisCache[y + '-' + String(m).padStart(2, '0')] || []);
      document.getElementById('kpiNeis').textContent = nk.length;
      document.getElementById('kpiNeisSub').textContent = nk.length
        ? SCHOOL.name + ' 기준'
        : 'NEIS 응답 없음 (오프라인일 수 있습니다)';

      const doneCnt = all.filter(t => done.has(taskKey(t, t.due))).length;
      const pct = all.length ? Math.round(doneCnt / all.length * 100) : 0;
      const C = 2 * Math.PI * 19;
      document.getElementById('ringValue').style.strokeDashoffset = C * (1 - pct / 100);
      document.getElementById('ringPct').textContent = pct + '%';
      document.getElementById('ringLabel').textContent = doneCnt + ' / ' + all.length + '건 처리';
    }

    function renderToday() {
      const todayStr = fmt(today);
      const el = document.getElementById('todayList');
      document.getElementById('todayLabel').textContent =
        (today.getMonth() + 1) + '월 ' + today.getDate() + '일 (' + WD[today.getDay()] + ') 기준 · 앞으로 14일';

      const upcoming = tasksAhead(14).slice(0, 5);

      if (!upcoming.length) {
        el.innerHTML = '<li class="text-caption text-muted py-xs">2주 내 예정된 업무가 없습니다.</li>';
        return;
      }

      el.innerHTML = upcoming.map(t => {
        const st = statusOf(t);
        return '<li><button class="w-full text-left task-chip rounded-sm" '
          + 'style="--chip-color:' + chipColor(t, st) + '" data-task="' + t.id + '" data-due="' + t.due + '">'
          + '<span class="block text-body-sm text-ink leading-snug">' + esc(t.title) + '</span>'
          + '<span class="block text-caption mt-xxs">'
          + '<span style="color:' + DEPTS[t.dept].color + '">' + esc(t.dept) + '</span> · '
          + '<span class="font-mono tnum" style="color:' + st.color + '">' + st.label + '</span></span>'
          + '</button></li>';
      }).join('');

      el.querySelectorAll('[data-task]').forEach(b =>
        b.addEventListener('click', () => openTaskModal(b.dataset.task, b.dataset.due)));
    }

    /* 이번 주 준비 서식 — 앞으로 7일 내 마감 업무의 첨부 서식을 자동 나열
       (발표자료 '학사 일정에 최적화된 업무 가이드 자동 매칭'의 프론트 구현) */
    function renderPrepForms() {
      const el = document.getElementById('prepForms');
      const items = [];
      tasksAhead(7).forEach(t => t.f.forEach(f => items.push({ f, t })));
      if (!items.length) {
        el.innerHTML = '<li class="text-caption text-muted py-xs">7일 내 준비할 서식이 없습니다.</li>';
        return;
      }
      el.innerHTML = items.slice(0, 5).map(({ f, t }) => {
        const ext = f.n.split('.').pop().toLowerCase();
        const icon = ext === 'xlsx' ? 'table_chart' : (ext === 'pptx' ? 'slideshow' : 'description');
        return '<li><button class="w-full text-left flex items-center gap-xs py-xs px-xs rounded-sm hover:bg-surface-soft transition-colors group" '
          + 'data-task="' + t.id + '" data-due="' + t.due + '" title="' + esc(t.title) + ' (' + t.due.slice(5).replace('-', '/') + ' 마감)">'
          + '<span class="material-symbols-outlined text-[18px] text-muted group-hover:text-primary shrink-0">' + icon + '</span>'
          + '<span class="flex-1 min-w-0">'
          + '<span class="block text-caption text-ink leading-snug truncate">' + esc(f.n) + '</span>'
          + '<span class="block text-caption text-muted-soft truncate">' + esc(t.title) + '</span>'
          + '</span>'
          + '<span class="font-mono text-caption tnum shrink-0 ' + (daysBetween(fmt(today), t.due) <= 3 ? 'text-danger' : 'text-muted') + '">D-' + daysBetween(fmt(today), t.due) + '</span>'
          + '</button></li>';
      }).join('')
        + (items.length > 5 ? '<li class="text-caption text-muted-soft pt-xxs pl-xs">외 ' + (items.length - 5) + '개 — 각 업무에서 확인</li>' : '');

      el.querySelectorAll('[data-task]').forEach(b =>
        b.addEventListener('click', () => openTaskModal(b.dataset.task, b.dataset.due)));
    }

    function renderDeptFilters() {
      const box = document.getElementById('deptFilters');
      if (box.dataset.built) { // 카운트만 갱신
        const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
        DEPT_LIST.forEach(name => {
          const n = tasksOfMonth(y, m).filter(t => t.dept === name).length;
          const c = box.querySelector('[data-count="' + name + '"]');
          if (c) c.textContent = n;
        });
        return;
      }
      const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
      box.innerHTML = DEPT_LIST.map(name => {
        const n = tasksOfMonth(y, m).filter(t => t.dept === name).length;
        return '<label class="flex items-center gap-xs py-xs cursor-pointer group">'
          + '<input type="checkbox" class="dept-cb w-[18px] h-[18px] rounded-xs border-hairline text-primary focus:ring-primary" checked value="' + name + '">'
          + '<span class="w-2 h-2 rounded-full shrink-0" style="background:' + DEPTS[name].color + '" aria-hidden="true"></span>'
          + '<span class="text-body-sm text-body group-hover:text-ink transition-colors flex-1">' + name + '</span>'
          + '<span class="font-mono text-caption text-muted tnum" data-count="' + name + '">' + n + '</span>'
          + '</label>';
      }).join('');
      box.dataset.built = '1';
      box.querySelectorAll('.dept-cb').forEach(cb => cb.addEventListener('change', () => {
        cb.checked ? activeDepts.add(cb.value) : activeDepts.delete(cb.value);
        render();
      }));
    }

    /* ═══════════════════════════════════════════════════════════════════════
       ① 날짜 선택 → 슬라이드 패널
       ═══════════════════════════════════════════════════════════════════════ */
    function selectDate(ds) {
      selectedDate = ds;
      const d = parse(ds);
      if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) {
        cursor = new Date(d.getFullYear(), d.getMonth(), 1);
        render().then(() => openDayPanel(ds));
        return;
      }
      render();
      openDayPanel(ds);
    }

    function openDayPanel(ds) {
      const d = parse(ds);
      const tasks = tasksOfDate(ds).filter(passFilter);
      const events = neisOfDate(ds);
      const myEvents = eventsOfDate(ds);

      document.getElementById('dayPanelWeekday').textContent =
        d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 · ' + WD[d.getDay()] + '요일';
      document.getElementById('dayPanelTitle').textContent = d.getDate() + '일';
      document.getElementById('dayPanelSummary').textContent =
        '업무 ' + tasks.length + '건 · 학사일정 ' + events.length + '건'
        + (myEvents.length ? ' · 내 일정 ' + myEvents.length + '건' : '');

      let html = '';

      /* 내 일정 (개인 플래너) — 누르면 수정/삭제 */
      if (myEvents.length) {
        html += '<section><h3 class="text-title-sm text-ink mb-xs flex items-center gap-xxs">'
          + '<span class="material-symbols-outlined text-[18px] text-primary">person</span>내 일정</h3>'
          + '<ul class="space-y-xs">'
          + myEvents.map(ev => '<li><button class="w-full text-left rounded-md border border-hairline p-sm hover:border-primary hover:shadow-soft transition-all" data-event="' + ev.id + '">'
            + '<div class="flex items-center gap-xs mb-xxs">'
            + '<span class="w-[3px] h-3.5 rounded-pill shrink-0" style="background:' + ev.color + '"></span>'
            + '<span class="text-caption-strong" style="color:' + ev.color + '">' + esc(ev.cat) + '</span>'
            + '<span class="font-mono text-caption text-muted tnum ml-auto shrink-0">'
            + (ev.allDay ? '종일' : ev.timeS + ' ~ ' + ev.timeE) + '</span>'
            + '</div>'
            + '<p class="text-body-sm text-ink leading-snug">' + esc(ev.title) + '</p>'
            + (ev.place ? '<p class="text-caption text-muted mt-xxs flex items-center gap-xxs"><span class="material-symbols-outlined text-[13px]">location_on</span>' + esc(ev.place) + '</p>' : '')
            + '</button></li>').join('')
          + '</ul></section>';
      }

      if (events.length) {
        html += '<section><h3 class="text-title-sm text-ink mb-xs flex items-center gap-xxs">'
          + '<span class="material-symbols-outlined text-[18px] text-primary">school</span>학사일정</h3>'
          + '<ul class="space-y-xs">'
          + events.map(e => '<li class="rounded-md border border-hairline p-sm">'
            + '<div class="flex items-center justify-between gap-xs">'
            + '<span class="text-body-sm text-ink">' + esc(e.name) + '</span>'
            + (e.kind !== '해당없음' ? '<span class="text-caption-strong text-danger shrink-0">' + esc(e.kind) + '</span>' : '')
            + '</div>'
            + (e.content ? '<p class="text-caption text-muted mt-xxs">' + esc(e.content) + '</p>' : '')
            + '</li>').join('')
          + '</ul></section>';
      }

      if (tasks.length) {
        html += '<section><h3 class="text-title-sm text-ink mb-xs flex items-center gap-xxs">'
          + '<span class="material-symbols-outlined text-[18px] text-primary">local_shipping</span>배송된 업무</h3>'
          + '<ul class="space-y-xs">'
          + tasks.map(t => {
            const st = statusOf(t);
            const isDone = done.has(taskKey(t, t.due));
            return '<li><button class="w-full text-left rounded-md border border-hairline p-sm hover:border-primary hover:shadow-soft transition-all group" data-task="' + t.id + '" data-due="' + t.due + '">'
              + '<div class="flex items-center gap-xs mb-xxs flex-wrap">'
              + '<span class="w-[3px] h-3.5 rounded-pill" style="background:' + st.color + '"></span>'
              + '<span class="text-caption-strong" style="color:' + DEPTS[t.dept].color + '">' + esc(t.dept) + '</span>'
              + '<span class="font-mono text-caption tnum ml-auto" style="color:' + st.color + '">● ' + st.label + '</span>'
              + '</div>'
              + '<p class="text-body-sm ' + (isDone ? 'line-through text-muted' : 'text-ink') + ' leading-snug">' + esc(t.title) + '</p>'
              + '<div class="flex items-center gap-sm mt-xs text-caption text-muted">'
              + '<span class="flex items-center gap-xxs"><span class="material-symbols-outlined text-[14px]">description</span>서식 ' + t.f.length + '</span>'
              + '<span class="flex items-center gap-xxs"><span class="material-symbols-outlined text-[14px]">history</span>사례 ' + t.c.length + '</span>'
              + '<span class="flex items-center gap-xxs"><span class="material-symbols-outlined text-[14px]">schedule</span>' + esc(t.est) + '</span>'
              + '<span class="ml-auto text-primary flex items-center shrink-0">'
              + '<span class="sr-only">업무 열기</span>'
              + '<span class="material-symbols-outlined text-[16px]">chevron_right</span>'
              + '</span>'
              + '</div></button></li>';
          }).join('')
          + '</ul></section>';
      }

      if (!events.length && !tasks.length && !myEvents.length) {
        html = '<div class="py-xl text-center">'
          + '<span class="material-symbols-outlined text-[40px] text-muted-soft">event_available</span>'
          + '<p class="text-body-sm text-muted mt-xs">이 날짜에 배송된 업무가 없습니다.</p>'
          + '<p class="text-caption text-muted-soft mt-xxs">여유 있는 날입니다.</p></div>';
      }

      /* ★ 일정 추가 — 본문 한가운데에서 바로 보이는 큰 버튼 */
      html += '<button id="btnPanelAddEvent" class="w-full h-14 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary text-primary transition-colors flex items-center justify-center gap-xs">'
        + '<span class="w-8 h-8 rounded-full bg-primary text-on-primary grid place-items-center shrink-0">'
        + '<span class="material-symbols-outlined text-[20px]">add</span></span>'
        + '<span class="text-body-sm font-semibold">이 날짜에 일정 추가</span>'
        + '</button>';

      document.getElementById('dayPanelBody').innerHTML = html;
      document.getElementById('dayPanelBody').querySelectorAll('[data-task]').forEach(b =>
        b.addEventListener('click', () => openTaskModal(b.dataset.task, b.dataset.due)));
      document.getElementById('dayPanelBody').querySelectorAll('[data-event]').forEach(b =>
        b.addEventListener('click', () => openEventModal(ds, EVENTS.find(x => x.id === b.dataset.event))));
      document.getElementById('btnPanelAddEvent').addEventListener('click', () => {
        closeDayPanel(); openEventModal(ds);
      });

      const panel = document.getElementById('dayPanel');
      panel.classList.remove('hidden');
      panel.classList.add('flex', 'anim-slide');
    }

    function closeDayPanel() {
      const p = document.getElementById('dayPanel');
      p.classList.add('hidden'); p.classList.remove('flex', 'anim-slide');
    }

    /* ═══════════════════════════════════════════════════════════════════════
       ② 업무 상세 모달 — 서식 / 매뉴얼 / 과거 사례
       ═══════════════════════════════════════════════════════════════════════ */
    function openTaskModal(id, due) {
      const base = TASKS.find(t => t.id === id);
      if (!base) return;
      openTask = { ...base, due };
      const t = openTask;
      const st = statusOf(t);

      document.getElementById('modalDept').textContent = t.dept;
      const dueEl = document.getElementById('modalDue');
      const d = parse(due);
      dueEl.textContent = (d.getMonth() + 1) + '/' + d.getDate() + ' · ' + st.label;
      dueEl.style.color = st.color; dueEl.style.borderColor = st.color;
      document.getElementById('modalEstText').textContent = t.est + ' 예상 · 담당 ' + t.owner;
      document.getElementById('modalTitle').textContent = t.title;
      document.getElementById('modalDesc').textContent = t.desc;
      document.getElementById('cntForms').textContent = t.f.length;
      document.getElementById('cntCases').textContent = t.c.length;
      // document.getElementById('modalDone').checked = done.has(taskKey(t, due));

      /* --- 탭 1 : 공문 서식 --- */
      document.getElementById('tabForms').innerHTML =
        '<div class="rounded-md bg-surface-soft border border-hairline p-sm mb-base flex items-start gap-xs">'
        + '<span class="material-symbols-outlined text-[18px] text-primary mt-[1px]">auto_awesome</span>'
        + '<p class="text-caption text-body leading-relaxed">'
        + '내려받은 서식은 <b class="text-ink">서식 자료실 ▸ 서식 자동 완성</b>에서 '
        + '<b class="text-ink">' + esc(SCHOOL.name) + '</b> 정보(학교명·대표자·연락처·연도)로 자동 치환할 수 있습니다.'
        + '</p></div>'
        + t.f.map(x => {
          const ext = x.n.split('.').pop().toLowerCase();
          const icon = ext === 'xlsx' ? 'table_chart' : (ext === 'pptx' ? 'slideshow' : 'description');
          const tone = ext === 'xlsx' ? '#00a261' : (ext === 'pptx' ? '#ff9000' : '#003893');
          return '<div class="flex items-center gap-sm rounded-md border border-hairline p-sm hover:border-primary hover:shadow-soft transition-all group">'
            + '<div class="w-10 h-10 rounded-full bg-surface-strong grid place-items-center shrink-0">'
            + '<span class="material-symbols-outlined text-[20px]" style="color:' + tone + '">' + icon + '</span></div>'
            + '<div class="flex-1 min-w-0">'
            + '<p class="text-body-sm text-ink leading-snug break-words" title="' + esc(x.n) + '">' + esc(x.n) + '</p>'
            + '</div>'
            + '<div class="flex items-center gap-xs shrink-0 self-center">'
            + (ext.startsWith('hwp') ? '<button class="h-9 px-sm sm:px-base rounded-pill bg-primary/10 text-primary text-caption-strong hover:bg-primary hover:text-on-primary transition-colors whitespace-nowrap flex items-center gap-xxs" onclick="location.href=\'서식 자료실_한글파일서식선택.html\'"><span class="material-symbols-outlined text-[16px]">auto_fix_high</span>HWP 뚝딱 완성</button>' : '')
            + '<button class="dl-btn h-9 px-sm sm:px-base rounded-pill bg-surface-strong text-ink text-caption-strong hover:bg-primary hover:text-on-primary transition-colors whitespace-nowrap" data-file="' + esc(x.n) + '">내려받기</button>'
            + '</div>'
            + '</div>';
        }).join('');

      /* --- 탭 2 : 처리 매뉴얼 --- */
      document.getElementById('tabManual').innerHTML =
        '<div class="rounded-md border-l-[3px] border-primary bg-surface-soft p-sm mb-lg">'
        + '<p class="text-caption-strong text-muted mb-xxs">근거</p>'
        + '<p class="text-body-sm text-ink">' + esc(t.legal) + '</p></div>'
        + '<ol class="relative border-l border-hairline ml-[10px] space-y-lg">'
        + t.s.map((step, i) =>
          '<li class="pl-md relative">'
          + '<span class="absolute -left-[11px] top-[2px] w-[21px] h-[21px] rounded-full bg-primary text-on-primary grid place-items-center font-mono text-caption-strong tnum">' + (i + 1) + '</span>'
          + '<p class="text-body-md text-ink leading-relaxed">' + esc(step) + '</p></li>').join('')
        + '</ol>'
        + '<div class="mt-lg rounded-md border border-hairline p-sm flex items-center gap-sm">'
        + '<span class="material-symbols-outlined text-[20px] text-accent-gold ms-fill">tips_and_updates</span>'
        + '<p class="text-caption text-body flex-1">이 절차대로 진행하기 어려우면 <b class="text-ink">인생도서관</b>에서 같은 업무를 처리한 멘토를 자동 추천받을 수 있습니다.</p>'
        + '</div>';

      /* --- 탭 3 : 과거 처리 사례 --- */
      document.getElementById('tabCases').innerHTML = t.c.length
        ? t.c.map(c =>
          '<article class="rounded-md border border-hairline p-md">'
          + '<div class="flex items-center gap-xs mb-xs flex-wrap">'
          + '<span class="w-8 h-8 rounded-full bg-surface-strong grid place-items-center text-caption-strong text-primary shrink-0">' + esc(c.school.slice(0, 2)) + '</span>'
          + '<span class="text-body-sm text-ink">' + esc(c.school) + '</span>'
          + '<span class="text-caption text-muted">' + esc(c.by) + '</span>'
          + '<span class="font-mono text-caption text-muted tnum ml-auto">' + esc(c.y) + '학년도</span>'
          + '</div>'
          + '<p class="text-body-md text-body leading-relaxed">' + esc(c.note) + '</p>'
          + '<div class="flex items-center gap-base mt-sm pt-sm border-t border-hairline-soft">'
          + '<button class="text-caption text-muted hover:text-primary transition-colors flex items-center gap-xxs"><span class="material-symbols-outlined text-[15px]">thumb_up</span>도움됨</button>'
          + '<button class="text-caption text-muted hover:text-primary transition-colors flex items-center gap-xxs"><span class="material-symbols-outlined text-[15px]">forum</span>이 분께 질문</button>'
          + '</div></article>').join('')
        : '<div class="py-xxl text-center"><span class="material-symbols-outlined text-[40px] text-muted-soft">history</span>'
        + '<p class="text-body-sm text-muted mt-xs">아직 등록된 처리 사례가 없습니다.</p>'
        + '<p class="text-caption text-muted-soft mt-xxs">이 업무를 처리한 뒤 사례를 남기면 다음 선생님께 큰 도움이 됩니다.</p></div>';

      /* --- 탭 4 : AI 도우미 (Gemini 실연동) --- */
      renderAiTab();

      switchTab('forms');
      document.getElementById('taskModal').classList.remove('hidden');
      document.getElementById('btnCloseModal').focus();

      document.querySelectorAll('.dl-btn').forEach(b => b.addEventListener('click', () => {
        toast(b.dataset.file + ' 내려받는 중…', 'download');
      }));
    }

    function closeModal() {
      document.getElementById('taskModal').classList.add('hidden');
      openTask = null;
    }

    function switchTab(name) {
      document.querySelectorAll('.modal-tab').forEach(b => {
        const on = b.dataset.tab === name;
        /* className 전체 재작성 대신 상태 클래스만 토글 — 탭별 고유 클래스(아이콘 정렬 등) 보존 */
        b.classList.toggle('text-primary', on);
        b.classList.toggle('border-primary', on);
        b.classList.toggle('text-muted', !on);
        b.classList.toggle('border-transparent', !on);
        b.classList.toggle('hover:text-body', !on);
        b.setAttribute('aria-selected', on);
      });
      ['forms', 'manual', 'cases', 'ai'].forEach(k => {
        document.getElementById('tab' + k[0].toUpperCase() + k.slice(1)).classList.toggle('hidden', k !== name);
      });
    }

    /* ═══════════════════════════════════════════════════════════════════════
       학교 검색 (NEIS schoolInfo 실연동)
       ═══════════════════════════════════════════════════════════════════════ */
    let schoolTimer;
    async function searchSchool(q) {
      const box = document.getElementById('schoolResults');
      if (!q || q.length < 2) { box.classList.add('hidden'); return; }

      try {
        const url = NEIS.BASE + '/schoolInfo?KEY=' + NEIS.KEY + '&Type=json&pIndex=1&pSize=12&SCHUL_NM=' + encodeURIComponent(q);
        const json = await (await fetch(url)).json();
        const rows = json?.schoolInfo?.[1]?.row || [];
        if (!rows.length) {
          box.innerHTML = '<li class="px-base py-sm text-body-sm text-muted">검색 결과가 없습니다.</li>';
          box.classList.remove('hidden'); return;
        }
        box.innerHTML = rows.map(r =>
          '<li><button class="w-full text-left px-base py-sm hover:bg-surface-soft transition-colors" '
          + 'data-atpt="' + r.ATPT_OFCDC_SC_CODE + '" data-code="' + r.SD_SCHUL_CODE + '" '
          + 'data-name="' + esc(r.SCHUL_NM) + '" data-office="' + esc(r.ATPT_OFCDC_SC_NM) + '" data-org="' + esc(r.JU_ORG_NM || '') + '">'
          + '<span class="block text-body-sm text-ink">' + esc(r.SCHUL_NM) + '</span>'
          + '<span class="block text-caption text-muted">' + esc(r.ATPT_OFCDC_SC_NM) + ' · ' + esc(r.ORG_RDNMA || '') + '</span>'
          + '</button></li>').join('');
        box.classList.remove('hidden');

        box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          SCHOOL = { atpt: b.dataset.atpt, code: b.dataset.code, name: b.dataset.name, office: b.dataset.office, area: b.dataset.org };
          localStorage.setItem('ef_school', JSON.stringify(SCHOOL));   // 한 번 고르면 계속 기억
          document.getElementById('schoolInput').value = SCHOOL.name;
          document.getElementById('schoolMeta').textContent = SCHOOL.office + ' · ' + (SCHOOL.area || '-') + ' · 코드 ' + SCHOOL.code;
          syncSchoolLabels();
          box.classList.add('hidden');
          neisCache = {};
          toast(SCHOOL.name + ' 학사일정을 불러옵니다', 'school');
          closeSchoolModal();
          render();
        }));
      } catch (e) {
        box.innerHTML = '<li class="px-base py-sm text-body-sm text-danger">NEIS 연결에 실패했습니다.</li>';
        box.classList.remove('hidden');
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       이벤트 바인딩
       ═══════════════════════════════════════════════════════════════════════ */
    document.getElementById('btnPrev').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); render(); });
    document.getElementById('btnNext').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); render(); });
    document.getElementById('btnToday').addEventListener('click', () => {
      cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      selectedDate = fmt(today); render();
    });

    document.querySelectorAll('.view-tab').forEach(b => b.addEventListener('click', () => {
      view = b.dataset.view; userChoseView = true; syncViewTabs(); render();
    }));

    /* 창 폭이 바뀌면 (사용자가 뷰를 직접 고르지 않았을 때만) 적절한 뷰로 따라간다 */
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (userChoseView) return;
        const want = isNarrow() ? 'list' : 'month';
        if (want !== view) { view = want; syncViewTabs(); render(); }
      }, 200);
    });
    function syncViewTabs() {
      document.querySelectorAll('.view-tab').forEach(b => {
        const on = b.dataset.view === view;
        b.className = 'view-tab h-9 px-base rounded-pill text-caption-strong transition-all '
          + (on ? 'bg-canvas text-primary shadow-soft' : 'text-muted hover:text-body');
        b.setAttribute('aria-selected', on);
      });
      // 기간 선택은 목록 뷰에서만, 월 이동 버튼은 목록·전체기간에서 의미 없음
      const rw = document.getElementById('rangeWrap');
      rw.classList.toggle('hidden', view !== 'list');
      rw.classList.toggle('flex', view === 'list');
      const monthNav = view === 'list' && S.range !== 'month';
      ['btnPrev', 'btnNext', 'btnToday'].forEach(id =>
        document.getElementById(id).classList.toggle('opacity-40', monthNav));
      document.getElementById('calTitle').classList.toggle('opacity-40', monthNav);
    }

    document.getElementById('rangeSel').addEventListener('change', e => {
      S.range = e.target.value; saveSettings(); syncViewTabs(); render();
    });

    /* ═══════════════════════════════════════════════════════════════════════
       보기 설정 — 세그먼트 버튼 · 토글 · localStorage 반영
       ═══════════════════════════════════════════════════════════════════════ */
    const TOGGLES = { optNeis: 'showNeis', optWeekend: 'showWeekend', optDone: 'showDone', optUrgentOnly: 'urgentOnly' };

    function applySettings() {
      // 테마 (html.dark 클래스가 CSS 변수 전환)
      document.documentElement.classList.toggle('dark', S.theme === 'dark');
      // 사이드바 접기
      document.body.dataset.sidebar = S.sidebar;
      const asideBtn = document.getElementById('btnSidebar');
      if (asideBtn) {
        const open = S.sidebar === 'open';
        asideBtn.setAttribute('aria-expanded', open);
        asideBtn.querySelector('.material-symbols-outlined').textContent = open ? 'left_panel_close' : 'left_panel_open';
        document.getElementById('sidebarBtnLabel').textContent = open ? '메뉴 접기' : '메뉴 펴기';
        asideBtn.title = open ? '사이드바 접기 — 달력을 넓게 봅니다' : '사이드바 펴기';
      }
      // body 데이터 속성 (CSS가 밀도·글자크기·주말을 처리)
      document.body.dataset.density = S.density;
      document.body.dataset.font = S.fontScale;
      document.body.dataset.weekend = S.showWeekend ? 'on' : 'off';

      // 세그먼트 버튼 선택 상태
      document.querySelectorAll('.seg').forEach(b => {
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(S[b.dataset.opt]) === b.dataset.val);
      });

      // 체크박스
      Object.entries(TOGGLES).forEach(([id, key]) => {
        const el = document.getElementById(id); if (el) el.checked = !!S[key];
      });

      // 기간 선택 값 반영
      const rs = document.getElementById('rangeSel'); if (rs) rs.value = S.range;

      // 색상 기준 안내 + 범례 강조
      document.getElementById('colorByHint').textContent = S.colorBy === 'dept'
        ? '카드 색이 주관 부서를 나타냅니다. 상태는 오른쪽 ● 표시로 확인하세요.'
        : '카드 색이 업무 상태(마감 임박·완료 등)를 나타냅니다. 부서는 이름으로 표시됩니다.';

      renderLegendDept();
    }

    function renderLegendDept() {
      document.getElementById('legendDept').innerHTML = DEPT_LIST.map(name =>
        '<li class="flex items-center gap-xxs min-w-0">'
        + '<span class="w-1 h-4 rounded-pill shrink-0" style="background:' + DEPTS[name].color + '"></span>'
        + '<span class="truncate" style="color:' + DEPTS[name].color + '">' + name + '</span></li>').join('');
    }

    document.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.opt;
      S[key] = key === 'perCell' ? Number(b.dataset.val) : b.dataset.val;
      saveSettings(); applySettings(); render();
    }));

    Object.entries(TOGGLES).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { S[key] = el.checked; saveSettings(); applySettings(); render(); });
    });

    document.getElementById('btnResetOpts').addEventListener('click', () => {
      S = { ...DEFAULTS }; saveSettings(); applySettings(); render();
      toast('보기 설정을 기본값으로 되돌렸습니다', 'restart_alt');
    });

    document.getElementById('btnDeptAll').addEventListener('click', () => {
      const all = activeDepts.size === DEPT_LIST.length;
      activeDepts = all ? new Set() : new Set(DEPT_LIST);
      document.querySelectorAll('.dept-cb').forEach(cb => cb.checked = !all);
      render();
    });

    let searchTimer;
    document.getElementById('taskSearch').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { searchTerm = e.target.value.trim().toLowerCase(); render(); }, 220);
    });

    document.getElementById('schoolInput').addEventListener('input', e => {
      clearTimeout(schoolTimer);
      schoolTimer = setTimeout(() => searchSchool(e.target.value.trim()), 320);
    });
    document.getElementById('btnSchoolSearch').addEventListener('click', () =>
      searchSchool(document.getElementById('schoolInput').value.trim()));

    document.getElementById('btnClosePanel').addEventListener('click', closeDayPanel);
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('modalScrim').addEventListener('click', closeModal);
    document.querySelectorAll('.modal-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    /* ── 인쇄: 전용 헤더 필드를 채운 뒤 인쇄 ── */
    function fillPrintHeader() {
      const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
      const rangeLabel = view === 'list' ? tasksInRange(y, m).label : y + '년 ' + m + '월';
      const shown = (view === 'list' ? tasksInRange(y, m).list : tasksOfMonth(y, m)).filter(passFilter).length;
      const deptTxt = activeDepts.size === DEPT_LIST.length ? '전체 부서' : [...activeDepts].join('·');
      document.getElementById('printTitle').textContent = '스마트 공문 달력 — ' + rangeLabel + ' 업무표';
      document.getElementById('printMeta').textContent =
        SCHOOL.name + ' · ' + deptTxt + ' · 표시 업무 ' + shown + '건'
        + (S.urgentOnly ? ' · 기한 엄수만' : '') + (S.showDone ? '' : ' · 완료 제외');
      document.getElementById('printDate').textContent =
        '출력 ' + fmt(today) + ' · 권동신';
    }
    window.addEventListener('beforeprint', fillPrintHeader);
    document.getElementById('btnPrint').addEventListener('click', () => { fillPrintHeader(); window.print(); });
    // document.getElementById('btnDayPrint').addEventListener('click', () => { fillPrintHeader(); window.print(); });

    /* ── CSV 내보내기: 현재 화면(기간·필터)에 보이는 업무를 엑셀용으로 저장 ── */
    /* document.getElementById('btnCsv').addEventListener('click', () => {
      const y = cursor.getFullYear(), m = cursor.getMonth() + 1;
      const src = view === 'list' ? tasksInRange(y, m) : { list: tasksOfMonth(y, m), label: y + '년 ' + m + '월' };
      const rows = src.list.filter(passFilter).sort((a, b) => a.due.localeCompare(b.due));
      if (!rows.length) { toast('내보낼 업무가 없습니다', 'filter_alt_off'); return; }

      const q = v => '"' + String(v).replace(/"/g, '""') + '"';
      const csv = '\uFEFF'  // BOM — 엑셀 한글 깨짐 방지
        + [['마감일', '요일', '상태', '주관부서', '업무명', '설명', '예상소요', '담당', '기한엄수', '완료', '서식수', '관련서식'].map(q).join(',')]
          .concat(rows.map(t => {
            const st = statusOf(t); const d = parse(t.due);
            return [t.due, WD[d.getDay()], st.label, t.dept, t.title, t.desc, t.est, t.owner,
            t.p === 3 ? 'O' : '', done.has(taskKey(t, t.due)) ? 'O' : '',
            t.f.length, t.f.map(x => x.n).join(' / ')].map(q).join(',');
          })).join('\r\n');

      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = '이지플로우_업무표_' + src.label.replace(/\s/g, '') + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      toast(rows.length + '건을 CSV로 저장했습니다. 엑셀에서 바로 열립니다', 'table_view');
    }); */
    // document.getElementById('btnSearch').addEventListener('click', () => document.getElementById('taskSearch').focus());

    /* 키보드 단축키 */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!document.getElementById('eventModal').classList.contains('hidden')) closeEventModal();
        else if (!document.getElementById('deptModal').classList.contains('hidden')) closeDeptModal();
        else if (!document.getElementById('schoolModal').classList.contains('hidden')) closeSchoolModal();
        else if (!settingsMenu.classList.contains('hidden')) {
          settingsMenu.classList.add('hidden'); btnSettings.setAttribute('aria-expanded', 'false');
        }
        else if (!document.getElementById('taskModal').classList.contains('hidden')) closeModal();
        else if (!document.getElementById('dayPanel').classList.contains('hidden')) closeDayPanel();
        else if (!navPanel.classList.contains('hidden')) {
          navPanel.classList.add('hidden');
          btnNavMenu.setAttribute('aria-expanded', 'false');
          btnNavMenu.querySelector('span').textContent = 'menu';
        }
      }
      if (e.target.matches('input, textarea')) return;
      if (e.key === '/') { e.preventDefault(); document.getElementById('taskSearch').focus(); }
      if (e.key === 'ArrowLeft') document.getElementById('btnPrev').click();
      if (e.key === 'ArrowRight') document.getElementById('btnNext').click();
      if (e.key.toLowerCase() === 't') document.getElementById('btnToday').click();
    });

    /* ═══════════════════════════════════════════════════════════════════════
       ③ AI 도우미 (Google Gemini 실연동)
       ─────────────────────────────────────────────────────────────────────
       ⚠ [서버 참고] 데모 편의상 API 키를 클라이언트에 직접 둡니다.
         운영 배포 시에는 NEIS 키와 마찬가지로 서버 프록시(/api/ai-proxy)로
         옮겨야 합니다. (오늘의 한끼 앱 neis-proxy.js 패턴 그대로)
       - 모델: gemini-2.5-flash (속도 우선)
       - 실패/오프라인 시: 데모 폴백 문구 + 재시도 버튼 (화면이 깨지지 않음)
       - 같은 업무·같은 요청은 localStorage 캐시로 재호출 방지
       ═══════════════════════════════════════════════════════════════════════ */
    const GEMINI_KEY = 'YOUR_API_KEY_HERE';
    const GEMINI_MODEL = 'gemini-2.5-flash';
    let aiCache = {};
    try { aiCache = JSON.parse(localStorage.getItem('ef_ai_cache') || '{}'); } catch (e) { aiCache = {}; }
    function saveAiCache() {
      try { localStorage.setItem('ef_ai_cache', JSON.stringify(aiCache)); }
      catch (e) { aiCache = {}; localStorage.removeItem('ef_ai_cache'); } // 용량 초과 시 캐시 비움
    }

    async function askGemini(userPrompt, systemPrompt) {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
        }),
        signal: AbortSignal.timeout(25000)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const txt = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!txt.trim()) throw new Error('빈 응답');
      return txt.trim();
    }

    /* 마크다운 경량 렌더러 — AI 응답 전용. esc() 선적용으로 XSS 차단 */
    function mdLite(md) {
      const inline = s => s
        .replace(/\*\*(.+?)\*\*/g, '<b class="text-ink font-semibold">$1</b>')
        .replace(/`([^`]+)`/g, '<code class="font-mono text-caption bg-surface-strong rounded-xs px-xxs">$1</code>');
      let out = '', inUl = false, inOl = false;
      const close = () => {
        if (inUl) { out += '</ul>'; inUl = false; }
        if (inOl) { out += '</ol>'; inOl = false; }
      };
      esc(md).split('\n').forEach(line => {
        const t = line.trim();
        if (/^#{1,4}\s/.test(t)) {
          close(); out += '<p class="text-title-sm text-primary mt-base mb-xs">' + inline(t.replace(/^#{1,4}\s/, '')) + '</p>';
        } else if (/^[-*•]\s/.test(t)) {
          if (!inUl) { close(); out += '<ul class="space-y-xxs my-xs">'; inUl = true; }
          out += '<li class="flex gap-xs text-body-sm text-body leading-relaxed"><span class="text-primary shrink-0">•</span><span>' + inline(t.replace(/^[-*•]\s/, '')) + '</span></li>';
        } else if (/^\d+[.)]\s/.test(t)) {
          if (!inOl) { close(); out += '<ol class="space-y-xxs my-xs">'; inOl = true; }
          out += '<li class="flex gap-xs text-body-sm text-body leading-relaxed"><span class="font-mono text-primary tnum shrink-0">' + t.match(/^\d+/)[0] + '.</span><span>' + inline(t.replace(/^\d+[.)]\s/, '')) + '</span></li>';
        } else if (t === '') { close(); }
        else { close(); out += '<p class="text-body-sm text-body leading-relaxed mb-xs">' + inline(t) + '</p>'; }
      });
      close();
      return out;
    }

    /* 업무 컨텍스트 → 프롬프트 재료 */
    function taskContext(t) {
      return '업무명: ' + t.title
        + '\n설명: ' + t.desc
        + '\n주관 부서: ' + t.dept + ' (담당: ' + t.owner + ')'
        + '\n마감일: ' + t.due + ' (예상 소요 ' + t.est + ')'
        + '\n근거: ' + t.legal
        + '\n처리 절차: ' + t.s.join(' → ')
        + '\n관련 서식: ' + t.f.map(x => x.n).join(', ')
        + '\n학교: ' + SCHOOL.name + ' (경상북도교육청)';
    }

    const AI_ACTIONS = {
      draft: {
        icon: 'edit_document', label: '기안문 초안 생성',
        desc: '이 업무의 내부결재 기안문 초안을 만들어 드립니다',
        sys: '당신은 경상북도교육청 소속 초등학교 행정 업무 15년 경력의 교무부장입니다. 공문서 작성 규정(행정업무운영 편람)을 정확히 지키는 기안문을 작성합니다. 반드시 한국어로, 학교 공문서 격식체(개조식)로 작성하세요.',
        prompt: t => '아래 업무의 내부결재 기안문 초안을 작성해 주세요.\n\n' + taskContext(t)
          + '\n\n형식:\n## 제목\n(간결한 기안 제목 1줄)\n## 관련\n(관련 근거 1~2줄)\n## 본문\n(1. 2. 3. 개조식, "~하고자 합니다" 격식체)\n## 붙임\n(붙임 문서 목록, "끝." 표기)\n\n주의: 실제 학교명(' + '학교명' + ')과 날짜를 그대로 쓰고, 괄호 안내 문구는 빼고 완성된 문장만 출력하세요.'
      },
      coach: {
        icon: 'school', label: '신규교사 맞춤 코칭',
        desc: '처음 맡아도 따라할 수 있는 단계별 코칭을 받습니다',
        sys: '당신은 초등학교 신규 교사를 돕는 다정한 멘토 교사입니다. 처음 이 업무를 맡은 교사가 실수 없이 처리하도록 실무 중심으로 코칭합니다. 반드시 한국어로 답하세요.',
        prompt: t => '아래 업무를 처음 맡은 신규 교사를 위해 코칭해 주세요.\n\n' + taskContext(t)
          + '\n\n형식:\n## 오늘 바로 할 일 3가지\n(체크리스트)\n## 단계별 진행 요령\n(각 절차마다 실무 팁 1줄씩)\n## 자주 하는 실수 3가지\n(실수와 예방법)\n## 시간 배분 제안\n(예상 소요 ' + '시간' + ' 기준)'
      }
    };

    /* AI 탭 렌더 */
    function renderAiTab() {
      const t = openTask;
      document.getElementById('tabAi').innerHTML =
        '<div class="rounded-md bg-surface-soft border border-hairline p-sm mb-base flex items-start gap-xs">'
        + '<span class="material-symbols-outlined text-[18px] text-accent-gold mt-[1px] ms-fill">auto_awesome</span>'
        + '<p class="text-caption text-body leading-relaxed">'
        + '<b class="text-ink">Google Gemini</b>가 이 업무의 정보(절차·근거·서식)를 바탕으로 실시간 생성합니다. '
        + '생성 결과는 <b class="text-ink">초안</b>이므로 반드시 검토 후 사용하세요. 같은 요청은 저장해 두어 다시 부르지 않습니다.'
        + '</p></div>'
        + Object.entries(AI_ACTIONS).map(([k, a]) =>
          '<div class="rounded-md border border-hairline mb-sm overflow-hidden">'
          + '<div class="flex items-center gap-sm p-sm">'
          + '<div class="w-10 h-10 rounded-full bg-primary/5 grid place-items-center shrink-0">'
          + '<span class="material-symbols-outlined text-[20px] text-primary">' + a.icon + '</span></div>'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-body-sm text-ink font-semibold">' + a.label + '</p>'
          + '<p class="text-caption text-muted">' + a.desc + '</p>'
          + '</div>'
          + '<button class="ai-run h-9 px-base rounded-pill bg-primary text-on-primary text-caption-strong hover:bg-primary-active transition-colors shrink-0 flex items-center gap-xxs" data-ai="' + k + '">'
          + '<span class="material-symbols-outlined text-[16px]">auto_awesome</span>생성</button>'
          + '</div>'
          + '<div class="ai-out hidden border-t border-hairline bg-surface-soft/50 px-md py-base" data-out="' + k + '"></div>'
          + '</div>').join('');

      document.querySelectorAll('#tabAi .ai-run').forEach(b =>
        b.addEventListener('click', () => runAi(b.dataset.ai)));

      // 캐시된 결과가 있으면 바로 보여준다
      Object.keys(AI_ACTIONS).forEach(k => {
        const cached = aiCache[aiKey(k)];
        if (cached) showAiResult(k, cached, true);
      });
    }

    function aiKey(action) { return openTask.id + '|' + action; }

    async function runAi(action) {
      const a = AI_ACTIONS[action];
      const out = document.querySelector('#tabAi [data-out="' + action + '"]');
      const btn = document.querySelector('#tabAi [data-ai="' + action + '"]');
      out.classList.remove('hidden');
      btn.disabled = true;
      out.innerHTML =
        '<div class="flex items-center gap-sm py-sm" role="status">'
        + '<span class="ai-spin material-symbols-outlined text-[20px] text-primary">progress_activity</span>'
        + '<p class="text-body-sm text-body">Gemini가 작성 중입니다… <span class="text-caption text-muted">(보통 5~15초)</span></p></div>';
      try {
        const text = await askGemini(a.prompt(openTask), a.sys);
        aiCache[aiKey(action)] = { text, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
        saveAiCache();
        showAiResult(action, aiCache[aiKey(action)], false);
      } catch (err) {
        out.innerHTML =
          '<div class="flex items-start gap-xs py-xs">'
          + '<span class="material-symbols-outlined text-[18px] text-warning mt-[1px]">wifi_off</span>'
          + '<div class="flex-1"><p class="text-body-sm text-ink font-semibold">지금은 AI 연결이 어렵습니다</p>'
          + '<p class="text-caption text-muted mt-xxs">네트워크 또는 사용량 한도 문제일 수 있습니다 (' + esc(err.message) + '). '
          + '왼쪽 <b>처리 매뉴얼</b> 탭의 절차는 그대로 이용할 수 있습니다.</p>'
          + '<button class="mt-xs h-8 px-sm rounded-pill bg-surface-strong text-caption-strong text-ink hover:bg-hairline transition-colors" onclick="runAi(\'' + action + '\')">다시 시도</button>'
          + '</div></div>';
      } finally { btn.disabled = false; }
    }

    function showAiResult(action, cached, fromCache) {
      const out = document.querySelector('#tabAi [data-out="' + action + '"]');
      out.classList.remove('hidden');
      out.innerHTML =
        '<div class="flex items-center justify-between gap-xs mb-xs">'
        + '<p class="text-caption text-muted flex items-center gap-xxs">'
        + '<span class="material-symbols-outlined text-[14px]">' + (fromCache ? 'history' : 'check_circle') + '</span>'
        + (fromCache ? '저장된 결과 · ' : '생성 완료 · ') + esc(cached.at) + '</p>'
        + '<div class="flex gap-xxs">'
        + '<button class="ai-copy h-8 px-sm rounded-pill bg-surface-strong text-caption-strong text-ink hover:bg-hairline transition-colors flex items-center gap-xxs" data-copy="' + action + '">'
        + '<span class="material-symbols-outlined text-[14px]">content_copy</span>복사</button>'
        + '<button class="h-8 px-sm rounded-pill bg-surface-strong text-caption-strong text-ink hover:bg-hairline transition-colors flex items-center gap-xxs" onclick="runAi(\'' + action + '\')">'
        + '<span class="material-symbols-outlined text-[14px]">refresh</span>다시 생성</button>'
        + '</div></div>'
        + '<div class="ai-md">' + mdLite(cached.text) + '</div>';
      out.querySelector('.ai-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(cached.text)
          .then(() => toast('클립보드에 복사했습니다. 한글(HWP)에 붙여넣으세요', 'content_copy'))
          .catch(() => toast('복사에 실패했습니다', 'error'));
      });
    }

    /* ── AI 주간 브리핑 (사이드바) ── */
    async function runWeekBrief() {
      const btn = document.getElementById('btnAiBrief');
      const out = document.getElementById('aiBriefOut');
      const ahead = tasksAhead(14);
      if (!ahead.length) { toast('앞으로 2주간 예정된 업무가 없습니다', 'celebration'); return; }

      const cacheKey = 'brief|' + fmt(today) + '|' + SCHOOL.code;
      if (aiCache[cacheKey]) { showBrief(aiCache[cacheKey], true); return; }

      btn.disabled = true;
      out.classList.remove('hidden');
      out.innerHTML = '<div class="flex items-center gap-xs py-xs" role="status">'
        + '<span class="ai-spin material-symbols-outlined text-[18px] text-primary">progress_activity</span>'
        + '<span class="text-caption text-body">2주치 업무를 분석 중…</span></div>';
      try {
        const list = ahead.slice(0, 20).map(t =>
          '- ' + t.due + ' [' + t.dept + '] ' + t.title + ' (소요 ' + t.est + (t.p === 3 ? ', 기한엄수' : '') + ')').join('\n');
        const text = await askGemini(
          '오늘은 ' + fmt(today) + '입니다. ' + SCHOOL.name + ' 교사의 앞으로 2주 업무 목록입니다.\n\n' + list
          + '\n\n형식:\n## 이번 주 핵심 3가지\n(가장 급하고 중요한 순서로, 이유 포함)\n## 미리 준비하면 좋은 것\n(다음 주 업무 대비 1~2가지)\n## 한 줄 응원\n(따뜻하게 1줄)\n\n전체 200자 내외로 간결하게.',
          '당신은 초등학교 교사의 업무 비서입니다. 바쁜 교사가 10초 만에 읽도록 핵심만 간결한 한국어로 브리핑합니다.');
        aiCache[cacheKey] = { text, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
        saveAiCache();
        showBrief(aiCache[cacheKey], false);
      } catch (err) {
        out.innerHTML = '<p class="text-caption text-muted py-xs">'
          + '<span class="material-symbols-outlined text-[14px] align-middle text-warning">wifi_off</span> '
          + 'AI 연결이 어렵습니다. 위 목록의 마감순 정렬은 그대로 유효합니다. '
          + '<button class="text-primary hover:underline" onclick="runWeekBrief()">다시 시도</button></p>';
      } finally { btn.disabled = false; }
    }

    function showBrief(cached, fromCache) {
      const out = document.getElementById('aiBriefOut');
      out.classList.remove('hidden');
      out.innerHTML =
        '<div class="rounded-md bg-primary/5 border border-primary/10 p-sm">'
        + '<div class="flex items-center justify-between mb-xxs">'
        + '<p class="text-caption-strong text-primary flex items-center gap-xxs">'
        + '<span class="material-symbols-outlined text-[14px] ms-fill">auto_awesome</span>Gemini 주간 브리핑</p>'
        + '<button class="text-caption text-muted hover:text-primary" onclick="document.getElementById(\'aiBriefOut\').classList.add(\'hidden\')" aria-label="브리핑 접기">'
        + '<span class="material-symbols-outlined text-[16px]">expand_less</span></button>'
        + '</div>'
        + '<div class="ai-md">' + mdLite(cached.text) + '</div>'
        + '<p class="text-caption text-muted-soft mt-xxs">' + (fromCache ? '오늘 이미 생성한 브리핑입니다 · ' : '') + esc(cached.at) + '</p>'
        + '</div>';
    }

    document.getElementById('btnAiBrief').addEventListener('click', runWeekBrief);

    /* 구글 캘린더 — 연동 설정은 손정표 선생님 담당 페이지에서 (5/18 협의회 역할 분담) */
    document.getElementById('btnGcal').addEventListener('click', () =>
      toast('업무 배송 ▸ 구글 캘린더 연동에서 1회 설정하면 마감일이 자동 동기화됩니다', 'event_available'));

    /* ═══════════════════════════════════════════════════════════════════════
       ④ 개인 일정 (플래너) — 스마트 공문 달력을 개인 업무 플래너로도 쓴다
       저장: localStorage ef_events  [{id,title,desc,allDay,date,dateEnd,timeS,timeE,cat,color,place}]
       ═══════════════════════════════════════════════════════════════════════ */
    let EVENTS = [];
    try { EVENTS = JSON.parse(localStorage.getItem('ef_events') || '[]'); } catch (e) { EVENTS = []; }
    function saveEvents() { localStorage.setItem('ef_events', JSON.stringify(EVENTS)); }
    function eventsOfDate(ds) { return EVENTS.filter(e => e.date <= ds && ds <= (e.dateEnd || e.date)); }

    const EV_COLORS = ['#003893', '#df2c2c', '#ff9000', '#00a261', '#7c3aed', '#e91e8c', '#ff5722', '#0f9d8a'];
    let evEditing = null;   // 수정 중인 일정 id (null = 새 일정)
    let evCat = '개인', evColor = EV_COLORS[0];

    function openEventModal(ds, ev) {
      evEditing = ev ? ev.id : null;
      document.getElementById('evModalHead').textContent = ev ? '일정 수정' : '새 일정';
      document.getElementById('btnEvDelete').classList.toggle('hidden', !ev);
      document.getElementById('evTitle').value = ev ? ev.title : '';
      document.getElementById('evDesc').value = ev ? (ev.desc || '') : '';
      document.getElementById('evAllday').checked = ev ? !!ev.allDay : true;
      document.getElementById('evDate').value = ev ? ev.date : (ds || fmt(today));
      document.getElementById('evDateEnd').value = ev ? (ev.dateEnd || '') : '';
      document.getElementById('evTimeS').value = ev ? (ev.timeS || '09:00') : '09:00';
      document.getElementById('evTimeE').value = ev ? (ev.timeE || '10:00') : '10:00';
      document.getElementById('evPlace').value = ev ? (ev.place || '') : '';
      evCat = ev ? ev.cat : '개인';
      evColor = ev ? ev.color : EV_COLORS[0];
      resetAiPaste();
      renderEvCats(); renderEvColors(); syncEvAllday();
      document.getElementById('eventModal').classList.remove('hidden');
      document.getElementById('evTitle').focus();
    }
    function closeEventModal() { document.getElementById('eventModal').classList.add('hidden'); }

    /* 분류 칩: 개인 + 부서 목록 (부서를 고르면 그 부서색이 기본 선택됨)
       맨 끝 [편집] 칩으로 부서·색상 관리를 바로 열 수 있다 */
    function renderEvCats() {
      const cats = ['개인', ...DEPT_LIST];
      document.getElementById('evCats').innerHTML = cats.map(c =>
        '<button data-cat="' + esc(c) + '" class="h-8 px-sm rounded-pill text-caption-strong transition-colors '
        + (c === evCat ? 'bg-primary text-on-primary' : 'bg-surface-strong text-body hover:bg-hairline') + '">'
        + esc(c) + '</button>').join('')
        + '<button id="evCatEdit" class="h-8 px-sm rounded-pill border border-dashed border-hairline text-caption-strong text-muted hover:text-primary hover:border-primary transition-colors flex items-center gap-xxs" title="분류(부서) 추가·색 변경">'
        + '<span class="material-symbols-outlined text-[13px]">edit</span>편집</button>';
      document.querySelectorAll('#evCats [data-cat]').forEach(b => b.addEventListener('click', () => {
        evCat = b.dataset.cat;
        if (DEPTS[evCat]) { evColor = DEPTS[evCat].color; renderEvColors(); }
        renderEvCats();
      }));
      document.getElementById('evCatEdit').addEventListener('click', openDeptModal);
    }
    function renderEvColors() {
      const colors = [...new Set([...EV_COLORS, ...Object.values(DEPTS).map(d => d.color)])].slice(0, 10);
      document.getElementById('evColors').innerHTML = colors.map(c =>
        '<button data-color="' + c + '" aria-label="색 ' + c + '" class="w-9 h-9 rounded-full transition-transform '
        + (c === evColor ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110') + '" style="background:' + c + '"></button>').join('');
      document.querySelectorAll('#evColors [data-color]').forEach(b => b.addEventListener('click', () => {
        evColor = b.dataset.color; renderEvColors();
      }));
    }
    function syncEvAllday() {
      const off = document.getElementById('evAllday').checked;
      document.querySelectorAll('.ev-time').forEach(el => el.classList.toggle('hidden', off));
    }
    document.getElementById('evAllday').addEventListener('change', syncEvAllday);

    document.getElementById('btnEvSave').addEventListener('click', () => {
      const title = document.getElementById('evTitle').value.trim();
      const date = document.getElementById('evDate').value;
      if (!title) { toast('일정 제목을 입력해 주세요', 'edit'); document.getElementById('evTitle').focus(); return; }
      if (!date) { toast('시작일을 선택해 주세요', 'event'); return; }
      let dateEnd = document.getElementById('evDateEnd').value || '';
      if (dateEnd && dateEnd < date) dateEnd = '';   // 역순 방지
      const obj = {
        id: evEditing || ('E' + Math.random().toString(36).slice(2, 9)),
        title, date, dateEnd,
        desc: document.getElementById('evDesc').value.trim(),
        allDay: document.getElementById('evAllday').checked,
        timeS: document.getElementById('evTimeS').value || '09:00',
        timeE: document.getElementById('evTimeE').value || '10:00',
        cat: evCat, color: evColor,
        place: document.getElementById('evPlace').value.trim()
      };
      if (evEditing) EVENTS = EVENTS.map(e => e.id === evEditing ? obj : e);
      else EVENTS.push(obj);
      saveEvents(); closeEventModal(); render();
      toast(evEditing ? '일정을 수정했습니다' : '일정을 추가했습니다 (이 기기에 저장)', 'event_available');
    });
    document.getElementById('btnEvDelete').addEventListener('click', () => {
      EVENTS = EVENTS.filter(e => e.id !== evEditing);
      saveEvents(); closeEventModal(); render();
      toast('일정을 삭제했습니다', 'delete');
    });
    document.getElementById('btnEvCancel').addEventListener('click', closeEventModal);
    document.getElementById('btnCloseEvent').addEventListener('click', closeEventModal);
    document.getElementById('eventScrim').addEventListener('click', closeEventModal);
    document.getElementById('btnNewEvent').addEventListener('click', () => openEventModal(selectedDate || fmt(today)));
    /* 날짜 패널의 [이 날짜에 일정 추가] 버튼은 패널을 열 때마다 본문에 새로 그려지므로
       openDayPanel() 안에서 바인딩한다 */

    /* ═══════════════════════════════════════════════════════════════════════
       ④-2 AI 새 일정 추가 — 업무 메신저 쪽지(텍스트·캡처)를 붙여넣으면
            Gemini가 날짜·시간·제목·분류만 구조화(JSON)해 일정으로 변환
       설계 원칙
       - 파일 첨부가 아니라 '붙여넣기(Ctrl+V)' 한 동작으로 끝낸다
       - AI 응답은 responseMimeType=application/json 강제 → 파싱 실패 최소화
       - 바로 등록하지 않고 미리보기 체크리스트를 거친다(잘못 추출 방지)
       - 인사말·서명·연락처는 버리고 실무 정보(제목/일시/장소/준비물)만 담는다
       ═══════════════════════════════════════════════════════════════════════ */
    async function askGeminiJSON(parts, systemPrompt) {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1300, responseMimeType: 'application/json' }
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const txt = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!txt.trim()) throw new Error('빈 응답');
      return JSON.parse(txt);
    }

    const AI_EV_SYS =
      '당신은 학교 업무용 메신저 쪽지에서 캘린더 일정을 추출하는 비서입니다. '
      + '반드시 지시된 JSON 스키마로만 응답합니다. 인사말, 서명, 소속·직급, 전화번호, '
      + '"감사합니다" 같은 형식적 문구는 모두 무시하고 실제 일정 정보만 추출합니다.';

    function aiEvPrompt() {
      return '오늘은 ' + fmt(today) + ' (' + WD[today.getDay()] + '요일) 입니다.\n'
        + '아래 쪽지에서 캘린더에 넣을 일정을 추출해 JSON으로만 답하세요.\n\n'
        + '스키마: {"events":[{"title":문자열(15자 내 간결한 일정명),'
        + '"date":"YYYY-MM-DD","dateEnd":"YYYY-MM-DD 또는 빈문자열(기간 일정만)",'
        + '"allDay":불리언,"timeS":"HH:MM","timeE":"HH:MM",'
        + '"cat":분류,"place":"장소 또는 빈문자열","memo":"준비물·대상 등 실무 정보 1줄 또는 빈문자열"}]}\n\n'
        + '규칙:\n'
        + '1. 상대 날짜(내일, 이번 주 금요일, 8/12(화) 등)는 오늘 기준 절대 날짜로 변환\n'
        + '2. 시간이 명시되면 allDay=false, 종료 시간이 없으면 시작+1시간\n'
        + '3. "~까지 제출/회신" 등 마감은 그 날짜의 종일 일정로, 제목 끝에 "제출" 등 동작 유지\n'
        + '4. cat 은 반드시 [' + ['개인', ...DEPT_LIST].join(', ') + '] 중 하나. 발신 부서나 내용으로 판단, 애매하면 "개인"\n'
        + '5. 일정이 여러 개면 각각 추출, 날짜를 특정할 수 없는 일정은 제외\n'
        + '6. 일정 정보가 전혀 없으면 {"events":[]}\n\n쪽지:\n';
    }

    /* 추출 결과 정규화 — AI가 규칙을 어겨도 화면이 깨지지 않게 방어 */
    function normalizeAiEvents(raw) {
      const cats = ['개인', ...DEPT_LIST];
      return (raw && Array.isArray(raw.events) ? raw.events : [])
        .filter(e => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''))
        .slice(0, 8)
        .map(e => ({
          title: String(e.title).slice(0, 40),
          date: e.date,
          dateEnd: /^\d{4}-\d{2}-\d{2}$/.test(e.dateEnd || '') && e.dateEnd > e.date ? e.dateEnd : '',
          allDay: e.allDay !== false,
          timeS: /^\d{2}:\d{2}$/.test(e.timeS || '') ? e.timeS : '09:00',
          timeE: /^\d{2}:\d{2}$/.test(e.timeE || '') ? e.timeE : '10:00',
          cat: cats.includes(e.cat) ? e.cat : '개인',
          place: String(e.place || '').slice(0, 40),
          memo: String(e.memo || '').slice(0, 80)
        }));
    }

    let aiParsed = [];   // 미리보기 중인 추출 결과

    async function runAiPaste(parts, kindLabel) {
      const st = document.getElementById('aiPasteStatus');
      const pv = document.getElementById('aiPastePreview');
      aiParsed = []; pv.innerHTML = '';           // 이전 결과가 실패 시 남지 않게 먼저 비움
      st.classList.remove('hidden'); pv.classList.add('hidden');
      st.innerHTML = '<div class="flex items-center gap-xs" role="status">'
        + '<span class="ai-spin material-symbols-outlined text-[18px] text-primary">progress_activity</span>'
        + '<span class="text-caption text-body">' + kindLabel + '에서 일정을 찾고 있습니다… (5~10초)</span></div>';
      try {
        const raw = await askGeminiJSON(parts, AI_EV_SYS);
        aiParsed = normalizeAiEvents(raw);
        st.classList.add('hidden');
        if (!aiParsed.length) {
          st.classList.remove('hidden');
          st.innerHTML = '<p class="text-caption text-body flex items-center gap-xxs">'
            + '<span class="material-symbols-outlined text-[15px] text-warning">search_off</span>'
            + '날짜가 있는 일정을 찾지 못했습니다. 아래에 직접 입력해 주세요.</p>';
          return;
        }
        renderAiPreview();
      } catch (err) {
        st.innerHTML = '<p class="text-caption text-body flex items-center gap-xxs">'
          + '<span class="material-symbols-outlined text-[15px] text-warning">wifi_off</span>'
          + 'AI 연결이 어렵습니다(' + esc(err.message) + '). 아래에 직접 입력해 주세요.</p>';
      }
    }

    function renderAiPreview() {
      const pv = document.getElementById('aiPastePreview');
      pv.classList.remove('hidden');
      pv.innerHTML =
        '<div class="rounded-md border border-primary/30 bg-primary/5 p-sm">'
        + '<p class="text-caption-strong text-primary mb-xs flex items-center gap-xxs">'
        + '<span class="material-symbols-outlined text-[15px] ms-fill">auto_awesome</span>'
        + aiParsed.length + '개 일정을 찾았습니다 — 확인 후 등록하세요</p>'
        + '<ul class="space-y-xxs mb-sm">'
        + aiParsed.map((e, i) =>
          '<li><label class="flex items-start gap-xs p-xs rounded-sm bg-canvas border border-hairline cursor-pointer hover:border-primary transition-colors">'
          + '<input type="checkbox" checked data-ai-ev="' + i + '" class="mt-[2px] w-[18px] h-[18px] rounded-xs border-hairline text-primary focus:ring-primary shrink-0">'
          + '<span class="flex-1 min-w-0">'
          + '<span class="block text-body-sm text-ink leading-snug">' + esc(e.title) + '</span>'
          + '<span class="block text-caption text-muted mt-xxs tnum">'
          + e.date.slice(5).replace('-', '/') + (e.dateEnd ? ' ~ ' + e.dateEnd.slice(5).replace('-', '/') : '')
          + ' · ' + (e.allDay ? '종일' : e.timeS + '~' + e.timeE)
          + ' · <span style="color:' + (DEPTS[e.cat] ? DEPTS[e.cat].color : '#003893') + '">' + esc(e.cat) + '</span>'
          + (e.place ? ' · ' + esc(e.place) : '') + '</span>'
          + (e.memo ? '<span class="block text-caption text-muted-soft mt-xxs">' + esc(e.memo) + '</span>' : '')
          + '</span></label></li>').join('')
        + '</ul>'
        + '<div class="flex gap-xxs">'
        + '<button id="btnAiEvApply" class="flex-1 h-10 rounded-pill bg-primary text-on-primary text-caption-strong hover:bg-primary-active transition-colors flex items-center justify-center gap-xxs">'
        + '<span class="material-symbols-outlined text-[16px]">event_available</span>선택한 일정 달력에 등록</button>'
        + '<button id="btnAiEvClear" class="h-10 px-sm rounded-pill bg-surface-strong text-body text-caption-strong hover:bg-hairline transition-colors">지우기</button>'
        + '</div></div>';

      document.getElementById('btnAiEvApply').addEventListener('click', () => {
        const picked = [...pv.querySelectorAll('[data-ai-ev]:checked')].map(c => aiParsed[Number(c.dataset.aiEv)]);
        if (!picked.length) { toast('등록할 일정을 선택해 주세요', 'checklist'); return; }
        picked.forEach(e => EVENTS.push({
          id: 'E' + Math.random().toString(36).slice(2, 9),
          title: e.title, desc: e.memo, allDay: e.allDay,
          date: e.date, dateEnd: e.dateEnd, timeS: e.timeS, timeE: e.timeE,
          cat: e.cat, color: DEPTS[e.cat] ? DEPTS[e.cat].color : EV_COLORS[0], place: e.place
        }));
        saveEvents(); closeEventModal(); render();
        toast(picked.length + '개 일정을 달력에 등록했습니다', 'event_available');
      });
      document.getElementById('btnAiEvClear').addEventListener('click', resetAiPaste);
    }

    function resetAiPaste() {
      aiParsed = [];
      document.getElementById('aiPasteStatus').classList.add('hidden');
      document.getElementById('aiPastePreview').classList.add('hidden');
      document.getElementById('aiPastePreview').innerHTML = '';
    }

    /* 붙여넣기 수신 — 캡처(이미지)가 있으면 이미지 우선, 없으면 텍스트 */
    function handleAiPaste(e) {
      const items = (e.clipboardData || {}).items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          e.preventDefault();
          const file = it.getAsFile();
          const rd = new FileReader();
          rd.onload = () => {
            const b64 = String(rd.result).split(',')[1];
            runAiPaste([
              { text: aiEvPrompt() + '(첨부한 캡처 화면에서 추출)' },
              { inlineData: { mimeType: it.type, data: b64 } }
            ], '캡처 화면');
          };
          rd.readAsDataURL(file);
          return;
        }
      }
      const text = (e.clipboardData || {}).getData ? e.clipboardData.getData('text/plain') : '';
      if (text && text.trim().length >= 5) {
        e.preventDefault();
        runAiPaste([{ text: aiEvPrompt() + text.trim().slice(0, 4000) }], '쪽지 내용');
      }
    }
    const aiZone = document.getElementById('aiPasteZone');
    aiZone.addEventListener('paste', handleAiPaste);
    aiZone.addEventListener('click', () => { aiZone.focus(); });
    aiZone.addEventListener('keydown', e => {   // 안내: 포커스 상태에서 Ctrl+V 만 처리
      if (e.key === 'Enter') toast('쪽지를 복사한 뒤 Ctrl+V 로 붙여넣으세요', 'content_paste');
    });
    /* 모달 어디에 붙여넣어도 입력칸(제목 등)이 아니면 AI 존이 받는다 */
    document.getElementById('eventModal').addEventListener('paste', e => {
      if (e.target.closest('input, textarea')) return;
      handleAiPaste(e);
    });

    /* ═══════════════════════════════════════════════════════════════════════
       ⑤ 설정 드롭다운 · 학교 변경 모달 · 사이드바 접기 · 섹션 아코디언
       ═══════════════════════════════════════════════════════════════════════ */
    const settingsMenu = document.getElementById('settingsMenu');
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', e => {
        e.stopPropagation();
        if(settingsMenu) {
            const open = settingsMenu.classList.toggle('hidden') === false;
            btnSettings.setAttribute('aria-expanded', String(open));
        }
      });
    }
    document.addEventListener('click', e => {
      if (settingsMenu && btnSettings && !settingsMenu.classList.contains('hidden')
        && !settingsMenu.contains(e.target) && !btnSettings.contains(e.target)) {
        settingsMenu.classList.add('hidden');
        btnSettings.setAttribute('aria-expanded', 'false');
      }
    });

    function openSchoolModal() {
      settingsMenu.classList.add('hidden');
      document.getElementById('schoolModal').classList.remove('hidden');
      const inp = document.getElementById('schoolInput');
      inp.value = SCHOOL.name; inp.focus(); inp.select();
    }
    function closeSchoolModal() {
      document.getElementById('schoolModal').classList.add('hidden');
      document.getElementById('schoolResults').classList.add('hidden');
    }
    // document.getElementById('btnSchoolChange').addEventListener('click', openSchoolModal);
    // document.getElementById('btnSchoolChip').addEventListener('click', openSchoolModal);
    // document.getElementById('btnCloseSchool').addEventListener('click', closeSchoolModal);
    // document.getElementById('schoolScrim').addEventListener('click', closeSchoolModal);

    // document.getElementById('btnSidebar').addEventListener('click', () => {
    //   S.sidebar = S.sidebar === 'open' ? 'closed' : 'open';
    //   saveSettings(); applySettings();
    // });

    /* 사이드바 섹션 아코디언 — 각 섹션 제목을 눌러 접었다 펼 수 있고 상태가 저장된다 */
    let sideOpen = {};
    try { sideOpen = JSON.parse(localStorage.getItem('ef_sideopen') || '{}'); } catch (e) { }
    function initSideAccordion() {
      document.querySelectorAll('#sideCol > section').forEach((sec, i) => {
        if (sec.dataset.noAcc) return;
        const head = sec.firstElementChild;
        if (!head || sec.dataset.acc) return;
        sec.dataset.acc = '1';
        sec.classList.add('side-sec');
        const key = 'sec' + i;
        // 헤더 이후의 형제들을 .side-body 로 감싼다
        const body = document.createElement('div');
        body.className = 'side-body';
        while (head.nextSibling) body.appendChild(head.nextSibling);
        sec.appendChild(body);
        // 접기 토글 버튼
        const tg = document.createElement('button');
        tg.className = 'side-toggle w-7 h-7 grid place-items-center rounded-full bg-surface-strong text-body hover:text-primary hover:bg-hairline transition-colors shrink-0 ml-xxs';
        tg.setAttribute('aria-label', '섹션 접기/펴기');
        tg.innerHTML = '<span class="material-symbols-outlined text-[18px]">expand_more</span>';
        head.appendChild(tg);
        const setOpen = (open) => {
          sec.dataset.open = String(open);
          sideOpen[key] = open;
          localStorage.setItem('ef_sideopen', JSON.stringify(sideOpen));
        };
        sec.dataset.open = String(sideOpen[key] !== false);
        tg.addEventListener('click', e => { e.stopPropagation(); setOpen(sec.dataset.open === 'false'); });
      });
    }

    /* ═══════════════════════════════════════════════════════════════════════
       ⑥ 부서·색상 관리 — 부서 추가, 범례 색 변경 (ef_depts 오버레이 저장)
       ═══════════════════════════════════════════════════════════════════════ */
    function rebuildDeptUI() {
      loadDepts();
      DEPT_LIST.forEach(n => activeDepts.add(n));                       // 새 부서는 켠 상태로
      [...activeDepts].forEach(n => { if (!DEPTS[n]) activeDepts.delete(n); });
      const box = document.getElementById('deptFilters');
      delete box.dataset.built;
      renderDeptFilters(); renderLegendDept(); renderDeptEditList();
    }
    function renderDeptEditList() {
      const el = document.getElementById('deptEditList');
      el.innerHTML = DEPT_LIST.map(name =>
        '<li class="flex items-center gap-xs px-xxs py-xxs rounded-sm hover:bg-surface-soft">'
        + '<input type="color" value="' + DEPTS[name].color + '" data-dept="' + esc(name) + '" '
        + 'class="w-8 h-8 rounded-sm border border-hairline bg-canvas cursor-pointer shrink-0" title="' + esc(name) + ' 색 변경">'
        + '<span class="flex-1 text-body-sm text-ink truncate">' + esc(name)
        + (DEPTS[name].custom ? ' <span class="text-caption text-muted">(직접 추가)</span>' : '') + '</span>'
        + (DEPTS[name].custom
          ? '<button data-del="' + esc(name) + '" class="w-7 h-7 grid place-items-center rounded-full text-muted hover:text-danger hover:bg-danger/5 transition-colors" aria-label="' + esc(name) + ' 삭제">'
          + '<span class="material-symbols-outlined text-[16px]">delete</span></button>'
          : '<span class="w-7"></span>')
        + '</li>').join('');
      el.querySelectorAll('input[type="color"]').forEach(inp => inp.addEventListener('change', () => {
        DEPTS[inp.dataset.dept].color = inp.value;
        saveDeptOverrides(); rebuildDeptUI(); render();
      }));
      el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
        delete DEPTS[b.dataset.del];
        saveDeptOverrides(); rebuildDeptUI(); render();
        toast(b.dataset.del + ' 부서를 삭제했습니다', 'delete');
      }));
    }
    function openDeptModal() { renderDeptEditList(); document.getElementById('deptModal').classList.remove('hidden'); }
    function closeDeptModal() {
      document.getElementById('deptModal').classList.add('hidden');
      // 새 일정 모달이 열린 채라면 분류·색상 칩을 최신 부서 목록으로 갱신
      if (!document.getElementById('eventModal').classList.contains('hidden')) {
        if (!DEPTS[evCat] && evCat !== '개인') evCat = '개인';
        renderEvCats(); renderEvColors();
      }
    }
    document.getElementById('btnDeptEdit').addEventListener('click', openDeptModal);
    if(document.getElementById('btnLegendEdit')) document.getElementById('btnLegendEdit').addEventListener('click', openDeptModal);
    document.getElementById('btnCloseDept').addEventListener('click', closeDeptModal);
    document.getElementById('btnDeptDone').addEventListener('click', closeDeptModal);
    document.getElementById('deptScrim').addEventListener('click', closeDeptModal);
    document.getElementById('btnDeptAdd').addEventListener('click', () => {
      const name = document.getElementById('deptNewName').value.trim();
      if (!name) { toast('부서 이름을 입력해 주세요', 'edit'); return; }
      if (DEPTS[name]) { toast('이미 있는 부서입니다', 'error'); return; }
      DEPTS[name] = { color: document.getElementById('deptNewColor').value, icon: 'group', custom: true };
      document.getElementById('deptNewName').value = '';
      saveDeptOverrides(); rebuildDeptUI(); render();
      toast(name + ' 부서를 추가했습니다. 새 일정의 분류로도 쓸 수 있어요', 'add_circle');
    });
    document.getElementById('btnDeptReset').addEventListener('click', () => {
      localStorage.removeItem('ef_depts');
      rebuildDeptUI(); render();
      toast('부서·색상을 기본값으로 되돌렸습니다', 'restart_alt');
    });

    /* 전체 메뉴 패널 토글 */
    const navPanel = document.getElementById('navPanel');
    const btnNavMenu = document.getElementById('btnNavMenu');
    if (btnNavMenu && navPanel) {
      btnNavMenu.addEventListener('click', () => {
        const open = navPanel.classList.toggle('hidden') === false;
        btnNavMenu.setAttribute('aria-expanded', String(open));
        btnNavMenu.querySelector('span').textContent = open ? 'close' : 'menu';
      });
    }
    document.addEventListener('click', e => {
      if (!navPanel) return;
      if (navPanel.classList.contains('hidden')) return;
      if (btnNavMenu && (navPanel.contains(e.target) || btnNavMenu.contains(e.target))) return;
      navPanel.classList.add('hidden');
      if (btnNavMenu) {
        btnNavMenu.setAttribute('aria-expanded', 'false');
        btnNavMenu.querySelector('span').textContent = 'menu';
      }
    });

    /* "+N건 더보기"는 별도 처리 불필요 — data-task 가 아니므로
       셀 클릭 핸들러의 selectDate() 로 자연스럽게 흘러가 날짜 패널이 열린다 */

    /* ───────── 시작 ───────── */
    // 저장된 학교 복원 (한 번 고르면 계속 유지 — 학교 변경은 설정 ▸ 기준 학교)
    document.getElementById('schoolInput').value = SCHOOL.name;
    document.getElementById('schoolMeta').textContent = SCHOOL.office + ' · ' + (SCHOOL.area || '-') + ' · 코드 ' + SCHOOL.code;
    syncSchoolLabels();
    initSideAccordion();
    document.addEventListener('DOMContentLoaded', () => {
        applySettings();
        syncViewTabs();
        render();
    });
  