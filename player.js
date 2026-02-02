// ===== REPRODUCTOR DE AUDIO GLOBAL (persiste entre paginas) =====

const DSM_Player = {
    element: null,
    canvas: null,
    ctx: null,
    currentPlaylist: [],
    currentIndex: 0,
    currentProjectSlug: '',
    isPlaying: false,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    animationId: null,
    particles: [],
    playlistOpen: false,

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
        this.restoreState();
        this.initParticles();
        this.animate();
    },

    // ===== CREAR DOM DEL REPRODUCTOR =====
    createPlayerDOM() {
        // Eliminar player viejo si existe
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

        // Restaurar posicion
        const savedPos = sessionStorage.getItem('dsm_player_pos');
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            player.style.left = pos.x + 'px';
            player.style.top = pos.y + 'px';
            player.style.bottom = 'auto';
            player.style.right = 'auto';
        }
    },

    // ===== EVENTOS =====
    setupEvents() {
        document.getElementById('play-btn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prev-btn').addEventListener('click', () => this.playPrevious());
        document.getElementById('next-btn').addEventListener('click', () => this.playNext());
        document.getElementById('playlist-btn').addEventListener('click', () => this.togglePlaylist());
        document.querySelector('.player-close').addEventListener('click', () => this.close());
        document.querySelector('.playlist-close').addEventListener('click', () => this.togglePlaylist());
        document.getElementById('progress-bar').addEventListener('input', (e) => this.seek(e));

        this.element.addEventListener('timeupdate', () => this.updateProgress());
        this.element.addEventListener('ended', () => this.playNext());
        this.element.addEventListener('loadedmetadata', () => this.updateDuration());

        // Drag
        const handle = this.playerEl.querySelector('.player-drag-handle');
        handle.addEventListener('mousedown', (e) => this.startDrag(e));
        handle.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        document.addEventListener('mouseup', () => this.endDrag());
        document.addEventListener('touchend', () => this.endDrag());
    },

    // ===== DRAG =====
    startDrag(e) {
        e.preventDefault();
        this.isDragging = true;
        const rect = this.playerEl.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;
        this.playerEl.style.transition = 'none';
    },

    onDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let x = clientX - this.dragOffset.x;
        let y = clientY - this.dragOffset.y;

        // Limitar a viewport
        const size = this.playerEl.offsetWidth;
        x = Math.max(0, Math.min(x, window.innerWidth - size));
        y = Math.max(0, Math.min(y, window.innerHeight - size));

        this.playerEl.style.left = x + 'px';
        this.playerEl.style.top = y + 'px';
        this.playerEl.style.bottom = 'auto';
        this.playerEl.style.right = 'auto';
    },

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.playerEl.style.transition = '';
        // Guardar posicion
        const rect = this.playerEl.getBoundingClientRect();
        sessionStorage.setItem('dsm_player_pos', JSON.stringify({ x: rect.left, y: rect.top }));
    },

    // ===== AMBIENCE PARTICLES =====
    initParticles() {
        this.particles = [];
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                r: Math.random() * 3 + 1,
                vx: (Math.random() - 0.5) * 0.003,
                vy: (Math.random() - 0.5) * 0.003,
                alpha: Math.random() * 0.5 + 0.1,
                pulse: Math.random() * Math.PI * 2
            });
        }
    },

    animate() {
        if (!this.canvas) return;
        const w = this.canvas.width = this.canvas.offsetWidth * 2;
        const h = this.canvas.height = this.canvas.offsetHeight * 2;
        this.ctx.clearRect(0, 0, w, h);

        const playing = this.isPlaying;
        const time = Date.now() * 0.001;

        // Fondo gradiente sutil
        const grad = this.ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
        grad.addColorStop(0, 'rgba(15, 15, 25, 0.95)');
        grad.addColorStop(1, 'rgba(5, 5, 10, 0.98)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        // Ondas de fondo
        if (playing) {
            for (let wave = 0; wave < 3; wave++) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = `rgba(100, 160, 255, ${0.04 + wave * 0.02})`;
                this.ctx.lineWidth = 1;
                for (let x = 0; x < w; x += 2) {
                    const y = h / 2 + Math.sin(x * 0.01 + time * (1 + wave * 0.5) + wave) * (20 + wave * 15) * (playing ? 1 : 0.2);
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
            }
        }

        // Particulas
        this.particles.forEach(p => {
            const speed = playing ? 1 : 0.15;
            p.x += p.vx * speed;
            p.y += p.vy * speed;
            p.pulse += 0.02 * speed;

            // Wrap
            if (p.x < 0) p.x = 1;
            if (p.x > 1) p.x = 0;
            if (p.y < 0) p.y = 1;
            if (p.y > 1) p.y = 0;

            const px = p.x * w;
            const py = p.y * h;
            const pulseR = p.r + Math.sin(p.pulse) * (playing ? 1.5 : 0.5);
            const alpha = p.alpha * (playing ? (0.6 + Math.sin(p.pulse) * 0.4) : 0.25);

            this.ctx.beginPath();
            this.ctx.arc(px, py, pulseR * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(120, 180, 255, ${alpha})`;
            this.ctx.fill();

            // Glow
            if (playing) {
                this.ctx.beginPath();
                this.ctx.arc(px, py, pulseR * 5, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(80, 140, 255, ${alpha * 0.15})`;
                this.ctx.fill();
            }
        });

        // Lineas conectando particulas cercanas
        if (playing) {
            for (let i = 0; i < this.particles.length; i++) {
                for (let j = i + 1; j < this.particles.length; j++) {
                    const a = this.particles[i];
                    const b = this.particles[j];
                    const dx = (a.x - b.x) * w;
                    const dy = (a.y - b.y) * h;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < w * 0.15) {
                        const lineAlpha = (1 - dist / (w * 0.15)) * 0.08;
                        this.ctx.beginPath();
                        this.ctx.moveTo(a.x * w, a.y * h);
                        this.ctx.lineTo(b.x * w, b.y * h);
                        this.ctx.strokeStyle = `rgba(100, 160, 255, ${lineAlpha})`;
                        this.ctx.lineWidth = 0.5;
                        this.ctx.stroke();
                    }
                }
            }
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    },

    // ===== CARGAR PLAYLIST =====
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

        const audioPath = `./data/projects/${this.currentProjectSlug}/${track.file}`;
        this.element.src = audioPath;
        this.saveState();
        this.highlightPlaylistItem();
    },

    // ===== CONTROLES =====
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
        let idx = this.currentIndex - 1;
        if (idx < 0) idx = this.currentPlaylist.length - 1;
        this.loadTrack(idx);
        if (this.isPlaying) this.element.play();
    },

    playNext() {
        let idx = this.currentIndex + 1;
        if (idx >= this.currentPlaylist.length) idx = 0;
        this.loadTrack(idx);
        if (this.isPlaying) this.element.play();
    },

    seek(e) {
        const seekTime = (e.target.value / 100) * this.element.duration;
        this.element.currentTime = seekTime;
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
        if (panel) {
            panel.classList.toggle('hidden', !this.playlistOpen);
        }
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
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, i) => {
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
        sessionStorage.removeItem('dsm_player_state');
    },

    // ===== PERSISTENCIA =====
    saveState() {
        const state = {
            playlist: this.currentPlaylist,
            slug: this.currentProjectSlug,
            index: this.currentIndex,
            playing: this.isPlaying,
            time: this.element ? this.element.currentTime : 0,
            volume: this.element ? this.element.volume : 0.7
        };
        sessionStorage.setItem('dsm_player_state', JSON.stringify(state));
    },

    restoreState() {
        const saved = sessionStorage.getItem('dsm_player_state');
        if (!saved) return;

        try {
            const state = JSON.parse(saved);
            if (!state.playlist || state.playlist.length === 0) return;

            this.currentPlaylist = state.playlist;
            this.currentProjectSlug = state.slug;
            this.currentIndex = state.index;
            this.element.volume = state.volume || 0.7;

            this.loadTrack(state.index);
            this.show();
            this.renderPlaylistPanel();

            // Restaurar posicion y auto-play
            this.element.addEventListener('loadedmetadata', () => {
                this.element.currentTime = state.time || 0;
                if (state.playing) {
                    this.element.play().then(() => {
                        this.isPlaying = true;
                        this.updatePlayButton();
                    }).catch(() => {
                        // Autoplay bloqueado por browser
                        this.isPlaying = false;
                        this.updatePlayButton();
                    });
                }
            }, { once: true });
        } catch (e) {
            // Silently fail
        }
    }
};

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', () => {
    DSM_Player.init();
});
