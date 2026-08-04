(function() {
    const currentPath = decodeURIComponent(window.location.pathname);
    const isLoginPage = currentPath.includes('공통_로그인.html');
    const isSignupPage = currentPath.includes('공통_회원가입.html');
    
    const currentUser = localStorage.getItem('currentUser');
    const currentRole = localStorage.getItem('currentRole');

    // 1. Session check
    if (!currentUser && !isLoginPage && !isSignupPage) {
        window.location.href = '공통_로그인.html';
        return;
    }
    
    if (currentUser && isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Setup RBAC on page load (Wait for DOM)
    document.addEventListener('DOMContentLoaded', () => {
        if (!currentUser) return;

        // Apply RBAC to Header Menus if they exist
        
        // 2-1. Admin menus in Profile Dropdown
        const adminServerMenu = document.querySelector('a[href="서버관리자_대시보드.html"]');
        const adminSchoolMenu = document.querySelector('a[href="학교관리자_대시보드.html"]');
        const adminMenuHeader = Array.from(document.querySelectorAll('.px-base.py-1')).find(el => el.textContent.includes('관리자 메뉴'));
        
        if (adminServerMenu && currentRole !== '서버관리자') {
            adminServerMenu.style.display = 'none';
        }
        if (adminSchoolMenu && currentRole !== '학교관리자') {
            adminSchoolMenu.style.display = 'none';
        }
        
        // Hide "관리자 메뉴" separator if neither is visible
        if (adminMenuHeader && currentRole !== '서버관리자' && currentRole !== '학교관리자') {
            adminMenuHeader.style.display = 'none';
            // Also hide the border line above it if possible
            const borderLine = adminMenuHeader.previousElementSibling;
            if (borderLine && borderLine.classList.contains('border-t')) {
                borderLine.style.display = 'none';
            }
        }

        // 2-2. 1:1 Inquiry Menu (안내센터 하위)
        // We will add a link to "안내센터_1대1문의관리.html" in the html dynamically if they have permission
        // Authorized roles: 서버관리자, 장학사, 인생 도서관 멘토
        const authorizedInquiryRoles = ['서버관리자', '장학사', '인생 도서관 멘토'];
        if (authorizedInquiryRoles.includes(currentRole)) {
            // Find 안내센터 dropdown - look for the menu item containing "안내센터"
            const navLinks = document.querySelectorAll('a.font-nav-link');
            navLinks.forEach(link => {
                if (link.textContent.includes('안내센터') && link.closest('.group\\/col')) {
                    const parentCol = link.closest('.group\\/col');
                    const dropdownMenu = parentCol.querySelector('.absolute');
                    if (dropdownMenu && !dropdownMenu.querySelector('a[href="안내센터_1대1문의관리.html"]')) {
                        const newLink = document.createElement('a');
                        newLink.href = '안내센터_1대1문의관리.html';
                        newLink.className = 'font-nav-link text-[16px] text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-sm py-1 w-full text-center';
                        newLink.innerText = '1:1 문의 답변';
                        dropdownMenu.appendChild(newLink);
                    }
                }
            });
        }
        
        // 2-3. Logout click handler override
        const logoutLinks = document.querySelectorAll('a[href="공통_로그인.html"]');
        logoutLinks.forEach(link => {
            if (link.innerText.includes('로그아웃')) {
                link.addEventListener('click', (e) => {
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('currentRole');
                });
            }
        });
        
    });
})();
