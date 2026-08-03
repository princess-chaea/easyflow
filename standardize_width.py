import glob
import re

for filepath in glob.glob('*.html'):
    if filepath == 'index.backup.html': continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Apply max-w-[1600px] mx-auto uniformly across the board to match the desired standard width.
    # The Gyeongsangbuk-do site uses around 1400px. 1600px is a good max width for our dashboard.
    # We replace max-w-[1920px] and max-w-7xl with max-w-[1600px] for consistent centered layout.
    content = content.replace('max-w-[1920px] mx-auto', 'max-w-[1600px] mx-auto')
    content = content.replace('max-w-7xl mx-auto', 'max-w-[1600px] mx-auto')
    content = content.replace('max-w-6xl mx-auto', 'max-w-[1600px] mx-auto')
    
    # 2. Fix the JS bugs in 업무배송_스마트공문달력.html that were lost in the revert
    if filepath == '업무배송_스마트공문달력.html':
        # (a) Fix the initial calendar rendering issue
        content = content.replace("let view = isNarrow() ? 'list' : 'month';", "let view = 'month';")
        content = content.replace('let userChoseView = false;', 'let userChoseView = true;')
        
        init_calls = """    applySettings();
    syncViewTabs();
    render();"""
        if init_calls in content:
            safe_init = """    document.addEventListener('DOMContentLoaded', () => {
        applySettings();
        syncViewTabs();
        render();
    });"""
            content = content.replace(init_calls, safe_init)
            
        # (b) Fix the btnLegendEdit null error
        bad_line = "document.getElementById('btnLegendEdit').addEventListener('click', openDeptModal);"
        good_line = "if(document.getElementById('btnLegendEdit')) document.getElementById('btnLegendEdit').addEventListener('click', openDeptModal);"
        content = content.replace(bad_line, good_line)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Applied standard 1600px max-width layout and fixed JS bugs.")
