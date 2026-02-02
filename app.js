// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentMode = 'portfolio';

// Posibles tamanos de tile
const TILE_SIZES = ['1x1', '1x1', '1x1', '2x1', '2x1', '2x2'];

// Calcular columnas y tamaño de tile según el viewport
function calculateGrid() {
    const container = document.getElementById('projects-container');
    const style = getComputedStyle(container);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    const availableWidth = window.innerWidth - paddingLeft - paddingRight;
    const gap = 3;

    // Tamaño base de tile deseado (~120px) — calcular cuántas caben
    const desiredTileSize = 120;
    let cols = Math.floor((availableWidth + gap) / (desiredTileSize + gap));
    cols = Math.max(4, Math.min(cols, 10)); // entre 4 y 10 columnas

    // Calcular tamaño real del tile para que llene todo el ancho
    const tileSize = Math.floor((availableWidth - (cols - 1) * gap) / cols);

    // Aplicar como CSS custom properties
    container.style.setProperty('--grid-cols', cols);
    container.style.setProperty('--tile-size', tileSize + 'px');

    return cols;
}

// Seed random basado en string (para que el layout sea consistente por sesion)
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    };
}

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeUI();

    // Re-render on resize para adaptar columnas
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
        appData = await dataResponse.json();
        coloresData = await coloresResponse.json();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== INICIALIZACION DE UI =====
function initializeUI() {
    const bgContainer = document.getElementById('background-container');
    bgContainer.classList.add('portfolio');
    renderProjects();
}

// ===== RENDERIZADO DE PROYECTOS CON LAYOUT ALEATORIO =====
function renderProjects() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    const categories = appData.categories[currentMode] || [];
    const filteredProjects = appData.projects.filter(project =>
        categories.includes(project.tipo)
    );

    // Generar layout con posiciones aleatorias en un grid
    const cols = calculateGrid();
    const rand = seededRandom(currentMode + '_v3');
    const grid = []; // track ocupacion: grid[row][col] = true/false

    function ensureRows(n) {
        while (grid.length < n) grid.push(new Array(cols).fill(false));
    }

    function canPlace(r, c, w, h) {
        ensureRows(r + h);
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                if (c + dc >= cols || grid[r + dr][c + dc]) return false;
            }
        }
        return true;
    }

    function place(r, c, w, h) {
        ensureRows(r + h);
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                grid[r + dr][c + dc] = true;
            }
        }
    }

    function findSpot(w, h) {
        ensureRows(1);
        for (let r = 0; r < 50; r++) {
            ensureRows(r + h);
            for (let c = 0; c <= cols - w; c++) {
                if (canPlace(r, c, w, h)) return { r, c };
            }
        }
        return null;
    }

    // Preparar items: proyectos + huecos (switch se coloca aparte)
    const items = filteredProjects.map(p => ({ type: 'project', project: p }));

    // Anadir huecos aleatorios intercalados
    const numGaps = Math.floor(rand() * 3) + 2;
    for (let i = 0; i < numGaps; i++) {
        const pos = Math.floor(rand() * (items.length + 1));
        items.splice(pos, 0, { type: 'gap' });
    }

    // Asignar tamanos aleatorios (ajustar según columnas disponibles)
    const tileSizes = cols >= 7
        ? ['1x1', '1x1', '1x1', '2x1', '2x1', '2x2', '2x2', '3x1']
        : TILE_SIZES;

    items.forEach(item => {
        if (item.type === 'gap') {
            item.w = 1; item.h = 1;
        } else {
            const size = tileSizes[Math.floor(rand() * tileSizes.length)];
            const [w, h] = size.split('x').map(Number);
            item.w = w; item.h = h;
        }
    });

    // Colocar cada item en el grid
    items.forEach(item => {
        const spot = findSpot(item.w, item.h);
        if (!spot) return;
        place(spot.r, spot.c, item.w, item.h);
        item.row = spot.r + 1; // CSS grid es 1-indexed
        item.col = spot.c + 1;
    });

    // Renderizar proyectos y huecos
    items.forEach(item => {
        let el;
        if (item.type === 'project') {
            el = createProjectCard(item.project);
        } else {
            el = document.createElement('div');
            el.className = 'tile-gap';
        }

        el.style.gridRow = `${item.row} / span ${item.h}`;
        el.style.gridColumn = `${item.col} / span ${item.w}`;
        container.appendChild(el);
    });

    // Colocar switch: una fila despues del contenido, columna derecha
    const lastRow = grid.length + 1;
    const switchEl = createSwitchTile();
    switchEl.style.gridRow = `${lastRow}`;
    switchEl.style.gridColumn = `${cols}`;
    container.appendChild(switchEl);
}

// ===== CREACION DE TARJETA DE PROYECTO =====
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';

    // Color de fondo
    const colorName = appData.typeColors[project.tipo] || 'Gray';
    const colorHex = coloresData.colores[colorName] || '#808080';
    card.style.background = colorHex;

    const inner = document.createElement('div');
    inner.className = 'project-card-inner';

    // Icono
    const icon = document.createElement('img');
    icon.className = 'project-icon';
    icon.src = `./data/icons/${project.tipo}.png`;
    icon.alt = project.tipo;
    icon.onerror = () => { icon.style.display = 'none'; };

    // Titulo
    const title = document.createElement('span');
    title.className = 'project-title';
    title.textContent = project.titulo;

    inner.appendChild(icon);
    inner.appendChild(title);
    card.appendChild(inner);

    card.addEventListener('click', () => handleProjectClick(project));
    return card;
}

// ===== TILE DE SWITCH =====
function createSwitchTile() {
    const tile = document.createElement('button');
    tile.className = 'switch-tile';
    const nextMode = currentMode === 'portfolio' ? 'personal' : 'portfolio';

    const icon = document.createElement('img');
    icon.src = './data/icons/switch.svg';
    icon.alt = 'switch';
    icon.className = 'switch-icon';

    const label = document.createElement('span');
    label.textContent = nextMode;

    tile.appendChild(icon);
    tile.appendChild(label);
    tile.addEventListener('click', () => switchMode(nextMode));
    return tile;
}

// ===== MANEJO DE CLICK EN PROYECTO =====
function handleProjectClick(project) {
    window.location.href = `./proyecto.html?proyecto=${project.slug}`;
}

// ===== CAMBIO DE MODO =====
function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    const bgContainer = document.getElementById('background-container');
    bgContainer.classList.remove('portfolio', 'personal');
    bgContainer.classList.add(mode);

    renderProjects();
}
