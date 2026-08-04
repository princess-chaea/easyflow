const fs = require('fs');
const path = require('path');

// 1. Remove FAB from 서버관리자_*.html
const dir = './';
const files = fs.readdirSync(dir);
const serverFiles = files.filter(f => f.startsWith('서버관리자_') && f.endsWith('.html'));

const fabRegex = /<!-- FAB for Global Support -->\s*<button class="fixed bottom-lg right-lg w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50">\s*<span class="material-symbols-outlined">support_agent<\/span>\s*<\/button>/;

for (const file of serverFiles) {
    let content = fs.readFileSync(file, 'utf8');
    if (fabRegex.test(content)) {
        content = content.replace(fabRegex, '');
        fs.writeFileSync(file, content, 'utf8');
        console.log('Removed FAB from ' + file);
    }
}

// 2. Update btnGcal logic in 업무배송_스마트공문달력.html
const calFile = '업무배송_스마트공문달력.html';
if (fs.existsSync(calFile)) {
    let content = fs.readFileSync(calFile, 'utf8');
    
    // openPermissionModal changes
    const openPermSearch = `        gcalShowState('stateConnected');
        toast(mode === 'reauth' ? '재인증이 완료되어 동기화를 다시 시작합니다' : '구글 계정 연동이 완료되었습니다', 'check_circle');`;
    const openPermReplace = `        gcalShowState('stateConnected');
        toast(mode === 'reauth' ? '재인증이 완료되어 동기화를 다시 시작합니다' : '구글 계정 연동이 완료되었습니다', 'check_circle');
        
        // Update btnGcal to connected state
        const btnGcal = document.getElementById('btnGcal');
        if (btnGcal) {
            btnGcal.querySelector('.hidden.md\\\\:inline').textContent = '연동됨';
            btnGcal.classList.add('bg-primary/10', 'text-primary');
            btnGcal.classList.remove('bg-surface-strong', 'text-body', 'hover:bg-hairline', 'hover:text-ink');
            btnGcal.querySelector('.material-symbols-outlined').textContent = 'event_available';
        }`;
    
    // disconnect / changeAccount changes
    const discSearch = `        gcalShowState('stateDisconnected');
        toast('구글 캘린더 연동을 해제했습니다', 'link_off');`;
    const discReplace = `        gcalShowState('stateDisconnected');
        toast('구글 캘린더 연동을 해제했습니다', 'link_off');
        
        // Update btnGcal to disconnected state
        const btnGcal = document.getElementById('btnGcal');
        if (btnGcal) {
            btnGcal.querySelector('.hidden.md\\\\:inline').textContent = '구글 캘린더';
            btnGcal.classList.remove('bg-primary/10', 'text-primary');
            btnGcal.classList.add('bg-surface-strong', 'text-body', 'hover:bg-hairline', 'hover:text-ink');
            btnGcal.querySelector('.material-symbols-outlined').textContent = 'calendar_month';
        }`;
        
    const discSearch2 = `        gcalShowState('stateDisconnected');
        toast('계정 연결을 해제했습니다. 새 계정으로 연동해 주세요', 'swap_horiz');`;
    const discReplace2 = `        gcalShowState('stateDisconnected');
        toast('계정 연결을 해제했습니다. 새 계정으로 연동해 주세요', 'swap_horiz');
        
        // Update btnGcal to disconnected state
        const btnGcal = document.getElementById('btnGcal');
        if (btnGcal) {
            btnGcal.querySelector('.hidden.md\\\\:inline').textContent = '구글 캘린더';
            btnGcal.classList.remove('bg-primary/10', 'text-primary');
            btnGcal.classList.add('bg-surface-strong', 'text-body', 'hover:bg-hairline', 'hover:text-ink');
            btnGcal.querySelector('.material-symbols-outlined').textContent = 'calendar_month';
        }`;

    // Fix the btnGcal span class in HTML to be specifically queried
    const btnHtmlSearch = `<span class="hidden md:inline">구글 캘린더</span>`;
    const btnHtmlReplace = `<span class="hidden md:inline">구글 캘린더</span>`; // I will rely on querySelector('.hidden.md\\:inline') which matches the original html.

    content = content.replace(openPermSearch, openPermReplace);
    content = content.replace(discSearch, discReplace);
    content = content.replace(discSearch2, discReplace2);

    fs.writeFileSync(calFile, content, 'utf8');
    console.log('Updated btnGcal logic');
}
