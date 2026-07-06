// ===== ROUTER =====
import { state } from './state.js';
import { getSearchParams } from './helpers.js';

const VALID_MODES = DSM_SHARED.VALID_MODES;
const { assetUrl } = DSM_SHARED;
const normalizeMode = DSM_SHARED.normalizeMode;

// Determina si la URL actual apunta a un proyecto (/p/<slug>/ o
// proyecto.html?p=<slug>) y devuelve su slug, o null si es la home.
function parseProjectSlugFromLocation() {
    const pathname = window.location.pathname;
    const rootPath = DSM_SHARED.SITE_ROOT_PATH;
    const projectsPrefix = rootPath.endsWith('/') ? `${rootPath}p/` : `${rootPath}/p/`;
    if (pathname.startsWith(projectsPrefix)) {
        const rest = pathname.slice(projectsPrefix.length);
        const slug = rest.split('/')[0];
        if (slug) return decodeURIComponent(slug);
    }
    if (/proyecto\.html$/.test(pathname)) {
        const params = getSearchParams();
        return params.get('p') || params.get('proyecto') || null;
    }
    return null;
}

function getInitialModeFromURL() {
    const params = getSearchParams();
    return normalizeMode(params.get('modo')) || normalizeMode(params.get('mode')) || 'portfolio';
}

function getModeFromURL() {
    const params = getSearchParams();
    const mode = params.get('modo') || params.get('mode');
    return VALID_MODES.has(mode) ? mode : null;
}

function getInferredMode() {
    if (!state.appData || !state.currentProject) return 'portfolio';
    const portfolioCategories = state.appData.modes && state.appData.modes.portfolio && state.appData.modes.portfolio.categories || [];
    return portfolioCategories.includes(state.currentProject.tipo) ? 'portfolio' : 'personal';
}

// URL de vuelta a la home, absoluta desde la raiz del sitio (segura tras un
// pushState a /p/<slug>/, donde una ruta relativa resolveria mal).
function getHomeUrl() {
    const base = assetUrl('');
    return state.currentMode === 'personal' ? `${base}?modo=personal` : base;
}

// Contador de version: cada llamada a renderRoute() se identifica con un
// numero creciente. Si el usuario navega rapido (o usa atras/adelante) antes
// de que termine un render async anterior, ese render obsoleto se aborta al
// comprobar que renderVersion ya avanzo.
// Objeto mutable (no un `let` exportado) para que project.js pueda leer el
// token actual `renderVersion.current` como binding vivo compartido.
const renderVersion = { current: 0 };

export {
    parseProjectSlugFromLocation,
    getInitialModeFromURL,
    getModeFromURL,
    getInferredMode,
    getHomeUrl,
    renderVersion,
};
