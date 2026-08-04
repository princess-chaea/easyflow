const fs = require('fs');

const file = '업무배송_스마트공문달력.html';
if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Add Outlook button in the toolbar
    const gcalBtnHtml = `<button class="h-9 px-sm rounded-pill bg-surface-strong text-body text-caption-strong hover:bg-hairline hover:text-ink transition-colors shrink-0 flex items-center gap-xxs" id="btnGcal" onclick="document.getElementById('gcalModal').showModal()" title="이 달력의 업무 마감일을 개인 구글 캘린더로 동기화">
<img alt="Google Logo" class="w-[16px] h-[16px] shrink-0" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"/>
<span class="hidden md:inline">구글 캘린더</span>
</button>`;

    const outlookBtnHtml = `<button class="h-9 px-sm rounded-pill bg-surface-strong text-body text-caption-strong hover:bg-hairline hover:text-ink transition-colors shrink-0 flex items-center gap-xxs ml-2" id="btnOutlook" onclick="document.getElementById('outlookModal').showModal()" title="이 달력의 업무 마감일을 개인 아웃룩 캘린더로 동기화">
<img alt="Microsoft Logo" class="w-[16px] h-[16px] shrink-0" src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"/>
<span class="hidden md:inline">Outlook 연동</span>
</button>`;

    if (!content.includes('btnOutlook')) {
        content = content.replace(gcalBtnHtml, gcalBtnHtml + '\n' + outlookBtnHtml);
    }

    // 2. Add Outlook Modal and JS Logic
    if (!content.includes('outlookModal')) {
        const modalRegex = /(<dialog class="bg-surface[^>]*id="gcalModal">[\s\S]*?<\/dialog>)/;
        const match = content.match(modalRegex);
        if (match) {
            let outlookModal = match[1];
            // Modify IDs and text for Outlook
            outlookModal = outlookModal
                .replace('id="gcalModal"', 'id="outlookModal"')
                .replace(/gcalShowState/g, 'outlookShowState')
                .replace(/openPermissionModal/g, 'openOutlookPermissionModal')
                .replace(/changeAccount/g, 'changeOutlookAccount')
                .replace(/disconnect/g, 'disconnectOutlook')
                .replace(/toggleSync/g, 'toggleOutlookSync')
                .replace(/syncNow/g, 'syncOutlookNow')
                .replace(/syncNowBtn/g, 'syncOutlookNowBtn')
                .replace(/connectedAccount/g, 'outlookConnectedAccount')
                .replace(/lastSyncText/g, 'outlookLastSyncText')
                .replace(/stateDisconnected/g, 'outlookStateDisconnected')
                .replace(/stateConnected/g, 'outlookStateConnected')
                .replace(/stateError/g, 'outlookStateError')
                .replace(/구글 캘린더 연동 설정/g, 'Outlook 연동 설정')
                .replace(/구글 계정/g, 'Microsoft 계정')
                .replace(/구글 캘린더/g, 'Outlook 캘린더')
                .replace(/Google 캘린더/g, 'Outlook 캘린더')
                .replace(/Google 계정/g, 'Microsoft 계정')
                .replace(/https:\/\/www.gstatic.com\/firebasejs\/ui\/2.0.0\/images\/auth\/google.svg/g, 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg')
                .replace(/@gedu.kr/g, '@outlook.kr');
            
            content = content.replace(match[1], match[1] + '\n' + outlookModal);
        }

        // Add the JS logic for Outlook
        const jsRegex = /(function gcalShowState[\s\S]*?toast\('연동 설정을 저장했습니다', 'check_circle'\);\s*})/m;
        const jsMatch = content.match(jsRegex);
        if (jsMatch) {
            let outlookJs = jsMatch[1]
                .replace(/gcalShowState/g, 'outlookShowState')
                .replace(/openPermissionModal/g, 'openOutlookPermissionModal')
                .replace(/changeAccount/g, 'changeOutlookAccount')
                .replace(/disconnect/g, 'disconnectOutlook')
                .replace(/toggleSync/g, 'toggleOutlookSync')
                .replace(/syncNow/g, 'syncOutlookNow')
                .replace(/syncNowBtn/g, 'syncOutlookNowBtn')
                .replace(/connectedAccount/g, 'outlookConnectedAccount')
                .replace(/lastSyncText/g, 'outlookLastSyncText')
                .replace(/stateDisconnected/g, 'outlookStateDisconnected')
                .replace(/stateConnected/g, 'outlookStateConnected')
                .replace(/stateError/g, 'outlookStateError')
                .replace(/gcalModal/g, 'outlookModal')
                .replace(/btnGcal/g, 'btnOutlook')
                .replace(/구글 캘린더/g, 'Outlook 캘린더')
                .replace(/구글 계정/g, 'Microsoft 계정')
                .replace(/Google 캘린더/g, 'Outlook 캘린더')
                .replace(/@gedu.kr/g, '@outlook.kr');
            
            // Fix textContent changes in JS for Outlook
            outlookJs = outlookJs.replace(/textContent = 'Outlook 캘린더'/g, "textContent = 'Outlook 연동'");

            content = content.replace(jsMatch[1], jsMatch[1] + '\n\n    /* ── Outlook 연동 모달 스크립트 ── */\n' + outlookJs);
        }
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Outlook button and modal added.');
}
