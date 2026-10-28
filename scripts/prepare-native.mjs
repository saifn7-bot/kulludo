// Creates/updates the native Android or iOS project from www/.
//   node scripts/prepare-native.mjs android
//   node scripts/prepare-native.mjs ios
// Safe to run again: it only adds the platform the first time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) { console.error('Usage: prepare-native.mjs android|ios'); process.exit(1); }
const run = cmd => { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit' }); };

if (!existsSync(platform)) run(`npx cap add ${platform}`);
run(`npx capacitor-assets generate --${platform} --iconBackgroundColor "#20124d" --iconBackgroundColorDark "#20124d" --splashBackgroundColor "#120a33" --splashBackgroundColorDark "#120a33"`);

if (platform === 'android') {
  const f = 'android/app/src/main/AndroidManifest.xml';
  let x = readFileSync(f, 'utf8');
  if (!x.includes('screenOrientation')) {
    x = x.replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
    writeFileSync(f, x);
    console.log('Locked Android to portrait');
  }
} else {
  const f = 'ios/App/App/Info.plist';
  let x = readFileSync(f, 'utf8');
  const portrait = '<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>';
  x = x.replace(/(<key>UISupportedInterfaceOrientations(~ipad)?<\/key>\s*)<array>[\s\S]*?<\/array>/g, `$1${portrait}`);
  writeFileSync(f, x);
  console.log('Locked iOS to portrait');
}
run(`npx cap sync ${platform}`);
