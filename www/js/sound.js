// Tiny synthesised sound effects (no audio files needed) + haptics.
let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('kl_sound') !== 'off'; } catch {}

export const isSoundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('kl_sound', on ? 'on' : 'off'); } catch {}
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.08, type = 'sine', gain = 0.15, when = 0, slideTo = null) {
  const a = ac();
  if (!a || !enabled) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function buzz(ms) {
  try { if (enabled && navigator.vibrate) navigator.vibrate(ms); } catch {}
}

export const sfx = {
  roll() { for (let i = 0; i < 6; i++) tone(180 + Math.random() * 300, 0.04, 'square', 0.05, i * 0.07); buzz(20); },
  step() { tone(640, 0.05, 'triangle', 0.12); },
  open() { tone(420, 0.09, 'triangle', 0.15); tone(720, 0.12, 'triangle', 0.15, 0.08); },
  capture() { tone(700, 0.35, 'sawtooth', 0.12, 0, 120); buzz([40, 30, 60]); },
  home() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, i * 0.08)); buzz(30); },
  six() { tone(880, 0.1, 'sine', 0.12); tone(1175, 0.12, 'sine', 0.12, 0.09); },
  bad() { tone(220, 0.25, 'square', 0.07, 0, 140); },
  win() { [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, i * 0.13)); buzz([60, 40, 60]); },
  tap() { tone(520, 0.04, 'sine', 0.08); },
};
