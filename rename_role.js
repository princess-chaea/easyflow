const fs = require('fs');

const files = ['서버관리자_회원관리.html', '서버관리자_역할관리.html', 'assets/js/profile-modal.js', 'rebuild_role.js', 'update_filters.js', 'update_dummy_roles.js'];

files.forEach(file => {
    if(fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        // 1. Replace <option>교사</option>
        content = content.replace(/<option>교사<\/option>/g, '<option>교직원</option>');
        content = content.replace(/<option value="교사">교사<\/option>/g, '<option value="교직원">교직원</option>');
        
        // 2. Replace table data badages
        content = content.replace(/>교사<\/span>/g, '>교직원</span>');
        
        // 3. Replace JS default assignments
        content = content.replace(/let r = '교사';/g, "let r = '교직원';");
        
        // 4. In case of comments
        content = content.replace(/\(교사\)/g, '(교직원)');
        
        // Write back
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log('Renamed 교사 to 교직원 in roles');
