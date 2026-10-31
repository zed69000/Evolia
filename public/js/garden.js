// Le jardin d'un lieu (prairie, marais, forêt…) : un terrain qui s'agrandit parcelle par parcelle
// quand on bouge, une caméra libre avec zoom, trois niveaux de détail, les plantes, les animaux,
// le vent, les ombres et le ciel (heure, saison, météo).
// Coordonnées : chaque plante garde des coordonnées locales à sa parcelle (`c`, 0 par défaut) ;
// le monde les décale de l'origine de la parcelle (colonne × PARCEL_W, rangée × PARCEL_H).

import { rng, wash, rgba, mix, paperTexture, lerp } from './watercolor.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant, paintTurf, newVariant, lookOf } from './plants.js';
import { drawCritter, CRITTER_SIZE, FLIGHT } from './critters.js';
import { GAIT } from './beasts.js';
import { SPECIES, PLACE_BY_ID } from './species.js';
import { PARCEL_W, PARCEL_H, CELLS, CELL_KM, GROUND, zoneOf, zoneName, tileSteps, keepOut } from './zones.js';
import { newPlace } from './state.js';
import { ITEMS, ITEM_PAINTERS, attracted, paintSoil, PLOT, paintAdorn, canLevel, itemBox, LINK, linkEnds } from './deco.js';

export { PARCEL_W, PARCEL_H, CELLS, CELL_KM };
export const cellsOpen = place => Math.min(CELLS.length, place?.cells ?? 1);
export const cellOrigin = i => [CELLS[i][0] * PARCEL_W, CELLS[i][1] * PARCEL_H];
const cellOf = p => p.c ?? 0;
const FENCE_STEP = 34;
const STAGES = 30;
const SWAY = { herbe: 0.09, fleur: 0.07, buisson: 0.02, arbre: 0.012 };
const MIN_Y = { herbe: 60, fleur: 100, buisson: 100, arbre: 220 };
// Construire un objet : la durée, et les instants des coups de marteau.
const BUILD_TIME = 1.25, BUILD_TAPS = [0.2, 0.5, 0.8];
const smoothstep = k => k * k * (3 - 2 * k);
// Les vieux arbres déjà là en arrivant (cœur du lieu, sur les bords pour laisser la place au milieu).
const OLD_TREES = {
	foret: [[55, 300], [365, 330], [40, 600], [385, 660], [60, 930], [360, 1000], [160, 1110], [250, 250]],
	montagne: [[60, 330], [370, 420], [345, 1010]],
	littoral: [[60, 900], [375, 1030]],
};
const POND_PADS = [[40, -10], [58, 10], [-60, 14], [-20, 24], [10, -26]];
const FLYERS = new Set(['bee', 'butterfly', 'dragonfly', 'hoverfly', 'beefly']);
// Niveaux de détail selon le zoom : formes simples, aquarelle, aquarelle détaillée.
const GLYPH_Z = 0.5, DETAIL_Z = 1.6, DETAIL_DENSITY = 2.2;
const Z_MAX = 3.2;

const DEFAULT_SUN = { rise: 7.5, set: 19 };

function ambientAt(h, sun) {
	const N = ['#1E2B4D', 0.55], DAWN = ['#F2B880', 0.25], DAY = ['#FFFFFF', 0], GOLD = ['#F4A85E', 0.25], DUSK = ['#6E5A8E', 0.4];
	const keys = [[0, N], [sun.rise - 1, N], [sun.rise, DAWN], [sun.rise + 1.5, DAY], [sun.set - 1.5, DAY], [sun.set - 0.2, GOLD], [sun.set + 0.5, DUSK], [sun.set + 1.25, N], [24, N]];
	for (let i = 0; i < keys.length - 1; i++) {
		const [h0, [c0, a0]] = keys[i], [h1, [c1, a1]] = keys[i + 1];
		if (h >= h0 && h <= h1) {
			const k = (h - h0) / (h1 - h0 || 1);
			return { color: mix(c0, c1, k), a: lerp(a0, a1, k) };
		}
	}
	return { color: '#FFFFFF', a: 0 };
}

// Lumière selon la hauteur du soleil (degrés) : un matin d'octobre, bas sur l'horizon, reste doré
// bien plus longtemps qu'un matin d'été. [hauteur, couleur multipliée, opacité]
const ALT_LIGHT = [
	[-90, '#1E2B4D', 0.58], [-12, '#1E2B4D', 0.58], [-6, '#3E4A7E', 0.5], [-2, '#8A6A9E', 0.42],
	[1, '#F09A5E', 0.32], [5, '#F4B470', 0.2], [12, '#F8D8A8', 0.09], [25, '#FFF4E4', 0.03], [40, '#FFFFFF', 0], [90, '#FFFFFF', 0],
];

function lightFromAltitude(alt) {
	for (let i = 0; i < ALT_LIGHT.length - 1; i++) {
		const [a0, c0, o0] = ALT_LIGHT[i], [a1, c1, o1] = ALT_LIGHT[i + 1];
		if (alt >= a0 && alt <= a1) {
			const k = (alt - a0) / (a1 - a0);
			return { color: mix(c0, c1, k), a: lerp(o0, o1, k) };
		}
	}
	return { color: '#FFFFFF', a: 0 };
}

export function nightAt(h, sun = DEFAULT_SUN) {
	if (h >= sun.set + 1.25 || h < sun.rise - 1) return 1;
	if (h > sun.set) return (h - sun.set) / 1.25;
	if (h < sun.rise) return (sun.rise - h);
	return 0;
}

// Part de soleil direct selon la météo : elle règle la netteté des ombres.
const CLOUD_X = 2080, CLOUD_Y = 1720;
const SUNNY = { clear: 1, clouds: 0.6, overcast: 0.15, fog: 0.05, drizzle: 0.2, rain: 0.1, storm: 0.05, snow: 0.2 };

/** Animaux au sol : triés avec les plantes, pour passer devant ou derrière elles. */
const onGround = b => (b.behavior === 'walk' || b.behavior === 'bound' || b.behavior === 'roam' || b.behavior === 'trail' || (b.behavior === 'hop' && b.mode !== 'hop') || b.kind === 'heron' || b.kind === 'frog') && !b.p.swim;

