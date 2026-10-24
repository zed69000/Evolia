// Copie le jardin (public/) dans www/, le dossier que Capacitor embarque dans l'application,
// et y range les polices : l'appli s'ouvre hors ligne et ne demande rien à Google Fonts.
// Seule la météo (Open-Meteo) reste en ligne, et seulement si la personne a autorisé sa position.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "www");

rmSync(out, { recursive: true, force: true });
cpSync(join(root, "public"), out, { recursive: true });
rmSync(join(out, "_headers"), { force: true }); // réglages du serveur Cloudflare, inutiles dans l'appli

const indexPath = join(out, "index.html");
const html = readFileSync(indexPath, "utf8");
const href = (html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)">/) || [])[1];
if (!href) throw new Error("index.html : lien Google Fonts introuvable");

// Un navigateur récent, pour recevoir des fichiers woff2.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
let css = await (await fetch(href.replace(/&amp;/g, "&"), { headers: { "User-Agent": UA } })).text();
mkdirSync(join(out, "vendor", "fonts"), { recursive: true });
let i = 0;
for (const url of [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])]) {
	const name = `f${i++}.woff2`;
	writeFileSync(join(out, "vendor", "fonts", name), Buffer.from(await (await fetch(url)).arrayBuffer()));
	css = css.split(url).join(name);
}
if (!i) throw new Error("aucune police téléchargée");
writeFileSync(join(out, "vendor", "fonts", "fonts.css"), css);

const local = html
	.replace(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"( crossorigin)?>\r?\n/g, "")
	.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]+">/, '<link rel="stylesheet" href="vendor/fonts/fonts.css">');
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(local)) throw new Error("index.html : il reste un lien vers Google Fonts");
writeFileSync(indexPath, local);
console.log(`www/ prêt : jardin copié, ${i} polices embarquées`);
