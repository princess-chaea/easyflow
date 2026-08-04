const fs = require('fs');

const files = ['서버관리자_회원관리.html', '서버관리자_역할관리.html'];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Update filter options
    const oldOptions = `<option>전체 역할</option>
<option>총괄 관리자</option>
<option>학교 관리자</option>
<option>교직원</option>`;
    
    const newOptions = `<option>전체 역할</option>
<option>서버 관리자</option>
<option>학교 관리자</option>
<option>장학사</option>
<option>멘토</option>
<option>교직원</option>`;

    content = content.replace(oldOptions, newOptions);

    // If there is any remaining "총괄 관리자" string, we replace it with "서버 관리자"
    content = content.replace(/총괄 관리자/g, '서버 관리자');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Updated filters and renamed roles');
