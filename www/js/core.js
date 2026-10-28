// KulLUDO — core rules engine.
// Pure, JSON-serialisable state. Shared by the app (offline + online UI)
// and by the Cloudflare server, so both always agree on the rules.

export const COLORS = ['green', 'yellow', 'blue', 'red']; // clockwise turn order
export const START_INDEX = { green: 0, yellow: 13, blue: 26, red: 39 };
export const TRACK_LEN = 52;
export const LAST_TRACK = 50; // progress of a pawn's last square on the shared track
export const FINISHED = 56; // 51..55 = home column, 56 = reached home (centre)
export const SAFE_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47]; // start squares + stars
export const COLOR_HEX = { green: '#1fa34a', yellow: '#f5c400', blue: '#1e6fd9', red: '#e2262f' };

// The 52 squares of the shared track as [row, col] on a 15x15 grid, clockwise,
// starting at green's start square.
export const TRACK = (() => {
  const t = [];
  const p = (r, c) => t.push([r, c]);
  for (let c = 1; c <= 5; c++) p(6, c);
  for (let r = 5; r >= 0; r--) p(r, 6);
  p(0, 7); p(0, 8);
  for (let r = 1; r <= 5; r++) p(r, 8);
  for (let c = 9; c <= 14; c++) p(6, c);
  p(7, 14); p(8, 14);
  for (let c = 13; c >= 9; c--) p(8, c);
  for (let r = 9; r <= 14; r++) p(r, 8);
  p(14, 7); p(14, 6);
  for (let r = 13; r >= 9; r--) p(r, 6);
  for (let c = 5; c >= 0; c--) p(8, c);
  p(7, 0); p(6, 0);
  return t;
})();

// Coloured home column (5 squares) for each colour, in walking order.
export const HOME_COLUMN = {
  green: [1, 2, 3, 4, 5].map(c => [7, c]),
  yellow: [1, 2, 3, 4, 5].map(r => [r, 7]),
  blue: [13, 12, 11, 10, 9].map(c => [7, c]),
  red: [13, 12, 11, 10, 9].map(r => [r, 7]),
};

// Base (yard) top-left corner on the grid.
export const BASE_ORIGIN = { green: [0, 0], yellow: [0, 9], blue: [9, 9], red: [9, 0] };
const BASE_SPOTS = [[2, 2], [2, 4], [4, 2], [4, 4]];
// Where finished pawns rest inside the centre triangle.
const FINISH_POINT = { green: [7.5, 6.55], yellow: [6.55, 7.5], blue: [7.5, 8.45], red: [8.45, 7.5] };

export function absIndex(color, progress) {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START_INDEX[color] + progress) % TRACK_LEN;
}

export function isSafe(index) {
  return SAFE_INDEXES.includes(index);
}

// Centre point [y, x] in grid units (0..15) for a pawn.
export function pawnPoint(color, progress, pawnIdx) {
  if (progress < 0) {
    const [or, oc] = BASE_ORIGIN[color];
    const [sr, sc] = BASE_SPOTS[pawnIdx];
    return [or + sr, oc + sc];
  }
  if (progress >= FINISHED) return FINISH_POINT[color];
  if (progress > LAST_TRACK) {
    const [r, c] = HOME_COLUMN[color][progress - LAST_TRACK - 1];
    return [r + 0.5, c + 0.5];
  }
  const [r, c] = TRACK[absIndex(color, progress)];
  return [r + 0.5, c + 0.5];
}

// ---------- game state ----------

// players: [{ color, name, kind: 'human' | 'bot', id? }]
export function createGame(players, { firstTurn = 0 } = {}) {
  const ps = [...players].sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color));
  const pawns = {};
  ps.forEach(p => { pawns[p.color] = [-1, -1, -1, -1]; });
  return {
    v: 1,
    seq: 0,
    players: ps.map(p => ({ ...p, rank: 0 })),
    pawns,
    turn: Math.min(firstTurn, ps.length - 1),
    phase: 'roll', // 'roll' | 'move' | 'over'
    dice: 0,
    sixes: 0,
    movable: [],
    ranks: [],
    last: null,
  };
}

export const current = s => s.players[s.turn];
export const clone = s => JSON.parse(JSON.stringify(s));

export function legalMoves(s, color, dice) {
  const out = [];
  s.pawns[color].forEach((p, i) => {
    if (p === -1 ? dice === 6 : p + dice <= FINISHED) out.push(i);
  });
  return out;
}

function nextTurn(s) {
  s.sixes = 0;
  s.movable = [];
  s.phase = 'roll';
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const t = (s.turn + k) % n;
    if (!s.players[t].rank) { s.turn = t; return; }
  }
}

export function rollDie() {
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    // rejection sampling for an unbiased 1..6
    do { globalThis.crypto.getRandomValues(a); } while (a[0] >= 4294967292);
    return (a[0] % 6) + 1;
  }
  return 1 + Math.floor(Math.random() * 6);
}

