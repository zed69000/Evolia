// Réglages natifs, appliqués après `npx cap add android` :
//   node tools/app/configure-native.mjs android
// Le projet android/ est régénéré à chaque build : ces réglages vivent donc ici, pas dans Android Studio.
// Chaque réglage vérifie s'il est déjà là : on peut relancer le script sans risque.
//
//   - version : lue dans public/js/version.js ("a.b.c"). Le numéro interne de Google Play (versionCode),
//     qui doit augmenter à chaque envoi, en est déduit : a*10000 + b*100 + c (0.6.1 -> 601).
//   - permissions : position (météo et distance des balades), reconnaissance d'activité (podomètre),
//     et une seule permission Santé, la lecture des pas. Le module Santé en déclare une cinquantaine :
//     on retire les autres, sinon Google Play demande de justifier chacune.
//   - écran portrait, couleur papier au démarrage, icône du jeu, politique de confidentialité pour Health Connect.
// La signature se fait ensuite dans la chaîne commune (game-pipeline), avec la clé d'envoi du jeu.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const PRIVACY_URL = "https://evolia.sebastienalzamora.workers.dev/privacy.html";
const PAPER = "#FDF7E7";

const m = readFileSync("public/js/version.js", "utf8").match(/VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
if (!m) throw new Error("public/js/version.js : VERSION 'a.b.c' introuvable");
const [major, minor, patch] = m.slice(1).map(Number);
if (minor > 99 || patch > 99) throw new Error("version.js : b et c doivent rester sous 100");
const VERSION = `${major}.${minor}.${patch}`;
const BUILD = major * 10000 + minor * 100 + patch;

if (process.argv[2] !== "android") throw new Error("plateforme attendue : android");

function edit(path, fn) {
	const before = readFileSync(path, "utf8");
	const after = fn(before);
	if (after !== before) writeFileSync(path, after);
}

const HEALTH_KEEP = new Set(["android.permission.health.READ_STEPS"]);
const pluginManifest = "node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml";
const healthDeclared = [...readFileSync(pluginManifest, "utf8").matchAll(/android:name="(android\.permission\.health\.[A-Z_]+)"/g)].map(x => x[1]);

edit("android/app/src/main/AndroidManifest.xml", s => {
	if (!s.includes('xmlns:tools=')) s = s.replace("<manifest ", '<manifest xmlns:tools="http://schemas.android.com/tools" ');
	const perms = [
		"android.permission.ACCESS_COARSE_LOCATION",
		"android.permission.ACCESS_FINE_LOCATION",
		"android.permission.ACTIVITY_RECOGNITION",
		"android.permission.health.READ_STEPS",
	];
	let add = "";
	for (const p of perms) if (!s.includes(`"${p}"`)) add += `    <uses-permission android:name="${p}" />\n`;
	for (const p of healthDeclared) if (!HEALTH_KEEP.has(p) && !s.includes(`"${p}"`)) add += `    <uses-permission android:name="${p}" tools:node="remove" />\n`;
	// Les rappels n'ont pas besoin d'être à la minute près : pas d'alarme exacte (Google Play la fait justifier).
	if (!s.includes('"android.permission.SCHEDULE_EXACT_ALARM"')) add += '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />\n';
	if (add) s = s.replace(/(<manifest[^>]*>\n)/, `$1${add}`);
	if (!s.includes("android:screenOrientation")) s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
	if (!s.includes('android:screenOrientation="portrait"') || !s.includes('READ_HEART_RATE" tools:node="remove"')) throw new Error("AndroidManifest.xml inattendu");
	return s;
});
console.log(`AndroidManifest.xml prêt : position, podomètre, lecture des pas (${healthDeclared.length - 1} permissions Santé retirées), portrait`);

edit("android/app/src/main/res/values/strings.xml", s => s.includes("health_connect_privacy_policy_url") ? s
	: s.replace("</resources>", `    <string name="health_connect_privacy_policy_url">${PRIVACY_URL}</string>\n</resources>`));
edit("android/app/src/main/res/values/styles.xml", s => {
	if (!s.includes("windowSplashScreenBackground")) s = s.replace(/(<style name="AppTheme.NoActionBarLaunch"[^>]*>)/, `$1\n        <item name="windowSplashScreenBackground">${PAPER}</item>`);
	if (!s.includes("android:windowBackground")) s = s.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/, `$1\n        <item name="android:windowBackground">${PAPER}</item>`);
	return s;
});
console.log("Health Connect : politique de confidentialité ; démarrage couleur papier");

edit("android/app/build.gradle", s => s.replace(/versionCode \d+/, `versionCode ${BUILD}`).replace(/versionName "[^"]*"/, `versionName "${VERSION}"`));
// Health Connect demande Android 8 (API 26) au minimum ; le modèle Capacitor part de plus bas.
edit("android/variables.gradle", s => s.replace(/minSdkVersion\s*=\s*\d+/, m => (Number(m.match(/\d+/)[0]) < 26 ? "minSdkVersion = 26" : m)));
console.log(`build.gradle : version ${VERSION} (${BUILD})`);

// L'icône du jeu (dessinée par tools/app/make_icon.py) remplace celle du modèle Capacitor.
const RES = "android/app/src/main/res";
if (existsSync(`${RES}/mipmap-anydpi-v26`)) rmSync(`${RES}/mipmap-anydpi-v26`, { recursive: true });
cpSync("tools/app/android-res", RES, { recursive: true });
console.log("icône Android en place");
