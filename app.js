// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentMode = 'portfolio';

// Posibles tamanos de tile [w, h] — basados en la celda cuadrada del grid
// Ponderacion: mas probabilidad de 1x1, menos de 2x2
const TILE_SIZES = [
    [1,1], [1,1], [1,1], [1,1], [1,1],
    [2,1], [2,1],
    [1,2], [1,2],
    [2,2]
];

// ===== INICIALIZACION ======
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
    const bgContainer = document.getElementById('background-container');
    bgContainer.classList.add('portfolio');
    renderProjects();
}

// ===== CALCULO DEL GRID =====
// Calcula dimensiones para tiles cuadrados perfectos que llenen el viewport
function calculateGrid() {
    const container = document.getElementById('projects-container');
    const gap = 3;
    const minPad = 16;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

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

    const categories = appData.categories[currentMode] || [];
    const filteredProjects = appData.projects.filter(p => categories.includes(p.tipo));
    const { cols, rows } = calculateGrid();

    // Grid de ocupacion (false = libre, true = ocupada)
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(false));

    // Reservar celda del switch: ultima fila, ultima columna
    grid[rows - 1][cols - 1] = true;

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
    const skipChance = Math.max(0.02, Math.min(0.12, 1 - (queue.length * 4 / totalCells)));

    // Recorrer celdas izq→der, arriba→abajo
    for (let r = 0; r < rows && queueIdx < queue.length; r++) {
        for (let c = 0; c < cols && queueIdx < queue.length; c++) {
            if (grid[r][c]) continue;

            // Random skip para crear huecos organicos
            if (Math.random() < skipChance) continue;

            // Elegir tamano aleatorio de los que caben
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
    card.addEventListener('click', () => {
        window.location.href = `./proyecto.html?proyecto=${project.slug}`;
    });

    return card;
}

// ===== TILE DE SWITCH =====
function createSwitchTile() {
    const nextMode = currentMode === 'portfolio' ? 'personal' : 'portfolio';
    const tile = document.createElement('button');
    tile.className = 'switch-tile';

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

// ===== CAMBIO DE MODO =====
function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    const bgContainer = document.getElementById('background-container');
    bgContainer.classList.remove('portfolio', 'personal');
    bgContainer.classList.add(mode);

    renderProjects();
}
