// ===== ESTADO GLOBAL =====
let appData = null;
let currentProject = null;
let currentMode = 'portfolio';
const VALID_MODES = new Set(['portfolio', 'personal']);

// ===== IDIOMA =====
let currentLangCode = 'ES';
let currentLang = 'es';

function normalizeLanguage(value) {
    return DSM_SHARED.normalizeLanguageCode(value);
}

function initializeLanguage() {
    const params = new URLSearchParams(window.location.search);
    currentLangCode =
        normalizeLanguage(params.get('lang')) ||
        normalizeLanguage(localStorage.getItem('dsm_lang')) ||
        'ES';
    currentLang = DSM_SHARED.languageCodeToHtml(currentLangCode);

    localStorage.setItem('dsm_lang', currentLangCode);
    params.set('lang', currentLangCode);
    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    history.replaceState(null, '', newUrl);
    document.documentElement.lang = currentLang;
}

function loc(obj, field) {
    return obj[field + '_' + currentLang] ?? obj[field + '_es'] ?? obj[field] ?? [];
}

function getProjectTitle(project) {
    return project.titulo ?? project.slug;
}

function getModeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('modo') || params.get('mode');
    return VALID_MODES.has(mode) ? mode : null;
}

function updateModeInURL(mode) {
    if (!VALID_MODES.has(mode)) return;
    const params = new URLSearchParams(window.location.search);
    params.set('modo', mode);
    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    history.replaceState(null, '', newUrl);
}

function getInferredMode() {
    if (!appData || !currentProject) return 'portfolio';
    const isPortfolio = appData.categories.portfolio.includes(currentProject.tipo);
    return isPortfolio ? 'portfolio' : 'personal';
}

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', async () => {
    initializeLanguage();
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

    currentMode = getModeFromURL() || getInferredMode();
    updateModeInURL(currentMode);
    setupBackground(currentMode);
    await renderProject();
    createMenuButton();
    setupClickOutsideBack();
}

// ===== CONFIGURAR FONDO Y FRAME =====
function setupBackground(mode) {
    const bgContainer = document.getElementById('background-container');

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

    DSM_SHARED.updateFavicon(mode);

    // Clase de tipo en body para estilos especificos (ej: tipo-textos)
    document.body.classList.add(`tipo-${currentProject.tipo}`);
}

