import glob
import re

for filepath in glob.glob('*.html'):
    if filepath == 'index.backup.html': continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Fix max-w-[1600px]
    if 'max-w-[1600px] mx-auto' in content:
        content = content.replace('max-w-[1600px] mx-auto', 'w-full')
    
    # 2. Fix the JS error in 업무배송_스마트공문달력.html
    if filepath == '업무배송_스마트공문달력.html':
        # Replace the problematic line with a null check
        bad_line = "document.getElementById('btnLegendEdit').addEventListener('click', openDeptModal);"
        good_line = "if(document.getElementById('btnLegendEdit')) document.getElementById('btnLegendEdit').addEventListener('click', openDeptModal);"
        content = content.replace(bad_line, good_line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Fixed max-w-[1600px] and JS error.")
