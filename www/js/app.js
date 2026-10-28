// KulLUDO — screens, game flow and animations.
import * as L from './core.js';
import { BoardView, ROTATION, panelPos } from './board.js';
import { LocalGame, OnlineGame, newRoomCode } from './controllers.js';
import { sfx, isSoundOn, setSound } from './sound.js';
import { TURN_SECONDS } from './config.js';

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT_NAMES = ['Aisha', 'Rohan', 'Zara', 'Kabir', 'Meera', 'Omar', 'Sana', 'Arjun', 'Layla', 'Vikram', 'Noor', 'Dev'];
const CAP = c => c[0].toUpperCase() + c.slice(1);
const store = {
  get(k, d = null) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ---------------- screens ----------------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
  if (id === 'home') refreshHome();
}

function toast(msg, ms = 1600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

function modal(html, buttons = []) {
  const m = $('#modal');
  const box = $('.modal-box', m);
  box.innerHTML = html + `<div class="modal-actions"></div>`;
  const actions = $('.modal-actions', box);
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.textContent = b.label;
    el.onclick = () => { if (!b.keep) closeModal(); b.onClick && b.onClick(); };
    actions.appendChild(el);
  }
  m.classList.remove('hidden');
}
const closeModal = () => $('#modal').classList.add('hidden');

function syncSoundButtons() {
  $$('.sound-toggle').forEach(b => { b.textContent = isSoundOn() ? '🔊' : '🔇'; });
}

// ---------------- home ----------------
function refreshHome() {
  const saved = LocalGame.saved();
  $('#btn-resume').classList.toggle('hidden', !saved);
}

// ---------------- setup (vs computer / pass & play) ----------------
const setup = { mode: 'bot', count: 4, color: store.get('kl_color', 'red') };

function openSetup(mode) {
  setup.mode = mode;
  $('#setup-title').textContent = mode === 'bot' ? 'Play vs Computer' : 'Pass & Play';
  $('#color-row').classList.toggle('hidden', mode !== 'bot');
  renderSetup();
  show('setup');
}

function renderSetup() {
  $$('#seg-count button').forEach(b => b.classList.toggle('on', +b.dataset.v === setup.count));
  $$('#color-pick .swatch').forEach(b => b.classList.toggle('on', b.dataset.c === setup.color));
  const colors = L.colorsFor(setup.count, setup.mode === 'bot' ? setup.color : 'red');
  const names = $('#names');
  names.innerHTML = '';
  colors.forEach((c, k) => {
    const isBot = setup.mode === 'bot' && k > 0;
    const row = document.createElement('div');
    row.className = 'name-row';
    const def = setup.mode === 'bot' && k === 0 ? store.get('kl_name', 'You') : `Player ${k + 1}`;
    row.innerHTML = `<span class="dot c-${c}"></span>` + (isBot
      ? `<span class="bot-label">🤖 Computer</span>`
      : `<input maxlength="12" data-c="${c}" value="${def}" aria-label="${CAP(c)} player name">`);
    names.appendChild(row);
  });
}

function startLocal() {
  const colors = L.colorsFor(setup.count, setup.mode === 'bot' ? setup.color : 'red');
  const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const players = colors.map((c, k) => {
    const input = $(`#names input[data-c="${c}"]`);
    if (setup.mode === 'bot' && k > 0) return { color: c, name: shuffled[k], kind: 'bot' };
    return { color: c, name: (input && input.value.trim()) || CAP(c), kind: 'human' };
  });
  if (setup.mode === 'bot') { store.set('kl_color', setup.color); store.set('kl_name', players[0].name); }
  LocalGame.clearSaved();
  playGame(new LocalGame({ players, mode: setup.mode }));
}

// ---------------- game view ----------------
let ctrl = null;
let board = null;
let shown = null; // state currently on screen
let queue = [];
let busy = false;
let acting = false; // waiting for our own action to come back
let rot = 0;
let lobbyInfo = null;

function playGame(c) {
  if (ctrl && ctrl !== c) ctrl.stop();
  ctrl = c;
  shown = null; queue = []; busy = false; acting = false;
  ctrl.onState = s => { acting = false; queue.push(s); if (!busy) pump(); };
  $('#emoji-bar').classList.toggle('hidden', ctrl.mode !== 'online');
  show('game');
  if (ctrl.mode !== 'online') ctrl.start();
}

