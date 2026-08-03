import glob
import re

for filepath in glob.glob('*.html'):
    if filepath == 'index.backup.html': continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to change the <nav> element to have a full-width background,
    # but its inner content should be constrained to max-w-[1600px] mx-auto
    
    nav_pattern = r'<nav class="fixed top-0 w-full z-50 h-\[64px\] flex justify-between items-center px-lg bg-canvas">'
    new_nav_start = '<nav class="fixed top-0 w-full z-50 h-[64px] bg-canvas border-b border-hairline">\n<div class="max-w-[1600px] w-full mx-auto h-full flex justify-between items-center px-lg">'
    
    # Replace the opening tag
    if nav_pattern in content:
        content = content.replace(nav_pattern, new_nav_start)
        # Find the closing </nav> and replace it with </div></nav>
        # But we must be careful to only replace the FIRST </nav> or the matching one.
        # Since there's only one <nav> per file, we can just replace </nav> with </div>\n</nav>
        content = content.replace('</nav>', '</div>\n</nav>', 1)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Aligned header contents with 1600px max-width layout.")
