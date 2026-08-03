import os
import glob
import re

html_files = glob.glob('*.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix 1: Header margin
    # Find <div class="flex items-center gap-xl"> and replace it with a larger gap
    # But only the first occurrence or specific one that holds the logo and nav
    # Actually, we can just replace `<div class="flex items-center gap-xl">\n<span class="font-display-sm"`
    # Or just replace the exact match because it's only used for the header logo wrapper.
    if '<div class="flex items-center gap-xl">' in content:
        content = content.replace('<div class="flex items-center gap-xl">', '<div class="flex items-center gap-[60px]">')
    
    # Fix 2: Calendar init in 업무배송_스마트공문달력.html
    if filepath == '업무배송_스마트공문달력.html':
        # Change `let userChoseView = false;` to `true` so resize doesn't override it to list
        content = content.replace('let userChoseView = false;', 'let userChoseView = true;')
        
        # Also ensure view is month
        content = content.replace("let view = isNarrow() ? 'list' : 'month';", "let view = 'month';")
        
        # Let's also wrap the init calls in DOMContentLoaded to be super safe
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
            
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Applied fixes to HTML files.")
