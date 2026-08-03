import glob
import re

html_files = glob.glob('*.html')

for filepath in html_files:
    if filepath in ['index.backup.html']:
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Replace max-w-7xl mx-auto px-lg with w-full px-lg
    content = content.replace('max-w-7xl mx-auto px-lg', 'w-full px-lg')
    content = content.replace('max-w-7xl mx-auto', 'w-full')
    
    # Also check for max-w-6xl, max-w-5xl just in case
    content = content.replace('max-w-6xl mx-auto px-lg', 'w-full px-lg')
    content = content.replace('max-w-6xl mx-auto', 'w-full')
    
    # Section tags sometimes have these
    content = content.replace('max-w-screen-xl mx-auto px-lg', 'w-full px-lg')
    
    # In some pages, main might just have max-w-7xl
    content = re.sub(r'max-w-7xl\s+mx-auto', 'w-full', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Applied full width layout to all pages.")
