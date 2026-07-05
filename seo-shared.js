// ===== HELPERS DE SEO/METADATOS DE PROYECTO (compartidos browser + Node) =====
// Usado por app.js (navegador, <script> antes de app.js) y por
// scripts/generate-project-pages.mjs (Node, import). Patron UMD simple:
// module.exports si existe (Node/CommonJS), si no window.DSM_SEO.
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.DSM_SEO = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const IMAGE_PATTERN = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

    function getFullProjectTitle(project) {
        return project.titulo_proyecto ?? project.titulo_home ?? project.slug;
    }

    // lang: sufijo de idioma actual ('es'|'en'|'fr'...). Un array vacio cuenta
    // como "sin contenido": data.json trae texto1_en: [] etc. en todos los
    // proyectos, y si solo se rellena _es los demas idiomas deben caer al
    // espanol, no mostrar la seccion vacia.
    function loc(obj, field, lang) {
        const pick = (v) => (Array.isArray(v) ? (v.length ? v : null) : v ?? null);
        return pick(obj[field + '_' + lang])
            ?? pick(obj[field + '_es'])
            ?? pick(obj[field])
            ?? [];
    }

    function stripHtml(text) {
        return String(text || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function truncateText(text, maxLength = 170) {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3).trimEnd() + '...';
    }

    function getProjectSeoDescription(project, lang) {
        const credit = (loc(project, 'creditos', lang) || []).find(Boolean);
        const text1 = (loc(project, 'texto1', lang) || []).find(Boolean);
        const text2 = (loc(project, 'texto2', lang) || []).find(Boolean);
        const fallback = `Proyecto de ${getFullProjectTitle(project)} por Diego San Marcos.`;
        return truncateText(stripHtml(credit || text1 || text2 || fallback));
    }

    // Devuelve una ruta relativa a la raiz del sitio (sin encodear, sin baseUrl)
    // — cada entorno la resuelve a su manera (assetUrl en browser, baseUrl +
    // encodeURIComponent por segmento en el generador estatico).
    function getProjectSeoImagePath(project) {
        const principalImage = (project.principal || []).find((file) => IMAGE_PATTERN.test(file));
        if (principalImage) return `data/projects/${project.slug}/${principalImage}`;

        const galleryImage = (project.galeria || []).find((file) => IMAGE_PATTERN.test(file));
        if (galleryImage) return `data/projects/${project.slug}/${galleryImage}`;

        return 'data/icons/LOGO URL.png';
    }

    return {
        loc,
        stripHtml,
        truncateText,
        getFullProjectTitle,
        getProjectSeoDescription,
        getProjectSeoImagePath
    };
});
