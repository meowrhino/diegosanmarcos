// ===== ENTRADA (modulo raiz) =====
// Orquesta la app: carga datos, inicializa idioma/menu y define el router.
// Importa los modulos de js/; ninguno de ellos importa este archivo, por lo
// que renderRoute() puede vivir aqui sin crear ciclos de import.
import { state } from './js/state.js';
import {
    parseProjectSlugFromLocation,
    getHomeUrl,
    renderVersion,
} from './js/router.js';
import { cleanupMenuArtifacts, createMenuButtonOnce, setupClickOutsideBackOnce } from './js/menu.js';
import { enterHomeView, loadBgmIfNeeded, renderProjects } from './js/home.js';
import { enterProjectView } from './js/project.js';
import { entriesOf, toOld } from './js/house.js';
import { leerJSON, validar } from './js/validar.js';

const { assetUrl } = DSM_SHARED;

// ===== IDIOMA (centralizado en shared.js) =====
DSM_SHARED.initLang();

async function renderRoute() {
    ++renderVersion.current; // Invalida cualquier render async anterior aun en vuelo

    // Limpiar restos del menu al navegar (overlay + listener de Escape)
    cleanupMenuArtifacts();

    const slug = parseProjectSlugFromLocation();
    if (slug) {
        const project = state.appData.projects.find(p => p.slug === slug);
        if (project) {
            await enterProjectView(project);
            return;
        }
        console.error('Proyecto no encontrado:', slug);
        // Dejar la URL coherente con la vista que se va a pintar (la home)
        history.replaceState(null, '', getHomeUrl());
    }
    enterHomeView();
}

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    if (!state.appData || !state.coloresData) return; // Datos no cargados

    DSM_SHARED.syncLang();
    createMenuButtonOnce();
    setupClickOutsideBackOnce();
    DSM_SHARED.setRouteRenderer(renderRoute);

    await renderRoute();
    if (state.currentView === 'home') loadBgmIfNeeded();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.currentView === 'home') renderProjects();
        }, 200);
    });
});

// ===== CARGA DE DATOS =====
// Mensaje simple y visible si falla la carga de data.json/colores.json
// (sin esto el usuario solo ve una pagina en blanco).
function showDataLoadError(message) {
    const div = document.createElement('div');
    div.id = 'data-load-error';
    div.textContent = message;
    div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;background:rgba(0,0,0,0.85);padding:1em 1.5em;border-radius:8px;font-family:monospace;text-align:left;white-space:pre-wrap;max-width:90vw;max-height:90vh;overflow:auto;z-index:9999;';
    document.body.appendChild(div);
}

// Las paginas que escribe el build llevan data-built en <html>. Sin el es la
// vista previa (Live Server, sin build): los JSON se revisan con schema/ como
// hace el build, y lo que este mal sale en pantalla.
const BUILT = document.documentElement.hasAttribute('data-built');

// data/site.json + projects/<slug>/project.json → la forma de antes (js/house.js)
async function loadData() {
    const get = async (path) => {
        const res = await fetch(assetUrl(path), { cache: BUILT ? 'default' : 'no-store' });
        if (!res.ok) throw new Error(`no encuentro ${path}`);
        return leerJSON(await res.text(), path);
    };
    try {
        const [site, colores] = await Promise.all([get('data/site.json'), get('data/colores.json')]);
        const slugs = entriesOf(site).map(e => e.slug).filter(s => typeof s === 'string');
        const projects = Object.fromEntries(await Promise.all(slugs.map(async s => [s, await get(`projects/${s}/project.json`)])));
        if (!BUILT) {
            const [siteSchema, projectSchema] = await Promise.all([get('schema/site.json'), get('schema/project.json')]);
            const errores = [
                ...validar(site, siteSchema, 'data/site.json'),
                ...slugs.flatMap(s => validar(projects[s], projectSchema, `projects/${s}/project.json`)),
            ];
            if (errores.length) throw new Error(errores.map(e => '✗ ' + e).join('\n'));
        }
        state.appData = toOld(site, projects);
        state.coloresData = colores;
        DSM_SHARED.applyFonts(state.appData.fonts);
    } catch (error) {
        console.error('Error cargando datos:', error);
        showDataLoadError(BUILT ? 'Error cargando los datos. Recarga la pagina.'
            : `Esto no se publicaria:\n\n${error.message}\n\nArreglalo, guarda, y la pagina se recarga sola.`);
    }
}
