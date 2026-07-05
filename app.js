// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentMode = 'portfolio';
let currentProject = null;
let currentView = null; // 'home' | 'project'
const VALID_MODES = DSM_SHARED.VALID_MODES;
const SITE_TITLE = DSM_SHARED.SITE_TITLE;
const { setMetaContent, setCanonicalHref, assetUrl } = DSM_SHARED;
const normalizeMode = DSM_SHARED.normalizeMode;
const updateModeInURL = DSM_SHARED.updateModeInURL;

// ===== IDIOMA (centralizado en shared.js) =====
DSM_SHARED.initLang();

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
        const params = new URLSearchParams(window.location.search);
        return params.get('p') || params.get('proyecto') || null;
    }
    return null;
}

function getInitialModeFromURL() {
    const params = new URLSearchParams(window.location.search);
    return normalizeMode(params.get('modo')) || normalizeMode(params.get('mode')) || 'portfolio';
}

function getModeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('modo') || params.get('mode');
    return VALID_MODES.has(mode) ? mode : null;
}

function getInferredMode() {
    if (!appData || !currentProject) return 'portfolio';
    const portfolioCategories = appData.modes && appData.modes.portfolio && appData.modes.portfolio.categories || [];
    return portfolioCategories.includes(currentProject.tipo) ? 'portfolio' : 'personal';
}

// URL de vuelta a la home, absoluta desde la raiz del sitio (segura tras un
// pushState a /p/<slug>/, donde una ruta relativa resolveria mal).
function getHomeUrl() {
    const base = assetUrl('');
    return currentMode === 'personal' ? `${base}?modo=personal` : base;
}

async function renderRoute() {
    const closingMenu = document.querySelector('.menu-overlay');
    if (closingMenu) closingMenu.remove();

    const slug = parseProjectSlugFromLocation();
    if (slug) {
        const project = appData.projects.find(p => p.slug === slug);
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
    if (!appData || !coloresData) return; // Datos no cargados

    DSM_SHARED.syncLang();
    createMenuButtonOnce();
    setupClickOutsideBackOnce();
    DSM_SHARED.setRouteRenderer(renderRoute);

    await renderRoute();
    if (currentView === 'home') loadBgmIfNeeded();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (currentView === 'home') renderProjects();
        }, 200);
    });
});

