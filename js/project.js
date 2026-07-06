// ===== VISTA: PROYECTO =====
import { state } from './state.js';
import { loc, getFullProjectTitle } from './helpers.js';
import { renderVersion, getModeFromURL, getInferredMode } from './router.js';

const SITE_TITLE = DSM_SHARED.SITE_TITLE;
const { setMetaContent, setCanonicalHref, assetUrl } = DSM_SHARED;

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

function getProjectSeoDescription(project) {
    return DSM_SEO.getProjectSeoDescription(project, DSM_SHARED.lang());
}

function getProjectSeoImagePath(project) {
    return DSM_SEO.getProjectSeoImagePath(project);
}

function updateProjectSEO() {
    if (!state.currentProject) return;

    const projectTitle = getFullProjectTitle(state.currentProject);
    const description = getProjectSeoDescription(state.currentProject);
    const canonical = assetUrl(`p/${encodeURIComponent(state.currentProject.slug)}/`);
    const image = assetUrl(getProjectSeoImagePath(state.currentProject));

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
            genre: state.currentProject.tipo,
            author: {
                '@type': 'Person',
                name: 'Diego San Marcos'
            }
        });
    }
}

async function enterProjectView(project) {
    state.currentView = 'project';
    state.currentProject = project;
    state.currentMode = getModeFromURL() || getInferredMode();
    showView('project');
    setupProjectBackground(state.currentMode);
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
    const modeData = state.appData.modes && state.appData.modes[mode];
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
    document.body.classList.add(`tipo-${state.currentProject.tipo}`);
}

// ===== RENDERIZAR PROYECTO =====
async function renderProject() {
    const myVersion = renderVersion.current;

    updateProjectSEO();

    renderTitle();

    if (state.currentProject.archivosTexto && state.currentProject.archivosTexto.length > 0) {
        await renderArchivosTexto();
        // Render obsoleto: otra navegacion se disparo durante el fetch de textos
        if (myVersion !== renderVersion.current) return;
    }

    renderPrincipal();
    renderTextSection('texto1-section', 'texto1-content', loc(state.currentProject, 'texto1'));
    renderAudios();
    renderTextSection('texto2-section', 'texto2-content', loc(state.currentProject, 'texto2'));
    renderGaleria();
    renderCreditos();
}

// ===== RENDERIZAR TITULO =====
function renderTitle() {
    const main = document.querySelector('.project-main');
    const section = document.createElement('div');
    section.className = 'project-title-section project-section dsm-dynamic-section';

    const h1 = document.createElement('h1');
    h1.textContent = getFullProjectTitle(state.currentProject);
    section.appendChild(h1);

    main.insertBefore(section, main.firstChild);
}

// ===== RENDERIZAR ARCHIVOS DE TEXTO EXTERNOS =====
async function renderArchivosTexto() {
    const myVersion = renderVersion.current;
    const main = document.querySelector('.project-main');
    const principalSection = document.getElementById('principal-section');

    // Fetch en paralelo; el orden lo garantiza el array de resultados
    const cargas = await Promise.all(state.currentProject.archivosTexto.map(async (archivo) => {
        try {
            const response = await fetch(assetUrl(`data/projects/${state.currentProject.slug}/${archivo}`));
            if (!response.ok) return null;
            return { archivo, text: await response.text() };
        } catch (e) {
            return null; // Skip archivos que no se pueden cargar
        }
    }));

    // Render obsoleto: otra navegacion se disparo mientras cargaban los textos
    if (myVersion !== renderVersion.current) return;

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
    const principalFiles = (state.currentProject.principal || []).filter(Boolean);

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
            iframe.title = getFullProjectTitle(state.currentProject);
            wrapper.appendChild(iframe);
            container.appendChild(wrapper);
            renderedCount++;
        } else if (file.match(/\.(mp4|webm|ogg)$/i)) {
            const path = assetUrl(`data/projects/${state.currentProject.slug}/${file}`);
            const video = document.createElement('video');
            video.src = path;
            video.controls = true;
            video.autoplay = false;
            container.appendChild(video);
            renderedCount++;
        } else if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const path = assetUrl(`data/projects/${state.currentProject.slug}/${file}`);
            const img = document.createElement('img');
            img.src = path;
            img.alt = getFullProjectTitle(state.currentProject);
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

    if (!state.currentProject.audio || state.currentProject.audio.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    // Construir playlist una vez
    const playlist = state.currentProject.audio.map(f => ({
        file: f,
        title: f.replace(/\.(wav|mp3)$/i, ''),
        project: getFullProjectTitle(state.currentProject)
    }));

    state.currentProject.audio.forEach((audioFile, index) => {
        // Boton real: accesible por teclado (tab + enter)
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'audio-item';
        item.setAttribute('aria-label', audioFile.replace(/\.(wav|mp3)$/i, ''));

        const icon = document.createElement('span');
        icon.className = 'audio-icon';
        icon.textContent = '▶';

        const name = document.createElement('span');
        name.className = 'audio-name';
        name.textContent = audioFile.replace(/\.(wav|mp3)$/i, '');

        item.appendChild(icon);
        item.appendChild(name);
        item.addEventListener('click', () => {
            DSM_Player.loadPlaylist(playlist, state.currentProject.slug, index);
        });

        container.appendChild(item);
    });
}

// ===== RENDERIZAR GALERIA =====
function renderGaleria() {
    const section = document.getElementById('galeria-section');
    const container = document.getElementById('galeria-content');

    if (!state.currentProject.galeria || state.currentProject.galeria.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    state.currentProject.galeria.forEach(imageName => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        let imagePath = assetUrl(`data/projects/${state.currentProject.slug}/${imageName}`);

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

    const creditos = loc(state.currentProject, 'creditos');
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

export {
    showView,
    resetProjectDynamicContent,
    enterProjectView,
    setupProjectBackground,
    renderProject,
    renderTitle,
    renderArchivosTexto,
    renderPrincipal,
    renderTextSection,
    renderAudios,
    renderGaleria,
    renderCreditos,
    updateProjectSEO,
};
