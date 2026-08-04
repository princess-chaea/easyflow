const fs = require('fs');

const file = '서버관리자_회원관리.html';
let content = fs.readFileSync(file, 'utf8');

// Replace from <!-- Role Management Modal --> to the end of the file
content = content.replace(/<!-- Role Management Modal -->[\s\S]*?<\/script>/, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Removed modal correctly');
