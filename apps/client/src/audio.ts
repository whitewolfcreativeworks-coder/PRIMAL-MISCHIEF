// Restrained, fully synthesized sound design (Web Audio API) — no audio assets,
// so there is nothing to license. Sounds are short, soft and low in the mix.
type Cue = 'card' | 'build' | 'march' | 'clash' | 'collapse' | 'reaction' | 'coin' | 'turn' | 'victory' | 'defeat' | 'tap' | 'chain';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => { try { return localStorage.getItem('pm.muted') === '1'; } catch { return false; } })();

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume(); // iOS Safari unlocks audio on the first touch
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator(); const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { gain?: number; delay?: number; freq?: number; q?: number } = {}) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = opts.freq ?? 800; f.Q.value = opts.q ?? 0.8;
  const g = c.createGain(); g.gain.value = opts.gain ?? 0.4;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function play(cue: Cue) {
  switch (cue) {
    case 'tap': tone(880, 0.05, { gain: 0.08, type: 'triangle' }); break;
    case 'card': noise(0.09, { freq: 2400, gain: 0.25 }); tone(520, 0.08, { gain: 0.06, type: 'triangle' }); break;
    case 'build': tone(196, 0.35, { gain: 0.16, type: 'triangle' }); tone(294, 0.4, { gain: 0.1, delay: 0.08 }); noise(0.2, { freq: 300, gain: 0.2 }); break;
    case 'march': for (let i = 0; i < 3; i++) noise(0.07, { freq: 180, gain: 0.35, delay: i * 0.11 }); break;
    case 'clash': noise(0.18, { freq: 3200, q: 2, gain: 0.3 }); tone(1400, 0.15, { gain: 0.05, type: 'square', slide: 0.6 }); break;
    case 'collapse': noise(0.7, { freq: 140, gain: 0.55 }); tone(90, 0.6, { gain: 0.15, slide: 0.5 }); break;
    case 'reaction': tone(660, 0.12, { gain: 0.15, type: 'triangle' }); tone(990, 0.3, { gain: 0.12, delay: 0.1, type: 'triangle' }); break;
    case 'chain': tone(740, 0.12, { gain: 0.08 }); tone(1110, 0.18, { gain: 0.07, delay: 0.07 }); break;
    case 'coin': tone(1320, 0.08, { gain: 0.08, type: 'triangle' }); tone(1760, 0.12, { gain: 0.06, delay: 0.05, type: 'triangle' }); break;
    case 'turn': tone(392, 0.5, { gain: 0.08 }); tone(587, 0.6, { gain: 0.06, delay: 0.05 }); break;
    case 'victory': [392, 494, 587, 784].forEach((f, i) => tone(f, 0.9, { gain: 0.12, delay: i * 0.14, type: 'triangle' })); break;
    case 'defeat': [392, 349, 294, 196].forEach((f, i) => tone(f, 0.9, { gain: 0.1, delay: i * 0.18 })); break;
  }
}

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('pm.muted', m ? '1' : '0'); } catch { /* storage unavailable */ }
  if (m && ctx) void ctx.suspend(); else if (!m && ctx) void ctx.resume();
}
