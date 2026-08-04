const fs = require('fs');

const file = 'assets/js/profile-modal.js';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `const availableRoles = allRoles.filter(r => !grantedRoles.includes(r));`;
const newLogic = `const normalizeRole = r => r.replace(/\\s+/g, '');
    const normalizedGranted = grantedRoles.map(normalizeRole);
    const availableRoles = allRoles.filter(r => !normalizedGranted.includes(normalizeRole(r)));`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed spinner filter logic');
