const fs = require('fs');

const calFile = '업무배송_스마트공문달력.html';
let content = fs.readFileSync(calFile, 'utf8');

// Fix JS function duplications
content = content.replace(/function devShowState\(id\) { outlookShowState\(id\); }/g, 'function devOutlookShowState(id) { outlookShowState(id); }');
content = content.replace(/function showToast\(\) \{\s+toast\('연동 설정을 저장했습니다', 'check_circle'\);\s+\}\s+<\/*/g, function(match) {
    // This regex might be tricky, let's just do a specific replace for the second occurrence of showToast.
    return match;
});

// A safer way is to find the Outlook JS block and replace inside it.
const outlookBlockStart = '/* ── Outlook 연동 모달 스크립트 ── */';
if (content.includes(outlookBlockStart)) {
    const parts = content.split(outlookBlockStart);
    let outlookJs = parts[1];
    
    outlookJs = outlookJs.replace(/function devShowState\(id\)/g, 'function devOutlookShowState(id)');
    // replace showToast() { toast('연동 설정을 저장했습니다', 'check_circle'); }
    outlookJs = outlookJs.replace(/function showToast\(\)/g, 'function showOutlookToast()');

    content = parts[0] + outlookBlockStart + outlookJs;
}

// Fix HTML onclick handlers inside outlookModal
const outlookModalStart = '<dialog class="bg-surface rounded-2xl shadow-2xl p-0 w-[90vw] max-w-3xl backdrop:bg-ink/50 open:animate-in open:fade-in open:zoom-in duration-300" id="outlookModal">';
if (content.includes(outlookModalStart)) {
    const parts2 = content.split(outlookModalStart);
    let outlookModalHtml = parts2[1];

    outlookModalHtml = outlookModalHtml.replace(/onclick="devShowState\(/g, 'onclick="devOutlookShowState(');
    outlookModalHtml = outlookModalHtml.replace(/onclick="showToast\(\)"/g, 'onclick="showOutlookToast()"');

    content = parts2[0] + outlookModalStart + outlookModalHtml;
}

fs.writeFileSync(calFile, content, 'utf8');
console.log('Fixed JS and HTML duplicates.');
