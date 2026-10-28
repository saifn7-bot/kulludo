// One Durable Object per room code. It owns the lobby, the dice and the rules,
// so players can't cheat by changing the app. Uses the same core.js as the app.
import * as L from '../../www/js/core.js';

const TURN_MS = 25_000; // keep in sync with TURN_SECONDS in www/js/config.js
const BOT_NAMES = ['Aisha', 'Rohan', 'Zara', 'Kabir', 'Meera', 'Omar', 'Sana', 'Arjun'];
// Seat colours by number of players (first to join gets the first colour).
const SEATS = { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: ['red', 'green', 'yellow', 'blue'] };

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sockets = new Map(); // WebSocket -> player id
    this.players = []; // lobby: { id, name, bot, connected }
    this.host = null;
    this.game = null;
    this.timer = null;
    this.deadline = 0;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    server.addEventListener('message', e => {
      try { this.onMessage(server, JSON.parse(e.data)); } catch (err) { this.sendTo(server, { t: 'error', msg: String(err.message || err) }); }
    });
    const gone = () => this.onClose(server);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  sendTo(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  broadcast(msg) { const s = JSON.stringify(msg); for (const ws of this.sockets.keys()) { try { ws.send(s); } catch {} } }
  lobbyMsg() {
    return { t: 'lobby', host: this.host, started: !!this.game, players: this.players.map(({ id, name, bot, connected }) => ({ id, name, bot, connected })) };
  }
  stateMsg() { return { t: 'state', state: this.game, deadline: this.deadline ? Math.max(0, this.deadline - Date.now()) : 0 }; }

  onMessage(ws, m) {
    if (m.t === 'ping') return;
    if (m.t === 'join') return this.join(ws, m);
    const pid = this.sockets.get(ws);
    if (!pid) return;
    const isHost = pid === this.host;
    switch (m.t) {
      case 'addBot':
        if (isHost && !this.game && this.players.length < 4) {
          const used = new Set(this.players.map(p => p.name));
          const name = BOT_NAMES.find(n => !used.has(n)) || 'Computer';
          this.players.push({ id: 'bot-' + crypto.randomUUID().slice(0, 8), name, bot: true, connected: true });
          this.broadcast(this.lobbyMsg());
        }
        break;
      case 'removeBot':
        if (isHost && !this.game) {
          const i = this.players.map(p => p.bot).lastIndexOf(true);
          if (i >= 0) { this.players.splice(i, 1); this.broadcast(this.lobbyMsg()); }
        }
        break;
      case 'start':
        if (isHost && !this.game) {
          if (this.players.length < 2) return this.sendTo(ws, { t: 'error', msg: 'Need at least 2 players' });
          this.newGame();
        }
        break;
      case 'rematch':
        if (isHost && this.game && this.game.phase === 'over') this.newGame();
        break;
      case 'roll':
        if (this.isTurn(pid) && this.game.phase === 'roll') { L.roll(this.game); this.afterAction(); }
        break;
      case 'move':
        if (this.isTurn(pid) && this.game.phase === 'move' && this.game.movable.includes(m.pawn)) { L.move(this.game, m.pawn); this.afterAction(); }
        break;
      case 'emoji': {
        const p = this.game && this.game.players.find(x => x.id === pid);
        if (p && typeof m.e === 'string' && m.e.length <= 8) this.broadcast({ t: 'emoji', color: p.color, e: m.e });
        break;
      }
    }
  }

  join(ws, { pid, name }) {
    pid = String(pid || '').slice(0, 64);
    name = String(name || 'Player').trim().slice(0, 12) || 'Player';
    if (!pid) return this.sendTo(ws, { t: 'error', msg: 'Missing player id' });
    let p = this.players.find(x => x.id === pid);
    if (!p) {
      if (this.game) return this.sendTo(ws, { t: 'error', msg: 'This game has already started' });
      if (this.players.length >= 4) return this.sendTo(ws, { t: 'error', msg: 'Room is full' });
      p = { id: pid, name, bot: false, connected: true };
      this.players.push(p);
    }
    // a player opening the room twice: drop the old socket
    for (const [other, id] of this.sockets) if (id === pid && other !== ws) { this.sockets.delete(other); try { other.close(1000, 'replaced'); } catch {} }
    p.connected = true;
    this.sockets.set(ws, pid);
    if (!this.host || !this.players.some(x => x.id === this.host && x.connected)) this.host = pid;
    this.broadcast(this.lobbyMsg());
    if (this.game) this.sendTo(ws, this.stateMsg());
  }

  onClose(ws) {
    const pid = this.sockets.get(ws);
    if (!pid) return;
    this.sockets.delete(ws);
    if ([...this.sockets.values()].includes(pid)) return; // still connected elsewhere
    const p = this.players.find(x => x.id === pid);
    if (!this.game) {
      this.players = this.players.filter(x => x.id !== pid);
    } else if (p) p.connected = false;
    if (this.host === pid) {
      const next = this.players.find(x => !x.bot && x.connected);
      this.host = next ? next.id : null;
    }
    if (!this.players.some(x => !x.bot && x.connected)) {
      // everyone left: reset the room
      clearTimeout(this.timer);
      this.players = []; this.game = null; this.host = null;
      return;
    }
    this.broadcast(this.lobbyMsg());
    if (this.game) this.schedule(); // a disconnected player's turn is played by the computer
  }

  newGame() {
    const seats = SEATS[this.players.length];
    const players = this.players.map((p, i) => ({ color: seats[i], name: p.name, kind: p.bot ? 'bot' : 'human', id: p.id }));
    this.game = L.createGame(players, { firstTurn: Math.floor(Math.random() * players.length) });
    this.broadcast(this.lobbyMsg());
    this.afterAction(true);
  }

  isTurn(pid) {
    return this.game && this.game.phase !== 'over' && L.current(this.game).id === pid;
  }

  afterAction(fresh = false) {
    this.schedule(fresh);
    this.broadcast(this.stateMsg());
  }

  // How long clients need to show the last event before the next one.
  animMs(fresh) {
    const ev = this.game.last;
    if (fresh || !ev) return 600;
    if (ev.type === 'roll') return ev.result === 'ok' ? 800 : 1400;
    return 250 + ev.path.length * 170 + (ev.captures.length ? 750 : 0) + (ev.finished ? 300 : 0) + (ev.won ? 400 : 0);
  }

  schedule(fresh = false) {
    clearTimeout(this.timer);
    this.deadline = 0;
    const g = this.game;
    if (!g || g.phase === 'over') return;
    const cur = L.current(g);
    const lp = this.players.find(p => p.id === cur.id);
    const autoplay = !lp || lp.bot || !lp.connected;
    const wait = this.animMs(fresh);
    const act = () => {
      if (this.game !== g || g.phase === 'over') return;
      if (g.phase === 'roll') L.roll(g);
      else L.move(g, L.chooseMove(g));
      this.afterAction();
    };
    const auto = L.autoPawn(g);
    if (g.phase === 'move' && auto !== null) {
      this.timer = setTimeout(() => { if (this.game === g && g.phase === 'move') { L.move(g, auto); this.afterAction(); } }, wait + 150);
    } else if (autoplay) {
      this.timer = setTimeout(act, wait + (g.phase === 'roll' ? 450 : 350));
    } else {
      this.deadline = Date.now() + wait + TURN_MS;
      this.timer = setTimeout(act, wait + TURN_MS);
    }
  }
}
