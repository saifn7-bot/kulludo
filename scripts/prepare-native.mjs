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

// App version comes from package.json "version" (e.g. 1.2.3 → versionCode 10203).
// Bump it in package.json before every Play Store / App Store upload.
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const [maj, min, pat] = version.split('.').map(n => parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;

if (platform === 'android') {
  const g = 'android/app/build.gradle';
  let gradle = readFileSync(g, 'utf8');
  gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]*"/, `versionName "${version}"`);
  writeFileSync(g, gradle);
  console.log(`Android version ${version} (code ${versionCode})`);
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
  const pbx = 'ios/App/App.xcodeproj/project.pbxproj';
  if (existsSync(pbx)) {
    writeFileSync(pbx, readFileSync(pbx, 'utf8')
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`));
    console.log(`iOS version ${version} (build ${versionCode})`);
  }
  console.log('Locked iOS to portrait');
}
run(`npx cap sync ${platform}`);
