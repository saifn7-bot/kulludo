# KulLUDO 🎲

A Ludo King–style Ludo game for **Android and iOS** (built with Capacitor), with
**free online rooms** on Cloudflare: no VPS and no paid servers.

## What's in the game

| Feature | |
|---|---|
| Play vs Computer | 2–4 players, choose your colour, smart computer opponents |
| Pass & Play | 2–4 people on one phone |
| Play Online | Create a room → share the 6-letter code → friends join. Host can add computers to fill seats |
| Ludo King rules | 6 to open, capture sends pawn home, safe ★ and start squares, extra roll on 6 / capture / reaching home, three 6s = turn lost, exact roll to finish |
| Feel | Step-by-step pawn animation, dice roll, sounds, vibration, auto-move when there's only one choice, board rotates so **your colour is bottom-left** |
| Online extras | 25-second turn timer, emoji reactions, reconnect, computer plays for anyone who disconnects, rematch |
| Resume | Offline games are saved; "Resume game" appears on the home screen |

The server rolls the dice and checks every move, so online players can't cheat.

## Folder layout

```
www/                 the game itself (HTML/CSS/JS, no build step)
  js/core.js         rules engine + computer AI (also used by the server)
  js/config.js       ⚙️ put your Cloudflare server address here
server/              Cloudflare Worker + Durable Object (online rooms)
assets/              app icon + splash screen (source images)
scripts/             prepare-native.mjs (creates android/ & ios/), test-core.mjs
.github/workflows/   cloud builds: Android APK, iOS (no Mac), server deploy
```

---

## 1. Try it on your PC (2 minutes)

You need **Node.js 22+** (https://nodejs.org).

```bash
npm install
npm test            # simulates 3,000 games to check the rules
npm run server:dev  # opens the game + online server at http://localhost:8787
```

Open http://localhost:8787 in two browser windows (one normal, one private) to test online play.

## 2. Deploy the online server (free)

1. Make a free Cloudflare account at https://dash.cloudflare.com.
2. Run:
   ```bash
   cd server
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
3. It prints your address, for example `https://kulludo.yourname.workers.dev`.
   - That address **is also a web version of the game**, so you can share it with anyone.
   - Put it in `www/js/config.js` → `SERVER_URL`, so the phone apps can find the server.

Free plan limits: 100,000 requests/day, plus Durable Objects free usage. That's plenty for
casual games. Online rooms live in memory: if everyone leaves a room, it closes.

## 3. Android app

**Easiest (no Android Studio):** push this folder to GitHub. The **Android build** workflow
runs automatically. Open the run → *Artifacts* → download **KulLUDO-debug-apk**, then install it on
any Android phone (allow "install unknown apps").

**On your PC:** install Android Studio, then:
```bash
npm run android     # creates android/, icons, portrait lock, opens Android Studio
```
Press ▶ Run.

**Google Play:** you need a signed `.aab` file.
1. Create a keystore once:
   `keytool -genkey -v -keystore kulludo.keystore -alias kulludo -keyalg RSA -keysize 2048 -validity 10000`
2. Add these 4 GitHub secrets:
   - `ANDROID_KEYSTORE_BASE64` (the keystore file, base64-encoded)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS` (`kulludo`)
   - `ANDROID_KEY_PASSWORD`
3. The workflow then also produces **KulLUDO-release-aab**.

Keep the keystore safe: you need the same one for every update.

## 4. iOS without a Mac

The **iOS build** workflow runs on GitHub's Mac machines.

- **Without an Apple account:** it checks that the app compiles and gives you a simulator build.
  You can't install that on a real iPhone.
- **To put it on iPhones or the App Store**, you need the **Apple Developer Program ($99/year)**.
  Apple requires this, and there is no way around it. Then:
  1. On https://developer.apple.com, create the App ID `com.kulludo.app`, an
     **Apple Distribution certificate** (.p12), and an **App Store provisioning profile**.
     You can make the certificate request (CSR) on Windows with OpenSSL, so you don't need a Mac.
  2. Add these GitHub secrets:
     - `IOS_CERTIFICATE_P12_BASE64`
     - `IOS_CERTIFICATE_PASSWORD`
     - `IOS_PROVISION_PROFILE_BASE64`
     - `APPLE_TEAM_ID`
  3. *(Optional, for automatic TestFlight upload)* Create an App Store Connect API key and add:
     - `APP_STORE_CONNECT_KEY_ID`
     - `APP_STORE_CONNECT_ISSUER_ID`
     - `APP_STORE_CONNECT_KEY_P8` (the file's text)
  4. Run the workflow. You'll get a signed `.ipa`, and it's sent to TestFlight if you set up step 3.

To base64-encode a file on Windows (PowerShell):
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("kulludo.keystore")) | Set-Clipboard`

GitHub Mac minutes are free for public repos. For private repos, each Mac minute counts as 10
of your 2,000 free minutes per month.

## 5. Auto-deploy the server from GitHub (optional)

Add these GitHub settings:
- Secrets: `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`
- Repository variable: `DEPLOY_CLOUDFLARE` = `true`

After that, every push to `main` redeploys.

## Changing things

- **App name / ID:** `capacitor.config.json` (`appId` must match your Play/App Store listing)
- **Icon / splash:** replace the images in `assets/`, then run `npm run android` / `npm run ios` again
- **Turn timer:** `TURN_SECONDS` in `www/js/config.js` **and** `TURN_MS` in `server/src/room.js`
- **Rules:** `www/js/core.js` (`npm test` afterwards)
- After changing anything in `www/`, run `npx cap sync` (or just rebuild via GitHub).
