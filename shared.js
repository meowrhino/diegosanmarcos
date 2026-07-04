(function () {
    const LANG_SUFFIX = { ES: 'es', EN: 'en', FR: 'fr' };
    const VALID_MODES = new Set(['portfolio', 'personal']);
    const SITE_TITLE = 'diego san marcos';

    // Raiz del sitio resuelta UNA VEZ al arrancar (respeta <base href="../../">
    // de las paginas generadas y subpaths de GH Pages de proyecto). No usar
    // document.baseURI/rutas relativas despues de un pushState: al no haber
    // <base> en index.html/proyecto.html, cambian con la URL empujada.
    const SITE_ROOT = new URL('.', document.baseURI).href;
    const SITE_ROOT_PATH = new URL(SITE_ROOT).pathname;

    // Resuelve una ruta de asset/fetch ("./data/x" o "data/x") contra la raiz
    // del sitio, sin depender de la URL actual del documento.
    function assetUrl(path) {
        const clean = String(path || '').replace(/^\.?\//, '');
        return new URL(clean, SITE_ROOT).href;
    }

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
        // portfolio es el default: la URL limpia ya lo implica
        if (mode === 'portfolio') {
            params.delete('modo');
            params.delete('mode');
        } else {
            params.set('modo', mode);
        }
        const query = params.toString();
        const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        history.replaceState(null, '', newUrl);
    }

    // ===== NAVEGACION SPA =====
    // La app registra aqui su router (una funcion que relee window.location y
    // pinta la vista correspondiente) para que navigateTo() nunca recargue el
    // documento — el <audio>/AudioContext/canvas de DSM_Player sobreviven.
    let _routeRenderer = null;
    function setRouteRenderer(fn) { _routeRenderer = fn; }

    let _navigating = false;
    function navigateTo(targetUrl, duration) {
        if (_navigating) return;
        if (!_routeRenderer) {
            // Red de seguridad si el router aun no se registro
            window.location.href = targetUrl;
            return;
        }
        _navigating = true;
        const ms = duration ?? 300;
        document.body.classList.add('page-exit');
        setTimeout(() => {
            // targetUrl siempre debe llegar absoluta (construida con
            // DSM_SHARED.assetUrl) para no depender de la base URL actual.
            history.pushState({}, '', targetUrl);
            Promise.resolve(_routeRenderer()).finally(() => {
                document.body.classList.remove('page-exit');
                _navigating = false;
                window.scrollTo(0, 0);
            });
        }, ms);
        // Safety reset: si algo falla, desbloquear tras 2s
        setTimeout(() => { _navigating = false; }, 2000);
    }

    window.addEventListener('popstate', () => {
        _navigating = false;
        if (_routeRenderer) _routeRenderer();
    });

    // Red de seguridad para bfcache: si el usuario navega a un sitio externo y
    // vuelve con "atras", el navegador puede restaurar esta pagina congelada
    // con page-exit puesto (pantalla negra) o con el iris de modo a mitad.
    // La navegacion interna ya no depende de esto (nunca recarga el documento).
    window.addEventListener('pageshow', () => {
        _navigating = false;
        document.body.classList.remove('page-exit');
        const iris = document.getElementById('mode-iris-overlay');
        if (iris) iris.style.background = 'none';
    });

    function updateFavicon() {
        let link = document.querySelector("link[rel='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.type = 'image/png';
        link.href = assetUrl('data/icons/LOGO URL.png');
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
        // El idioma vive en localStorage, no en la URL. Si llega por un enlace
        // compartido (?lang=...) se lee en initLang y aqui se limpia de la URL.
        const params = new URLSearchParams(window.location.search);
        if (params.has('lang')) {
            params.delete('lang');
            const query = params.toString();
            const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
            history.replaceState(null, '', newUrl);
        }
    }

    // ===== TIPOGRAFÍA DINÁMICA =====
    function applyFonts(fontsConfig) {
        if (!fontsConfig) return;
        const style = document.createElement('style');
        let css = '';
        const fontPath = assetUrl('data/fonts/');

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
        SITE_ROOT,
        SITE_ROOT_PATH,
        assetUrl,
        normalizeLanguageCode,
        languageCodeToHtml,
        normalizeMode,
        setMetaContent,
        setCanonicalHref,
        updateModeInURL,
        navigateTo,
        setRouteRenderer,
        updateFavicon,
        initLang,
        langCode,
        lang,
        cycleLang,
        syncLang,
        applyFonts
    };
})();
