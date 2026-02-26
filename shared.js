(function () {
    const LANG_SUFFIX = { ES: 'es', EN: 'en', FR: 'fr' };

    function normalizeLanguageCode(value) {
        const upper = (value || '').toUpperCase();
        return LANG_SUFFIX[upper] ? upper : null;
    }

    function languageCodeToHtml(code) {
        return LANG_SUFFIX[code] || 'es';
    }

    function getSwitchIconPath(mode) {
        return mode === 'portfolio'
            ? './data/icons/OJO RA_PORTFOLIO.png'
            : './data/icons/OJO HORUS_PESONAL.png';
    }

    function updateFavicon() {
        let link = document.querySelector("link[rel='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.type = 'image/png';
        link.href = './data/icons/LOGO URL.png';
    }

    window.DSM_SHARED = {
        LANG_SUFFIX,
        normalizeLanguageCode,
        languageCodeToHtml,
        getSwitchIconPath,
        updateFavicon
    };
})();
