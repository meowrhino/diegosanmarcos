// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentProject = null;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    await loadProjectFromURL();
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

// ===== CARGAR PROYECTO DESDE URL =====
async function loadProjectFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectSlug = urlParams.get('proyecto');

    if (!projectSlug) {
        console.error('No se especificó un proyecto en la URL');
        return;
    }

    // Buscar proyecto en los datos
    currentProject = appData.projects.find(p => p.slug === projectSlug);

    if (!currentProject) {
        console.error('Proyecto no encontrado:', projectSlug);
        return;
    }

    // Configurar fondo según tipo
    setupBackground();

    // Renderizar proyecto
    await renderProject();
}

// ===== CONFIGURAR FONDO =====
function setupBackground() {
    const bgContainer = document.getElementById('background-container');

    // Determinar si el proyecto es de portfolio o personal
    const isPortfolio = appData.categories.portfolio.includes(currentProject.tipo);

    if (isPortfolio) {
        bgContainer.classList.add('portfolio');
    } else {
        bgContainer.classList.add('personal');
    }
}

// ===== RENDERIZAR PROYECTO =====
async function renderProject() {
    // Actualizar título de la página
    document.getElementById('page-title').textContent = `${currentProject.titulo} - diego san marcos`;

    // Renderizar titulo dentro del main
    renderTitle();

    // Si tiene archivos de texto externos, cargarlos
    if (currentProject.archivosTexto && currentProject.archivosTexto.length > 0) {
        await renderArchivosTexto();
    }

    // Renderizar cada sección
    renderPrincipal();
    renderTexto1();
    renderAudios();
    renderTexto2();
    renderGaleria();
    renderCreditos();
}

// ===== RENDERIZAR TITULO =====
function renderTitle() {
    const main = document.querySelector('.project-main');
    const titleSection = document.createElement('div');
    titleSection.className = 'project-title-section project-section';
    const h1 = document.createElement('h1');
    h1.textContent = currentProject.titulo;
    titleSection.appendChild(h1);
    main.insertBefore(titleSection, main.firstChild);
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

            // Titulo del texto: extraer del nombre de archivo sin numero ni extension
            const titulo = archivo
                .replace(/^\d+\.\s*/, '')
                .replace(/\.txt$/i, '');

            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.textContent = titulo;
            section.appendChild(h2);

            const content = document.createElement('div');
            content.className = 'text-content';

            // Dividir por lineas para respetar saltos del texto original
            const lines = text.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) {
                    // Linea vacia = espaciado entre bloques
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
            // Silently skip files that can't be loaded
        }
    }
}

// ===== RENDERIZAR ELEMENTO PRINCIPAL =====
function renderPrincipal() {
    const section = document.getElementById('principal-section');
    const container = document.getElementById('principal-content');

    if (!currentProject.principal || currentProject.principal.length === 0 || currentProject.principal[0] === '') {
        section.style.display = 'none';
        return;
    }

    const principalFile = currentProject.principal[0];
    const principalPath = `./data/projects/${currentProject.slug}/${principalFile}`;

    // Determinar si es video o imagen
    if (principalFile.match(/\.(mp4|webm|ogg)$/i)) {
        const video = document.createElement('video');
        video.src = principalPath;
        video.controls = true;
        video.autoplay = false;
        container.appendChild(video);
    } else if (principalFile.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const img = document.createElement('img');
        img.src = principalPath;
        img.alt = currentProject.titulo;
        container.appendChild(img);
    }
}

// ===== RENDERIZAR TEXTO 1 =====
function renderTexto1() {
    const section = document.getElementById('texto1-section');
    const container = document.getElementById('texto1-content');

    if (!currentProject.texto1 || currentProject.texto1.length === 0) {
        section.style.display = 'none';
        return;
    }

    currentProject.texto1.forEach(texto => {
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

        // Event listener para reproducir usando DSM_Player
        item.addEventListener('click', () => {
            const playlist = currentProject.audio.map(f => ({
                file: f,
                title: f.replace(/\.(wav|mp3)$/i, ''),
                project: currentProject.titulo
            }));
            DSM_Player.loadPlaylist(playlist, currentProject.slug, index);
        });

        container.appendChild(item);
    });
}

// ===== RENDERIZAR TEXTO 2 =====
function renderTexto2() {
    const section = document.getElementById('texto2-section');
    const container = document.getElementById('texto2-content');

    if (!currentProject.texto2 || currentProject.texto2.length === 0) {
        section.style.display = 'none';
        return;
    }

    currentProject.texto2.forEach(texto => {
        const p = document.createElement('p');
        p.innerHTML = texto;
        container.appendChild(p);
    });
}

// ===== RENDERIZAR GALERÍA =====
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

        // Intentar diferentes extensiones
        let imagePath = `./data/projects/${currentProject.slug}/${imageName}`;

        // Si no tiene extensión, probar con .jpg por defecto
        if (!imageName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            imagePath += '.jpg';
        }

        img.src = imagePath;
        img.alt = imageName;
        img.onerror = () => {
            // Si falla con .jpg, probar con .png
            if (imagePath.endsWith('.jpg')) {
                img.src = imagePath.replace('.jpg', '.png');
            }
        };

        item.appendChild(img);
        container.appendChild(item);
    });
}

// ===== RENDERIZAR CRÉDITOS =====
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
