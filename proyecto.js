// ===== ESTADO GLOBAL =====
let appData = null;
let currentProject = null;
const VALID_MODES = new Set(['portfolio', 'personal']);

function getModeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('modo') || params.get('mode');
    return VALID_MODES.has(mode) ? mode : null;
}

function getInferredMode() {
    if (!appData || !currentProject) return 'portfolio';
    const isPortfolio = appData.categories.portfolio.includes(currentProject.tipo);
    return isPortfolio ? 'portfolio' : 'personal';
}

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    if (!appData) return;
    await loadProjectFromURL();
});

// ===== CARGA DE DATOS =====
async function loadData() {
    try {
        const response = await fetch('./data/data.json');
        if (!response.ok) {
            console.error('Error cargando datos: respuesta no ok');
            return;
        }
        appData = await response.json();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== CARGAR PROYECTO DESDE URL =====
async function loadProjectFromURL() {
    const projectSlug = new URLSearchParams(window.location.search).get('proyecto');

    if (!projectSlug) {
        console.error('No se especifico un proyecto en la URL');
        return;
    }

    currentProject = appData.projects.find(p => p.slug === projectSlug);

    if (!currentProject) {
        console.error('Proyecto no encontrado:', projectSlug);
        return;
    }

    setupBackground();
    await renderProject();
    setupClickOutsideBack();
}

// ===== CONFIGURAR FONDO Y FRAME =====
function setupBackground() {
    const bgContainer = document.getElementById('background-container');
    const mode = getInferredMode();

    // Fondo dinamico desde data.json
    const bgFile = appData.backgrounds && appData.backgrounds[mode];
    if (bgFile) {
        bgContainer.style.backgroundImage = `url('./data/backgrounds/${bgFile}')`;
    }

    // Frame 9-slice desde data.json
    const frameFile = appData.frames && appData.frames[mode];
    if (frameFile) {
        const main = document.querySelector('.project-main');
        main.style.borderImage = `url('./data/9slice/${frameFile}') 16 fill / 16px / 0 stretch`;
    }

    // Clase de tipo en body para estilos especificos (ej: tipo-textos)
    document.body.classList.add(`tipo-${currentProject.tipo}`);
}

// ===== RENDERIZAR PROYECTO =====
async function renderProject() {
    document.getElementById('page-title').textContent = `${currentProject.titulo} - diego san marcos`;

    renderTitle();

    if (currentProject.archivosTexto && currentProject.archivosTexto.length > 0) {
        await renderArchivosTexto();
    }

    renderPrincipal();
    renderTextSection('texto1-section', 'texto1-content', currentProject.texto1);
    renderAudios();
    renderTextSection('texto2-section', 'texto2-content', currentProject.texto2);
    renderGaleria();
    renderCreditos();
}

// ===== RENDERIZAR TITULO =====
function renderTitle() {
    const main = document.querySelector('.project-main');
    const section = document.createElement('div');
    section.className = 'project-title-section project-section';

    const h1 = document.createElement('h1');
    h1.textContent = currentProject.titulo;
    section.appendChild(h1);

    main.insertBefore(section, main.firstChild);
}

// ===== RENDERIZAR ARCHIVOS DE TEXTO EXTERNOS =====
async function renderArchivosTexto() {
    const main = document.querySelector('.project-main');
    const principalSection = document.getElementById('principal-section');

    for (const archivo of currentProject.archivosTexto) {
        const path = `./data/projects/${currentProject.slug}/${archivo}`;
        try {
            const response = await fetch(path);
            if (!response.ok) continue;
            const text = await response.text();

            const section = document.createElement('section');
            section.className = 'project-section';

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
        } catch (e) {
            // Skip archivos que no se pueden cargar
        }
    }
}

// ===== RENDERIZAR ELEMENTO PRINCIPAL (VIDEO/IMAGEN) =====
function renderPrincipal() {
    const section = document.getElementById('principal-section');
    const container = document.getElementById('principal-content');

    if (!currentProject.principal || !currentProject.principal.length || !currentProject.principal[0]) {
        section.style.display = 'none';
        return;
    }

    const file = currentProject.principal[0];
    const path = `./data/projects/${currentProject.slug}/${file}`;

    if (file.match(/\.(mp4|webm|ogg)$/i)) {
        const video = document.createElement('video');
        video.src = path;
        video.controls = true;
        video.autoplay = false;
        container.appendChild(video);
    } else if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const img = document.createElement('img');
        img.src = path;
        img.alt = currentProject.titulo;
        container.appendChild(img);
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

    // Construir playlist una vez
    const playlist = currentProject.audio.map(f => ({
        file: f,
        title: f.replace(/\.(wav|mp3)$/i, ''),
        project: currentProject.titulo
    }));

    currentProject.audio.forEach((audioFile, index) => {
        const item = document.createElement('div');
        item.className = 'audio-item';

        const icon = document.createElement('span');
        icon.className = 'audio-icon';
        icon.textContent = '\u25B6';

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

    currentProject.galeria.forEach(imageName => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        let imagePath = `./data/projects/${currentProject.slug}/${imageName}`;

        // Si no tiene extension, probar con .jpg por defecto
        if (!imageName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            imagePath += '.jpg';
        }

        img.src = imagePath;
        img.alt = imageName;
        img.loading = 'lazy';
        img.onerror = () => {
            // Fallback: probar .png si .jpg fallo
            if (imagePath.endsWith('.jpg')) {
                img.src = imagePath.replace('.jpg', '.png');
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

    if (!currentProject.creditos || currentProject.creditos.length === 0) {
        section.style.display = 'none';
        return;
    }

    currentProject.creditos.forEach(credito => {
        const p = document.createElement('p');
        p.textContent = credito;
        container.appendChild(p);
    });
}

// ===== CLICK FUERA DEL MAIN PARA VOLVER =====
function setupClickOutsideBack() {
    document.addEventListener('click', (e) => {
        const main = document.querySelector('.project-main');
        const player = document.getElementById('audio-player');
        if (main && !main.contains(e.target) && (!player || !player.contains(e.target))) {
            const returnMode = getModeFromURL() || getInferredMode();
            window.location.href = `./index.html?modo=${returnMode}`;
        }
    });
}
