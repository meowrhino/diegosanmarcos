// ===== HELPERS COMPARTIDOS =====
function getHomeProjectTitle(project) {
    return project.titulo_home ?? project.titulo_proyecto ?? project.slug;
}

const getFullProjectTitle = DSM_SEO.getFullProjectTitle;
const stripHtml = DSM_SEO.stripHtml;
const truncateText = DSM_SEO.truncateText;

// loc() y getProjectSeo* viven en seo-shared.js (DSM_SEO), compartidos con el
// generador estatico. Aqui solo fijamos el idioma actual del navegador.
function loc(obj, field) {
    return DSM_SEO.loc(obj, field, DSM_SHARED.lang());
}

// Convierte hex (#RRGGBB) a objeto {r, g, b}
function hexToRgb(hex) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return { r: 128, g: 128, b: 128 };
    return {
        r: parseInt(hex.slice(1, 3), 16) || 0,
        g: parseInt(hex.slice(3, 5), 16) || 0,
        b: parseInt(hex.slice(5, 7), 16) || 0
    };
}

// ===== ROUTER =====
// Helper compartido: evita repetir `new URLSearchParams(window.location.search)`
// en cada funcion que necesita leer parametros de la URL.
function getSearchParams() {
    return new URLSearchParams(window.location.search);
}

export {
    getHomeProjectTitle,
    getFullProjectTitle,
    stripHtml,
    truncateText,
    loc,
    hexToRgb,
    getSearchParams,
};