// ===== CARGA DE DATOS =====
async function loadData() {
    try {
        const [dataResponse, coloresResponse] = await Promise.all([
            fetch(assetUrl('data/data.json')),
            fetch(assetUrl('data/colores.json'))
        ]);

        if (!dataResponse.ok || !coloresResponse.ok) {
            console.error('Error cargando datos: respuesta no ok');
            return;
        }

        appData = await dataResponse.json();
        coloresData = await coloresResponse.json();
        DSM_SHARED.applyFonts(appData.fonts);
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== CAMBIO DE VISTA =====
// #projects-container y .project-main conviven siempre en el DOM (para que
// DSM_Player nunca se destruya) — solo se alterna cual esta visible.
function showView(view) {
    const home = document.getElementById('projects-container');
    const project = document.querySelector('.project-main');
    // Limpiar SIEMPRE los restos del proyecto anterior: los saltos directos
    // proyecto→proyecto via historial del navegador no pasan por la home, y
    // sin esto renderProject() acumularia titulo/textos/galeria duplicados.
    document.body.classList.remove(...[...document.body.classList].filter(c => c.startsWith('tipo-')));
    resetProjectDynamicContent();
    if (view === 'home') {
        home.classList.remove('dsm-hidden');
        project.classList.add('dsm-hidden');
        document.body.classList.remove('project-page');
    } else {
        home.classList.add('dsm-hidden');
        project.classList.remove('dsm-hidden');
        document.body.classList.add('project-page');
    }
}

// ===== VISTA: HOME =====

const HOME_SEO_COPY = {
    ES: {
        portfolio: {
            description: 'Portfolio de Diego San Marcos: musica, mezcla, audio inmersivo y proyectos audiovisuales.'
        },
        personal: {
            description: 'Proyecto personal de Diego San Marcos con musica original, exploracion sonora y piezas audiovisuales.'
        }
    },
    EN: {
        portfolio: {
            description: 'Portfolio by Diego San Marcos: music, mixing, immersive audio and audiovisual projects.'
        },
        personal: {
            description: 'Personal project by Diego San Marcos with original music, sound exploration and audiovisual pieces.'
        }
    },
    FR: {
        portfolio: {
            description: 'Portfolio de Diego San Marcos: musique, mixage, audio immersif et projets audiovisuels.'
        },
        personal: {
            description: 'Projet personnel de Diego San Marcos avec musique originale, exploration sonore et pieces audiovisuelles.'
        }
    }
};

function updateHomeSEO() {
    const lang = DSM_SHARED.langCode();
    const langCopy = HOME_SEO_COPY[lang] || HOME_SEO_COPY.ES;
    const copy = langCopy[currentMode] || langCopy.portfolio;

    const canonical = new URL(window.location.pathname, window.location.origin).toString();
    const bgFile = appData?.modes?.[currentMode]?.background;
    const image = bgFile ? assetUrl(`data/backgrounds/${bgFile}`) : assetUrl('data/icons/LOGO URL.png');

    document.title = SITE_TITLE;
    setCanonicalHref(canonical);
    setMetaContent('meta[name="description"]', copy.description);

    setMetaContent('meta[property="og:title"]', SITE_TITLE);
    setMetaContent('meta[property="og:description"]', copy.description);
    setMetaContent('meta[property="og:url"]', canonical);
    setMetaContent('meta[property="og:image"]', image);

    setMetaContent('meta[name="twitter:title"]', SITE_TITLE);
    setMetaContent('meta[name="twitter:description"]', copy.description);
    setMetaContent('meta[name="twitter:image"]', image);

    const jsonLdEl = document.getElementById('home-json-ld');
    if (jsonLdEl) {
        jsonLdEl.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'Person',
                    name: 'Diego San Marcos',
                    url: canonical
                },
                {
                    '@type': 'WebSite',
                    name: 'Diego San Marcos',
                    url: canonical,
                    inLanguage: DSM_SHARED.lang(),
                    description: copy.description
                }
            ]
        });
    }
}

// Posibles tamanos de tile [w, h] — basados en la celda cuadrada del grid
// Desktop: mas probabilidad de 1x1, pero manteniendo variedad
const TILE_SIZES_DESKTOP = [
    [1,1], [1,1], [1,1], [1,1], [1,1],
    [2,1], [2,1],
    [1,2], [1,2],
    [2,2]
];

// Mobile (<=768): tiles mas pequenos, evitando 2x2
const TILE_SIZES_MOBILE = [
    [1,1], [1,1], [1,1], [1,1], [1,1], [1,1], [1,1], [1,1],
    [2,1],
    [1,2]
];

function enterHomeView() {
    currentView = 'home';
    currentProject = null;
    currentMode = getInitialModeFromURL();
    showView('home');
    setHomeBackground(currentMode);
    DSM_SHARED.updateFavicon();
    renderProjects();
}

// ===== BGM (MUSICA DE FONDO) =====
function loadBgm() {
    const bgm = appData.bgm;
    if (!bgm || !bgm.file) return;
    DSM_Player.loadBgm(bgm.file, bgm.title, bgm.project);
}

function loadBgmIfNeeded() {
    // No cargar BGM si el player ya restauro estado previo (ej: playlist de proyecto)
    if (DSM_Player.stateRestored) return;
    loadBgm();
}

// ===== FONDO DINAMICO (desde data.json) =====
function setHomeBackground(mode) {
    const bgContainer = document.getElementById('background-container');
    const modeData = appData.modes && appData.modes[mode];
    if (modeData && modeData.background) {
        bgContainer.style.backgroundImage = `url('${assetUrl(`data/backgrounds/${modeData.background}`)}')`;
    }
}