function setupBoard(s) {
  const mine = ctrl.myColor();
  rot = mine ? ROTATION[mine] : 0;
  board.setup(s, rot);
  $$('.panel').forEach(p => { p.className = 'panel empty'; p.innerHTML = ''; });
  for (const p of s.players) {
    const el = $(`.panel[data-pos="${panelPos(p.color, rot)}"]`);
    el.className = `panel c-${p.color}`;
    el.dataset.color = p.color;
    const me = ctrl.mode === 'online' ? p.id === ctrl.pid : ctrl.mode === 'bot' && p.kind === 'human';
    const initial = escapeHtml((p.name || CAP(p.color)).trim()[0] || '?').toUpperCase();
    el.innerHTML = `
      <div class="plate"><span class="pname">${escapeHtml(p.name || CAP(p.color))}${me && p.name !== 'You' ? ' <small>(you)</small>' : ''}</span><span class="pstat"></span></div>
      <div class="prow">
        <div class="avatar"><div class="timer"></div><span>${p.kind === 'bot' ? '🤖' : initial}</span>${me ? '<i class="me-crown">👑</i>' : ''}</div>
        <div class="dice-slot"><div class="dice-ghost"></div></div>
      </div>
      <div class="bubble"></div>`;
  }
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function pump() {
  busy = true;
  while (queue.length) {
    const s = queue.shift();
    try { await play(shown, s); } catch (e) { console.error(e); renderAll(s); }
    shown = s;
  }
  busy = false;
  renderAll(shown);
  ctrl.afterRender(shown);
}

function newGameStarted(prev, s) {
  return !prev || s.seq < prev.seq || s.players.map(p => p.color + p.name).join() !== prev.players.map(p => p.color + p.name).join();
}

async function play(prev, s) {
  if (newGameStarted(prev, s)) {
    closeModal();
    setupBoard(s);
    renderAll(s);
    if (s.phase === 'over') showResults(s);
    return;
  }
  if (s.seq === prev.seq) { renderAll(s); return; }
  const ev = s.last;
  if (!ev || s.seq !== prev.seq + 1) { renderAll(s); return; } // missed updates (e.g. reconnect): just jump

  if (ev.type === 'roll') {
    setActive(ev.color, s);
    await rollDice(ev.value);
    if (ev.result === 'three-sixes') { sfx.bad(); toast('Three 6s in a row — turn lost!'); await sleep(900); }
    else if (ev.result === 'no-move') { toast(ev.value === 6 ? 'No move — roll again' : 'No moves possible'); await sleep(650); }
    else if (ev.value === 6) sfx.six();
    renderAll(s);
    return;
  }

  if (ev.type === 'move') {
    setActive(ev.color, s, true);
    board.render(prev, []);
    for (const p of ev.path) {
      board.moveOne(ev.color, ev.pawn, p);
      ev.from === -1 ? sfx.open() : sfx.step();
      await sleep(ev.from === -1 ? 260 : 165);
    }
    if (ev.captures.length) {
      await sleep(80);
      sfx.capture();
      for (const c of ev.captures) {
        const el = board.els[c.color][c.pawn];
        el.classList.add('returning');
        board.moveOne(c.color, c.pawn, -1, 998);
        setTimeout(() => el.classList.remove('returning'), 700);
      }
      toast(`${nameOf(s, ev.color)} captured ${ev.captures.map(c => nameOf(s, c.color)).join(' & ')}!`);
      await sleep(650);
    }
    if (ev.finished) { sfx.home(); await sleep(250); }
    if (ev.won) toast(`${nameOf(s, ev.color)} finished ${ordinal(s.players.find(p => p.color === ev.color).rank)}!`, 2000);
    renderAll(s);
    if (s.phase === 'over') { await sleep(500); showResults(s); }
  }
}

const nameOf = (s, color) => (s.players.find(p => p.color === color) || {}).name || CAP(color);
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][n] || 'th');

let diceValue = 0;
function diceHTML(v) {
  const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v] || [];
  return Array.from({ length: 9 }, (_, i) => `<i class="${on.includes(i) ? 'pip' : ''}"></i>`).join('');
}
function setDiceFace(v) { diceValue = v; $('#dice .face').innerHTML = diceHTML(v); }

async function rollDice(value) {
  const d = $('#dice');
  d.classList.add('rolling');
  sfx.roll();
  for (let i = 0; i < 7; i++) { setDiceFace(1 + Math.floor(Math.random() * 6)); await sleep(70); }
  setDiceFace(value);
  d.classList.remove('rolling');
  await sleep(180);
}

function setActive(color, s, keepDice = false) {
  $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.color === color));
  const panel = $(`.panel[data-color="${color}"]`);
  const dice = $('#dice');
  if (panel && dice.parentElement !== $('.dice-slot', panel)) $('.dice-slot', panel).appendChild(dice);
  dice.dataset.color = color;
  if (!keepDice && s) setDiceFace(s.dice || diceValue || 6);
}

function canAct(s = shown) {
  return !!s && !busy && !acting && queue.length === 0 && s.phase !== 'over' && ctrl.isMine(s);
}