// ===== RENDERIZAR PROYECTO =====
async function renderProject() {
    document.getElementById('page-title').textContent = `${getProjectTitle(currentProject)} - diego san marcos`;

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
    section.className = 'project-title-section project-section';

    const h1 = document.createElement('h1');
    h1.textContent = getProjectTitle(currentProject);
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
    const principalFiles = (currentProject.principal || []).filter(Boolean);

    if (principalFiles.length === 0) {
        section.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    let renderedCount = 0;

    principalFiles.forEach(file => {
        const path = `./data/projects/${currentProject.slug}/${file}`;

        if (file.match(/\.(mp4|webm|ogg)$/i)) {
            const video = document.createElement('video');
            video.src = path;
            video.controls = true;
            video.autoplay = false;
            container.appendChild(video);
            renderedCount++;
        } else if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const img = document.createElement('img');
            img.src = path;
            img.alt = getProjectTitle(currentProject);
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
        project: getProjectTitle(currentProject)
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

    const creditos = loc(currentProject, 'creditos');
    if (!creditos || creditos.length === 0) {
        section.style.display = 'none';
        return;
    }

    creditos.forEach(credito => {
        const p = document.createElement('p');
        p.textContent = credito;
        container.appendChild(p);
    });
}

// ===== MENU =====
const LANGUAGES = ['ES', 'EN', 'FR'];
const MENU_LABELS = {
    es: { trigger: 'menu', openPlayer: 'abrir reproductor', changeLang: 'cambiar idioma', back: 'volver', close: 'cerrar menu' },
    en: { trigger: 'menu', openPlayer: 'open player', changeLang: 'change language', back: 'back', close: 'close menu' },
    fr: { trigger: 'menu', openPlayer: 'ouvrir lecteur', changeLang: 'changer de langue', back: 'retour', close: 'fermer menu' }
};

function getMenuLabels() {
    return MENU_LABELS[currentLang] || MENU_LABELS.es;
}

function getNextLangCode() {
    const idx = LANGUAGES.indexOf(currentLangCode);
    return LANGUAGES[(idx + 1) % LANGUAGES.length];
}

function cycleLanguage() {
    const nextCode = getNextLangCode();
    currentLangCode = nextCode;
    currentLang = DSM_SHARED.languageCodeToHtml(nextCode);

    // Persistir (misma logica que app.js syncLanguageState / initializeLanguage)
    localStorage.setItem('dsm_lang', nextCode);
    document.documentElement.lang = currentLang;
    const params = new URLSearchParams(window.location.search);
    params.set('lang', nextCode);
    const query = params.toString();
    history.replaceState(null, '', `${window.location.pathname}?${query}`);
}

function createMenuButton() {
    const main = document.querySelector('.project-main');
    const btn = document.createElement('button');
    btn.className = 'menu-trigger';
    btn.textContent = getMenuLabels().trigger;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu();
    });
    main.appendChild(btn);
}

function openMenu() {
    // Evitar duplicados
    if (document.querySelector('.menu-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    const modal = document.createElement('div');
    modal.className = 'menu-modal';

    // Aplicar misma border-image que project-main
    const frameFile = appData.frames && appData.frames[currentMode];
    if (frameFile) {
        modal.style.borderImage = `url('./data/9slice/${frameFile}') 16 fill / 16px / 0 stretch`;
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'menu-items';
    modal.appendChild(itemsContainer);

    renderMenuContent(itemsContainer);

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

function renderMenuContent(container) {
    container.innerHTML = '';
    const labels = getMenuLabels();

    // 1. Abrir reproductor
    const playerBtn = document.createElement('button');
    playerBtn.className = 'menu-item';
    playerBtn.textContent = labels.openPlayer;
    playerBtn.addEventListener('click', () => {
        DSM_Player.show();
        closeMenu();
    });
    container.appendChild(playerBtn);

    // 2. Cambiar idioma
    const langBtn = document.createElement('button');
    langBtn.className = 'menu-item';
    langBtn.textContent = labels.changeLang;
    langBtn.addEventListener('click', () => {
        cycleLanguage();
        // Re-renderizar el contenido del menu con el nuevo idioma
        renderMenuContent(container);
        // Actualizar tambien el boton trigger debajo del contenido
        const trigger = document.querySelector('.menu-trigger');
        if (trigger) trigger.textContent = getMenuLabels().trigger;
    });
    container.appendChild(langBtn);

    // 3. Volver
    const backBtn = document.createElement('button');
    backBtn.className = 'menu-item';
    backBtn.textContent = labels.back;
    backBtn.addEventListener('click', () => {
        window.location.href = `./index.html?modo=${currentMode}&lang=${currentLangCode}`;
    });
    container.appendChild(backBtn);

    // 4. Cerrar menu
    const closeBtn = document.createElement('button');
    closeBtn.className = 'menu-item';
    closeBtn.textContent = labels.close;
    closeBtn.addEventListener('click', () => closeMenu());
    container.appendChild(closeBtn);
}

function closeMenu() {
    const overlay = document.querySelector('.menu-overlay');
    if (overlay) overlay.remove();
}

// ===== CLICK FUERA DEL MAIN PARA VOLVER =====
function setupClickOutsideBack() {
    document.addEventListener('click', (e) => {
        const main = document.querySelector('.project-main');
        const player = document.getElementById('audio-player');
        const menuOverlay = document.querySelector('.menu-overlay');
        if (menuOverlay) return; // Menu abierto — no navegar
        if (main && !main.contains(e.target) && (!player || !player.contains(e.target))) {
            window.location.href = `./index.html?modo=${currentMode}&lang=${currentLangCode}`;
        }
    });
}
