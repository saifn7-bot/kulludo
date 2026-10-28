// Draws the 15x15 board (SVG) and positions the pawns over it.
import * as L from './core.js';

// Palette: base / light / dark for each colour
const PAL = {
  red: ['#e8333b', '#ff7a6e', '#a8141c'],
  green: ['#22a84a', '#62d97f', '#12702e'],
  yellow: ['#f7c51e', '#ffe57a', '#c98f00'],
  blue: ['#2b7be0', '#6bb0ff', '#1650a3'],
};
const HEX = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, v[0]]));

// Board rotation (degrees) that brings a colour's yard to the bottom-left,
// like Ludo King does for "your" colour.
export const ROTATION = { red: 0, blue: 90, yellow: 180, green: 270 };
const POS_ORDER = ['tl', 'tr', 'br', 'bl'];
const BASE_POS = { green: 0, yellow: 1, blue: 2, red: 3 };

export function panelPos(color, rot) {
  return POS_ORDER[(BASE_POS[color] + rot / 90) % 4];
}

function rotPoint([y, x], rot) {
  for (let k = 0; k < rot / 90; k++) [y, x] = [x, 15 - y];
  return [y, x];
}

function star(cx, cy, R, fill, stroke = 'none') {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.46 : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="0.05" stroke-linejoin="round"/>`;
}

function arrow(r, c, dir, fill) {
  const cx = c + 0.5, cy = r + 0.5;
  return `<g transform="translate(${cx} ${cy}) rotate(${dir})"><path d="M-0.3 -0.22 L0.05 -0.22 L0.05 -0.36 L0.34 0 L0.05 0.36 L0.05 0.22 L-0.3 0.22 Z" fill="${fill}" stroke="rgba(0,0,0,.25)" stroke-width="0.04" stroke-linejoin="round"/></g>`;
}

function boardDefs() {
  let d = '<defs>';
  for (const [c, [base, light, dark]] of Object.entries(PAL)) {
    d += `<linearGradient id="yard-${c}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
    d += `<linearGradient id="lane-${c}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient>`;
    d += `<radialGradient id="spot-${c}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${base}" stop-opacity=".18"/><stop offset=".75" stop-color="${base}" stop-opacity=".35"/><stop offset="1" stop-color="${dark}" stop-opacity=".75"/></radialGradient>`;
    d += `<linearGradient id="tri-${c}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
  }
  d += `<linearGradient id="cell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eceef4"/></linearGradient>`;
  d += `<radialGradient id="medal" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#ffcf3a"/><stop offset="1" stop-color="#b9780a"/></radialGradient>`;
  d += `<filter id="pad" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0.05" dy="0.08" stdDeviation="0.08" flood-color="#000" flood-opacity=".35"/></filter>`;
  d += `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.05" stdDeviation="0.05" flood-color="#000" flood-opacity=".3"/></filter>`;
  return d + '</defs>';
}