/** Graine d'une parcelle de potager, tirée de son identifiant (ses cultures et sa terre restent les mêmes). */
const plotSeed = it => { let h = 7; for (const ch of String(it.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 997; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const RANK = { herbe: 0, fleur: 1, buisson: 2, arbre: 3 };
/** Qui sème quoi, et au bout de combien de plantes mûres de l'étage du dessous. */
const SUCCESSION = {
	herbe: { every: 4, type: 'fleur', start: 0.2, by: { default: ['le vent', 'une abeille', 'un bourdon'], littoral: ['le vent'], montagne: ['le vent', 'un bourdon'] } },
	fleur: { every: 5, type: 'buisson', start: 0.12, by: { default: ['un merle', 'une fauvette', 'une grive'], littoral: ['un goéland', 'le vent'] } },
	buisson: { every: 4, type: 'arbre', start: 0.06, by: { default: ['un geai', 'un écureuil', 'une sittelle'], montagne: ['un cassenoix', 'un écureuil'], marais: ['un geai', 'le courant'] } },
};

export class Garden {
	constructor(canvas, state) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.state = state;
		this.sprites = new Map();
		this.meta = new Map();
		this.decorSprites = new Map();
		this.itemSprites = new Map();
		this.bgs = new Map();
		this.tileJobs = new Map();
		this.insects = [];
		this.particles = [];
		this.builds = []; // chantiers en cours : un objet qu'on vient de poser se monte sous nos yeux
		this.drops = [];
		this.nectarDrops = []; // gouttes de nectar qui volent d'une fleur jusqu'au compteur
		this.pdata = {};
		this.blobs = new Map();
		this.fireflies = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, a: Math.random() * 6.28 }));
		this.paper = paperTexture(256);
		this.hourOverride = null;
		this.sun = DEFAULT_SUN;
		this.season = null;
		this.seasonKey = '';
		this.weather = { kind: 'clear', wind: 10, temp: 15 };
		this.t = 0;
		this.flash = 0;
		this.popAt = {};
		this.buildAt = {};
		this.nextPopulate = 0;
		this.onTap = null;
		this.pointers = new Map();
		this.vel = { x: 0, y: 0 };
		this.biome = state.place;
		this.active = 0;
		this.cam = { cx: PARCEL_W / 2, cy: PARCEL_H * 0.42, z: 1 };

		this.ensurePlace(this.biome);
		this.tidyPlants();
		this.resize();
		new ResizeObserver(() => this.resize()).observe(canvas);
		this.bindInput();
		this.last = performance.now();
		requestAnimationFrame(this.frame);
	}

	// ─── Lieu et parcelles ─────────────────────────────────────────

	get place() { return this.state.places[this.biome]; }

	/** Crée le jardin d'un lieu la première fois qu'on y va, avec quelques plantes de départ. */
	ensurePlace(id) {
		const place = this.state.places[id];
		if (place && (place.seeded || place.plants.length)) return false;
		if (!place) this.state.places[id] = newPlace();
		this.state.places[id].seeded = true;
		this.seedStarterGarden(id);
		return true;
	}

	/**
	 * Le caractère d'un lieu dès l'arrivée : la forêt a déjà ses vieux arbres, la montagne ses mélèzes, la dune
	 * ses pins. Ajouté une seule fois, aussi aux lieux ouverts avant ; rien ne reste dans l'eau des mares du marais.
	 */
	renewPlace(id) {
		const place = this.state.places[id];
		if (!place || (place.renewed ?? 0) >= 1) return;
		place.renewed = 1;
		for (const [x, y] of OLD_TREES[id] ?? []) {
			if (place.plants.some(p => Math.hypot(p.x - x, (p.y - y) * 1.25) < 70)) continue;
			this.spawn(id, 'arbre', 1, { x, y });
		}
		const ponds = Object.values(DECOR).filter(d => d.place === id && d.always && d.rad);
		place.plants = place.plants.filter(p => !ponds.some(d => Math.hypot(p.x - d.x, (p.y - d.y) * 1.25) < d.rad));
	}

	/** Les plantes d'une ancienne version restées hors des clairières reviennent à l'intérieur. */
	tidyPlants() {
		for (const p of this.place.plants) {
			const ci = cellOf(p), [ox, oy] = cellOrigin(ci);
			if (ci >= cellsOpen(this.place) || (this.inBlob(this.blob(ci), ox + p.x, oy + p.y, 10) && !keepOut(this.biome, ox + p.x, oy + p.y))) continue;
			const pos = this.place_(this.biome, p.type, ci);
			p.x = Math.round(pos.x); p.y = Math.round(pos.y);
		}
		for (const it of this.place.items ?? []) this.clearUnder(it);
	}

	/** Change de lieu : un autre jardin, d'autres espèces. */
	setPlace(id) {
		this.ensurePlace(id);
		this.renewPlace(id);
		this.biome = id;
		this.active = 0;
		this.insects = [];
		this.pdata = {};
		this.particles = [];
		this.current = null;
		this.nextPopulate = 0;
		this.cam = { cx: PARCEL_W / 2, cy: PARCEL_H * 0.42, z: 1 };
		this.camTarget = null;
		this.tidyPlants();
	}

	openCells() {
		return Array.from({ length: cellsOpen(this.place) }, (_, i) => i);
	}

	/** La prochaine parcelle, dans la brume, avec les kilomètres qu'il reste à faire ici pour l'ouvrir. */
	lockedCells() {
		const n = cellsOpen(this.place);
		return n < CELLS.length ? [n] : [];
	}

	cellAt(wx, wy) {
		const gx = Math.floor(wx / PARCEL_W), gy = Math.floor(wy / PARCEL_H);
		return CELLS.findIndex(([x, y]) => x === gx && y === gy);
	}

	/** Une nouvelle parcelle s'ouvre avec les plantes de son coin, pour qu'elle ait tout de suite son caractère. */
	openCell(i) {
		const place = this.place;
		place.cells = Math.max(cellsOpen(place), i + 1);
		const start = zoneOf(this.biome, i)?.start ?? [['herbe', 5, 1], ['fleur', 2, 1]];
		// Une parcelle est grande : on double les herbes et on ajoute moitié plus de fleurs, pour qu'elle ne paraisse jamais vide.
		const more = { herbe: 2, fleur: 1.5 };
		for (const [type, count, growth] of start) {
			for (let k = 0; k < Math.round(count * (more[type] ?? 1)); k++) this.spawn(this.biome, type, growth, this.place_(this.biome, type, i), i);
		}
		const [ox, oy] = cellOrigin(i);
		this.burst(ox + PARCEL_W / 2, oy + PARCEL_H * 0.4, 30, '#F4C23E');
	}

	// ─── Clairières : chaque parcelle est une forme ronde ou ovale, un peu bosselée ; elles se fondent entre elles.

	/** Forme d'une parcelle : ovale tiré au hasard (mais toujours le même pour ce lieu et cette parcelle), bord ondulé. */
	blob(ci) {
		const key = `${this.biome}:${ci}`;
		let b = this.blobs.get(key);
		if (b) return b;
		const r = rng(7 + this.biome.length * 97 + ci * 53);
		const [ox, oy] = cellOrigin(ci);
		b = {
			cx: ox + PARCEL_W / 2 + r.range(-20, 20), cy: oy + PARCEL_H / 2 + r.range(-40, 40),
			rx: PARCEL_W * r.range(0.76, 0.88), ry: PARCEL_H * r.range(0.53, 0.57), rot: r.range(-0.1, 0.1),
			waves: [[2, r.range(0.04, 0.08), r() * 6.28], [3, r.range(0.03, 0.06), r() * 6.28], [5, r.range(0.01, 0.025), r() * 6.28], [7, r.range(0.005, 0.012), r() * 6.28]],
		};
		// Vers les parcelles voisines (haut, bas, côtés), le bord ne rentre jamais : les clairières se rejoignent toujours.
		b.ry *= 1.02 / Math.min(1.02, this.blobRadius(b, Math.PI / 2), this.blobRadius(b, -Math.PI / 2));
		b.rx *= 1.02 / Math.min(1.02, this.blobRadius(b, 0), this.blobRadius(b, Math.PI));
		const per = Math.PI * (b.rx + b.ry);
		const n = Math.max(48, Math.round(per / 12));
		b.pts = Array.from({ length: n }, (_, k) => this.blobPoint(b, (k / n) * Math.PI * 2));
		this.blobs.set(key, b);
		return b;
	}

	blobRadius(b, a) {
		let k = 1;
		for (const [f, amp, ph] of b.waves) k += amp * Math.sin(f * a + ph);
		return k;
	}

	blobPoint(b, a) {
		const k = this.blobRadius(b, a);
		const x = Math.cos(a) * b.rx * k, y = Math.sin(a) * b.ry * k;
		const c = Math.cos(b.rot), sn = Math.sin(b.rot);
		return [b.cx + x * c - y * sn, b.cy + x * sn + y * c];
	}

	/** Le point (monde) est-il dans la clairière, avec une marge `pad` en unités du monde ? */
	inBlob(b, x, y, pad = 0) {
		const c = Math.cos(-b.rot), sn = Math.sin(-b.rot);
		const dx = x - b.cx, dy = y - b.cy;
		const lx = (dx * c - dy * sn) / b.rx, ly = (dx * sn + dy * c) / b.ry;
		const a = Math.atan2(ly, lx);
		return Math.hypot(lx, ly) < this.blobRadius(b, a) - pad / Math.min(b.rx, b.ry);
	}

	inOpen(x, y, pad = 0) {
		return this.openCells().some(i => this.inBlob(this.blob(i), x, y, pad));
	}

	tracePath(ctx, b) {
		ctx.moveTo(b.pts[0][0], b.pts[0][1]);
		for (let k = 1; k < b.pts.length; k++) ctx.lineTo(b.pts[k][0], b.pts[k][1]);
		ctx.closePath();
	}

	bounds() {
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for (const i of [...this.openCells(), ...this.lockedCells()]) {
			const [ox, oy] = cellOrigin(i);
			x0 = Math.min(x0, ox); y0 = Math.min(y0, oy); x1 = Math.max(x1, ox + PARCEL_W); y1 = Math.max(y1, oy + PARCEL_H);
		}
		return { x0, y0, x1, y1 };
	}

	// ─── Mise en page et caméra ────────────────────────────────────

	resize() {
		const cssW = this.canvas.clientWidth, cssH = this.canvas.clientHeight;
		if (!cssW || !cssH) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		this.canvas.width = Math.round(cssW * dpr);
		this.canvas.height = Math.round(cssH * dpr);
		this.dpr = dpr;
		const base = cssW / PARCEL_W;
		if (base !== this.base) {
			this.base = base;
			this.sprites.clear();
			this.decorSprites.clear();
			this.itemSprites.clear();
			this.bgs.clear();
			this.tileJobs.clear();
			this.makeClouds();
			this.makeGlow();
		}
		this.makeVignette();
		this.paperPattern = this.ctx.createPattern(this.paper, 'repeat');
	}

	/** Gardé pour compatibilité : la caméra est libre, les bandeaux ne la bornent plus. */
	setPads() {}

	/** Densité de pixels d'un sprite au niveau normal (zoom 1). */
	get density() { return this.base * this.dpr; }
	get scale() { return this.base * this.dpr * this.cam.z; }
	get glyph() { return this.cam.z < GLYPH_Z; }

	zMin() {
		const b = this.bounds();
		const fit = Math.min(this.canvas.clientWidth / ((b.x1 - b.x0) * this.base), this.canvas.clientHeight / ((b.y1 - b.y0) * this.base));
		return Math.min(0.9, Math.max(0.12, fit * 0.92));
	}

	/** Rectangle du monde visible à l'écran. */
	view() {
		const w = this.canvas.clientWidth / (this.base * this.cam.z), h = this.canvas.clientHeight / (this.base * this.cam.z);
		return { x0: this.cam.cx - w / 2, y0: this.cam.cy - h / 2, w, h };
	}

	clampCam() {
		const b = this.bounds(), v = this.view();
		const mx = v.w * 0.35, my = v.h * 0.35;
		this.cam.cx = Math.max(b.x0 - mx + v.w / 2, Math.min(b.x1 + mx - v.w / 2, this.cam.cx));
		if (b.x1 - b.x0 + 2 * mx < v.w) this.cam.cx = (b.x0 + b.x1) / 2;
		this.cam.cy = Math.max(b.y0 - my + v.h / 2, Math.min(b.y1 + my - v.h / 2, this.cam.cy));
		if (b.y1 - b.y0 + 2 * my < v.h) this.cam.cy = (b.y0 + b.y1) / 2;
	}

	toWorld(sx, sy) {
		return [this.cam.cx + (sx - this.canvas.clientWidth / 2) / (this.base * this.cam.z), this.cam.cy + (sy - this.canvas.clientHeight / 2) / (this.base * this.cam.z)];
	}

	/** Zoome de `factor` en gardant fixe le point d'écran (sx, sy). */
	zoomAt(factor, sx, sy) {
		const [wx, wy] = this.toWorld(sx, sy);
		this.cam.z = Math.max(this.zMin(), Math.min(Z_MAX, this.cam.z * factor));
		const [nx, ny] = this.toWorld(sx, sy);
		this.cam.cx += wx - nx;
		this.cam.cy += wy - ny;
		this.camTarget = null;
	}

	/** Glisse doucement la caméra vers un point du monde, au zoom donné. */
	flyTo(cx, cy, z = this.cam.z) {
		// Pendant qu'on aménage, la vue ne bouge que sous le doigt : rien ne l'emmène ailleurs.
		if (this.camLock?.()) return;
		this.camTarget = { cx, cy, z: Math.max(this.zMin(), Math.min(Z_MAX, z)) };
	}

	flyToCell(i) {
		const [ox, oy] = cellOrigin(i);
		this.flyTo(ox + PARCEL_W / 2, oy + PARCEL_H * 0.42, 1);
	}

	/** Vue d'ensemble des parcelles du lieu, ou retour sur la parcelle regardée. */
	toggleOverview() {
		if (this.cam.z >= GLYPH_Z) {
			const b = this.bounds();
			this.flyTo((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, this.zMin());
		} else this.flyToCell(this.active);
	}

	focusOn(wx, wy) {
		this.flyTo(wx, wy, Math.max(1, this.cam.z));
	}

	setFollow(on) {
		this.following = on;
		if (!on) this.camTarget = null;
	}

	makeVignette() {
		const c = document.createElement('canvas');
		c.width = this.canvas.width; c.height = this.canvas.height;
		const g = c.getContext('2d');
		const grd = g.createRadialGradient(c.width / 2, c.height * 0.45, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height * 0.45, Math.max(c.width, c.height) * 0.75);
		grd.addColorStop(0, 'rgba(28,60,30,0)');
		grd.addColorStop(1, 'rgba(28,60,30,0.32)');
		g.fillStyle = grd;
		g.fillRect(0, 0, c.width, c.height);
		this.vignette = c;
	}

	makeClouds() {
		this.clouds = [0, 1, 2, 3].map(i => {
			// Toile large et taches bien au centre : un bord coupé se verrait comme un rectangle.
			const w = 480, h = 340;
			const c = document.createElement('canvas');
			c.width = Math.ceil(w * this.density); c.height = Math.ceil(h * this.density);
			const g = c.getContext('2d');
			g.scale(this.density, this.density);
			const r = rng(50 + i);
			const off = () => Math.max(-1.5, Math.min(1.5, r.gauss()));
			for (let k = 0; k < 4; k++) wash(g, w / 2 + off() * 40, h / 2 + off() * 20, r.range(60, 90), r.range(40, 60), '#2E4A22', r, { layers: 8, alpha: 0.05, edge: 0, variance: 0.25 });
			return { canvas: c, w, h, x: i * 520, y: i * 430, speed: 6 + i * 2 };
		});
	}

	makeGlow() {
		const c = document.createElement('canvas');
		const n = Math.ceil(28 * this.density);
		c.width = c.height = n;
		const g = c.getContext('2d');
		const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
		grd.addColorStop(0, 'rgba(255,240,150,0.9)');
		grd.addColorStop(0.25, 'rgba(250,226,110,0.45)');
		grd.addColorStop(1, 'rgba(250,226,110,0)');
		g.fillStyle = grd;
		g.fillRect(0, 0, n, n);
		this.glow = c;
	}

	/** Saison du moment : elle recolore feuillages et sols ; on repeint quand elle change. */
	setSeason(s) {
		this.season = s;
		const key = ['autumn', 'winter', 'spring'].map(k => Math.round((s[k] ?? 0) * 10)).join('-');
		if (key !== this.seasonKey) {
			this.seasonKey = key;
			this.sprites.clear();
			this.bgs.clear();
			this.tileJobs.clear();
		}
	}

	groundColor(c) {
		const s = this.season;
		if (!s) return c;
		return mix(mix(c, '#B8A060', (s.autumn ?? 0) * 0.16), '#A8B098', (s.winter ?? 0) * 0.3);
	}

	/**
	 * Sol d'une case de la grille (gx, gy), mis en cache ; sans raccord avec ses voisines.
	 * De loin (`lo`), une version légère, six fois plus petite en mémoire. Une case pas encore peinte
	 * attend son tour (une par image) : on montre en attendant sa version légère, ou la couleur du sol.
	 */
	tileFor(gx, gy, lo = false) {
		const key = `${this.biome}:${gx},${gy}`;
		const hi = this.bgs.get(key), light = this.bgs.get(`${key}:lo`);
		const want = lo ? light : hi;
		if (want) { want.used = this.t; return want.canvas; }
		// D'abord la version légère (vite prête), puis la détaillée si on regarde de près.
		if (!light) this.queueTile(gx, gy, true);
		else if (!lo) this.queueTile(gx, gy, false);
		const other = lo ? hi : light;
		if (other) other.used = this.t;
		return other?.canvas ?? null;
	}

	queueTile(gx, gy, lo) {
		const key = `${this.biome}:${gx},${gy}${lo ? ':lo' : ''}`;
		if (this.tileJobs.has(key)) return;
		const D = this.density * (lo ? 0.4 : 1);
		const c = document.createElement('canvas');
		c.width = Math.ceil(PARCEL_W * D);
		c.height = Math.ceil(PARCEL_H * D);
		const g = c.getContext('2d');
		g.scale(D, D);
		this.tileJobs.set(key, { key, c, g, steps: tileSteps(this.biome, gx, gy, col => this.groundColor(col), this.season), i: 0, lo, at: this.t });
	}

	/** Avance la peinture des cases en attente, sans dépasser `ms` millisecondes par image. */
	workTiles(ms) {
		if (!this.tileJobs.size) return;
		const end = performance.now() + ms;
		// Les versions légères d'abord, puis les plus anciennes demandes.
		const jobs = [...this.tileJobs.values()].sort((a, b) => (b.lo - a.lo) || (a.at - b.at));
		for (const job of jobs) {
			while (job.i < job.steps.length) {
				job.steps[job.i++](job.g);
				if (performance.now() > end) return;
			}
			this.tileJobs.delete(job.key);
			this.bgs.set(job.key, { canvas: job.c, used: this.t });
		}
	}

	/** Garde en mémoire au plus 8 cases détaillées et 30 légères, les plus récemment vues. */
	trimTiles() {
		if (this.bgs.size < 30) return;
		const hi = [], lo = [];
		for (const [k, t] of this.bgs) (k.endsWith(':lo') ? lo : hi).push([k, t.used]);
		for (const [list, max] of [[hi, 8], [lo, 30]]) {
			if (list.length <= max) continue;
			list.sort((a, b) => b[1] - a[1]);
			for (const [k] of list.slice(max)) this.bgs.delete(k);
		}
	}

	/**
	 * La brume au-delà des clairières, en une seule couche : on la remplit, puis on y découpe les clairières
	 * ouvertes (et, à moitié, la prochaine). Le sol n'est ainsi peint qu'une fois par image.
	 */
	drawMist(ctx, world, sw, sh) {
		// La brume est floue : on la peint à demi-résolution (quatre fois moins de pixels), puis on l'agrandit.
		const cw = Math.ceil(sw / 2), ch = Math.ceil(sh / 2);
		if (!this.mist || this.mist.width !== cw || this.mist.height !== ch) {
			this.mist = document.createElement('canvas');
			this.mist.width = cw; this.mist.height = ch;
		}
		const m = this.mist.getContext('2d');
		m.setTransform(1, 0, 0, 1, 0, 0);
		m.globalCompositeOperation = 'source-over';
		m.globalAlpha = 1;
		m.clearRect(0, 0, cw, ch);
		const S = this.scale / 2;
		if (this.glyph) {
			m.fillStyle = 'rgba(232,226,204,0.72)';
			m.fillRect(0, 0, cw, ch);
		} else {
			// Un voile léger, puis des bancs de brume peints qui dérivent lentement, accrochés au monde.
			m.fillStyle = 'rgba(238,234,218,0.3)';
			m.fillRect(0, 0, cw, ch);
			this.fogLayer(m, cw, ch, S, 0.85, 1, 0);
		}
		m.setTransform(S, 0, 0, S, cw / 2 - this.cam.cx * S, ch / 2 - this.cam.cy * S);
		m.globalCompositeOperation = 'destination-out';
		// Au littoral, la mer reste nette : la brume s'efface au-dessus du rivage.
		if (this.biome === 'littoral' && !this.glyph) {
			const prev = m.fillStyle, fade = m.createLinearGradient(0, 120, 0, 190);
			fade.addColorStop(0, 'rgba(0,0,0,0.85)');
			fade.addColorStop(1, 'rgba(0,0,0,0)');
			m.fillStyle = fade;
			m.fillRect(-1e5, -1e5, 2e5, 1e5 + 190);
			m.fillStyle = prev;
		}
		m.globalAlpha = 0.55;
		for (const i of this.lockedCells()) { m.beginPath(); this.tracePath(m, this.blob(i)); m.fill(); }
		m.globalAlpha = 1;
		if (this.glyph) {
			m.beginPath();
			for (const i of this.openCells()) this.tracePath(m, this.blob(i));
			m.fill();
		} else {
			// Tout l'intérieur du jardin, poches entre les clairières comprises, au bord déjà fondu.
			const mk = this.gardenMask();
			m.drawImage(mk.canvas, mk.x0, mk.y0, mk.canvas.width / mk.k, mk.canvas.height / mk.k);
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(this.mist, 0, 0, sw, sh);
		world();
	}

	/**
	 * Forme du jardin ouvert, en basse résolution : les clairières, plus les poches qu'elles enferment entre elles
	 * (sinon la brume s'y déposait en bandes pâles au milieu du jardin). Calculée une fois par ensemble de clairières.
	 */
	gardenMask() {
		const open = this.openCells();
		const key = `${this.biome}:${open.join(',')}`;
		if (this.maskCache?.key === key) return this.maskCache;
		const k = 1 / 8, pad = 160;
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for (const i of open) for (const [x, y] of this.blob(i).pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
		x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
		const W = Math.ceil((x1 - x0) * k), H = Math.ceil((y1 - y0) * k);
		const c = document.createElement('canvas');
		c.width = W; c.height = H;
		const g = c.getContext('2d');
		g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
		g.fillStyle = g.strokeStyle = '#000';
		g.lineWidth = 40;
		g.lineJoin = 'round';
		for (const i of open) { g.beginPath(); this.tracePath(g, this.blob(i)); g.fill(); g.stroke(); }
		// Tout ce qu'on n'atteint pas depuis le bord sans traverser une clairière est dans le jardin.
		const img = g.getImageData(0, 0, W, H), px = img.data;
		const outside = new Uint8Array(W * H), stack = [];
		const push = j => { if (!outside[j] && px[j * 4 + 3] < 128) { outside[j] = 1; stack.push(j); } };
		for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
		for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
		while (stack.length) {
			const j = stack.pop(), x = j % W;
			if (x > 0) push(j - 1);
			if (x < W - 1) push(j + 1);
			if (j >= W) push(j - W);
			if (j < W * (H - 1)) push(j + W);
		}
		for (let j = 0; j < W * H; j++) { px[j * 4] = px[j * 4 + 1] = px[j * 4 + 2] = 0; px[j * 4 + 3] = outside[j] ? 0 : 255; }
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.putImageData(img, 0, 0);
		// Bord fondu : la forme est adoucie avant d'être agrandie.
		const soft = document.createElement('canvas');
		soft.width = W; soft.height = H;
		const sg = soft.getContext('2d');
		sg.filter = 'blur(3px)';
		sg.drawImage(c, 0, 0);
		return (this.maskCache = { key, canvas: soft, x0, y0, k });
	}

	/** Calque des ombres portées, à la taille de l'écran. */
	shadowLayer(cw, ch) {
		if (!this.shadowCanvas || this.shadowCanvas.width !== cw || this.shadowCanvas.height !== ch) {
			this.shadowCanvas = document.createElement('canvas');
			this.shadowCanvas.width = cw;
			this.shadowCanvas.height = ch;
		}
		return this.shadowCanvas;
	}

	/** Tache ronde et douce (opaque au centre, fondue au bord), base de toutes les ombres. */
	softDot() {
		if (this.dotCanvas) return this.dotCanvas;
		const c = document.createElement('canvas');
		c.width = c.height = 64;
		const g = c.getContext('2d');
		const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		grd.addColorStop(0, 'rgba(0,0,0,1)');
		grd.addColorStop(0.55, 'rgba(0,0,0,0.85)');
		grd.addColorStop(1, 'rgba(0,0,0,0)');
		g.fillStyle = grd;
		g.fillRect(0, 0, 64, 64);
		return (this.dotCanvas = c);
	}

	/** Texture de brume : de grandes taches douces, raccordées sur les bords pour se répéter sans couture. */
	fogTexture() {
		if (this.fogTex) return this.fogTex;
		const N = 512, c = document.createElement('canvas');
		c.width = c.height = N;
		const g = c.getContext('2d'), r = rng(4242);
		for (let i = 0; i < 46; i++) {
			const x = r() * N, y = r() * N, rad = 50 + r() * 120, a = 0.05 + r() * 0.1;
			const sy = 0.45 + r() * 0.3;
			for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
				g.save();
				g.translate(x + ox, y + oy);
				g.scale(1, sy);
				const grd = g.createRadialGradient(0, 0, 0, 0, 0, rad);
				grd.addColorStop(0, `rgba(250,250,246,${a})`);
				grd.addColorStop(0.6, `rgba(246,246,240,${a * 0.55})`);
				grd.addColorStop(1, 'rgba(246,246,240,0)');
				g.fillStyle = grd;
				g.fillRect(-rad, -rad, rad * 2, rad * 2);
				g.restore();
			}
		}
		return (this.fogTex = c);
	}

	/**
	 * Une couche de bancs de brume sur tout l'écran. `k` : échelle des bancs ; `drift` : vitesse de dérive ;
	 * `screen` : 0 = accrochée au monde (bouge avec la caméra), 1 = posée sur l'écran.
	 */
	/**
	 * La lumière du soleil, comme dans un dessin animé à l'aquarelle : une lueur chaude venue d'en haut à gauche
	 * (le côté d'où viennent les ombres), des rayons obliques qui respirent, une heure dorée matin et soir,
	 * et quelques bancs de brume qui glissent sur le jardin au lever du jour.
	 */
	drawSunlight(ctx, cw, ch, S, hour, day, wk) {
		const sunny = (SUNNY[wk] ?? 1) * day;
		if (sunny < 0.05) return;
		const alt = this.altitude ? this.altitude(hour) : 50 - Math.abs(hour - 13.5) * 9;
		const golden = Math.max(0, Math.min(1, 1 - (alt - 2) / 16));
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'screen';
		// La lueur : forte dans le coin du soleil, nulle à l'opposé ; dorée matin et soir.
		const glow = ctx.createRadialGradient(-cw * 0.1, -ch * 0.15, 0, -cw * 0.1, -ch * 0.15, Math.hypot(cw, ch) * 0.95);
		const warm = golden > 0.3 ? '255,196,120' : '255,236,190';
		glow.addColorStop(0, `rgba(${warm},${(0.2 + 0.18 * golden) * sunny})`);
		glow.addColorStop(0.45, `rgba(${warm},${(0.06 + 0.08 * golden) * sunny})`);
		glow.addColorStop(1, `rgba(${warm},0)`);
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, cw, ch);
		// Les rayons : de larges bandes obliques, très douces, qui s'allument et s'éteignent lentement.
		const len = Math.hypot(cw, ch) * 1.3, ang = 0.62 + golden * 0.2;
		ctx.translate(-cw * 0.08, -ch * 0.1);
		ctx.rotate(ang);
		for (let i = 0; i < 5; i++) {
			const breathe = 0.5 + 0.5 * Math.sin(this.t * 0.18 + i * 1.9);
			const off = (i - 1.2) * cw * 0.16, w = cw * (0.05 + 0.03 * ((i * 7) % 3));
			const a = (0.05 + 0.05 * golden) * sunny * breathe;
			const g = ctx.createLinearGradient(0, 0, len, 0);
			g.addColorStop(0, `rgba(${warm},${a})`);
			g.addColorStop(0.7, `rgba(${warm},${a * 0.4})`);
			g.addColorStop(1, `rgba(${warm},0)`);
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(0, off - w * 0.2); ctx.lineTo(len, off - w); ctx.lineTo(len, off + w); ctx.lineTo(0, off + w * 0.2);
			ctx.closePath();
			ctx.fill();
		}
		ctx.restore();
		// Brume du matin, entre le lever du soleil et le milieu de matinée, sauf par grand vent.
		const morning = hour < 12 ? Math.max(0, Math.min(1, 1 - (alt - 4) / 18)) : 0;
		if (morning > 0.05 && wk !== 'fog' && (this.weather.wind ?? 10) < 30) this.fogLayer(ctx, cw, ch, S, 0.24 * morning, 1.3, 0, 4);
	}

	fogLayer(ctx, cw, ch, S, alpha, k, screen, drift = 6) {
		const tex = this.fogTexture();
		const pat = ctx.createPattern(tex, 'repeat');
		const z = screen ? k : S * k * 1.6;
		const ox = screen ? this.t * drift : (cw / 2 - this.cam.cx * S) + this.t * drift * S;
		const oy = screen ? this.t * drift * 0.3 : (ch / 2 - this.cam.cy * S) + this.t * drift * 0.3 * S;
		pat.setTransform(new DOMMatrix().translateSelf(ox, oy).scaleSelf(z, z * 0.8));
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = alpha;
		ctx.fillStyle = pat;
		ctx.fillRect(0, 0, cw, ch);
		ctx.restore();
	}

	// ─── Plantes ───────────────────────────────────────────────────

	/** Un premier jardin composé à la main pour chaque lieu, pour ne pas arriver sur un terrain vide. */
	seedStarterGarden(pid) {
		const starters = {
			prairie: { herbe: [[70, 470], [115, 520], [300, 420], [345, 560], [210, 640], [80, 690], [265, 740], [190, 500]], fleur: [[140, 440, 1], [172, 470, 1], [120, 480, 0.3]], arbre: [[310, 330, 0.08]] },
			marais: { herbe: [[50, 330], [370, 340], [40, 770], [380, 700], [300, 820], [140, 820]], fleur: [[330, 370, 1], [80, 740, 1], [360, 760, 0.3]] },
			foret: { herbe: [[70, 420], [340, 460], [200, 620], [90, 700], [330, 700]], fleur: [[120, 470, 1], [150, 500, 1], [300, 520, 0.3]], arbre: [[260, 300, 0.08]] },
			montagne: { herbe: [[80, 480], [140, 540], [300, 470], [360, 600], [220, 660]], fleur: [[200, 520, 1], [230, 545, 1]], arbre: [[90, 330, 0.08]] },
			littoral: { herbe: [[60, 420], [120, 470], [300, 450], [360, 520], [200, 560], [80, 640]], fleur: [[240, 480, 1], [150, 600, 0.3]], arbre: [[330, 760, 0.08]] },
		}[pid];
		for (const [type, list] of Object.entries(starters)) for (const [x, y, g = 1] of list) this.spawn(pid, type, g, { x, y });
	}

	minY(pid, type, ci = 0) {
		return MIN_Y[type] + (pid === 'littoral' && CELLS[ci][1] === 0 ? 240 : 0);
	}

	/** Trouve une place libre dans une parcelle ; si elle est pleine, on serre un peu les plantes. */
	place_(pid, type, ci = 0, around = null) {
		const place = this.state.places[pid];
		const sp = PLANT_TYPES[type].spacing;
		const here = place.plants.filter(p => cellOf(p) === ci);
		const obstacles = [
			...here.map(p => ({ x: p.x, y: p.y, rad: PLANT_TYPES[p.type].spacing })),
			...(ci === 0 ? Object.values(DECOR).filter(d => d.place === pid && d.rad).map(d => ({ x: d.x, y: d.y, rad: d.rad })) : []),
			...(place.items ?? []).map(it => ({ x: it.x - cellOrigin(ci)[0], y: it.y - cellOrigin(ci)[1] - itemBox(it.kind, it.level).ay * 0.3, rad: itemBox(it.kind, it.level).w * 0.5 })),
		];
		const same = here.filter(p => p.type === type);
		const y0 = this.minY(pid, type, ci), H = PARCEL_H;
		let best = { x: PARCEL_W / 2, y: H / 2 }, bestScore = -Infinity;
		for (let i = 0; i < 90; i++) {
			let x, y, near = false;
			// L'herbe s'étend en pelouse depuis ses touffes ; les fleurs se sèment en massifs, près des leurs.
			if (around && i < 60) {
				// Semée par une bête : tombe à quelques pas de la plante d'où vient la graine.
				const a = Math.random() * Math.PI * 2, d = sp * 1.2 + Math.random() * sp * 2.5;
				x = around.x + Math.cos(a) * d;
				y = around.y + Math.sin(a) * d;
				near = true;
			} else if (same.length && (type === 'herbe' || type === 'fleur') && Math.random() < (type === 'herbe' ? 0.88 : 0.7)) {
				const o = pick(same);
				const a = Math.random() * Math.PI * 2, d = type === 'herbe' ? sp * 1.6 + Math.random() * sp * 1.6 : sp * 1.4 + Math.random() * sp * 2;
				x = o.x + Math.cos(a) * d;
				y = o.y + Math.sin(a) * d;
				near = true;
			} else {
				x = 40 + Math.random() * (PARCEL_W - 80);
				y = y0 + Math.random() * (H - y0 - 40);
			}
			if (x < 30 || x > PARCEL_W - 30 || y < y0 || y > H - 30) continue;
			const wx = cellOrigin(ci)[0] + x, wy = cellOrigin(ci)[1] + y;
			if (pid === this.biome && !this.inBlob(this.blob(ci), wx, wy, type === 'arbre' ? 50 : 26)) continue;
			if (keepOut(pid, wx, wy, type === 'arbre' ? 30 : 8)) continue;
			let gap = Infinity;
			for (const o of obstacles) gap = Math.min(gap, Math.hypot(o.x - x, (o.y - y) * 1.25) - o.rad - sp);
			// Les petites plantes se regroupent en touffes ; les arbres cherchent de l'espace.
			const score = (gap >= 0 ? 1000 : gap) + (near ? 30 : 0) + (type === 'arbre' || type === 'buisson' ? Math.min(gap, 40) : 0) + Math.random() * 20;
			if (score > bestScore) { bestScore = score; best = { x, y }; }
		}
		return best;
	}

	spawn(pid, type, growth = 0, pos = this.place_(pid, type), ci = 0) {
		const p = {
			id: uid(), type, x: Math.round(pos.x), y: Math.round(pos.y), growth, ...(ci ? { c: ci } : {}),
			seed: Math.floor(Math.random() * 2147483647), variant: newVariant(type, pid, this.state.species, zoneOf(pid, ci)?.favor), born: Date.now(),
		};
		this.state.places[pid].plants.push(p);
		return p;
	}

	/** Ajoute de l'effort à la plante en cours de ce type dans un lieu ; plante une graine si besoin,
	 *  dans la parcelle regardée (ou, pour un autre lieu, dans une de ses parcelles au hasard). */
	addEffort(type, amount, pid = this.biome, follow = true) {
		this.ensurePlace(pid);
		const place = this.state.places[pid];
		const events = [];
		const cost = PLANT_TYPES[type].cost;
		// Une jeune pousse semée par les bêtes, plus grande que ce qu'on fait pousser, profite d'un tiers de l'effort :
		// même à petits pas, la prairie finit par se couvrir d'arbustes puis d'arbres.
		const sown = place.plants.find(q => q.sown && q.growth < 1 && RANK[q.type] > RANK[type]);
		if (sown) {
			const share = amount / 3, c2 = PLANT_TYPES[sown.type].cost;
			sown.growth = Math.min(1, sown.growth + share / c2);
			amount -= share;
			if (sown.growth >= 1) { events.push({ kind: 'mature', plant: sown, pid }); this.succeed(pid, sown, events); }
		}
		let p = place.plants.find(q => q.type === type && q.growth < 1);
		while (amount > 1e-6) {
			if (!p) {
				const ci = this.cellFor(pid, type);
				p = this.spawn(pid, type, 0, this.place_(pid, type, ci), ci);
				events.push({ kind: 'seed', plant: p, pid });
			}
			const used = Math.min((1 - p.growth) * cost, amount);
			p.growth = Math.min(1, p.growth + used / cost);
			amount -= used;
			if (follow) this.current = p;
			if (p.growth >= 1) { events.push({ kind: 'mature', plant: p, pid }); this.succeed(pid, p, events); p = null; }
		}
		return events;
	}

	/**
	 * Succession naturelle : toutes les quelques plantes arrivées à maturité, une bête (ou le vent) sème l'étage au-dessus,
	 * tout près : graines d'herbes portées par le vent et les abeilles, baies semées par les oiseaux, glands cachés par le geai et l'écureuil.
	 */
	succeed(pid, parent, events) {
		const next = SUCCESSION[parent.type];
		if (!next) return;
		const place = this.state.places[pid];
		place.succ ??= {};
		place.succ[parent.type] = (place.succ[parent.type] ?? 0) + 1;
		if (place.succ[parent.type] % next.every) return;
		// Pas plus de deux jeunes pousses semées qui attendent de grandir, par étage.
		if (place.plants.filter(q => q.sown && q.type === next.type && q.growth < 1).length >= 2) return;
		const ci = cellOf(parent);
		const pos = this.place_(pid, next.type, ci, parent);
		const by = pick(next.by[pid] ?? next.by.default);
		const p = this.spawn(pid, next.type, next.start, pos, ci);
		p.sown = by;
		events.push({ kind: 'sown', plant: p, pid, by });
		if (pid === this.biome) {
			const [ox, oy] = cellOrigin(ci);
			this.burst(ox + p.x, oy + p.y - 6, 8);
		}
	}

	/**
	 * Parcelle où planter la prochaine graine d'un type : celle qui en manque le plus, pour que toutes se remplissent
	 * en gardant leurs proportions ; un coin accueille plus volontiers son type favori, la parcelle regardée passe un peu devant.
	 */
	cellFor(pid, type) {
		const place = this.state.places[pid];
		const n = cellsOpen(place);
		const want = { herbe: 14, fleur: 10, buisson: 4, arbre: 2.5 }[type];
		let best = 0, bestScore = Infinity;
		for (let ci = 0; ci < n; ci++) {
			const have = place.plants.filter(q => cellOf(q) === ci && q.type === type).length;
			const zone = zoneOf(pid, ci);
			const likes = zone && zone.start.some(([t]) => t === type) ? 1.6 : 1;
			const score = have / (want * likes) - (pid === this.biome && ci === this.active ? 0.15 : 0) + Math.random() * 0.05;
			if (score < bestScore) { bestScore = score; best = ci; }
		}
		return best;
	}

	/** Fait pousser un lieu, affiché ou non, sans déplacer la plante suivie à l'écran. */
	growIn(pid, type, amount) {
		return this.addEffort(type, amount, pid, false);
	}

	/** Sprite d'une plante au niveau de détail demandé (normal ou détaillé), repeint quand elle change de stade. */
	spriteFor(p, detail) {
		const stage = p.growth >= 1 ? STAGES : Math.floor(p.growth * STAGES);
		const key = detail ? `${p.id}:d` : p.id;
		let s = this.sprites.get(key);
		// Au-delà du temps de peinture de l'image, on garde l'ancien stade, ou on attend l'image suivante.
		// Les images détaillées pèsent lourd : au plus une vingtaine à la fois, les autres plantes gardent leur image normale.
		if (detail && !s && (this.detailCount ?? 0) >= (p.type === 'arbre' ? 10 : 24)) return null;
		if ((!s || s.stage !== stage) && performance.now() > (this.paintUntil ?? Infinity)) {
			if (s) s.used = this.t;
			return s ?? null;
		}
		if (!s || s.stage !== stage) {
			const box = PLANT_TYPES[p.type].box;
			const D = this.density * (detail ? DETAIL_DENSITY : 1);
			const c = s?.canvas ?? document.createElement('canvas');
			c.width = Math.ceil(box.w * D);
			c.height = Math.ceil(box.h * D);
			const g = c.getContext('2d');
			g.setTransform(D, 0, 0, D, box.ax * D, box.ay * D);
			const meta = paintPlant(g, p, stage / STAGES, { detail, season: this.season });
			const old = this.meta.get(p.id);
			const grew = !detail && old && old.stage < stage;
			if (detail && !this.sprites.has(key)) this.detailCount = (this.detailCount ?? 0) + 1;
			s = { stage, canvas: c, pop: grew ? this.t : (s?.pop ?? -9) };
			this.sprites.set(key, s);
			if (!detail) this.meta.set(p.id, { stage, top: meta.top, r: meta.r ?? 8, pop: s.pop });
			if (grew) {
				const [ox, oy] = cellOrigin(cellOf(p));
				this.burst(ox + p.x, oy + p.y + meta.top, stage === STAGES ? 18 : 5);
			}
		}
		s.used = this.t;
		return s;
	}

	/** La terre d'une parcelle de potager (une image par parcelle, peinte une fois). */
	soilSprite(seed) {
		const key = `soil:${seed}`;
		let c = this.sprites.get(key)?.canvas;
		if (!c) {
			const D = this.density, m = 12;
			c = document.createElement('canvas');
			c.width = Math.ceil((PLOT.w + m * 2) * D);
			c.height = Math.ceil((PLOT.h + m * 2) * D);
			const g = c.getContext('2d');
			g.setTransform(D, 0, 0, D, (PLOT.w / 2 + m) * D, (PLOT.h / 2 + m) * D);
			paintSoil(g, seed);
			this.sprites.set(key, { canvas: c, stage: 0, used: this.t });
		}
		this.sprites.get(key).used = this.t;
		return c;
	}

	/** Morceau de pelouse (5 variantes par palette et par saison), posé au sol sous les touffes d'herbe. */
	turfSprite(n, palette) {
		const key = `turf:${n}:${palette?.join() ?? ''}:${this.seasonKey}`;
		let c = this.sprites.get(key)?.canvas;
		if (!c) {
			const D = this.density;
			c = document.createElement('canvas');
			c.width = Math.ceil(128 * D);
			c.height = Math.ceil(64 * D);
			const g = c.getContext('2d');
			g.setTransform(D, 0, 0, D, 64 * D, 32 * D);
			paintTurf(g, 9001 + n * 7919, palette, this.season);
			this.sprites.set(key, { canvas: c, stage: 0, used: this.t });
		}
		this.sprites.get(key).used = this.t;
		return c;
	}

	// ─── Objets posés par la personne (cabane, banc, nichoir…) ─────

	get items() { return (this.place.items ??= []); }

	/** Image d'un objet, pour une rotation donnée (en degrés, par pas de 45° ; seuls certains objets tournent). */
	itemSprite(kind, rot = 0, it = null) {
		rot = ITEMS[kind].turn ? ((rot % 360) + 360) % 360 : 0;
		// Au jardin, une parcelle de potager se peint sans sa terre (posée au sol), et ses légumes suivent leur pousse.
		const bed = kind === 'potager' && it ? { stage: Math.floor(this.bedStage(it) * 6) / 6, seed: plotSeed(it) } : null;
		// Le collecteur montre son niveau de nectar (par dixièmes) et son niveau d'amélioration.
		const jar = kind === 'collecteur' && it ? { fill: Math.round(Math.min(1, this.nectarFill?.() ?? 0) * 10) / 10, level: it.level ?? 1 } : null;
		// Un habitat amélioré se garnit d'herbes et de fleurs sauvages.
		const lv = canLevel(kind) || ITEMS[kind].levels ? it?.level ?? 1 : 1, style = it?.style ?? 0;
		const key = bed ? `${kind}:${bed.seed}:${bed.stage}` : jar ? `${kind}:${jar.level}:${jar.fill}` : `${kind}:${rot}:${lv}:${style}`;
		let s = this.itemSprites.get(key);
		if (!s) {
			const box = itemBox(kind, lv), D = this.density * 1.4;
			const c = document.createElement('canvas');
			c.width = Math.ceil(box.w * D);
			c.height = Math.ceil(box.h * D);
			const g = c.getContext('2d');
			g.setTransform(D, 0, 0, D, box.ax * D, box.ay * D);
			if (canLevel(kind)) paintAdorn(g, kind, lv, false);
			const meta = bed ? ITEM_PAINTERS[kind](g, 0, bed.stage, false, bed.seed) : jar ? ITEM_PAINTERS[kind](g, 0, jar.fill, jar.level) : ITEM_PAINTERS[kind](g, (rot * Math.PI) / 180, lv, style);
			if (canLevel(kind)) paintAdorn(g, kind, lv, true);
			s = { canvas: c, ...meta };
			this.itemSprites.set(key, s);
		}
		return s;
	}

	/** Peut-on poser cet objet ici : dans une clairière ouverte, pas dans l'eau ni sur un sentier, pas sur un autre objet. */
	canPlace(kind, x, y, except = null) {
		const r = itemBox(kind, except?.level).w * 0.35;
		if (!this.inOpen(x, y, r * 0.6) || keepOut(this.biome, x, y, r * 0.5)) return false;
		// Pas sur un arbre ou un arbuste : herbes et fleurs, elles, s'écartent sans dommage.
		for (const p of this.place.plants) {
			if (p.type !== 'arbre' && p.type !== 'buisson') continue;
			const [ox, oy] = cellOrigin(cellOf(p));
			if (Math.hypot(ox + p.x - x, (oy + p.y - y) * 1.3) < r + PLANT_TYPES[p.type].spacing * 0.6) return false;
		}
		return !this.items.some(it => {
			if (it === except) return false;
			// Deux parcelles de potager se touchent (c'est ainsi qu'on agrandit le potager), sans se superposer.
			if (kind === 'potager' && it.kind === 'potager') return Math.abs(it.x - x) < PLOT.w * 0.9 && Math.abs(it.y - y) < PLOT.h * 0.9;
			// Deux tronçons de haie (de muret, d'allée) se touchent bout à bout, sans se chevaucher.
			if (LINK[kind] && it.kind === kind) return Math.hypot(it.x - x, (it.y - y) / 0.36) < LINK[kind] * 0.85;
			return Math.hypot(it.x - x, (it.y - y) * 1.3) < r + itemBox(it.kind, it.level).w * 0.35;
		});
	}

	/** Une parcelle de potager s'aligne sur la grille des parcelles déjà posées, pour s'y souder. */
	snapPlot(kind, x, y, except) {
		// Un tronçon de haie, de muret ou d'allée vient se coller au bout le plus proche d'un tronçon déjà posé.
		if (LINK[kind]) {
			const a = ((this.ghost?.rot ?? 0) * Math.PI) / 180, h = LINK[kind] / 2;
			const ox = Math.cos(a) * h, oy = Math.sin(a) * h * 0.36;
			let best = null, bd = 70;
			for (const it of this.items) {
				if (it.kind !== kind || it === except) continue;
				for (const [ex, ey] of linkEnds(it)) for (const s of [1, -1]) {
					const cx = ex + s * ox, cy = ey + s * oy, dd = Math.hypot(cx - x, cy - y);
					if (dd < bd) { bd = dd; best = [cx, cy]; }
				}
			}
			return best ?? [x, y];
		}
		const first = kind === 'potager' && this.items.find(it => it.kind === 'potager' && it !== except);
		if (!first) return [x, y];
		return [first.x + Math.round((x - first.x) / PLOT.w) * PLOT.w, first.y + Math.round((y - first.y) / PLOT.h) * PLOT.h];
	}

	/** Pousse des légumes d'une parcelle (0 → 1) : ils mûrissent en 2,5 km parcourus. */
	bedStage(it) {
		return Math.max(0, Math.min(1, (this.state.totals.distance / 1000 - (it.km0 ?? 0)) / 2.5));
	}

	placeItem(kind, x, y, rot = 0) {
		const it = { id: uid(), kind, x: Math.round(x), y: Math.round(y), rot, at: Date.now(), ...(kind === 'potager' ? { km0: this.state.totals.distance / 1000 } : {}) };
		this.items.push(it);
		this.clearUnder(it);
		this.popItem(it, true);
		return it;
	}

	/** Emprise au sol d'un objet : le rectangle derrière et sous lui où rien ne doit pousser. */
	footprint(it) {
		const box = itemBox(it.kind, it.level);
		return { x0: it.x - box.w * 0.5, x1: it.x + box.w * 0.5, y0: it.y - box.ay * 0.75, y1: it.y + 16 };
	}

	/** Les herbes et fleurs qui se trouvaient sous un objet repoussent un peu plus loin. */
	clearUnder(it) {
		const f = this.footprint(it);
		for (const p of this.place.plants) {
			if (p.type === 'arbre' || p.type === 'buisson') continue;
			const ci = cellOf(p), [ox, oy] = cellOrigin(ci), x = ox + p.x, y = oy + p.y;
			if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1) continue;
			const pos = this.place_(this.biome, p.type, ci);
			p.x = Math.round(pos.x); p.y = Math.round(pos.y);
			this.meta.delete(p.id);
		}
	}

	/**
	 * Un objet apparaît. `build` : on le construit sous nos yeux (posé ou amélioré) ; un nuage de poussière,
	 * l'objet qui monte du sol au rythme de coups de marteau, un petit rebond, puis des étincelles et des feuilles.
	 * Sinon (déplacé, tourné), un simple rebond.
	 */
	popItem(it, build = false) {
		this.popAt[`item:${it.id}`] = this.t;
		this.nextPopulate = 0;
		if (!build) { this.burst(it.x, it.y - 20, 22, '#F4C23E'); return; }
		this.buildAt[it.id] = this.t;
		const box = itemBox(it.kind, it.level);
		this.builds.push({ it, t0: this.t, w: Math.min(box.w, 260), h: box.h, taps: 0, done: false });
		this.dust(it.x, it.y, Math.min(box.w, 260) * 0.45, 14);
	}

	/** Poussière soulevée au sol, en petits nuages qui gonflent et s'effacent. */
	dust(x, y, rad, n) {
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2, d = rad * (0.5 + Math.random() * 0.6);
			this.particles.push({
				puff: true, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.3,
				vx: Math.cos(a) * (12 + Math.random() * 18), vy: -4 - Math.random() * 8,
				life: 1, decay: 0.9 + Math.random() * 0.5, size: 4 + Math.random() * 5,
				color: pick(['#D8C8A4', '#E4D6B6', '#C8B48C']),
			});
		}
	}

	/** Le chantier avance : trois coups de marteau (un peu de poussière à chaque fois), puis la fête à la fin. */
	updateBuilds() {
		for (const b of this.builds) {
			const age = this.t - b.t0;
			while (b.taps < BUILD_TAPS.length && age >= BUILD_TAPS[b.taps]) {
				const side = (Math.random() - 0.5) * b.w * 0.7;
				this.dust(b.it.x + side, b.it.y, 10, 5);
				this.onBuildTap?.(b.taps);
				b.taps++;
			}
			if (!b.done && age >= BUILD_TIME) {
				b.done = true;
				const cx = b.it.x, cy = b.it.y - Math.min(b.h, 200) * 0.5;
				this.burst(cx, cy, 26, '#F4C23E');
				for (let i = 0; i < 14; i++) {
					this.particles.push({
						x: cx + (Math.random() - 0.5) * b.w * 0.5, y: cy + (Math.random() - 0.5) * 30,
						vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50,
						life: 1, decay: 0.45 + Math.random() * 0.3, size: 2 + Math.random() * 1.6,
						color: pick(['#7FAA48', '#A3BD57', '#F08A3C', '#FDF7E7']),
					});
				}
				this.onBuildDone?.(b.it);
			}
		}
		this.builds = this.builds.filter(b => this.t - b.t0 < BUILD_TIME + 0.6);
	}

	/**
	 * Un objet en construction : sa silhouette en transparence, et la partie déjà montée, du sol vers le haut,
	 * avec un liseré doré là où l'on travaille ; à la fin, un petit rebond.
	 */
	drawBuilding(ctx, sp, box, age) {
		const rise = smoothstep(Math.min(1, Math.max(0, (age - 0.12) / (BUILD_TIME - 0.3))));
		const after = age - (BUILD_TIME - 0.18), bounce = after > 0 ? Math.sin(Math.min(1, after / 0.45) * Math.PI) * 0.07 : 0;
		ctx.globalAlpha = 0.2 * (1 - rise);
		ctx.drawImage(sp.canvas, -box.ax, -box.ay, box.w, box.h);
		ctx.globalAlpha = 1;
		const cut = -box.ay + box.h * (1 - rise);
		ctx.save();
		ctx.beginPath();
		ctx.rect(-box.ax - 20, cut, box.w + 40, box.h * rise + 40);
		ctx.clip();
		ctx.scale(1 - bounce * 0.5, 1 + bounce);
		ctx.drawImage(sp.canvas, -box.ax, -box.ay, box.w, box.h);
		ctx.restore();
		if (rise > 0.02 && rise < 0.98) {
			ctx.globalAlpha = 0.55 * Math.sin(rise * Math.PI);
			ctx.strokeStyle = '#F4C23E';
			ctx.lineWidth = 2.5;
			ctx.beginPath(); ctx.moveTo(-box.ax * 0.8, cut); ctx.lineTo(box.w - box.ax * 1.2, cut); ctx.stroke();
			ctx.globalAlpha = 1;
		}
	}

	decorSprite(key) {
		let s = this.decorSprites.get(key);
		if (!s) {
			const box = DECOR[key].box;
			const D = this.density;
			const c = document.createElement('canvas');
			c.width = Math.ceil(box.w * D);
			c.height = Math.ceil(box.h * D);
			const g = c.getContext('2d');
			g.setTransform(D, 0, 0, D, box.ax * D, box.ay * D);
			const meta = DECOR_PAINTERS[key](g);
			s = { canvas: c, top: meta.top };
			this.decorSprites.set(key, s);
		}
		return s;
	}

	decorVisible(key) {
		const d = DECOR[key], place = this.state.places[d.place];
		return d.place === this.biome && !!place && (d.always || !!place.unlocked[key]);
	}

	/** Montre un décor qui vient d'apparaître. */
	reveal(key) {
		const d = DECOR[key];
		if (d.place !== this.biome) return;
		this.popAt[key] = this.t;
		this.burst(d.x, d.y - 20, 24, '#F4C23E');
		this.focusOn(d.x, d.y);
	}

	/**
	 * Une goutte de nectar part d'une fleur butinée vers le collecteur le plus proche (seulement quand on regarde de près).
	 * Elle ne va jamais à la bourse : la récolte attend qu'on la ramasse. Sans collecteur, elle perle sur les fleurs.
	 */
	nectarFrom(x, y) {
		if (this.cam.z < 1 || this.t - (this.lastDrop ?? -9) < 0.7) return;
		const jars = this.items.filter(it => it.kind === 'collecteur');
		if (!jars.length) return;
		const jar = jars.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a));
		const v = this.view();
		if (x < v.x0 || x > v.x0 + v.w || y < v.y0 || y > v.y0 + v.h) return;
		this.lastDrop = this.t;
		this.nectarDrops.push({ x, y, t: 0, dur: 1.1 + Math.random() * 0.4, wob: Math.random() * 6.28, to: [jar.x, jar.y - 50] });
	}

	// ─── Gouttes de nectar à cueillir à la main ────────────────────
	// Sans collecteur, la récolte des butineurs perle sur les fleurs : une goutte pour quelques nectar.

	updateDew() {
		const amount = this.glyph ? 0 : (this.dewAmount?.() ?? 0);
		const want = amount >= 1 ? Math.min(10, Math.ceil(amount / 3)) : 0;
		this.dew ??= [];
		while (this.dew.length > want) this.dew.pop();
		if (this.dew.length >= want) return;
		// Une goutte par fleur, et jamais l'une sur l'autre : chacune se voit, avec ce qu'elle rapporte.
		const gap = 42 * Math.max(1, 1.3 / this.cam.z);
		const free = (x, y) => this.dew.every(d => Math.hypot(d.x - x, (d.y - y) * 1.8) > gap);
		const heads = [];
		for (const P of Object.values(this.pdata)) for (const p of P.flowers) heads.push(this.headOf(p));
		while (this.dew.length < want) {
			const room = heads.filter(([x, y]) => free(x, y + 4));
			if (!room.length) break;
			const [x, y] = pick(room);
			this.dew.push({ x, y: y + 4, ph: Math.random() * 6.28, born: this.t });
		}
	}

	/** Cueillir une goutte : elle file vers le compteur, avec sa part de la récolte. */
	takeDew(d) {
		const i = this.dew.indexOf(d);
		if (i < 0) return 0;
		const share = (this.dewAmount?.() ?? 0) / this.dew.length;
		this.dew.splice(i, 1);
		for (let k = 0; k < 3; k++) this.nectarDrops.push({ x: d.x + (Math.random() - 0.5) * 8, y: d.y, t: -k * 0.08, dur: 1 + Math.random() * 0.3, wob: Math.random() * 6.28 });
		this.burst(d.x, d.y, 6, '#F4C23E');
		return share;
	}

	drawDew(ctx) {
		// Assez grosses pour se voir et se toucher, quel que soit le zoom ; sous chacune, ce qu'elle rapporte.
		const z = Math.max(1, 1.3 / this.cam.z);
		const share = Math.round((this.dewAmount?.() ?? 0) / Math.max(1, this.dew.length));
		for (const d of this.dew) {
			const a = Math.min(1, (this.t - d.born) * 2), bob = Math.sin(this.t * 2.4 + d.ph) * 1.5 * z;
			const pulse = 0.75 + 0.25 * Math.sin(this.t * 3 + d.ph);
			ctx.save();
			ctx.translate(d.x, d.y + bob);
			ctx.scale(z * 1.8, z * 1.8);
			ctx.globalAlpha = a * 0.4 * pulse;
			ctx.fillStyle = '#FFE680';
			ctx.beginPath(); ctx.arc(0, -3, 8, 0, Math.PI * 2); ctx.fill();
			ctx.globalAlpha = a;
			ctx.fillStyle = '#F2B62E';
			ctx.beginPath();
			ctx.moveTo(0, -9);
			ctx.quadraticCurveTo(4.8, -2, 0, 1.2);
			ctx.quadraticCurveTo(-4.8, -2, 0, -9);
			ctx.fill();
			ctx.strokeStyle = 'rgba(160,100,20,0.55)';
			ctx.lineWidth = 0.6;
			ctx.stroke();
			ctx.fillStyle = 'rgba(255,250,220,0.9)';
			ctx.beginPath(); ctx.arc(-1.3, -3.6, 1.2, 0, Math.PI * 2); ctx.fill();
			if (share >= 1) {
				ctx.font = 'bold 6.5px Nunito, sans-serif';
				ctx.textAlign = 'center';
				ctx.lineJoin = 'round';
				ctx.lineWidth = 2;
				ctx.strokeStyle = 'rgba(110,60,10,0.85)';
				ctx.strokeText(`+${share}`, 0, 8.5);
				ctx.fillStyle = '#FFF4C8';
				ctx.fillText(`+${share}`, 0, 8.5);
			}
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}

	/** Quand le fermier est chez lui, un filet de fumée sort de la cheminée et part avec le vent. */
	drawSmoke(ctx) {
		const cab = this.items.find(it => it.kind === 'cabane');
		const sp = cab && this.itemSprite('cabane', cab.rot, cab);
		if (!sp?.smoke) return;
		const [sx, sy] = sp.smoke;
		for (let i = 0; i < 7; i++) {
			const k = (this.t * 0.11 + i / 7) % 1;
			const x = cab.x + sx + Math.sin(k * 4 + i) * 4 + k * k * 26, y = cab.y + sy - 4 - k * 64;
			const r = 3.5 + k * 13, a = 0.32 * (1 - k) * Math.min(1, k * 6);
			ctx.fillStyle = `rgba(238,234,226,${a.toFixed(3)})`;
			ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = `rgba(200,196,190,${(a * 0.5).toFixed(3)})`;
			ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r * 0.7, 0, Math.PI * 2); ctx.fill();
		}
	}

	/** Au-dessus de chaque collecteur, une étiquette dorée : combien attend d'être récolté (elle bat quand c'est plein). */
	drawJarTags(ctx) {
		const amount = Math.floor(this.jarAmount?.() ?? 0), full = (this.nectarFill?.() ?? 0) >= 1;
		const z = Math.max(1, 1.2 / this.cam.z), label = full ? `${amount} · plein !` : `+${amount}`;
		ctx.font = `800 ${13}px Nunito, sans-serif`;
		const w = ctx.measureText(label).width + 30, h = 22;
		for (const it of this.items) {
			if (it.kind !== 'collecteur') continue;
			const k = z * (full ? 1 + 0.06 * Math.sin(this.t * 5) : 1);
			ctx.save();
			ctx.translate(it.x, it.y - 128 - 6 * Math.sin(this.t * 2));
			ctx.scale(k, k);
			ctx.fillStyle = full ? 'rgba(232,112,40,0.95)' : 'rgba(253,240,200,0.95)';
			ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
			ctx.strokeStyle = 'rgba(176,122,26,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
			ctx.beginPath(); ctx.moveTo(-5, h / 2 - 0.5); ctx.lineTo(0, h / 2 + 6); ctx.lineTo(5, h / 2 - 0.5); ctx.closePath();
			ctx.fillStyle = full ? 'rgba(232,112,40,0.95)' : 'rgba(253,240,200,0.95)'; ctx.fill();
			// La petite goutte, puis le nombre.
			ctx.fillStyle = full ? '#FFF4D0' : '#F2B62E';
			ctx.beginPath(); ctx.moveTo(-w / 2 + 12, -7); ctx.quadraticCurveTo(-w / 2 + 17, 0, -w / 2 + 12, 3.5); ctx.quadraticCurveTo(-w / 2 + 7, 0, -w / 2 + 12, -7); ctx.fill();
			ctx.fillStyle = full ? '#FFFFFF' : '#8A5A10';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'left';
			ctx.fillText(label, -w / 2 + 21, 0.5);
			ctx.restore();
		}
	}

	/** Vider un collecteur : le nectar en sort en gouttes qui filent au compteur. */
	/** Vider un collecteur (ou une goutte) : `n` gouttes s'en échappent l'une après l'autre pendant `span` secondes. */
	pourFrom(it, n = 8, span = 0.56, y = it.y - 40) {
		for (let k = 0; k < n; k++) this.nectarDrops.push({ x: it.x + (Math.random() - 0.5) * 16, y, t: -(k / n) * span, dur: 0.9 + Math.random() * 0.4, wob: Math.random() * 6.28 });
		this.burst(it.x, y - 10, 14, '#F4C23E');
	}

	/** Un grand « +N » doré qui jaillit au-dessus d'un point du monde, puis s'envole et s'efface. */
	floatText(x, y, text) {
		(this.floats ??= []).push({ x, y, text, t0: this.t });
	}

	drawFloats(ctx) {
		this.floats = (this.floats ?? []).filter(f => this.t - f.t0 < 1.8);
		const z = Math.max(1, 1.2 / this.cam.z);
		for (const f of this.floats) {
			const k = (this.t - f.t0) / 1.8, pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5);
			ctx.save();
			ctx.translate(f.x, f.y - k * 60);
			ctx.scale(z * pop, z * pop);
			ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
			ctx.font = '800 24px Nunito, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 5;
			ctx.strokeStyle = 'rgba(255,250,232,0.95)';
			ctx.strokeText(f.text, 0, 0);
			ctx.fillStyle = '#D88A10';
			ctx.fillText(f.text, 0, 0);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}

	burst(x, y, n, color) {
		for (let i = 0; i < n; i++) {
			this.particles.push({
				x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 6,
				vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40,
				life: 1, decay: 0.5 + Math.random() * 0.5, size: 1.2 + Math.random() * 2,
				color: pick([color || '#F4C23E', '#F4C23E', '#FDF7E7']),
			});
		}
	}

	/** Position de la tête d'une plante, en coordonnées du monde. */
	headOf(p) {
		const [ox, oy] = cellOrigin(cellOf(p));
		const m = this.meta.get(p.id);
		return [ox + p.x, oy + p.y + (m ? m.top : -20)];
	}

	/** Point d'eau d'une parcelle (mare, grande mare, mer), en coordonnées du monde. */
	water(ci) {
		const [ox, oy] = cellOrigin(ci);
		if (this.biome === 'littoral') return CELLS[ci][1] === 0 ? { x: ox + PARCEL_W / 2, y: oy + 70, rx: 200, ry: 50, scale: 3 } : null;
		if (ci !== 0) return null;
		for (const [k, d] of Object.entries(DECOR)) if (d.water && this.decorVisible(k)) return { x: d.x, y: d.y, rx: 95 * (d.scale ?? 1), ry: 48 * (d.scale ?? 1), scale: d.scale ?? 1 };
		return null;
	}

	hour() {
		if (this.hourOverride != null) return this.hourOverride;
		const d = new Date();
		return d.getHours() + d.getMinutes() / 60;
	}

	/** Lumière ambiante et part de nuit, d'après la vraie hauteur du soleil quand on la connaît. */
	light(hour = this.hour()) {
		if (this.altitude) {
			const alt = this.altitude(hour);
			return { amb: lightFromAltitude(alt), night: Math.max(0, Math.min(1, (-3 - alt) / 6)) };
		}
		return { amb: ambientAt(hour, this.sun), night: nightAt(hour, this.sun) };
	}

	night() { return this.light().night; }

	precip() {
		const k = this.weather.kind;
		return k === 'rain' ? 1 : k === 'storm' ? 1.5 : k === 'drizzle' ? 0.45 : k === 'snow' ? 1 : 0;
	}

	// ─── Entrées : glisser, pincer, molette, double toucher, toucher ──

	bindInput() {
		const c = this.canvas;
		let drag = null, pinch = null, lastTap = 0;
		const local = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
		c.addEventListener('pointerdown', e => {
			c.setPointerCapture(e.pointerId);
			this.pointers.set(e.pointerId, local(e));
			this.camTarget = null;
			this.followPausedUntil = performance.now() + 6000;
			this.vel = { x: 0, y: 0 };
			if (this.pointers.size === 2) {
				const [a, b] = [...this.pointers.values()];
				pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.cam.z, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
				pinch.world = this.toWorld(...pinch.mid);
				if (drag) clearTimeout(drag.hold);
				drag = null;
				this.ghostFinger = null;
				this.onPeek?.(true);
			} else {
				const [x, y] = local(e);
				drag = { x, y, lx: x, ly: y, lt: performance.now(), moved: false };
				if (this.ghost) this.grabGhost(drag, x, y);
				else {
					// Appui long sur un objet : on le soulève et il suit le doigt, sans passer par un menu.
					drag.hold = setTimeout(() => {
						if (!drag || drag.moved || this.pointers.size !== 1) return;
						const hit = this.pick(x, y);
						if (hit?.item && this.onLongPress?.(hit)) {
							this.grabGhost(drag, x, y);
							drag.held = true;
							navigator.vibrate?.(15);
						}
					}, 420);
				}
			}
		});
		c.addEventListener('pointermove', e => {
			if (!this.pointers.has(e.pointerId)) return;
			this.pointers.set(e.pointerId, local(e));
			if (pinch && this.pointers.size >= 2) {
				const [a, b] = [...this.pointers.values()];
				const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
				const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
				this.cam.z = Math.max(this.zMin(), Math.min(Z_MAX, pinch.z * dist / pinch.dist));
				const k = this.base * this.cam.z;
				this.cam.cx = pinch.world[0] - (mid[0] - this.canvas.clientWidth / 2) / k;
				this.cam.cy = pinch.world[1] - (mid[1] - this.canvas.clientHeight / 2) / k;
				return;
			}
			if (!drag) return;
			const [x, y] = local(e);
			if (drag.ghost) {
				if (Math.hypot(x - drag.x, y - drag.y) > 6) drag.moved = true;
				this.moveGhostTo(drag, x, y);
				return;
			}
			if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 6) {
				clearTimeout(drag.hold);
				drag.moved = true;
				this.dragging = true;
				this.onPeek?.(true);
			}
			if (!drag.moved) return;
			const k = this.base * this.cam.z, now = performance.now();
			this.cam.cx -= (x - drag.lx) / k;
			this.cam.cy -= (y - drag.ly) / k;
			const dt = Math.max(1, now - drag.lt) / 1000;
			this.vel = { x: -(x - drag.lx) / k / dt, y: -(y - drag.ly) / k / dt };
			drag.lx = x; drag.ly = y; drag.lt = now;
		});
		const end = e => {
			this.pointers.delete(e.pointerId);
			if (pinch) {
				if (this.pointers.size < 2) { pinch = null; this.onPeek?.(false); this.vel = { x: 0, y: 0 }; }
				return;
			}
			if (!drag) return;
			clearTimeout(drag.hold);
			const [x, y] = local(e);
			if (drag.ghost) {
				// Objet lâché : il se range de lui-même sur la place libre la plus proche.
				this.ghostFinger = null;
				if (drag.moved || drag.held) this.onGhostDrop?.();
				else this.onTap?.(this.pick(x, y));
				drag = null;
				return;
			}
			if (!drag.moved) {
				const now = performance.now();
				// Double toucher : zoomer d'un cran (ou revenir au zoom normal de très près).
				if (now - lastTap < 300) { this.zoomAt(this.cam.z > 2.4 ? 1 / this.cam.z : 2, x, y); lastTap = 0; }
				else { lastTap = now; this.onTap?.(this.pick(x, y)); }
				this.vel = { x: 0, y: 0 };
			} else {
				this.onPeek?.(false);
				if (performance.now() - drag.lt > 80) this.vel = { x: 0, y: 0 };
			}
			drag = null;
			this.dragging = false;
		};
		c.addEventListener('pointerup', end);
		c.addEventListener('pointercancel', end);
		c.addEventListener('wheel', e => {
			e.preventDefault();
			const [x, y] = local(e);
			this.zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
			this.followPausedUntil = performance.now() + 6000;
		}, { passive: false });
	}

	/** Le doigt prend l'objet à poser : s'il touche l'objet, il le tient par là ; sinon l'objet saute sous le doigt. */
	grabGhost(drag, x, y) {
		const [wx, wy] = this.toWorld(x, y), g = this.ghost, box = itemBox(g.kind, g.level);
		const on = wx > g.x - box.w * 0.6 && wx < g.x + box.w * 0.6 && wy > g.y - box.ay - 10 && wy < g.y + 30;
		drag.ghost = true;
		drag.off = on ? [g.x - wx, g.y - wy] : [0, 0];
		this.vel = { x: 0, y: 0 };
		this.moveGhostTo(drag, x, y);
	}

	moveGhostTo(drag, x, y) {
		const [wx, wy] = this.toWorld(x, y);
		this.ghost.x = wx + drag.off[0];
		this.ghost.y = wy + drag.off[1];
		this.ghostFinger = [x, y];
		this.ghostDrag = drag;
		this.onGhostMove?.();
	}

	/** La place libre la plus proche pour cet objet (en tournant autour du point voulu), ou null. */
	nearestPlace(kind, x, y, except = null) {
		[x, y] = this.snapPlot(kind, x, y, except);
		if (this.canPlace(kind, x, y, except)) return [x, y];
		for (let r = 12; r <= 600; r += 12) {
			const n = Math.max(8, Math.round(r / 6));
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2, [px, py] = this.snapPlot(kind, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, except);
				if (this.canPlace(kind, px, py, except)) return [px, py];
			}
		}
		return null;
	}

	/** Ce qui se trouve sous le doigt : un animal, une plante, ou une parcelle (fermée, ou en vue d'ensemble). */
	pick(sx, sy) {
		const [wx, wy] = this.toWorld(sx, sy);
		const ci = this.cellAt(wx, wy);
		const open = ci >= 0 && ci < cellsOpen(this.place);
		if (ci >= 0 && this.glyph) return { cell: ci, open, x: sx, y: sy };
		if (this.glyph) return null;
		// Une goutte de nectar à cueillir, avant tout le reste (elle est petite et posée sur une fleur).
		let dew = null, dd = 22 / Math.min(1.4, this.cam.z);
		for (const d of this.dew ?? []) { const k = Math.hypot(d.x - wx, d.y - wy); if (k < dd) { dd = k; dew = d; } }
		if (dew) return { dew, x: sx, y: sy };
		// L'étiquette au-dessus d'un collecteur se touche comme le collecteur.
		if ((this.jarAmount?.() ?? 0) >= 1) {
			const z = Math.max(1, 1.2 / this.cam.z);
			const jar = this.items.find(it => it.kind === 'collecteur' && Math.abs(wx - it.x) < 40 * z && Math.abs(wy - (it.y - 128)) < 18 * z);
			if (jar) return { item: jar, x: sx, y: sy };
		}
		// Les objets d'abord : posés au bord de la clairière, ils peuvent déborder sur une parcelle encore fermée.
		for (const it of [...this.items].sort((a, b) => b.y - a.y)) {
			const box = itemBox(it.kind, it.level), top = this.itemSprite(it.kind, it.rot, it).top;
			if (Math.abs(wx - it.x) < Math.max(18, box.w * 0.4) && wy > it.y + top && wy < it.y + 10) return { item: it, x: sx, y: sy };
		}
		if (ci >= 0 && !open) return { cell: ci, open, x: sx, y: sy };
		const critter = this.critterAt(wx, wy);
		if (critter) return { critter, x: sx, y: sy };
		if (!open) return null;
		const [ox, oy] = cellOrigin(ci);
		const lx = wx - ox, ly = wy - oy;
		for (const p of this.place.plants.filter(q => cellOf(q) === ci).sort((a, b) => b.y - a.y)) {
			const box = PLANT_TYPES[p.type].box;
			const m = this.meta.get(p.id);
			const top = m ? m.top : -20;
			const half = Math.max(14, (box.w / 2) * (p.type === 'arbre' || p.type === 'buisson' ? 0.6 : 0.4));
			if (lx > p.x - half && lx < p.x + half && ly > p.y + top - 6 && ly < p.y + 10) return { plant: p, x: sx, y: sy };
		}
		return null;
	}

	// ─── Boucle ────────────────────────────────────────────────────

	frame = now => {
		const raw = (now - this.last) / 1000, dt = Math.min(0.05, raw);
		this.last = now;
		// Images par seconde (moyenne glissante), affichées en mode test.
		if (raw > 0 && raw < 1) this.fps = this.fps ? this.fps * 0.95 + (1 / raw) * 0.05 : 1 / raw;
		this.t += dt;
		if (this.base) {
			this.update(dt, now);
			this.render();
		}
		requestAnimationFrame(this.frame);
	};

	update(dt, now) {
		// Un objet tenu près du bord fait glisser la vue doucement, pour l'emmener plus loin.
		if (this.ghost && this.ghostFinger) {
			const [fx, fy] = this.ghostFinger, w = this.canvas.clientWidth, h = this.canvas.clientHeight, m = 56;
			const ex = fx < m ? -(m - fx) / m : fx > w - m ? (fx - (w - m)) / m : 0;
			const ey = fy < m + 60 ? -(m + 60 - fy) / m : fy > h - m - 140 ? (fy - (h - m - 140)) / m : 0;
			if (ex || ey) {
				const k = (420 * dt) / (this.base * this.cam.z);
				this.cam.cx += Math.max(-1, Math.min(1, ex)) * k;
				this.cam.cy += Math.max(-1, Math.min(1, ey)) * k;
				this.clampCam();
				this.moveGhostTo(this.ghostDrag, fx, fy);
			}
		}
		if (this.camLock?.() && this.camTarget) this.camTarget = null;
		if (this.following && !this.camLock?.() && this.current && now > (this.followPausedUntil ?? 0) && !this.dragging && this.pointers.size === 0) {
			const [hx, hy] = this.headOf(this.current);
			this.camTarget = { cx: hx, cy: hy + 40, z: Math.max(1, this.cam.z) };
		}
		if (!this.dragging && this.pointers.size === 0) {
			if (this.camTarget) {
				const k = Math.min(1, dt * 3);
				this.cam.cx += (this.camTarget.cx - this.cam.cx) * k;
				this.cam.cy += (this.camTarget.cy - this.cam.cy) * k;
				this.cam.z += (this.camTarget.z - this.cam.z) * k;
				if (Math.abs(this.camTarget.cx - this.cam.cx) + Math.abs(this.camTarget.cy - this.cam.cy) < 0.5 && Math.abs(this.camTarget.z - this.cam.z) < 0.005 && !this.following) this.camTarget = null;
			} else {
				this.cam.cx += this.vel.x * dt;
				this.cam.cy += this.vel.y * dt;
				const f = Math.pow(0.03, dt);
				this.vel.x *= f; this.vel.y *= f;
			}
			this.clampCam();
		}

		// La parcelle regardée est celle où germent les nouvelles graines.
		const ci = this.cellAt(this.cam.cx, this.cam.cy);
		if (ci >= 0 && ci < cellsOpen(this.place)) this.active = ci;

		if (this.t > this.nextPopulate) { this.populate(); this.updateDew(); this.nextPopulate = this.t + 1; }
		for (const i of this.insects) this.updateInsect(i, dt);
		this.insects = this.insects.filter(i => !i.gone);
		this.updateFarmer(dt);
		this.updatePet(dt);
		this.updateBuilds();
		for (const p of this.particles) {
			p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
			// La poussière gonfle et ralentit ; le reste retombe.
			if (p.puff) { p.size += 16 * dt; p.vx *= 0.94; p.vy *= 0.94; } else { p.vy += 10 * dt; p.vx *= 0.98; }
		}
		this.particles = this.particles.filter(p => p.life > 0);
		for (const d of this.nectarDrops) d.t += dt;
		const arrived = this.nectarDrops.filter(d => d.t >= d.dur && !d.to).length;
		if (arrived) { this.nectarDrops = this.nectarDrops.filter(d => d.t < d.dur); this.onNectar?.(arrived); }
		for (const f of this.fireflies) {
			f.a += (Math.random() - 0.5) * dt * 3;
			f.x += Math.cos(f.a) * 0.03 * dt;
			f.y += Math.sin(f.a) * 0.02 * dt;
			if (f.x < 0 || f.x > 1) f.a = Math.PI - f.a;
			if (f.y < 0 || f.y > 1) f.y = Math.random();
		}
		this.updateWeather(dt);
		// Les images de plantes hors de vue libèrent leur mémoire : vite pour les détaillées (lourdes), un peu plus tard pour les autres.
		if (this.sprites.size > 120 && this.t > (this.nextTrim ?? 0)) {
			this.nextTrim = this.t + 1;
			for (const [k, s] of this.sprites) if (this.t - (s.used ?? 0) > (k.endsWith(':d') ? 3 : 12)) this.sprites.delete(k);
		}
		if (this.t > (this.nextCount ?? 0)) {
			this.nextCount = this.t + 1;
			let n = 0;
			for (const k of this.sprites.keys()) if (k.endsWith(':d')) n++;
			this.detailCount = n;
		}
	}

	/** Parcelles (ouvertes, par défaut) au moins en partie à l'écran. */
	visibleCells(margin = 80, list = this.openCells()) {
		const v = this.view();
		return list.filter(i => {
			const [ox, oy] = cellOrigin(i);
			return ox < v.x0 + v.w + margin && ox + PARCEL_W > v.x0 - margin && oy < v.y0 + v.h + margin && oy + PARCEL_H > v.y0 - margin;
		});
	}

	/** Animaux présents : ceux des parcelles visibles déjà découverts, chacun à son heure et selon la météo. */
	populate() {
		const n = this.night();
		if (n > 0.5) this.state.seenNight = true;
		const night = n > 0.5, dusk = n > 0.2;
		const wet = this.precip() > 0;
		if (wet && this.weather.kind !== 'snow') this.state.seenRain = true;
		const visible = this.glyph ? [] : this.visibleCells(200);
		for (const b of this.insects) if (!visible.includes(b.ci)) b.gone = true;
		this.pdata = {};
		const ok = when => when === 'always' || (when === 'day' && !night) || (when === 'night' && night) || (when === 'dusk' && dusk) || (when === 'wet' && (wet || night));
		const place = this.place;
		for (const ci of visible) {
			const [ox, oy] = cellOrigin(ci);
			const mature = place.plants.filter(p => p.growth >= 1 && cellOf(p) === ci);
			const P = this.pdata[ci] = {
				ci, ox, oy,
				flowers: mature.filter(p => p.type === 'fleur'),
				bushes: mature.filter(p => p.type === 'buisson'),
				trees: mature.filter(p => p.type === 'arbre'),
				herbs: mature.filter(p => p.type === 'herbe'),
			};
			P.perches = [...P.bushes, ...P.trees];
		}
		if (!visible.length) return;
		// Un effectif par espèce pour tout le lieu ; chaque animal s'installe dans une parcelle visible qui lui convient.
		const scale = Math.min(2, 1 + (visible.length - 1) * 0.35);
		for (const sp of SPECIES) {
			if (sp.kind !== 'animal' || sp.place !== this.biome || !sp.critter.behavior) continue;
			const c = sp.critter;
			let want = this.state.species[sp.id] && ok(c.when) ? Math.round((c.count(this.state) + (this.idleBonus?.(sp) ?? 0)) * scale) + attracted(place, sp.id) : 0;
			// Sous la pluie ou la neige, les insectes volants se mettent à l'abri.
			if (wet && FLYERS.has(c.kind)) want = 0;
			// Les oiseaux et les mammifères restent peu nombreux : une nuée de merles ou de lièvres ferait désordre.
			const most = { bird: 4, tit: 4, hare: 4, rabbit: 4, roe: 3, chamois: 3, fox: 2, squirrel: 3, heron: 2, owl: 1, eagle: 1, gull: 4, duck: 4 }[c.kind];
			if (most) want = Math.min(want, most);
			const active = this.insects.filter(i => i.sp === sp.id && !i.leaving);
			for (let k = active.length; k < want; k++) {
				let b = null;
				for (const ci of [...visible].sort(() => Math.random() - 0.5)) if ((b = this.newCritter(sp, this.pdata[ci]))) break;
				if (b) this.insects.push(b);
			}
			for (let k = active.length; k > want; k--) active[k - 1].leaving = true;
		}
		// La petite vie sans nom ne se redistribue que si la vue ou le moment changent (ou de temps en temps).
		const key = `${visible.join(',')}|${night}|${dusk}|${wet}`;
		if (key !== this.ambientKey || this.t > (this.ambientUntil ?? 0)) {
			this.ambientKey = key;
			this.ambientUntil = this.t + 40;
			this.populateAmbient(visible, night, dusk, wet);
		}
	}

	/**
	 * Petite vie sans nom, toujours là même avant les découvertes : nuées de moucherons qui dansent au soleil
	 * au-dessus des fleurs et des arbustes, moustiques au-dessus de l'eau du soir à la nuit. Rien sous la pluie.
	 */
	populateAmbient(visible, night, dusk, wet) {
		this.ambient = [];
		if (wet || this.glyph) return;
		for (const ci of visible) {
			const P = this.pdata[ci], w = this.water(ci), spots = [];
			if (w) for (let k = 0; k < 2; k++) spots.push({ x: w.x + (Math.random() - 0.5) * w.rx, y: w.y + (Math.random() - 0.5) * w.ry * 0.5, water: true });
			for (const it of this.items) if (it.kind === 'mare' && this.cellAt(it.x, it.y) === ci) spots.push({ x: it.x, y: it.y, water: true });
			const green = [...P.bushes, ...P.flowers].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
			for (const p of green) spots.push({ x: P.ox + p.x + (Math.random() - 0.5) * 30, y: P.oy + p.y });
			if (!green.length && !spots.length) {
				const x = P.ox + PARCEL_W * (0.3 + Math.random() * 0.4), y = P.oy + PARCEL_H * (0.3 + Math.random() * 0.4);
				if (this.inOpen(x, y)) spots.push({ x, y });
			}
			for (const s of spots) {
				const mosq = s.water && (dusk || night);
				if (night && !mosq) continue;
				this.ambient.push({ x: s.x, y: s.y, kind: mosq ? 'mosq' : 'gnat', n: mosq ? 4 + Math.floor(Math.random() * 4) : 7 + Math.floor(Math.random() * 9), r: mosq ? 24 : 16, ph: Math.random() * 100 });
			}
		}
	}

	drawAmbient(ctx, v) {
		const t = this.t;
		for (const s of this.ambient ?? []) {
			if (s.x < v.x0 - 60 || s.x > v.x0 + v.w + 60 || s.y < v.y0 - 20 || s.y > v.y0 + v.h + 80) continue;
			for (let i = 0; i < s.n; i++) {
				const a = s.ph + i * 2.4;
				const x = s.x + Math.sin(t * (1.1 + (i % 5) * 0.33) + a) * s.r + Math.sin(t * 0.21 + a) * 7;
				const y = s.y - 36 + Math.cos(t * (1.6 + (i % 3) * 0.45) + a * 1.3) * s.r * 0.55 + Math.sin(t * 0.6 + i) * 5;
				if (s.kind === 'gnat') {
					ctx.fillStyle = 'rgba(46,40,30,0.55)';
					ctx.fillRect(x - 0.65, y - 0.65, 1.3, 1.3);
				} else {
					// Moustique : un corps fin, de longues pattes à peine visibles, des ailes qui vibrent.
					const dir = Math.cos(t * 1.1 + a) > 0 ? 1 : -1;
					ctx.strokeStyle = 'rgba(40,34,28,0.75)';
					ctx.lineWidth = 0.55;
					ctx.beginPath(); ctx.moveTo(x - 1.8 * dir, y + 0.5); ctx.lineTo(x + 1.6 * dir, y - 0.4); ctx.stroke();
					ctx.strokeStyle = 'rgba(40,34,28,0.3)';
					ctx.lineWidth = 0.3;
					ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y + 2.4); ctx.moveTo(x, y); ctx.lineTo(x + 1.4, y + 2.4); ctx.stroke();
					ctx.fillStyle = `rgba(225,232,240,${0.35 + 0.3 * Math.abs(Math.sin(t * 40 + i))})`;
					ctx.beginPath(); ctx.ellipse(x - 0.2 * dir, y - 1.2, 1.4, 0.6, -0.5 * dir, 0, Math.PI * 2); ctx.fill();
				}
			}
		}
	}

	/** De temps en temps, un vol d'oiseaux traverse le ciel au loin (le jour, hors pluie). */
	drawFlock(ctx, cw, ch) {
		const day = this.night() < 0.3 && !this.precip() && !this.glyph;
		if (!this.flock) {
			if (day && this.t > (this.nextFlock ??= this.t + 15 + Math.random() * 30)) {
				const dir = Math.random() < 0.5 ? 1 : -1;
				this.flock = { t0: this.t, dir, y: 0.12 + Math.random() * 0.3, n: 5 + Math.floor(Math.random() * 5), dur: 14 + Math.random() * 6, size: 0.8 + Math.random() * 0.5 };
			}
			return;
		}
		const f = this.flock, k = (this.t - f.t0) / f.dur;
		if (k > 1) { this.flock = null; this.nextFlock = this.t + 40 + Math.random() * 60; return; }
		const px = cw / this.canvas.clientWidth, s = 5 * px * f.size;
		const lead = f.dir > 0 ? -0.1 + k * 1.2 : 1.1 - k * 1.2;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.strokeStyle = 'rgba(46,52,44,0.6)';
		ctx.lineWidth = 1.1 * px;
		ctx.lineCap = 'round';
		for (let i = 0; i < f.n; i++) {
			const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
			const x = lead * cw - f.dir * row * 14 * px * f.size, y = f.y * ch + side * row * 8 * px * f.size + Math.sin(this.t * 1.5 + i) * 2 * px;
			const flap = Math.sin(this.t * 9 + i * 1.7) * 0.6;
			ctx.beginPath();
			ctx.moveTo(x - s, y - s * flap);
			ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
			ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * flap);
			ctx.stroke();
		}
	}

	newCritter(sp, P) {
		const c = sp.critter;
		const v = this.view();
		const side = Math.random() < 0.5 ? P.ox - 30 : P.ox + PARCEL_W + 30;
		const y = Math.max(P.oy, Math.min(P.oy + PARCEL_H, v.y0 + v.h * (0.2 + Math.random() * 0.6)));
		const base = { sp: sp.id, ci: P.ci, kind: c.kind, p: c, behavior: c.behavior, t: Math.random() * 10, dir: 1, timer: 2 + Math.random() * 4 };
		const w = this.water(P.ci);
		switch (c.behavior) {
			case 'water':
				return w && { ...base, x: w.x, y: w.y - 40, mode: 'hover', timer: 1 };
			case 'pond': {
				if (!w) return null;
				if (c.kind === 'heron') return { ...base, x: w.x - w.rx * 0.8, y: w.y + w.ry * 0.2, mode: 'perch', timer: 8 };
				const [px, py] = pick(POND_PADS);
				return { ...base, x: w.x + px * w.scale, y: w.y + py * w.scale - 3, mode: 'perch', timer: 6 + Math.random() * 6 };
			}
			case 'pinned': {
				if (c.on === 'buisson') {
					const target = pick(P.bushes);
					// Les bêtes volantes arrivent de l'extérieur avant de se poser ; l'araignée est déjà là.
					const fly = c.kind !== 'spider';
					return target && { ...base, target, ox: (Math.random() - 0.5) * 50, oy: 14 + Math.random() * 30, x: fly ? side : P.ox + target.x, y: fly ? y - 60 : P.oy + target.y, mode: fly ? 'arrive' : 'perch' };
				}
				const d = DECOR[c.on];
				return P.ci === 0 && this.decorVisible(c.on) && { ...base, decor: c.on, x: d.x + (Math.random() - 0.5) * 20, y: d.y + this.decorSprite(c.on).top * 0.8, mode: 'perch' };
			}
			case 'perch': {
				const target = pick(c.on === 'buisson' ? P.bushes : P.trees);
				return target && { ...base, x: side, y: y - 100, target, ox: c.trunk ? 6 : (Math.random() - 0.5) * (c.on === 'buisson' ? 30 : 60), oy: c.trunk ? 0 : 4, mode: 'seek' };
			}
			case 'bound':
			case 'roam': {
				const home = this.shelterFor(c.kind, P) ?? this.homeFor(c.home, P);
				if (!home) return null;
				return { ...base, x: home.x + (Math.random() - 0.5) * 80, y: home.y + 8 + Math.random() * 20, mode: 'sit', ph: 0, alert: 0, timer: 1 + Math.random() * 4, home };
			}
			case 'walk':
			case 'hop': {
				const home = this.shelterFor(c.kind, P) ?? this.homeFor(c.home, P);
				if (!home) return null;
				return { ...base, x: home.x + (Math.random() - 0.5) * 60, y: home.y + 10, mode: 'walk', ang: Math.random() * 6.28, home };
			}
			case 'trail': {
				// Une file de fourmis entre leur nid (le muret, ou une touffe d'herbe) et un arbuste ou une fleur.
				const a = this.homeFor('murger', P) ?? this.homeFor('herbe', P);
				const b = this.homeFor('buisson', P) ?? this.homeFor('fleur', P);
				if (!a || !b) return null;
				const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 80, my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 40;
				return { ...base, x: a.x, y: a.y, mode: 'walk', path: [[a.x, a.y + 6], [mx, my], [b.x, b.y + 4]], n: 11 };
			}
			case 'soar':
				return { ...base, x: P.ox + PARCEL_W / 2, y, mode: 'soar', ang: Math.random() * 6.28, r: 90 + Math.random() * 60 };
			case 'flower':
			case 'flutter':
			default:
				return { ...base, x: side, y, mode: c.behavior === 'flutter' ? 'wander' : 'seek', target: null, ang: Math.random() * 6.28 };
		}
	}

	/** Point d'attache d'un animal (coordonnées du monde) : un décor, ou un type de plante mûre de sa parcelle. */
	homeFor(key, P) {
		const pool = { tree: P.trees, arbre: P.trees, buisson: P.bushes, fleur: P.flowers, herbe: P.herbs }[key];
		if (pool) { const p = pick(pool); return p && { x: P.ox + p.x, y: P.oy + p.y }; }
		return DECOR[key] && P.ci === 0 && this.decorVisible(key) ? { x: DECOR[key].x, y: DECOR[key].y } : null;
	}

	// ─── Ce que les bêtes font pour le jardin ─────────────────────
	// Elles vivent comme dans la nature, et ça se voit dans le jeu : les butineurs pollinisent les fleurs en
	// train de pousser, les oiseaux sèment en picorant, les libellules mangent les moustiques, et chacun
	// rentre dans l'abri qu'on lui a construit.

	/** Objets posés dans une parcelle, parmi `kinds`. */
	itemsIn(ci, kinds) {
		return this.items.filter(it => kinds.includes(it.kind) && this.cellAt(it.x, it.y) === ci);
	}

	/** Coup de pouce à une plante qui pousse (sans la finir : c'est la marche ou l'écosystème qui la termine). */
	nurture(p, amount) {
		if (!p || p.growth >= 0.99) return false;
		p.growth = Math.min(0.99, p.growth + amount / PLANT_TYPES[p.type].cost);
		const [hx, hy] = this.headOf(p);
		if (amount >= 1 || Math.random() < 0.4) this.burst(hx, hy, 3, p.type === 'fleur' ? '#F4C23E' : '#9AC86A');
		return true;
	}

	/** Une plante de ce type qui pousse encore dans la parcelle, de préférence près de (x, y). */
	growingNear(P, type, x, y) {
		let best = null, bd = Infinity;
		for (const p of this.place.plants) {
			if (p.type !== type || p.growth >= 0.99 || p.growth <= 0 || cellOf(p) !== P.ci) continue;
			const d = Math.hypot(P.ox + p.x - x, P.oy + p.y - y);
			if (d < bd) { bd = d; best = p; }
		}
		return bd < 260 ? best : null;
	}

	/** Le refuge d'un animal qui marche : l'abri qu'on lui a posé dans sa parcelle, s'il y en a un. */
	shelterFor(kind, P) {
		const kinds = { hedgehog: ['abri', 'bois'], lizard: ['pierres'], snail: ['compost', 'bois', 'potager'], beetle: ['bois', 'compost'], firebug: ['bois', 'pierres'], rabbit: ['potager'], hare: ['potager'] }[kind];
		const it = kinds && pick(this.itemsIn(P.ci, kinds));
		return it && { x: it.x + (Math.random() - 0.5) * 30, y: it.y + 6, item: it };
	}

	// ─── Le jardinier de la cabane ─────────────────────────────────
	// Une cabane posée, et un jardinier s'installe : il sort le matin, prépare la terre devant chez lui,
	// puis bine et arrose les carrés de potager qu'on lui construit, va chercher du compost à la brouette,
	// et rentre à la nuit tombée. En arrosant, il donne un coup de pouce aux plantes qui poussent autour.

	/** Seuil de la porte de la cabane, une fois tournée (en coordonnées monde). */
	cabinDoor(it) {
		const r = ((it.rot ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
		const [x, y] = this.itemSprite('cabane', it.rot, it).door ?? [-1.5, 56];
		return { x: it.x + x * c - y * s, y: it.y + (x * s + y * c) * 0.36 };
	}

	/**
	 * Le chien ou le chat de la cabane. Le chien suit le fermier pas à pas ; le chat flâne près de la cabane.
	 * Tous deux font de longues siestes au soleil, et rentrent avec le fermier le soir.
	 */
	updatePet(dt) {
		const kind = { chien: 'dog', chat: 'cat' }[this.state.pet];
		const cab = this.glyph || !kind ? null : this.items.find(it => it.kind === 'cabane');
		if (!cab) { this.pet = null; return; }
		const door = this.cabinDoor(cab), f = this.farmer;
		let a = this.pet;
		if (!a || a.kind !== kind) a = this.pet = { kind, p: {}, x: door.x + 14, y: door.y + 4, mode: 'sleep', t: 0, ph: 0, dir: 1, timer: 3 };
		a.t += dt;
		// La nuit, il dort à l'intérieur, comme son maître.
		a.hidden = !!f?.hidden && (this.night() > 0.45 || this.precip() > 0.5);
		if (a.hidden) { a.x = door.x + 14; a.y = door.y + 4; a.mode = 'sleep'; return; }
		a.timer -= dt;
		if (!a.goal && a.timer <= 0) {
			const out = f && !f.hidden;
			if (kind === 'dog' && out) a.goal = { x: f.x - f.dir * 16, y: f.y + 6 };
			else if (Math.random() < (kind === 'cat' ? 0.55 : 0.4)) { a.mode = 'sleep'; a.timer = 8 + Math.random() * 14; }
			else {
				const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * (kind === 'cat' ? 60 : 90);
				a.goal = { x: door.x + Math.cos(ang) * r, y: door.y + 10 + Math.abs(Math.sin(ang)) * r * 0.5 };
			}
			if (!a.goal && a.mode !== 'sleep') a.timer = 2;
		}
		// Le chien guette son maître : il se lève dès que celui-ci s'éloigne.
		if (kind === 'dog' && f && !f.hidden && !a.goal && Math.hypot(f.x - a.x, f.y - a.y) > 46) a.goal = { x: f.x - f.dir * 16, y: f.y + 6 };
		if (!a.goal) { if (a.mode === 'run') a.mode = 'stand'; return; }
		const dx = a.goal.x - a.x, dy = a.goal.y - a.y, d = Math.hypot(dx, dy);
		if (d < 2) { a.goal = null; a.mode = 'stand'; a.timer = 1.5 + Math.random() * 3; return; }
		const step = Math.min(d, GAIT[kind].speed * dt);
		a.x += (dx / d) * step;
		a.y += (dy / d) * step;
		a.ph += step / GAIT[kind].stride;
		if (Math.abs(dx) > 0.5) a.dir = Math.sign(dx);
		a.mode = 'run';
	}

	updateFarmer(dt) {
		const cab = this.glyph ? null : this.items.find(it => it.kind === 'cabane');
		if (!cab) { this.farmer = null; return; }
		const door = this.cabinDoor(cab);
		let f = this.farmer;
		if (!f || f.cab !== cab.id) f = this.farmer = { kind: 'farmer', p: {}, x: door.x, y: door.y, mode: 'stand', t: 0, ph: 0, dir: 1, timer: 1.5, cab: cab.id, hidden: true };
		f.fem = this.state.gardener === 'fermiere';
		f.t += dt;
		const home = this.night() > 0.45 || this.precip() > 0.5;
		if (home && !f.goal && f.hidden) return;
		// Il se repose un moment à la cabane entre deux séries de travaux.
		if (f.hidden && !f.goal && f.t < (f.restUntil ?? 0)) return;
		if (home && f.goal?.task !== 'in') f.goal = { x: door.x, y: door.y, task: 'in' };
		if (f.goal) {
			const dx = f.goal.x - f.x, dy = f.goal.y - f.y, d = Math.hypot(dx, dy);
			f.hidden = false;
			if (d < 1.5) {
				const task = f.goal.task;
				f.goal = null;
				f.carry = task === 'fetch' ? !f.carry : f.carry;
				if (task === 'in') { f.hidden = true; f.mode = 'stand'; f.timer = 2; if (!home) f.restUntil = f.t + 40 + Math.random() * 70; return; }
				if (task === 'harvest') { f.mode = 'rake'; f.harvesting = f.bed; f.dir = f.face ?? f.dir; f.timer = 4.5; return; }
				if (task === 'fetch') { f.mode = 'stand'; f.timer = 1.2; return; }
				f.mode = task;
				f.dir = f.face ?? f.dir;
				f.timer = task === 'rake' ? 6 + Math.random() * 6 : task === 'water' ? 4 + Math.random() * 4 : 2 + Math.random() * 3;
				return;
			}
			const step = Math.min(d, GAIT.farmer.speed * (f.carry ? 0.8 : 1) * dt);
			f.x += (dx / d) * step;
			f.y += (dy / d) * step;
			f.ph += step / GAIT.farmer.stride;
			f.dist = (f.dist ?? 0) + step;
			if (Math.abs(dx) > 0.5) f.dir = Math.sign(dx);
			f.mode = f.carry ? 'barrow' : 'run';
			return;
		}
		// En arrosant, il aide ce qui pousse autour de lui.
		if (f.mode === 'water' && (f.nurtureAt ?? 0) < f.t) {
			f.nurtureAt = f.t + 2;
			const ci = this.cellAt(f.x, f.y);
			const P = this.pdata[ci];
			if (P) {
				const near = this.place.plants.filter(p => cellOf(p) === ci && p.growth < 1 && Math.hypot(P.ox + p.x - f.x, P.oy + p.y - f.y) < 140);
				if (near.length) this.nurture(pick(near), 4);
			}
		}
		f.timer -= dt;
		if (f.timer > 0) return;
		// Récolte finie : la parcelle est ressemée, et le panier rapporte du nectar.
		if (f.harvesting) {
			const bed = f.harvesting;
			f.harvesting = null;
			if (this.items.includes(bed)) {
				bed.km0 = this.state.totals.distance / 1000;
				this.burst(bed.x, bed.y - 10, 14, '#E8762E');
				this.onHarvest?.(bed);
			}
		}
		if (!f.hidden) {
			f.done = (f.done ?? 0) + 1;
			if (f.done >= (f.shift ??= 3 + Math.floor(Math.random() * 3))) {
				f.done = 0;
				f.shift = 3 + Math.floor(Math.random() * 3);
				f.goal = { x: door.x, y: door.y, task: 'in' };
				return;
			}
		}
		f.hidden = false;
		const beds = this.items.filter(it => it.kind === 'potager');
		const ripe = beds.find(b => this.bedStage(b) >= 1);
		if (ripe && !f.carry) {
			const side = Math.random() < 0.5 ? -1 : 1;
			f.goal = { x: ripe.x + side * (PLOT.w / 2 - 15), y: ripe.y + PLOT.h / 2 + 6, task: 'harvest' };
			f.bed = ripe;
			f.face = -side;
			return;
		}
		// Brouette : un aller-retour au tas de compost (ou à la cabane) de temps en temps, puis il repart au potager.
		const compost = this.items.find(it => it.kind === 'compost');
		if (beds.length && (f.carry || Math.random() < 0.22)) {
			const to = f.carry ? pick(beds) : (compost ?? cab);
			f.goal = { x: to.x + (f.carry ? -60 : 30), y: to.y + 20, task: 'fetch' };
			return;
		}
		if (beds.length) {
			const bed = pick(beds), side = Math.random() < 0.5 ? -1 : 1;
			f.goal = { x: bed.x + side * (20 + Math.random() * 40), y: bed.y + PLOT.h / 2 + 4 + Math.random() * 6, task: Math.random() < 0.55 ? 'rake' : 'water' };
			f.face = -side;
			return;
		}
		// Pas encore de potager : il bêche devant la cabane, là où il aimerait le faire.
		const side = Math.random() < 0.5 ? -1 : 1;
		f.goal = { x: door.x + side * (50 + Math.random() * 50), y: door.y + 25 + Math.random() * 30, task: Math.random() < 0.7 ? 'rake' : 'stand' };
		f.face = side;
	}

	updateInsect(b, dt) {
		b.t += dt;
		const P = this.pdata[b.ci];
		if (!P) { b.gone = true; return; }
		const flyTo = (tx, ty, speed, wobble) => {
			const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy) || 1;
			const step = Math.min(dist, speed * dt);
			b.x += (dx / dist) * step + (-dy / dist) * Math.sin(b.t * 7) * wobble * dt;
			b.y += (dy / dist) * step + (dx / dist) * Math.sin(b.t * 7) * wobble * dt;
			if (Math.abs(dx) > 1) b.dir = Math.sign(dx);
			return dist;
		};
		const midX = P.ox + PARCEL_W / 2;
		const flyAway = () => {
			if (b.exitX == null) b.exitX = b.x < midX ? P.ox - 60 : P.ox + PARCEL_W + 60;
			if (flyTo(b.exitX, b.y - 80, 90, 10) < 5) b.gone = true;
		};
		const place = this.place;
		const has = p => place.plants.includes(p);
		const head = p => this.headOf(p);

		switch (b.behavior) {
			case 'flower': {
				if (b.leaving) return flyAway();
				if (b.mode === 'home') {
					// Retour à la ruche ou à l'hôtel : on entre, on reste un peu à l'abri, on ressort.
					const it = b.homeItem;
					if (!this.items.includes(it)) { b.mode = 'seek'; b.hidden = false; return; }
					if (b.hidden) {
						b.timer -= dt;
						if (b.timer <= 0) { b.hidden = false; b.mode = 'seek'; b.visits = 0; b.target = null; }
						return;
					}
					if (flyTo(it.x, it.y - (it.kind === 'ruche' ? 16 : 60), 60, 15) < 4) { b.hidden = true; b.timer = 4 + Math.random() * 5; }
					return;
				}
				if (b.mode === 'hover' && b.target && has(b.target)) {
					b.timer -= dt;
					const [hx, hy] = head(b.target);
					b.x = hx + Math.cos(b.t * 3) * 5;
					b.y = hy - 4 + Math.sin(b.t * 5) * 2;
					if (b.timer <= 0) {
						this.nectarFrom(hx, hy - 4);
						// Pollinisation : le pollen porté d'une fleur à l'autre aide une fleur qui pousse, tout près.
						if (Math.random() < 0.35) this.nurture(this.growingNear(P, 'fleur', hx, hy), 0.2);
						b.mode = 'seek'; b.target = null;
						b.visits = (b.visits ?? 0) + 1;
						if (b.kind === 'bee' && b.visits >= 4 + Math.random() * 4) {
							const homes = this.itemsIn(b.ci, ['ruche', 'hotel']);
							if (homes.length) { b.mode = 'home'; b.homeItem = pick(homes); }
						}
					}
					return;
				}
				if (!b.target || !has(b.target)) b.target = P.flowers.length ? pick(P.flowers) : null;
				if (!b.target) { b.leaving = true; return; }
				const [hx, hy] = head(b.target);
				if (flyTo(hx, hy - 4, 70, 25) < 4) { b.mode = 'hover'; b.timer = 1.5 + Math.random() * 2; }
				return;
			}
			case 'flutter': {
				if (b.leaving) return flyAway();
				if (b.mode === 'perch' && b.target && has(b.target)) {
					b.timer -= dt;
					const [hx, hy] = head(b.target);
					b.x = hx + b.ox; b.y = hy + b.oy;
					if (b.timer <= 0) { b.mode = 'wander'; b.target = null; b.timer = 3 + Math.random() * 4; }
					return;
				}
				if (b.mode === 'seek' && b.target && has(b.target)) {
					const [hx, hy] = head(b.target);
					if (flyTo(hx + b.ox, hy + b.oy, 40, 30) < 3) { b.mode = 'perch'; b.timer = 2 + Math.random() * 3; }
					return;
				}
				b.timer -= dt;
				const spots = [...P.perches, ...P.flowers];
				if (b.timer <= 0 && spots.length) {
					b.target = pick(spots);
					b.ox = (Math.random() - 0.5) * (b.target.type === 'fleur' ? 4 : 30);
					b.oy = b.target.type === 'fleur' ? -2 : 6 + Math.random() * 14;
					b.mode = 'seek';
					return;
				}
				if (b.y < P.oy + 40 || b.y > P.oy + PARCEL_H - 60 || b.x < P.ox + 20 || b.x > P.ox + PARCEL_W - 20) {
					const back = Math.atan2(P.oy + PARCEL_H / 2 - b.y, midX - b.x);
					b.ang += Math.sign(Math.sin(back - b.ang)) * dt * 2;
				}
				b.ang += (Math.random() - 0.5) * dt * 4;
				b.x += Math.cos(b.ang) * 35 * dt;
				b.y += Math.sin(b.ang) * 35 * dt + Math.sin(b.t * 5) * 8 * dt;
				b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
				return;
			}
			case 'water': {
				if (b.leaving) return flyAway();
				const w = this.water(b.ci);
				if (!w) { b.leaving = true; return; }
				if (b.mode === 'hover') {
					b.timer -= dt;
					b.x += Math.sin(b.t * 13) * 3 * dt;
					b.y += Math.cos(b.t * 11) * 3 * dt;
					if (b.timer <= 0) {
						b.mode = 'dart';
						// Une nuée de moucherons ou de moustiques à portée : la libellule fond dessus.
						const prey = (this.ambient ?? []).find(s => s.n > 0 && Math.hypot(s.x - b.x, s.y - 36 - b.y) < 220);
						b.prey = prey && Math.random() < 0.7 ? prey : null;
						if (b.prey) { b.tx = b.prey.x + (Math.random() - 0.5) * 20; b.ty = b.prey.y - 36; }
						else { b.tx = w.x + (Math.random() - 0.5) * w.rx * 2.6; b.ty = w.y - 30 + (Math.random() - 0.5) * w.ry * 2.4; }
					}
					return;
				}
				if (flyTo(b.tx, b.ty, 220, 0) < 3) {
					if (b.prey) { b.prey.n = Math.max(0, b.prey.n - 1); b.prey = null; }
					b.mode = 'hover'; b.timer = 0.6 + Math.random();
				}
				return;
			}
			case 'pond': {
				if (b.leaving) { b.gone = true; return; }
				const w = this.water(b.ci);
				if (!w) { b.gone = true; return; }
				if (b.kind === 'heron') {
					b.timer -= dt;
					if (b.timer <= 0) { b.timer = 10 + Math.random() * 10; b.tx = w.x + (Math.random() < 0.5 ? -1 : 1) * w.rx * 0.85; b.ty = w.y + (Math.random() - 0.3) * w.ry; }
					if (b.tx != null && flyTo(b.tx, b.ty, 8, 0) < 2) b.tx = null;
					return;
				}
				if (b.p.swim) {
					b.ang = (b.ang ?? Math.random() * 6) + (Math.random() - 0.5) * dt;
					b.x += Math.cos(b.ang) * 6 * dt;
					b.y += Math.sin(b.ang) * 3 * dt;
					if (Math.hypot((b.x - w.x) / w.rx, (b.y - w.y) / w.ry) > 0.7) b.ang = Math.atan2(w.y - b.y, w.x - b.x);
					b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
					return;
				}
				if (b.mode === 'hop') {
					b.k = Math.min(1, b.k + dt * 2.2);
					b.x = lerp(b.fx, b.tx, b.k);
					b.y = lerp(b.fy, b.ty, b.k) - Math.sin(b.k * Math.PI) * 16;
					if (b.k >= 1) { b.mode = 'perch'; b.timer = 6 + Math.random() * 8; }
					return;
				}
				b.timer -= dt;
				if (b.timer <= 0) {
					const [px, py] = pick(POND_PADS);
					Object.assign(b, { mode: 'hop', k: 0, fx: b.x, fy: b.y, tx: w.x + px * w.scale, ty: w.y + py * w.scale - 3 });
					b.dir = b.tx >= b.x ? 1 : -1;
				}
				return;
			}
			case 'pinned': {
				if (b.leaving) { if (b.p.kind === 'spider') b.gone = true; else flyAway(); return; }
				if (b.target) {
					if (!has(b.target)) { b.gone = true; return; }
					const [hx, hy] = head(b.target);
					if (b.mode === 'arrive') {
						if (flyTo(hx + b.ox, hy + b.oy, 45, 20) < 2) b.mode = 'perch';
						return;
					}
					b.ox += Math.cos(b.t * 0.7) * 2 * dt;
					b.oy += Math.sin(b.t * 0.5) * 1.5 * dt;
					b.x = hx + b.ox;
					b.y = hy + b.oy;
				} else {
					b.x += Math.cos(b.t * 0.4) * 1.5 * dt;
				}
				b.dir = Math.cos(b.t * 0.7) >= 0 ? 1 : -1;
				return;
			}
			case 'perch': {
				if (b.leaving) b.target = null;
				if (!b.target || !has(b.target)) {
					if (flyTo(b.x < midX ? P.ox - 60 : P.ox + PARCEL_W + 60, b.y - 60, 120, 0) < 5) b.gone = true;
					return;
				}
				const [hx, hy] = head(b.target);
				// Le pic se pose sur le tronc, les autres oiseaux dans le feuillage.
				// Le feuillage est un dôme : plus on s'écarte du milieu, plus sa surface descend. L'oiseau s'y pose
				// un peu enfoncé dans les feuilles, au lieu de flotter à la hauteur du sommet.
				const crown = Math.max(10, this.meta.get(b.target.id)?.r ?? 30), u = Math.min(0.92, Math.abs(b.ox) / crown);
				const ty = b.p.trunk ? P.oy + b.target.y - 45 : hy + crown * 0.7 * (1 - Math.sqrt(1 - u * u)) + 8 + b.oy;
				if (b.mode === 'visit') {
					// Sur la mangeoire, le bain ou le nichoir : on s'y pose un moment, puis on repart.
					const it = b.visitItem;
					if (!this.items.includes(it)) { b.mode = 'seek'; return; }
					const top = this.itemSprite(it.kind, it.rot, it).top;
					const vx = it.x + (it.kind === 'nichoir' ? 0 : b.vox), vy = it.y + (it.kind === 'nichoir' ? top * 0.68 : it.kind === 'bain' ? top * 0.82 : top * 0.62);
					if (b.vk !== 'sit') { if (flyTo(vx, vy, 110, 10) < 3) { b.vk = 'sit'; b.timer = 4 + Math.random() * 5; } return; }
					b.x = vx; b.y = vy + Math.sin(b.t * 9) * (it.kind === 'mangeoire' ? 0.8 : 0.3);
					b.timer -= dt;
					if (b.timer <= 0) { b.mode = 'seek'; b.vk = null; }
					return;
				}
				if (b.mode === 'ground') {
					// Au sol : quelques sautillements, des coups de bec. En picorant, les oiseaux sèment.
					if (b.gk !== 'peck') { if (flyTo(b.gx, b.gy, 110, 10) < 3) { b.gk = 'peck'; b.timer = 3 + Math.random() * 3; } return; }
					b.timer -= dt;
					b.y = b.gy + Math.max(0, Math.sin(b.t * 7)) * 1.5;
					if (Math.random() < dt * 0.6) { b.gx += (Math.random() - 0.5) * 16; b.x = b.gx; b.dir = Math.random() < 0.5 ? 1 : -1; }
					if (b.timer <= 0) {
						if (Math.random() < 0.5) this.nurture(this.growingNear(P, Math.random() < 0.6 ? 'buisson' : 'arbre', b.x, b.y), 2);
						b.mode = 'seek'; b.gk = null;
					}
					return;
				}
				if (b.mode === 'perch') {
					b.x = hx + b.ox;
					b.y = ty + (b.p.trunk ? Math.sin(b.t * 0.6) * 6 : 0);
					b.timer -= dt;
					if (b.timer <= 0) {
						const visits = b.p.trunk ? [] : this.itemsIn(b.ci, b.sp === 'mesange' ? ['nichoir', 'mangeoire', 'bain'] : ['mangeoire', 'bain']);
						const roll = Math.random();
						if (visits.length && roll < 0.35) {
							b.mode = 'visit'; b.visitItem = pick(visits); b.vox = (Math.random() - 0.5) * 18; b.vk = null;
						} else if (!b.p.trunk && roll < 0.6) {
							b.mode = 'ground'; b.gk = null;
							b.gx = P.ox + b.target.x + (Math.random() - 0.5) * 70; b.gy = P.oy + b.target.y + 8 + Math.random() * 30;
						} else {
							b.mode = 'seek';
							b.target = pick(b.p.on === 'buisson' ? P.bushes : P.trees) ?? b.target;
							b.ox = b.p.trunk ? 6 : (Math.random() - 0.5) * (b.p.on === 'buisson' ? 30 : 60);
						}
					}
					return;
				}
				if (flyTo(hx + b.ox, ty, 110, 15) < 3) { b.mode = 'perch'; b.timer = 4 + Math.random() * 6; b.dir = b.p.trunk ? -1 : b.dir; }
				return;
			}
			case 'walk': {
				const home = b.home;
				if (b.leaving) {
					if (flyTo(home.x - 30, home.y - 10, (b.p.speed ?? 14) * 1.3, 0) < 3) b.gone = true;
					return;
				}
				b.ang += (Math.random() - 0.5) * dt * 1.5;
				if (Math.hypot(b.x - home.x, b.y - home.y) > 150) b.ang = Math.atan2(home.y - b.y, home.x - b.x);
				b.timer -= dt;
				if (b.timer < 0) {
					b.mode = 'perch';
					if (b.timer < -2) { b.timer = 3 + Math.random() * 5; b.mode = 'walk'; }
					return;
				}
				const sp = b.p.speed ?? 14;
				b.x += Math.cos(b.ang) * sp * dt;
				b.y += Math.sin(b.ang) * sp * 0.65 * dt;
				b.x = Math.max(P.ox + 10, Math.min(P.ox + PARCEL_W - 10, b.x));
				b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
				return;
			}
			case 'bound':
			case 'roam': {
				const g = GAIT[b.kind], home = b.home;
				if (b.mode === 'run') {
					const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
					if (b.behavior === 'bound') {
						// Un bond : lent au sol, rapide en l'air ; arrivé, il finit son bond avant de s'asseoir.
						const u = b.ph % 1;
						b.ph += dt / g.hop;
						if (d < 2) {
							if (u > 0.88 || u < 0.04) { if (b.leaving) { b.gone = true; return; } Object.assign(b, { mode: 'sit', ph: 0, timer: 2 + Math.random() * 7 }); }
							return;
						}
						const step = Math.min(d, (g.len / g.hop) * (0.35 + 1.3 * Math.sin(Math.PI * u) ** 2) * dt);
						b.x += (dx / d) * step;
						b.y += (dy / d) * step;
					} else {
						if (d < 2) { if (b.leaving) { b.gone = true; return; } Object.assign(b, { mode: 'sit', timer: 4 + Math.random() * 9 }); return; }
						const step = Math.min(d, g.speed * (b.leaving ? 1.8 : 1) * dt);
						b.x += (dx / d) * step;
						b.y += (dy / d) * step;
						// Les pattes avancent avec le chemin parcouru : pas de glissade.
						b.ph = (b.ph ?? 0) + step / g.stride;
					}
					if (Math.abs(dx) > 0.5) b.dir = Math.sign(dx);
					b.dist = (b.dist ?? 0) + Math.abs(dx);
					return;
				}
				// À l'arrêt : il broute, et de temps en temps se dresse pour écouter.
				const listen = Math.sin(b.t * 0.37 + (b.seed ??= Math.random() * 9)) > 0.82 ? 1 : 0;
				b.alert += (listen - b.alert) * Math.min(1, dt * 5);
				b.timer -= dt;
				if (b.leaving || b.timer < 0) {
					const far = b.leaving ? 320 : 40 + Math.random() * (b.behavior === 'roam' ? 160 : 90);
					const a = b.leaving ? (b.x < P.ox + PARCEL_W / 2 ? Math.PI : 0) + (Math.random() - 0.5) : Math.random() * Math.PI * 2;
					let tx = b.x + Math.cos(a) * far, ty = b.y + Math.sin(a) * far * 0.6;
					if (!b.leaving && Math.hypot(tx - home.x, ty - home.y) > 170) { tx = home.x + (Math.random() - 0.5) * 60; ty = home.y + 10; }
					if (!b.leaving) tx = Math.max(P.ox + 20, Math.min(P.ox + PARCEL_W - 20, tx));
					Object.assign(b, { mode: 'run', tx, ty, ph: b.behavior === 'bound' ? 0 : (b.ph ?? 0), alert: 0 });
				}
				return;
			}
			case 'hop': {
				if (b.leaving) { b.gone = true; return; }
				if (b.mode === 'hop') {
					b.k = Math.min(1, b.k + dt * 1.8);
					b.x = lerp(b.fx, b.tx, b.k);
					b.y = lerp(b.fy, b.ty, b.k) - Math.sin(b.k * Math.PI) * 22;
					if (b.k >= 1) { b.mode = 'walk'; b.timer = 2 + Math.random() * 4; }
					return;
				}
				b.timer -= dt;
				b.x += Math.cos(b.t * 0.5) * 2 * dt;
				if (b.timer <= 0) {
					const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 35;
					let tx = b.x + Math.cos(a) * d, ty = b.y + Math.sin(a) * d * 0.6;
					if (Math.hypot(tx - b.home.x, ty - b.home.y) > 140) { tx = b.home.x; ty = b.home.y + 8; }
					Object.assign(b, { mode: 'hop', k: 0, fx: b.x, fy: b.y, tx: Math.max(P.ox + 10, Math.min(P.ox + PARCEL_W - 10, tx)), ty });
					b.dir = b.tx >= b.x ? 1 : -1;
				}
				return;
			}
			case 'trail': {
				if (b.leaving) b.gone = true;
				return;
			}
			case 'soar': {
				if (b.leaving) return flyAway();
				b.ang += dt * 0.25;
				const v = this.view();
				const cy = Math.max(P.oy + 150, Math.min(P.oy + PARCEL_H - 150, v.y0 + v.h * 0.4));
				b.x = midX + Math.cos(b.ang) * b.r * 1.3;
				b.y = cy + Math.sin(b.ang) * b.r * 0.7;
				b.dir = Math.sin(b.ang) > 0 ? -1 : 1;
			}
		}
	}

	// ─── Météo ─────────────────────────────────────────────────────

	updateWeather(dt) {
		const k = this.weather.kind;
		const v = this.view();
		const amount = this.precip();
		if (amount > 0) {
			const snow = k === 'snow';
			const rate = (snow ? 40 : 160) * amount * Math.min(4, (v.w * v.h) / (420 * 900));
			for (let i = 0; i < rate * dt && this.drops.length < 450; i++) {
				this.drops.push({ x: v.x0 - 40 + Math.random() * (v.w + 80), y: v.y0 - 20 - Math.random() * 40, z: 0.6 + Math.random() * 0.6, snow, ground: v.y0 + Math.random() * v.h, ph: Math.random() * 6.28 });
			}
		}
		const wind = Math.min(40, this.weather.wind ?? 10);
		for (const d of this.drops) {
			if (d.splash != null) { d.splash += dt * 3; continue; }
			if (d.snow) { d.y += 40 * d.z * dt; d.x += (Math.sin(this.t * 1.5 + d.ph) * 12 + wind * 0.6) * dt; }
			else { d.y += 520 * d.z * dt; d.x += wind * 3 * dt; }
			if (d.y >= d.ground) { if (d.snow) d.gone = true; else d.splash = 0; }
		}
		this.drops = this.drops.filter(d => !d.gone && !(d.splash > 1) && d.y < v.y0 + v.h + 40);
		if (k === 'storm' && Math.random() < dt * 0.12) this.flash = 1;
		this.flash = Math.max(0, this.flash - dt * 3);
	}

	drawWeather(ctx) {
		if (!this.drops.length) return;
		const wind = Math.min(40, this.weather.wind ?? 10);
		ctx.lineCap = 'round';
		for (const d of this.drops) {
			if (d.snow) {
				ctx.fillStyle = 'rgba(253,253,250,0.9)';
				ctx.beginPath();
				ctx.arc(d.x, d.y, 1.2 * d.z, 0, Math.PI * 2);
				ctx.fill();
			} else if (d.splash != null) {
				ctx.strokeStyle = `rgba(230,240,245,${0.5 * (1 - d.splash)})`;
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.ellipse(d.x, d.ground, 1 + d.splash * 3, 0.4 + d.splash, 0, 0, Math.PI * 2);
				ctx.stroke();
			} else {
				ctx.strokeStyle = 'rgba(220,232,240,0.45)';
				ctx.lineWidth = 0.6 * d.z;
				ctx.beginPath();
				ctx.moveTo(d.x, d.y);
				ctx.lineTo(d.x - wind * 0.08, d.y - 9 * d.z);
				ctx.stroke();
			}
		}
	}

	// ─── Rendu ─────────────────────────────────────────────────────

	wind(x) {
		const t = this.t;
		const strength = 0.6 + Math.min(2.4, (this.weather.wind ?? 10) / 18);
		const gust = 0.6 * Math.pow(Math.max(0, Math.sin(t * 0.21 - x * 0.004)), 4);
		return strength * (0.45 * Math.sin(t * 0.9 + x * 0.012) + 0.25 * Math.sin(t * 2.3 + x * 0.03) + gust);
	}

	/** Couleur d'une plante en vue d'ensemble (forme simple), selon son espèce et la saison. */
	glyphColor(p) {
		const L = lookOf(p);
		const s = this.season ?? {};
		const base = p.type === 'fleur' ? L.color : p.type === 'herbe' ? '#7FAA48' : p.type === 'buisson' ? (L.foliage ?? ['#2A6034', '#3E7A3C'])[1] : (L.canopy ?? ['#1C5A35', '#326832'])[1];
		if (p.type === 'fleur' || L.evergreen || L.form === 'conifere' || L.form === 'parasol') return base ?? '#7FAA48';
		return mix(mix(base, '#C8742E', (s.autumn ?? 0) * 0.55), '#7A6A50', (s.winter ?? 0) * 0.6);
	}

	render() {
		const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height;
		const S = this.scale, D = this.density;
		const hour = this.hour(), { amb, night } = this.light(hour), day = 1 - night;
		const wk = this.weather.kind;
		const glyph = this.glyph, detail = this.cam.z >= DETAIL_Z;
		const tx = cw / 2 - this.cam.cx * S, ty = ch / 2 - this.cam.cy * S;
		const world = () => ctx.setTransform(S, 0, 0, S, tx, ty);
		const v = this.view();
		const visible = this.visibleCells();
		const place = this.place;
		const plantPos = p => { const [ox, oy] = cellOrigin(cellOf(p)); return [ox + p.x, oy + p.y]; };

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#E4DEC6';
		ctx.fillRect(0, 0, cw, ch);

		// Le sol continue partout ; hors des clairières ouvertes, une prairie sauvage voilée de brume.
		// Peintures en attente (sol, plantes) : quelques millisecondes par image, jamais d'écran figé.
		this.workTiles(5);
		this.paintUntil = performance.now() + 6;
		const lo = this.cam.z < 0.6;
		const gx0 = Math.floor((v.x0 - 10) / PARCEL_W), gx1 = Math.floor((v.x0 + v.w + 10) / PARCEL_W);
		const gy0 = Math.floor((v.y0 - 10) / PARCEL_H), gy1 = Math.floor((v.y0 + v.h + 10) / PARCEL_H);
		world();
		// Chaque tuile déborde d'un pixel d'écran sur la suivante : sans ça, un fin trait clair apparaît aux raccords.
		const seam = 1.5 / this.scale;
		for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
			const tile = this.tileFor(gx, gy, lo);
			if (tile) ctx.drawImage(tile, gx * PARCEL_W, gy * PARCEL_H, PARCEL_W + seam, PARCEL_H + seam);
			else { ctx.fillStyle = this.groundColor(GROUND[this.biome].base); ctx.fillRect(gx * PARCEL_W, gy * PARCEL_H, PARCEL_W, PARCEL_H); }
		}
		this.drawMist(ctx, world, cw, ch);
		this.trimTiles();
		this.drawNextOutline(ctx, v);
		// La clôture suit le bord des clairières ; elle recule à chaque nouvelle parcelle.
		this.drawFence(ctx, v);

		// Ombres de nuages, plus denses par temps couvert.
		const cloudy = { clouds: 1.5, overcast: 2.2, rain: 2, drizzle: 2, storm: 2.6, snow: 1.6, fog: 0.4 }[wk] ?? 1;
		if (day > 0) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.globalAlpha = Math.min(0.85, 0.32 * day * cloudy);
			// Les nuages sont posés sur le monde (un motif qui se répète tous les CLOUD_X × CLOUD_Y) et ne bougent
			// qu'avec le vent : zoomer ou glisser la vue ne les déplace pas.
			for (const cl of this.clouds) {
				const cx = cl.x + this.t * cl.speed * (0.5 + (this.weather.wind ?? 10) / 20);
				const i0 = Math.floor((v.x0 - cl.w - cx) / CLOUD_X) + 1, i1 = Math.floor((v.x0 + v.w - cx) / CLOUD_X);
				const j0 = Math.floor((v.y0 - cl.h - cl.y) / CLOUD_Y) + 1, j1 = Math.floor((v.y0 + v.h - cl.y) / CLOUD_Y);
				for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) ctx.drawImage(cl.canvas, cx + i * CLOUD_X, cl.y + j * CLOUD_Y, cl.w, cl.h);
			}
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1;
		}

		// La terre des potagers, à même le sol : les parcelles voisines se soudent en un seul champ.
		if (!glyph) for (const it of this.items) {
			if (it.kind !== 'potager' || it === this.lifted) continue;
			const c = this.soilSprite(plotSeed(it)), m = 12;
			ctx.drawImage(c, it.x - PLOT.w / 2 - m, it.y - PLOT.h / 2 - m, PLOT.w + m * 2, PLOT.h + m * 2);
		}

		// Tapis d'herbe : sous les touffes de graminées, une pelouse peinte au sol qui se referme à mesure qu'elles poussent.
		if (!glyph) {
			for (const p of place.plants) {
				if (p.type !== 'herbe' || p.growth <= 0) continue;
				const look = lookOf(p);
				if ((look.form ?? 'graminees') !== 'graminees') continue;
				const [x, y] = plantPos(p);
				if (x < v.x0 - 70 || x > v.x0 + v.w + 70 || y < v.y0 - 40 || y > v.y0 + v.h + 40) continue;
				const k = 0.45 + 0.55 * Math.min(1, p.growth);
				ctx.drawImage(this.turfSprite(p.seed % 5, look.palette), x - 64 * k, y - 32 * k, 128 * k, 64 * k);
			}
		}

		// Ombres portées : direction et longueur d'après la vraie position du soleil, nettes par beau temps.
		const sun = this.sunPos?.(hour);
		const sunny = (SUNNY[wk] ?? 1) * day;
		if (!glyph && sun && sun.alt > 1 && sunny > 0.02) {
			const dir = ((sun.az + 180) * Math.PI) / 180;
			const dx = Math.sin(dir), dy = -Math.cos(dir);
			// Une ombre courte et douce, à la forme de la couronne, reliée au pied par l'ombre du tronc.
			const len = Math.min(1.8, 1 / Math.tan((sun.alt * Math.PI) / 180)) * 0.5;
			// Calque à demi-résolution : les ombres sont douces, ça ne se voit pas, et c'est bien plus léger.
			const lw = Math.ceil(cw / 2), lh = Math.ceil(ch / 2);
			const layer = this.shadowLayer(lw, lh), s = layer.getContext('2d');
			s.setTransform(1, 0, 0, 1, 0, 0);
			s.globalCompositeOperation = 'source-over';
			s.clearRect(0, 0, lw, lh);
			const T = ctx.getTransform();
			s.setTransform(T.a / 2, T.b / 2, T.c / 2, T.d / 2, T.e / 2, T.f / 2);
			const dot = this.softDot();
			s.strokeStyle = '#000';
			s.lineCap = 'round';
			for (const p of place.plants) {
				const m = this.meta.get(p.id);
				if (!m) continue;
				const [x, y] = plantPos(p);
				if (x < v.x0 - 250 || x > v.x0 + v.w + 250 || y < v.y0 - 80 || y > v.y0 + v.h + 300) continue;
				const r = Math.max(3, m.r);
				if (p.type === 'herbe' || p.type === 'fleur') {
					s.drawImage(dot, x + dx * 3 - r * 0.7, y + dy * 2 - r * 0.25, r * 1.4, r * 0.5);
					continue;
				}
				// Le centre de la couronne est à environ 60 % de la hauteur ; son ombre tombe à l'opposé du soleil.
				const h = -m.top * (p.type === 'arbre' ? 0.62 : 0.5) * len;
				const sx = x + dx * h, sy = y + dy * h * 0.7;
				if (p.type === 'arbre') {
					s.lineWidth = Math.max(2, r * 0.12);
					s.globalAlpha = 0.7;
					s.beginPath(); s.moveTo(x, y); s.lineTo(sx - dx * r * 0.4, sy - dy * r * 0.25); s.stroke();
					s.globalAlpha = 1;
				}
				s.drawImage(dot, sx - r * 1.15, sy - r * 0.6, r * 2.3, r * 1.2);
				s.drawImage(dot, x - r * 0.6, y - r * 0.2, r * 1.2, r * 0.4);
			}
			// Une seule teinte froide, un peu bleutée, posée d'un coup : les ombres qui se croisent ne s'assombrissent pas.
			s.setTransform(1, 0, 0, 1, 0, 0);
			s.globalCompositeOperation = 'source-in';
			s.fillStyle = '#2A3E5A';
			s.fillRect(0, 0, lw, lh);
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = 0.22 * sunny * Math.min(1, sun.alt / 8);
			ctx.drawImage(layer, 0, 0, cw, ch);
			ctx.restore();
		}

		// Ombres des animaux au sol
		if (!glyph) {
			ctx.fillStyle = 'rgba(30,50,20,0.13)';
			for (const b of [...this.insects, ...[this.farmer, this.pet].filter(x => x && !x.hidden)]) {
				const h = FLIGHT[b.kind] ?? (b.mode === 'perch' ? null : 24);
				if (h == null || b.p.swim || b.behavior === 'trail') continue;
				const big = { hedgehog: 2.6, frog: 1.8, marmot: 2.6, squirrel: 2, heron: 2.4, eagle: 5, gull: 3, crab: 1.8, rabbit: 3, hare: 3.4, roe: 6, chamois: 5.6, fox: 5, farmer: 3.4, dog: 3.6, cat: 2.8 }[b.kind] ?? 1;
				ctx.beginPath();
				ctx.ellipse(b.x + h * 0.25, b.y + h, 4 * big, 1.8 * big, 0, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		// Décor, plantes et animaux au sol, triés par profondeur.
		const entities = [];
		for (const key of Object.keys(DECOR)) {
			const d = DECOR[key];
			if (!this.decorVisible(key)) continue;
			entities.push({ decor: key, x: d.x, y: d.y });
		}
		for (const p of place.plants) {
			const [wx, wy] = plantPos(p), box = PLANT_TYPES[p.type].box;
			if (wx + box.w < v.x0 || wx - box.w > v.x0 + v.w || wy - box.ay > v.y0 + v.h + 20 || wy + 30 < v.y0) continue;
			entities.push({ plant: p, x: wx, y: wy });
		}
		for (const it of this.items) if (it !== this.lifted && it.x > v.x0 - 120 && it.x < v.x0 + v.w + 120 && it.y > v.y0 - 40 && it.y < v.y0 + v.h + 200) entities.push({ item: it, x: it.x, y: it.y });
		if (!glyph) for (const b of this.insects) if (onGround(b)) entities.push({ critter: b, y: b.behavior === 'trail' ? -1e9 : b.y + 2 });
		if (!glyph && this.farmer && !this.farmer.hidden) entities.push({ critter: this.farmer, y: this.farmer.y + 2 });
		if (!glyph && this.pet && !this.pet.hidden) entities.push({ critter: this.pet, y: this.pet.y + 2 });
		entities.sort((a, b) => a.y - b.y);

		for (const e of entities) {
			if (e.critter) {
				world();
				this.drawInsect(ctx, e.critter);
				continue;
			}
			if (e.item) {
				const it = e.item, box = itemBox(it.kind, it.level);
				world();
				if (glyph) {
					ctx.fillStyle = 'rgba(122,84,52,0.9)';
					ctx.beginPath();
					ctx.roundRect(e.x - box.w * 0.3, e.y - box.h * 0.45, box.w * 0.6, box.h * 0.45, 4);
					ctx.fill();
					continue;
				}
				const built = this.t - (this.buildAt[it.id] ?? -9);
				if (built < BUILD_TIME + 0.45) {
					ctx.translate(e.x, e.y);
					this.drawBuilding(ctx, this.itemSprite(it.kind, it.rot, it), box, built);
					continue;
				}
				const age = this.t - (this.popAt[`item:${it.id}`] ?? -9);
				const k = age < 0.6 ? 0.7 + 0.3 * Math.min(1, age / 0.35) + 0.08 * Math.sin(Math.min(1, age / 0.6) * Math.PI) : 1;
				ctx.translate(e.x, e.y);
				ctx.scale(k, k);
				ctx.drawImage(this.itemSprite(it.kind, it.rot, it).canvas, -box.ax, -box.ay, box.w, box.h);
				continue;
			}
			if (e.decor) {
				const d = DECOR[e.decor], box = d.box;
				const age = this.t - (this.popAt[e.decor] ?? -9);
				const k = age < 0.8 ? 0.6 + 0.4 * Math.min(1, age / 0.5) + 0.06 * Math.sin(Math.min(1, age / 0.8) * Math.PI) : 1;
				world();
				ctx.translate(e.x, e.y);
				ctx.scale(k, k);
				ctx.globalAlpha = age < 0.5 ? age / 0.5 : 1;
				ctx.drawImage(this.decorSprite(e.decor).canvas, -box.ax, -box.ay, box.w, box.h);
				ctx.globalAlpha = 1;
				if (!glyph && (d.water || e.decor === 'nenuphars')) {
					// Le triton nage sous les nénuphars, le canard flotte par-dessus.
					world();
					const lilies = this.decorVisible('nenuphars');
					for (const b of this.insects) {
						if (!b.p.swim || b.ci !== 0) continue;
						const duck = b.kind === 'duck';
						if (duck ? e.decor === 'nenuphars' || !lilies : e.decor !== 'nenuphars') this.drawInsect(ctx, b);
					}
				}
				continue;
			}
			const p = e.plant;
			if (glyph) {
				// Vue d'ensemble : une forme simple par plante, à sa couleur.
				world();
				const g = Math.max(0.05, p.growth);
				const r = p.type === 'arbre' ? 8 + 68 * g : p.type === 'buisson' ? 8 + 34 * g : p.type === 'fleur' ? 7 : 6;
				ctx.fillStyle = rgba(this.glyphColor(p), p.type === 'herbe' ? 0.55 : 0.85);
				ctx.beginPath();
				ctx.ellipse(e.x, e.y - (p.type === 'arbre' ? r * 0.9 : r * 0.5), r, r * 0.8, 0, 0, Math.PI * 2);
				ctx.fill();
				continue;
			}
			const box = PLANT_TYPES[p.type].box;
			if (this.cam.z >= 1.6 && p.growth < 1) this.drawGrowth(ctx, e.x, e.y, p.growth, world);
			const s = this.spriteFor(p, false);
			if (!s) {
				// Pas encore peinte : une tache douce à sa couleur, le temps d'une ou deux images.
				world();
				ctx.fillStyle = rgba(this.glyphColor(p), 0.18);
				ctx.beginPath();
				ctx.ellipse(e.x, e.y - box.ay * 0.2, box.w * 0.14, box.ay * 0.16, 0, 0, Math.PI * 2);
				ctx.fill();
				continue;
			}
			const img = detail ? (this.spriteFor(p, true) ?? s) : s;
			const shear = this.wind(e.x) * SWAY[p.type] * (0.4 + 0.6 * (s.stage / STAGES));
			const age = this.t - (this.meta.get(p.id)?.pop ?? -9);
			const k = age < 0.45 ? 1 + 0.14 * Math.sin((age / 0.45) * Math.PI) : 1;
			world();
			ctx.translate(e.x, e.y);
			ctx.transform(k, 0, shear * k, k, 0, 0);
			ctx.drawImage(img.canvas, -box.ax, -box.ay, box.w, box.h);
		}

		// Animaux en l'air et particules
		world();
		if (!glyph) for (const b of this.insects) if (!onGround(b) && !b.p.swim) this.drawInsect(ctx, b);
		for (const p of this.particles) {
			ctx.globalAlpha = Math.max(0, p.life) * (p.puff ? 0.45 : 1);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;

		// Lumière de l'heure, de la saison et du temps
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (amb.a > 0.001) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.fillStyle = rgba(amb.color, amb.a);
			ctx.fillRect(0, 0, cw, ch);
		}
		const se = this.season ?? {};
		// Automne cuivré, hiver froid et bleuté, printemps à peine plus frais.
		const grade = [['#F2CFA8', 0.12 * (se.autumn ?? 0)], ['#CCD8EC', 0.16 * (se.winter ?? 0)], ['#EEF6DA', 0.05 * (se.spring ?? 0)]];
		ctx.globalCompositeOperation = 'multiply';
		for (const [c, a] of grade) if (a > 0.005) { ctx.fillStyle = rgba(c, a * day); ctx.fillRect(0, 0, cw, ch); }
		ctx.globalCompositeOperation = 'source-over';
		if (!glyph) this.drawSunlight(ctx, cw, ch, S, hour, day, wk);
		ctx.globalCompositeOperation = 'multiply';
		const grey = { overcast: 0.22, rain: 0.28, drizzle: 0.18, storm: 0.38, snow: 0.12, clouds: 0.08 }[wk] ?? 0;
		if (grey) {
			ctx.fillStyle = `rgba(130,140,152,${grey})`;
			ctx.fillRect(0, 0, cw, ch);
		}
		ctx.globalCompositeOperation = 'source-over';
		if (wk === 'snow' || (se.winter ?? 0) > 0.7) {
			ctx.fillStyle = `rgba(250,252,255,${wk === 'snow' ? 0.22 : 0.08})`;
			ctx.fillRect(0, 0, cw, ch);
		}
		if (wk === 'fog') {
			// Brouillard : un voile plus dense au loin (haut de l'écran), et deux couches de bancs qui glissent
			// à des vitesses différentes, pour qu'on sente la profondeur et que le jardin apparaisse par endroits.
			const g = ctx.createLinearGradient(0, 0, 0, ch);
			g.addColorStop(0, 'rgba(236,238,236,0.42)');
			g.addColorStop(1, 'rgba(236,238,236,0.12)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, cw, ch);
			this.fogLayer(ctx, cw, ch, S, 0.9, 1.1, 0, 5);
			this.fogLayer(ctx, cw, ch, S, 0.7, 2.2, 1, 9);
		}

		if (!glyph) { world(); this.drawAmbient(ctx, v); this.drawFlock(ctx, cw, ch); }

		// La nuit, les lanternes et la fenêtre de la cabane s'allument.
		if (!glyph && night > 0.05) {
			// Les lueurs se placent en pixels d'écran : on quitte le repère du monde (laissé par les moucherons).
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalCompositeOperation = 'lighter';
			const n = this.glow.width;
			for (const it of this.items) {
				const sp = this.itemSprite(it.kind, it.rot, it);
				if (sp.glow == null) continue;
				const x = (it.x + (sp.glowX ?? 0)) * S + tx, y = (it.y + sp.glow) * S + ty;
				if (x < -200 || x > cw + 200 || y < -200 || y > ch + 200) continue;
				const size = n * this.cam.z * 3.2, flicker = 0.85 + 0.15 * Math.sin(this.t * 1.7 + it.x);
				ctx.globalAlpha = Math.min(1, night * 1.2) * flicker;
				ctx.drawImage(this.glow, x - size / 2, y - size / 2, size, size);
				// Une flaque de lumière chaude sur l'herbe, au pied de la lanterne ou devant la fenêtre.
				const gx = x, gy = it.y * S + ty + 6 * S, w = size * 1.9, h = size * 0.6;
				ctx.globalAlpha = Math.min(1, night * 1.2) * flicker * 0.7;
				ctx.drawImage(this.glow, gx - w / 2, gy - h / 2, w, h);
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}

		// Lucioles (le ver luisant) la nuit, une fois l'espèce découverte et hors de la pluie.
		if (!glyph && night > 0 && this.state.species['ver-luisant'] && !this.precip()) {
			ctx.globalCompositeOperation = 'lighter';
			const n = this.glow.width;
			for (const f of this.fireflies) {
				ctx.globalAlpha = night * Math.pow(0.5 + 0.5 * Math.sin(this.t * 2 + f.ph), 2);
				ctx.drawImage(this.glow, f.x * cw - n / 2, f.y * ch - n / 2, n * this.cam.z, n * this.cam.z);
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}

		if (!glyph && this.dew?.length) { world(); this.drawDew(ctx); }
		if (!glyph && (this.jarAmount?.() ?? 0) >= 1) { world(); this.drawJarTags(ctx); }
		if (!glyph && this.farmer?.hidden) { world(); this.drawSmoke(ctx); }
		if (this.floats?.length) { world(); this.drawFloats(ctx); }

		if (this.ghost) {
			const { kind, x, y } = this.ghost, box = itemBox(kind, this.ghost.level), ok = this.canPlace(kind, x, y, this.lifted);
			world();
			ctx.globalAlpha = 0.6;
			ctx.drawImage(this.itemSprite(kind, this.ghost.rot, this.lifted?.kind === 'potager' ? null : this.lifted).canvas, x - box.ax, y - box.ay, box.w, box.h);
			ctx.globalAlpha = 1;
			ctx.strokeStyle = ok ? 'rgba(95,147,62,0.9)' : 'rgba(192,68,47,0.9)';
			ctx.lineWidth = 2.5 / this.cam.z;
			ctx.setLineDash([6 / this.cam.z, 5 / this.cam.z]);
			ctx.beginPath();
			ctx.ellipse(x, y, box.w * 0.42, box.w * 0.14, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = ok ? 'rgba(95,147,62,0.18)' : 'rgba(192,68,47,0.14)';
			ctx.fill();
		}

		world();
		this.drawWeather(ctx);
		if (wk === 'storm' && this.flash > 0) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = `rgba(255,255,250,${this.flash * 0.35})`;
			ctx.fillRect(0, 0, cw, ch);
		}

		// Grain de papier (attaché au monde) et vignette
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.paperPattern.setTransform(new DOMMatrix().translateSelf(Math.round(tx), Math.round(ty)));
		ctx.fillStyle = this.paperPattern;
		ctx.fillRect(0, 0, cw, ch);
		ctx.drawImage(this.vignette, 0, 0);

		if (glyph || this.lockedCells().length) this.drawLabels(ctx, glyph, S, tx, ty);
		this.drawNectarDrops(ctx, S, tx, ty);
	}

	/** Morceaux du bord d'une clairière qui ne sont pas couverts par une autre clairière ouverte. */
	outerRuns(i, others) {
		const pts = this.blob(i).pts;
		const out = pts.map(([x, y]) => !others.some(j => this.inBlob(this.blob(j), x, y, -2)));
		const runs = [];
		const start = out.findIndex(o => !o);
		if (start < 0) return [pts.concat([pts[0]])];
		let cur = null;
		for (let k = 1; k <= pts.length; k++) {
			const idx = (start + k) % pts.length;
			if (out[idx]) (cur ??= []).push(pts[idx]);
			else if (cur) { runs.push(cur); cur = null; }
		}
		if (cur) runs.push(cur);
		return runs;
	}

	/**
	 * Tracés de la clôture et des pointillés, calculés une fois (ils ne changent qu'à l'ouverture d'une parcelle) :
	 * morceaux de bord, piquets et points, chacun avec sa boîte pour ne dessiner que ce qui est à l'écran.
	 */
	edges() {
		const n = cellsOpen(this.place), key = `${this.biome}:${n}`;
		if (this.edgeCache?.key === key) return this.edgeCache;
		const open = this.openCells();
		const along = (run, step) => {
			const out = [];
			let acc = 0;
			for (let k = 1; k < run.length; k++) {
				const [x0, y0] = run[k - 1], [x1, y1] = run[k];
				const len = Math.hypot(x1 - x0, y1 - y0);
				for (let d = (step - acc) % step; d < len; d += step) out.push([x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len]);
				acc = (acc + len) % step;
			}
			return out;
		};
		const box = pts => {
			const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
			return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
		};
		const fence = [];
		for (const i of open) for (const run of this.outerRuns(i, open.filter(j => j !== i))) fence.push({ run, posts: along(run, FENCE_STEP), ...box(run) });
		const dots = [];
		for (const i of this.lockedCells()) for (const run of this.outerRuns(i, open)) dots.push(...along(run, 14));
		this.edgeCache = { key, fence, dots };
		return this.edgeCache;
	}

	/** Pointillés autour de la prochaine clairière, là où elle sort des clairières ouvertes. */
	drawNextOutline(ctx, v) {
		ctx.fillStyle = 'rgba(140,112,70,0.7)';
		const r = this.glyph ? 5 : 2.2;
		ctx.beginPath();
		for (const [x, y] of this.edges().dots) {
			if (x < v.x0 - 10 || x > v.x0 + v.w + 10 || y < v.y0 - 10 || y > v.y0 + v.h + 10) continue;
			ctx.moveTo(x + r, y);
			ctx.arc(x, y, r, 0, Math.PI * 2);
		}
		ctx.fill();
	}

	/** Clôture en bois sur le pourtour des clairières ouvertes : deux lisses et des piquets. */
	drawFence(ctx, v) {
		const glyph = this.glyph;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		const seen = this.edges().fence.filter(f => f.x1 > v.x0 - 30 && f.x0 < v.x0 + v.w + 30 && f.y1 > v.y0 - 40 && f.y0 < v.y0 + v.h + 30);
		const line = (run, dx, dy) => {
			ctx.moveTo(run[0][0] + dx, run[0][1] + dy);
			for (let k = 1; k < run.length; k++) ctx.lineTo(run[k][0] + dx, run[k][1] + dy);
		};
		ctx.strokeStyle = 'rgba(40,50,25,0.18)';
		ctx.lineWidth = glyph ? 10 : 5;
		ctx.beginPath();
		for (const f of seen) line(f.run, 3, 4);
		ctx.stroke();
		ctx.strokeStyle = '#9A7448';
		ctx.lineWidth = glyph ? 7 : 3;
		ctx.beginPath();
		for (const f of seen) { line(f.run, 0, 0); if (!glyph) line(f.run, 0, -8); }
		ctx.stroke();
		if (glyph) return;
		// Piquets : ombre, poteau, tête, chacun en un seul tracé.
		const posts = [];
		for (const f of seen) for (const [x, y] of f.posts) if (x > v.x0 - 10 && x < v.x0 + v.w + 10 && y > v.y0 - 30 && y < v.y0 + v.h + 10) posts.push([x, y]);
		ctx.fillStyle = 'rgba(40,50,25,0.2)';
		ctx.beginPath();
		for (const [x, y] of posts) { ctx.moveTo(x + 7, y + 3); ctx.ellipse(x + 3, y + 3, 4, 2, 0, 0, Math.PI * 2); }
		ctx.fill();
		ctx.fillStyle = '#8A6238';
		ctx.beginPath();
		for (const [x, y] of posts) ctx.roundRect(x - 3.2, y - 18, 6.4, 20, 2);
		ctx.fill();
		ctx.fillStyle = '#B48A58';
		ctx.beginPath();
		for (const [x, y] of posts) { ctx.moveTo(x + 3.2, y - 18); ctx.ellipse(x, y - 18, 3.2, 1.6, 0, 0, Math.PI * 2); }
		ctx.fill();
	}

	/** Étiquettes : en vue d'ensemble, chaque parcelle ; toujours, ce qu'il faut pour ouvrir la suivante. */
	drawLabels(ctx, all, S, tx, ty) {
		const dpr = this.dpr, place = this.place;
		const km = place.km ?? 0;
		ctx.textAlign = 'center';
		const cells = all ? [...this.openCells(), ...this.lockedCells()] : this.lockedCells();
		for (const i of cells) {
			const [ox, oy] = cellOrigin(i);
			const isOpen = i < cellsOpen(place);
			const title = zoneName(this.biome, i, PLACE_BY_ID[this.biome].name);
			const left = Math.max(0.1, Math.ceil((CELL_KM[i] - km) * 10) / 10);
			const sub = isOpen
				? `${place.plants.filter(p => cellOf(p) === i && p.growth >= 1).length} plantes`
				: `encore ${left.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km ici`;
			// Centre de la parcelle à l'écran ; une parcelle fermée garde son étiquette visible tant qu'on en voit un bout.
			const cw = this.canvas.width, ch = this.canvas.height;
			const sx0 = ox * S + tx, sx1 = (ox + PARCEL_W) * S + tx, sy0 = oy * S + ty, sy1 = (oy + PARCEL_H) * S + ty;
			ctx.font = `${Math.round((all ? 15 : 20) * dpr)}px Courgette, cursive`;
			// Un nom trop long pour la parcelle passe sur deux lignes.
			const room = (all ? sx1 - sx0 - 12 * dpr : cw - 40 * dpr);
			let lines = [title];
			if (ctx.measureText(title).width > room - 16 * dpr && title.includes(' ')) {
				const words = title.split(' ');
				let best = 1, bestW = Infinity;
				for (let k = 1; k < words.length; k++) {
					const wk = Math.max(ctx.measureText(words.slice(0, k).join(' ')).width, ctx.measureText(words.slice(k).join(' ')).width);
					if (wk < bestW) { bestW = wk; best = k; }
				}
				lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
			}
			const lh = (all ? 18 : 23) * dpr, extra = (lines.length - 1) * lh;
			const w = Math.min(room, Math.max(...lines.map(l => ctx.measureText(l).width), (all ? 70 : 130) * dpr) + (all ? 16 : 32) * dpr);
			let x = (sx0 + sx1) / 2, y = (sy0 + sy1) / 2;
			if (!all) {
				const seenW = Math.min(sx1, cw) - Math.max(sx0, 0), seenH = Math.min(sy1, ch) - Math.max(sy0, 0);
				// Parcelle hors de l'écran ou à peine visible : une petite flèche au bord, vers elle.
				if (seenW < w + 16 * dpr || seenH < 200 * dpr) {
					this.drawEdgeHint(ctx, sx0, sx1, sy0, sy1, `${left.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`);
					continue;
				}
				x = Math.max(Math.max(sx0, 0) + w / 2 + 8 * dpr, Math.min(Math.min(sx1, cw) - w / 2 - 8 * dpr, x));
				y = Math.max(Math.max(sy0, 0) + 140 * dpr, Math.min(Math.min(sy1, ch) - 260 * dpr, y));
			}
			ctx.fillStyle = isOpen ? 'rgba(253,247,231,0.92)' : 'rgba(243,237,217,0.95)';
			ctx.beginPath();
			ctx.roundRect(x - w / 2, y - 34 * dpr - extra / 2, w, 62 * dpr + extra, 16 * dpr);
			ctx.fill();
			ctx.fillStyle = isOpen ? '#1F6B47' : '#8A846E';
			lines.forEach((l, k) => ctx.fillText(l, x, y - 4 * dpr - extra / 2 + k * lh));
			ctx.font = `${Math.round((all ? 12 : 13) * dpr)}px Nunito, sans-serif`;
			ctx.fillStyle = isOpen ? '#5A6B4E' : '#8A846E';
			ctx.fillText(sub, x, y + 16 * dpr + extra / 2);
		}
	}

	/** Anneau de croissance au pied d'une plante qui pousse ; le pourcentage s'affiche de tout près. */
	drawGrowth(ctx, x, y, growth, world) {
		world();
		const r = 9;
		ctx.lineWidth = 2.2;
		ctx.strokeStyle = 'rgba(253,247,231,0.75)';
		ctx.beginPath(); ctx.arc(x, y + 6, r, 0, Math.PI * 2); ctx.stroke();
		ctx.strokeStyle = 'rgba(240,138,60,0.95)';
		ctx.beginPath(); ctx.arc(x, y + 6, r, -Math.PI / 2, -Math.PI / 2 + growth * Math.PI * 2); ctx.stroke();
		if (this.cam.z >= 2.2) {
			ctx.font = '700 7px Nunito, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillStyle = 'rgba(58,42,32,0.9)';
			ctx.fillText(`${Math.floor(growth * 100)}`, x, y + 8.5);
		}
	}

	/** Les gouttes de nectar : de la fleur (monde) au compteur du bandeau (écran), en courbe. */
	drawNectarDrops(ctx, S, tx, ty) {
		if (!this.nectarDrops.length) return;
		const [txs, tys] = this.nectarTarget().map(v => v * this.dpr);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		for (const d of this.nectarDrops) {
			// Une goutte butinée file vers son collecteur (dans le monde), une goutte récoltée vers la bourse (à l'écran).
			const [txs_, tys_] = d.to ? [d.to[0] * S + tx, d.to[1] * S + ty] : [txs, tys];
			const k = Math.min(1, d.t / d.dur), e = k * k * (3 - 2 * k);
			const sx = d.x * S + tx, sy = d.y * S + ty;
			const arc = d.to ? 0.4 : 1;
			const x = sx + (txs_ - sx) * e + Math.sin(k * Math.PI) * 40 * arc * this.dpr * Math.cos(d.wob);
			const y = sy + (tys_ - sy) * e - Math.sin(k * Math.PI) * 60 * arc * this.dpr;
			const r = (3.2 - 1.2 * k) * this.dpr;
			ctx.globalAlpha = k < 0.1 ? k * 10 : 1;
			ctx.fillStyle = 'rgba(244,194,62,0.35)';
			ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#F4C23E';
			ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = 'rgba(255,250,220,0.9)';
			ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/** Petite étiquette au bord de l'écran, tournée vers la prochaine parcelle hors de vue. */
	drawEdgeHint(ctx, sx0, sx1, sy0, sy1, text) {
		const dpr = this.dpr, cw = this.canvas.width, ch = this.canvas.height;
		const cx = (sx0 + sx1) / 2, cy = (sy0 + sy1) / 2;
		const right = sx0 >= cw * 0.6, left = sx1 <= cw * 0.4, below = sy0 >= ch * 0.6, above = sy1 <= ch * 0.4;
		const arrow = right ? '›' : left ? '‹' : below ? '⌄' : '⌃';
		const label = right ? `${text} ${arrow}` : `${arrow} ${text}`;
		ctx.font = `bold ${Math.round(13 * dpr)}px Nunito, sans-serif`;
		const w = ctx.measureText(label).width + 22 * dpr, h = 28 * dpr;
		const x = right ? cw - w / 2 - 8 * dpr : left ? w / 2 + 8 * dpr : Math.max(w / 2 + 8 * dpr, Math.min(cw - w / 2 - 8 * dpr, cx));
		// Sous le bouton œil (en haut à droite) : l'étiquette ne passe jamais dessous.
		const y = below ? ch - 230 * dpr : above ? 205 * dpr : Math.max(205 * dpr, Math.min(ch - 240 * dpr, cy));
		ctx.fillStyle = 'rgba(243,237,217,0.95)';
		ctx.beginPath();
		ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
		ctx.fill();
		ctx.strokeStyle = 'rgba(140,120,80,0.6)';
		ctx.lineWidth = 1.5 * dpr;
		ctx.setLineDash([2 * dpr, 4 * dpr]);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = '#7A5A30';
		ctx.textAlign = 'center';
		ctx.fillText(label, x, y + 5 * dpr);
	}

	drawInsect(ctx, b) {
		if (b.hidden) return;
		if (b.behavior === 'trail') return this.drawTrail(ctx, b);
		// Les butineurs laissent derrière eux un petit sillage en pointillés, qui dit leur vol en zigzag.
		if ((b.kind === 'bee' || b.kind === 'hoverfly' || b.kind === 'beefly') && b.mode !== 'perch' && b.mode !== 'home') {
			const tr = (b.trailPts ??= []);
			const last = tr[tr.length - 1];
			if (!last || Math.hypot(last[0] - b.x, last[1] - b.y) > 2.5) { tr.push([b.x, b.y]); if (tr.length > 16) tr.shift(); }
			if (tr.length > 3) {
				ctx.save();
				ctx.setLineDash([2.2, 3]);
				ctx.lineCap = 'round';
				ctx.lineWidth = 0.9;
				ctx.strokeStyle = 'rgba(90,80,60,0.22)';
				ctx.beginPath();
				ctx.moveTo(tr[0][0], tr[0][1]);
				for (let i = 1; i < tr.length - 1; i++) ctx.lineTo(tr[i][0], tr[i][1]);
				ctx.stroke();
				ctx.restore();
			}
		} else if (b.trailPts) b.trailPts.length = 0;
		ctx.save();
		ctx.translate(b.x, b.y);
		const k = CRITTER_SIZE[b.kind] ?? 1;
		ctx.scale((b.dir || 1) * k, k);
		if (b.kind === 'hare') b.winter = (this.season?.winter ?? 0) > 0.5;
		drawCritter(ctx, b.kind, b.t, b.mode, b.p, b);
		ctx.restore();
	}

	/** File de fourmis : la moitié va vers la nourriture, l'autre revient au nid. */
	drawTrail(ctx, b) {
		const [p0, p1, p2] = b.path;
		const at = s => {
			const u = 1 - s;
			return [u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]];
		};
		b.pos = [];
		for (let i = 0; i < b.n; i++) {
			const back = i % 2 === 1;
			let s = ((b.t * 0.035 + i / b.n) % 1 + 1) % 1;
			if (back) s = 1 - s;
			const [x, y] = at(s), [x2, y2] = at(Math.min(1, s + 0.01));
			const ang = Math.atan2(y2 - y, x2 - x) + (back ? Math.PI : 0);
			b.pos.push([x, y]);
			ctx.save();
			ctx.translate(x + Math.sin(b.t * 6 + i) * 0.6, y);
			ctx.rotate(ang);
			ctx.scale(CRITTER_SIZE.ant, CRITTER_SIZE.ant);
			drawCritter(ctx, 'ant', b.t + i);
			ctx.restore();
		}
	}

	/** Animal le plus proche d'un point du monde (pour le toucher du doigt). */
	critterAt(wx, wy) {
		let best = null, bestD = 16 / Math.min(1, this.cam.z);
		for (const b of this.insects) {
			const pts = b.behavior === 'trail' ? (b.pos ?? []) : [[b.x, b.y]];
			// Les oiseaux et les gros animaux se touchent plus facilement : leur corps dépasse leur point d'ancrage.
			const big = (CRITTER_SIZE[b.kind] ?? 1) >= 1.4 ? 1.6 : 1;
			for (const [x, y] of pts) {
				const d = Math.hypot(x - wx, (y - 6 * big) - wy) / big;
				if (d < bestD) { bestD = d; best = b; }
			}
		}
		return best;
	}
}
