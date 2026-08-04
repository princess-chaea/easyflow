const fs = require('fs');

const file = '업무배송_스마트공문달력.html';
const content = fs.readFileSync(file, 'utf8');

const regex = /<script>([\s\S]*?)<\/script>/g;
let match;
let i = 0;
while ((match = regex.exec(content)) !== null) {
    fs.writeFileSync(`temp_script_${i}.js`, match[1], 'utf8');
    console.log(`Extracted script ${i}`);
    i++;
}
