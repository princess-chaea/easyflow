const fs = require('fs');
const cp = require('child_process');

for (let i = 0; i < 5; i++) {
    try {
        const out = cp.execSync(`node -c temp_script_${i}.js`, { encoding: 'utf8', stdio: 'pipe' });
        console.log(`Script ${i} OK`);
    } catch (e) {
        console.log(`Script ${i} Error:`, e.message);
        console.log(`Stderr:`, e.stderr);
    }
}
