const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('프로필 설정')) {
                content = content.replace(/프로필 설정/g, '프로필 설정');
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Replaced in ' + fullPath);
            }
        }
    }
}

replaceInDir('./');
console.log('Done');