// ===== CALCULO DEL GRID =====
// Calcula dimensiones para tiles cuadrados perfectos que llenen el viewport
function calculateGrid() {
    const container = document.getElementById('projects-container');
    const gap = 3;
    const minPad = 16;
    // Leer del contenedor (usa 100dvh/dvw en CSS) para respetar viewport dinamico en movil
    const viewW = container.clientWidth || window.innerWidth;
    const viewH = container.clientHeight || window.innerHeight;

    // Columnas y tamano de tile basados en ancho (objetivo ~120px por tile)
    const desired = 120;
    let cols = Math.floor((viewW - 2 * minPad + gap) / (desired + gap));
    cols = Math.max(4, Math.min(cols, 12));
    const tileSize = Math.floor((viewW - 2 * minPad - (cols - 1) * gap) / cols);

    // Filas basadas en alto con el mismo tamano de tile
    let rows = Math.floor((viewH - 2 * minPad + gap) / (tileSize + gap));
    rows = Math.max(3, rows);

    // Padding para centrar el grid en el viewport
    const gridW = cols * tileSize + (cols - 1) * gap;
    const gridH = rows * tileSize + (rows - 1) * gap;
    const padX = Math.max(minPad, Math.floor((viewW - gridW) / 2));
    const padY = Math.max(minPad, Math.floor((viewH - gridH) / 2));

    container.style.padding = `${padY}px ${padX}px`;
    container.style.setProperty('--grid-cols', cols);
    container.style.setProperty('--grid-rows', rows);
    container.style.setProperty('--tile-size', tileSize + 'px');

    return { cols, rows, tileSize };
}

// ===== RENDERIZADO DE PROYECTOS =====
function renderProjects() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    updateHomeSEO();

    const modeConfig = appData.modes[currentMode] || {};
    const categories = modeConfig.categories || [];
    const filteredProjects = appData.projects.filter(p => categories.includes(p.tipo) && p.visible !== false);
    const { cols, rows } = calculateGrid();
    const isMobileGrid = window.matchMedia('(max-width: 768px)').matches;
    const tileSizes = isMobileGrid ? TILE_SIZES_MOBILE : TILE_SIZES_DESKTOP;

    // Grid de ocupacion (false = libre, true = ocupada)
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(false));

    // Reservar celdas: switch (ultima fila, ultima col), idioma (penultima col), menu (primera col)
    grid[rows - 1][cols - 1] = true;
    grid[rows - 1][cols - 2] = true;
    grid[rows - 1][0] = true;

    // Comprobar si un tile de tamaño w×h cabe en la posicion (r, c)
    function canPlace(r, c, w, h) {
        if (r + h > rows || c + w > cols) return false;
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                if (grid[r + dr][c + dc]) return false;
            }
        }
        return true;
    }

    // Marcar celdas como ocupadas
    function markPlaced(r, c, w, h) {
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                grid[r + dr][c + dc] = true;
            }
        }
    }

    // Colocar proyectos en orden de data.json (sin shuffle)
    const queue = [...filteredProjects];
    let queueIdx = 0;
    const placed = [];

    // Probabilidad de skip (hueco): baja para que no quede vacio
    const totalCells = cols * rows - 1;
    const baseSkipChance = 1 - (queue.length * 4 / totalCells);
    const skipChance = isMobileGrid
        ? Math.max(0.01, Math.min(0.04, baseSkipChance))
        : Math.max(0.02, Math.min(0.12, baseSkipChance));

    // Recorrer celdas izq→der, arriba→abajo
    for (let r = 0; r < rows && queueIdx < queue.length; r++) {
        for (let c = 0; c < cols && queueIdx < queue.length; c++) {
            if (grid[r][c]) continue;

            // Random skip para crear huecos organicos
            if (Math.random() < skipChance) continue;

            // Elegir tamano aleatorio de los que caben
            const sizePool = tileSizes.filter(([w, h]) => canPlace(r, c, w, h));
            if (sizePool.length === 0) continue;

            const [w, h] = sizePool[Math.floor(Math.random() * sizePool.length)];
            markPlaced(r, c, w, h);
            placed.push({
                project: queue[queueIdx],
                row: r + 1, // CSS grid es 1-indexed
                col: c + 1,
                w, h
            });
            queueIdx++;
        }
    }

    // Proyectos restantes: colocar como 1x1 en huecos libres
    for (; queueIdx < queue.length; queueIdx++) {
        let found = false;
        for (let r = 0; r < rows && !found; r++) {
            for (let c = 0; c < cols && !found; c++) {
                if (!grid[r][c]) {
                    grid[r][c] = true;
                    placed.push({
                        project: queue[queueIdx],
                        row: r + 1, col: c + 1,
                        w: 1, h: 1
                    });
                    found = true;
                }
            }
        }
    }

    // Renderizar tiles con animacion escalonada
    placed.forEach((item, i) => {
        const el = createProjectCard(item.project);
        el.style.gridRow = `${item.row} / span ${item.h}`;
        el.style.gridColumn = `${item.col} / span ${item.w}`;
        el.style.animationDelay = `${i * 0.04}s`;
        container.appendChild(el);
    });

    // Switch siempre en ultima fila, ultima columna
    const switchEl = createSwitchTile();
    switchEl.style.gridRow = `${rows}`;
    switchEl.style.gridColumn = `${cols}`;
    switchEl.style.animationDelay = `${placed.length * 0.04}s`;
    container.appendChild(switchEl);

    // Idioma en ultima fila, penultima columna (junto al switch)
    const langEl = createLanguageTile();
    langEl.style.gridRow = `${rows}`;
    langEl.style.gridColumn = `${cols - 1}`;
    langEl.style.animationDelay = `${(placed.length + 1) * 0.04}s`;
    container.appendChild(langEl);

    // Menu en ultima fila, primera columna
    const menuEl = createMenuTile();
    menuEl.style.gridRow = `${rows}`;
    menuEl.style.gridColumn = `1`;
    menuEl.style.animationDelay = `${(placed.length + 2) * 0.04}s`;
    container.appendChild(menuEl);
}

