// ===== REPRODUCTOR DE AUDIO GLOBAL (persiste entre paginas) =====

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

    // UI
    playlistOpen: false,
    volumeOpen: false,
    controlsVisible: false,
    controlsTimeout: null,
    animationId: null,
    _restoring: false,

    // Web Audio API (analyser para visualizacion reactiva)
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    freqData: null,
    waveData: null,

    // Butterchurn (Milkdrop visualizer)
    butterchurn: null,        // modulo butterchurn (cargado dinamicamente)
    visualizer: null,         // instancia del visualizador
    canvasGL: null,           // canvas WebGL dedicado
    bcPresets: null,          // objeto { key: presetData } con los presets seleccionados
    bcPresetKeys: [],         // array de keys de presets
    bcPresetIndex: 0,         // indice del preset actual
    bcCycleInterval: null,    // intervalo para ciclar presets
    bcReady: false,           // true cuando butterchurn esta listo para renderizar

    // Presets prioritarios — van al principio de la lista, en este orden
    BC_PRIORITY_PRESETS: [
        'martin - castle in the air',
        '_Mig_085',
        'Aderrasi - Potion of Spirits'
    ],
    BC_CYCLE_SECONDS: 18,     // segundos entre cambio de preset
    BC_BLEND_SECONDS: 2.7,    // duracion del crossfade entre presets
    bcAutoCycle: true,         // ciclo automatico activado por defecto

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

        this.createPlayerDOM();
        this.element.volume = 0.7;
        this.setupEvents();
        this.syncVolumeUI();
        this.stateRestored = this.restoreStateIfPlaying();
        this.initButterchurn(); // Carga asincrona, no bloquea
        this.animate();
    },

    // ===== CREAR DOM DEL REPRODUCTOR =====
    createPlayerDOM() {
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
                    <button class="player-fullscreen" id="fullscreen-btn" aria-label="fullscreen">&#x26F6;</button>
                    <button class="player-close">&times;</button>
                </div>
                <div class="player-center">
                    <div class="track-title">sin audio</div>
                    <div class="track-project">-</div>
                </div>
                <div class="player-bottom">
                    <div class="player-progress-mini">
                        <input type="range" id="progress-bar" min="0" max="100" value="0">
                    </div>
                    <div class="player-controls">
                        <button class="control-btn" id="playlist-btn">&#x2630;</button>
                        <div class="player-controls-main">
                            <button class="control-btn" id="prev-btn">&#x23EE;</button>
                            <button class="control-btn" id="play-btn">&#x25B6;</button>
                            <button class="control-btn" id="next-btn">&#x23ED;</button>
                        </div>
                        <div class="volume-control">
                            <button class="control-btn" id="volume-btn" aria-label="volume">&#x1F50A;</button>
                            <div id="volume-popover" class="volume-popover hidden">
                                <input type="range" id="volume-slider" min="0" max="100" value="70">
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
                    <button class="preset-nav-btn" id="preset-prev-btn">&#x2039;</button>
                    <button class="preset-cycle-btn" id="preset-cycle-btn" title="pausar ciclo">&#x23F8;</button>
                    <span class="preset-nav-name" id="preset-nav-name">—</span>
                    <button class="preset-nav-btn" id="preset-next-btn">&#x203A;</button>
                </div>
                <div class="playlist-header">
                    <span>playlist</span>
                    <button class="playlist-close">&times;</button>
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

        // Restaurar posicion guardada
        const savedPos = sessionStorage.getItem('dsm_player_pos');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                player.style.left = pos.x + 'px';
                player.style.top = pos.y + 'px';
                player.style.bottom = 'auto';
                player.style.right = 'auto';
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
        document.getElementById('progress-bar').addEventListener('input', (e) => this.seek(e));
        document.getElementById('volume-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVolumePopover();
        });
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.setVolume(e.target.value / 100);
        });
        document.getElementById('volume-popover').addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', (e) => {
            if (!this.volumeOpen) return;
            if (!e.target.closest('.volume-control')) this.toggleVolumePopover(false);
        });

        // Fullscreen
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());

        // Preset navigation
        document.getElementById('preset-prev-btn').addEventListener('click', () => this.prevPreset());
        document.getElementById('preset-next-btn').addEventListener('click', () => this.nextPreset());
        document.getElementById('preset-cycle-btn').addEventListener('click', () => this.toggleAutoCycle());

        // Audio events
        this.element.addEventListener('timeupdate', () => this.updateProgress());
        this.element.addEventListener('ended', () => this.playNext());
        this.element.addEventListener('loadedmetadata', () => this.updateDuration());

        // Drag — todo el player cuando controles ocultos, solo handle cuando visibles
        this.playerEl.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        this.playerEl.addEventListener('touchstart', (e) => this.handlePointerDown(e), { passive: false });
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        document.addEventListener('mouseup', () => this.handlePointerUp());
        document.addEventListener('touchend', () => this.handlePointerUp());

        // Hover para mostrar/ocultar controles (desktop)
        this.playerEl.addEventListener('mouseenter', () => this.showControls());
        this.playerEl.addEventListener('mouseleave', () => {
            if (!this.playlistOpen) this.hideControls();
        });

        // Intentar desbloquear/resumir AudioContext en el primer gesto real del usuario.
        document.addEventListener('pointerdown', () => this.ensureAudioContext(), { once: true, passive: true });
        document.addEventListener('keydown', () => this.ensureAudioContext(), { once: true });

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
        this.syncVolumeUI();
        this.saveState();
    },

    syncVolumeUI() {
        const volume = this.element ? this.element.volume : 0.7;
        const slider = document.getElementById('volume-slider');
        if (slider) slider.value = String(Math.round(volume * 100));
        const btn = document.getElementById('volume-btn');
        if (btn) {
            if (volume <= 0.01) btn.textContent = '\uD83D\uDD07';
            else if (volume < 0.5) btn.textContent = '\uD83D\uDD08';
            else btn.textContent = '\uD83D\uDD0A';
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
            if (this.butterchurn && !this.bcReady) {
                this.setupButterchurn();
            }
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

    // ===== BUTTERCHURN (MILKDROP VISUALIZER) =====
    initButterchurn() {
        // Verificar WebGL2 con canvas temporal
        if (!this.canvasGL) return;
        const testCanvas = document.createElement('canvas');
        if (!testCanvas.getContext('webgl2')) {
            console.warn('DSM_Player: WebGL2 no disponible, usando fallback de ondas');
            this.canvasGL.style.display = 'none';
            return;
        }

        // Cargar presets del pack base (window.base cargado via <script> tag)
        if (!window.base || !window.base.default) {
            console.warn('DSM_Player: Presets de Butterchurn no encontrados');
            this.canvasGL.style.display = 'none';
            return;
        }

        const allPresets = window.base.default;
        const allKeys = Object.keys(allPresets);
        if (allKeys.length === 0) {
            console.warn('DSM_Player: Ningun preset encontrado en el pack');
            this.canvasGL.style.display = 'none';
            return;
        }

        // Ordenar: prioritarios primero (en orden), despues el resto alfabeticamente
        const prioritySet = new Set(this.BC_PRIORITY_PRESETS);
        const priorityKeys = this.BC_PRIORITY_PRESETS.filter(k => allPresets[k]);
        const restKeys = allKeys.filter(k => !prioritySet.has(k)).sort();
        this.bcPresetKeys = [...priorityKeys, ...restKeys];

        this.bcPresets = {};
        for (const key of this.bcPresetKeys) {
            this.bcPresets[key] = allPresets[key];
        }

        // Butterchurn core se carga como ES module (deferred)
        // Puede estar listo ya o llegar despues via evento 'butterchurn-ready'
        if (window.butterchurn && typeof window.butterchurn.createVisualizer === 'function') {
            this.butterchurn = window.butterchurn;
            this.setupButterchurn();
        } else {
            window.addEventListener('butterchurn-ready', () => {
                this.butterchurn = window.butterchurn;
                this.setupButterchurn();
            }, { once: true });
        }
    },

    setupButterchurn() {
        if (!this.butterchurn || !this.canvasGL || !this.audioCtx || !this.analyser) return;
        if (this.bcReady) return; // Ya inicializado

        // Usar tamaño fijo si el player esta oculto (getBoundingClientRect devuelve 0)
        const rect = this.canvasGL.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        let w = Math.round(rect.width * dpr);
        let h = Math.round(rect.height * dpr);
        // Fallback a tamaño razonable si el canvas no es visible aun
        if (w === 0 || h === 0) {
            w = 400; h = 400;
        }
        this.canvasGL.width = w;
        this.canvasGL.height = h;

        try {
            this.visualizer = this.butterchurn.createVisualizer(this.audioCtx, this.canvasGL, {
                width: w,
                height: h,
                pixelRatio: dpr,
                textureRatio: 1
            });

            // Conectar nuestro analyser existente
            this.visualizer.connectAudio(this.analyser);

            // Cargar primer preset — siempre empieza por el primero (castle in the air)
            this.bcPresetIndex = 0;
            this.visualizer.loadPreset(this.bcPresets[this.bcPresetKeys[0]], 0.0);

            // Ocultar canvas 2D, mostrar WebGL
            this.canvas.style.display = 'none';
            this.canvasGL.style.display = 'block';
            this.bcReady = true;

            // Mostrar nombre del preset actual
            this.updatePresetNavName();

            // Iniciar ciclo de presets
            this.startPresetCycle();
        } catch (err) {
            console.warn('DSM_Player: Error inicializando Butterchurn:', err.message);
            this.canvasGL.style.display = 'none';
            this.canvas.style.display = 'block';
            this.bcReady = false;
        }
    },

    startPresetCycle() {
        if (this.bcCycleInterval) clearInterval(this.bcCycleInterval);
        this.bcCycleInterval = null;
        if (!this.bcAutoCycle || this.bcPresetKeys.length <= 1) return;

        this.bcCycleInterval = setInterval(() => {
            if (!this.bcReady || !this.visualizer) return;
            this.bcPresetIndex = (this.bcPresetIndex + 1) % this.bcPresetKeys.length;
            this.visualizer.loadPreset(
                this.bcPresets[this.bcPresetKeys[this.bcPresetIndex]],
                this.BC_BLEND_SECONDS
            );
            this.updatePresetNavName();
        }, this.BC_CYCLE_SECONDS * 1000);
    },

    toggleAutoCycle() {
        this.bcAutoCycle = !this.bcAutoCycle;
        if (this.bcAutoCycle) {
            this.startPresetCycle();
        } else {
            if (this.bcCycleInterval) clearInterval(this.bcCycleInterval);
            this.bcCycleInterval = null;
        }
        this.updateAutoCycleBtn();
    },

    updateAutoCycleBtn() {
        const btn = document.getElementById('preset-cycle-btn');
        if (!btn) return;
        btn.textContent = this.bcAutoCycle ? '\u23F8' : '\u25B6';
        btn.title = this.bcAutoCycle ? 'pausar ciclo' : 'activar ciclo';
    },

    resizeButterchurn() {
        if (!this.visualizer || !this.canvasGL) return;
        const rect = this.canvasGL.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);
        if (w === 0 || h === 0) return;
        this.canvasGL.width = w;
        this.canvasGL.height = h;
        this.visualizer.setRendererSize(w, h);
    },

    // Cambiar al preset anterior (manual)
    prevPreset() {
        if (!this.bcReady || this.bcPresetKeys.length === 0) return;
        this.bcPresetIndex = (this.bcPresetIndex - 1 + this.bcPresetKeys.length) % this.bcPresetKeys.length;
        this.visualizer.loadPreset(this.bcPresets[this.bcPresetKeys[this.bcPresetIndex]], this.BC_BLEND_SECONDS);
        this.updatePresetNavName();
        // Reiniciar el ciclo automatico
        this.startPresetCycle();
    },

    // Cambiar al preset siguiente (manual)
    nextPreset() {
        if (!this.bcReady || this.bcPresetKeys.length === 0) return;
        this.bcPresetIndex = (this.bcPresetIndex + 1) % this.bcPresetKeys.length;
        this.visualizer.loadPreset(this.bcPresets[this.bcPresetKeys[this.bcPresetIndex]], this.BC_BLEND_SECONDS);
        this.updatePresetNavName();
        // Reiniciar el ciclo automatico
        this.startPresetCycle();
    },

    // Actualizar el nombre del preset en el navegador
    updatePresetNavName() {
        const nameEl = document.getElementById('preset-nav-name');
        if (!nameEl) return;
        if (this.bcPresetKeys.length === 0) {
            nameEl.textContent = '—';
            return;
        }
        nameEl.textContent = this.bcPresetKeys[this.bcPresetIndex] || '—';
    },

    // ===== FULLSCREEN (expande player a toda la ventana) =====
    isFullscreen: false,

    toggleFullscreen() {
        if (!this.playerEl) return;
        this.isFullscreen = !this.isFullscreen;
        this.playerEl.classList.toggle('is-fullscreen', this.isFullscreen);

        // Actualizar icono
        const btn = document.getElementById('fullscreen-btn');
        if (btn) btn.textContent = this.isFullscreen ? '\u2716' : '\u26F6';

        // Resize Butterchurn al nuevo tamaño
        if (this.bcReady) {
            requestAnimationFrame(() => this.resizeButterchurn());
        }
    },

    // ===== AMBIENCE ANIMATION (reactivo al audio via AnalyserNode) =====
    animate() {
        if (!this.canvas && !this.canvasGL) return;

        // No renderizar si el player esta oculto (ahorra CPU)
        if (this.playerEl && this.playerEl.classList.contains('hidden')) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        // Si Butterchurn esta listo, usarlo en vez de las ondas procedurales
        if (this.bcReady && this.visualizer) {
            this.visualizer.render();
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        const w = this.canvas.width = this.canvas.offsetWidth * 2;
        const h = this.canvas.height = this.canvas.offsetHeight * 2;
        if (w === 0 || h === 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        const timeSec = (Date.now() - this.startTime) * 0.001;
        const playing = this.isPlaying;
        const s = this.ambience;

        // Leer datos de audio si el analyser esta disponible
        const energy = this.analyser ? this.getAudioEnergy() : 0;
        const reactiveEnergy = Math.min(1, Math.pow(energy, 0.72) * 1.35);
        const waveform = this.getWaveform(); // null si no hay analyser
        const hasAudio = this.analyser && playing && reactiveEnergy > 0.01;

        // Trail fade (fondo semitransparente para efecto estela)
        // Cuando hay audio reactivo, trail mas largo para efecto mas fluido
        const trailBase = hasAudio ? 0.06 : 0.08;
        const fade = trailBase + (1 - s.trail) * 0.15;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
        this.ctx.fillRect(0, 0, w, h);

        // Hue rotando con el tiempo — modulado por energia del audio
        const hueSpeed = hasAudio ? (s.colorSpeed * 20 + reactiveEnergy * 70) : (s.colorSpeed * 20);
        const hue = (s.hueShift + timeSec * hueSpeed) % 360;
        const lines = Math.max(4, Math.round(s.lineCount));

        // Amplitud: si hay analyser reactivo, modulada por energia del audio
        // Si no hay analyser, fallback al comportamiento original (tiempo-basado)
        const baseMul = playing ? 1.0 : 0.3;
        let amplitude;
        if (hasAudio) {
            // Energia del audio controla la amplitud (0..1 mapeado a rango visual)
            amplitude = Math.min(w, h) * 0.12 * s.amplitude * (0.45 + reactiveEnergy * 2.1);
        } else {
            amplitude = Math.min(w, h) * 0.12 * s.amplitude * (0.7 + 0.3 * baseMul);
        }

        const freq = 0.004 * s.frequency;
        const animTime = timeSec * (playing ? 1.0 : 0.3);

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        // Linea mas gruesa cuando hay mucha energia
        this.ctx.lineWidth = hasAudio ? (1.4 + reactiveEnergy * 1.8) : 1.4;

        const waveLen = waveform ? waveform.length : 0;

        for (let i = 0; i < lines; i++) {
            const offset = (i / lines) * Math.PI * 2;
            // Alpha modulada por energia
            const alphaBase = (0.15 + s.glow * 0.25);
            const alpha = hasAudio
                ? alphaBase * (0.5 + reactiveEnergy * 0.9)
                : alphaBase * (playing ? 1 : 0.5);
            this.ctx.strokeStyle = `hsla(${(hue + i * 22) % 360}, 80%, 70%, ${alpha})`;
            this.ctx.beginPath();

            const steps = Math.ceil(w / 8);
            for (let step = 0; step <= steps; step++) {
                const x = step * 8;
                // Onda base procedural (siempre presente)
                const wave = Math.sin(x * freq + animTime + offset);
                const ripple = Math.cos(x * freq * 0.7 - animTime * 0.8 + offset) * 0.4;

                // Modulacion con waveform real del audio
                let audioMod = 0;
                if (hasAudio && waveform && waveLen > 0) {
                    // Mapear posicion x del canvas a posicion en el buffer de waveform
                    const waveIdx = Math.min(waveLen - 1, Math.floor((step / steps) * waveLen));
                    // waveData es 0..255 donde 128 es silencio
                    audioMod = ((waveform[waveIdx] - 128) / 128) * reactiveEnergy;
                }

                const y = h * 0.5
                    + (wave + ripple) * amplitude
                    + audioMod * amplitude * 1.15
                    + (i - lines / 2) * 12;

                if (x === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        }

        this.ctx.restore();
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

        // Ruta directa (no relativa a proyecto)
        this.element.src = path;
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
            this.element.play();
            this.isPlaying = true;
            this.updatePlayButton();
            this.saveState();
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
            this.element.src = track.file;
        } else {
            this.element.src = `./data/projects/${this.currentProjectSlug}/${track.file}`;
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
            this.element.play();
            this.isPlaying = true;
        }
        this.updatePlayButton();
        this.saveState();
    },

    updatePlayButton() {
        const btn = document.getElementById('play-btn');
        if (btn) btn.textContent = this.isPlaying ? '\u23F8' : '\u25B6';
    },

    playPrevious() {
        const idx = this.currentIndex <= 0 ? this.currentPlaylist.length - 1 : this.currentIndex - 1;
        this.loadTrack(idx);
        if (this.isPlaying) this.element.play();
    },

    playNext() {
        const idx = this.currentIndex >= this.currentPlaylist.length - 1 ? 0 : this.currentIndex + 1;
        this.loadTrack(idx);
        if (this.isPlaying) this.element.play();
    },

    seek(e) {
        if (!this.element.duration) return;
        this.element.currentTime = (e.target.value / 100) * this.element.duration;
    },

    updateProgress() {
        if (!this.element.duration) return;
        const progress = (this.element.currentTime / this.element.duration) * 100;
        const bar = document.getElementById('progress-bar');
        if (bar) bar.value = progress;
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
            const item = document.createElement('div');
            item.className = 'playlist-item' + (i === this.currentIndex ? ' active' : '');
            item.innerHTML = `<span class="pl-num">${i + 1}</span><span class="pl-name">${track.title}</span>`;
            item.addEventListener('click', () => {
                this.loadTrack(i);
                if (this.isPlaying) this.element.play();
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
            if (this.butterchurn && !this.bcReady) {
                this.setupButterchurn();
            }
            // Resize al tamaño real ahora que es visible
            if (this.bcReady) {
                requestAnimationFrame(() => this.resizeButterchurn());
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
            volume: this.element ? this.element.volume : 0.7,
            isBgm: this.isBgm
        };
    },

    saveState() {
        if (this._restoring) return;
        sessionStorage.setItem('dsm_player_state', JSON.stringify(this._buildState()));
    },

    restoreStateIfPlaying() {
        const saved = sessionStorage.getItem('dsm_player_state');
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            if (!state.playlist || state.playlist.length === 0) return false;
            if (!state.playing) return false; // Solo restaurar si estaba reproduciendo

            this._restoring = true;
            this.ensureAudioContext();

            this.currentPlaylist = state.playlist;
            this.currentProjectSlug = state.slug;
            this.currentIndex = state.index;
            this.element.volume = state.volume ?? 0.7;
            this.syncVolumeUI();
            this.isBgm = !!state.isBgm;
            this.element.loop = this.isBgm;

            const track = this.currentPlaylist[state.index];
            if (!track) { this._restoring = false; return false; }

            // Cargar track sin disparar saveState
            document.querySelector('#audio-player .track-title').textContent = track.title;
            document.querySelector('#audio-player .track-project').textContent = track.project;

            // BGM usa ruta directa, playlists usan ruta relativa al proyecto
            if (this.isBgm) {
                this.element.src = track.file;
            } else {
                this.element.src = `./data/projects/${this.currentProjectSlug}/${track.file}`;
            }

            this.show();
            this.renderPlaylistPanel();
            this.highlightPlaylistItem();

            this.element.addEventListener('loadedmetadata', () => {
                this.element.currentTime = state.time || 0;
                this.element.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this._restoring = false;
                    this.saveState();
                }).catch(() => {
                    // Autoplay bloqueado por browser — ocultar player
                    this.isPlaying = false;
                    this.updatePlayButton();
                    this._restoring = false;
                    if (this.playerEl) this.playerEl.classList.add('hidden');
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