function renderAll(s) {
  if (!s) return;
  const cur = L.current(s);
  setActive(cur.color, s);
  const mine = canAct(s);
  const movable = mine && s.phase === 'move' && L.autoPawn(s) === null ? s.movable.map(i => ({ color: cur.color, i })) : [];
  board.render(s, movable);
  const dice = $('#dice');
  dice.classList.toggle('ready', mine && s.phase === 'roll');
  for (const p of s.players) {
    const el = $(`.panel[data-color="${p.color}"]`);
    if (!el) continue;
    const home = s.pawns[p.color].filter(x => x >= L.FINISHED).length;
    const off = lobbyInfo && ctrl.mode === 'online' && p.id && lobbyInfo.players.find(x => x.id === p.id && !x.bot && !x.connected);
    $('.pstat', el).innerHTML = p.rank ? `🏅 ${ordinal(p.rank)}` : off ? '⚠️ offline' : `🏠 ${home}/4`;
    el.classList.toggle('finished', !!p.rank);
  }
  let msg;
  if (s.phase === 'over') msg = `${nameOf(s, s.ranks[0])} wins!`;
  else if (mine) msg = s.phase === 'roll' ? 'Your turn — tap the dice' : 'Tap a glowing pawn';
  else msg = `${cur.name} is playing…`;
  if (ctrl.mode === 'local' && s.phase !== 'over') msg = `${cur.name}: ` + (s.phase === 'roll' ? 'tap the dice' : 'tap a glowing pawn');
  $('#status').textContent = msg;
  $('#status').dataset.color = cur.color;
}

function showResults(s) {
  sfx.win();
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  const rows = s.ranks.map((c, k) => `<li class="c-${c}"><span>${medals[k]}</span><span class="dot c-${c}"></span>${escapeHtml(nameOf(s, c))}</li>`).join('');
  const buttons = [{ label: 'Home', cls: 'ghost', onClick: leaveGame }];
  if (ctrl.mode !== 'online') {
    buttons.push({ label: 'Play again', onClick: () => {
      const players = s.players.map(({ color, name, kind }) => ({ color, name, kind }));
      playGame(new LocalGame({ players, mode: ctrl.mode }));
    } });
  } else if (ctrl.isHost()) buttons.push({ label: 'Rematch', onClick: () => ctrl.rematch() });
  modal(`<div class="trophy">🏆</div><h2>${escapeHtml(nameOf(s, s.ranks[0]))} wins!</h2><ol class="ranks">${rows}</ol>
    ${ctrl.mode === 'online' && !ctrl.isHost() ? '<p class="muted">Waiting for the host to start a rematch…</p>' : ''}`, buttons);
}

function leaveGame() {
  if (ctrl) ctrl.stop();
  if (ctrl && ctrl.mode !== 'online' && shown && shown.phase === 'over') LocalGame.clearSaved();
  ctrl = null; shown = null; lobbyInfo = null;
  closeModal();
  show('home');
}

// timer ring for online turns
function tick() {
  requestAnimationFrame(tick);
  if (!ctrl || ctrl.mode !== 'online' || !shown || shown.phase === 'over') return;
  const left = Math.max(0, ctrl.deadline - Date.now());
  const frac = ctrl.deadline ? Math.min(1, left / (TURN_SECONDS * 1000)) : 0;
  $$('.panel').forEach(p => p.style.setProperty('--t', p.classList.contains('active') ? frac : 0));
}

// ---------------- online ----------------
function connectOnline(room) {
  const name = $('#online-name').value.trim() || 'Player';
  store.set('kl_name', name);
  const g = new OnlineGame({ room, name });
  lobbyInfo = null;
  g.onLobby = lb => {
    lobbyInfo = lb;
    if (!lb.started) renderLobby(g, lb);
    else if (shown) renderAll(shown);
  };
  g.onError = msg => {
    toast(msg, 2500);
    if (!shown) { g.stop(); show('online'); }
  };
  g.onStatus = st => { $('#net-status').textContent = st === 'online' ? '' : st === 'connecting' ? 'Connecting…' : 'Reconnecting…'; };
  g.onEmoji = m => {
    const el = $(`.panel[data-color="${m.color}"] .bubble`);
    if (!el) return;
    el.textContent = m.e;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  };
  if (ctrl) ctrl.stop();
  ctrl = g;
  $('#lobby-code').textContent = room;
  $('#lobby-list').innerHTML = '<li class="muted">Connecting…</li>';
  $('#lobby-actions').innerHTML = '';
  show('lobby');
  // first state switches to the game screen
  g.onState = s => { playGame(g); g.onState(s); };
  g.connect();
}

