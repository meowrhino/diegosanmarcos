const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d", { alpha: false });

const audio = document.getElementById("player");
const audioStatus = document.getElementById("audioStatus");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const muteBtn = document.getElementById("muteBtn");
const volumeSlider = document.getElementById("volume");
const volumeValue = document.getElementById("volumeValue");
const progressSlider = document.getElementById("progress");
const progressValue = document.getElementById("progressValue");
const playlistEl = document.getElementById("playlist");
const playlistEmpty = document.getElementById("playlistEmpty");
const randomBtn = document.getElementById("randomBtn");

const palettes = [
  { name: "Amanecer cálido", sea1: "#0b2a4a", sea2: "#116e8a" },
  { name: "Azul limpio", sea1: "#061a2d", sea2: "#0aa6c2" },
  { name: "Noche violeta", sea1: "#040614", sea2: "#1b3a8a" },
  { name: "Verde raro", sea1: "#041214", sea2: "#0a7c8c" }
];

let audioContext;
let analyser;
let gainNode;
let sourceNode;
let freqData;
let timeData;
let isMuted = true;
let desiredVolume = 0.6;
let playlist = [];
let currentTrackIndex = 0;

const dprCap = 2;
let currentSeed = (Date.now() & 0xffffffff) >>> 0;
let lastTime = 0;

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureAudioGraph() {
  if (audioContext) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
  gainNode = audioContext.createGain();
  gainNode.gain.value = 0;
  sourceNode = audioContext.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(audioContext.destination);
}

function updateGain() {
  if (!gainNode) return;
  gainNode.gain.value = isMuted ? 0 : desiredVolume;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function updateStatus() {
  const mutedLabel = isMuted ? "Muteado" : "Sonando";
  const playLabel = audio.paused ? "Pausado" : "Reproduciendo";
  audioStatus.textContent = `${mutedLabel} · ${playLabel}`;
  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
}

function updateProgress() {
  if (!audio.duration) return;
  const progress = audio.currentTime / audio.duration;
  progressSlider.value = progress;
  progressValue.textContent = formatTime(audio.currentTime);
}

function setTrack(index) {
  if (!playlist.length) return;
  currentTrackIndex = (index + playlist.length) % playlist.length;
  const track = playlist[currentTrackIndex];
  audio.src = track.src;
  audio.play().catch(() => {
    updateStatus();
  });
  highlightPlaylist();
}

function highlightPlaylist() {
  const items = playlistEl.querySelectorAll("li");
  items.forEach((item, idx) => {
    item.dataset.active = idx === currentTrackIndex ? "true" : "false";
  });
}

function buildPlaylist() {
  playlistEl.innerHTML = "";
  playlistEmpty.style.display = playlist.length ? "none" : "block";
  playlist.forEach((track, index) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = track.title || `Track ${index + 1}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Play";
    button.addEventListener("click", () => {
      ensureAudioGraph();
      audioContext.resume();
      setTrack(index);
    });
    item.appendChild(label);
    item.appendChild(button);
    playlistEl.appendChild(item);
  });
  highlightPlaylist();
}

function getAudioMetrics() {
  if (!analyser) {
    return {
      avg: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      freqData: null,
      timeData: null
    };
  }

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const len = freqData.length;
  let total = 0;
  let bass = 0;
  let mid = 0;
  let treble = 0;
  const bassEnd = Math.floor(len * 0.15);
  const midEnd = Math.floor(len * 0.55);

  for (let i = 0; i < len; i++) {
    const value = freqData[i];
    total += value;
    if (i < bassEnd) bass += value;
    else if (i < midEnd) mid += value;
    else treble += value;
  }

  const avg = total / len / 255;
  const bassAvg = bass / Math.max(1, bassEnd) / 255;
  const midAvg = mid / Math.max(1, midEnd - bassEnd) / 255;
  const trebleAvg = treble / Math.max(1, len - midEnd) / 255;

  return {
    avg,
    bass: bassAvg,
    mid: midAvg,
    treble: trebleAvg,
    freqData: freqData,
    timeData: timeData
  };
}

function resize() {
  const dpr = Math.max(1, Math.min(dprCap, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  alchemyState.resize(window.innerWidth, window.innerHeight, dpr);
}

function drawGrain(context, rand, w, h, density) {
  const grainDensity = Math.max(0, density || 0);
  if (grainDensity <= 0) return;
  const grainN = Math.floor((w * h) / 18000 * grainDensity);
  context.globalAlpha = 0.06;
  context.fillStyle = "#ffffff";
  for (let i = 0; i < grainN; i++) {
    const x = rand() * w;
    const y = rand() * h;
    context.fillRect(x, y, 1, 1);
  }
  context.globalAlpha = 1;
}

function drawSea(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const seaGrad = context.createLinearGradient(0, 0, 0, h);
  seaGrad.addColorStop(0, pal.sea2);
  seaGrad.addColorStop(1, pal.sea1);
  context.fillStyle = seaGrad;
  context.fillRect(0, 0, w, h);

  const waveCount = Math.max(20, Math.round(settings.waveCount));
  const ampBoost = 0.7 + audioData.bass * 1.2;
  const ampBase = (6 + rand() * 12) * settings.waveAmp * ampBoost;
  const freqBase = (0.010 + rand() * 0.018) * settings.waveFreq;
  const speedish = 0.8 + rand() * 1.5;
  const waveTime = timeSec * (0.9 + speedish * 0.4) * settings.waveSpeed;

  context.lineWidth = 1;
  for (let i = 0; i < waveCount; i++) {
    const progress = i / (waveCount - 1);
    const y = progress * h;
    const depth = progress * progress;
    const amp = ampBase * (0.35 + depth * 1.35);
    const freq = freqBase * (0.7 + depth * 1.15);
    const phase = i * 0.13 + waveTime;

    const alpha = 0.05 + (1 - progress) * 0.06;
    context.strokeStyle = `rgba(255,255,255,${alpha})`;

    context.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const dy = Math.sin(x * freq + phase) * amp;
      const bump = Math.sin(x * (freq * 0.55) - phase * 1.7) * (amp * 0.35);
      const yy = y + dy + bump;
      if (x === 0) context.moveTo(x, yy);
      else context.lineTo(x, yy);
    }
    context.stroke();
  }
}

function drawBars(context, rand, pal, w, h, time, settings, audioData) {
  const bars = Math.max(16, Math.round(settings.barCount));
  const barWidth = (w / bars) * settings.barWidth;
  const gap = (w - bars * barWidth) / bars;
  const hueBase = (settings.hueShift + audioData.avg * 120) % 360;

  const bg = context.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsla(${hueBase}, 24%, 14%, 1)`);
  bg.addColorStop(1, "rgba(2,3,9,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  const data = audioData.freqData;
  if (!data) return;

  const step = Math.max(1, Math.floor(data.length / bars));
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += data[i * step + j] || 0;
    }
    const level = sum / step / 255;
    const height = Math.max(6, level * h * 0.75);
    const x = i * (barWidth + gap);
    const hue = (hueBase + i * 4) % 360;
    const alpha = Math.min(1, (0.25 + level) * settings.glow);
    context.fillStyle = `hsla(${hue}, 80%, 65%, ${alpha})`;
    context.fillRect(x, h - height, barWidth, height);
  }

  context.restore();
}

