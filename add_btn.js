const fs = require('fs');

const calFile = '업무배송_스마트공문달력.html';
let content = fs.readFileSync(calFile, 'utf8');

const regex = /<span class="hidden md:inline">구글 캘린더<\/span>\s*<\/button>/;

const outlookBtnHtml = `
<button class="h-9 px-sm rounded-pill bg-surface-strong text-body text-caption-strong hover:bg-hairline hover:text-ink transition-colors shrink-0 flex items-center gap-xxs ml-2" id="btnOutlook" onclick="document.getElementById('outlookModal').showModal()" title="이 달력의 업무 마감일을 개인 아웃룩 캘린더로 동기화">
<img alt="Microsoft Logo" class="w-[16px] h-[16px] shrink-0" src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"/>
<span class="hidden md:inline">Outlook 연동</span>
</button>`;

if (!content.includes('btnOutlook')) {
    content = content.replace(regex, match => match + outlookBtnHtml);
    fs.writeFileSync(calFile, content, 'utf8');
    console.log('Outlook button added.');
} else {
    console.log('Outlook button already exists.');
}
