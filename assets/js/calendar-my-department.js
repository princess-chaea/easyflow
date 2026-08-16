(function () {
    'use strict';

    const allButton = document.getElementById('btnDeptAll');
    const filters = document.getElementById('deptFilters');
    if (!allButton || !filters) return;

    const currentUserEmail = localStorage.getItem('currentUser') || 'guest';
    const storageKey = 'ef_my_department_' + currentUserEmail;
    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-xs mb-sm';

    const label = document.createElement('label');
    label.className = 'text-caption-strong text-body shrink-0';
    label.setAttribute('for', 'myDepartmentSelect');
    label.textContent = '내 부서';

    const select = document.createElement('select');
    select.id = 'myDepartmentSelect';
    select.className = 'min-w-0 flex-1 h-8 px-xs rounded-md border border-hairline bg-canvas text-caption text-ink focus:border-primary focus:ring-0';

    const onlyButton = document.createElement('button');
    onlyButton.id = 'btnDeptMine';
    onlyButton.type = 'button';
    onlyButton.className = 'h-8 px-sm rounded-pill bg-primary/5 text-primary text-caption-strong hover:bg-primary/10 transition-colors whitespace-nowrap';
    onlyButton.textContent = '내 부서만';

    controls.append(label, select, onlyButton);
    filters.parentElement.insertBefore(controls, filters);

    const help = document.createElement('p');
    help.className = 'text-[11px] text-muted mb-xs leading-relaxed';
    help.textContent = '주관 부서는 업무를 만든 곳입니다. 내 부서를 저장하면 해당 업무만 빠르게 볼 수 있습니다.';
    filters.parentElement.insertBefore(help, filters);

    populateOptions();

    select.addEventListener('change', function () {
        if (select.value) localStorage.setItem(storageKey, select.value);
        else localStorage.removeItem(storageKey);
    });

    onlyButton.addEventListener('click', function () {
        const department = select.value;
        if (!department) {
            if (typeof toast === 'function') toast('먼저 내 부서를 선택해 주세요', 'info');
            select.focus();
            return;
        }
        activeDepts = new Set([department]);
        syncCheckboxes(department);
        if (typeof render === 'function') {
            const renderResult = render();
            if (renderResult && typeof renderResult.then === 'function') {
                renderResult.then(function () { syncCheckboxes(department); });
            }
        }
        if (typeof toast === 'function') toast(department + ' 업무만 표시합니다', 'filter_alt');
    });

    const observer = new MutationObserver(function () {
        populateOptions();
    });
    observer.observe(filters, { childList: true });

    function syncCheckboxes(department) {
        document.querySelectorAll('.dept-cb').forEach(function (checkbox) {
            checkbox.checked = checkbox.value === department;
        });
    }
    function availableDepartments() {
        if (typeof DEPT_LIST !== 'undefined' && Array.isArray(DEPT_LIST)) return DEPT_LIST.slice();
        return Array.from(filters.querySelectorAll('.dept-cb')).map(function (checkbox) { return checkbox.value; });
    }

    function populateOptions() {
        const departments = availableDepartments();
        const previous = select.value || localStorage.getItem(storageKey) || '';
        select.replaceChildren();

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '선택해 주세요';
        select.appendChild(placeholder);

        departments.forEach(function (department) {
            const option = document.createElement('option');
            option.value = department;
            option.textContent = department;
            select.appendChild(option);
        });

        let next = departments.includes(previous) ? previous : '';
        if (!next) {
            const organization = localStorage.getItem('org_' + currentUserEmail) || '';
            if (departments.includes(organization)) next = organization;
        }
        select.value = next;
        if (next) localStorage.setItem(storageKey, next);
        else if (previous) localStorage.removeItem(storageKey);
    }
})();
