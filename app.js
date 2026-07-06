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
function showDataLoadError() {
    const div = document.createElement('div');
    div.id = 'data-load-error';
    div.textContent = 'Error cargando los datos. Recarga la pagina.';
    div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;background:rgba(0,0,0,0.85);padding:1em 1.5em;border-radius:8px;font-family:sans-serif;text-align:center;z-index:9999;';
    document.body.appendChild(div);
}

async function loadData() {
    try {
        const [dataResponse, coloresResponse] = await Promise.all([
            fetch(assetUrl('data/data.json')),
            fetch(assetUrl('data/colores.json'))
        ]);

        if (!dataResponse.ok || !coloresResponse.ok) {
            console.error('Error cargando datos: respuesta no ok');
            showDataLoadError();
            return;
        }

        state.appData = await dataResponse.json();
        state.coloresData = await coloresResponse.json();
        DSM_SHARED.applyFonts(state.appData.fonts);
    } catch (error) {
        console.error('Error cargando datos:', error);
        showDataLoadError();
    }
}
