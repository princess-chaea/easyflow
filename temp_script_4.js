
    (function () {
        function efLoadFooter() {
            ['org', 'address', 'copyright'].forEach(function (f) {
                var v = localStorage.getItem('ef_footer_' + f);
                if (!v) return;
                var view = document.querySelector('[data-ef="footer.' + f + '"]');
                if (view) view.textContent = v;
            });
        }
        efLoadFooter();
    })();
