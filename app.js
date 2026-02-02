// ===== ESTADO GLOBAL =====
let appData = null;
let coloresData = null;
let currentMode = 'portfolio'; // 'portfolio' o 'personal'
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
    initializeUI();
    setupEventListeners();
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
        console.log('Colores cargados:', coloresData);
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== INICIALIZACIÓN DE UI =====
function initializeUI() {
    // Configurar fondo inicial
    const bgContainer = document.getElementById('background-container');
    bgContainer.classList.add('portfolio');
    
    // Configurar reproductor de audio
    audioPlayer.element = document.getElementById('audio-element');
    
    // Renderizar proyectos iniciales
    renderProjects();
}

// ===== CONFIGURACIÓN DE EVENT LISTENERS =====
function setupEventListeners() {
    // Switch de modo
    document.getElementById('portfolio-btn').addEventListener('click', () => switchMode('portfolio'));
    document.getElementById('personal-btn').addEventListener('click', () => switchMode('personal'));
    
    // Controles del reproductor
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('prev-btn').addEventListener('click', playPrevious);
    document.getElementById('next-btn').addEventListener('click', playNext);
    document.querySelector('.player-close').addEventListener('click', closePlayer);
    
    // Barra de progreso
    document.getElementById('progress-bar').addEventListener('input', seekAudio);
    
    // Control de volumen
    document.getElementById('volume-bar').addEventListener('input', changeVolume);
    
    // Eventos del elemento de audio
    audioPlayer.element.addEventListener('timeupdate', updateProgress);
    audioPlayer.element.addEventListener('ended', playNext);
    audioPlayer.element.addEventListener('loadedmetadata', updateDuration);
}

// ===== RENDERIZADO DE PROYECTOS =====
function renderProjects() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    
    // Obtener categorías según el modo actual
    const categories = appData.categories[currentMode] || [];
    
    // Filtrar proyectos por categorías
    const filteredProjects = appData.projects.filter(project => 
        categories.includes(project.tipo)
    );
    
    // Renderizar cada proyecto
    filteredProjects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}

// ===== CREACIÓN DE TARJETA DE PROYECTO =====
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    // Obtener color del tipo
    const colorName = appData.typeColors[project.tipo] || 'Gray';
    const colorHex = coloresData.colores[colorName] || '#808080';
    
    // Aplicar color de fondo con transparencia
    card.style.background = `linear-gradient(135deg, ${colorHex}cc, ${colorHex}88)`;
    
    // Crear contenido interno
    const inner = document.createElement('div');
    inner.className = 'project-card-inner';
    
    // Icono
    const icon = document.createElement('img');
    icon.className = 'project-icon';
    icon.src = `./data/icons/${project.tipo}.png`;
    icon.alt = project.tipo;
    icon.onerror = () => {
        icon.style.display = 'none';
    };
    
    // Título
    const title = document.createElement('h2');
    title.className = 'project-title';
    title.textContent = project.titulo;
    
    inner.appendChild(icon);
    inner.appendChild(title);
    card.appendChild(inner);
    
    // Event listener para click
    card.addEventListener('click', () => handleProjectClick(project));
    
    return card;
}

// ===== MANEJO DE CLICK EN PROYECTO =====
function handleProjectClick(project) {
    console.log('Proyecto clickeado:', project);
    
    // Navegar a página de proyecto
    window.location.href = `./proyecto.html?proyecto=${project.slug}`;
}

// ===== CAMBIO DE MODO (PORTFOLIO/PERSONAL) =====
function switchMode(mode) {
    if (mode === currentMode) return;
    
    currentMode = mode;
    
    // Actualizar botones
    document.querySelectorAll('.switch-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${mode}-btn`).classList.add('active');
    
    // Cambiar fondo
    const bgContainer = document.getElementById('background-container');
    bgContainer.classList.remove('portfolio', 'personal');
    bgContainer.classList.add(mode);
    
    // Re-renderizar proyectos
    renderProjects();
}

// ===== REPRODUCTOR DE AUDIO =====

function loadProjectAudio(project) {
    const player = document.getElementById('audio-player');
    
    // Preparar playlist
    audioPlayer.currentPlaylist = project.audio.map(audioFile => ({
        file: audioFile,
        title: audioFile.replace(/\.(wav|mp3)$/i, ''),
        project: project.titulo
    }));
    
    audioPlayer.currentIndex = 0;
    audioPlayer.currentProject = project.slug;
    
    // Cargar primer audio
    loadAudioTrack(0);
    
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
    
    // Actualizar información de la pista
    document.querySelector('.track-title').textContent = track.title;
    document.querySelector('.track-project').textContent = track.project;
    
    // Cargar audio
    const audioPath = `./data/projects/${audioPlayer.currentProject}/${track.file}`;
    audioPlayer.element.src = audioPath;
    
    console.log('Cargando audio:', audioPath);
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
        newIndex = audioPlayer.currentPlaylist.length - 1; // Loop al final
    }
    loadAudioTrack(newIndex);
    if (audioPlayer.isPlaying) {
        audioPlayer.element.play();
    }
}

function playNext() {
    let newIndex = audioPlayer.currentIndex + 1;
    if (newIndex >= audioPlayer.currentPlaylist.length) {
        newIndex = 0; // Loop al inicio
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
    
    // Actualizar tiempo actual
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
