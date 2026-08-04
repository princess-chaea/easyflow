const fs = require('fs');
const path = require('path');

const dirPath = './';
const htmlFiles = fs.readdirSync(dirPath).filter(file => file.endsWith('.html'));

const patterns = [
    { name: "Dead Link (href='#')", regex: /href\s*=\s*['"]#['"]/gi },
    { name: "Empty JS Link (javascript:void(0))", regex: /href\s*=\s*['"]javascript:void\(0\)['"]/gi },
    { name: "Alert Action (onclick='alert(...)')", regex: /onclick\s*=\s*['"]alert\([^'"]+\)['"]/gi },
    { name: "Hardcoded Table Row (<td>...</td> without template)", regex: /<tr>[\s\S]*?<td>.*?<\/td>[\s\S]*?<\/tr>/gi }, // Rough proxy for hardcoded tables
];

let report = `# HTML 인벤토리 조사 보고서 (더미 데이터 및 미동작 버튼)\n\n`;
let totalIssues = 0;

htmlFiles.forEach(file => {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let fileReport = `## ${file}\n`;
    let foundIssueInFile = false;

    // Scan for dead links / alerts
    lines.forEach((line, index) => {
        if (line.includes('href="#"') || line.includes("href='#" + "'")) {
            fileReport += `- [Line ${index + 1}] Dead Link: \`${line.trim()}\`\n`;
            foundIssueInFile = true;
            totalIssues++;
        }
        if (line.includes('javascript:void(0)')) {
            fileReport += `- [Line ${index + 1}] Void Link: \`${line.trim()}\`\n`;
            foundIssueInFile = true;
            totalIssues++;
        }
        if (line.includes('alert(')) {
            fileReport += `- [Line ${index + 1}] Alert Action: \`${line.trim()}\`\n`;
            foundIssueInFile = true;
            totalIssues++;
        }
        if (line.includes('TODO:') || line.includes('TODO ')) {
            fileReport += `- [Line ${index + 1}] TODO Comment: \`${line.trim()}\`\n`;
            foundIssueInFile = true;
            totalIssues++;
        }
    });

    if (foundIssueInFile) {
        report += fileReport + '\n';
    }
});

report = `총 ${totalIssues}개의 잠재적 개선점 발견 (총 ${htmlFiles.length}개 파일 검사)\n\n` + report;

fs.writeFileSync('C:/Users/user/.gemini/antigravity-ide/brain/5486fc7c-c2d1-4295-a18c-b48231939134/inventory_report.md', report);
console.log('Inventory scan completed. Found', totalIssues, 'issues.');