// ===== CREACION DE TARJETA DE PROYECTO =====

// Busca la primera imagen disponible del proyecto (principal o galeria)
function getProjectThumbnail(project) {
    const imageExts = /\.(jpg|jpeg|png|gif|webp)$/i;

    // Primero buscar en principal (solo imagenes, no videos)
    const principalImages = (project.principal || []).filter(f => f && imageExts.test(f));
    if (principalImages.length > 0) {
        return assetUrl(`data/projects/${project.slug}/${principalImages[0]}`);
    }

    // Luego en galeria
    const galeriaImages = (project.galeria || []).filter(f => f && imageExts.test(f));
    if (galeriaImages.length > 0) {
        return assetUrl(`data/projects/${project.slug}/${galeriaImages[0]}`);
    }

    return null;
}

function createProjectCard(project) {
    // Enlace real: Google descubre /p/<slug>/ navegando y el tile es
    // accesible por teclado (tab + enter)
    const card = document.createElement('a');
    card.className = 'project-card';
    // URL bonita generada por scripts/generate-project-pages.mjs, absoluta
    // desde la raiz del sitio (valida se navegue desde donde se navegue).
    // Si la pagina no existe (proyecto nuevo sin regenerar), 404.html
    // redirige a proyecto.html?p=<slug> como red de seguridad.
    card.href = assetUrl(`p/${encodeURIComponent(project.slug)}/`);
    card.draggable = false;

    const colorValue = appData.typeColors[project.tipo] || '#808080';
    const colorHex = colorValue.startsWith('#') ? colorValue : (coloresData.colores[colorValue] || '#808080');
    const { r, g, b } = hexToRgb(colorHex);
    card.style.setProperty('--tile-rgb', `${r}, ${g}, ${b}`);
    card.style.background = `rgba(${r}, ${g}, ${b}, 0.5)`;

    // Imagen de fondo del tile (thumbnail del proyecto)
    const thumbSrc = project.mostrarImagen !== false ? getProjectThumbnail(project) : null;
    if (thumbSrc) {
        const thumb = document.createElement('img');
        thumb.className = 'project-thumb';
        thumb.src = thumbSrc;
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.onerror = () => { thumb.style.display = 'none'; };
        card.appendChild(thumb);
    }

    const inner = document.createElement('div');
    inner.className = 'project-card-inner';

    const icon = document.createElement('img');
    icon.className = 'project-icon';
    // about usa SVG, el resto PNG
    const iconExt = project.tipo === 'about' ? 'svg' : 'png';
    icon.src = assetUrl(`data/icons/${project.tipo}.${iconExt}`);
    icon.alt = project.tipo;
    icon.onerror = () => { icon.style.display = 'none'; };

    const title = document.createElement('span');
    title.className = 'project-title';
    title.textContent = getHomeProjectTitle(project);

    inner.appendChild(icon);
    inner.appendChild(title);
    card.appendChild(inner);
    card.addEventListener('click', (e) => {
        // Dejar que el navegador gestione pestaña nueva / ventana nueva
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        DSM_SHARED.navigateTo(card.getAttribute('href'));
    });

    return card;
}

