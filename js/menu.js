// ===== MENU (compartido entre home y proyecto) =====
import { state } from './state.js';
import { hexToRgb } from './helpers.js';
import { getHomeUrl } from './router.js';
import { loadBgm, renderProjects } from './home.js';
import { updateProjectSEO } from './project.js';

const { assetUrl } = DSM_SHARED;

const MENU_LABELS = {
    ES: { trigger: 'menu', openPlayer: 'abrir reproductor', changeLang: 'cambiar idioma', back: 'volver', close: 'cerrar menu' },
    EN: { trigger: 'menu', openPlayer: 'open player', changeLang: 'change language', back: 'back', close: 'close menu' },
    FR: { trigger: 'menu', openPlayer: 'ouvrir lecteur', changeLang: 'changer de langue', back: 'retour', close: 'fermer menu' }
};

function getMenuLabels() {
    return MENU_LABELS[DSM_SHARED.langCode()] || MENU_LABELS.ES;
}

// Elemento que tenia el foco antes de abrir el menu, para devolverselo al cerrar
let menuOpenerElement = null;
// Listener de Escape: se guarda la referencia para poder eliminarla al cerrar
let menuKeydownHandler = null;

function openMenu({ showBack } = {}) {
    // Evitar duplicados
    if (document.querySelector('.menu-overlay')) return;

    menuOpenerElement = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    const modal = document.createElement('div');
    modal.className = 'menu-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', getMenuLabels().trigger === 'menu' ? 'Menú' : getMenuLabels().trigger);

    // Aplicar misma border-image que el modo actual
    const frameFile = state.appData.modes && state.appData.modes[state.currentMode] && state.appData.modes[state.currentMode].frame;
    if (frameFile) {
        modal.style.borderImage = `url('${assetUrl(`data/9slice/${frameFile}`)}') 16 fill / 16px / 0 stretch`;
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'menu-items';
    modal.appendChild(itemsContainer);

    renderMenuContent(itemsContainer, showBack);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Click fuera del modal = cerrar
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            e.stopPropagation();
            closeMenu();
        }
    });

    // Bloquear propagacion del modal para que no active el click-outside-back
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Cerrar con Escape (listener en document; se elimina al cerrar el menu)
    menuKeydownHandler = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeMenu();
        }
    };
    document.addEventListener('keydown', menuKeydownHandler);

    // Mover el foco al primer elemento enfocable del modal
    const firstFocusable = modal.querySelector('button, a, [tabindex]');
    if (firstFocusable) firstFocusable.focus();
}

function renderMenuContent(container, showBack) {
    container.innerHTML = '';
    const labels = getMenuLabels();

    // 1. Abrir reproductor (si esta vacio, cargar BGM)
    const playerBtn = document.createElement('button');
    playerBtn.className = 'menu-item';
    playerBtn.textContent = labels.openPlayer;
    playerBtn.addEventListener('click', () => {
        if (DSM_Player.hasContent()) {
            DSM_Player.show();
        } else {
            loadBgm();
        }
        closeMenu();
    });
    container.appendChild(playerBtn);

    // 2. Cambiar idioma
    const langBtn = document.createElement('button');
    langBtn.className = 'menu-item';
    langBtn.textContent = labels.changeLang;
    langBtn.addEventListener('click', () => {
        DSM_SHARED.cycleLang();
        if (state.currentView === 'home') {
            // Re-renderizar el grid de la home (tiles con titulos en el nuevo idioma)
            renderProjects();
        } else {
            updateProjectSEO();
            // Actualizar tambien el boton trigger debajo del contenido
            const trigger = document.querySelector('.menu-trigger');
            if (trigger) trigger.textContent = getMenuLabels().trigger;
        }
        // Re-renderizar el contenido del menu con el nuevo idioma
        renderMenuContent(container, showBack);
    });
    container.appendChild(langBtn);

    // 3. Volver (solo en la vista de proyecto)
    if (showBack) {
        const backBtn = document.createElement('button');
        backBtn.className = 'menu-item';
        backBtn.textContent = labels.back;
        backBtn.addEventListener('click', () => {
            DSM_SHARED.navigateTo(getHomeUrl());
        });
        container.appendChild(backBtn);
    }

    // 4. Cerrar menu
    const closeBtn = document.createElement('button');
    closeBtn.className = 'menu-item';
    closeBtn.textContent = labels.close;
    closeBtn.addEventListener('click', () => closeMenu());
    container.appendChild(closeBtn);
}

function closeMenu() {
    const overlay = document.querySelector('.menu-overlay');
    if (!overlay || overlay.classList.contains('closing')) return;
    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });

    // Quitar el listener de Escape (no dejar listeners colgando en document)
    if (menuKeydownHandler) {
        document.removeEventListener('keydown', menuKeydownHandler);
        menuKeydownHandler = null;
    }

    // Devolver el foco al elemento que abrio el menu
    if (menuOpenerElement && typeof menuOpenerElement.focus === 'function') {
        menuOpenerElement.focus();
    }
    menuOpenerElement = null;
}

// ===== MENU (PROYECTO): boton trigger =====
// El boton se crea una unica vez: .project-main persiste en el DOM entre
// navegaciones, asi que no hay que recrearlo (ni sus listeners) cada visita.
function createMenuButtonOnce() {
    if (document.querySelector('.menu-trigger')) return;
    const main = document.querySelector('.project-main');
    const btn = document.createElement('button');
    btn.className = 'menu-trigger';
    btn.textContent = getMenuLabels().trigger;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu({ showBack: true });
    });
    main.appendChild(btn);
}

// ===== CLICK FUERA DEL MAIN PARA VOLVER =====
// Se registra una unica vez; el propio handler comprueba si la vista de
// proyecto esta activa (no se re-liga en cada navegacion).
function setupClickOutsideBackOnce() {
    document.addEventListener('click', (e) => {
        if (state.currentView !== 'project') return;
        const main = document.querySelector('.project-main');
        const player = document.getElementById('audio-player');
        const menuOverlay = document.querySelector('.menu-overlay');
        if (menuOverlay) return; // Menu abierto — no navegar
        // Ignorar clicks cerca de los bordes para evitar conflictos con gestos de swipe del navegador
        if (e.clientX < 20 || e.clientX > window.innerWidth - 20) return;
        if (main && !main.contains(e.target) && (!player || !player.contains(e.target))) {
            DSM_SHARED.navigateTo(getHomeUrl());
        }
    });
}

// Limpia los restos del menu al navegar (lo que renderRoute ejecuta cuando
// detecta un `.menu-overlay` abierto): quita el overlay y el listener de
// Escape que quedaria colgado en document. Mismo cleanup que closeMenu().
function cleanupMenuArtifacts() {
    const closingMenu = document.querySelector('.menu-overlay');
    if (closingMenu) {
        closingMenu.remove();
        // Mismo cleanup que closeMenu(): sin esto el listener de Escape
        // quedaria colgado en document al cerrar el menu navegando
        if (menuKeydownHandler) {
            document.removeEventListener('keydown', menuKeydownHandler);
            menuKeydownHandler = null;
        }
        menuOpenerElement = null;
    }
}

export {
    getMenuLabels,
    openMenu,
    renderMenuContent,
    closeMenu,
    createMenuButtonOnce,
    setupClickOutsideBackOnce,
    cleanupMenuArtifacts,
};
