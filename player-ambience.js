// ===== AMBIENCE 2D (fallback de ondas sin WebGL2 / Butterchurn) =====
// Renderer procedural puro: no guarda estado propio, solo pinta sobre el
// canvas 2D que le pasa DSM_Player en cada frame de animate().

const DSM_Ambience = {
    render(ctx, canvas, opts) {
        const w = canvas.width;
        const h = canvas.height;
        const timeSec = (Date.now() - opts.startTime) * 0.001;
        const playing = opts.isPlaying;
        const s = opts.settings;

        // Leer datos de audio si el analyser esta disponible
        const energy = opts.energy || 0;
        const reactiveEnergy = Math.min(1, Math.pow(energy, 0.72) * 1.35);
        const waveform = opts.waveform; // null si no hay analyser
        const hasAudio = opts.hasAnalyser && playing && reactiveEnergy > 0.01;

        // Trail fade (fondo semitransparente para efecto estela)
        // Cuando hay audio reactivo, trail mas largo para efecto mas fluido
        const trailBase = hasAudio ? 0.06 : 0.08;
        const fade = trailBase + (1 - s.trail) * 0.15;
        ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
        ctx.fillRect(0, 0, w, h);

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

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Linea mas gruesa cuando hay mucha energia
        ctx.lineWidth = hasAudio ? (1.4 + reactiveEnergy * 1.8) : 1.4;

        const waveLen = waveform ? waveform.length : 0;

        for (let i = 0; i < lines; i++) {
            const offset = (i / lines) * Math.PI * 2;
            // Alpha modulada por energia
            const alphaBase = (0.15 + s.glow * 0.25);
            const alpha = hasAudio
                ? alphaBase * (0.5 + reactiveEnergy * 0.9)
                : alphaBase * (playing ? 1 : 0.5);
            ctx.strokeStyle = `hsla(${(hue + i * 22) % 360}, 80%, 70%, ${alpha})`;
            ctx.beginPath();

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

                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        ctx.restore();
    }
};