function renderLobby(g, lb) {
  const list = $('#lobby-list');
  list.innerHTML = lb.players.map(p => `<li>${p.bot ? '🤖' : '🙂'} ${escapeHtml(p.name)}${p.id === lb.host ? ' 👑' : ''}${p.id === g.pid ? ' <small>(you)</small>' : ''}${!p.bot && !p.connected ? ' <small>offline</small>' : ''}</li>`).join('')
    + Array.from({ length: 4 - lb.players.length }, () => '<li class="muted">Waiting for player…</li>').join('');
  const a = $('#lobby-actions');
  if (g.isHost()) {
    const bots = lb.players.filter(p => p.bot).length;
    a.innerHTML = `<div class="row"><button class="btn ghost" id="lb-add" ${lb.players.length >= 4 ? 'disabled' : ''}>+ Computer</button>
      <button class="btn ghost" id="lb-rem" ${bots ? '' : 'disabled'}>− Computer</button></div>
      <button class="btn big" id="lb-start" ${lb.players.length < 2 ? 'disabled' : ''}>Start game (${lb.players.length} players)</button>`;
    $('#lb-add').onclick = () => g.addBot();
    $('#lb-rem').onclick = () => g.removeBot();
    $('#lb-start').onclick = () => g.start();
  } else a.innerHTML = '<p class="muted">Waiting for the host to start…</p>';
}

async function shareCode() {
  const code = $('#lobby-code').textContent;
  const text = `Join my KulLUDO game! Room code: ${code}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'KulLUDO', text }); return; }
  } catch { return; }
  try { await navigator.clipboard.writeText(code); toast('Room code copied'); }
  catch { toast('Room code: ' + code, 3000); }
}

// ---------------- wire up ----------------
function init() {
  board = new BoardView($('#board'), (color, i) => {
    if (!canAct() || shown.phase !== 'move') return;
    if (color !== L.current(shown).color || !shown.movable.includes(i)) return;
    acting = true;
    sfx.tap();
    board.render(shown, []);
    ctrl.move(i);
  });
  setDiceFace(6);
  $('#dice').addEventListener('click', () => {
    if (!canAct() || shown.phase !== 'roll') return;
    acting = true;
    $('#dice').classList.remove('ready');
    ctrl.roll();
  });

  $$('[data-go]').forEach(b => b.addEventListener('click', () => {
    sfx.tap();
    const go = b.dataset.go;
    if (go === 'setup-bot') openSetup('bot');
    else if (go === 'setup-local') openSetup('local');
    else show(go);
  }));
  $('#btn-resume').onclick = () => {
    const sv = LocalGame.saved();
    if (sv) playGame(new LocalGame({ mode: sv.mode, state: sv.state }));
  };
  $$('#seg-count button').forEach(b => b.onclick = () => { setup.count = +b.dataset.v; renderSetup(); });
  $$('#color-pick .swatch').forEach(b => b.onclick = () => { setup.color = b.dataset.c; renderSetup(); });
  $('#btn-start-local').onclick = startLocal;

  $('#online-name').value = store.get('kl_name', '');
  $('#btn-create').onclick = () => connectOnline(newRoomCode());
  $('#btn-join').onclick = () => {
    const code = $('#join-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { toast('Enter the room code'); return; }
    connectOnline(code);
  };
  $('#btn-share').onclick = shareCode;
  $('#btn-leave-lobby').onclick = () => { if (ctrl) ctrl.stop(); ctrl = null; show('online'); };

  $('#btn-exit').onclick = () => modal('<h2>Leave game?</h2><p class="muted">' +
    (ctrl && ctrl.mode === 'online' ? 'The computer will play for you.' : 'You can resume it later from the home screen.') + '</p>',
    [{ label: 'Stay', cls: 'ghost' }, { label: 'Leave', onClick: leaveGame }]);

  $$('.sound-toggle').forEach(b => b.onclick = () => { setSound(!isSoundOn()); syncSoundButtons(); });
  syncSoundButtons();
  $('#btn-rules').onclick = () => modal(`<h2>How to play</h2><ul class="rules">
    <li>Roll a <b>6</b> to bring a pawn out of your yard.</li>
    <li>Move pawns clockwise around the board, then up your coloured path to the centre.</li>
    <li>Land on an opponent to <b>capture</b> it — it goes back to its yard.</li>
    <li>Pawns on <b>star</b> and <b>start</b> squares are safe.</li>
    <li>Rolling a 6, capturing, or reaching home gives you <b>another roll</b>.</li>
    <li>Three 6s in a row and your turn is lost.</li>
    <li>You need the exact number to reach home. First to get all 4 pawns home wins!</li></ul>`, [{ label: 'Got it' }]);

  $$('#emoji-bar button').forEach(b => b.onclick = () => ctrl && ctrl.emoji && ctrl.emoji(b.textContent));
  $$('.back').forEach(b => b.onclick = () => show('home'));

  // Ludo King-style deep link: ?room=CODE opens the join screen pre-filled
  const qp = new URLSearchParams(location.search).get('room');
  if (qp) { $('#join-code').value = qp.toUpperCase(); show('online'); } else show('home');
  requestAnimationFrame(tick);

  if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
