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
    controlsVisible: false,
    controlsTimeout: null,
    animationId: null,
    _restoring: false,

    // Ambience settings (del generador de fondos)
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
        this.setupEvents();
        this.restoreStateIfPlaying();
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
            <div class="player-overlay">
                <div class="player-drag-handle">
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
                        <button class="control-btn" id="prev-btn">&#x23EE;</button>
                        <button class="control-btn" id="play-btn">&#x25B6;</button>
                        <button class="control-btn" id="next-btn">&#x23ED;</button>
                        <button class="control-btn" id="playlist-btn">&#x2630;</button>
                    </div>
                    <div class="player-time">
                        <span class="time-current">0:00</span>
                        <span class="time-sep">/</span>
                        <span class="time-total">0:00</span>
                    </div>
                </div>
            </div>
            <div id="playlist-panel" class="playlist-panel hidden">
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

    // ===== AMBIENCE ANIMATION (adaptado del generador de fondos) =====
    animate() {
        if (!this.canvas) return;

        // No renderizar si el player esta oculto (ahorra CPU)
        if (this.playerEl && this.playerEl.classList.contains('hidden')) {
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

        // Trail fade (fondo semitransparente para efecto estela)
        const fade = 0.08 + (1 - s.trail) * 0.15;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
        this.ctx.fillRect(0, 0, w, h);

        // Hue rotando con el tiempo
        const hue = (s.hueShift + timeSec * s.colorSpeed * 20) % 360;
        const lines = Math.max(4, Math.round(s.lineCount));

        // Amplitud y velocidad reducidas cuando no reproduce
        const mul = playing ? 1.0 : 0.3;
        const amplitude = Math.min(w, h) * 0.12 * s.amplitude * (0.7 + 0.3 * mul);
        const freq = 0.004 * s.frequency;
        const animTime = timeSec * (playing ? 1.0 : 0.3);

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.lineWidth = 1.4;

        for (let i = 0; i < lines; i++) {
            const offset = (i / lines) * Math.PI * 2;
            const alpha = (0.15 + s.glow * 0.25) * (playing ? 1 : 0.5);
            this.ctx.strokeStyle = `hsla(${(hue + i * 22) % 360}, 80%, 70%, ${alpha})`;
            this.ctx.beginPath();
            for (let x = 0; x <= w; x += 8) {
                const wave = Math.sin(x * freq + animTime + offset);
                const ripple = Math.cos(x * freq * 0.7 - animTime * 0.8 + offset) * 0.4;
                const y = h * 0.5 + (wave + ripple) * amplitude + (i - lines / 2) * 12;
                if (x === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        }

        this.ctx.restore();
        this.animationId = requestAnimationFrame(() => this.animate());
    },

    // ===== PLAYLIST =====
    loadPlaylist(playlist, projectSlug, startIndex = 0) {
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

        this.element.src = `./data/projects/${this.currentProjectSlug}/${track.file}`;
        this.saveState();
        this.highlightPlaylistItem();
    },

    // ===== CONTROLES DE REPRODUCCION =====
    togglePlay() {
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
        if (this.playerEl) this.playerEl.classList.remove('hidden');
    },

    close() {
        this.element.pause();
        this.isPlaying = false;
        if (this.playerEl) this.playerEl.classList.add('hidden');
        this.updatePlayButton();
        this.hideControls();
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
            volume: this.element ? this.element.volume : 0.7
        };
    },

    saveState() {
        if (this._restoring) return;
        sessionStorage.setItem('dsm_player_state', JSON.stringify(this._buildState()));
    },

    restoreStateIfPlaying() {
        const saved = sessionStorage.getItem('dsm_player_state');
        if (!saved) return;

        try {
            const state = JSON.parse(saved);
            if (!state.playlist || state.playlist.length === 0) return;
            if (!state.playing) return; // Solo restaurar si estaba reproduciendo

            this._restoring = true;

            this.currentPlaylist = state.playlist;
            this.currentProjectSlug = state.slug;
            this.currentIndex = state.index;
            this.element.volume = state.volume || 0.7;

            const track = this.currentPlaylist[state.index];
            if (!track) { this._restoring = false; return; }

            // Cargar track sin disparar saveState
            document.querySelector('#audio-player .track-title').textContent = track.title;
            document.querySelector('#audio-player .track-project').textContent = track.project;
            this.element.src = `./data/projects/${this.currentProjectSlug}/${track.file}`;

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
        } catch (e) {
            this._restoring = false;
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