// ===== TILES ESPECIALES (SWITCH + IDIOMA) =====

// Helper: configura un tile especial con glassmorphism y misma estructura que project-card
function setupSpecialTile(el, tag) {
    const colors = appData.modes[currentMode].tileColor;
    el.className = tag + '-tile special-tile';
    const { r, g, b } = hexToRgb(colors.bg);
    el.style.setProperty('--tile-rgb', `${r}, ${g}, ${b}`);
    el.style.background = `rgba(${r}, ${g}, ${b}, 0.5)`;
    el.style.color = colors.text;
}

// --- SWITCH ---
function createSwitchTile() {
    const nextMode = currentMode === 'portfolio' ? 'personal' : 'portfolio';
    const colors = appData.modes[currentMode].tileColor;

    const tile = document.createElement('button');
    setupSpecialTile(tile, 'switch');

    const inner = document.createElement('div');
    inner.className = 'special-tile-inner';

    const icon = document.createElement('img');
    icon.src = assetUrl(`data/icons/${appData.modes[currentMode].switchIcon}`);
    icon.alt = 'switch';
    icon.className = 'special-tile-icon';

    const label = document.createElement('span');
    label.className = 'project-title';
    label.style.color = colors.text;
    label.textContent = nextMode;

    inner.appendChild(icon);
    inner.appendChild(label);
    tile.appendChild(inner);
    tile.addEventListener('click', () => {
        playIrisTransition(nextMode);
    });
    return tile;
}

// --- IDIOMA ---
const LANG_LABELS = { ES: 'idioma', EN: 'language', FR: 'langue' };

function createLanguageTile() {
    const colors = appData.modes[currentMode].tileColor;

    const tile = document.createElement('button');
    setupSpecialTile(tile, 'lang');

    const inner = document.createElement('div');
    inner.className = 'special-tile-inner';

    const icon = document.createElement('span');
    icon.className = 'special-tile-icon lang-icon';
    icon.textContent = DSM_SHARED.langCode();
    icon.style.color = colors.text;

    const label = document.createElement('span');
    label.className = 'project-title';
    label.style.color = colors.text;
    label.textContent = LANG_LABELS[DSM_SHARED.langCode()];

    inner.appendChild(icon);
    inner.appendChild(label);
    tile.appendChild(inner);
    tile.addEventListener('click', () => {
        DSM_SHARED.cycleLang();
        renderProjects();
    });
    return tile;
}

// ===== MENU (compartido entre home y proyecto) =====
const MENU_LABELS = {
    ES: { trigger: 'menu', openPlayer: 'abrir reproductor', changeLang: 'cambiar idioma', back: 'volver', close: 'cerrar menu' },
    EN: { trigger: 'menu', openPlayer: 'open player', changeLang: 'change language', back: 'back', close: 'close menu' },
    FR: { trigger: 'menu', openPlayer: 'ouvrir lecteur', changeLang: 'changer de langue', back: 'retour', close: 'fermer menu' }
};

function getMenuLabels() {
    return MENU_LABELS[DSM_SHARED.langCode()] || MENU_LABELS.ES;
}

function createMenuTile() {
    const colors = appData.modes[currentMode].tileColor;

    const tile = document.createElement('button');
    setupSpecialTile(tile, 'menu');

    const inner = document.createElement('div');
    inner.className = 'special-tile-inner menu-tile-inner';

    const label = document.createElement('span');
    label.className = 'project-title';
    label.style.color = colors.text;
    label.textContent = getMenuLabels().trigger;

    inner.appendChild(label);
    tile.appendChild(inner);
    tile.addEventListener('click', () => openMenu({ showBack: false }));
    return tile;
}

