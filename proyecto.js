// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentProject = null;
let audioPlayer = {
    element: null,
    currentPlaylist: [],
    currentIndex: 0,
    currentProject: '',
    isPlaying: false
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    loadProjectFromURL();
    setupAudioPlayer();
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
        
        console.log('Datos cargados:', appData);
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== CARGAR PROYECTO DESDE URL =====
function loadProjectFromURL() {
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
    
    console.log('Proyecto cargado:', currentProject);
    
    // Configurar fondo según tipo
    setupBackground();
    
    // Renderizar proyecto
    renderProject();
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
function renderProject() {
    // Actualizar título de la página
    document.getElementById('page-title').textContent = `${currentProject.titulo} - diego san marcos`;
    document.getElementById('project-title').textContent = currentProject.titulo;
    
    // Renderizar cada sección
    renderPrincipal();
    renderTexto1();
    renderAudios();
    renderTexto2();
    renderGaleria();
    renderCreditos();
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
        p.innerHTML = texto; // Usar innerHTML para permitir HTML (como enlaces)
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
        icon.textContent = '🎵';
        
        const name = document.createElement('span');
        name.className = 'audio-name';
        name.textContent = audioFile.replace(/\.(wav|mp3)$/i, '');
        
        item.appendChild(icon);
        item.appendChild(name);
        
        // Event listener para reproducir
        item.addEventListener('click', () => {
            loadProjectAudio(currentProject, index);
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
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
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

// ===== REPRODUCTOR DE AUDIO =====

function setupAudioPlayer() {
    audioPlayer.element = document.getElementById('audio-element');
    
    // Event listeners
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('prev-btn').addEventListener('click', playPrevious);
    document.getElementById('next-btn').addEventListener('click', playNext);
    document.querySelector('.player-close').addEventListener('click', closePlayer);
    document.getElementById('progress-bar').addEventListener('input', seekAudio);
    document.getElementById('volume-bar').addEventListener('input', changeVolume);
    
    audioPlayer.element.addEventListener('timeupdate', updateProgress);
    audioPlayer.element.addEventListener('ended', playNext);
    audioPlayer.element.addEventListener('loadedmetadata', updateDuration);
}

function loadProjectAudio(project, startIndex = 0) {
    const player = document.getElementById('audio-player');
    
    // Preparar playlist
    audioPlayer.currentPlaylist = project.audio.map(audioFile => ({
        file: audioFile,
        title: audioFile.replace(/\.(wav|mp3)$/i, ''),
        project: project.titulo
    }));
    
    audioPlayer.currentIndex = startIndex;
    audioPlayer.currentProject = project.slug;
    
    // Cargar audio
    loadAudioTrack(startIndex);
    
    // Mostrar reproductor
    player.classList.remove('hidden');
    
    // Reproducir automáticamente
    setTimeout(() => {
        audioPlayer.element.play();
        audioPlayer.isPlaying = true;
        updatePlayButton();
    }, 100);
}

function loadAudioTrack(index) {
    if (index < 0 || index >= audioPlayer.currentPlaylist.length) return;
    
    const track = audioPlayer.currentPlaylist[index];
    audioPlayer.currentIndex = index;
    
    // Actualizar información
    document.querySelector('.track-title').textContent = track.title;
    document.querySelector('.track-project').textContent = track.project;
    
    // Cargar audio
    const audioPath = `./data/projects/${audioPlayer.currentProject}/${track.file}`;
    audioPlayer.element.src = audioPath;
}

function togglePlay() {
    if (audioPlayer.isPlaying) {
        audioPlayer.element.pause();
        audioPlayer.isPlaying = false;
    } else {
        audioPlayer.element.play();
        audioPlayer.isPlaying = true;
    }
    updatePlayButton();
}

function updatePlayButton() {
    const playBtn = document.getElementById('play-btn');
    playBtn.textContent = audioPlayer.isPlaying ? '⏸' : '▶';
}

function playPrevious() {
    let newIndex = audioPlayer.currentIndex - 1;
    if (newIndex < 0) {
        newIndex = audioPlayer.currentPlaylist.length - 1;
    }
    loadAudioTrack(newIndex);
    if (audioPlayer.isPlaying) {
        audioPlayer.element.play();
    }
}

function playNext() {
    let newIndex = audioPlayer.currentIndex + 1;
    if (newIndex >= audioPlayer.currentPlaylist.length) {
        newIndex = 0;
    }
    loadAudioTrack(newIndex);
    if (audioPlayer.isPlaying) {
        audioPlayer.element.play();
    }
}

function closePlayer() {
    const player = document.getElementById('audio-player');
    audioPlayer.element.pause();
    audioPlayer.isPlaying = false;
    player.classList.add('hidden');
    updatePlayButton();
}

function seekAudio(event) {
    const seekTime = (event.target.value / 100) * audioPlayer.element.duration;
    audioPlayer.element.currentTime = seekTime;
}

function changeVolume(event) {
    audioPlayer.element.volume = event.target.value / 100;
}

function updateProgress() {
    if (!audioPlayer.element.duration) return;
    
    const progress = (audioPlayer.element.currentTime / audioPlayer.element.duration) * 100;
    document.getElementById('progress-bar').value = progress;
    
    document.querySelector('.time-current').textContent = formatTime(audioPlayer.element.currentTime);
}

function updateDuration() {
    document.querySelector('.time-total').textContent = formatTime(audioPlayer.element.duration);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