export function boardSVG() {
  let s = `<svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">${boardDefs()}`;
  s += `<rect width="15" height="15" fill="#f4f5f9"/>`;
  // yards
  for (const c of L.COLORS) {
    const [r, col] = L.BASE_ORIGIN[c];
    s += `<rect x="${col}" y="${r}" width="6" height="6" fill="url(#yard-${c})"/>`;
    s += `<rect x="${col + 0.12}" y="${r + 0.12}" width="5.76" height="5.76" rx="0.25" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="0.07"/>`;
    s += `<rect x="${col + 0.85}" y="${r + 0.85}" width="4.3" height="4.3" rx="0.55" fill="#fff" filter="url(#pad)"/>`;
    s += `<rect x="${col + 1.0}" y="${r + 1.0}" width="4.0" height="4.0" rx="0.45" fill="none" stroke="${PAL[c][0]}" stroke-opacity=".25" stroke-width="0.05"/>`;
    for (const [sr, sc] of [[2, 2], [2, 4], [4, 2], [4, 4]]) {
      s += `<circle cx="${col + sc}" cy="${r + sr}" r="0.74" fill="url(#spot-${c})" stroke="${PAL[c][0]}" stroke-width="0.11"/>`;
      s += `<circle cx="${col + sc}" cy="${r + sr}" r="0.55" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="0.05"/>`;
    }
  }
  // track
  const startOf = {};
  for (const c of L.COLORS) startOf[L.START_INDEX[c]] = c;
  L.TRACK.forEach(([r, c], i) => {
    const sc = startOf[i];
    s += `<rect x="${c}" y="${r}" width="1" height="1" fill="${sc ? `url(#lane-${sc})` : 'url(#cell)'}" stroke="#b9bfcc" stroke-width="0.035"/>`;
    if (sc) s += star(c + 0.5, r + 0.5, 0.36, '#fff', 'rgba(0,0,0,.2)');
    else if (L.SAFE_INDEXES.includes(i)) s += star(c + 0.5, r + 0.5, 0.37, '#d2d6e0', '#a3a9b8');
  });
  // home lanes
  for (const c of L.COLORS) {
    for (const [r, col] of L.HOME_COLUMN[c]) {
      s += `<rect x="${col}" y="${r}" width="1" height="1" fill="url(#lane-${c})" stroke="rgba(0,0,0,.18)" stroke-width="0.035"/>`;
      s += `<rect x="${col + 0.08}" y="${r + 0.08}" width="0.84" height="0.84" rx="0.08" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="0.04"/>`;
    }
  }
  s += arrow(7, 0, 0, PAL.green[0]) + arrow(0, 7, 90, PAL.yellow[0]) + arrow(7, 14, 180, PAL.blue[0]) + arrow(14, 7, 270, PAL.red[0]);
  // centre pyramid
  s += `<g filter="url(#soft)">`;
  s += `<polygon points="6,6 6,9 7.5,7.5" fill="url(#tri-green)"/>`;
  s += `<polygon points="6,6 9,6 7.5,7.5" fill="url(#tri-yellow)"/>`;
  s += `<polygon points="9,6 9,9 7.5,7.5" fill="url(#tri-blue)"/>`;
  s += `<polygon points="6,9 9,9 7.5,7.5" fill="url(#tri-red)"/>`;
  s += `</g>`;
  s += `<path d="M6 6 L9 9 M9 6 L6 9" stroke="rgba(255,255,255,.55)" stroke-width="0.05"/>`;
  s += `<rect x="6" y="6" width="3" height="3" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="0.04"/>`;
  s += `<circle cx="7.5" cy="7.5" r="0.4" fill="url(#medal)" stroke="#8a5600" stroke-width="0.04"/>`;
  s += star(7.5, 7.5, 0.24, '#fff8d6');
  s += `</svg>`;
  return s;
}

export function pawnDefs() {
  let d = '';
  for (const [c, [base, light, dark]] of Object.entries(PAL)) {
    d += `<linearGradient id="pb-${c}" x1="0" x2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".3" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
    d += `<radialGradient id="ph-${c}" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".18" stop-color="${light}"/><stop offset=".6" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`;
  }
  return d;
}

function pawnSVG(color) {
  const dark = PAL[color][2];
  return `<svg viewBox="0 0 40 56" aria-hidden="true">
    <ellipse cx="20" cy="51.5" rx="12.5" ry="3.8" fill="rgba(0,0,0,.35)"/>
    <ellipse cx="20" cy="46" rx="12.5" ry="5.2" fill="${dark}"/>
    <ellipse cx="20" cy="44" rx="12.5" ry="5.2" fill="url(#pb-${color})" stroke="${dark}" stroke-width=".8"/>
    <path d="M11.5 43.5 C13 35 16.5 30 16.8 23 L23.2 23 C23.5 30 27 35 28.5 43.5 C24 46.5 16 46.5 11.5 43.5Z" fill="url(#pb-${color})" stroke="${dark}" stroke-width=".8"/>
    <ellipse cx="20" cy="24" rx="6.5" ry="2.4" fill="${dark}" opacity=".55"/>
    <circle cx="20" cy="14.5" r="10" fill="url(#ph-${color})" stroke="${dark}" stroke-width=".8"/>
    <ellipse cx="16.5" cy="10.5" rx="3.6" ry="2.4" fill="#fff" opacity=".75" transform="rotate(-25 16.5 10.5)"/>
  </svg>`;
}

const STACK = {
  1: [[0, 0]],
  2: [[-0.2, 0], [0.2, 0]],
  3: [[-0.2, -0.12], [0.2, -0.12], [0, 0.16]],
  4: [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]],
};

export class BoardView {
  constructor(root, onPawnTap) {
    this.root = root;
    this.rot = 0;
    this.els = {};
    root.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>${pawnDefs()}</defs></svg>
      <div class="board-svg">${boardSVG()}</div><div class="pawn-layer"></div>`;
    this.svgWrap = root.querySelector('.board-svg');
    this.layer = root.querySelector('.pawn-layer');
    this.layer.addEventListener('click', e => {
      const el = e.target.closest('.pawn');
      if (el) onPawnTap(el.dataset.color, +el.dataset.i);
    });
  }
  setup(state, rot) {
    this.rot = rot;
    this.svgWrap.style.transform = `rotate(${rot}deg)`;
    this.layer.innerHTML = '';
    this.els = {};
    for (const p of state.players) {
      this.els[p.color] = [0, 1, 2, 3].map(i => {
        const el = document.createElement('div');
        el.className = `pawn c-${p.color}`;
        el.dataset.color = p.color;
        el.dataset.i = i;
        el.innerHTML = `<div class="ring"></div>${pawnSVG(p.color)}`;
        this.layer.appendChild(el);
        return el;
      });
    }
  }
  place(el, [y, x], scale = 1, z = null) {
    const [ry, rx] = rotPoint([y, x], this.rot);
    el.style.left = (rx / 15) * 100 + '%';
    el.style.top = (ry / 15) * 100 + '%';
    el.style.setProperty('--s', scale);
    el.style.zIndex = z ?? Math.round(ry * 10);
  }
  // Move one pawn (used while animating step by step).
  moveOne(color, i, progress, z = 999) {
    const el = this.els[color]?.[i];
    if (el) this.place(el, L.pawnPoint(color, progress, i), 1, z);
  }
  render(state, movable = []) {
    const groups = new Map();
    for (const color of Object.keys(state.pawns)) {
      state.pawns[color].forEach((p, i) => {
        if (p < 0) { this.place(this.els[color][i], L.pawnPoint(color, p, i)); return; }
        const key = p >= L.FINISHED ? 'F' + color : p > L.LAST_TRACK ? `H${color}${p}` : 'T' + L.absIndex(color, p);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push([color, i, p]);
      });
    }
    for (const list of groups.values()) {
      const n = Math.min(list.length, 4);
      list.forEach(([color, i, p], k) => {
        const [y, x] = L.pawnPoint(color, p, i);
        const [dy, dx] = n > 1 ? STACK[n][k % 4] : [0, 0];
        // offsets are applied in screen space so stacks look the same at any rotation
        const el = this.els[color][i];
        const [ry, rx] = rotPoint([y, x], this.rot);
        el.style.left = ((rx + dx) / 15) * 100 + '%';
        el.style.top = ((ry + dy) / 15) * 100 + '%';
        el.style.setProperty('--s', n > 1 ? (n > 2 ? 0.66 : 0.78) : 1);
        el.style.zIndex = Math.round((ry + dy) * 10) + k;
      });
    }
    for (const color of Object.keys(this.els)) {
      this.els[color].forEach((el, i) => {
        el.classList.toggle('can-move', movable.some(m => m.color === color && m.i === i));
        el.classList.toggle('done', state.pawns[color][i] >= L.FINISHED);
      });
    }
  }
}
