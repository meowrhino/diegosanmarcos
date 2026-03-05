// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentMode = 'portfolio';
const VALID_MODES = DSM_SHARED.VALID_MODES;

// ===== IDIOMA (centralizado en shared.js) =====
DSM_SHARED.initLang();

function getProjectTitle(project) {
    return project.titulo_home ?? project.titulo_proyecto ?? project.slug;
}

const SITE_TITLE = DSM_SHARED.SITE_TITLE;
const { setMetaContent, setCanonicalHref } = DSM_SHARED;

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
    const image = bgFile
        ? new URL(`./data/backgrounds/${bgFile}`, window.location.href).toString()
        : new URL('./data/icons/LOGO URL.png', window.location.href).toString();

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

const normalizeMode = DSM_SHARED.normalizeMode;
const updateModeInURL = DSM_SHARED.updateModeInURL;

function getInitialModeFromURL() {
    const params = new URLSearchParams(window.location.search);
    return normalizeMode(params.get('modo')) || normalizeMode(params.get('mode')) || 'portfolio';
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

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    if (!appData || !coloresData) return; // Datos no cargados
    initializeUI();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => renderProjects(), 200);
    });
});

// ===== CARGA DE DATOS =====
async function loadData() {
    try {
        const [dataResponse, coloresResponse] = await Promise.all([
            fetch('./data/data.json'),
            fetch('./data/colores.json')
        ]);

        if (!dataResponse.ok || !coloresResponse.ok) {
            console.error('Error cargando datos: respuesta no ok');
            return;
        }

        appData = await dataResponse.json();
        coloresData = await coloresResponse.json();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== INICIALIZACION DE UI =====
function initializeUI() {
    currentMode = getInitialModeFromURL();
    DSM_SHARED.syncLang();
    setBackground(currentMode);
    DSM_SHARED.updateFavicon();
    updateHomeSEO();
    renderProjects();
    loadBgmIfNeeded();
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
function setBackground(mode) {
    const bgContainer = document.getElementById('background-container');
    const modeData = appData.modes && appData.modes[mode];
    if (modeData && modeData.background) {
        bgContainer.style.backgroundImage = `url('./data/backgrounds/${modeData.background}')`;
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
        return `./data/projects/${project.slug}/${principalImages[0]}`;
    }

    // Luego en galeria
    const galeriaImages = (project.galeria || []).filter(f => f && imageExts.test(f));
    if (galeriaImages.length > 0) {
        return `./data/projects/${project.slug}/${galeriaImages[0]}`;
    }

    return null;
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';

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
    icon.src = `./data/icons/${project.tipo}.${iconExt}`;
    icon.alt = project.tipo;
    icon.onerror = () => { icon.style.display = 'none'; };

    const title = document.createElement('span');
    title.className = 'project-title';
    title.textContent = getProjectTitle(project);

    inner.appendChild(icon);
    inner.appendChild(title);
    card.appendChild(inner);
    card.addEventListener('click', () => {
        const slug = encodeURIComponent(project.slug);
        DSM_SHARED.navigateTo(`./proyecto.html?proyecto=${slug}&modo=${currentMode}&lang=${DSM_SHARED.langCode()}`);
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
    icon.src = `./data/icons/${appData.modes[currentMode].switchIcon}`;
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

// ===== MENU (HOME) =====
const HOME_MENU_LABELS = {
    ES: { trigger: 'menu', openPlayer: 'abrir reproductor', changeLang: 'cambiar idioma', close: 'cerrar menu' },
    EN: { trigger: 'menu', openPlayer: 'open player', changeLang: 'change language', close: 'close menu' },
    FR: { trigger: 'menu', openPlayer: 'ouvrir lecteur', changeLang: 'changer de langue', close: 'fermer menu' }
};

function getHomeMenuLabels() {
    return HOME_MENU_LABELS[DSM_SHARED.langCode()] || HOME_MENU_LABELS.ES;
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
    label.textContent = getHomeMenuLabels().trigger;

    inner.appendChild(label);
    tile.appendChild(inner);
    tile.addEventListener('click', () => openHomeMenu());
    return tile;
}

function openHomeMenu() {
    // Evitar duplicados
    if (document.querySelector('.menu-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    const modal = document.createElement('div');
    modal.className = 'menu-modal';

    // Aplicar misma border-image que el modo actual
    const frameFile = appData.modes && appData.modes[currentMode] && appData.modes[currentMode].frame;
    if (frameFile) {
        modal.style.borderImage = `url('./data/9slice/${frameFile}') 16 fill / 16px / 0 stretch`;
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'menu-items';
    modal.appendChild(itemsContainer);

    renderHomeMenuContent(itemsContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Click fuera del modal = cerrar
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            e.stopPropagation();
            closeHomeMenu();
        }
    });

    modal.addEventListener('click', (e) => e.stopPropagation());
}

function renderHomeMenuContent(container) {
    container.innerHTML = '';
    const labels = getHomeMenuLabels();

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
        closeHomeMenu();
    });
    container.appendChild(playerBtn);

    // 2. Cambiar idioma
    const langBtn = document.createElement('button');
    langBtn.className = 'menu-item';
    langBtn.textContent = labels.changeLang;
    langBtn.addEventListener('click', () => {
        DSM_SHARED.cycleLang();
        // Re-renderizar el grid de la home (tiles con titulos en el nuevo idioma)
        renderProjects();
        // Re-renderizar el contenido del menu con el nuevo idioma
        renderHomeMenuContent(container);
    });
    container.appendChild(langBtn);

    // 3. Cerrar menu (sin "volver" porque ya estamos en la home)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'menu-item';
    closeBtn.textContent = labels.close;
    closeBtn.addEventListener('click', () => closeHomeMenu());
    container.appendChild(closeBtn);
}

function closeHomeMenu() {
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
    setBackground(mode);
    DSM_SHARED.updateFavicon();
    renderProjects();
}
