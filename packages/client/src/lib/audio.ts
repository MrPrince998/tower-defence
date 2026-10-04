import type { TowerType } from '@maze/shared';
import { useSettingsStore } from '@/stores/settingsStore';

/** Tiny WebAudio synth: every sound is generated, so there are no audio assets to ship. */
type Sound =
  | `shoot_${Exclude<TowerType, 'support'>}`
  | 'hit'
  | 'explosion'
  | 'freeze'
  | 'coin'
  | 'build'
  | 'sell'
  | 'upgrade'
  | 'leak'
  | 'wave'
  | 'boss'
  | 'clear'
  | 'error'
  | 'zap'
  | 'perk'
  | 'send'
  | 'incoming'
  | 'eliminated'
  | 'gameover';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const lastPlayed = new Map<Sound, number>();
const MIN_GAP_MS: Partial<Record<Sound, number>> = {
  hit: 40,
  shoot_arrow: 45,
  coin: 40,
  freeze: 80,
  zap: 70,
  explosion: 60,
};

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user gesture so browsers allow audio. */
export function unlockAudio(): void {
  ensure();
}

function tone(
  c: AudioContext,
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number } = {},
) {
  const t = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(
  c: AudioContext,
  dur: number,
  opts: { vol?: number; freq?: number; q?: number; type?: BiquadFilterType; delay?: number } = {},
) {
  const t = c.currentTime + (opts.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.value = opts.freq ?? 1000;
  filter.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.vol ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master!);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export function play(sound: Sound): void {
  const { volume, muted } = useSettingsStore.getState();
  if (muted || volume <= 0) return;
  const c = ensure();
  if (!c || !master || c.state !== 'running') return;
  const now = performance.now();
  const gap = MIN_GAP_MS[sound] ?? 30;
  if (now - (lastPlayed.get(sound) ?? 0) < gap) return;
  lastPlayed.set(sound, now);
  master.gain.value = volume * 0.5;

  switch (sound) {
    case 'shoot_arrow':
      noise(c, 0.08, { freq: 3000, q: 2, vol: 0.12 });
      break;
    case 'shoot_cannon':
      tone(c, 120, 0.25, { type: 'triangle', slide: 0.4, vol: 0.45 });
      noise(c, 0.2, { freq: 400, vol: 0.25, type: 'lowpass' });
      break;
    case 'shoot_frost':
      tone(c, 1400, 0.18, { type: 'sine', slide: 1.6, vol: 0.08 });
      tone(c, 2100, 0.14, { type: 'sine', slide: 1.4, vol: 0.05, delay: 0.03 });
      break;
    case 'shoot_sniper':
      noise(c, 0.12, { freq: 2200, q: 0.7, vol: 0.35 });
      tone(c, 900, 0.1, { type: 'square', slide: 0.3, vol: 0.08 });
      break;
    case 'hit':
      noise(c, 0.05, { freq: 1800, q: 3, vol: 0.08 });
      break;
    case 'explosion':
      noise(c, 0.45, { freq: 300, type: 'lowpass', vol: 0.5 });
      tone(c, 80, 0.35, { type: 'sine', slide: 0.5, vol: 0.35 });
      break;
    case 'freeze':
      tone(c, 2600, 0.12, { vol: 0.04, slide: 0.8 });
      break;
    case 'coin':
      tone(c, 1320, 0.07, { type: 'square', vol: 0.05 });
      tone(c, 1760, 0.12, { type: 'square', vol: 0.05, delay: 0.06 });
      break;
    case 'build':
      tone(c, 220, 0.12, { type: 'triangle', vol: 0.3, slide: 0.7 });
      noise(c, 0.1, { freq: 600, vol: 0.15 });
      break;
    case 'upgrade':
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(c, f, 0.14, { type: 'triangle', vol: 0.15, delay: i * 0.06 }),
      );
      break;
    case 'sell':
      [1047, 880, 1319].forEach((f, i) => tone(c, f, 0.1, { type: 'square', vol: 0.05, delay: i * 0.05 }));
      break;
    case 'leak':
      tone(c, 330, 0.3, { type: 'sawtooth', vol: 0.18, slide: 0.5 });
      break;
    case 'wave':
      [392, 523, 659].forEach((f, i) => tone(c, f, 0.35, { type: 'sawtooth', vol: 0.1, delay: i * 0.12 }));
      break;
    case 'boss':
      for (let i = 0; i < 3; i++)
        tone(c, 110, 0.5, { type: 'sawtooth', vol: 0.25, slide: 1.5, delay: i * 0.55 });
      break;
    case 'clear':
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(c, f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.07 }),
      );
      break;
    case 'error':
      tone(c, 150, 0.15, { type: 'square', vol: 0.1 });
      break;
    case 'zap':
      noise(c, 0.12, { freq: 4200, q: 4, vol: 0.12 });
      tone(c, 1800, 0.08, { type: 'square', vol: 0.05, slide: 0.4 });
      break;
    case 'perk':
      [659, 880, 1109, 1319].forEach((f, i) =>
        tone(c, f, 0.25, { type: 'sine', vol: 0.12, delay: i * 0.08 }),
      );
      break;
    case 'send':
      tone(c, 440, 0.12, { type: 'square', vol: 0.08, slide: 1.8 });
      noise(c, 0.12, { freq: 1500, vol: 0.08, delay: 0.04 });
      break;
    case 'incoming':
      tone(c, 660, 0.14, { type: 'sawtooth', vol: 0.12 });
      tone(c, 520, 0.18, { type: 'sawtooth', vol: 0.12, delay: 0.15 });
      break;
    case 'eliminated':
      tone(c, 220, 0.6, { type: 'sawtooth', vol: 0.18, slide: 0.4 });
      noise(c, 0.5, { freq: 200, type: 'lowpass', vol: 0.3 });
      break;
    case 'gameover':
      [392, 330, 262, 196].forEach((f, i) =>
        tone(c, f, 0.5, { type: 'triangle', vol: 0.2, delay: i * 0.25 }),
      );
      break;
  }
}
