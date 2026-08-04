const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.startsWith('서버관리자_') && f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove the badly formatted previously injected link
    content = content.replace(/<a href="서버관리자_역할관리\.html"[\s\S]*?<\/a>/g, '');

    // Now insert it properly as a new <li> item
    const searchPattern = /<li>\s*<a[^>]*href="서버관리자_회원관리\.html"[^>]*>회원 관리<\/a>\s*<\/li>/;
    
    // Determine if this is the active page
    const isActive = file === '서버관리자_역할관리.html';
    const linkClass = isActive 
        ? 'font-nav-link block px-sm py-sm rounded-lg transition-colors text-[16px] bg-primary text-white font-bold'
        : 'font-nav-link block px-sm py-sm rounded-lg transition-colors text-[16px] text-on-surface-variant hover:bg-surface hover:text-ink';
        
    const newItem = `
<li>
<a class="${linkClass}" href="서버관리자_역할관리.html">역할 관리</a>
</li>`;
    
    if (content.match(searchPattern)) {
        content = content.replace(searchPattern, match => match + newItem);
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log('Fixed sidebars with proper li tags');