function openMenu({ showBack } = {}) {
    // Evitar duplicados
    if (document.querySelector('.menu-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    const modal = document.createElement('div');
    modal.className = 'menu-modal';

    // Aplicar misma border-image que el modo actual
    const frameFile = appData.modes && appData.modes[currentMode] && appData.modes[currentMode].frame;
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
        if (currentView === 'home') {
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
}

// ===== TRANSICION IRIS RADIAL =====
function playIrisTransition(nextMode) {
    const color = appData.modes[nextMode].tileColor.bg;
    const duration = 500;  // ms por fase
    const steps = 30;
    const interval = duration / steps;
    // closest-side hace que la elipse sea proporcional al viewport automaticamente
    // 150% cubre hasta las esquinas (diagonal = ~141% del lado corto)
    const maxPct = 150;
    const fadeWidth = 25;
    const shape = 'ellipse closest-side at 50% 50%';

    // Crear overlay
    let overlay = document.getElementById('mode-iris-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mode-iris-overlay';
        document.body.appendChild(overlay);
    }

    // Fase 1: cubrir — elipse de color se expande desde el centro hacia fuera
    overlay.style.background = 'none';
    let step = 0;
    const expand = setInterval(() => {
        const t = step / steps;
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const disc = maxPct * e;
        const fade = disc + fadeWidth;
        overlay.style.background = `radial-gradient(${shape}, ${color} ${disc}%, transparent ${fade}%)`;
        step++;
        if (step > steps) {
            clearInterval(expand);
            overlay.style.background = color;
            switchMode(nextMode);

            // Fase 2: revelar — hueco transparente se abre desde el centro hacia fuera
            let step2 = 0;
            const reveal = setInterval(() => {
                const t2 = step2 / steps;
                const e2 = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2;
                const hole = maxPct * e2;
                const fade2 = Math.max(0, hole - fadeWidth);
                overlay.style.background = `radial-gradient(${shape}, transparent ${fade2}%, ${color} ${hole}%)`;
                step2++;
                if (step2 > steps) {
                    clearInterval(reveal);
                    overlay.style.background = 'none';
                }
            }, interval);
        }
    }, interval);
}

// ===== CAMBIO DE MODO =====
function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    updateModeInURL(mode);
    setHomeBackground(mode);
    DSM_SHARED.updateFavicon();
    renderProjects();
}

// ===== VISTA: PROYECTO =====

function getProjectSeoDescription(project) {
    return DSM_SEO.getProjectSeoDescription(project, DSM_SHARED.lang());
}

function getProjectSeoImagePath(project) {
    return DSM_SEO.getProjectSeoImagePath(project);
}

function updateProjectSEO() {
    if (!currentProject) return;

    const projectTitle = getFullProjectTitle(currentProject);
    const description = getProjectSeoDescription(currentProject);
    const canonical = assetUrl(`p/${encodeURIComponent(currentProject.slug)}/`);
    const image = assetUrl(getProjectSeoImagePath(currentProject));

    const pageTitle = `${projectTitle} — ${SITE_TITLE}`;
    document.title = pageTitle;
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = pageTitle;

    setCanonicalHref(canonical);
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', pageTitle);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', canonical);
    setMetaContent('meta[property="og:image"]', image);
    setMetaContent('meta[name="twitter:title"]', pageTitle);
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[name="twitter:image"]', image);

    const jsonLdEl = document.getElementById('project-json-ld');
    if (jsonLdEl) {
        jsonLdEl.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: projectTitle,
            url: canonical,
            inLanguage: DSM_SHARED.lang(),
            description,
            image,
            genre: currentProject.tipo,
            author: {
                '@type': 'Person',
                name: 'Diego San Marcos'
            }
        });
    }
}

async function enterProjectView(project) {
    currentView = 'project';
    currentProject = project;
    currentMode = getModeFromURL() || getInferredMode();
    showView('project');
    setupProjectBackground(currentMode);
    await renderProject();
}

