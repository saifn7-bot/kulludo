// Game controllers. The UI talks to one of these and never changes state itself.
//   LocalGame  — vs Computer and Pass & Play (runs fully on the phone, offline)
//   OnlineGame — rooms on the Cloudflare server (server owns the dice + rules)
import * as L from './core.js';
import { serverBase } from './config.js';

const SAVE_KEY = 'kl_saved_game';

export class LocalGame {
  constructor({ players, mode, state }) {
    this.mode = mode; // 'bot' | 'local'
    this.state = state || L.createGame(players, { firstTurn: Math.floor(Math.random() * players.length) });
    this.onState = () => {};
    this.timer = null;
  }
  start() { this.emit(); }
  isMine(state = this.state) {
    const p = state.players[state.turn];
    return p && p.kind === 'human';
  }
  myColor() {
    const humans = this.state.players.filter(p => p.kind === 'human');
    return this.mode === 'bot' && humans.length === 1 ? humans[0].color : null;
  }
  roll() {
    if (this.state.phase !== 'roll') return;
    L.roll(this.state);
    this.emit();
  }
  move(i) {
    if (this.state.phase !== 'move' || !this.state.movable.includes(i)) return;
    L.move(this.state, i);
    this.emit();
  }
  emit() {
    this.save();
    this.onState(L.clone(this.state));
  }
  // Called by the UI once it has finished animating `shown`.
  afterRender(shown) {
    clearTimeout(this.timer);
    const s = this.state;
    if (shown.seq !== s.seq || s.phase === 'over') return;
    const cur = L.current(s);
    const auto = L.autoPawn(s);
    if (s.phase === 'move' && auto !== null) {
      this.timer = setTimeout(() => this.move(auto), cur.kind === 'bot' ? 350 : 250);
    } else if (cur.kind === 'bot') {
      if (s.phase === 'roll') this.timer = setTimeout(() => this.roll(), 520);
      else this.timer = setTimeout(() => this.move(L.chooseMove(s)), 450);
    }
  }
  save() {
    try {
      if (this.state.phase === 'over') localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify({ mode: this.mode, state: this.state }));
    } catch {}
  }
  stop() { clearTimeout(this.timer); }
  static saved() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
  }
  static clearSaved() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
}

function playerId() {
  let id = null;
  try { id = localStorage.getItem('kl_pid'); } catch {}
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('kl_pid', id); } catch {}
  }
  return id;
}

export function newRoomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export class OnlineGame {
  constructor({ room, name }) {
    this.mode = 'online';
    this.room = room;
    this.name = name;
    this.pid = playerId();
    this.state = null;
    this.lobby = null;
    this.deadline = 0;
    this.onState = () => {};
    this.onLobby = () => {};
    this.onEmoji = () => {};
    this.onError = () => {};
    this.onStatus = () => {};
    this.closed = false;
    this.retries = 0;
  }
  connect() {
    const url = serverBase().replace(/^http/, 'ws') + '/ws/' + this.room;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.onError('Cannot reach the game server.'); return; }
    this.ws = ws;
    this.onStatus('connecting');
    ws.onopen = () => {
      this.retries = 0;
      this.onStatus('online');
      this.send({ t: 'join', pid: this.pid, name: this.name });
      clearInterval(this.ping);
      this.ping = setInterval(() => this.send({ t: 'ping' }), 20000);
    };
    ws.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'lobby') { this.lobby = m; this.onLobby(m); }
      else if (m.t === 'state') { this.state = m.state; this.deadline = m.deadline ? Date.now() + m.deadline : 0; this.onState(m.state); }
      else if (m.t === 'emoji') this.onEmoji(m);
      else if (m.t === 'error') this.onError(m.msg);
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.closed) return;
      this.onStatus('offline');
      if (this.retries++ < 8) setTimeout(() => !this.closed && this.connect(), Math.min(1000 * this.retries, 5000));
      else this.onError('Lost connection to the game server.');
    };
  }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  isHost() { return this.lobby && this.lobby.host === this.pid; }
  isMine(state = this.state) {
    const p = state && state.players[state.turn];
    return !!p && p.id === this.pid;
  }
  myColor() {
    const p = this.state && this.state.players.find(x => x.id === this.pid);
    return p ? p.color : null;
  }
  roll() { this.send({ t: 'roll' }); }
  move(i) { this.send({ t: 'move', pawn: i }); }
  start() { this.send({ t: 'start' }); }
  addBot() { this.send({ t: 'addBot' }); }
  removeBot() { this.send({ t: 'removeBot' }); }
  rematch() { this.send({ t: 'rematch' }); }
  emoji(e) { this.send({ t: 'emoji', e }); }
  afterRender() {} // server drives timing
  stop() { this.closed = true; clearInterval(this.ping); try { this.ws && this.ws.close(); } catch {} }
}