export function roll(s, value = rollDie()) {
  if (s.phase !== 'roll') throw new Error('Not time to roll');
  const color = current(s).color;
  s.seq++;
  s.dice = value;
  s.sixes = value === 6 ? s.sixes + 1 : 0;
  if (s.sixes === 3) {
    s.last = { type: 'roll', color, value, result: 'three-sixes' };
    nextTurn(s);
    return s.last;
  }
  const moves = legalMoves(s, color, value);
  if (!moves.length) {
    s.last = { type: 'roll', color, value, result: 'no-move' };
    if (value === 6) { s.phase = 'roll'; s.movable = []; } // a 6 still earns another roll
    else nextTurn(s);
    return s.last;
  }
  s.movable = moves;
  s.phase = 'move';
  s.last = { type: 'roll', color, value, result: 'ok' };
  return s.last;
}

export function move(s, pawn) {
  if (s.phase !== 'move' || !s.movable.includes(pawn)) throw new Error('Illegal move');
  const player = current(s);
  const color = player.color;
  const dice = s.dice;
  const from = s.pawns[color][pawn];
  const to = from === -1 ? 0 : from + dice;
  const path = [];
  if (from === -1) path.push(0);
  else for (let p = from + 1; p <= to; p++) path.push(p);
  s.pawns[color][pawn] = to;
  s.seq++;

  const captures = [];
  if (to <= LAST_TRACK) {
    const a = absIndex(color, to);
    if (!isSafe(a)) {
      for (const other of Object.keys(s.pawns)) {
        if (other === color) continue;
        s.pawns[other].forEach((q, j) => {
          if (q >= 0 && q <= LAST_TRACK && absIndex(other, q) === a) {
            captures.push({ color: other, pawn: j, from: q });
            s.pawns[other][j] = -1;
          }
        });
      }
    }
  }
  const finished = to === FINISHED;
  let extra = dice === 6 || captures.length > 0 || finished;

  if (s.pawns[color].every(p => p === FINISHED)) {
    s.ranks.push(color);
    player.rank = s.ranks.length;
    extra = false;
  }
  s.last = { type: 'move', color, pawn, from, to, path, captures, finished, extra, won: !!player.rank };
  s.movable = [];

  const left = s.players.filter(p => !p.rank);
  if (left.length <= 1) {
    if (left.length === 1) { s.ranks.push(left[0].color); left[0].rank = s.ranks.length; }
    s.phase = 'over';
    return s.last;
  }
  if (extra) s.phase = 'roll';
  else nextTurn(s);
  return s.last;
}

// If there is only one real choice (e.g. one movable pawn, or all movable pawns
// are stacked on the same square), return that pawn so the game can move it
// automatically like Ludo King does.
export function autoPawn(s) {
  if (s.phase !== 'move') return null;
  const color = current(s).color;
  const spots = new Set(s.movable.map(i => s.pawns[color][i]));
  return spots.size === 1 ? s.movable[0] : null;
}

// ---------- computer player ----------

function threatsAt(s, color, index) {
  // How many opponent pawns are 1..6 squares behind this track square.
  let n = 0;
  for (const other of Object.keys(s.pawns)) {
    if (other === color) continue;
    for (const q of s.pawns[other]) {
      if (q < 0 || q > LAST_TRACK) {
        // pawns in the yard threaten their own start square, but starts are safe
        continue;
      }
      const at = absIndex(other, q);
      const dist = (index - at + TRACK_LEN) % TRACK_LEN;
      if (dist >= 1 && dist <= 6 && q + dist <= LAST_TRACK) n++;
    }
  }
  return n;
}

export function chooseMove(s) {
  const color = current(s).color;
  const dice = s.dice;
  let best = s.movable[0];
  let bestScore = -Infinity;
  for (const i of s.movable) {
    const from = s.pawns[color][i];
    const to = from === -1 ? 0 : from + dice;
    let score = to * 0.5;
    if (from === -1) score += 55;
    if (to === FINISHED) score += 90;
    else if (to > LAST_TRACK && from <= LAST_TRACK) score += 45; // enters home column
    if (to <= LAST_TRACK) {
      const a = absIndex(color, to);
      if (!isSafe(a)) {
        for (const other of Object.keys(s.pawns)) {
          if (other === color) continue;
          s.pawns[other].forEach(q => {
            if (q >= 0 && q <= LAST_TRACK && absIndex(other, q) === a) score += 70 + q;
          });
        }
        score -= threatsAt(s, color, a) * 35;
      } else score += 25;
    }
    if (from >= 0 && from <= LAST_TRACK) {
      const a = absIndex(color, from);
      if (!isSafe(a)) score += threatsAt(s, color, a) * (25 + from * 0.4); // run from danger
    }
    score += Math.random() * 3; // little variety
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// Colours used for a given player count, starting from a chosen colour.
export function colorsFor(count, first = 'red') {
  const i = COLORS.indexOf(first);
  const at = k => COLORS[(i + k) % 4];
  if (count === 2) return [at(0), at(2)];
  if (count === 3) return [at(0), at(1), at(2)];
  return [at(0), at(1), at(2), at(3)];
}