// Limpia todo lo que renderProject() fue insertando/marcando la vez anterior,
// para que volver a entrar (mismo proyecto u otro) no acumule contenido.
function resetProjectDynamicContent() {
    document.querySelectorAll('.project-main > .dsm-dynamic-section').forEach(el => el.remove());
    ['principal-content', 'texto1-content', 'audio-list', 'texto2-content', 'galeria-content', 'creditos-content']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
}

// ===== CONFIGURAR FONDO Y FRAME =====
function setupProjectBackground(mode) {
    const bgContainer = document.getElementById('background-container');

    // Fondo dinamico desde data.json
    const modeData = appData.modes && appData.modes[mode];
    if (modeData && modeData.background) {
        bgContainer.style.backgroundImage = `url('${assetUrl(`data/backgrounds/${modeData.background}`)}')`;
    }

    // Frame 9-slice desde data.json
    const frameFile = modeData && modeData.frame;
    const main = document.querySelector('.project-main');
    main.style.borderImage = frameFile
        ? `url('${assetUrl(`data/9slice/${frameFile}`)}') 16 fill / 16px / 0 stretch`
        : '';

    DSM_SHARED.updateFavicon();

    // Clase de tipo en body para estilos especificos (ej: tipo-textos)
    document.body.classList.add(`tipo-${currentProject.tipo}`);
}

// ===== RENDERIZAR PROYECTO =====
async function renderProject() {
    updateProjectSEO();

    renderTitle();

    if (currentProject.archivosTexto && currentProject.archivosTexto.length > 0) {
        await renderArchivosTexto();
    }

    renderPrincipal();
    renderTextSection('texto1-section', 'texto1-content', loc(currentProject, 'texto1'));
    renderAudios();
    renderTextSection('texto2-section', 'texto2-content', loc(currentProject, 'texto2'));
    renderGaleria();
    renderCreditos();
}

// ===== RENDERIZAR TITULO =====
function renderTitle() {
    const main = document.querySelector('.project-main');
    const section = document.createElement('div');
    section.className = 'project-title-section project-section dsm-dynamic-section';

    const h1 = document.createElement('h1');
    h1.textContent = getFullProjectTitle(currentProject);
    section.appendChild(h1);

    main.insertBefore(section, main.firstChild);
}

// ===== RENDERIZAR ARCHIVOS DE TEXTO EXTERNOS =====
async function renderArchivosTexto() {
    const main = document.querySelector('.project-main');
    const principalSection = document.getElementById('principal-section');

    // Fetch en paralelo; el orden lo garantiza el array de resultados
    const cargas = await Promise.all(currentProject.archivosTexto.map(async (archivo) => {
        try {
            const response = await fetch(assetUrl(`data/projects/${currentProject.slug}/${archivo}`));
            if (!response.ok) return null;
            return { archivo, text: await response.text() };
        } catch (e) {
            return null; // Skip archivos que no se pueden cargar
        }
    }));

    for (const carga of cargas) {
        if (!carga) continue;
        const { archivo, text } = carga;

        const section = document.createElement('section');
        section.className = 'project-section dsm-dynamic-section';

        // Titulo: extraer del nombre de archivo sin numero ni extension
        const titulo = archivo
            .replace(/^\d+\.\s*/, '')
            .replace(/\.txt$/i, '');

        const h2 = document.createElement('h2');
        h2.className = 'section-title';
        h2.textContent = titulo;
        section.appendChild(h2);

        const content = document.createElement('div');
        content.className = 'text-content';

        // Respetar saltos de linea del texto original
        text.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) {
                const spacer = document.createElement('div');
                spacer.style.height = '1em';
                content.appendChild(spacer);
                return;
            }
            const p = document.createElement('p');
            p.textContent = trimmed;
            content.appendChild(p);
        });

        section.appendChild(content);
        main.insertBefore(section, principalSection);
    }
}

