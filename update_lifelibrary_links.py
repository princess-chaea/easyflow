import glob
import re

for filepath in glob.glob('*.html'):
    if filepath == 'index.backup.html': continue
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Update the main menu link
        content = re.sub(
            r'<a[^>]*href="[^"]*"[^>]*>\s*인생 도서관 <span',
            r'<a class="font-nav-link text-nav-link transition-colors h-[64px] flex items-center gap-xxs whitespace-nowrap group-hover/col:text-primary group-hover/col:font-bold text-on-surface-variant hover:text-primary" href="인생도서관_통합 지능형 업무지원 메인.html">\n                인생 도서관 <span',
            content
        )
        # However, if it has border-b-2 (meaning it's the active tab), we should keep it.
        # It's safer to just replace href="AI업무어시스턴트_챗봇.html" -> href="인생도서관_통합 지능형 업무지원 메인.html" inside that specific <a> tag, but let's just do a string replace for the whole dropdown.

        # Let's rebuild the nav dropdown for 인생 도서관
        new_dropdown = """<a class="font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center" href="인생도서관_통합 지능형 업무지원 메인.html">인생 도서관 홈</a><a class="font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center" href="AI업무어시스턴트_챗봇.html">AI 상담 (챗봇)</a><a class="font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center" href="인생도서관_장학사 및 업무담당자 통합 대시보드.html">통합 대시보드</a><a class="font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center" href="인생도서관_상담결과리포트.html">상담 결과 리포트</a><a class="font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center" href="인생도서관_인사관리업무상세가이드.html">인사관리 가이드</a><a class="font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center" href="인생도서관_마이페이지.html">나의 멘토링</a>"""
        
        # Regex to find the div that contains the links for 인생도서관.
        # We can find the <a>인생 도서관</a>, then the next <div class="absolute..."> and replace its inner content.
        pattern = r'(인생 도서관\s*<span[^>]*>expand_more</span>\s*</a>\s*<div[^>]*>).*?(</div>)'
        content = re.sub(pattern, r'\g<1>' + new_dropdown + r'\2', content, flags=re.DOTALL)
        
        # We also need to change h-[180px] to h-[260px] in the nav to accommodate 6 items
        nav_match = re.search(r'<nav.*?</nav>', content, flags=re.DOTALL)
        if nav_match:
            nav_content = nav_match.group(0)
            new_nav_content = nav_content.replace('h-[180px]', 'h-[260px]')
            content = content.replace(nav_content, new_nav_content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

print("Updated Life Library dropdowns across all HTML files.")
