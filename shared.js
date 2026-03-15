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

    let _navigating = false;
    function navigateTo(url, duration) {
        if (_navigating) return;
        _navigating = true;
        const ms = duration ?? 300;
        document.body.classList.add('page-exit');
        setTimeout(() => { window.location.href = url; }, ms);
        // Safety reset: si la navegación falla, desbloquear tras 2s
        setTimeout(() => { _navigating = false; }, 2000);
    }
    window.addEventListener('popstate', () => { _navigating = false; });

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

    // ===== GESTION CENTRALIZADA DE IDIOMA =====
    const LANGUAGES = ['ES', 'EN', 'FR'];
    let _langIndex = 0;

    function initLang() {
        const params = new URLSearchParams(window.location.search);
        const code = normalizeLanguageCode(params.get('lang'))
            || normalizeLanguageCode(localStorage.getItem('dsm_lang'))
            || 'ES';
        _langIndex = LANGUAGES.indexOf(code);
        if (_langIndex < 0) _langIndex = 0;
        syncLang();
    }

    function langCode() {
        return LANGUAGES[_langIndex];
    }

    function lang() {
        return LANG_SUFFIX[langCode()] || 'es';
    }

    function cycleLang() {
        _langIndex = (_langIndex + 1) % LANGUAGES.length;
        syncLang();
    }

    function syncLang() {
        const code = langCode();
        localStorage.setItem('dsm_lang', code);
        document.documentElement.lang = lang();
        const params = new URLSearchParams(window.location.search);
        params.set('lang', code);
        const query = params.toString();
        history.replaceState(null, '', `${window.location.pathname}?${query}`);
    }

    // ===== TIPOGRAFÍA DINÁMICA =====
    function applyFonts(fontsConfig) {
        if (!fontsConfig) return;
        const style = document.createElement('style');
        let css = '';
        const fontPath = './data/fonts/';

        if (fontsConfig.title && fontsConfig.title.file) {
            const ext = fontsConfig.title.file.split('.').pop().toLowerCase();
            const fmt = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : ext === 'otf' ? 'opentype' : 'truetype';
            css += `@font-face { font-family: '${fontsConfig.title.family}'; src: url('${fontPath}${fontsConfig.title.file}') format('${fmt}'); font-weight: normal; font-style: normal; font-display: swap; }\n`;
            document.documentElement.style.setProperty('--font-title', `'${fontsConfig.title.family}', serif`);
        }

        if (fontsConfig.body && fontsConfig.body.file) {
            const ext = fontsConfig.body.file.split('.').pop().toLowerCase();
            const fmt = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : ext === 'otf' ? 'opentype' : 'truetype';
            css += `@font-face { font-family: '${fontsConfig.body.family}'; src: url('${fontPath}${fontsConfig.body.file}') format('${fmt}'); font-weight: normal; font-style: normal; font-display: swap; }\n`;
            document.documentElement.style.setProperty('--font-body', `'${fontsConfig.body.family}', sans-serif`);
        }

        if (css) {
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    window.DSM_SHARED = {
        LANG_SUFFIX,
        VALID_MODES,
        SITE_TITLE,
        LANGUAGES,
        normalizeLanguageCode,
        languageCodeToHtml,
        normalizeMode,
        setMetaContent,
        setCanonicalHref,
        updateModeInURL,
        navigateTo,
        updateFavicon,
        initLang,
        langCode,
        lang,
        cycleLang,
        syncLang,
        applyFonts
    };
})();