// ===== YOUTUBE EMBED HELPER =====
function getYouTubeEmbedUrl(str) {
    // Ya es URL de embed
    if (/^https?:\/\/(www\.)?youtube\.com\/embed\//.test(str)) return str;
    // URL estándar: youtube.com/watch?v=ID
    let m = str.match(/(?:youtube\.com\/watch\?v=)([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    // URL corta: youtu.be/ID
    m = str.match(/(?:youtu\.be\/)([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    return null;
}

// ===== RENDERIZAR ELEMENTO PRINCIPAL (VIDEO/IMAGEN/YOUTUBE) =====
function renderPrincipal() {
    const section = document.getElementById('principal-section');
    const container = document.getElementById('principal-content');
    const principalFiles = (currentProject.principal || []).filter(Boolean);

    if (principalFiles.length === 0) {
        section.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    let renderedCount = 0;

    principalFiles.forEach(file => {
        const youtubeUrl = getYouTubeEmbedUrl(file);

        if (youtubeUrl) {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-responsive';
            const iframe = document.createElement('iframe');
            iframe.src = youtubeUrl;
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.title = getFullProjectTitle(currentProject);
            wrapper.appendChild(iframe);
            container.appendChild(wrapper);
            renderedCount++;
        } else if (file.match(/\.(mp4|webm|ogg)$/i)) {
            const path = assetUrl(`data/projects/${currentProject.slug}/${file}`);
            const video = document.createElement('video');
            video.src = path;
            video.controls = true;
            video.autoplay = false;
            container.appendChild(video);
            renderedCount++;
        } else if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const path = assetUrl(`data/projects/${currentProject.slug}/${file}`);
            const img = document.createElement('img');
            img.src = path;
            img.alt = getFullProjectTitle(currentProject);
            container.appendChild(img);
            renderedCount++;
        }
    });

    if (renderedCount === 0) {
        section.style.display = 'none';
    } else {
        section.style.display = '';
    }
}

// ===== RENDERIZAR SECCION DE TEXTO (reutilizable para texto1 y texto2) =====
function renderTextSection(sectionId, contentId, textos) {
    const section = document.getElementById(sectionId);
    const container = document.getElementById(contentId);

    if (!textos || textos.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    textos.forEach(texto => {
        const p = document.createElement('p');
        p.innerHTML = texto;
        container.appendChild(p);
    });
}

// ===== RENDERIZAR AUDIOS =====
function renderAudios() {
    const section = document.getElementById('audio-section');
    const container = document.getElementById('audio-list');

    if (!currentProject.audio || currentProject.audio.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    // Construir playlist una vez
    const playlist = currentProject.audio.map(f => ({
        file: f,
        title: f.replace(/\.(wav|mp3)$/i, ''),
        project: getFullProjectTitle(currentProject)
    }));

    currentProject.audio.forEach((audioFile, index) => {
        // Boton real: accesible por teclado (tab + enter)
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'audio-item';

        const icon = document.createElement('span');
        icon.className = 'audio-icon';
        icon.textContent = '▶';

        const name = document.createElement('span');
        name.className = 'audio-name';
        name.textContent = audioFile.replace(/\.(wav|mp3)$/i, '');

        item.appendChild(icon);
        item.appendChild(name);
        item.addEventListener('click', () => {
            DSM_Player.loadPlaylist(playlist, currentProject.slug, index);
        });

        container.appendChild(item);
    });
}

// ===== RENDERIZAR GALERIA =====
function renderGaleria() {
    const section = document.getElementById('galeria-section');
    const container = document.getElementById('galeria-content');

    if (!currentProject.galeria || currentProject.galeria.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    currentProject.galeria.forEach(imageName => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        let imagePath = assetUrl(`data/projects/${currentProject.slug}/${imageName}`);

        // Si no tiene extension, probar con .jpg por defecto
        if (!imageName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            imagePath += '.jpg';
        }

        img.src = imagePath;
        img.alt = imageName;
        img.loading = 'lazy';
        img.onerror = function () {
            if (this.src.endsWith('.jpg')) {
                this.src = this.src.slice(0, -4) + '.png';
            } else {
                this.style.display = 'none';
            }
        };

        item.appendChild(img);
        container.appendChild(item);
    });
}

// ===== RENDERIZAR CREDITOS =====
function renderCreditos() {
    const section = document.getElementById('creditos-section');
    const container = document.getElementById('creditos-content');

    const creditos = loc(currentProject, 'creditos');
    if (!creditos || creditos.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    creditos.forEach(credito => {
        const p = document.createElement('p');
        p.textContent = credito;
        container.appendChild(p);
    });
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
        if (currentView !== 'project') return;
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
