const fs = require('fs');

const file = '서버관리자_회원관리.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the header
content = content.replace(/<th class="px-lg py-base font-caption-strong text-caption-strong text-on-surface-variant uppercase tracking-wider text-right">\s*관리<\/th>/, '');

// 2. Remove all <td> containing the "권한 설정" button (there are 4 rows currently)
const tdRegex = /<td class="px-lg py-base text-right">\s*<button class="text-primary hover:underline font-button text-body-sm" onclick="openModal[^>]+>권한 설정<\/button>\s*<\/td>/g;

content = content.replace(tdRegex, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Removed management column correctly');
