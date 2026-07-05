// ===== VISUALIZADOR BUTTERCHURN (MILKDROP WEBGL) =====
// Se apoya en el <audio> / AudioContext / analyser que gestiona DSM_Player;
// aqui solo vive el estado y las funciones propias de Butterchurn (presets,
// ciclo automatico, calidad adaptativa, recuperacion tras perdida de contexto
// WebGL). Interfaz que usa DSM_Player: init(player), onShow(), onResize(),
// renderFrame() (true si pinto, false para que el player use el fallback 2D).

const DSM_Visualizer = {
    player: null, // referencia a DSM_Player (canvas, canvasGL, audioCtx, analyser, isFullscreen)

    butterchurn: null,        // modulo butterchurn (cargado dinamicamente)
    visualizer: null,         // instancia del visualizador
    bcPresets: null,          // objeto { key: presetData } con los presets seleccionados
    bcPresetKeys: [],         // array de keys de presets
    bcPresetIndex: 0,         // indice del preset actual
    bcCycleInterval: null,    // intervalo para ciclar presets
    bcReady: false,           // true cuando butterchurn esta listo para renderizar
    bcRecovering: false,
    bcRenderFailCount: 0,
    bcRecoveryTimeout: null,
    bcLastRecoveryAt: 0,

    // Presets prioritarios — van al principio de la lista, en este orden
    BC_PRIORITY_PRESETS: [
        'martin - castle in the air',
        '_Mig_085',
        'Aderrasi - Potion of Spirits'
    ],
    BC_CYCLE_SECONDS: 18,     // segundos entre cambio de preset
    BC_BLEND_SECONDS: 2.7,    // duracion del crossfade entre presets
    bcAutoCycle: true,         // ciclo automatico activado por defecto
    BC_RENDER_BOOST_FULLSCREEN: 1.22,
    BC_RENDER_DPR_MAX_WINDOWED: 2,
    BC_RENDER_DPR_MAX_FULLSCREEN: 3,
    BC_RENDER_MAX_SIDE_WINDOWED: 3200,
    BC_RENDER_MAX_SIDE_FULLSCREEN: 4600,
    BC_ADAPTIVE_LOW_FPS: 45,
    BC_ADAPTIVE_HIGH_FPS: 56,
    BC_ADAPTIVE_MIN_SCALE: 0.62,
    BC_ADAPTIVE_DOWNSHIFT: 0.08,
    BC_ADAPTIVE_UPSHIFT: 0.04,
    BC_ADAPTIVE_COOLDOWN_MS: 1200,
    BC_ADAPTIVE_SMOOTHING: 0.12,
    BC_RENDER_FAIL_THRESHOLD: 3,
    BC_RECOVERY_COOLDOWN_MS: 3000,
    BC_RECOVERY_DELAY_MS: 650,
    renderQualityScale: 1,
    renderFpsEma: 60,
    renderLastFrameTs: 0,
    renderLastAdjustTs: 0,

    // ===== INTERFAZ LLAMADA POR DSM_Player =====
    init(player) {
        this.player = player;
    },

    isReady() {
        return this.bcReady;
    },

    // Reintenta el setup si hace falta y re-encuadra el canvas al mostrar el player
    onShow() {
        if (this.butterchurn && !this.bcReady) {
            this.setupButterchurn();
        }
    },

    onResize() {
        if (this.bcReady) this.resizeButterchurn();
    },

    // Se llama tras webglcontextrestored
    onContextRestored() {
        if (this.butterchurn && this.player.audioCtx && this.player.analyser) {
            this.setupButterchurn();
        }
    },

    // Se llama desde ensureAudioContext() cuando el AudioContext ya existe
    onAudioContextReady() {
        if (this.butterchurn && !this.bcReady) {
            this.setupButterchurn();
        }
    },

    renderFrame() {
        if (!this.bcReady || !this.visualizer) return false;
        try {
            this.visualizer.render();
            this.bcRenderFailCount = 0;
        } catch (err) {
            this.bcRenderFailCount += 1;
            console.warn(`DSM_Player: render Butterchurn fallo (${this.bcRenderFailCount}/${this.BC_RENDER_FAIL_THRESHOLD}):`, err?.message || err);
            if (this.bcRenderFailCount >= this.BC_RENDER_FAIL_THRESHOLD) {
                this.markButterchurnUnavailable('repeated render errors');
                this.scheduleButterchurnRecovery('render errors');
            }
        }
        return true;
    },

    // ===== BUTTERCHURN (MILKDROP VISUALIZER) =====
    initButterchurn() {
        // Verificar WebGL2 con canvas temporal
        if (!this.player.canvasGL) return;
        const testCanvas = document.createElement('canvas');
        if (!testCanvas.getContext('webgl2')) {
            console.warn('DSM_Player: WebGL2 no disponible, usando fallback de ondas');
            this.markButterchurnUnavailable('webgl2 unavailable');
            return;
        }

        // Cargar presets del pack base (window.base cargado via <script> tag)
        if (!window.base || !window.base.default) {
            console.warn('DSM_Player: Presets de Butterchurn no encontrados');
            this.markButterchurnUnavailable('presets missing');
            return;
        }

        const allPresets = window.base.default;
        const allKeys = Object.keys(allPresets);
        if (allKeys.length === 0) {
            console.warn('DSM_Player: Ningun preset encontrado en el pack');
            this.markButterchurnUnavailable('empty presets');
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
        if (!this.butterchurn || !this.player.canvasGL || !this.player.audioCtx || !this.player.analyser) return;
        if (this.bcReady) return; // Ya inicializado

        // Usar tamaño fijo si el player esta oculto (getBoundingClientRect devuelve 0)
        const rect = this.player.canvasGL.getBoundingClientRect();
        let { w, h, pixelRatio } = this.getRenderSize(rect, { fullscreenBoost: this.player.isFullscreen });
        // Fallback a tamaño razonable si el canvas no es visible aun
        if (w === 0 || h === 0) {
            w = 400; h = 400;
            pixelRatio = 1;
        }
        this.player.canvasGL.width = w;
        this.player.canvasGL.height = h;

        try {
            this.visualizer = this.butterchurn.createVisualizer(this.player.audioCtx, this.player.canvasGL, {
                width: w,
                height: h,
                pixelRatio,
                textureRatio: 1
            });

            // Conectar nuestro analyser existente
            this.visualizer.connectAudio(this.player.analyser);

            // Cargar primer preset — siempre empieza por el primero (castle in the air)
            this.bcPresetIndex = 0;
            this.visualizer.loadPreset(this.bcPresets[this.bcPresetKeys[0]], 0.0);

            // Ocultar canvas 2D, mostrar WebGL
            this.player.canvas.style.display = 'none';
            this.player.canvasGL.style.display = 'block';
            this.bcReady = true;
            this.bcRecovering = false;
            this.bcRenderFailCount = 0;

            // Actualizar controles/nombre de preset con el estado real del visualizador
            this.updateAutoCycleBtn();
            this.updatePresetNavUI();

            // Iniciar ciclo de presets
            this.startPresetCycle();
        } catch (err) {
            console.warn('DSM_Player: Error inicializando Butterchurn:', err.message);
            this.bcRecovering = false;
            this.markButterchurnUnavailable('setup error');
            this.scheduleButterchurnRecovery('setup error');
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

    updatePresetNavUI() {
        const prevBtn = document.getElementById('preset-prev-btn');
        const nextBtn = document.getElementById('preset-next-btn');
        const cycleBtn = document.getElementById('preset-cycle-btn');
        const nameEl = document.getElementById('preset-nav-name');
        const controlsVisible = this.bcReady && this.bcPresetKeys.length > 0;

        [prevBtn, nextBtn, cycleBtn].forEach((btn) => {
            if (!btn) return;
            btn.classList.toggle('hidden', !controlsVisible);
            btn.disabled = !controlsVisible;
            btn.setAttribute('aria-hidden', String(!controlsVisible));
        });

        if (!nameEl) return;
        if (this.bcRecovering) {
            nameEl.textContent = 'reconectando visual...';
            return;
        }
        if (!controlsVisible) {
            nameEl.textContent = 'visual base';
            return;
        }
        nameEl.textContent = this.bcPresetKeys[this.bcPresetIndex] || '—';
    },

    updateAutoCycleBtn() {
        const btn = document.getElementById('preset-cycle-btn');
        if (!btn) return;
        const actionLabel = this.bcAutoCycle ? 'pausar ciclo' : 'activar ciclo';
        btn.innerHTML = this.bcAutoCycle ? ICONS.pause(10) : ICONS.play(10);
        btn.title = actionLabel;
        btn.setAttribute('aria-label', actionLabel);
    },

    updateAdaptiveQuality(now) {
        if (!Number.isFinite(now)) return;
        if (this.renderLastFrameTs > 0) {
            const dt = now - this.renderLastFrameTs;
            if (dt > 0 && dt < 1000) {
                const fps = 1000 / dt;
                this.renderFpsEma += (fps - this.renderFpsEma) * this.BC_ADAPTIVE_SMOOTHING;
            }
        }
        this.renderLastFrameTs = now;

        if (now - this.renderLastAdjustTs < this.BC_ADAPTIVE_COOLDOWN_MS) return;

        let nextScale = this.renderQualityScale;
        if (this.renderFpsEma < this.BC_ADAPTIVE_LOW_FPS && nextScale > this.BC_ADAPTIVE_MIN_SCALE) {
            nextScale = Math.max(this.BC_ADAPTIVE_MIN_SCALE, nextScale - this.BC_ADAPTIVE_DOWNSHIFT);
        } else if (this.renderFpsEma > this.BC_ADAPTIVE_HIGH_FPS && nextScale < 1) {
            nextScale = Math.min(1, nextScale + this.BC_ADAPTIVE_UPSHIFT);
        }

        if (nextScale !== this.renderQualityScale) {
            this.renderQualityScale = Number(nextScale.toFixed(3));
            this.renderLastAdjustTs = now;
            this.player.scheduleRendererResize();
        }
    },

    markButterchurnUnavailable(reason) {
        this.bcReady = false;
        this.visualizer = null;
        this.bcRenderFailCount = 0;
        if (this.bcCycleInterval) clearInterval(this.bcCycleInterval);
        this.bcCycleInterval = null;
        if (this.player.canvasGL) this.player.canvasGL.style.display = 'none';
        if (this.player.canvas) this.player.canvas.style.display = 'block';
        this.updatePresetNavUI();
        this.updateAutoCycleBtn();
        if (reason) console.warn(`DSM_Player: Butterchurn desactivado (${reason})`);
    },

    scheduleButterchurnRecovery(reason = 'recovery') {
        if (this.bcRecoveryTimeout) return;
        const now = Date.now();
        if (now - this.bcLastRecoveryAt < this.BC_RECOVERY_COOLDOWN_MS) return;

        this.bcRecovering = true;
        this.updatePresetNavUI();
        this.bcRecoveryTimeout = setTimeout(() => {
            this.bcRecoveryTimeout = null;
            this.bcLastRecoveryAt = Date.now();

            if (!this.player.playerEl || this.player.playerEl.classList.contains('hidden')) {
                this.bcRecovering = false;
                this.updatePresetNavUI();
                return;
            }
            if (!this.butterchurn || !this.player.audioCtx || !this.player.analyser || !this.player.canvasGL) {
                this.bcRecovering = false;
                this.updatePresetNavUI();
                return;
            }
            console.info(`DSM_Player: intentando recuperar Butterchurn (${reason})`);
            this.setupButterchurn();
        }, this.BC_RECOVERY_DELAY_MS);
    },

    getRenderSize(rect, { fullscreenBoost = false } = {}) {
        const width = Math.max(0, rect.width || 0);
        const height = Math.max(0, rect.height || 0);
        if (width === 0 || height === 0) {
            return { w: 0, h: 0, pixelRatio: 1 };
        }
        const baseDpr = window.devicePixelRatio || 1;
        const adaptiveScale = Math.max(this.BC_ADAPTIVE_MIN_SCALE, Math.min(1, this.renderQualityScale || 1));

        const dprTarget = fullscreenBoost
            ? Math.min(baseDpr * this.BC_RENDER_BOOST_FULLSCREEN * adaptiveScale, this.BC_RENDER_DPR_MAX_FULLSCREEN)
            : Math.min(baseDpr * adaptiveScale, this.BC_RENDER_DPR_MAX_WINDOWED);

        let w = Math.round(width * dprTarget);
        let h = Math.round(height * dprTarget);

        const maxSide = fullscreenBoost
            ? this.BC_RENDER_MAX_SIDE_FULLSCREEN
            : this.BC_RENDER_MAX_SIDE_WINDOWED;
        const longest = Math.max(w, h);
        let effectiveDpr = dprTarget;

        if (longest > maxSide) {
            const scale = maxSide / longest;
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
            effectiveDpr = dprTarget * scale;
        }

        return { w, h, pixelRatio: effectiveDpr };
    },

    resizeButterchurn() {
        if (!this.visualizer || !this.player.canvasGL) return;
        const rect = this.player.canvasGL.getBoundingClientRect();
        const { w, h } = this.getRenderSize(rect, { fullscreenBoost: this.player.isFullscreen });
        if (w === 0 || h === 0) return;
        this.player.canvasGL.width = w;
        this.player.canvasGL.height = h;
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
        this.updatePresetNavUI();
    }
};
