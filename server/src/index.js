// KulLUDO server — runs on Cloudflare Workers (free plan).
//   /ws/<ROOMCODE>  → WebSocket to that room's Durable Object
//   everything else → the web version of the game (files from ../www)
export { Room } from './room.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([A-Za-z0-9]{4,8})$/);
    if (m) {
      const id = env.ROOMS.idFromName(m[1].toUpperCase());
      return env.ROOMS.get(id).fetch(request);
    }
    if (url.pathname === '/health') return new Response('ok');
    return env.ASSETS.fetch(request);
  },
};
