(function () {
    const LANG_SUFFIX = { ES: 'es', EN: 'en', FR: 'fr' };
    const VALID_MODES = new Set(['portfolio', 'personal']);
    const SITE_TITLE = 'diego san marcos';

    function normalizeLanguageCode(value) {
        const upper = (value || '').toUpperCase();
        return LANG_SUFFIX[upper] ? upper : null;
    }

    function languageCodeToHtml(code) {
        return LANG_SUFFIX[code] || 'es';
    }

    function normalizeMode(value) {
        return VALID_MODES.has(value) ? value : null;
    }

    function setMetaContent(selector, value) {
        if (!value) return;
        const el = document.querySelector(selector);
        if (el) el.setAttribute('content', value);
    }

    function setCanonicalHref(url) {
        if (!url) return;
        const el = document.getElementById('canonical-url');
        if (el) el.setAttribute('href', url);
    }

    function updateModeInURL(mode) {
        if (!VALID_MODES.has(mode)) return;
        const params = new URLSearchParams(window.location.search);
        params.set('modo', mode);
        const query = params.toString();
        const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        history.replaceState(null, '', newUrl);
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
        VALID_MODES,
        SITE_TITLE,
        normalizeLanguageCode,
        languageCodeToHtml,
        normalizeMode,
        setMetaContent,
        setCanonicalHref,
        updateModeInURL,
        updateFavicon
    };
})();