function drawScope(context, rand, pal, w, h, time, settings, audioData) {
  const baseHue = (settings.hueShift + audioData.treble * 120) % 360;
  context.fillStyle = "rgba(2,3,8,1)";
  context.fillRect(0, 0, w, h);

  if (!audioData.timeData) return;
  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `hsla(${baseHue}, 90%, 70%, ${0.5 + settings.glow * 0.5})`;
  context.lineWidth = settings.lineWidth * 2;

  const slice = w / audioData.timeData.length;
  const amp = (h * 0.35) * (0.4 + settings.amplitude) * (0.6 + audioData.avg);
  context.beginPath();
  let x = 0;
  for (let i = 0; i < audioData.timeData.length; i++) {
    const v = audioData.timeData[i] / 255;
    const y = h * 0.5 + (v - 0.5) * amp;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
    x += slice;
  }
  context.stroke();
  context.restore();
}

function drawBrightsphere(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const hue = Math.floor(rand() * 360);
  const cx = w * 0.5 + Math.sin(timeSec * 0.18) * w * 0.03;
  const cy = h * 0.48 + Math.cos(timeSec * 0.15) * h * 0.03;
  const coreRadius = Math.min(w, h) * 0.14 * settings.coreSize * (0.8 + audioData.bass * 0.8);
  const glow = Math.max(0, settings.glow) * (0.7 + audioData.avg * 0.9);
  const orbCount = Math.max(8, Math.round(settings.orbCount));
  const orbitSpread = settings.orbitSpread;
  const spin = settings.spin;
  const orbSize = settings.orbSize;

  const bg = context.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
  bg.addColorStop(0, `hsla(${hue}, 30%, 18%, 1)`);
  bg.addColorStop(1, "rgba(3,5,12,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.globalCompositeOperation = "lighter";

  const coreGlow = context.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * (1.6 + glow));
  coreGlow.addColorStop(0, `hsla(${hue}, 85%, 90%, ${Math.min(1, 0.8 * glow)})`);
  coreGlow.addColorStop(0.4, `hsla(${hue}, 70%, 65%, ${Math.min(1, 0.45 * glow)})`);
  coreGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = coreGlow;
  context.fillRect(cx - coreRadius * 3, cy - coreRadius * 3, coreRadius * 6, coreRadius * 6);

  context.strokeStyle = `rgba(180,220,255,${Math.min(0.2, 0.1 * glow)})`;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(cx, cy, coreRadius * 1.1, coreRadius * 0.85, 0, 0, Math.PI * 2);
  context.stroke();

  for (let i = 0; i < orbCount; i++) {
    const dir = rand() < 0.5 ? 1 : -1;
    const angle = timeSec * (0.6 + spin) * dir + rand() * Math.PI * 2;
    const radius = coreRadius * (0.8 + rand() * (1.4 * orbitSpread));
    const tilt = 0.45 + rand() * 0.55;
    const wobble = 0.85 + rand() * 0.3;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle * wobble) * radius * tilt;
    const size = (0.7 + rand() * 1.6) * orbSize;
    const alpha = Math.min(1, (0.12 + rand() * 0.35) * glow);
    const localHue = (hue + rand() * 40 - 20 + 360) % 360;
    context.fillStyle = `hsla(${localHue}, 80%, 75%, ${alpha})`;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawCominatcha(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const baseHue = Math.floor(rand() * 360);
  const cx = w * 0.5;
  const cy = h * 0.5;

  const bg = context.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsla(${baseHue}, 28%, 14%, 1)`);
  bg.addColorStop(1, "rgba(2,3,8,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.globalCompositeOperation = "lighter";

  const count = Math.max(3, Math.round(settings.cometCount));
  const tail = Math.max(4, Math.round(settings.tailLength));
  const speed = settings.speed * (0.7 + audioData.avg * 1.2);
  const spread = settings.spread;
  const thickness = settings.thickness;
  const glow = settings.glow * (0.7 + audioData.treble * 1.2);

  for (let i = 0; i < count; i++) {
    const phase = rand() * Math.PI * 2;
    const orbitSpeed = (0.4 + rand() * 1.4) * speed;
    const radius = Math.min(w, h) * (0.16 + rand() * 0.34) * spread;
    const axis = 0.35 + rand() * 0.65;
    const wobble = 0.85 + rand() * 0.3;
    const hue = (baseHue + rand() * 120) % 360;

    for (let j = 0; j < tail; j++) {
      const t = timeSec - j * 0.05;
      const angle = t * orbitSpeed + phase;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle * wobble) * radius * axis;
      const size = (1.6 - j / tail) * thickness;
      const alpha = Math.min(1, (1 - j / tail) * 0.35 * glow);
      context.fillStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
      context.beginPath();
      context.arc(x, y, Math.max(0.2, size), 0, Math.PI * 2);
      context.fill();
    }
  }

  context.restore();
}

function drawRibbons(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const baseHue = (Math.floor(rand() * 360) + settings.hueShift) % 360;
  const ribbonCount = Math.max(2, Math.round(settings.ribbonCount));
  const amplitude = h * 0.07 * settings.amplitude * (0.8 + audioData.avg * 1.1);
  const freqBase = 0.0025 * settings.frequency;
  const speed = settings.speed * (0.8 + audioData.mid);
  const thickness = settings.thickness;
  const glow = Math.max(0, settings.glow) * (0.7 + audioData.treble);

  const bg = context.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsla(${(baseHue + 20) % 360}, 24%, 16%, 1)`);
  bg.addColorStop(1, "rgba(3,5,12,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineJoin = "round";
  context.lineCap = "round";

  for (let i = 0; i < ribbonCount; i++) {
    const t = ribbonCount === 1 ? 0.5 : i / (ribbonCount - 1);
    const baseY = h * (0.2 + t * 0.6);
    const phase = timeSec * (0.6 + t) * speed + rand() * Math.PI * 2;
    const hue = (baseHue + t * 120 + i * 8) % 360;
    const alpha = Math.min(1, (0.12 + 0.12 * glow));
    const lineWidth = (1.2 + t * 2.2) * thickness;

    context.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha})`;
    context.lineWidth = lineWidth;
    context.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const wave = Math.sin(x * freqBase + phase);
      const ripple = Math.sin(x * freqBase * 0.45 - phase * 1.2) * 0.45;
      const y = baseY + (wave + ripple) * amplitude;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();

    context.strokeStyle = `hsla(${hue}, 90%, 75%, ${Math.min(1, 0.08 * glow)})`;
    context.lineWidth = lineWidth * 2.4;
    context.stroke();
  }

  context.restore();
}

function drawPulsegrid(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const baseHue = (Math.floor(rand() * 360) + settings.hueShift) % 360;
  const grid = Math.max(4, Math.round(settings.grid));
  const cols = grid;
  const rows = Math.max(4, Math.round(grid * h / w));
  const cellW = w / (cols + 1);
  const cellH = h / (rows + 1);
  const pulseSpeed = settings.pulseSpeed * (0.8 + audioData.avg * 1.3);
  const pulseSize = settings.pulseSize * (0.7 + audioData.bass * 1.4);
  const jitter = settings.jitter;
  const glow = Math.max(0, settings.glow) * (0.7 + audioData.mid);

  const bg = context.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsla(${(baseHue + 10) % 360}, 22%, 14%, 1)`);
  bg.addColorStop(1, "rgba(2,4,10,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.globalCompositeOperation = "lighter";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const phase = timeSec * (1.4 * pulseSpeed) + rand() * Math.PI * 2 + (r + c) * 0.15;
      const intensity = 0.5 + 0.5 * Math.sin(phase);
      const x = (c + 1) * cellW + (rand() - 0.5) * cellW * 0.4 * jitter;
      const y = (r + 1) * cellH + (rand() - 0.5) * cellH * 0.4 * jitter;
      const radius = Math.min(cellW, cellH) * 0.12 * pulseSize * (0.4 + intensity);
      const hue = (baseHue + c * 6 + r * 3) % 360;
      const alpha = Math.min(1, (0.15 + 0.5 * intensity) * glow);
      context.fillStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.restore();
}

