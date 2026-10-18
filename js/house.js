// ===== EL CONTENIDO A LA MANERA DEL ESTUDIO (JAMstack) → EL DE ANTES =====
// El contenido vive asi: data/site.json (fuentes, modos, colores, la musica
// de fondo y "lists": que proyectos salen y en que orden; uno oculto es
// { "project": "x", "visible": false }) y cada proyecto en
// projects/<slug>/project.json, con sus ficheros al lado. Campos en ingles,
// idiomas por campo { es, en, fr }.
//
// El JS sigue trabajando con la forma del data.json de antes (titulo_proyecto,
// texto1_es…); toOld() pasa de una a otra, asi que app.js, home.js, project.js
// y el reproductor no cambian. Lo usan el navegador (app.js) y el build
// (build/build.mjs): sin DOM ni disco.

// "lists" → [{ slug, visible }], en orden
export const entriesOf = (site) =>
    Object.values(site.lists || {}).flatMap(list => list.projects || [])
        .map(e => (e && typeof e === 'object' ? { slug: e.project, visible: e.visible !== false } : { slug: e, visible: true }));

const LANGS = ['es', 'en', 'fr'];
const byLang = (key, value = {}) => Object.fromEntries(LANGS.map(l => [`${key}_${l}`, value[l] || []]));

export function toOld(site, projects) {
    return {
        fonts: site.fonts,
        modes: site.modes,
        typeColors: site.typeColors,
        bgm: site.bgm,
        projects: entriesOf(site).map(({ slug, visible }) => {
            const p = projects[slug];
            return {
                slug,
                titulo_proyecto: p.title,
                titulo_home: p.short ?? p.title,
                tipo: p.type,
                visible,
                mostrarImagen: p.showImage ?? true,
                principal: p.main || [],
                ...byLang('texto1', p.text),
                audio: p.audio || [],
                ...byLang('texto2', p.text2),
                galeria: p.photos || [],
                ...byLang('creditos', p.credits),
                ...(p.textFiles ? { archivosTexto: p.textFiles } : {}),
            };
        }),
    };
}
