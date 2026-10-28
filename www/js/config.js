// ⚙️ After you deploy the server (see README → "Deploy the online server"),
// put your Worker address here, e.g. 'https://kulludo.your-name.workers.dev'
export const SERVER_URL = 'https://kulludo.saifn7.workers.dev';

// Inside the Android/iOS app the page is served from "localhost" with no port,
// so we must use SERVER_URL. In a normal browser (the Cloudflare-hosted web
// version, or `wrangler dev` on localhost:8787) the server is the same origin.
export function serverBase() {
  const { protocol, hostname, port, origin } = location;
  const insideApp = protocol === 'capacitor:' || (hostname === 'localhost' && !port);
  if (insideApp || protocol === 'file:') return SERVER_URL;
  return origin;
}

export const TURN_SECONDS = 25;