function drawSpectrum(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const baseHue = (Math.floor(rand() * 360) + settings.hueShift) % 360;
  const barCount = Math.max(8, Math.round(settings.barCount));
  const barWidth = (w / barCount) * settings.barWidth;
  const barSpeed = settings.barSpeed;
  const curve = settings.curve;
  const glow = Math.max(0, settings.glow) * (0.8 + audioData.avg);

  const bg = context.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsla(${(baseHue + 5) % 360}, 20%, 12%, 1)`);
  bg.addColorStop(1, "rgba(2,3,9,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.globalCompositeOperation = "lighter";

  const gap = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const phase = timeSec * 2.0 * barSpeed + i * 0.35 + rand() * Math.PI * 2;
    const waveA = 0.5 + 0.5 * Math.sin(phase);
    const waveB = 0.5 + 0.5 * Math.sin(phase * 0.7 + 1.2);
    const level = Math.pow(waveA * 0.65 + waveB * 0.35, curve) * (0.7 + audioData.avg * 0.6);
    const height = Math.max(4, level * h * 0.7);
    const x = i * gap + (gap - barWidth) * 0.5;
    const y = h - height;
    const hue = (baseHue + i * 3) % 360;
    const alpha = Math.min(1, (0.18 + 0.5 * level) * glow);
    context.fillStyle = `hsla(${hue}, 85%, 60%, ${alpha})`;
    context.fillRect(x, y, barWidth, height);
  }

  context.restore();
}

function drawTunnel(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const baseHue = (Math.floor(rand() * 360) + settings.hueShift) % 360;
  const ringCount = Math.max(6, Math.round(settings.ringCount));
  const ringSpacing = settings.ringSpacing;
  const spin = settings.spin * (0.7 + audioData.avg * 1.2);
  const wobble = settings.wobble;
  const thickness = settings.thickness;
  const glow = Math.max(0, settings.glow) * (0.8 + audioData.treble);

  const bg = context.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  bg.addColorStop(0, `hsla(${(baseHue + 10) % 360}, 22%, 14%, 1)`);
  bg.addColorStop(1, "rgba(1,2,8,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.translate(w * 0.5, h * 0.5);
  context.globalCompositeOperation = "lighter";

  const maxRadius = Math.min(w, h) * 0.48 * ringSpacing;
  for (let i = 0; i < ringCount; i++) {
    const t = (i / ringCount + timeSec * 0.08 * spin) % 1;
    const radius = maxRadius * (0.12 + t * 0.88);
    const rotation = timeSec * 0.35 * spin + i * 0.15;
    const scaleY = 0.55 + Math.sin(timeSec * 0.6 + i * 0.7) * 0.12 * wobble;
    const hue = (baseHue + t * 160) % 360;
    const alpha = Math.min(1, (0.05 + (1 - t) * 0.2) * glow);

    context.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
    context.lineWidth = (1 + (1 - t) * 1.5) * thickness;
    context.beginPath();
    context.ellipse(0, 0, radius, radius * scaleY, rotation, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function drawFireflies(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const baseHue = (Math.floor(rand() * 360) + settings.hueShift) % 360;
  const count = Math.max(6, Math.round(settings.bugCount));
  const speed = settings.speed * (0.7 + audioData.avg * 1.1);
  const size = settings.size;
  const orbit = settings.orbit;
  const twinkle = settings.twinkle;
  const glow = Math.max(0, settings.glow) * (0.7 + audioData.treble);
  const cx = w * 0.5;
  const cy = h * 0.5;

  const bg = context.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsla(${(baseHue + 18) % 360}, 18%, 12%, 1)`);
  bg.addColorStop(1, "rgba(2,3,9,1)");
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);

  context.save();
  context.globalCompositeOperation = "lighter";

  for (let i = 0; i < count; i++) {
    const baseAngle = rand() * Math.PI * 2;
    const dir = rand() < 0.5 ? 1 : -1;
    const radius = Math.min(w, h) * (0.12 + rand() * 0.4) * orbit;
    const axis = 0.4 + rand() * 0.6;
    const wobble = 0.7 + rand() * 0.6;
    const angle = timeSec * (0.4 + speed) * dir + baseAngle;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle * wobble) * radius * axis;
    const tw = 0.5 + 0.5 * Math.sin(timeSec * 2.0 * twinkle + baseAngle * 3);
    const alpha = Math.min(1, (0.15 + 0.5 * tw) * glow);
    const orbSize = (0.7 + rand() * 1.4) * size;
    const hue = (baseHue + rand() * 60) % 360;

    context.fillStyle = `hsla(${hue}, 80%, 70%, ${alpha * 0.6})`;
    context.beginPath();
    context.arc(x, y, orbSize * 1.6, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = `hsla(${hue}, 90%, 80%, ${alpha})`;
    context.beginPath();
    context.arc(x, y, Math.max(0.3, orbSize * 0.6), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawAmbience(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  const hue = (settings.hueShift + timeSec * settings.colorSpeed * 20) % 360;
  const fade = 0.08 + (1 - settings.trail) * 0.15;

  context.fillStyle = `rgba(0, 0, 0, ${fade})`;
  context.fillRect(0, 0, w, h);

  const lines = Math.max(4, Math.round(settings.lineCount));
  const amplitude = Math.min(w, h) * 0.12 * settings.amplitude * (0.7 + audioData.avg * 1.2);
  const freq = 0.004 * settings.frequency;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineWidth = 1.4;

  for (let i = 0; i < lines; i++) {
    const offset = (i / lines) * Math.PI * 2;
    const alpha = 0.15 + settings.glow * 0.25;
    context.strokeStyle = `hsla(${(hue + i * 22) % 360}, 80%, 70%, ${alpha})`;
    context.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const wave = Math.sin(x * freq + timeSec + offset);
      const ripple = Math.cos(x * freq * 0.7 - timeSec * 0.8 + offset) * 0.4;
      const y = h * 0.5 + (wave + ripple) * amplitude + (i - lines / 2) * 12;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  context.restore();
}

const modes = {
  bars: {
    label: "Bars (WMP)",
    settings: {
      barCount: { label: "Barras", min: 24, max: 128, step: 1, value: 64, type: "int" },
      barWidth: { label: "Ancho", min: 0.4, max: 1.4, step: 0.05, value: 1, type: "float" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      hueShift: { label: "Color", min: 0, max: 180, step: 1, value: 40, type: "int" }
    },
    draw: drawBars
  },
  scope: {
    label: "Scope (WMP)",
    settings: {
      amplitude: { label: "Amplitud", min: 0.4, max: 2.4, step: 0.05, value: 1.1, type: "float" },
      lineWidth: { label: "Grosor", min: 0.4, max: 2.2, step: 0.05, value: 1, type: "float" },
      glow: { label: "Glow", min: 0.4, max: 2.4, step: 0.05, value: 1, type: "float" },
      hueShift: { label: "Color", min: 0, max: 180, step: 1, value: 100, type: "int" }
    },
    draw: drawScope
  },
  sea: {
    label: "Ocean Mist",
    settings: {
      waveCount: { label: "Cantidad de olas", min: 60, max: 200, step: 1, value: 130, type: "int" },
      waveAmp: { label: "Altura de olas", min: 0.4, max: 2.2, step: 0.05, value: 1, type: "float" },
      waveFreq: { label: "Frecuencia", min: 0.5, max: 1.8, step: 0.05, value: 1, type: "float" },
      waveSpeed: { label: "Velocidad", min: 0.2, max: 2.0, step: 0.05, value: 1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 1, type: "float" }
    },
    draw: drawSea
  },
  ambience: {
    label: "Ambience",
    settings: {
      lineCount: { label: "Lineas", min: 4, max: 16, step: 1, value: 8, type: "int" },
      amplitude: { label: "Amplitud", min: 0.4, max: 2.4, step: 0.05, value: 1, type: "float" },
      frequency: { label: "Frecuencia", min: 0.6, max: 2.4, step: 0.05, value: 1, type: "float" },
      trail: { label: "Trail", min: 0.2, max: 1, step: 0.05, value: 0.7, type: "float" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      colorSpeed: { label: "Color", min: 0.4, max: 2.0, step: 0.05, value: 1, type: "float" },
      hueShift: { label: "Hue", min: 0, max: 180, step: 1, value: 20, type: "int" }
    },
    draw: drawAmbience
  },
  brightsphere: {
    label: "Battery: Brightsphere",
    settings: {
      orbCount: { label: "Partículas", min: 20, max: 140, step: 1, value: 80, type: "int" },
      coreSize: { label: "Núcleo", min: 0.6, max: 1.8, step: 0.05, value: 1, type: "float" },
      orbitSpread: { label: "Órbita", min: 0.6, max: 2.4, step: 0.05, value: 1.2, type: "float" },
      orbSize: { label: "Tamaño", min: 0.4, max: 2.4, step: 0.05, value: 1, type: "float" },
      spin: { label: "Giro", min: 0.2, max: 2.2, step: 0.05, value: 1, type: "float" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.6, type: "float" }
    },
    draw: drawBrightsphere
  },
  cominatcha: {
    label: "Battery: Cominatcha",
    settings: {
      cometCount: { label: "Cometas", min: 4, max: 60, step: 1, value: 22, type: "int" },
      tailLength: { label: "Cola", min: 6, max: 40, step: 1, value: 18, type: "int" },
      speed: { label: "Velocidad", min: 0.2, max: 2.6, step: 0.05, value: 1.1, type: "float" },
      spread: { label: "Apertura", min: 0.6, max: 2.4, step: 0.05, value: 1.2, type: "float" },
      thickness: { label: "Grosor", min: 0.4, max: 2.4, step: 0.05, value: 1.1, type: "float" },
      glow: { label: "Glow", min: 0.3, max: 2.2, step: 0.05, value: 1.1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.5, type: "float" }
    },
    draw: drawCominatcha
  },
  ribbons: {
    label: "Battery: Ribbons",
    settings: {
      ribbonCount: { label: "Cintas", min: 3, max: 18, step: 1, value: 8, type: "int" },
      amplitude: { label: "Amplitud", min: 0.4, max: 2.4, step: 0.05, value: 1, type: "float" },
      frequency: { label: "Frecuencia", min: 0.4, max: 2.0, step: 0.05, value: 1, type: "float" },
      speed: { label: "Velocidad", min: 0.2, max: 2.2, step: 0.05, value: 1, type: "float" },
      thickness: { label: "Grosor", min: 0.6, max: 2.4, step: 0.05, value: 1, type: "float" },
      hueShift: { label: "Color", min: 0, max: 120, step: 1, value: 24, type: "int" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.5, type: "float" }
    },
    draw: drawRibbons
  },
  pulsegrid: {
    label: "Battery: Pulsegrid",
    settings: {
      grid: { label: "Malla", min: 6, max: 26, step: 1, value: 14, type: "int" },
      pulseSpeed: { label: "Velocidad", min: 0.2, max: 2.2, step: 0.05, value: 1, type: "float" },
      pulseSize: { label: "Tamaño", min: 0.4, max: 2.2, step: 0.05, value: 1, type: "float" },
      jitter: { label: "Jitter", min: 0, max: 1.6, step: 0.05, value: 0.6, type: "float" },
      hueShift: { label: "Color", min: 0, max: 180, step: 1, value: 60, type: "int" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.4, type: "float" }
    },
    draw: drawPulsegrid
  },
  spectrum: {
    label: "Battery: Spectrum",
    settings: {
      barCount: { label: "Barras", min: 18, max: 140, step: 1, value: 64, type: "int" },
      barSpeed: { label: "Velocidad", min: 0.2, max: 2.5, step: 0.05, value: 1.2, type: "float" },
      barWidth: { label: "Ancho", min: 0.4, max: 1.4, step: 0.05, value: 1, type: "float" },
      curve: { label: "Curva", min: 0.6, max: 2.4, step: 0.05, value: 1.2, type: "float" },
      hueShift: { label: "Color", min: 0, max: 180, step: 1, value: 0, type: "int" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.4, type: "float" }
    },
    draw: drawSpectrum
  },
  tunnel: {
    label: "Battery: Tunnel",
    settings: {
      ringCount: { label: "Anillos", min: 12, max: 80, step: 1, value: 38, type: "int" },
      ringSpacing: { label: "Separación", min: 0.6, max: 1.8, step: 0.05, value: 1, type: "float" },
      spin: { label: "Giro", min: 0.2, max: 2.2, step: 0.05, value: 1, type: "float" },
      wobble: { label: "Wobble", min: 0, max: 1.6, step: 0.05, value: 0.8, type: "float" },
      thickness: { label: "Grosor", min: 0.4, max: 2.4, step: 0.05, value: 1, type: "float" },
      hueShift: { label: "Color", min: 0, max: 180, step: 1, value: 80, type: "int" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.4, type: "float" }
    },
    draw: drawTunnel
  },
  fireflies: {
    label: "Battery: Fireflies",
    settings: {
      bugCount: { label: "Partículas", min: 20, max: 160, step: 1, value: 80, type: "int" },
      speed: { label: "Velocidad", min: 0.2, max: 2.2, step: 0.05, value: 1.1, type: "float" },
      size: { label: "Tamaño", min: 0.4, max: 2.4, step: 0.05, value: 1, type: "float" },
      orbit: { label: "Órbita", min: 0.6, max: 2.2, step: 0.05, value: 1, type: "float" },
      twinkle: { label: "Parpadeo", min: 0.4, max: 2.2, step: 0.05, value: 1, type: "float" },
      hueShift: { label: "Color", min: 0, max: 180, step: 1, value: 30, type: "int" },
      glow: { label: "Glow", min: 0.2, max: 2.0, step: 0.05, value: 1.1, type: "float" },
      grainDensity: { label: "Grano", min: 0, max: 1.8, step: 0.05, value: 0.5, type: "float" }
    },
    draw: drawFireflies
  },
  alchemy: {
    label: "Alchemy (Auto)",
    settings: {
      holdTime: { label: "Hold (s)", min: 6, max: 20, step: 1, value: 10, type: "int" },
      mixTime: { label: "Mix (s)", min: 2, max: 8, step: 0.5, value: 4, type: "float" }
    },
    draw: drawAlchemy
  }
};

const modeValues = {};
Object.entries(modes).forEach(([modeId, mode]) => {
  modeValues[modeId] = {};
  Object.entries(mode.settings).forEach(([key, def]) => {
    modeValues[modeId][key] = def.value;
  });
});

let currentMode = "bars";

function formatValue(def, value) {
  return def.type === "int" ? String(Math.round(value)) : value.toFixed(2);
}

function normalizeValue(def, value) {
  return def.type === "int" ? Math.round(value) : value;
}

function buildControls() {
  const container = document.getElementById("dynamic-controls");
  container.innerHTML = "";

  const mode = modes[currentMode];
  const values = modeValues[currentMode];

  Object.entries(mode.settings).forEach(([key, def]) => {
    const control = document.createElement("div");
    control.className = "control";

    const label = document.createElement("label");
    const inputId = `${currentMode}-${key}`;
    label.setAttribute("for", inputId);
    label.textContent = def.label + " ";

    const valueSpan = document.createElement("span");
    valueSpan.className = "value";
    label.appendChild(valueSpan);

    const input = document.createElement("input");
    input.id = inputId;
    input.type = "range";
    input.min = def.min;
    input.max = def.max;
    input.step = def.step;
    input.value = values[key];

    const syncValue = () => {
      valueSpan.textContent = formatValue(def, values[key]);
    };

    input.addEventListener("input", () => {
      values[key] = normalizeValue(def, parseFloat(input.value));
      syncValue();
    });

    syncValue();
    control.appendChild(label);
    control.appendChild(input);
    container.appendChild(control);
  });
}

function initControls() {
  const modeSelect = document.getElementById("modeSelect");
  Object.entries(modes).forEach(([modeId, mode]) => {
    const option = document.createElement("option");
    option.value = modeId;
    option.textContent = mode.label;
    modeSelect.appendChild(option);
  });
  modeSelect.value = currentMode;
  modeSelect.addEventListener("change", () => {
    currentMode = modeSelect.value;
    buildControls();
  });

  buildControls();
}

const alchemyState = {
  current: null,
  next: null,
  transitioning: false,
  transitionStart: 0,
  lastSwitch: 0,
  canvasA: document.createElement("canvas"),
  canvasB: document.createElement("canvas"),
  ctxA: null,
  ctxB: null,
  resize(width, height, dpr) {
    this.canvasA.width = Math.floor(width * dpr);
    this.canvasA.height = Math.floor(height * dpr);
    this.canvasB.width = Math.floor(width * dpr);
    this.canvasB.height = Math.floor(height * dpr);
    if (!this.ctxA) {
      this.ctxA = this.canvasA.getContext("2d", { alpha: false });
      this.ctxB = this.canvasB.getContext("2d", { alpha: false });
    }
    this.ctxA.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctxB.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
};

const alchemyModes = [
  "bars",
  "scope",
  "sea",
  "ambience",
  "brightsphere",
  "cominatcha",
  "ribbons",
  "pulsegrid",
  "spectrum",
  "tunnel",
  "fireflies"
];

function pickAlchemyMode() {
  const pool = alchemyModes.filter((modeId) => modeId !== alchemyState.current);
  return pool[Math.floor(Math.random() * pool.length)];
}

function drawMode(modeId, context, rand, pal, w, h, time, audioData) {
  const mode = modes[modeId];
  if (!mode) return;
  const values = modeValues[modeId];
  mode.draw(context, rand, pal, w, h, time, values, audioData);
  if (values.grainDensity) {
    drawGrain(context, rand, w, h, values.grainDensity);
  }
}

function drawAlchemy(context, rand, pal, w, h, time, settings, audioData) {
  const timeSec = (typeof time === "number" ? time : 0) * 0.001;
  if (!alchemyState.current) {
    alchemyState.current = pickAlchemyMode();
    alchemyState.lastSwitch = timeSec;
  }

  if (!alchemyState.transitioning && timeSec - alchemyState.lastSwitch >= settings.holdTime) {
    alchemyState.transitioning = true;
    alchemyState.transitionStart = timeSec;
    alchemyState.next = pickAlchemyMode();
  }

  if (alchemyState.transitioning && alchemyState.next) {
    const progress = Math.min(1, (timeSec - alchemyState.transitionStart) / settings.mixTime);
    drawMode(alchemyState.current, alchemyState.ctxA, rand, pal, w, h, time, audioData);
    drawMode(alchemyState.next, alchemyState.ctxB, rand, pal, w, h, time, audioData);
    context.globalAlpha = 1;
    context.drawImage(alchemyState.canvasA, 0, 0, w, h);
    context.globalAlpha = progress;
    context.drawImage(alchemyState.canvasB, 0, 0, w, h);
    context.globalAlpha = 1;

    if (progress >= 1) {
      alchemyState.current = alchemyState.next;
      alchemyState.next = null;
      alchemyState.transitioning = false;
      alchemyState.lastSwitch = timeSec;
    }
    return;
  }

  drawMode(alchemyState.current, context, rand, pal, w, h, time, audioData);
}

function draw(seed, time) {
  const rand = mulberry32(seed);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pal = palettes[Math.floor(rand() * palettes.length)];
  const audioData = getAudioMetrics();

  if (currentMode === "alchemy") {
    drawAlchemy(ctx, rand, pal, w, h, time, modeValues.alchemy, audioData);
    return;
  }

  const mode = modes[currentMode] || modes.bars;
  const values = modeValues[currentMode] || modeValues.bars;
  mode.draw(ctx, rand, pal, w, h, time, values, audioData);

  if (values.grainDensity) {
    drawGrain(ctx, rand, w, h, values.grainDensity);
  }
}

function randomize() {
  currentSeed = ((Math.random() * 0xffffffff) >>> 0);
}

async function loadPlaylist() {
  try {
    const response = await fetch("data/playlist.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    playlist = Array.isArray(data.tracks) ? data.tracks : [];
    buildPlaylist();
    if (playlist.length) {
      audio.src = playlist[0].src;
    }
  } catch (error) {
    playlist = [];
    buildPlaylist();
  }
}

playBtn.addEventListener("click", () => {
  ensureAudioGraph();
  audioContext.resume();
  if (!audio.src && playlist.length) {
    audio.src = playlist[currentTrackIndex].src;
  }
  audio.play().catch(() => {
    updateStatus();
  });
});

pauseBtn.addEventListener("click", () => {
  audio.pause();
  updateStatus();
});

prevBtn.addEventListener("click", () => {
  ensureAudioGraph();
  audioContext.resume();
  setTrack(currentTrackIndex - 1);
});

nextBtn.addEventListener("click", () => {
  ensureAudioGraph();
  audioContext.resume();
  setTrack(currentTrackIndex + 1);
});

muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  updateGain();
  volumeSlider.value = isMuted ? 0 : desiredVolume;
  volumeValue.textContent = Number(volumeSlider.value).toFixed(2);
  updateStatus();
});

volumeSlider.addEventListener("input", () => {
  desiredVolume = parseFloat(volumeSlider.value);
  volumeValue.textContent = desiredVolume.toFixed(2);
  if (!isMuted) updateGain();
});

progressSlider.addEventListener("input", () => {
  if (!audio.duration) return;
  const time = parseFloat(progressSlider.value) * audio.duration;
  audio.currentTime = time;
});

randomBtn.addEventListener("click", randomize);
canvas.addEventListener("click", randomize);

window.addEventListener("resize", resize);

audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("play", updateStatus);
audio.addEventListener("pause", updateStatus);
audio.addEventListener("ended", () => setTrack(currentTrackIndex + 1));

initControls();
resize();
loadPlaylist();

updateGain();
updateStatus();

requestAnimationFrame(function animate(time) {
  lastTime = time;
  draw(currentSeed, time);
  requestAnimationFrame(animate);
});
