// ===== REPRODUCTOR DE AUDIO GLOBAL (persiste entre paginas) =====

// SVG inline usados en varios puntos del player (boton principal, boton de
// ciclo de presets, fullscreen, volumen) — definidos una unica vez aqui.
const ICONS = {
    play: (size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    pause: (size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>`,
    fullscreenExpand: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    fullscreenContract: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
    volumeHigh: () => '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0012 8.5v7a4.5 4.5 0 004.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    volumeLow: () => '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>',
    volumeMute: () => '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
};

const DSM_Player = {
    // Estado
    element: null,
    canvas: null,
    ctx: null,
    playerEl: null,
    currentPlaylist: [],
    currentIndex: 0,
    currentProjectSlug: '',
    isPlaying: false,
    startTime: Date.now(),

    // Drag
    isDragging: false,
    dragStarted: false,
    dragOffset: { x: 0, y: 0 },
    dragStartPos: { x: 0, y: 0 },

    // Seek: mientras el usuario arrastra la barra de progreso, timeupdate no
    // debe sobreescribir el valor del slider (tiron del thumb bajo el dedo)
    isSeeking: false,

    // UI
    playlistOpen: false,
    volumeOpen: false,
    controlsVisible: false,
    controlsTimeout: null,
    animationId: null,
    resizeRaf: 0,
    resizeObserver: null,
    _restoring: false,

    // Web Audio API (analyser para visualizacion reactiva)
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    freqData: null,
    waveData: null,

    // Canvas WebGL dedicado a Butterchurn (el renderer vive en DSM_Visualizer)
    canvasGL: null,

    // Ambience settings (del generador de fondos — fallback sin WebGL2)
    ambience: {
        lineCount: 8,
        amplitude: 1,
        frequency: 1,
        trail: 0.7,
        glow: 1.1,
        colorSpeed: 1,
        hueShift: 20
    },

    // ===== INICIALIZAR =====
    init() {
        this.element = document.getElementById('audio-element');
        if (!this.element) {
            this.element = document.createElement('audio');
            this.element.id = 'audio-element';
            document.body.appendChild(this.element);
        }

        DSM_Visualizer.init(this);
        this.createPlayerDOM();
        // Volumen persistente entre visitas (localStorage), fallback 0.7
        const savedVolume = parseFloat(localStorage.getItem('dsm_volume'));
        this.element.volume = (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1)
            ? savedVolume
            : 0.7;
        this.setupEvents();
        this.syncVolumeUI();
        this.stateRestored = this.restoreState();
        DSM_Visualizer.initButterchurn(); // Carga asincrona, no bloquea
        this.animate();
    },

    // ===== CREAR DOM DEL REPRODUCTOR =====
    createPlayerDOM() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.resizeRaf) {
            cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = 0;
        }

        const old = document.getElementById('audio-player');
        if (old) old.remove();

        const player = document.createElement('div');
        player.id = 'audio-player';
        player.className = 'hidden';
        player.innerHTML = `
            <canvas id="player-canvas"></canvas>
            <canvas id="player-canvas-webgl"></canvas>
            <div class="player-overlay">
                <div class="player-drag-handle">
                    <button class="player-fullscreen" id="fullscreen-btn" aria-label="pantalla completa">${ICONS.fullscreenExpand}</button>
                    <button class="player-close" aria-label="cerrar reproductor">&times;</button>
                </div>
                <div class="player-center">
                    <div class="track-title">sin audio</div>
                    <div class="track-project">-</div>
                </div>
                <div class="player-bottom">
                    <div class="player-progress-mini">
                        <input type="range" id="progress-bar" min="0" max="100" value="0" aria-label="progreso de la pista">
                    </div>
                    <div class="player-controls">
                        <button class="control-btn" id="playlist-btn" aria-label="mostrar playlist"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 13h12v-2H3v2zm0-7v2h18V6H3zm0 12h18v-2H3v2z"/></svg></button>
                        <div class="player-controls-main">
                            <button class="control-btn" id="prev-btn" aria-label="pista anterior"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
                            <button class="control-btn" id="play-btn" aria-label="reproducir">${ICONS.play(16)}</button>
                            <button class="control-btn" id="next-btn" aria-label="pista siguiente"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm10 0h2V6h-2v12z"/></svg></button>
                        </div>
                        <div class="volume-control">
                            <button class="control-btn" id="volume-btn" aria-label="volumen">${ICONS.volumeHigh()}</button>
                            <div id="volume-popover" class="volume-popover hidden">
                                <input type="range" id="volume-slider" min="0" max="100" value="70" aria-label="nivel de volumen">
                            </div>
                        </div>
                    </div>
                    <div class="player-time">
                        <span class="time-current">0:00</span>
                        <span class="time-sep">/</span>
                        <span class="time-total">0:00</span>
                    </div>
                </div>
            </div>
            <div id="playlist-panel" class="playlist-panel hidden">
                <div class="preset-nav" id="preset-nav">
                    <button class="preset-nav-btn" id="preset-prev-btn" aria-label="preset anterior">&#x2039;</button>
                    <button class="preset-cycle-btn" id="preset-cycle-btn" title="pausar ciclo" aria-label="pausar ciclo">${ICONS.pause(10)}</button>
                    <span class="preset-nav-name" id="preset-nav-name">—</span>
                    <button class="preset-nav-btn" id="preset-next-btn" aria-label="siguiente preset">&#x203A;</button>
                </div>
                <div class="playlist-header">
                    <span>playlist</span>
                    <button class="playlist-close" aria-label="cerrar playlist">&times;</button>
                </div>
                <div id="playlist-items" class="playlist-items"></div>
            </div>
        `;

        document.body.appendChild(player);
        this.playerEl = player;
        this.canvas = document.getElementById('player-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Canvas WebGL para Butterchurn (encima del canvas 2D)
        this.canvasGL = document.getElementById('player-canvas-webgl');
        if (this.canvasGL) {
            // Si el contexto WebGL se pierde, caer a canvas 2D para que la animacion no se congele.
            this.canvasGL.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                DSM_Visualizer.markButterchurnUnavailable('webgl context lost');
                DSM_Visualizer.scheduleButterchurnRecovery('webgl context lost');
                console.warn('DSM_Player: WebGL context lost, usando fallback 2D');
            });

            this.canvasGL.addEventListener('webglcontextrestored', () => {
                console.info('DSM_Player: WebGL context restored, reintentando Butterchurn');
                DSM_Visualizer.onContextRestored();
            });
        }

        if (typeof ResizeObserver !== 'undefined' && this.playerEl) {
            this.resizeObserver = new ResizeObserver(() => this.scheduleRendererResize());
            this.resizeObserver.observe(this.playerEl);
        }

        DSM_Visualizer.updatePresetNavUI();
        DSM_Visualizer.updateAutoCycleBtn();

        // Restaurar posicion guardada (con bounds check)
        const savedPos = sessionStorage.getItem('dsm_player_pos');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                const maxX = window.innerWidth - 60;
                const maxY = window.innerHeight - 60;
                if (pos.x >= 0 && pos.x <= maxX && pos.y >= 0 && pos.y <= maxY) {
                    player.style.left = pos.x + 'px';
                    player.style.top = pos.y + 'px';
                    player.style.bottom = 'auto';
                    player.style.right = 'auto';
                }
            } catch (e) { /* posicion corrupta, usar default */ }
        }
    },

    // ===== EVENTOS =====
    setupEvents() {
        // Controles del player
        document.getElementById('play-btn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prev-btn').addEventListener('click', () => this.playPrevious());
        document.getElementById('next-btn').addEventListener('click', () => this.playNext());
        document.getElementById('playlist-btn').addEventListener('click', () => this.togglePlaylist());
        document.querySelector('.player-close').addEventListener('click', () => this.close());
        document.querySelector('.playlist-close').addEventListener('click', () => this.togglePlaylist());
        const progressBar = document.getElementById('progress-bar');
        progressBar.addEventListener('input', (e) => this.seek(e));
        progressBar.addEventListener('pointerdown', () => { this.isSeeking = true; });
        document.getElementById('volume-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVolumePopover();
        });
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.setVolume(e.target.value / 100);
        });
        document.getElementById('volume-popover').addEventListener('click', (e) => e.stopPropagation());

        // Fullscreen
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());

        // Preset navigation
        document.getElementById('preset-prev-btn').addEventListener('click', () => DSM_Visualizer.prevPreset());
        document.getElementById('preset-next-btn').addEventListener('click', () => DSM_Visualizer.nextPreset());
        document.getElementById('preset-cycle-btn').addEventListener('click', () => DSM_Visualizer.toggleAutoCycle());

        // Audio events
        this.element.addEventListener('timeupdate', () => this.updateProgress());
        this.element.addEventListener('ended', () => this.playNext());
        this.element.addEventListener('loadedmetadata', () => this.updateDuration());

        // Drag — todo el player cuando controles ocultos, solo handle cuando visibles
        this.playerEl.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        this.playerEl.addEventListener('touchstart', (e) => this.handlePointerDown(e), { passive: false });

        // Hover para mostrar/ocultar controles (desktop)
        this.playerEl.addEventListener('mouseenter', () => this.showControls());
        this.playerEl.addEventListener('mouseleave', () => {
            if (!this.playlistOpen) this.hideControls();
        });

        // Listeners globales en document/window: el player en si se recrea en
        // cada createPlayerDOM(), pero document/window persisten toda la vida
        // de la pagina. Si setupEvents() se llamara mas de una vez estos se
        // duplicarian (cada init() sumaria otro listener). Se registran una
        // unica vez; usan this.playerEl en el momento del evento (no una
        // referencia capturada), asi que siguen apuntando al player vigente
        // aunque el DOM se haya recreado despues de este primer registro.
        if (!this._globalEventsBound) {
            this._globalEventsBound = true;

            document.addEventListener('pointerup', () => { this.isSeeking = false; });
            document.addEventListener('click', (e) => {
                if (!this.volumeOpen) return;
                if (!e.target.closest('.volume-control')) this.toggleVolumePopover(false);
            });
            document.addEventListener('mousemove', (e) => this.onDrag(e));
            document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
            document.addEventListener('mouseup', () => this.handlePointerUp());
            document.addEventListener('touchend', () => this.handlePointerUp());

            // Intentar desbloquear/resumir AudioContext en el primer gesto real del usuario.
            document.addEventListener('pointerdown', () => this.ensureAudioContext(), { once: true, passive: true });
            document.addEventListener('keydown', () => this.ensureAudioContext(), { once: true });
            window.addEventListener('resize', () => this.scheduleRendererResize());
        }
    },

    // ===== POINTER HANDLING (drag + tap-to-toggle) =====
    handlePointerDown(e) {
        const target = e.target;

        // No iniciar drag desde controles interactivos
        if (target.closest('button') || target.closest('input') || target.closest('.playlist-panel')) {
            return;
        }

        // Si controles visibles, solo drag desde el handle
        if (this.controlsVisible && !target.closest('.player-drag-handle')) {
            return;
        }

        e.preventDefault();
        this.isDragging = true;
        this.dragStarted = false;

        const rect = this.playerEl.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;
        this.dragStartPos.x = clientX;
        this.dragStartPos.y = clientY;
        this.playerEl.style.transition = 'none';
    },

    onDrag(e) {
        if (!this.isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Threshold de 5px para distinguir tap de drag
        if (!this.dragStarted) {
            const dx = clientX - this.dragStartPos.x;
            const dy = clientY - this.dragStartPos.y;
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            this.dragStarted = true;
        }

        e.preventDefault();
        const w = this.playerEl.offsetWidth;
        const h = this.playerEl.offsetHeight;
        const x = Math.max(0, Math.min(clientX - this.dragOffset.x, window.innerWidth - w));
        const y = Math.max(0, Math.min(clientY - this.dragOffset.y, window.innerHeight - h));

        this.playerEl.style.left = x + 'px';
        this.playerEl.style.top = y + 'px';
        this.playerEl.style.bottom = 'auto';
        this.playerEl.style.right = 'auto';
    },

    handlePointerUp() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.playerEl.style.transition = '';

        if (this.dragStarted) {
            // Fue un drag real — guardar posicion
            const rect = this.playerEl.getBoundingClientRect();
            sessionStorage.setItem('dsm_player_pos', JSON.stringify({ x: rect.left, y: rect.top }));
        } else {
            // Fue un tap sin mover — toggle controles (solo movil)
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (isTouchDevice) this.toggleControls();
        }
    },

    // ===== CONTROLES VISIBILIDAD =====
    showControls() {
        this.controlsVisible = true;
        this.playerEl.classList.add('controls-visible');
        clearTimeout(this.controlsTimeout);
    },

    hideControls() {
        this.controlsVisible = false;
        this.playerEl.classList.remove('controls-visible');
        this.toggleVolumePopover(false);
        if (this.playlistOpen) {
            this.playlistOpen = false;
            const panel = document.getElementById('playlist-panel');
            if (panel) panel.classList.add('hidden');
        }
    },

    toggleControls() {
        if (this.controlsVisible) {
            this.hideControls();
        } else {
            this.showControls();
            // Auto-hide en movil despues de 5s
            clearTimeout(this.controlsTimeout);
            this.controlsTimeout = setTimeout(() => {
                if (!this.playlistOpen) this.hideControls();
            }, 5000);
        }
    },

    toggleVolumePopover(forceOpen) {
        const popover = document.getElementById('volume-popover');
        if (!popover) return;
        if (typeof forceOpen === 'boolean') this.volumeOpen = forceOpen;
        else this.volumeOpen = !this.volumeOpen;
        popover.classList.toggle('hidden', !this.volumeOpen);
    },

    setVolume(volume) {
        const nextVolume = Math.max(0, Math.min(1, volume));
        this.element.volume = nextVolume;
        localStorage.setItem('dsm_volume', String(nextVolume));
        this.syncVolumeUI();
        this.saveState();
    },

    syncVolumeUI() {
        const volume = this.element ? this.element.volume : 0.7;
        const slider = document.getElementById('volume-slider');
        if (slider) slider.value = String(Math.round(volume * 100));
        const btn = document.getElementById('volume-btn');
        if (btn) {
            const icon = volume <= 0.01 ? ICONS.volumeMute : volume < 0.5 ? ICONS.volumeLow : ICONS.volumeHigh;
            btn.innerHTML = icon();
        }
    },

    // ===== WEB AUDIO API (analyser reactivo) =====
    ensureAudioContext() {
        // Solo crear una vez
        if (this.audioCtx) {
            // Resumir si estaba suspendido (politica autoplay)
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => { /* se reintentara en siguiente gesto */ });
            }
            return;
        }

        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // Analyser: 256 fftSize = 128 bins de frecuencia (suficiente para el player pequeño)
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;

            // Conectar: <audio> → sourceNode → analyser → destination (speakers)
            // MediaElementSource solo se puede crear UNA VEZ por elemento
            this.sourceNode = this.audioCtx.createMediaElementSource(this.element);
            this.sourceNode.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);

            // Buffers para leer datos
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
            this.waveData = new Uint8Array(this.analyser.frequencyBinCount);

            // Si Butterchurn esta cargado pero no inicializado (faltaba AudioContext), inicializar ahora
            DSM_Visualizer.onAudioContextReady();
        } catch (e) {
            // Si falla (ej: MediaElementSource ya conectado), no romper nada
            console.warn('DSM_Player: No se pudo crear AudioContext:', e.message);
            this.audioCtx = null;
            this.analyser = null;
        }
    },

    // Obtener energia media del audio (0..1) — para modular amplitud de ondas
    getAudioEnergy() {
        if (!this.analyser || !this.freqData) return 0;
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        let weightSum = 0;
        for (let i = 0; i < this.freqData.length; i++) {
            const normalized = this.freqData[i] / 255;
            const lowMidWeight = i < this.freqData.length * 0.25 ? 1.7 : (i < this.freqData.length * 0.6 ? 1.2 : 0.7);
            sum += normalized * lowMidWeight;
            weightSum += lowMidWeight;
        }
        return weightSum > 0 ? (sum / weightSum) : 0; // normalizar a 0..1
    },

    // Obtener forma de onda (waveform) como array normalizado -1..1
    getWaveform() {
        if (!this.analyser || !this.waveData) return null;
        this.analyser.getByteTimeDomainData(this.waveData);
        return this.waveData;
    },

    scheduleRendererResize() {
        if (this.resizeRaf) return;
        this.resizeRaf = requestAnimationFrame(() => {
            this.resizeRaf = 0;
            DSM_Visualizer.onResize();
        });
    },

    // ===== FULLSCREEN (expande player a toda la ventana) =====
    isFullscreen: false,
    fullscreenAnim: null,

    toggleFullscreen() {
        if (!this.playerEl) return;
        const player = this.playerEl;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const firstRect = player.getBoundingClientRect();

        // Cancelar animacion previa para evitar acumulacion si el usuario hace taps rapidos
        if (this.fullscreenAnim) {
            this.fullscreenAnim.cancel();
            this.fullscreenAnim = null;
        }

        this.isFullscreen = !this.isFullscreen;
        player.classList.toggle('is-fullscreen', this.isFullscreen);

        if (!reduceMotion) {
            const lastRect = player.getBoundingClientRect();
            const dx = firstRect.left - lastRect.left;
            const dy = firstRect.top - lastRect.top;
            const sx = lastRect.width > 0 ? firstRect.width / lastRect.width : 1;
            const sy = lastRect.height > 0 ? firstRect.height / lastRect.height : 1;

            this.fullscreenAnim = player.animate(
                [
                    {
                        transformOrigin: 'top left',
                        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
                    },
                    {
                        transformOrigin: 'top left',
                        transform: 'translate(0, 0) scale(1, 1)'
                    }
                ],
                {
                    duration: 320,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'none'
                }
            );

            this.fullscreenAnim.onfinish = () => {
                this.fullscreenAnim = null;
                if (DSM_Visualizer.isReady()) this.scheduleRendererResize();
            };
            this.fullscreenAnim.oncancel = () => { this.fullscreenAnim = null; };
        }

        // Actualizar icono: expandir <-> contraer (flechas hacia dentro, no una X)
        const btn = document.getElementById('fullscreen-btn');
        if (btn) {
            btn.innerHTML = this.isFullscreen ? ICONS.fullscreenContract : ICONS.fullscreenExpand;
            btn.setAttribute('aria-label', this.isFullscreen ? 'salir de pantalla completa' : 'fullscreen');
        }

        // Resize Butterchurn al nuevo tamaño
        if (DSM_Visualizer.isReady()) {
            this.scheduleRendererResize();
        }
    },

    // ===== ANIMACION (delega en DSM_Visualizer/DSM_Ambience segun disponibilidad) =====
    animate() {
        if (!this.canvas && !this.canvasGL) return;

        // No renderizar si el player esta oculto (ahorra CPU)
        if (this.playerEl && this.playerEl.classList.contains('hidden')) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        DSM_Visualizer.updateAdaptiveQuality(performance.now());

        // Si Butterchurn esta listo, usarlo en vez de las ondas procedurales
        if (DSM_Visualizer.renderFrame()) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        try {
            const rect = this.canvas.getBoundingClientRect();
            const { w, h } = DSM_Visualizer.getRenderSize(rect, { fullscreenBoost: this.isFullscreen });
            if (this.canvas.width !== w) this.canvas.width = w;
            if (this.canvas.height !== h) this.canvas.height = h;
            if (w === 0 || h === 0) {
                this.animationId = requestAnimationFrame(() => this.animate());
                return;
            }

            // Leer datos de audio si el analyser esta disponible
            const energy = this.analyser ? this.getAudioEnergy() : 0;
            const waveform = this.getWaveform(); // null si no hay analyser

            DSM_Ambience.render(this.ctx, this.canvas, {
                startTime: this.startTime,
                isPlaying: this.isPlaying,
                settings: this.ambience,
                energy,
                waveform,
                hasAnalyser: !!this.analyser
            });
        } catch (err) {
            console.warn('DSM_Player: render 2D fallo, reintentando siguiente frame:', err?.message || err);
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    },

    // ===== BGM (MUSICA DE FONDO) =====
    isBgm: false,

    loadBgm(path, title, project) {
        this.ensureAudioContext();
        this.isBgm = true;
        this.element.loop = true;
        this.currentPlaylist = [{ file: path, title: title || 'bgm', project: project || '' }];
        this.currentProjectSlug = '';
        this.currentIndex = 0;

        document.querySelector('#audio-player .track-title').textContent = title || 'bgm';
        document.querySelector('#audio-player .track-project').textContent = project || '';

        // Ruta directa (no relativa a proyecto) — resuelta contra la raiz del
        // sitio: tras un pushState a /p/<slug>/ una ruta relativa sin mas se
        // resolveria contra esa URL, no contra la raiz.
        this.element.src = DSM_SHARED.assetUrl(path);
        this.show();
        this.renderPlaylistPanel();

        setTimeout(() => {
            this.element.play().then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
                this.saveState();
            }).catch(() => {
                // Autoplay bloqueado — mostrar player pausado
                this.isPlaying = false;
                this.updatePlayButton();
                this.saveState();
            });
        }, 100);
    },

    // ===== PLAYLIST =====
    loadPlaylist(playlist, projectSlug, startIndex = 0) {
        this.ensureAudioContext();
        // Desactivar modo BGM
        this.isBgm = false;
        this.element.loop = false;

        this.currentPlaylist = playlist;
        this.currentProjectSlug = projectSlug;
        this.currentIndex = startIndex;

        this.loadTrack(startIndex);
        this.show();
        this.renderPlaylistPanel();

        setTimeout(() => {
            this.element.play().then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
                this.saveState();
            }).catch(() => {
                this.isPlaying = false;
                this.updatePlayButton();
                this.saveState();
            });
        }, 100);
    },

    loadTrack(index) {
        if (index < 0 || index >= this.currentPlaylist.length) return;
        const track = this.currentPlaylist[index];
        this.currentIndex = index;

        document.querySelector('#audio-player .track-title').textContent = track.title;
        document.querySelector('#audio-player .track-project').textContent = track.project;

        // BGM usa ruta directa, playlists usan ruta relativa al proyecto
        if (this.isBgm) {
            this.element.src = DSM_SHARED.assetUrl(track.file);
        } else {
            this.element.src = DSM_SHARED.assetUrl(`data/projects/${this.currentProjectSlug}/${track.file}`);
        }
        this.saveState();
        this.highlightPlaylistItem();
    },

    // ===== CONTROLES DE REPRODUCCION =====
    togglePlay() {
        this.ensureAudioContext();
        if (this.isPlaying) {
            this.element.pause();
            this.isPlaying = false;
        } else {
            this.element.play().catch(() => {});
            this.isPlaying = true;
        }
        this.updatePlayButton();
        this.saveState();
    },

    updatePlayButton() {
        const btn = document.getElementById('play-btn');
        if (btn) {
            btn.innerHTML = this.isPlaying ? ICONS.pause(16) : ICONS.play(16);
            btn.setAttribute('aria-label', this.isPlaying ? 'pausar' : 'reproducir');
        }
    },

    playPrevious() {
        const idx = this.currentIndex <= 0 ? this.currentPlaylist.length - 1 : this.currentIndex - 1;
        this.loadTrack(idx);
        if (this.isPlaying) this.element.play().catch(() => {});
    },

    playNext() {
        const idx = this.currentIndex >= this.currentPlaylist.length - 1 ? 0 : this.currentIndex + 1;
        this.loadTrack(idx);
        if (this.isPlaying) this.element.play().catch(() => {});
    },

    seek(e) {
        if (!this.element.duration) return;
        this.element.currentTime = (e.target.value / 100) * this.element.duration;
    },

    updateProgress() {
        if (!this.element.duration) return;
        const progress = (this.element.currentTime / this.element.duration) * 100;
        const bar = document.getElementById('progress-bar');
        if (bar && !this.isSeeking) bar.value = progress;
        const cur = document.querySelector('#audio-player .time-current');
        if (cur) cur.textContent = this.formatTime(this.element.currentTime);
    },

    updateDuration() {
        const tot = document.querySelector('#audio-player .time-total');
        if (tot) tot.textContent = this.formatTime(this.element.duration);
    },

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ===== PLAYLIST PANEL =====
    togglePlaylist() {
        this.playlistOpen = !this.playlistOpen;
        const panel = document.getElementById('playlist-panel');
        if (panel) panel.classList.toggle('hidden', !this.playlistOpen);
    },

    renderPlaylistPanel() {
        const container = document.getElementById('playlist-items');
        if (!container) return;
        container.innerHTML = '';

        this.currentPlaylist.forEach((track, i) => {
            // Boton real: accesible por teclado (tab + enter)
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'playlist-item' + (i === this.currentIndex ? ' active' : '');
            const num = document.createElement('span');
            num.className = 'pl-num';
            num.textContent = String(i + 1);
            const name = document.createElement('span');
            name.className = 'pl-name';
            name.textContent = track.title;
            item.appendChild(num);
            item.appendChild(name);
            item.addEventListener('click', () => {
                this.loadTrack(i);
                if (this.isPlaying) this.element.play().catch(() => {});
            });
            container.appendChild(item);
        });
    },

    highlightPlaylistItem() {
        document.querySelectorAll('.playlist-item').forEach((item, i) => {
            item.classList.toggle('active', i === this.currentIndex);
        });
    },

    // ===== MOSTRAR / OCULTAR =====
    show() {
        if (this.playerEl) {
            this.playerEl.classList.remove('hidden');
            // Reintentar setup de Butterchurn si aun no esta listo
            DSM_Visualizer.onShow();
            // Resize al tamaño real ahora que es visible
            if (DSM_Visualizer.isReady()) {
                this.scheduleRendererResize();
            }
        }
    },

    // Devuelve true si hay una playlist cargada (BGM o proyecto)
    hasContent() {
        return this.currentPlaylist.length > 0;
    },

    close() {
        this.element.pause();
        this.element.removeAttribute('src');
        this.element.load(); // Liberar recurso de audio
        this.isPlaying = false;
        this.isBgm = false;
        this.element.loop = false;
        this.currentPlaylist = [];
        this.currentProjectSlug = '';
        this.currentIndex = 0;

        // Resetear UI del track
        const titleEl = document.querySelector('#audio-player .track-title');
        const projEl = document.querySelector('#audio-player .track-project');
        if (titleEl) titleEl.textContent = 'sin audio';
        if (projEl) projEl.textContent = '-';

        if (this.playerEl) this.playerEl.classList.add('hidden');
        this.updatePlayButton();
        this.hideControls();
        this.toggleVolumePopover(false);
        this.renderPlaylistPanel();
        sessionStorage.removeItem('dsm_player_state');
    },

    // ===== PERSISTENCIA =====
    _buildState() {
        return {
            playlist: this.currentPlaylist,
            slug: this.currentProjectSlug,
            index: this.currentIndex,
            playing: this.isPlaying,
            time: this.element ? this.element.currentTime : 0,
            isBgm: this.isBgm
        };
    },

    saveState() {
        if (this._restoring) return;
        sessionStorage.setItem('dsm_player_state', JSON.stringify(this._buildState()));
    },

    restoreState() {
        const saved = sessionStorage.getItem('dsm_player_state');
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            if (!state.playlist || state.playlist.length === 0) return false;

            this._restoring = true;
            this.ensureAudioContext();

            this.currentPlaylist = state.playlist;
            this.currentProjectSlug = state.slug;
            this.currentIndex = state.index;
            // El volumen NO viaja en el estado de sesion: init() ya lo aplico
            // desde localStorage (dsm_volume), unica fuente de verdad.
            this.isBgm = !!state.isBgm;
            this.element.loop = this.isBgm;

            const track = this.currentPlaylist[state.index];
            if (!track) { this._restoring = false; return false; }

            // Cargar track sin disparar saveState
            document.querySelector('#audio-player .track-title').textContent = track.title;
            document.querySelector('#audio-player .track-project').textContent = track.project;

            // BGM usa ruta directa, playlists usan ruta relativa al proyecto
            if (this.isBgm) {
                this.element.src = DSM_SHARED.assetUrl(track.file);
            } else {
                this.element.src = DSM_SHARED.assetUrl(`data/projects/${this.currentProjectSlug}/${track.file}`);
            }

            this.show();
            this.renderPlaylistPanel();
            this.highlightPlaylistItem();

            // Si el audio guardado ya no carga (404, proyecto renombrado),
            // loadedmetadata nunca dispara: liberar _restoring para que
            // saveState() no quede bloqueado el resto de la sesion.
            this.element.addEventListener('error', () => {
                this._restoring = false;
            }, { once: true });

            this.element.addEventListener('loadedmetadata', () => {
                this.element.currentTime = state.time || 0;
                if (!state.playing) {
                    // Estaba en pausa: restaurar en pausa en el mismo punto, sin autoplay
                    this.isPlaying = false;
                    this.updatePlayButton();
                    this._restoring = false;
                    this.saveState();
                    return;
                }
                this.element.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this._restoring = false;
                    this.saveState();
                }).catch(() => {
                    // Autoplay bloqueado por browser — dejar el player visible en
                    // pausa en el punto guardado para que un click lo reanude
                    this.isPlaying = false;
                    this.updatePlayButton();
                    this._restoring = false;
                    this.saveState();
                });
            }, { once: true });

            return true; // Estado restaurado
        } catch (e) {
            this._restoring = false;
            return false;
        }
    }
};

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', () => DSM_Player.init());

// Guardar estado justo antes de navegar a otra pagina
window.addEventListener('beforeunload', () => {
    if (DSM_Player.currentPlaylist.length > 0) {
        sessionStorage.setItem('dsm_player_state', JSON.stringify(DSM_Player._buildState()));
    }
});
