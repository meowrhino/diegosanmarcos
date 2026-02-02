// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentMode = 'portfolio';

// Posibles tamanos de tile [w, h] — basados en la celda cuadrada del grid
const TILE_SIZES = [
    [1,1], [1,1], [1,1], [1,1], [1,1],
    [2,1], [2,1],
    [1,2], [1,2],
    [2,2]
];

// Calcular grid con tiles cuadrados perfectos
function calculateGrid() {
    const container = document.getElementById('projects-container');
    const gap = 3;
    const minPad = 16; // padding minimo en px

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // Calcular cols y tileSize basandose en ancho (deseo ~120px)
    const desired = 120;
    let cols = Math.floor((viewW - 2 * minPad + gap) / (desired + gap));
    cols = Math.max(4, Math.min(cols, 12));
    const tileSize = Math.floor((viewW - 2 * minPad - (cols - 1) * gap) / cols);

    // Calcular rows que caben en el alto
    let rows = Math.floor((viewH - 2 * minPad + gap) / (tileSize + gap));
    rows = Math.max(3, rows);

    // Espacio real que ocupa el grid
    const gridW = cols * tileSize + (cols - 1) * gap;
    const gridH = rows * tileSize + (rows - 1) * gap;

    // Padding para centrar: minimo de minPad, el resto se reparte
    const padX = Math.floor((viewW - gridW) / 2);
    const padY = Math.floor((viewH - gridH) / 2);

    // Aplicar padding calculado y CSS custom properties
    container.style.padding = `${Math.max(minPad, padY)}px ${Math.max(minPad, padX)}px`;
    container.style.setProperty('--grid-cols', cols);
    container.style.setProperty('--grid-rows', rows);
    container.style.setProperty('--tile-size', tileSize + 'px');

    return { cols, rows, tileSize };
}

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
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

// ===== RENDERIZADO DE PROYECTOS =====
function renderProjects() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    const categories = appData.categories[currentMode] || [];
    const filteredProjects = appData.projects.filter(project =>
        categories.includes(project.tipo)
    );

    const { cols, rows } = calculateGrid();

    // Grid de ocupacion
    const grid = [];
    for (let r = 0; r < rows; r++) {
        grid.push(new Array(cols).fill(false));
    }

    // Reservar celda del switch: ultima fila, ultima columna
    grid[rows - 1][cols - 1] = true;

    // Helpers
    function canPlace(r, c, w, h) {
        if (r + h > rows || c + w > cols) return false;
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                if (grid[r + dr][c + dc]) return false;
            }
        }
        return true;
    }

    function markPlaced(r, c, w, h) {
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                grid[r + dr][c + dc] = true;
            }
        }
    }

    // Cola de proyectos a colocar (en orden de data.json)
    const queue = [...filteredProjects];
    let queueIdx = 0;
    const placed = [];

    // Probabilidad de "skip" (dejar hueco) — baja para que no quede tan vacio
    const totalCells = cols * rows - 1; // -1 por el switch
    const skipChance = Math.max(0.02, Math.min(0.12, 1 - (queue.length * 4 / totalCells)));

    // Recorrer celdas en orden: izq->der, arriba->abajo
    for (let r = 0; r < rows && queueIdx < queue.length; r++) {
        for (let c = 0; c < cols && queueIdx < queue.length; c++) {
            if (grid[r][c]) continue; // celda ya ocupada

            // Decidir: ¿skip (hueco) o colocar proyecto?
            if (Math.random() < skipChance) {
                continue; // dejar hueco, pasar a la siguiente celda
            }

            // Elegir tamaño aleatorio de los que caben
            const sizePool = TILE_SIZES.filter(([w, h]) => canPlace(r, c, w, h));
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

    // Si quedan proyectos sin colocar, buscar huecos libres como 1x1
    for (; queueIdx < queue.length; queueIdx++) {
        let found = false;
        for (let r = 0; r < rows && !found; r++) {
            for (let c = 0; c < cols && !found; c++) {
                if (!grid[r][c]) {
                    grid[r][c] = true;
                    placed.push({
                        project: queue[queueIdx],
                        row: r + 1,
                        col: c + 1,
                        w: 1, h: 1
                    });
                    found = true;
                }
            }
        }
    }

    // Renderizar con animacion escalonada
    placed.forEach((item, i) => {
        const el = createProjectCard(item.project);
        el.style.gridRow = `${item.row} / span ${item.h}`;
        el.style.gridColumn = `${item.col} / span ${item.w}`;
        el.style.animationDelay = `${i * 0.04}s`;
        container.appendChild(el);
    });

    // Switch en ultima fila, ultima columna
    const switchEl = createSwitchTile();
    switchEl.style.gridRow = `${rows}`;
    switchEl.style.gridColumn = `${cols}`;
    switchEl.style.animationDelay = `${placed.length * 0.04}s`;
    container.appendChild(switchEl);
}

// ===== CREACION DE TARJETA DE PROYECTO =====
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';

    const colorName = appData.typeColors[project.tipo] || 'Gray';
    const colorHex = coloresData.colores[colorName] || '#808080';
    card.style.background = colorHex;

    const inner = document.createElement('div');
    inner.className = 'project-card-inner';

    const icon = document.createElement('img');
    icon.className = 'project-icon';
    icon.src = `./data/icons/${project.tipo}.png`;
    icon.alt = project.tipo;
    icon.onerror = () => { icon.style.display = 'none'; };

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
