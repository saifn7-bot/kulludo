// Simulates thousands of computer-vs-computer games to check the rules engine.
// Run: node scripts/test-core.mjs
import assert from 'node:assert/strict';
import * as L from '../www/js/core.js';

assert.equal(L.TRACK.length, 52);
assert.equal(new Set(L.TRACK.map(String)).size, 52, 'track squares unique');
for (let i = 0; i < 52; i++) {
  const [r1, c1] = L.TRACK[i], [r2, c2] = L.TRACK[(i + 1) % 52];
  assert.equal(Math.abs(r1 - r2) + Math.abs(c1 - c2) <= 2, true, `track ${i} adjacent`);
}
// each colour's last track square sits next to its home column
for (const c of L.COLORS) {
  const [r, col] = L.TRACK[L.absIndex(c, L.LAST_TRACK)];
  const [hr, hc] = L.HOME_COLUMN[c][0];
  assert.equal(Math.abs(r - hr) + Math.abs(col - hc), 1, `${c} enters home column`);
}

// capture + safe-square checks
{
  const s = L.createGame([{ color: 'red', kind: 'bot' }, { color: 'yellow', kind: 'bot' }]);
  s.pawns.red[0] = 11; s.pawns.yellow[0] = (L.START_INDEX.red + 14 - L.START_INDEX.yellow + 52) % 52;
  assert.equal(L.absIndex("red", 14), L.absIndex('yellow', s.pawns.yellow[0]));
  s.turn = s.players.findIndex(p => p.color === 'red');
  L.roll(s, 3);
  const ev = L.move(s, 0);
  assert.equal(ev.captures.length, 1);
  assert.equal(s.pawns.yellow[0], -1);
  assert.equal(s.phase, 'roll'); assert.equal(L.current(s).color, 'red', 'capture gives extra turn');
}
{
  const s = L.createGame([{ color: 'red', kind: 'bot' }, { color: 'yellow', kind: 'bot' }]);
  s.turn = s.players.findIndex(p => p.color === 'red');
  s.pawns.red[0] = 5; // red 8 = star
  s.pawns.yellow[0] = (L.absIndex('red', 8) - L.START_INDEX.yellow + 52) % 52;
  L.roll(s, 3); L.move(s, 0);
  assert.notEqual(s.pawns.yellow[0], -1, 'no capture on star');
}
{ // three sixes
  const s = L.createGame([{ color: 'red', kind: 'bot' }, { color: 'yellow', kind: 'bot' }]);
  const who = L.current(s).color;
  L.roll(s, 6); L.move(s, 0); L.roll(s, 6); L.move(s, 0); L.roll(s, 6);
  assert.notEqual(L.current(s).color, who, 'three sixes passes the turn');
}

let games = 0, turns = 0;
for (let g = 0; g < 3000; g++) {
  const n = 2 + (g % 3);
  const s = L.createGame(L.colorsFor(n, L.COLORS[g % 4]).map(c => ({ color: c, kind: 'bot' })));
  let guard = 0;
  while (s.phase !== 'over') {
    if (++guard > 20000) throw new Error('game did not end');
    L.roll(s);
    if (s.phase === 'move') L.move(s, L.chooseMove(s));
    turns++;
    for (const c of Object.keys(s.pawns)) for (const p of s.pawns[c]) assert.ok(p >= -1 && p <= 56);
  }
  assert.equal(s.ranks.length, n);
  assert.equal(new Set(s.ranks).size, n);
  games++;
}
console.log(`OK — ${games} games, ${turns} rolls simulated`);
