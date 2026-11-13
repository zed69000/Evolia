// Le jardin : un terrain qui s'agrandit parcelle par parcelle quand on bouge, chaque parcelle dans son milieu
// (prairie, marais, forêt, montagne, littoral), une caméra libre avec zoom, trois niveaux de détail, les plantes, les animaux,
// le vent, les ombres et le ciel (heure, saison, météo).
// Coordonnées : chaque plante garde des coordonnées locales à sa parcelle (`c`, 0 par défaut) ;
// le monde les décale de l'origine de la parcelle (colonne × PARCEL_W, rangée × PARCEL_H).

import { rng, wash, rgba, mix, paperTexture, lerp, blurred } from './watercolor.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant, paintTurf, newVariant, lookOf, plantArt } from './plants.js';
import { drawCritter, CRITTER_SIZE, FLIGHT } from './critters.js';
import { GAIT, strideOf, HEN_LOOKS, drawFromSheet, loadSheets, SHEETS, sheetIdOf } from './beasts.js';
import { SPECIES, PLACE_BY_ID, speciesOf, unlocked } from './species.js';
import { PARCEL_W, PARCEL_H, CELLS, CELL_KM, GROUND, zoneOf, zoneName, tileSteps, tileSig, keepOut, cellIndexAt, riversIn } from './zones.js';
import { biomeOf, heartOf, rankOf, biomesIn } from './state.js';
import { makeWorld, worldBiome } from './world.js';
import { ITEMS, ITEM_PAINTERS, attracted, paintSoil, PLOT, paintAdorn, canLevel, itemBox, LINK, linkEnds, fitsPlace, seedBirds } from './deco.js';

export { PARCEL_W, PARCEL_H, CELLS, CELL_KM };
export const cellsOpen = place => Math.min(CELLS.length, place?.cells ?? 1);
// Où se trouve chaque parcelle sur la grille : les ouvertes dans l'ordre de leur ouverture (choisie par le joueur),
// puis leurs voisines encore fermées, qu'on peut acheter. Fixé par le jardin (syncLayout), une partie à la fois.
let LAYOUT = CELLS;
export const cellPos = i => LAYOUT[i] ?? CELLS[i] ?? [0, 0];
export const cellOrigin = i => { const [x, y] = cellPos(i); return [x * PARCEL_W, y * PARCEL_H]; };
const cellOf = p => p.c ?? 0;
/** Le nom d'une parcelle : le milieu pour son cœur (« Le marais »), puis ses coins (« La roselière »…). */
export function cellName(place, ci) {
	const b = biomeOf(place, ci);
	return zoneName(b, rankOf(place, ci), PLACE_BY_ID[b].name);
}
// La lisière de brume : jusqu'où elle s'épaissit.
const FOG_FAR = 480, FOG_MAX = 0.95;
// Combien de cases du sol gardées en détail (les autres, en version légère).
const HI_TILES = 9;
const STAGES = 30;
// Le vent dans la végétation : l'herbe et les fleurs ondulent, les arbustes frémissent, la couronne des arbres balance.
const SWAY = { herbe: 0.12, fleur: 0.09, buisson: 0.05, arbre: 0.05 };
const MIN_Y = { herbe: 60, fleur: 100, buisson: 100, arbre: 220 };
// Les arbres où le jardinier va cueillir, et la couleur de leurs fruits.
const FRUIT_TREES = { pommier: '#D8402E', poirier: '#C8B848', merisier: '#B0283A', prunier: '#6A3A7A' };
// Construire un objet : la durée, et les instants des coups de marteau.
const BUILD_TIME = 1.25, BUILD_TAPS = [0.2, 0.5, 0.8];
const smoothstep = k => k * k * (3 - 2 * k);

// ─── Le corps des bêtes : on regarde là où on va ───────────────────
// Une bête qui glisse de côté (« vol en crabe ») ressemble à un objet qu'on déplace, pas à un animal qui va
// quelque part. Le corps suit donc sa vitesse, avec un léger retard, penche dans les virages et ne se retourne
// pas d'un coup. Voir la fiche « ia-creatures-jeux ».
/** Bêtes dessinées vues de dessus : on les tourne vers leur vitesse (décalage = sens de la tête dans le dessin). */
const TOPDOWN = { butterfly: Math.PI / 2, moth: 0, dragonfly: 0, hoverfly: 0, beefly: 0, bat: 0, swallow: 0, eagle: Math.PI / 2, gull: Math.PI / 2, beetle: 0, ladybug: 0, firebug: 0, lizard: 0, snake: 0, spider: Math.PI / 2, crab: Math.PI / 2 };
/** Bêtes de profil qui lèvent ou piquent du nez selon qu'elles montent ou descendent (amplitude). */
const PITCH = { bee: 0.45, bird: 0.5, tit: 0.5, grasshopper: 0.6 };
/** Vivacité des virages (1/s) : plus c'est haut, plus la bête change vite de cap. */
const TURN = { butterfly: 6, moth: 7, bee: 9, hoverfly: 14, beefly: 12, dragonfly: 16, bat: 12, swallow: 8, bird: 6, tit: 7, owl: 4, eagle: 3, gull: 3 };
/** Modes où la bête ne bouge pas vraiment : elle garde son cap au lieu de suivre ses petits tremblements. */
const STILL = new Set(['perch', 'hover', 'sit']);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
// Les vieux arbres déjà là en arrivant (cœur du lieu, sur les bords pour laisser la place au milieu).
const OLD_TREES = {
	foret: [[55, 300], [365, 330], [40, 600], [385, 660], [60, 930], [360, 1000], [160, 1110], [250, 250]],
	montagne: [[60, 330], [370, 420], [345, 1010]],
	littoral: [[60, 900], [375, 1030]],
};
// L'eau des mares (décors), pour ses reflets : taille relative à la mare de la prairie.
const POND_SIZE = { pond: 1, bigpond: 1.65, mare2: 1, mare3: 1.15 };
const POND_PADS = [[40, -10], [58, 10], [-60, 14], [-20, 24], [10, -26]];
/** Un nombre stable tiré d'un nom et d'un créneau : pour tirer au sort sans que ça clignote. */
const idHash = (id, slot) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261 ^ slot) >>> 0;
/**
 * Guilde d'un animal (d'après le guide naturaliste) : sert à limiter combien on en voit à la fois, et à savoir
 * qui hiberne. Places par guilde pour une parcelle à l'écran (davantage quand on en voit plusieurs).
 */
const guildOf = c => {
	const k = c.kind, b = c.behavior;
	if (['roe', 'fox', 'boar', 'badger', 'deer', 'chamois'].includes(k)) return 'grands';
	if (['hare', 'rabbit', 'squirrel', 'marmot'].includes(k)) return 'rongeurs';
	if (k === 'bat') return 'chauves-souris';
	if (k === 'swallow') return 'hirondelles';
	if (k === 'owl') return 'rapaces-nuit';
	if (k === 'eagle' || (k === 'gull' && b === 'soar')) return 'planeurs';
	if (k === 'bird' || k === 'tit') return 'oiseaux';
	if (k === 'heron' || k === 'duck') return 'eau';
	if (k === 'frog' || (k === 'lizard' && b === 'pond')) return 'amphibiens';
	if (k === 'lizard' || k === 'snake') return 'reptiles';
	if (k === 'dragonfly' && b === 'water') return 'libellules';
	if (k === 'butterfly' || (k === 'moth' && b === 'flutter')) return 'papillons';
	if (b === 'flower') return 'butineurs';
	if (k === 'grasshopper') return 'criquets';
	if (k === 'mouse' || k === 'weasel' || k === 'hedgehog') return 'petits-mammiferes';
	if (k === 'snail' || k === 'worm') return 'escargots';
	return 'petites-betes';
};
const GUILD_ROOM = { hirondelles: 2, grands: 1, rongeurs: 2, 'chauves-souris': 2, 'rapaces-nuit': 1, planeurs: 1, oiseaux: 3, eau: 3, amphibiens: 3, reptiles: 1, libellules: 3, papillons: 3, butineurs: 6, criquets: 3, 'petits-mammiferes': 1, escargots: 2, 'petites-betes': 3 };
const FIXED_ROOM = new Set(['grands', 'planeurs', 'hirondelles', 'rapaces-nuit']);
const SLEEPS = new Set(['chauves-souris', 'amphibiens', 'reptiles', 'libellules', 'papillons', 'butineurs', 'criquets', 'escargots', 'petites-betes']);
const SHEET_READY = b => !!SHEETS[sheetIdOf(b)];
const FLYERS = new Set(['bee', 'butterfly', 'dragonfly', 'hoverfly', 'beefly', 'bat', 'moth']);
// Niveaux de détail selon le zoom : formes simples, aquarelle, aquarelle détaillée.
const GLYPH_Z = 0.5, DETAIL_Z = 1.6, DETAIL_DENSITY = 2.2;
// En dessous de ce zoom, des pastilles signalent ce qui attend (collecteur, œufs, potager mûr, gouttes) ;
// les toucher ramène la vue dessus.
const POI_Z = 0.85, POI_ZOOM = 1.4;
// Une parcelle s'ouvre à cette fraction de sa taille ; on l'agrandit d'un cran à chaque achat, jusqu'à sa taille pleine.
export const CELL_START = 0.4, CELL_STEP = 0.15;
// La caméra ne repart toute seule qu'après ce temps sans aucun geste (toucher, glisser, zoomer, bouton).
const CAM_IDLE_MS = 20000;
const Z_MAX = 3.2;

const DEFAULT_SUN = { rise: 7.5, set: 19 };

function ambientAt(h, sun) {
	// La nuit reste lisible : on voit encore son jardin, sous un bleu profond.
	const N = ['#1E2B4D', 0.44], DAWN = ['#F2B880', 0.25], DAY = ['#FFFFFF', 0], GOLD = ['#F4A85E', 0.25], DUSK = ['#6E5A8E', 0.4];
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
	[-90, '#1E2B4D', 0.46], [-12, '#1E2B4D', 0.46], [-6, '#3E4A7E', 0.42], [-2, '#8A6A9E', 0.42],
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

/** Trois vues pour tout objet qui se tourne : de face, de 3/4 droite, de 3/4 gauche (moins de dessins, on s'y retrouve). */
export const TURN_VIEWS = [0, 45, 315];
export function snapRot(kind, rot) {
	const r = ((rot % 360) + 360) % 360;
	return TURN_VIEWS.reduce((best, v) => (Math.min(Math.abs(v - r), 360 - Math.abs(v - r)) < Math.min(Math.abs(best - r), 360 - Math.abs(best - r)) ? v : best), 0);
}

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
		// Les feuilles de sprites peintes à la main, s'il y en a (sinon les personnages sont dessinés en code).
		loadSheets();
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
		this.active = 0;
		// La case du sol en (gx, gy) : son milieu et son rang (voir zones.js).
		this.at = (gx, gy) => this.tileAt(gx, gy);
		this.cam = { cx: PARCEL_W / 2, cy: PARCEL_H * 0.42, z: 1 };

		this.ensurePlace();
		this.tidyPlants();
		this.resize();
		new ResizeObserver(() => this.resize()).observe(canvas);
		this.bindInput();
		this.last = performance.now();
		requestAnimationFrame(this.frame);
	}

	// ─── Lieu et parcelles ─────────────────────────────────────────

	get place() { return this.state.places[this.state.place]; }

	/** Le milieu d'une parcelle. */
	biomeOf(ci) { return biomeOf(this.place, ci); }
	/** La parcelle cœur d'un milieu (ses mares, ses vieux arbres, ses décors), ou -1. */
	heart(biome) { return heartOf(this.place, biome); }
	/** Le coin d'une parcelle (null pour un cœur). */
	zoneAt(ci) { return zoneOf(this.biomeOf(ci), rankOf(this.place, ci)); }

	/**
	 * La case du sol en (gx, gy) : le milieu de sa parcelle, et son rang parmi celles de ce milieu. Hors du jardin
	 * (et pour la prochaine parcelle, encore dans la brume), la campagne sauvage du milieu ouvert le plus proche.
	 */
	tileAt(gx, gy) {
		// Appelée des centaines de milliers de fois en préparant le sol : on ne refait la signature (une chaîne) que si
		// le terrain a changé (parcelles ouvertes, leurs milieux, la disposition).
		const n = cellsOpen(this.place), bs = this.place.biomes ?? [], m = this.tileMemo;
		let same = m && m.n === n && m.layout === this.layoutSig && m.bs.length === Math.min(n, bs.length);
		if (same) for (let i = 0; i < m.bs.length; i++) if (m.bs[i] !== bs[i]) { same = false; break; }
		if (!same) {
			const sig = `${bs.slice(0, n).join(',')}|${this.layoutSig}`;
			if (m?.sig === sig) Object.assign(m, { n, layout: this.layoutSig, bs: bs.slice(0, n) });
			else this.tileMemo = { sig, map: new Map(), n, layout: this.layoutSig, bs: bs.slice(0, n) };
		}
		const k = `${gx},${gy}`;
		let t = this.tileMemo.map.get(k);
		if (t) return t;
		const ci = LAYOUT.findIndex(([x, y]) => x === gx && y === gy);
		if (ci >= 0 && ci < n) t = { biome: this.biomeOf(ci), rank: rankOf(this.place, ci) };
		// Au-delà de la clôture, rien ne dit ce qui attend : la campagne du milieu ouvert le plus proche. On découvre
		// la mare ou la forêt en explorant la parcelle.
		else {
			let best = 0, bd = Infinity;
			for (let j = 0; j < n; j++) { const [cx, cy] = cellPos(j), d = Math.hypot(cx - gx, (cy - gy) * 1.2); if (d < bd) { bd = d; best = j; } }
			t = { biome: this.biomeOf(best), rank: -1 };
		}
		this.tileMemo.map.set(k, t);
		return t;
	}

	/** Le premier jardin : quelques plantes de départ ; puis le caractère de chaque milieu déjà là. */
	/**
	 * Le plan du jardin : les parcelles ouvertes (dans leur ordre d'ouverture), puis toutes leurs voisines libres du
	 * monde, qu'on peut acheter pour agrandir. Le monde est tiré une fois par partie.
	 */
	syncLayout() {
		const place = this.place, n = cellsOpen(place);
		// Une partie déjà commencée garde son jardin tel quel (pas de côte au nord, parcelles entières).
		place.world ??= makeWorld(Math.floor(Math.random() * 1e9), n > 1 || !!place.seeded);
		place.layout ??= CELLS.slice(0, n).map(c => [...c]);
		while (place.layout.length < n) place.layout.push([...CELLS[place.layout.length]]);
		const open = place.layout, seen = new Set(open.map(p => p.join(','))), front = [];
		if (n < CELLS.length) {
			for (const [x, y] of open) {
				for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
					const gx = x + dx, gy = y + dy, k = `${gx},${gy}`;
					if (seen.has(k) || Math.abs(gx) > 8 || Math.abs(gy) > 8 || worldBiome(place.world, gx, gy) === 'sea') continue;
					seen.add(k);
					front.push([gx, gy]);
				}
			}
		}
		front.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
		const lay = [...open, ...front], sig = lay.map(p => p.join(',')).join(';');
		if (sig === this.layoutSig) return;
		this.layoutSig = sig;
		LAYOUT = lay;
		this.tileMemo = null;
		this.edgeCache = null;
	}

	/** Le milieu que le monde réserve à une parcelle (ouverte ou non) ; la mer compte comme du littoral. */
	worldBiomeAt(i) {
		const b = worldBiome(this.place.world, ...cellPos(i));
		return b === 'sea' ? 'littoral' : b;
	}

	/** Achète la parcelle voisine `i` : elle devient la suivante du jardin, dans le milieu que lui donne le monde. */
	openAt(i, biome = this.worldBiomeAt(i)) {
		const place = this.place, n = cellsOpen(place);
		if (i < n) return i;
		place.layout = [...place.layout.slice(0, n), [...cellPos(i)]];
		this.syncLayout();
		this.openCell(n, biome);
		this.syncLayout();
		return n;
	}

	/** La mer, en haut des parcelles du littoral qui longent la côte. */
	seaTop(ci) {
		const y = cellPos(ci)[1], w = this.place.world;
		return this.biomeOf(ci) === 'littoral' && (w?.seaRow != null ? y === w.seaRow : y === 0);
	}

	ensurePlace() {
		this.syncLayout();
		const place = this.place;
		// Pendant l'introduction, la motte reste nue : c'est l'oiseau qui apporte la première graine.
		if (this.state.intro) return;
		if (!place.seeded && !place.plants.length) this.seedStarterGarden(this.biomeOf(0), 0);
		place.seeded = true;
		for (const b of biomesIn(place)) this.renewBiome(b);
	}

	/**
	 * Le caractère d'un milieu dès son arrivée dans le jardin : la forêt a déjà ses vieux arbres, la montagne ses
	 * mélèzes, la dune ses pins. Ajouté une seule fois, dans sa parcelle cœur ; rien ne reste dans l'eau des mares.
	 */
	renewBiome(biome) {
		const place = this.place, ci = this.heart(biome);
		if (ci < 0) return;
		if (typeof place.renewed !== 'object') place.renewed = place.renewed ? { prairie: 1 } : {};
		if (place.renewed[biome]) return;
		place.renewed[biome] = 1;
		const here = place.plants.filter(p => cellOf(p) === ci);
		for (const [x, y] of OLD_TREES[biome] ?? []) {
			if (here.some(p => Math.hypot(p.x - x, (p.y - y) * 1.25) < 70)) continue;
			this.spawn(this.state.place, 'arbre', 1, { x, y }, ci);
		}
		const ponds = Object.values(DECOR).filter(d => d.place === biome && d.always && d.rad);
		place.plants = place.plants.filter(p => cellOf(p) !== ci || !ponds.some(d => Math.hypot(p.x - d.x, (p.y - d.y) * 1.25) < d.rad));
	}

	/** Les plantes d'une ancienne version restées hors des clairières reviennent à l'intérieur. */
	tidyPlants() {
		for (const p of this.place.plants) {
			const ci = cellOf(p), [ox, oy] = cellOrigin(ci);
			if (ci >= cellsOpen(this.place) || (this.inBlob(this.blob(ci), ox + p.x, oy + p.y, 10) && !keepOut(this.at, ox + p.x, oy + p.y))) continue;
			const pos = this.place_(this.state.place, p.type, ci);
			p.x = Math.round(pos.x); p.y = Math.round(pos.y);
		}
		for (const it of this.place.items ?? []) this.clearUnder(it);
	}

	openCells() {
		return Array.from({ length: cellsOpen(this.place) }, (_, i) => i);
	}

	/** La prochaine parcelle, dans la brume, avec les kilomètres qu'il reste à faire ici pour l'ouvrir. */
	lockedCells() {
		const n = cellsOpen(this.place);
		return Array.from({ length: Math.max(0, LAYOUT.length - n) }, (_, k) => n + k);
	}

	cellAt(wx, wy) {
		const gx = Math.floor(wx / PARCEL_W), gy = Math.floor(wy / PARCEL_H);
		return LAYOUT.findIndex(([x, y]) => x === gx && y === gy);
	}

	/**
	 * Une nouvelle parcelle s'ouvre dans le milieu choisi. La première d'un milieu en est le cœur : son premier jardin,
	 * ses vieux arbres, ses mares. Les suivantes arrivent avec les plantes de leur coin, pour avoir tout de suite leur caractère.
	 */
	openCell(i, biome = 'prairie') {
		const place = this.place;
		(place.biomes ??= ['prairie'])[i] = biome;
		(place.cellSize ??= {})[i] = CELL_START;
		place.cells = Math.max(cellsOpen(place), i + 1);
		this.syncLayout();
		if (this.heart(biome) === i) {
			(place.heartKm ??= {})[biome] = place.km ?? 0;
			this.seedStarterGarden(biome, i);
			this.renewBiome(biome);
		} else {
			const start = this.zoneAt(i)?.start ?? [['herbe', 5, 1], ['fleur', 2, 1]];
			// Une parcelle est grande : on double les herbes et on ajoute moitié plus de fleurs, pour qu'elle ne paraisse jamais vide.
			const more = { herbe: 2, fleur: 1.5 };
			for (const [type, count, growth] of start) {
				for (let k = 0; k < Math.round(count * (more[type] ?? 1)); k++) this.spawn(this.state.place, type, growth, this.place_(this.state.place, type, i), i);
			}
		}
		const [ox, oy] = cellOrigin(i);
		this.burst(ox + PARCEL_W / 2, oy + PARCEL_H * 0.4, 30, '#F4C23E');
	}

	// ─── Clairières : chaque parcelle est une forme ronde ou ovale, un peu bosselée ; elles se fondent entre elles.

	/** Forme d'une parcelle : ovale tiré au hasard (mais toujours le même pour cette parcelle), bord ondulé. */
	/**
	 * Une parcelle commence petite (le terrain du début, pour qu'on s'y attache) : 40 % de sa taille à l'ouverture.
	 * Elle ne grandit que si on l'agrandit (en nectar, un cran de 15 % à la fois). Les parcelles d'avant sont entières.
	 */
	cellScale(ci) {
		const place = this.place, s = place.cellSize?.[ci] ?? (ci === 0 && !place.world?.legacy ? CELL_START : 1);
		return Math.round(Math.min(1, s) * 20) / 20;
	}

	/** Agrandit la parcelle d'un cran ; renvoie sa nouvelle taille. */
	growCell(ci) {
		const place = this.place, s = Math.min(1, this.cellScale(ci) + CELL_STEP);
		(place.cellSize ??= {})[ci] = s;
		const [ox, oy] = cellOrigin(ci);
		this.burst(ox + PARCEL_W / 2, oy + PARCEL_H / 2, 24, '#8BC34A');
		return s;
	}

	/** La taille de chaque clairière ouverte, pour savoir quand redessiner leur pourtour. */
	scaleSig() { return this.openCells().map(i => this.cellScale(i)).join(','); }

	blob(ci) {
		// La forme tient à la place sur la grille (les anciennes parcelles gardent exactement la leur) ; sa taille
		// suit les kilomètres faits depuis son ouverture.
		const [gx, gy] = cellPos(ci), sc = ci < cellsOpen(this.place) ? this.cellScale(ci) : 1, key = `${gx},${gy},${sc}`;
		let b = this.blobs.get(key);
		if (b) return b;
		const old = CELLS.findIndex(([x, y]) => x === gx && y === gy);
		const r = rng(7 + 7 * 97 + (old >= 0 ? old : 1000 + (gx + 50) * 131 + (gy + 50)) * 53);
		const [ox, oy] = cellOrigin(ci);
		b = {
			cx: ox + PARCEL_W / 2 + r.range(-20, 20), cy: oy + PARCEL_H / 2 + r.range(-40, 40),
			rx: PARCEL_W * r.range(0.76, 0.88), ry: PARCEL_H * r.range(0.53, 0.57), rot: r.range(-0.1, 0.1),
			waves: [[2, r.range(0.04, 0.08), r() * 6.28], [3, r.range(0.03, 0.06), r() * 6.28], [5, r.range(0.01, 0.025), r() * 6.28], [7, r.range(0.005, 0.012), r() * 6.28]],
		};
		// Vers les parcelles voisines (haut, bas, côtés), le bord ne rentre jamais : les clairières se rejoignent toujours.
		b.ry *= 1.02 / Math.min(1.02, this.blobRadius(b, Math.PI / 2), this.blobRadius(b, -Math.PI / 2));
		b.rx *= 1.02 / Math.min(1.02, this.blobRadius(b, 0), this.blobRadius(b, Math.PI));
		b.rx *= sc;
		b.ry *= sc;
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
		z = Math.max(this.zMin(), Math.min(Z_MAX, z));
		// En paysage, le panneau couvre la droite de l'écran : le point visé se place au centre de ce qui reste visible.
		this.camTarget = { cx: cx + (this.insetRight ?? 0) / 2 / (this.base * z), cy, z };
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

	/**
	 * `show` : on montre exprès le jardin qui pousse (pas relus à l'ouverture) ; la caméra suit tout de suite chaque
	 * plante, jusqu'au prochain geste. Sinon elle ne suit que ce qui se voit vraiment et attend qu'on ne fasse plus rien.
	 */
	setFollow(on, show = false) {
		this.following = on;
		this.followShow = show;
		this.followed = null;
		if (show) this.lastTouch = -Infinity;
		if (!on) this.camTarget = null;
	}

	/** Plus aucun geste depuis un moment ? */
	idle() { return performance.now() - (this.lastTouch ?? 0) >= CAM_IDLE_MS; }

	/** La caméra peut-elle partir d'elle-même ? Jamais pendant qu'on agit, ni quand on regarde la carte de loin. */
	autoCam() { return this.idle() && !this.camLock?.() && !this.camBusy?.() && this.cam.z >= POI_Z; }

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
	/** La clé d'une case en cache (sa signature de terrain), gardée tant que le terrain ne change pas. */
	tileKey(gx, gy) {
		// Gardée tant que le terrain ne change pas (même signature) : la signature d'une case lit ses 9 voisines.
		this.tileAt(gx, gy);
		if (this.keyMemo?.sig !== this.tileMemo.sig) this.keyMemo = { sig: this.tileMemo.sig, keys: new Map() };
		const k = `${gx},${gy}`, keys = this.keyMemo.keys;
		let key = keys.get(k);
		if (!key) keys.set(k, key = `${tileSig(this.at, gx, gy)}:${gx},${gy}`);
		return key;
	}

	tileFor(gx, gy, lo = false) {
		const key = this.tileKey(gx, gy);
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
		const key = `${this.tileKey(gx, gy)}${lo ? ':lo' : ''}`;
		const queued = this.tileJobs.get(key);
		if (queued) { queued.want = this.t; return; }
		const D = this.density * (lo ? 0.4 : 1);
		const c = document.createElement('canvas');
		c.width = Math.ceil(PARCEL_W * D);
		c.height = Math.ceil(PARCEL_H * D);
		const g = c.getContext('2d');
		g.scale(D, D);
		// Les étapes de peinture se préparent au premier tour de travail (environ 20 ms par case) : vu de loin, une
		// soixantaine de cases demandées d'un coup figeaient l'écran plus d'une seconde.
		const season = this.season;
		this.tileJobs.set(key, { key, c, g, steps: null, make: () => tileSteps(this.at, gx, gy, col => this.groundColor(col), season), i: 0, lo, at: this.t, want: this.t });
	}

	/** Avance la peinture des cases en attente, sans dépasser `ms` millisecondes par image. */
	workTiles(ms) {
		if (!this.tileJobs.size) return;
		const end = performance.now() + ms;
		// Les versions légères d'abord, puis les plus anciennes demandes.
		const jobs = [...this.tileJobs.values()].sort((a, b) => (b.lo - a.lo) || (a.at - b.at));
		for (const job of jobs) {
			// Une case qu'on ne regarde plus (on a zoomé ou glissé ailleurs) n'est plus peinte : elle le sera si on y revient.
			if (job.want < this.t - 0.5) { this.tileJobs.delete(job.key); continue; }
			if (!job.steps) { job.steps = job.make(); if (performance.now() > end) return; }
			while (job.i < job.steps.length) {
				job.steps[job.i++](job.g);
				if (performance.now() > end) return;
			}
			this.tileJobs.delete(job.key);
			this.bgs.set(job.key, { canvas: job.c, used: this.t });
		}
	}

	/** Garde en mémoire au plus HI_TILES cases détaillées et 30 légères (ou plus : toujours toutes celles à l'écran,
	 * sinon un grand jardin vu de loin repeignait sans fin les cases qu'il venait de jeter). */
	trimTiles() {
		const seen = this.tilesSeen ?? 0;
		if (this.bgs.size < Math.max(30, seen + 8)) return;
		const hi = [], lo = [];
		for (const [k, t] of this.bgs) (k.endsWith(':lo') ? lo : hi).push([k, t.used]);
		for (const [list, max] of [[hi, Math.max(HI_TILES, seen + 2)], [lo, Math.max(30, seen + 8)]]) {
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
		// Vu de loin, et au tout début de l'introduction (la motte de terre seule au milieu du papier) : un papier crème
		// uni. On passe de la brume au papier (et retour) en fondu, jamais d'un coup.
		const want = this.glyph || (this.state.intro && this.cellScale(0) < 0.3) ? 1 : 0;
		const now = performance.now(), dt = Math.min(0.1, (now - (this.paperT ?? now)) / 1000);
		this.paperT = now;
		this.paperK = this.paperK == null ? want : this.paperK + (want - this.paperK) * Math.min(1, dt * 2.2);
		if (Math.abs(this.paperK - want) < 0.01) this.paperK = want;
		const pk = this.paperK, world2 = g => g.setTransform(S, 0, 0, S, cw / 2 - this.cam.cx * S, ch / 2 - this.cam.cy * S);
		const mk = this.gardenMask();
		// La brume d'une forme de jardin : voile, bancs qui dérivent, clairières découpées, nuages du bord.
		const fogInto = (g, rim, mk) => {
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.globalCompositeOperation = 'source-over';
			g.fillStyle = `rgba(247,248,246,${FOG_MAX})`;
			g.fillRect(0, 0, cw, ch);
			world2(g);
			g.globalCompositeOperation = 'destination-out';
			g.drawImage(rim.haze, rim.x0, rim.y0, rim.x1 - rim.x0, rim.y1 - rim.y0);
			g.globalCompositeOperation = 'source-over';
			g.setTransform(1, 0, 0, 1, 0, 0);
			this.fogLayer(g, cw, ch, S, 0.6, 1, 0);
			world2(g);
			g.globalCompositeOperation = 'destination-out';
			// Au littoral de la première rangée, la mer reste nette : la brume s'efface au-dessus du rivage.
			for (const ci of this.openCells()) {
				if (!this.seaTop(ci)) continue;
				const fade = g.createLinearGradient(0, 120, 0, 190), [ox] = cellOrigin(ci);
				fade.addColorStop(0, 'rgba(0,0,0,0.85)');
				fade.addColorStop(1, 'rgba(0,0,0,0)');
				g.fillStyle = fade;
				g.fillRect(ox, -1e5, PARCEL_W, 1e5 + 190);
			}
			// Tout l'intérieur du jardin, poches entre les clairières comprises, au bord déjà fondu.
			g.drawImage(mk.canvas, mk.x0, mk.y0, mk.canvas.width / mk.k, mk.canvas.height / mk.k);
			// Les nuages du bord, posés après : leurs volutes débordent un peu sur les clairières et dessinent la lisière.
			g.globalCompositeOperation = 'source-over';
			g.drawImage(rim.cloud, rim.x0, rim.y0, rim.x1 - rim.x0, rim.y1 - rim.y0);
		};
		if (pk < 1) {
			const rim = this.fogRim();
			// Le jardin change de forme (il s'agrandit) : l'ancienne brume s'efface en fondu, rien ne saute.
			if (this.fogLast && this.fogLast.mk.key !== mk.key) this.fogPrev = { ...this.fogLast, t0: now };
			this.fogLast = { rim, mk };
			fogInto(m, rim, mk);
			const age = this.fogPrev ? (now - this.fogPrev.t0) / 1400 : 1;
			if (age < 1) {
				if (!this.fogCv || this.fogCv.width !== cw || this.fogCv.height !== ch) {
					this.fogCv = document.createElement('canvas');
					this.fogCv.width = cw; this.fogCv.height = ch;
				}
				const f = this.fogCv.getContext('2d');
				f.setTransform(1, 0, 0, 1, 0, 0);
				f.globalCompositeOperation = 'source-over';
				f.clearRect(0, 0, cw, ch);
				fogInto(f, this.fogPrev.rim, this.fogPrev.mk);
				m.setTransform(1, 0, 0, 1, 0, 0);
				m.globalCompositeOperation = 'source-over';
				m.globalAlpha = 1 - age * age * (3 - 2 * age);
				m.drawImage(this.fogCv, 0, 0);
				m.globalAlpha = 1;
			} else this.fogPrev = null;
		}
		if (pk > 0) {
			// Le papier, peint à part puis posé par-dessus avec son fondu.
			if (!this.paperCv || this.paperCv.width !== cw || this.paperCv.height !== ch) {
				this.paperCv = document.createElement('canvas');
				this.paperCv.width = cw; this.paperCv.height = ch;
			}
			const q = this.paperCv.getContext('2d');
			q.setTransform(1, 0, 0, 1, 0, 0);
			q.globalCompositeOperation = 'source-over';
			q.clearRect(0, 0, cw, ch);
			q.fillStyle = 'rgb(241,236,220)';
			q.fillRect(0, 0, cw, ch);
			this.fogLayer(q, cw, ch, S, 0.35, 1, 0, 0);
			world2(q);
			q.globalCompositeOperation = 'destination-out';
			q.drawImage(mk.canvas, mk.x0, mk.y0, mk.canvas.width / mk.k, mk.canvas.height / mk.k);
			m.setTransform(1, 0, 0, 1, 0, 0);
			m.globalCompositeOperation = 'source-over';
			m.globalAlpha = pk;
			m.drawImage(this.paperCv, 0, 0);
			m.globalAlpha = 1;
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
		const key = `${open.join(',')}|${this.scaleSig()}`;
		if (this.maskCache?.key === key) return this.maskCache;
		const k = 1 / 8, pad = FOG_FAR + 200;
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
		const inside = Uint8Array.from(outside, o => 1 - o);
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.putImageData(img, 0, 0);
		// Bord fondu : la forme est adoucie avant d'être agrandie.
		const soft = document.createElement('canvas');
		soft.width = W; soft.height = H;
		const sg = soft.getContext('2d');
		blurred(sg, 5, '#000', b => b.drawImage(c, 0, 0));
		return (this.maskCache = { key, canvas: soft, x0, y0, x1, y1, k, W, H, inside });
	}

	/**
	 * La lisière du jardin : un brouillard peint à l'aquarelle, au lieu d'une clôture. Léger au bord des clairières
	 * (on devine la campagne dessous), de plus en plus dense en s'éloignant ; sur le pourtour, de gros nuages aux bords
	 * marqués, comme des lavis posés sur le papier. Peint une fois par forme du jardin.
	 */
	fogRim() {
		const mk = this.gardenMask();
		if (this.rimCache?.key === mk.key) return this.rimCache;
		const { W, H, inside, k } = mk, x0m = mk.x0, y0m = mk.y0;
		// Distance au jardin (en cases de la forme basse résolution), en deux passes.
		const D = new Float32Array(W * H);
		for (let j = 0; j < W * H; j++) D[j] = inside[j] ? 0 : 1e9;
		const S2 = Math.SQRT2;
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			const j = y * W + x;
			if (x > 0) D[j] = Math.min(D[j], D[j - 1] + 1);
			if (y > 0) D[j] = Math.min(D[j], D[j - W] + 1, x > 0 ? D[j - W - 1] + S2 : 1e9, x < W - 1 ? D[j - W + 1] + S2 : 1e9);
		}
		for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
			const j = y * W + x;
			if (x < W - 1) D[j] = Math.min(D[j], D[j + 1] + 1);
			if (y < H - 1) D[j] = Math.min(D[j], D[j + W] + 1, x < W - 1 ? D[j + W + 1] + S2 : 1e9, x > 0 ? D[j + W - 1] + S2 : 1e9);
		}
		// 1. L'éclaircie : le brouillard est dense partout, sauf près du jardin, où il s'éclaircit d'après la distance.
		// Hors de cette image, l'éclaircie vaut zéro : pas de raccord entre la zone peinte et le reste.
		const haze = document.createElement('canvas');
		haze.width = W; haze.height = H;
		const hg = haze.getContext('2d'), img = hg.createImageData(W, H);
		for (let j = 0; j < W * H; j++) {
			const t = Math.min(1, D[j] / k / FOG_FAR), fog = inside[j] ? 0 : 0.26 + 0.68 * t * t * (3 - 2 * t);
			img.data[j * 4 + 3] = (1 - fog / FOG_MAX) * 255;
		}
		hg.putImageData(img, 0, 0);
		// La prochaine parcelle, à demi dégagée, au bord fondu (pas de trait net dans la brume).
		const next = document.createElement('canvas');
		next.width = W; next.height = H;
		const ng = next.getContext('2d');
		ng.setTransform(k, 0, 0, k, -x0m * k, -y0m * k);
		blurred(ng, 7 / k, '#000', b => { for (const i of this.lockedCells()) { b.beginPath(); this.tracePath(b, this.blob(i)); b.fill(); } });
		// 2. Les nuages, plus finement : en bordure du jardin, poussés vers l'extérieur ; plus loin, de grands lavis épars.
		const kb = 1 / 4, x0 = mk.x0, y0 = mk.y0;
		const cloud = document.createElement('canvas');
		cloud.width = Math.ceil((mk.x1 - x0) * kb); cloud.height = Math.ceil((mk.y1 - y0) * kb);
		const g = cloud.getContext('2d'), r = rng(9090);
		g.setTransform(kb, 0, 0, kb, -x0 * kb, -y0 * kb);
		// Les volutes : d'abord toutes les ombres bleutées (le dessous des nuages), puis tous les blancs par-dessus,
		// un peu plus petits et remontés. Les nuages se fondent en une seule masse, avec un liseré bleuté en bas.
		const lobes = [];
		// Sur le pourtour : des lobes de tailles et d'écarts variés, parfois en grappe, parfois un trou.
		for (const f of this.edges().fence) {
			const run = f.run;
			for (let i = 1; i < run.length; i++) {
				const [ax, ay] = run[i - 1], [bx, by] = run[i], L = Math.hypot(bx - ax, by - ay) || 1;
				let nx = -(by - ay) / L, ny = (bx - ax) / L;
				for (let d = r() * 60; d < L; d += r.range(45, 140)) {
					const px = ax + ((bx - ax) * d) / L, py = ay + ((by - ay) * d) / L;
					if (this.inOpen(px + nx * 40, py + ny * 40)) { nx = -nx; ny = -ny; }
					if (r() < 0.15) continue;
					const n = r() < 0.3 ? 2 + Math.floor(r() * 2) : 1;
					for (let q = 0; q < n; q++) {
						// Le centre reste dehors ; le bord vient mordre un peu sur la clairière.
						const big = r() < 0.2, rad = big ? r.range(160, 240) : r.range(60, 140), out = rad * r.range(0.5, 1.1) + q * 40;
						lobes.push([px + nx * out + r.gauss() * 30, py + ny * out + r.gauss() * 22, rad, big ? r.range(0.3, 0.45) : r.range(0.4, 0.62), r.range(0.6, 0.85)]);
					}
				}
			}
		}
		// Plus loin, de grands lobes épars : la brume n'est jamais tout à fait plate.
		for (let i = 0; i < 160; i++) {
			const x = x0 + r() * (mk.x1 - x0), y = y0 + r() * (mk.y1 - y0);
			const j = Math.floor((y - y0) * k) * W + Math.floor((x - x0) * k);
			// Seulement dans la brume qui s'épaissit, et jamais près du bord de l'image (un lobe coupé y ferait un trait net).
			const rad = r.range(150, 300);
			if (!(D[j] / k > 220 && D[j] / k < FOG_FAR) || x - rad < x0 || x + rad > mk.x1 || y - rad < y0 || y + rad > mk.y1) continue;
			lobes.push([x, y, rad, r.range(0.2, 0.4), r.range(0.55, 0.8)]);
		}
		const blot = (x, y, rr, sy, col, al) => {
			const grd = g.createRadialGradient(x, y, 0, x, y, rr);
			grd.addColorStop(0, `rgba(${col},${al})`);
			grd.addColorStop(0.6, `rgba(${col},${al * 0.75})`);
			grd.addColorStop(1, `rgba(${col},0)`);
			g.fillStyle = grd;
			g.save();
			g.translate(x, y); g.scale(1, sy); g.translate(-x, -y);
			g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
			g.restore();
		};
		// Sous les volutes, une bande de brume continue tout le long du bord : les nuages s'y posent au lieu de flotter seuls.
		blurred(g, 110, 'rgba(250,251,250,0.55)', b => {
			b.lineWidth = 150;
			b.lineCap = b.lineJoin = 'round';
			for (const f of this.edges().fence) { b.beginPath(); f.run.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y))); b.stroke(); }
		});
		for (const [x, y, rad, a, sy] of lobes) blot(x + rad * 0.05, y + rad * 0.22, rad, sy, '184,200,214', a * 0.7);
		for (const [x, y, rad, a, sy] of lobes) blot(x, y - rad * 0.05, rad * 0.88, sy, '253,253,251', a);
		return (this.rimCache = { key: mk.key, haze, next, cloud, x0, y0, x1: mk.x1, y1: mk.y1, k, kb });
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

	/** Un premier jardin composé à la main pour chaque milieu, dans sa parcelle cœur : jamais un terrain vide. */
	seedStarterGarden(pid, ci = 0) {
		const starters = {
			prairie: { herbe: [[70, 470], [115, 520], [300, 420], [345, 560], [210, 640], [80, 690], [265, 740], [190, 500]], fleur: [[140, 440, 1], [172, 470, 1], [120, 480, 0.3]], arbre: [[310, 330, 0.08]] },
			marais: { herbe: [[50, 330], [370, 340], [40, 770], [380, 700], [300, 820], [140, 820]], fleur: [[330, 370, 1], [80, 740, 1], [360, 760, 0.3]] },
			foret: { herbe: [[70, 420], [340, 460], [200, 620], [90, 700], [330, 700]], fleur: [[120, 470, 1], [150, 500, 1], [300, 520, 0.3]], arbre: [[260, 300, 0.08]] },
			montagne: { herbe: [[80, 480], [140, 540], [300, 470], [360, 600], [220, 660]], fleur: [[200, 520, 1], [230, 545, 1]], arbre: [[90, 330, 0.08]] },
			littoral: { herbe: [[60, 420], [120, 470], [300, 450], [360, 520], [200, 560], [80, 640]], fleur: [[240, 480, 1], [150, 600, 0.3]], arbre: [[330, 760, 0.08]] },
		}[pid];
		for (const [type, list] of Object.entries(starters)) for (const [x, y, g = 1] of list) this.spawn(this.state.place, type, g, { x, y }, ci);
	}

	/** Pas de plante dans la mer, en haut des parcelles du littoral de la première rangée. */
	minY(pid, type, ci = 0) {
		return MIN_Y[type] + (this.seaTop(ci) ? 240 : 0);
	}

	/** Trouve une place libre dans une parcelle ; si elle est pleine, on serre un peu les plantes. */
	place_(pid, type, ci = 0, around = null) {
		const place = this.state.places[pid];
		const sp = PLANT_TYPES[type].spacing;
		const here = place.plants.filter(p => cellOf(p) === ci);
		const obstacles = [
			...here.map(p => ({ x: p.x, y: p.y, rad: PLANT_TYPES[p.type].spacing })),
			...Object.values(DECOR).filter(d => d.rad && this.heart(d.place) === ci).map(d => ({ x: d.x, y: d.y, rad: d.rad })),
			...(place.items ?? []).map(it => ({ x: it.x - cellOrigin(ci)[0], y: it.y - cellOrigin(ci)[1] - itemBox(it.kind, it.level).ay * 0.3, rad: itemBox(it.kind, it.level).w * 0.5 })),
		];
		const same = here.filter(p => p.type === type);
		const feet = (place.items ?? []).map(it => this.footprint(it));
		const y0 = this.minY(pid, type, ci), H = PARCEL_H;
		let best = { x: PARCEL_W / 2, y: H / 2, gap: -Infinity }, bestScore = -Infinity;
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
			if (!this.inBlob(this.blob(ci), wx, wy, type === 'arbre' ? 50 : 26)) continue;
			if (keepOut(this.at, wx, wy, type === 'arbre' ? 30 : 8)) continue;
			// Jamais sous un objet ni juste derrière lui (une ruche, un nichoir cachent ce qui pousse dans leur dos).
			if (feet.some(f => wx > f.x0 - sp * 0.5 && wx < f.x1 + sp * 0.5 && wy > f.y0 - sp * 0.3 && wy < f.y1 + sp * 0.4)) continue;
			let gap = Infinity;
			for (const o of obstacles) gap = Math.min(gap, Math.hypot(o.x - x, (o.y - y) * 1.25) - o.rad - sp);
			// Les petites plantes se regroupent en touffes ; les arbres cherchent de l'espace.
			const score = (gap >= 0 ? 1000 : gap) + (near ? 30 : 0) + (type === 'arbre' || type === 'buisson' ? Math.min(gap, 40) : 0) + Math.random() * 20;
			if (score > bestScore) { bestScore = score; best = { x, y, gap }; }
		}
		return best;
	}

	spawn(pid, type, growth = 0, pos = this.place_(pid, type), ci = 0) {
		const p = {
			id: uid(), type, x: Math.round(pos.x), y: Math.round(pos.y), growth, ...(ci ? { c: ci } : {}),
			seed: Math.floor(Math.random() * 2147483647), variant: newVariant(type, this.biomeOf(ci), this.state.species, this.zoneAt(ci)?.favor), born: Date.now(),
		};
		this.state.places[pid].plants.push(p);
		return p;
	}

	/** Ajoute de l'effort à la plante en cours de ce type ; plante une graine si besoin, là où il en manque le plus. */
	addEffort(type, amount, pid = this.state.place, follow = true) {
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
			if (follow) this.followed = sown;
			if (sown.growth >= 1) { events.push({ kind: 'mature', plant: sown, pid }); this.succeed(pid, sown, events); }
		}
		let p = place.plants.find(q => q.type === type && q.growth < 1);
		while (amount > 1e-6) {
			if (!p) {
				const spot = this.roomFor(pid, type);
				if (spot) {
					p = this.spawn(pid, type, 0, spot.pos, spot.ci);
					events.push({ kind: 'seed', plant: p, pid });
				} else if (type === 'fleur') {
					// Plus de place libre : la plus ancienne fleur fane et refleurit sur place, sans se serrer contre les autres.
					p = place.plants.filter(q => q.type === 'fleur' && !q.intro && q.growth >= 1).sort((a, b) => (a.born ?? 0) - (b.born ?? 0))[0];
					if (!p) break;
					p.growth = 0.35; p.born = Date.now();
					this.meta?.delete?.(p.id);
				} else break;
			}
			const used = Math.min((1 - p.growth) * cost, amount);
			p.growth = Math.min(1, p.growth + used / cost);
			amount -= used;
			if (follow) this.current = p;
			// L'herbe et les fleurs poussent sans cesse : la caméra ne se déplace que pour un arbuste ou un arbre.
			if (follow && (p.type === 'buisson' || p.type === 'arbre')) this.followed = p;
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
		// Nouvelles parties : arbustes et arbres ne sont semés que par les oiseaux (nichoirs, mangeoires). Plus il y en a,
		// plus ils sèment souvent, et plus de jeunes pousses à la fois.
		const byBirds = this.state.eco2 && next.type !== 'fleur', birds = byBirds ? seedBirds(place) : 0;
		const every = byBirds ? Math.max(2, next.every - Math.floor(birds / 2) - Math.floor((this.sowBonus ?? 0) / 2)) : next.every;
		if (place.succ[parent.type] < every) return;
		if (byBirds && !birds) {
			// Prêt à porter un arbuste ou un arbre, mais aucun oiseau pour le semer : on le dit au joueur (main.js).
			place.succ[parent.type] = 0;
			place.noBirds = (place.noBirds ?? 0) + 1;
			events.push({ kind: 'nobird', type: next.type, pid });
			return;
		}
		place.succ[parent.type] = 0;
		// Pas plus de deux jeunes pousses semées qui attendent de grandir, par étage (plus, avec beaucoup d'oiseaux).
		if (place.plants.filter(q => q.sown && q.type === next.type && q.growth < 1).length >= 2 + Math.floor(birds / 4)) return;
		const ci = cellOf(parent);
		// Les oiseaux sèment autour de leur nichoir ou de leur mangeoire (s'il y en a un dans cette parcelle) :
		// c'est là, près d'eux, que viendront arbustes et arbres. Placer ses nichoirs, c'est choisir où pousse la forêt.
		const nests = byBirds ? this.itemsIn(ci, ['nichoir', 'mangeoire']) : [];
		const home = nests.length ? pick(nests) : null, [cx0, cy0] = cellOrigin(ci);
		let pos = this.place_(pid, next.type, ci, home ? { x: home.x - cx0, y: home.y - cy0 + 30 } : parent), cs = ci;
		// Plus de place près du nid : les oiseaux portent la graine plus loin, là où il y a de la place ; nulle part, elle ne lève pas.
		if (pos.gap < -PLANT_TYPES[next.type].spacing * 0.2) {
			const spot = this.roomFor(pid, next.type);
			if (!spot) return;
			pos = spot.pos; cs = spot.ci;
		}
		const nest = byBirds && place.items.some(it => it.kind === 'nichoir');
		const by = nest && Math.random() < 0.5 ? 'une mésange' : pick(next.by[this.biomeOf(ci)] ?? next.by.default);
		const p = this.spawn(pid, next.type, next.start, pos, cs);
		p.sown = by;
		events.push({ kind: 'sown', plant: p, pid, by });
		{
			const [ox, oy] = cellOrigin(cs);
			this.burst(ox + p.x, oy + p.y - 6, 8);
		}
	}

	/**
	 * Parcelle où planter la prochaine graine d'un type : celle qui en manque le plus, pour que toutes se remplissent
	 * en gardant leurs proportions ; un coin accueille plus volontiers son type favori, la parcelle regardée passe un peu devant.
	 */
	/** Une place libre pour une nouvelle plante : d'abord la parcelle qui en manque le plus, sinon une autre qui a de
	 * la place. null si toutes sont pleines (l'herbe, elle, trouve toujours sa place : une pelouse peut être dense). */
	roomFor(pid, type) {
		// Jardin plein : on ne refait la recherche (coûteuse avec des centaines de plantes) qu'une fois sur 12.
		this.full ??= {};
		const key = pid + type;
		if (this.full[key] > 0) { this.full[key]--; return null; }
		const found = this.roomFor_(pid, type);
		if (!found) this.full[key] = 12;
		return found;
	}
	roomFor_(pid, type) {
		const first = this.cellFor(pid, type), sp = PLANT_TYPES[type].spacing, ok = pos => type === 'herbe' || pos.gap >= -sp * 0.2;
		let pos = this.place_(pid, type, first);
		if (ok(pos)) return { pos, ci: first };
		const n = cellsOpen(this.state.places[pid]);
		for (let k = 1; k < n; k++) {
			const ci = (first + k) % n;
			pos = this.place_(pid, type, ci);
			if (ok(pos)) return { pos, ci };
		}
		return null;
	}

	cellFor(pid, type) {
		const place = this.state.places[pid];
		const n = cellsOpen(place);
		const want = { herbe: 14, fleur: 10, buisson: 4, arbre: 2.5 }[type];
		let best = 0, bestScore = Infinity;
		for (let ci = 0; ci < n; ci++) {
			const have = place.plants.filter(q => cellOf(q) === ci && q.type === type).length;
			const zone = this.zoneAt(ci);
			const likes = zone && zone.start.some(([t]) => t === type) ? 1.6 : 1;
			const score = have / (want * likes) - (ci === this.active ? 0.15 : 0) + Math.random() * 0.05;
			if (score < bestScore) { bestScore = score; best = ci; }
		}
		return best;
	}

	/** Fait pousser un lieu, affiché ou non, sans déplacer la plante suivie à l'écran. */
	growIn(pid, type, amount) {
		// Pendant l'introduction, rien ne pousse tout seul : seule la fleur de l'oiseau grandit, avec les pas.
		if (this.state.intro) return [];
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
			const box = plantArt(p);
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
		rot = ITEMS[kind].turn ? snapRot(kind, rot) : 0;
		// Au jardin, une parcelle de potager se peint sans sa terre (posée au sol), et ses légumes suivent leur pousse.
		const bed = kind === 'potager' && it ? { stage: Math.floor(this.bedStage(it) * 6) / 6, seed: plotSeed(it) } : null;
		// Le collecteur montre son niveau de nectar (par dixièmes) et son niveau d'amélioration.
		const js = kind === 'collecteur' && it ? this.jarStock?.(it) : null;
		const jar = kind === 'collecteur' && it ? { fill: js ? Math.round(Math.min(1, js.v / Math.max(1, js.cap)) * 10) / 10 : 0, level: it.level ?? 1 } : null;
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

	/**
	 * Peut-on poser cet objet ici : dans une clairière ouverte, dans un milieu où il a sa place, pas dans l'eau
	 * ni sur un sentier, pas sur un autre objet.
	 */
	/** Le centre d'une parcelle, ouverte ou non. */
	cellCenter(i) {
		const [ox, oy] = cellOrigin(i);
		return [ox + PARCEL_W / 2, oy + PARCEL_H / 2];
	}

	/** Coin haut-gauche de la parcelle d'une plante. */
	cellOriginOf(p) { return cellOrigin(cellOf(p)); }

	/** Replante une plante adulte au point (x, y) du monde : elle change de parcelle si besoin. */
	replant(p, x, y) {
		const ci = this.cellAt(x, y), [ox, oy] = cellOrigin(ci);
		p.c = ci;
		p.x = Math.round(x - ox);
		p.y = Math.round(y - oy);
		// En le reposant, l'arbre s'écrase un peu puis se redresse, et perd quelques feuilles.
		this.replantAt = { id: p.id, t: this.t };
		// Les feuilles partent du feuillage : vers le haut de l'arbre (ou de l'arbuste).
		const big = p.type === 'arbre', color = this.glyphColor(p), box = PLANT_TYPES[p.type].box, hx = x, hy = y - box.ay * (big ? 0.62 : 0.45);
		for (let i = 0; i < (big ? 12 : 7); i++) {
			this.particles.push({
				x: hx + (Math.random() - 0.5) * (big ? 60 : 30), y: hy + (Math.random() - 0.3) * (big ? 40 : 18),
				vx: (Math.random() - 0.5) * 30, vy: -8 - Math.random() * 18, life: 1, decay: 0.32 + Math.random() * 0.2,
				size: 3.4 + Math.random() * 2.2, color, leaf: true, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 5, ph: Math.random() * 6.28,
			});
		}
	}

	/** Le cadre de ce qu'on déplace : un objet, ou un arbre (arbuste) qu'on replante ailleurs. */
	ghostBox(kind, level, plant) {
		return kind === 'plant' ? PLANT_TYPES[plant.type].box : itemBox(kind, level);
	}

	/** Un arbre ou un arbuste adulte peut-il être replanté ici ? Dans une clairière ouverte, hors de l'eau et des
	 * chemins, loin des objets et à bonne distance des autres arbres et arbustes. */
	canPlacePlant(p, x, y) {
		const sp = PLANT_TYPES[p.type].spacing, ci = this.cellAt(x, y);
		if (ci < 0 || ci >= cellsOpen(this.place) || !this.inOpen(x, y, sp * 0.3) || keepOut(this.at, x, y, sp * 0.3)) return false;
		for (const key of Object.keys(DECOR)) {
			const d = DECOR[key], pos = d.rad && this.decorVisible(key) && this.decorPos(key);
			if (pos && Math.hypot(pos.x - x, (pos.y - y) * 1.25) < d.rad * 0.8 + sp * 0.3) return false;
		}
		for (const q of this.place.plants) {
			if (q === p || (q.type !== 'arbre' && q.type !== 'buisson')) continue;
			const [ox, oy] = cellOrigin(cellOf(q));
			if (Math.hypot(ox + q.x - x, (oy + q.y - y) * 1.3) < (sp + PLANT_TYPES[q.type].spacing) * 0.45) return false;
		}
		return !this.items.some(it => Math.hypot(it.x - x, (it.y - y) * 1.3) < sp * 0.4 + itemBox(it.kind, it.level).w * 0.35);
	}

	canPlace(kind, x, y, except = null) {
		if (kind === 'plant') return this.canPlacePlant(except, x, y);
		// Une parcelle n'accueille qu'un nombre limité de chaque habitat (main.js le règle).
		if (this.placeLimit && !this.placeLimit(kind, this.cellAt(x, y), except)) return false;
		const r = itemBox(kind, except?.level).w * 0.35;
		if (!this.inOpen(x, y, r * 0.6) || keepOut(this.at, x, y, r * 0.5)) return false;
		if (!fitsPlace(kind, this.biomeAtWorld(x, y))) return false;
		// Pas dans une mare ni sur un décor (vieux tronc, muret, éboulis…).
		for (const key of Object.keys(DECOR)) {
			const d = DECOR[key], pos = d.rad && this.decorVisible(key) && this.decorPos(key);
			if (pos && Math.hypot(pos.x - x, (pos.y - y) * 1.25) < d.rad * 0.8 + r) return false;
		}
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
			if (Math.hypot(it.x - x, (it.y - y) * 1.3) < r + itemBox(it.kind, it.level).w * 0.35) return true;
			// Pas juste devant un autre objet au point de le cacher (ni juste derrière un grand qui le cacherait) :
			// la cabane posée devant le collecteur le rendait invisible.
			const mine = itemBox(kind, except?.level), theirs = itemBox(it.kind, it.level);
			const front = y > it.y ? mine : theirs, dy = Math.abs(y - it.y);
			return Math.abs(it.x - x) < (mine.w + theirs.w) * 0.3 && dy < front.ay * 0.55;
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

	/** Œufs prêts à ramasser au poulailler : chaque poule en pond un et demi par kilomètre, trois au plus en attente. */
	eggsOf(it) {
		const hens = it.flock?.hens ?? 3;
		return Math.max(0, Math.min(hens * 3, Math.floor((this.state.totals.distance / 1000 - (it.km0 ?? 0)) * hens * Tuning.num('poulailler.oeufs_par_km', 1.5))));
	}

	/** Pousse des légumes d'une parcelle (0 → 1) : ils mûrissent en 2,5 km parcourus. */
	bedStage(it) {
		return Math.max(0, Math.min(1, (this.state.totals.distance / 1000 - (it.km0 ?? 0)) / Tuning.num('potager.km_maturite', 2.5)));
	}

	placeItem(kind, x, y, rot = 0) {
		const it = { id: uid(), kind, x: Math.round(x), y: Math.round(y), rot, at: Date.now(), ...(kind === 'potager' || kind === 'poulailler' || kind === 'compost' ? { km0: this.state.totals.distance / 1000 } : {}), ...(kind === 'poulailler' ? { flock: { hens: 3, roosters: 1 } } : {}) };
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
			const pos = this.place_(this.state.place, p.type, ci);
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

	/** Un décor est là quand son milieu a sa parcelle cœur dans le jardin (et, sauf les mares du marais, après quelques km). */
	decorVisible(key) {
		const d = DECOR[key];
		return this.heart(d.place) >= 0 && (d.always || !!this.place.unlocked?.[key]);
	}

	/** Où est un décor dans le monde : ses coordonnées sont celles de la parcelle cœur de son milieu. */
	decorPos(key) {
		const d = DECOR[key], ci = this.heart(d.place);
		if (ci < 0) return null;
		const [ox, oy] = cellOrigin(ci);
		return { x: ox + d.x, y: oy + d.y };
	}

	/** Le milieu en un point du monde (celui de la parcelle où il tombe). */
	biomeAtWorld(x, y) {
		const ci = this.cellAt(x, y);
		return ci >= 0 && ci < cellsOpen(this.place) ? this.biomeOf(ci) : this.tileAt(Math.floor(x / PARCEL_W), Math.floor(y / PARCEL_H)).biome;
	}

	/** Montre un décor qui vient d'apparaître. */
	reveal(key) {
		const pos = this.decorPos(key);
		if (!pos) return;
		this.popAt[key] = this.t;
		this.burst(pos.x, pos.y - 20, 24, '#F4C23E');
		if (this.autoCam()) this.focusOn(pos.x, pos.y);
	}

	/** Va voir un décor, à la demande. */
	showDecor(key) {
		const pos = this.decorPos(key);
		if (pos) this.focusOn(pos.x, pos.y);
	}

	/**
	 * Une goutte de nectar part d'une fleur butinée vers le collecteur le plus proche (seulement quand on regarde de près).
	 * Elle ne va jamais à la bourse : la récolte attend qu'on la ramasse. Sans collecteur, elle perle sur les fleurs.
	 */
	nectarFrom(x, y) {
		// Nouvelle économie : les butineurs ne déposent plus de nectar ; elles le rapportent à la ruche, en miel.
		if (this.state.eco2 || this.cam.z < 1 || this.t - (this.lastDrop ?? -9) < 0.7) return;
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
		const amount = this.glyph || this.state.intro ? 0 : (this.dewAmount?.() ?? 0);
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

	// ─── L'eau qui vit ─────────────────────────────────────────────

	/** Le courant des ruisseaux : de petits reflets clairs qui glissent vers l'aval, à leur rythme. */
	drawStreams(ctx, v, gx0, gx1, gy0, gy1) {
		const t = this.t;
		ctx.save();
		ctx.lineCap = 'round';
		for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
			for (const r of riversIn(this.at, gx, gy)) {
				if (r.x1 < v.x0 || r.x0 > v.x0 + v.w || r.y1 < v.y0 || r.y0 > v.y0 + v.h) continue;
				const w = r.r * 0.55, gap = 38;
				let acc = (t * 26 + r.seed % 97) % gap;
				for (let k = 1; k < r.pts.length; k++) {
					const [x0, y0] = r.pts[k - 1], [x1, y1] = r.pts[k], L = Math.hypot(x1 - x0, y1 - y0) || 1;
					const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
					for (; acc < L; acc += gap) {
						const x = x0 + ux * acc, y = y0 + uy * acc, side = Math.sin(x * 0.13 + y * 0.07) * w * 0.45;
						const fade = 0.25 + 0.2 * Math.sin(t * 2 + x * 0.05);
						ctx.strokeStyle = `rgba(240,250,250,${fade})`;
						ctx.lineWidth = 1.4;
						ctx.beginPath();
						ctx.moveTo(x - uy * side - ux * 5, y + ux * side - uy * 5);
						ctx.lineTo(x - uy * side + ux * 5, y + ux * side + uy * 5);
						ctx.stroke();
					}
					acc -= L;
				}
			}
		}
		ctx.restore();
	}

	/** Une mare vit : des éclats de lumière qui dérivent, et de temps en temps un rond dans l'eau (un insecte, une goutte). */
	pondLife(ctx, s, seed) {
		const t = this.t, rx = 62 * s, ry = 26 * s;
		ctx.save();
		ctx.lineCap = 'round';
		for (let i = 0; i < 4; i++) {
			const ph = i * 1.7 + seed * 0.01;
			const x = Math.sin(t * 0.25 + ph) * rx * 0.7, y = Math.cos(t * 0.19 + ph * 1.3) * ry * 0.6 - 4 * s;
			const a = Math.max(0, 0.35 * Math.sin(t * 1.3 + ph * 2));
			ctx.strokeStyle = `rgba(255,255,250,${a})`;
			ctx.lineWidth = 1.3;
			ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.lineTo(x + 7 * s, y); ctx.stroke();
		}
		for (let i = 0; i < 2; i++) {
			// `seed` (l'abscisse de la mare) peut être négatif : le cycle reste toujours entre 0 et 1.
			const cyc = t * 0.35 + i * 0.5 + (Math.abs(seed) % 7) * 0.13, k = ((cyc % 1) + 1) % 1, n = Math.floor(cyc);
			const x = Math.sin(n * 12.9 + i * 4.1 + seed) * rx * 0.6, y = Math.cos(n * 7.3 + i * 2.7) * ry * 0.5 - 4 * s;
			ctx.strokeStyle = `rgba(240,250,248,${(1 - k) * 0.45})`;
			ctx.lineWidth = 1;
			ctx.beginPath(); ctx.ellipse(x, y, 3 + k * 16 * s, (3 + k * 16 * s) * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
		}
		ctx.restore();
	}

	/** Les gouttes qui attendaient sur les fleurs filent vers un collecteur qui a de nouveau de la place. */
	dewToJar(it, share = 1) {
		const n = Math.ceil((this.dew?.length ?? 0) * Math.min(1, share));
		for (const d of (this.dew ?? []).splice(0, n)) {
			for (let k = 0; k < 2; k++) this.nectarDrops.push({ x: d.x, y: d.y, t: -k * 0.12 - Math.random() * 0.4, dur: 1.1 + Math.random() * 0.4, wob: Math.random() * 6.28, to: [it.x, it.y - 50] });
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
		const cab = this.homeCabin();
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
		const z = Math.max(1, 1.2 / this.cam.z);
		ctx.font = `800 ${13}px Nunito, sans-serif`;
		for (const it of this.items) {
			if (it.kind !== 'collecteur') continue;
			const js = this.jarStock?.(it) ?? { v: 0, cap: 1 };
			// Un collecteur vide n'a pas d'étiquette : « +0 » au-dessus d'une jarre neuve ne disait rien.
			if (js.v < 1) continue;
			const amount = Math.floor(js.v), full = js.v >= js.cap - 0.5, label = full ? `${amount} · plein !` : `+${amount}`;
			ctx.font = `800 ${13}px Nunito, sans-serif`;
			const w = ctx.measureText(label).width + 30, h = 22;
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

	/**
	 * Ce qui mérite qu'on y aille, vu de loin : collecteurs qui ont du nectar, poulaillers avec des œufs (le
	 * jardinier les ramassera), potagers mûrs, gouttes de nectar à cueillir (par parcelle). Coordonnées du monde.
	 */
	poiList() {
		// Recalculée quatre fois par seconde : vue de loin, la liste parcourt tout le jardin.
		if (this.poiMemo && this.t - this.poiMemo.t < 0.25 && this.t >= this.poiMemo.t) return this.poiMemo.list;
		const list = [...(this.state.mapFilter?.harvest === false ? [] : this.poiHarvest()), ...(this.mapExtras?.() ?? [])];
		this.poiMemo = { t: this.t, list };
		return list;
	}

	/** Le filtre « Récoltes » : ce qui attend d'être ramassé. */
	poiHarvest() {
		const out = [];
		for (const it of this.items) {
			if (it.kind === 'collecteur') {
				const js = this.jarStock?.(it) ?? { v: 0, cap: 1 };
				if (js.v >= 1) out.push({ x: it.x, y: it.y - 60, icon: '🍯', label: `+${Math.floor(js.v)}`, hot: js.v >= js.cap - 0.5, rank: js.v >= js.cap - 0.5 ? 3 : 2 });
			} else if (it.kind === 'poulailler') {
				const n = this.eggsOf(it);
				if (n >= 1) out.push({ x: it.x, y: it.y - 50, icon: '🥚', label: `${n}`, rank: 1, eggs: n });
			} else if (it.kind === 'potager' && this.bedStage(it) >= 1) out.push({ x: it.x, y: it.y - 20, icon: '🥕', label: 'mûr', rank: 1 });
		}
		const drops = new Map();
		for (const d of this.dew ?? []) {
			const ci = this.cellAt(d.x, d.y), g = drops.get(ci) ?? { x: 0, y: 0, n: 0 };
			g.x += d.x; g.y += d.y; g.n++;
			drops.set(ci, g);
		}
		for (const g of drops.values()) out.push({ x: g.x / g.n, y: g.y / g.n - 30, icon: '💧', label: `${g.n}`, rank: 2 });
		return out;
	}

	/** Les pastilles à l'écran, regroupées quand elles se chevauchent ; gardées pour le toucher. */
	drawPOI(ctx, S, tx, ty) {
		const dpr = this.dpr, R = 18 * dpr, groups = [];
		for (const p of this.poiList().sort((a, b) => b.rank - a.rank)) {
			const sx = p.x * S + tx, sy = p.y * S + ty;
			// Les étiquettes sont larges : on regroupe plus loin à l'horizontale, pour qu'elles ne se chevauchent pas.
			const g = groups.find(q => Math.hypot((q.sx - sx) / 2.4, q.sy - sy) < R * 2.2);
			if (g) { g.items.push(p); continue; }
			groups.push({ sx, sy, items: [p] });
		}
		this.poiHits = [];
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const bob = Math.sin(this.t * 2.4) * 2 * dpr;
		for (const g of groups) {
			const p = g.items[0], many = g.items.length > 1, sx = g.sx, sy = g.sy - R - 6 * dpr + bob;
			// Une pastille ronde, sa pointe vers l'objet, l'icône et ce qui attend.
			ctx.fillStyle = 'rgba(40,30,10,0.18)';
			ctx.beginPath(); ctx.ellipse(g.sx, g.sy + 2 * dpr, R * 0.5, R * 0.18, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = p.hot ? '#E87028' : '#FDF7E7';
			ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
			ctx.beginPath(); ctx.moveTo(sx - 6 * dpr, sy + R - 3 * dpr); ctx.lineTo(sx, sy + R + 7 * dpr); ctx.lineTo(sx + 6 * dpr, sy + R - 3 * dpr); ctx.fill();
			ctx.strokeStyle = p.hot ? '#B0521A' : 'rgba(176,122,26,0.75)'; ctx.lineWidth = 2 * dpr;
			ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
			ctx.font = `${Math.round(17 * dpr)}px sans-serif`;
			ctx.fillText(p.icon, sx, sy + 1 * dpr);
			const label = many ? `${g.items.length} à voir` : p.label;
			ctx.font = `800 ${Math.round(12 * dpr)}px Nunito, sans-serif`;
			const w = ctx.measureText(label).width + 12 * dpr, h = 17 * dpr, ly = sy - R - 4 * dpr;
			ctx.fillStyle = p.hot ? '#E87028' : '#5F933E';
			ctx.beginPath(); ctx.roundRect(sx - w / 2, ly - h / 2, w, h, h / 2); ctx.fill();
			ctx.fillStyle = '#FFFFFF';
			ctx.fillText(label, sx, ly + 0.5 * dpr);
			// Pour le toucher : centre de la pastille (pixels CSS) et ce qu'elle regroupe.
			this.poiHits.push({ x: sx / dpr, y: sy / dpr, r: (R + 8 * dpr) / dpr, items: g.items });
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

	/** Le jardinier dit un petit mot (une tâche finie), quelques secondes. */
	say(text) {
		if (this.farmer) this.farmer.say = { text, until: this.t + 5 };
	}

	/** Sa bulle, au-dessus de sa tête, à taille lisible quel que soit le zoom. */
	drawSay(ctx, f) {
		const left = f.say.until - this.t, z = Math.max(1, 1.1 / this.cam.z);
		ctx.save();
		ctx.translate(f.x, f.y - 78);
		ctx.scale(z, z);
		ctx.globalAlpha = Math.min(1, left / 0.4, (5 - left) / 0.25);
		ctx.font = '700 15px Nunito, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const w = ctx.measureText(f.say.text).width + 20, h = 26;
		ctx.fillStyle = 'rgba(253,247,231,0.96)';
		ctx.strokeStyle = 'rgba(95,147,62,0.8)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.roundRect(-w / 2, -h, w, h, 13);
		ctx.moveTo(-5, 0); ctx.lineTo(0, 7); ctx.lineTo(5, 0);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#1F6B47';
		ctx.fillText(f.say.text, 0, -h / 2 + 1);
		ctx.restore();
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

	/** Une abeille se pose sur une fleur : une petite onde dorée, et quelques grains de pollen qui flottent, tout doux. */
	pollen(x, y) {
		// Deux ondes, la seconde un peu après, puis du pollen qui s'échappe de la fleur et flotte.
		this.particles.push({ x, y, vx: 0, vy: 0, life: 1, decay: 0.9, size: 4, ring: true, color: '#F4C23E' });
		this.particles.push({ x, y, vx: 0, vy: 0, life: 1.25, decay: 0.9, size: 1, ring: true, color: '#FBE7A8' });
		for (let i = 0; i < 8; i++) {
			const a = Math.random() * Math.PI * 2, v = 8 + Math.random() * 14;
			this.particles.push({
				x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 4,
				vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 8,
				life: 1, decay: 0.45 + Math.random() * 0.3, size: 1.2 + Math.random() * 1.3, glow: true, ph: Math.random() * 6,
				color: pick(['#F8D46A', '#FBE7A8', '#F4C23E', '#FFFFFF']),
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
		if (this.seaTop(ci)) return { x: ox + PARCEL_W / 2, y: oy + 70, rx: 200, ry: 50, scale: 3 };
		for (const [k, d] of Object.entries(DECOR)) {
			if (!d.water || this.heart(d.place) !== ci || !this.decorVisible(k)) continue;
			return { x: ox + d.x, y: oy + d.y, rx: 95 * (d.scale ?? 1), ry: 48 * (d.scale ?? 1), scale: d.scale ?? 1 };
		}
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

	/** Le moment : pluie, nuit, hiver, soleil ou jour calme (le réglage « Ciel du jardin » peut le fixer). */
	moment() {
		if (this.momentLock) return this.momentLock;
		if (this.precip() > 0 && this.weather.kind !== 'snow') return 'pluie';
		if (this.night() > 0.5) return 'nuit';
		if ((this.season?.winter ?? 0) > 0.5 || this.weather.kind === 'snow') return 'hiver';
		if (this.weather.kind === 'clear') return 'soleil';
		return 'jour';
	}

	precip() {
		const k = this.weather.kind;
		return k === 'rain' ? 1 : k === 'storm' ? 1.5 : k === 'drizzle' ? 0.45 : k === 'snow' ? 1 : 0;
	}

	// ─── Entrées : glisser, pincer, molette, double toucher, toucher ──

	bindInput() {
		const c = this.canvas;
		let drag = null, pinch = null, lastTap = 0;
		// Pendant l'introduction, la vue est tenue : ni zoom ni déplacement (poser la ruche reste possible).
		const held = () => !!this.state.intro;
		const local = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
		// Chaque geste, sur le jardin comme sur un bouton, remet à zéro le temps d'inactivité et arrête le suivi en cours.
		const touched = () => { this.lastTouch = performance.now(); };
		window.addEventListener('pointerdown', () => { touched(); if (this.following) this.camTarget = null; }, true);
		window.addEventListener('pointerup', touched, true);
		window.addEventListener('pointermove', e => { if (e.buttons) touched(); }, true);
		window.addEventListener('wheel', touched, { capture: true, passive: true });
		window.addEventListener('keydown', touched, true);
		c.addEventListener('pointerdown', e => {
			try { c.setPointerCapture(e.pointerId); } catch (err) { /* toucher déjà relâché */ }
			this.pointers.set(e.pointerId, local(e));
			this.camTarget = null;
			this.vel = { x: 0, y: 0 };
			if (this.pointers.size === 2) {
				const [a, b] = [...this.pointers.values()];
				pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.cam.z, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
				pinch.world = this.toWorld(...pinch.mid);
				if (drag) clearTimeout(drag.hold);
				drag = null;
				this.ghostFinger = null;
				// Introduction : la vue est tenue, l'interface ne s'efface pas (elle montre la consigne).
				if (!held()) this.onPeek?.(true);
			} else {
				const [x, y] = local(e);
				drag = { x, y, lx: x, ly: y, lt: performance.now(), moved: false };
				// Second toucher juste après un premier : glisser ensuite zoome, d'une seule main.
				if (!this.ghost && performance.now() - lastTap < 300) drag.zoom = true;
				if (this.ghost) this.grabGhost(drag, x, y);
				else if (drag.zoom) { /* pas d'appui long pendant un zoom à un doigt */ }
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
				if (held()) return;
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
			if (held()) return;
			if (drag.zoom) {
				if (!drag.moved && Math.abs(y - drag.y) > 6) { drag.moved = true; clearTimeout(drag.hold); }
				if (drag.moved) { this.zoomAt(Math.exp((y - drag.ly) * 0.008), drag.x, drag.y); drag.ly = y; }
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
			if (drag.zoom && drag.moved) { lastTap = 0; drag = null; return; }
			if (!drag.moved) {
				const now = performance.now();
				// Double toucher : zoomer d'un cran (ou revenir au zoom normal de très près).
				if (now - lastTap < 300 && !held()) { this.zoomAt(this.cam.z > 2.4 ? 1 / this.cam.z : 2, x, y); lastTap = 0; }
				// Introduction : toucher une plante ou une bête n'ouvre rien (on suit la consigne).
				else { lastTap = now; if (!held()) this.onTap?.(this.pick(x, y)); }
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
			if (held()) return;
			const [x, y] = local(e);
			this.zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
		}, { passive: false });
	}

	/** Le doigt prend l'objet à poser : s'il touche l'objet, il le tient par là ; sinon l'objet saute sous le doigt. */
	grabGhost(drag, x, y) {
		const [wx, wy] = this.toWorld(x, y), g = this.ghost, box = this.ghostBox(g.kind, g.level, g.plant);
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
		// Vu de loin, une pastille touchée emmène la vue sur ce qu'elle montre.
		if (this.cam.z < POI_Z) for (const h of this.poiHits ?? []) {
			if (Math.hypot(h.x - sx, h.y - sy) > h.r) continue;
			const x = h.items.reduce((a, p) => a + p.x, 0) / h.items.length, y = h.items.reduce((a, p) => a + p.y, 0) / h.items.length;
			return { poi: { x, y, items: h.items, z: h.items.length > 1 ? Math.min(POI_ZOOM, Math.max(this.cam.z * 2.2, GLYPH_Z + 0.05)) : POI_ZOOM }, x: sx, y: sy };
		}
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
		{
			const z = Math.max(1, 1.2 / this.cam.z);
			const jar = this.items.find(it => it.kind === 'collecteur' && (this.jarStock?.(it)?.v ?? 0) >= 1 && Math.abs(wx - it.x) < 40 * z && Math.abs(wy - (it.y - 128)) < 18 * z);
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
		// Économie d'énergie : au plus 30 images par seconde (le téléphone chauffe moins, la batterie dure plus).
		if (this.maxFps && now - this.last < 1000 / this.maxFps - 2) { requestAnimationFrame(this.frame); return; }
		const raw = (now - this.last) / 1000, dt = Math.min(0.05, raw);
		this.last = now;
		// Images par seconde (moyenne glissante), affichées en mode test.
		if (raw > 0 && raw < 1) this.fps = this.fps ? this.fps * 0.95 + (1 / raw) * 0.05 : 1 / raw;
		this.t += dt;
		// Une image ratée ne doit jamais figer le jardin : on la saute, et l'on continue à la suivante.
		try {
			if (this.base) {
				this.update(dt, now);
				this.render();
			}
		} catch (e) {
			if (!this.frameError) console.error(e);
			this.frameError = true;
		}
		requestAnimationFrame(this.frame);
	};

	/**
	 * Le jardin travaille à toute heure : la nuit, une plante protégée par un prédateur (éclat vert d'eau) ; sous la
	 * pluie, une plante qui pousse (éclat vert) et un ver qui remonte (terre) ; l'hiver, des graines qui tombent de la
	 * mangeoire. Le jour, ce sont les abeilles qui le montrent.
	 */
	busyTick(dt) {
		if (this.glyph || this.state.intro || !this.state.eco2) return;
		this.busyT = (this.busyT ?? 1) - dt;
		if (this.busyT > 0) return;
		this.busyT = 1.2 + Math.random() * 1.6;
		const m = this.moment(), v = this.view();
		const inView = (x, y) => x > v.x0 && x < v.x0 + v.w && y > v.y0 && y < v.y0 + v.h;
		const plants = this.place.plants.filter(p => { const [ox, oy] = cellOrigin(cellOf(p)); return inView(ox + p.x, oy + p.y); });
		const at = p => { const [ox, oy] = cellOrigin(cellOf(p)); return [ox + p.x, oy + p.y]; };
		if (m === 'pluie' && plants.length) {
			const p = pick(plants), [x, y] = at(p);
			this.burst(x, y - 14, 5, '#8BCB5E');
			if (Math.random() < 0.5) { const q = pick(plants), [qx, qy] = at(q); this.burst(qx + 14, qy + 4, 4, '#7A5A3A'); }
		} else if (m === 'nuit' && plants.length) {
			const p = pick(plants), [x, y] = at(p);
			this.burst(x, y - 18, 5, '#9FE6D0');
		} else if (m === 'hiver') {
			const feeders = this.items.filter(it => it.kind === 'mangeoire' && inView(it.x, it.y));
			if (feeders.length) { const f = pick(feeders); this.burst(f.x, f.y - 40, 6, '#A0784A'); }
			else if (plants.length) { const p = pick(plants), [x, y] = at(p); this.burst(x, y - 10, 4, '#FFFFFF'); }
		}
	}

	update(dt, now) {
		// Une vue invalide (page lancée à 0 pixel, en arrière-plan) se recentre sur le jardin au lieu de rester perdue.
		if (!Number.isFinite(this.cam.cx) || !Number.isFinite(this.cam.cy) || !Number.isFinite(this.cam.z) || !(this.base > 0)) {
			if (!(this.base > 0)) this.resize();
			const [cx, cy] = this.cellCenter(0);
			Object.assign(this.cam, { cx, cy, z: Number.isFinite(this.cam.z) && this.cam.z > 0 ? this.cam.z : 1 });
			this.vel = { x: 0, y: 0 };
			this.camTarget = null;
		}
		this.busyTick(dt);
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
		const mapView = this.cam.z < POI_Z;
		if (mapView !== this.mapView) { this.mapView = mapView; this.onMapView?.(mapView); }
		if (this.following) {
			const plant = this.followShow ? this.current : this.followed;
			const go = this.followShow ? this.idle() && !this.camLock?.() : this.autoCam();
			if (plant && go && !this.dragging && this.pointers.size === 0) {
				const [hx, hy] = this.headOf(plant);
				this.camTarget = { cx: hx, cy: hy + 40, z: Math.max(1, this.cam.z), follow: true };
			} else if (!go && this.camTarget?.follow) this.camTarget = null;
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
		if (ci >= 0 && ci < cellsOpen(this.place) && ci !== this.active) { this.active = ci; this.onActive?.(ci); }

		if (this.t > this.nextPopulate) { this.populate(); this.updateDew(); this.nextPopulate = this.t + 1; }
		for (const i of this.insects) { this.updateInsect(i, dt); this.steerBody(i, dt); }
		this.insects = this.insects.filter(i => !i.gone);
		this.updateFarmer(dt);
		this.updatePet(dt);
		this.updateHens(dt);
		this.updateBuilds();
		for (const p of this.particles) {
			p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
			// La poussière gonfle et ralentit ; le reste retombe.
			if (p.puff) { p.size += 16 * dt; p.vx *= 0.94; p.vy *= 0.94; }
			// L'onde du butinage s'élargit sur place ; le pollen flotte et monte doucement.
			else if (p.ring) p.size += 30 * dt;
			else if (p.glow) { p.vx *= 0.97; p.vy *= 0.97; p.x += Math.sin(this.t * 2.4 + p.ph) * 4 * dt; }
			// Une feuille tombe lentement en se balançant et en tournant.
			else if (p.leaf) { p.vy = Math.min(16, p.vy + 22 * dt); p.x += Math.sin(this.t * 3 + p.ph) * 14 * dt; p.rot += p.spin * dt; }
			else { p.vy += 10 * dt; p.vx *= 0.98; }
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
		// Un effectif par espèce pour tout le jardin ; chaque animal s'installe dans une parcelle visible de son milieu.
		const scale = Math.min(2, 1 + (visible.length - 1) * 0.35), present = biomesIn(place);
		// Comme dans la nature, on ne voit jamais tout le monde à la fois : chaque guilde (butineurs, papillons,
		// criquets, oiseaux, chauves-souris, grands mammifères…) a une place limitée à l'écran, et ses espèces se
		// relaient par fenêtres de quelques minutes. Les saisons, le vent et le froid règlent qui sort.
		const se = this.season ?? {}, winter = (se.winter ?? 0) > 0.5 || this.weather.kind === 'snow', lateAutumn = (se.autumn ?? 0) > 0.7;
		const windy = (this.weather.wind ?? 10) > 32, cold = (this.weather.temp ?? 15) < 8;
		const want = new Map();
		for (const sp of SPECIES) {
			if (sp.kind !== 'animal' || !present.has(sp.place) || !sp.critter.behavior) continue;
			const c = sp.critter, g = guildOf(c);
			let n = this.state.species[sp.id] && ok(c.when) ? Math.round((c.count(this.state) + (this.idleBonus?.(sp) ?? 0)) * scale) + attracted(place, sp.id) : 0;
			// Sous la pluie ou la neige, par grand vent ou par froid, les insectes volants se mettent à l'abri.
			if ((wet || windy || cold) && FLYERS.has(c.kind)) n = 0;
			// L'hiver, insectes, reptiles, amphibiens et chauves-souris hibernent, et les migrateurs sont partis ;
			// à la fin de l'automne, les papillons et les orthoptères se font rares.
			if (winter && (SLEEPS.has(g) || c.migrant)) n = 0;
			if (lateAutumn && (g === 'papillons' || g === 'criquets') && idHash(sp.id, 1) % 3) n = 0;
			const most = { bird: 4, tit: 4, hare: 4, rabbit: 4, roe: 3, chamois: 3, fox: 2, squirrel: 3, heron: 2, owl: 1, eagle: 1, gull: 4, duck: 4, bat: 3, boar: 3, badger: 1, deer: 3 }[c.kind];
			if (most) n = Math.min(n, most);
			// Les abeilles : une au départ, une de plus par trois fleurs écloses (la ruche n'en ajoute pas). Pendant
			// l'introduction, seule celle qu'elle met en scène.
			if (sp.id === 'abeille' && this.state.eco2) n = this.state.intro ? 0 : Math.min(n, Math.round(c.count(this.state)));
			if (n > 0) want.set(sp, n);
		}
		const slot = Math.floor(this.t / 150);
		const byGuild = new Map();
		for (const sp of want.keys()) { const g = guildOf(sp.critter); if (!byGuild.has(g)) byGuild.set(g, []); byGuild.get(g).push(sp); }
		for (const [g, list] of byGuild) {
			// Les espèces de la guilde passent à tour de rôle ; la place restante revient aux suivantes.
			// La nuit, la vie est plus discrète : moins de petites bêtes à la fois.
			const calm = night && SLEEPS.has(g) ? 0.6 : 1;
			// Les grands animaux et les oiseaux du ciel ne dépendent pas du zoom : on ne les fait pas apparaître ou partir
			// en zoomant.
			let room = Math.max(1, Math.round((GUILD_ROOM[g] ?? 4) * (FIXED_ROOM.has(g) ? 1 : scale) * calm));
			list.sort((a, b) => idHash(a.id, slot) - idHash(b.id, slot));
			for (const sp of list) { const n = Math.min(want.get(sp), room); want.set(sp, n); room -= n; }
		}
		// Jamais vide : si peu d'animaux sont de sortie (nuit, pluie, hiver, début de partie), des visiteurs du moment
		// viennent : des espèces de ce temps-là, pas encore découvertes. Les toucher les fait découvrir.
		if (!this.state.intro && visible.length) {
			let shown = 0;
			for (const v of want.values()) shown += v;
			const MIN = 4;
			if (shown < MIN) {
				const cands = SPECIES.filter(sp => sp.kind === 'animal' && present.has(sp.place) && sp.critter?.behavior && !this.state.species[sp.id]
					&& sp.critter.when !== 'always' && ok(sp.critter.when) && !((wet || windy || cold) && FLYERS.has(sp.critter.kind)) && !(winter && SLEEPS.has(guildOf(sp.critter))) && unlocked(this.state, sp));
				this.visitors = (this.visitors ?? []).filter(id => cands.some(c => c.id === id));
				for (const c of cands.sort(() => Math.random() - 0.5)) { if (this.visitors.length >= 3) break; if (!this.visitors.includes(c.id)) this.visitors.push(c.id); }
				for (const id of this.visitors) { const sp = SPECIES.find(x => x.id === id); want.set(sp, Math.max(want.get(sp) ?? 0, 1)); shown++; }
				// Toujours rien : les espèces déjà découvertes qui peuvent sortir maintenant viennent plus nombreuses.
				if (shown < MIN) for (const [sp, v] of want) if (this.state.species[sp.id] && ok(sp.critter.when) && shown < MIN) { want.set(sp, v + 1); shown++; }
				if (shown < MIN) for (const sp of SPECIES) {
					if (shown >= MIN) break;
					if (sp.kind !== 'animal' || !present.has(sp.place) || !sp.critter?.behavior || !this.state.species[sp.id] || !ok(sp.critter.when) || want.get(sp)) continue;
					if ((wet || windy || cold) && FLYERS.has(sp.critter.kind)) continue;
					if (winter && SLEEPS.has(guildOf(sp.critter))) continue;
					want.set(sp, 1); shown++;
				}
			} else this.visitors = [];
			// Une parcelle d'un milieu où rien n'est encore découvert (un marais tout neuf) : deux habitants du milieu
			// viennent quand même la visiter, à découvrir en les touchant.
			for (const biome of new Set(visible.map(ci => this.biomeOf(ci)))) {
				if ([...want.entries()].some(([sp, v]) => v > 0 && sp.place === biome)) continue;
				const locals = SPECIES.filter(sp => sp.kind === 'animal' && sp.place === biome && sp.critter?.behavior && !this.state.species[sp.id] && ok(sp.critter.when)
					&& !((wet || windy || cold) && FLYERS.has(sp.critter.kind)) && !(winter && SLEEPS.has(guildOf(sp.critter))));
				this.visitors ??= [];
				for (const c of locals.sort((a, b) => idHash(a.id, 7) - idHash(b.id, 7)).slice(0, 2)) { if (!this.visitors.includes(c.id)) this.visitors.push(c.id); want.set(c, 1); }
			}
		}
		for (const sp of SPECIES) {
			if (sp.kind !== 'animal' || !present.has(sp.place) || !sp.critter.behavior) continue;
			const n = want.get(sp) ?? 0;
			const active = this.insects.filter(i => i.sp === sp.id && !i.leaving && !i.intro);
			for (let k = active.length; k < n; k++) {
				let b = null;
				for (const ci of visible.filter(ci => this.biomeOf(ci) === sp.place).sort(() => Math.random() - 0.5)) if ((b = this.newCritter(sp, this.pdata[ci]))) break;
				if (b) this.insects.push(b);
			}
			for (let k = active.length; k > n; k--) active[k - 1].leaving = true;
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
		// Pas de moucherons pendant l'introduction : la scène reste nette.
		if (this.glyph || this.state.intro) return;
		if (wet) {
			// Sous la pluie, les butineurs s'abritent : on les voit aux entrées de l'hôtel et de la ruche.
			for (const it of this.items) if ((it.kind === 'hotel' || it.kind === 'ruche') && visible.includes(this.cellAt(it.x, it.y)))
				this.ambient.push({ x: it.x, y: it.y - (it.kind === 'ruche' ? 22 : 48), kind: 'peek', n: 3 + Math.floor(Math.random() * 3), r: 6, ph: Math.random() * 100 });
			return;
		}
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
			const warm = (this.season?.winter ?? 0) < 0.3 && (this.season?.autumn ?? 0) < 0.6;
			if (night && warm && this.state.species['ver-luisant'] && this.biomeOf(ci) === 'prairie') {
				for (const p of [...P.herbs].sort(() => Math.random() - 0.5).slice(0, 3)) {
					this.ambient.push({ x: P.ox + p.x + (Math.random() - 0.5) * 10, y: P.oy + p.y - 2, kind: 'glow', n: 0, ph: Math.random() * 100 });
					if (Math.random() < 0.5) this.ambient.push({ x: P.ox + p.x, y: P.oy + p.y - 20, kind: 'glow', male: true, n: 0, ph: Math.random() * 100 });
				}
			}
			if (night) {
				for (const it of this.items) {
					if (this.cellAt(it.x, it.y) !== ci) continue;
					const sp = this.itemSprite(it.kind, it.rot, it);
					if (sp.glow != null) this.ambient.push({ x: it.x + (sp.glowX ?? 0), y: it.y + sp.glow + 36, kind: 'moth', n: 3 + Math.floor(Math.random() * 3), r: 12, ph: Math.random() * 100 });
				}
				for (const p of [...P.flowers].sort(() => Math.random() - 0.5).slice(0, 2)) this.ambient.push({ x: P.ox + p.x, y: P.oy + p.y + 10, kind: 'moth', n: 1 + Math.floor(Math.random() * 2), r: 22, ph: Math.random() * 100 });
			}
			// Quelques moucherons épars, jamais en nuée serrée : un seul petit groupe par parcelle, et pas toujours.
			let gnats = 0;
			for (const s of spots) {
				const mosq = s.water && (dusk || night);
				if (night && !mosq) continue;
				if (!mosq && (gnats++ >= 1 || Math.random() < 0.4)) continue;
				this.ambient.push({ x: s.x, y: s.y, kind: mosq ? 'mosq' : 'gnat', n: mosq ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3), r: mosq ? 28 : 30, ph: Math.random() * 100 });
			}
		}
	}

	drawAmbient(ctx, v) {
		const t = this.t;
		for (const s of this.ambient ?? []) {
			if (s.kind === 'glow') continue;
			if (s.x < v.x0 - 60 || s.x > v.x0 + v.w + 60 || s.y < v.y0 - 20 || s.y > v.y0 + v.h + 80) continue;
			for (let i = 0; i < s.n; i++) {
				const a = s.ph + i * 2.4;
				const x = s.x + Math.sin(t * (1.1 + (i % 5) * 0.33) + a) * s.r + Math.sin(t * 0.21 + a) * 7;
				const y = s.y - 36 + Math.cos(t * (1.6 + (i % 3) * 0.45) + a * 1.3) * s.r * 0.55 + Math.sin(t * 0.6 + i) * 5;
				if (s.kind === 'peek') {
					// Une abeille à l'abri : elle remue à peine, au seuil de son abri.
					const px = s.x + Math.sin(a * 3.1) * 9 + Math.sin(t * 2 + a) * 1.2, py = s.y + Math.cos(a * 2.3) * 4;
					ctx.fillStyle = '#E8B23A'; ctx.beginPath(); ctx.ellipse(px, py, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
					ctx.fillStyle = 'rgba(40,30,20,0.8)'; ctx.fillRect(px - 0.4, py - 1.6, 0.8, 3.2);
					continue;
				}
				if (s.kind === 'gnat') {
					ctx.fillStyle = 'rgba(46,40,30,0.55)';
					ctx.fillRect(x - 0.65, y - 0.65, 1.3, 1.3);
				} else if (s.kind === 'moth') {
					// Petit papillon de nuit pâle, ailes qui battent, attiré par la lumière.
					const f = 0.4 + 0.6 * Math.abs(Math.sin(t * 22 + i * 1.7));
					ctx.fillStyle = 'rgba(238,228,206,0.85)';
					ctx.beginPath(); ctx.ellipse(x - 1.1, y, 1.5 * f, 1.1, 0.4, 0, Math.PI * 2); ctx.fill();
					ctx.beginPath(); ctx.ellipse(x + 1.1, y, 1.5 * f, 1.1, -0.4, 0, Math.PI * 2); ctx.fill();
					ctx.fillStyle = 'rgba(120,100,80,0.8)';
					ctx.fillRect(x - 0.3, y - 0.8, 0.6, 1.8);
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
				const d = this.decorPos(c.on);
				return d && P.ci === this.heart(DECOR[c.on].place) && this.decorVisible(c.on) && { ...base, decor: c.on, x: d.x + (Math.random() - 0.5) * 20, y: d.y + this.decorSprite(c.on).top * 0.8, mode: 'perch' };
			}
			case 'perch': {
				const target = pick(c.on === 'buisson' ? P.bushes : P.trees);
				if (!target) {
					// Pas encore d'arbuste ni d'arbre où se percher : l'oiseau d'une mangeoire ou d'un nichoir sautille au
					// sol tout autour (il y est déjà, puisqu'on l'a fait venir).
					const nest = pick(this.itemsIn(P.ci, Object.keys(ITEMS).filter(k => [].concat(ITEMS[k].attracts ?? []).includes(sp.id))));
					if (!nest) return null;
					return { ...base, behavior: 'hop', x: nest.x + (Math.random() - 0.5) * 60, y: nest.y + 10 + Math.random() * 16, mode: 'walk', home: { x: nest.x, y: nest.y + 10 } };
				}
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
			case 'bat':
				return { ...base, x: side, y: y - 60, mode: 'fly', timer: 0 };
			case 'soar':
				// Chaque planeur a son propre cercle, fixé dans le jardin (et non sur l'écran), sa vitesse et son sens.
				return { ...base, x: P.ox + PARCEL_W / 2, y, mode: 'soar', ang: Math.random() * 6.28, r: 70 + Math.random() * 80,
					cx: P.ox + PARCEL_W * (0.25 + Math.random() * 0.5), cy: P.oy + PARCEL_H * (0.25 + Math.random() * 0.5),
					spin: (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.2), seed: Math.random() * 100 };
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
		return DECOR[key] && P.ci === this.heart(DECOR[key].place) && this.decorVisible(key) ? this.decorPos(key) : null;
	}

	// ─── Ce que les bêtes font pour le jardin ─────────────────────
	// Elles vivent comme dans la nature, et ça se voit dans le jeu : les butineurs pollinisent les fleurs en
	// train de pousser, les oiseaux sèment en picorant, les libellules mangent les moustiques, et chacun
	// rentre dans l'abri qu'on lui a construit.

	/** Objets posés dans une parcelle, parmi `kinds`. */
	/**
	 * Le voisinage d'un habitat de l'échelle placé en (x, y) : les plantes mûres à portée, partagées avec les autres
	 * habitats qui en vivent aussi, et les massifs proches (pour une ruche ou un hôtel). `except` : l'objet déplacé.
	 */
	nearInfo(kind, x, y, except = null, use = this.nearUse) {
		const U = use?.[kind];
		if (!U) return null;
		const R = this.nearR, items = this.items.filter(it => it !== except && use[it.kind]);
		const counts = { herbe: 0, fleur: 0, buisson: 0, arbre: 0 };
		let green = 0;
		for (const p of this.place.plants) {
			if (p.growth < 1 || !U[p.type]) continue;
			const [ox, oy] = cellOrigin(cellOf(p)), px = ox + p.x, py = oy + p.y;
			if (Math.hypot(px - x, py - y) > R) continue;
			counts[p.type]++;
			// La plante est partagée entre tous les habitats qui en vivent, à portée d'elle.
			const others = items.filter(it => use[it.kind][p.type] && Math.hypot(it.x - px, it.y - py) <= R).length;
			green += U[p.type] / (1 + 0.5 * others);
		}
		const massifs = kind === 'ruche' || kind === 'hotel' ? items.filter(it => it.kind === 'massif' && Math.hypot(it.x - x, it.y - y) <= R).length : 0;
		return { near: Math.min(1, green / this.nearNeed), green, counts, massifs, syn: Math.min(this.synMax, massifs * this.synPer) };
	}

	/** Mesure le voisinage de tous les habitats de l'échelle posés ici (it.near, it.syn), pour la production. */
	measureNear() {
		if (!this.nearUse) return;
		for (const it of this.items) {
			if (!this.nearUse[it.kind]) continue;
			const n = this.nearInfo(it.kind, it.x, it.y, it);
			it.near = Math.round(n.near * 100) / 100;
			it.syn = n.syn;
		}
	}

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
		const cab = this.glyph || !kind ? null : this.homeCabin();
		if (!cab) { this.pet = null; return; }
		const door = this.cabinDoor(cab), f = this.farmer;
		let a = this.pet;
		if (!a || a.kind !== kind) a = this.pet = { kind, p: {}, x: door.x + 14, y: door.y + 4, mode: 'sleep', t: 0, ph: 0, dir: 1, timer: 3 };
		a.t += dt;
		// La nuit, il dort à l'intérieur, comme son maître.
		a.hidden = !!f?.hidden && (this.night() > 0.45 || this.precip() > 0.5);
		if (a.hidden) { a.x = door.x + 14; a.y = door.y + 4; a.mode = 'sleep'; return; }
		a.timer -= dt;
		// Le chat chasse : il repère un papillon ou un criquet, le traque à pas lents, bondit… et le rate souvent.
		// Ensuite il reste assis à le regarder s'enfuir, la queue qui fouette.
		if (kind === 'cat' && !(f && !f.hidden && f.mode === 'stroll')) {
			if (a.pounce != null) {
				a.pounce += dt / 0.5;
				const b = a.hunt, u = Math.min(1, a.pounce);
				a.lift = Math.sin(u * Math.PI) * 9;
				if (b) { const gy = b.y + (FLIGHT[b.kind] ?? 0); a.x += (b.x - a.x) * Math.min(1, dt * 6); a.y += (gy - a.y) * Math.min(1, dt * 6); }
				a.mode = 'run'; a.ph += dt * 3;
				if (u >= 1) {
					if (b && !b.gone) {
						// La proie s'échappe : le papillon remonte d'un coup d'aile, le criquet saute.
						if (b.behavior === 'hop') b.timer = 0;
						else { b.y -= 26; b.target = null; b.mode = b.behavior === 'flutter' ? 'wander' : b.mode; b.timer = 2; }
					}
					a.pounce = null; a.lift = 0; a.hunt = null; a.goal = null; a.mode = 'stand'; a.timer = 2.5 + Math.random() * 4;
				}
				return;
			}
			if (!a.hunt && !a.goal && a.timer <= 0 && Math.random() < 0.45) a.hunt = this.preyNear(a);
			if (a.hunt) {
				const b = a.hunt;
				if (b.gone || b.leaving || b.hidden) { a.hunt = null; a.timer = 1; }
				else {
					const gx = b.x - (b.x > a.x ? 6 : -6), gy = b.y + (FLIGHT[b.kind] ?? 0), d = Math.hypot(gx - a.x, gy - a.y);
					if (d < 22) { a.pounce = 0; a.dir = Math.sign(b.x - a.x) || a.dir; return; }
					if (d > 260) { a.hunt = null; a.timer = 1; }
					else {
						// À l'affût : il avance lentement, s'arrête, repart.
						const creep = Math.sin(a.t * 1.7) > -0.3 ? GAIT.cat.speed * 0.45 : 0, step = Math.min(d, creep * dt);
						a.x += ((gx - a.x) / d) * step; a.y += ((gy - a.y) / d) * step;
						a.ph += step / GAIT.cat.stride;
						a.dir = Math.sign(gx - a.x) || a.dir;
						a.mode = step > 0 ? 'run' : 'stand';
						return;
					}
				}
			}
		}
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
		// Le chien guette son maître : il se lève dès que celui-ci s'éloigne. En promenade, chien ou chat le suivent de près.
		const walkies = f && !f.hidden && f.mode === 'stroll';
		if ((kind === 'dog' || walkies) && f && !f.hidden && Math.hypot(f.x - a.x, f.y - a.y) > (walkies ? 22 : 46)) a.goal = { x: f.x - f.dir * (walkies ? 28 : 16), y: f.y + (walkies ? -4 : 4) };
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

	/**
	 * Le poulailler : un coq et trois poules picorent autour, grattent la terre, courent après un criquet ou un
	 * carabe qui passe, et rentrent à la nuit tombée (ou sous la pluie). Le coq chante le matin.
	 */
	updateHens(dt) {
		const coops = this.glyph ? [] : this.items.filter(it => it.kind === 'poulailler');
		this.hens = (this.hens ?? []).filter(h => coops.includes(h.coop));
		// Autant de poules et de coqs que le poulailler en accueille ; chacun garde son plumage.
		const COQS = [HEN_LOOKS.coq, HEN_LOOKS['coq-blanc']];
		const POULES = [HEN_LOOKS['poule-rousse'], HEN_LOOKS['poule-blanche'], HEN_LOOKS['poule-noire'], HEN_LOOKS['poule-fauve']];
		for (const c of coops) {
			const fl = c.flock ?? { hens: 3, roosters: 1 };
			for (const [rooster, want, looks] of [[true, fl.roosters, COQS], [false, fl.hens, POULES]]) {
				const mine = this.hens.filter(h => h.coop === c && !!h.p.rooster === rooster);
				for (let k = mine.length; k < want; k++) this.hens.push({ kind: 'hen', p: looks[k % looks.length], coop: c, x: c.x + (Math.random() - 0.5) * 60, y: c.y + 14 + Math.random() * 20, mode: 'stand', t: Math.random() * 10, ph: 0, dir: Math.random() < 0.5 ? -1 : 1, timer: Math.random() * 3 });
				for (const h of mine.slice(want)) this.hens.splice(this.hens.indexOf(h), 1);
			}
		}
		const home = this.night() > 0.45 || this.precip() > 0.5, hour = this.hour();
		for (const h of this.hens) {
			h.t += dt;
			const door = { x: h.coop.x - 12, y: h.coop.y + 22 };
			if (home) {
				if (h.hidden) continue;
				h.goal = door;
			} else if (h.hidden) { h.hidden = false; h.x = door.x; h.y = door.y; h.goal = null; }
			h.timer -= dt;
			if (!h.goal && h.timer <= 0) {
				const r = Math.random();
				// Une petite bête qui passe au sol : la poule court la gober.
				const prey = this.insects.find(b => !b.leaving && ['grasshopper', 'beetle', 'firebug', 'snail', 'ants'].includes(b.kind) && Math.hypot(b.x - h.x, b.y - h.y) < 90);
				if (prey && r < 0.4) h.goal = { x: prey.x, y: prey.y, prey };
				else if (h.p.rooster && hour > 5.5 && hour < 8.5 && r < 0.35) { h.mode = 'crow'; h.timer = 2.2; }
				else if (r < 0.6) { h.mode = 'peck'; h.timer = 1.2 + Math.random() * 2.5; }
				else {
					const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 90;
					h.goal = { x: h.coop.x + Math.cos(a) * d, y: h.coop.y + 20 + Math.abs(Math.sin(a)) * d * 0.6 };
				}
			}
			if (!h.goal) { if (h.mode === 'run') h.mode = 'stand'; continue; }
			const dx = h.goal.x - h.x, dy = h.goal.y - h.y, d = Math.hypot(dx, dy);
			if (d < 2) {
				if (h.goal === door || (home && h.goal.x === door.x)) h.hidden = true;
				// Elle picore là où la bête était ; celle-ci a souvent filé.
				if (h.goal.prey && h.goal.prey.behavior === 'hop') h.goal.prey.timer = 0;
				h.goal = null; h.mode = 'peck'; h.timer = 1 + Math.random() * 2;
				continue;
			}
			const sp = GAIT.hen.speed * (h.goal.prey ? 2.2 : home ? 1.5 : 1), step = Math.min(d, sp * dt);
			h.x += (dx / d) * step; h.y += (dy / d) * step;
			h.ph += step / GAIT.hen.stride;
			if (Math.abs(dx) > 0.5) h.dir = Math.sign(dx);
			h.mode = 'run';
		}
	}

	/** Une petite bête que le chat pourrait chasser, près de lui. */
	preyNear(a, r = 170) {
		let best = null, bd = r;
		for (const b of this.insects) {
			if (b.leaving || b.hidden || !['butterfly', 'moth', 'grasshopper', 'beetle', 'hoverfly', 'firebug', 'dragonfly', 'mouse'].includes(b.kind)) continue;
			const d = Math.hypot(b.x - a.x, b.y + (FLIGHT[b.kind] ?? 0) - a.y);
			if (d < bd) { bd = d; best = b; }
		}
		return best;
	}

	/** La cabane où le jardinier se trouve en ce moment (il n'y en a qu'un, qui fait la tournée de toutes). */
	homeCabin() {
		const cabs = this.glyph ? [] : this.items.filter(it => it.kind === 'cabane');
		return cabs.find(c => c.id === this.farmer?.cab) ?? cabs[0] ?? null;
	}

	/**
	 * Un seul jardinier pour tout le jardin. Avec plusieurs cabanes, il fait sa tournée : après chaque pause, il
	 * part parfois vers une autre cabane et s'occupe des potagers et du poulailler qui l'entourent ; le soir, il
	 * dort dans la plus proche.
	 */
	updateFarmer(dt) {
		const cabs = this.glyph ? [] : this.items.filter(it => it.kind === 'cabane');
		if (!cabs.length) { this.farmer = null; return; }
		let f = this.farmer;
		if (!f) { const d0 = this.cabinDoor(cabs[0]); f = this.farmer = { kind: 'farmer', p: {}, x: d0.x, y: d0.y, mode: 'stand', t: 0, ph: 0, dir: 1, timer: 1.5, cab: cabs[0].id, hidden: true }; }
		const near = () => cabs.reduce((a, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? c : a));
		let cab = cabs.find(c => c.id === f.cab) ?? near();
		f.fem = this.state.gardener === 'fermiere';
		f.t += dt;
		const home = this.night() > 0.45 || this.precip() > 0.5;
		// Le soir ou sous la pluie, il rentre à la cabane la plus proche de l'endroit où il travaille.
		if (home && !f.hidden && f.goal?.task !== 'in') cab = near();
		f.cab = cab.id;
		let door = this.cabinDoor(cab);
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
				if (task === 'in') { f.hidden = true; f.basket = false; f.mode = 'stand'; f.timer = 2; if (!home) f.restUntil = f.t + 40 + Math.random() * 70; return; }
				if (task === 'stroll') {
					const next = f.route?.shift();
					if (next) { f.goal = { ...next, task: 'stroll' }; return; }
					f.mode = 'stand'; f.timer = 1.5; return;
				}
				if (task === 'sit' || task === 'pick' || task === 'gaze') {
					f.mode = task;
					f.dir = f.face ?? f.dir;
					f.timer = task === 'sit' ? 12 + Math.random() * 10 : task === 'pick' ? 7 + Math.random() * 4 : 7 + Math.random() * 6;
					return;
				}
				if (task === 'harvest') { f.mode = 'rake'; f.harvesting = f.bed; f.dir = f.face ?? f.dir; f.timer = 4.5; return; }
				if (task === 'eggs') { f.mode = 'stand'; f.collecting = f.coop; f.timer = 3; return; }
				if (task === 'fetch') { f.mode = 'stand'; f.timer = 1.2; return; }
				f.mode = task;
				f.dir = f.face ?? f.dir;
				f.timer = task === 'rake' ? 6 + Math.random() * 6 : task === 'water' ? 4 + Math.random() * 4 : 2 + Math.random() * 3;
				return;
			}
			const stroll = f.goal.task === 'stroll';
			// L'allure change le pas : plus court en promenade ou chargé, plus long quand il se presse (rentrer le soir).
			const pace = f.carry ? 0.8 : stroll ? 0.7 : f.goal.task === 'in' && home ? 1.2 : 1;
			f.pace = (f.pace ?? pace) + (pace - (f.pace ?? pace)) * Math.min(1, dt * 2);
			const step = Math.min(d, GAIT.farmer.speed * f.pace * dt);
			f.x += (dx / d) * step;
			f.y += (dy / d) * step;
			// Les pieds ne glissent pas : la cadence suit la longueur du pas.
			f.ph += step / (GAIT.farmer.stride * strideOf(f.pace));
			f.dist = (f.dist ?? 0) + step;
			if (Math.abs(dx) > 0.5) f.dir = Math.sign(dx);
			f.mode = f.carry ? 'barrow' : stroll ? 'stroll' : 'run';
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
		// Cueillette finie : quelques fruits tombent, le panier est plein, on le rapporte à la cabane.
		if (f.mode === 'pick') {
			f.basket = true;
			this.burst(f.x + f.dir * 10, f.y - 40, 8, f.fruit);
			if (f.tree) this.onPick?.(f.tree);
			f.tree = null;
			f.goal = { x: door.x, y: door.y, task: 'in' };
			return;
		}
		// Les œufs ramassés vont dans le panier, rapporté à la cabane.
		if (f.collecting) {
			const coop = f.collecting, n = this.items.includes(coop) ? this.eggsOf(coop) : 0;
			f.collecting = null;
			if (n) {
				coop.km0 = this.state.totals.distance / 1000;
				f.basket = 'eggs';
				this.burst(coop.x, coop.y - 20, 8, '#F4EEDC');
				this.onEggs?.(coop, n);
				f.goal = { x: door.x, y: door.y, task: 'in' };
				return;
			}
		}
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
		// En sortant de la cabane, il part parfois faire sa tournée vers une autre.
		if (f.hidden && cabs.length > 1 && Math.random() < 0.5) {
			const others = cabs.filter(c => c !== cab);
			cab = others[Math.floor(Math.random() * others.length)];
			f.cab = cab.id;
			door = this.cabinDoor(cab);
		}
		f.hidden = false;
		// Les potagers et le poulailler les plus proches de la cabane où il est passent en premier.
		const byNear = list => list.sort((a, b) => Math.hypot(a.x - door.x, a.y - door.y) - Math.hypot(b.x - door.x, b.y - door.y));
		const beds = byNear(this.items.filter(it => it.kind === 'potager'));
		const coop = byNear(this.items.filter(it => it.kind === 'poulailler' && this.eggsOf(it) >= Math.max(2, it.flock?.hens ?? 3)))[0];
		if (coop && !f.carry && !f.basket) {
			f.goal = { x: coop.x + 22, y: coop.y + 20, task: 'eggs' };
			f.coop = coop;
			f.face = -1;
			return;
		}
		const ripe = beds.find(b => this.bedStage(b) >= 1);
		if (ripe && !f.carry) {
			const side = Math.random() < 0.5 ? -1 : 1;
			f.goal = { x: ripe.x + side * (PLOT.w / 2 - 15), y: ripe.y + PLOT.h / 2 + 6, task: 'harvest' };
			f.bed = ripe;
			f.face = -side;
			return;
		}
		// Entre deux travaux, un moment pour soi : un banc, des fruits à cueillir, une pause, une promenade avec son animal.
		if (!f.carry && Math.random() < 0.4 && this.leisure(f, door)) return;
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

	/** Les arbres fruitiers adultes du lieu, avec leur position au sol et la couleur de leurs fruits. */
	fruitTrees() {
		const out = [];
		for (const p of this.place.plants) {
			if (p.type !== 'arbre' || p.growth < 1) continue;
			const sp = speciesOf(p), col = FRUIT_TREES[sp];
			const P = this.pdata[cellOf(p)];
			if (col && P) out.push({ x: P.ox + p.x, y: P.oy + p.y, fruit: col, plant: p });
		}
		return out;
	}

	/** Choisit un moment de détente pour le jardinier ; faux s'il n'y a rien à faire de ce genre ici. */
	leisure(f, door) {
		const options = [];
		const bench = pick(this.items.filter(it => it.kind === 'banc'));
		if (bench) options.push(() => { f.goal = { x: bench.x, y: bench.y + 2, task: 'sit' }; f.face = Math.random() < 0.5 ? 1 : -1; });
		const trees = (this.season?.winter ?? 0) > 0.5 ? [] : this.fruitTrees();
		if (trees.length) options.push(() => {
			const tr = pick(trees), side = Math.random() < 0.5 ? -1 : 1;
			f.goal = { x: tr.x + side * 16, y: tr.y + 4, task: 'pick' };
			f.face = -side;
			f.fruit = tr.fruit;
			f.tree = tr.plant;
		});
		options.push(() => {
			const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90;
			f.goal = { x: door.x + Math.cos(a) * r, y: door.y + 30 + Math.abs(Math.sin(a)) * r * 0.6, task: 'gaze' };
			f.face = Math.random() < 0.5 ? 1 : -1;
		});
		if (this.pet) options.push(() => {
			// Une boucle tranquille autour de la cabane, l'animal sur les talons.
			const R = 90 + Math.random() * 60, a0 = Math.random() * Math.PI * 2;
			f.route = [1, 2, 3, 4].map(k => ({ x: door.x + Math.cos(a0 + k * 1.5) * R, y: door.y + 40 + Math.abs(Math.sin(a0 + k * 1.5)) * R * 0.7 }));
			f.route.push({ x: door.x + 20, y: door.y + 24 });
			f.goal = { ...f.route.shift(), task: 'stroll' };
		});
		if (!options.length) return false;
		pick(options)();
		return true;
	}

	/**
	 * Un danger tout proche (le jardinier, son chien ou son chat) ? Renvoie vrai une fois le temps de réaction
	 * écoulé (0,1 à 0,35 s, propre à chaque fois) : une fuite instantanée paraîtrait mécanique.
	 */
	startled(b, r, dt) {
		if (b.fright != null) {
			b.fright -= dt;
			if (b.fright > 0) return false;
			b.fright = null;
			return true;
		}
		if ([this.farmer, this.pet].some(a => a && !a.hidden && Math.hypot(a.x - b.x, a.y - b.y) < r)) b.fright = 0.1 + Math.random() * 0.25;
		return false;
	}

	/**
	 * Le corps suit la vitesse réellement parcourue (quel que soit le comportement qui a bougé la bête) :
	 * cap lissé avec un léger retard, inclinaison dans les virages, nez qui monte ou pique, et demi-tour
	 * de profil en quelques images au lieu d'un retournement sec. À l'arrêt, la bête garde son cap.
	 */
	steerBody(b, dt) {
		if (dt <= 0 || b.behavior === 'bound' || b.behavior === 'roam' || b.behavior === 'trail') return;
		if (b.lx == null || b.hidden) { b.lx = b.x; b.ly = b.y; b.svx = b.svy = 0; b.flew = false; return; }
		let vx = (b.x - b.lx) / dt, vy = (b.y - b.ly) / dt;
		b.lx = b.x; b.ly = b.y;
		// Un bond imposé (le chat qui la rate, une réapparition) : on ne tourne pas pour ça.
		if (vx * vx + vy * vy > 600 * 600) { vx = vy = 0; b.svx = b.svy = 0; }
		const s = 1 - Math.exp(-dt * 12);
		b.svx += (vx - b.svx) * s;
		b.svy += (vy - b.svy) * s;
		// Bougée par autre chose que flyTo (posée, en balade) : son élan repart de ce qu'elle fait vraiment.
		if (!b.flew) { b.vx = b.svx; b.vy = b.svy; }
		b.flew = false;
		const still = STILL.has(b.mode) || b.gk === 'peck' || b.vk === 'sit';
		const moving = !still && Math.hypot(b.svx, b.svy) > 6;
		let bank = 0;
		if (moving) {
			const want = Math.atan2(b.svy, b.svx);
			if (b.head == null) b.head = want;
			const turn = wrapAngle(want - b.head) * (1 - Math.exp(-dt * (TURN[b.kind] ?? 8)));
			b.head += turn;
			bank = clampN((turn / dt) * 0.25, -0.6, 0.6);
			if (b.svx > 5) b.dir = 1;
			else if (b.svx < -5) b.dir = -1;
		}
		b.bank = (b.bank ?? 0) + (bank - (b.bank ?? 0)) * s;
		const pitch = moving && PITCH[b.kind] ? (b.dir || 1) * clampN(Math.atan2(b.svy, Math.abs(b.svx)), -1, 1) * PITCH[b.kind] : 0;
		b.pitch = (b.pitch ?? 0) + (pitch - (b.pitch ?? 0)) * s;
		b.face = (b.face ?? (b.dir || 1)) + ((b.dir || 1) - (b.face ?? (b.dir || 1))) * (1 - Math.exp(-dt * 14));
	}

	updateInsect(b, dt) {
		b.t += dt;
		const P = this.pdata[b.ci];
		if (!P) { b.gone = true; return; }
		// Vol vers une cible : la bête a de l'élan (sa vitesse tourne peu à peu, d'où des courbes au lieu de
		// virages à angle droit), freine en arrivant, et ses zigzags font partie du trajet, donc le corps les suit.
		// Chaque individu a sa propre allure (± 15 %), pour qu'aucun ne soit le clone d'un autre.
		const flyTo = (tx, ty, speed, wobble) => {
			speed *= b.vary ??= 0.85 + Math.random() * 0.3;
			const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy) || 1;
			const want = speed * Math.min(1, dist / Math.max(10, speed * 0.3));
			const wob = Math.sin(b.t * 7 + (b.seed2 ??= Math.random() * 6.28)) * wobble * Math.min(1, dist / 40);
			const wx = (dx * want - dy * wob) / dist, wy = (dy * want + dx * wob) / dist;
			const k = 1 - Math.exp(-dt * (TURN[b.kind] ?? 8) * 0.8);
			b.vx = (b.vx ?? 0) + (wx - (b.vx ?? 0)) * k;
			b.vy = (b.vy ?? 0) + (wy - (b.vy ?? 0)) * k;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			// Tout près, on finit de se poser en douceur (pas de ronde autour de la cible).
			if (dist < 8) { const g = Math.min(1, dt * 8); b.x += (tx - b.x) * g; b.y += (ty - b.y) * g; }
			b.flew = true;
			return Math.hypot(tx - b.x, ty - b.y);
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
					// Chargée, elle rentre droit et plus vite : ce trajet net, opposé au va-et-vient du butinage,
					// dit tout de suite « je rentre à la ruche ».
					if (flyTo(it.x - (it.kind === 'ruche' ? 4 : 0), it.y - (it.kind === 'ruche' ? 25 : 60), 85, 4) < 4) { b.hidden = true; b.timer = 4 + Math.random() * 5; }
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
				if (flyTo(hx, hy - 4, 70, 25) < 4) { b.mode = 'hover'; b.timer = 1.5 + Math.random() * 2; if (b.kind === 'bee') this.pollen(hx, hy - 2); }
				return;
			}
			case 'flutter': {
				if (b.leaving) return flyAway();
				if (b.mode === 'perch' && b.target && has(b.target)) {
					b.timer -= dt;
					const [hx, hy] = head(b.target);
					b.x = hx + b.ox; b.y = hy + b.oy;
					// Quelqu'un passe tout près : après un temps de réaction, il s'envole vers le haut.
					if (this.startled(b, 40, dt)) { b.mode = 'wander'; b.target = null; b.timer = 2 + Math.random() * 2; b.ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; return; }
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
				const fs = 35 * (b.vary ??= 0.85 + Math.random() * 0.3);
				b.x += Math.cos(b.ang) * fs * dt;
				b.y += Math.sin(b.ang) * fs * dt + Math.sin(b.t * 5) * 8 * dt;
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
					// Dérangé au sol : il s'envole vers un arbre, et ses voisins suivent en cascade, chacun avec son
					// propre temps de réaction (c'est l'envol en groupe, décalé, qui fait « nature »).
					if (this.startled(b, 60, dt)) {
						for (const o of this.insects) if (o !== b && o.behavior === 'perch' && o.mode === 'ground' && o.fright == null && Math.hypot(o.x - b.x, o.y - b.y) < 110) o.fright = 0.12 + Math.random() * 0.3;
						b.mode = 'seek'; b.gk = null;
						b.target = pick(b.p.on === 'buisson' ? P.bushes : P.trees) ?? b.target;
						b.ox = (Math.random() - 0.5) * (b.p.on === 'buisson' ? 30 : 60);
						b.vx = (b.vx ?? 0) * 0.3; b.vy = -70; b.flew = true;
						return;
					}
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
					if (b.k >= 1) { b.mode = 'walk'; b.timer = 8 + Math.random() * 16; }
					return;
				}
				b.timer -= dt;
				// Dérangé par le jardinier ou son chien qui passe tout près, il saute aussitôt.
				const near = [this.farmer, this.pet].some(a => a && !a.hidden && Math.hypot(a.x - b.x, a.y - b.y) < 40);
				if (b.timer <= 0 || (near && b.timer > 0.5)) {
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
			case 'bat': {
				// Vol vif et brisé : elle file d'une nuée d'insectes à l'autre (papillons autour des lanternes,
				// moustiques sur l'eau), en avale un au passage, puis repart ailleurs.
				if (b.leaving) return flyAway();
				b.timer -= dt;
				if (b.timer <= 0 || b.tx == null) {
					const w = b.p.water ? this.water(b.ci) : null;
					const swarms = (this.ambient ?? []).filter(s => s.n > 0 && this.cellAt(s.x, s.y) === b.ci);
					b.prey = swarms.length && Math.random() < 0.6 ? pick(swarms) : null;
					if (b.prey) { b.tx = b.prey.x + (Math.random() - 0.5) * 30; b.ty = b.prey.y - 40; }
					else if (w) { b.tx = w.x + (Math.random() - 0.5) * w.rx * 1.6; b.ty = w.y - 20 + (Math.random() - 0.5) * w.ry; }
					else { b.tx = P.ox + PARCEL_W * (0.15 + Math.random() * 0.7); b.ty = P.oy + PARCEL_H * (0.15 + Math.random() * 0.7); }
					b.timer = 0.8 + Math.random() * 1.6;
				}
				b.x += Math.sin(b.t * 9 + b.timer) * 26 * dt;
				b.y += Math.cos(b.t * 7.3) * 18 * dt;
				if (flyTo(b.tx, b.ty, 130, 40) < 6) {
					if (b.prey && Math.random() < 0.5) b.prey.n = Math.max(1, b.prey.n - 1);
					b.prey = null; b.timer = 0;
				}
				b.ang = Math.atan2(b.ty - b.y, b.tx - b.x);
				return;
			}
			case 'soar': {
				if (b.leaving) return flyAway();
				b.ang += dt * (b.spin ?? 0.25);
				// Le centre du cercle dérive lentement, porté par le vent, sans quitter la parcelle.
				const sd = b.seed ?? 0, cx = (b.cx ?? midX) + Math.sin(b.t * 0.03 + sd) * 60, cy = (b.cy ?? P.oy + PARCEL_H / 2) + Math.cos(b.t * 0.023 + sd) * 40;
				b.x = cx + Math.cos(b.ang) * b.r * 1.3;
				b.y = cy + Math.sin(b.ang) * b.r * 0.7;
				b.dir = Math.sin(b.ang) * Math.sign(b.spin ?? 1) > 0 ? -1 : 1;
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
		const gx0 = Math.floor((v.x0 - 10) / PARCEL_W), gx1 = Math.floor((v.x0 + v.w + 10) / PARCEL_W);
		const gy0 = Math.floor((v.y0 - 10) / PARCEL_H), gy1 = Math.floor((v.y0 + v.h + 10) / PARCEL_H);
		// Toutes les cases à l'écran dans la même version : de loin, ou s'il y en a plus que la mémoire n'en garde
		// en détail (9), toutes légères. Une case nette à côté d'une floue dessinait un trait droit dans le paysage.
		const lo = this.cam.z < 0.6 || (gx1 - gx0 + 1) * (gy1 - gy0 + 1) > HI_TILES;
		this.tilesSeen = (gx1 - gx0 + 1) * (gy1 - gy0 + 1);
		world();
		// Chaque tuile déborde d'un pixel d'écran sur la suivante : sans ça, un fin trait clair apparaît aux raccords.
		const seam = 1.5 / this.scale;
		for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
			const tile = this.tileFor(gx, gy, lo);
			if (tile) ctx.drawImage(tile, gx * PARCEL_W, gy * PARCEL_H, PARCEL_W + seam, PARCEL_H + seam);
			else { ctx.fillStyle = this.groundColor(GROUND[this.tileAt(gx, gy).biome].base); ctx.fillRect(gx * PARCEL_W, gy * PARCEL_H, PARCEL_W, PARCEL_H); }
		}
		if (!glyph) this.drawStreams(ctx, v, gx0, gx1, gy0, gy1);
		// Ombres de nuages, plus denses par temps couvert. Sous la brume : elles assombrissent le sol, jamais le brouillard.
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

		this.drawMist(ctx, world, cw, ch);
		this.trimTiles();

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
				const big = { hedgehog: 2.6, frog: 1.8, marmot: 2.6, squirrel: 2, heron: 2.4, eagle: 5, gull: 3, crab: 1.8, rabbit: 3, hare: 3.4, roe: 6, chamois: 5.6, fox: 5, boar: 6, badger: 4.4, farmer: 3.4, dog: 3.6, cat: 2.8 }[b.kind] ?? 1;
				ctx.beginPath();
				ctx.ellipse(b.x + h * 0.25, b.y + h, 4 * big, 1.8 * big, 0, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		// Décor, plantes et animaux au sol, triés par profondeur.
		const entities = [];
		for (const key of Object.keys(DECOR)) {
			if (!this.decorVisible(key)) continue;
			const d = this.decorPos(key);
			entities.push({ decor: key, x: d.x, y: d.y });
		}
		for (const p of place.plants) {
			if (p === this.lifted) continue;
			const [wx, wy] = plantPos(p), box = PLANT_TYPES[p.type].box;
			if (wx + box.w < v.x0 || wx - box.w > v.x0 + v.w || wy - box.ay > v.y0 + v.h + 20 || wy + 30 < v.y0) continue;
			entities.push({ plant: p, x: wx, y: wy });
		}
		for (const it of this.items) if (it !== this.lifted && it.x > v.x0 - 120 && it.x < v.x0 + v.w + 120 && it.y > v.y0 - 40 && it.y < v.y0 + v.h + 200) entities.push({ item: it, x: it.x, y: it.y });
		if (!glyph) for (const b of this.insects) if (onGround(b)) entities.push({ critter: b, y: b.behavior === 'trail' ? -1e9 : b.y + 2 });
		if (!glyph && this.farmer && !this.farmer.hidden) entities.push({ critter: this.farmer, y: this.farmer.y + 2 });
		if (!glyph && this.pet && !this.pet.hidden) entities.push({ critter: this.pet, y: this.pet.y + 2 });
		if (!glyph) for (const h of this.hens ?? []) if (!h.hidden) entities.push({ critter: h, y: h.y + 2 });
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
				// Vue d'ensemble : l'objet garde sa vraie image (une cabane reste une cabane), pour qu'on se repère.
				if (glyph) {
					ctx.drawImage(this.itemSprite(it.kind, it.rot, it).canvas, e.x - box.ax, e.y - box.ay, box.w, box.h);
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
				if (!glyph && it.kind === 'mare') this.pondLife(ctx, 0.75, it.x);
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
				if (!glyph && POND_SIZE[e.decor]) this.pondLife(ctx, POND_SIZE[e.decor], e.x);
				if (!glyph && (d.water || e.decor === 'nenuphars')) {
					// Le triton nage sous les nénuphars, le canard flotte par-dessus.
					world();
					const lilies = this.decorVisible('nenuphars');
					for (const b of this.insects) {
						if (!b.p.swim || b.ci !== this.heart(d.place)) continue;
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
			// Tout juste replanté : il s'écrase un peu en touchant le sol, puis se redresse en rebondissant.
			const ra = this.replantAt?.id === p.id ? this.t - this.replantAt.t : 9;
			const sq = ra < 0.7 ? Math.sin((ra / 0.7) * Math.PI * 2) * 0.1 * (1 - ra / 0.7) : 0;
			world();
			ctx.translate(e.x, e.y);
			ctx.transform(k * (1 + sq), 0, 0, k * (1 - sq), 0, 0);
			if (p.type === 'arbre') {
				// Le tronc reste planté ; seule la couronne balance, à partir du haut du tronc (sans cassure au raccord).
				const cut = -box.ay * 0.42;
				ctx.save(); ctx.beginPath(); ctx.rect(-box.ax, cut, box.w, box.h); ctx.clip();
				ctx.drawImage(img.canvas, -box.ax, -box.ay, box.w, box.h);
				ctx.restore();
				ctx.save(); ctx.beginPath(); ctx.rect(-box.ax - 40, -box.ay - 10, box.w + 80, box.ay * 0.58 + 10.5); ctx.clip();
				ctx.translate(0, cut); ctx.transform(1, 0, shear, 1, 0, 0); ctx.translate(0, -cut);
				ctx.drawImage(img.canvas, -box.ax, -box.ay, box.w, box.h);
				ctx.restore();
			} else {
				ctx.transform(1, 0, shear, 1, 0, 0);
				const art = plantArt(p);
				ctx.drawImage(img.canvas, -art.ax, -art.ay, art.w, art.h);
			}
		}

		// Animaux en l'air et particules
		world();
		if (!glyph) for (const b of this.insects) if (!onGround(b) && !b.p.swim) this.drawInsect(ctx, b);
		for (const p of this.particles) {
			if (p.ring) {
				ctx.globalAlpha = Math.min(1, Math.max(0, p.life)) * 0.85;
				ctx.strokeStyle = p.color;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
				ctx.stroke();
				continue;
			}
			ctx.globalAlpha = Math.max(0, p.life) * (p.puff ? 0.45 : p.glow ? 0.75 : 1);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			if (p.leaf) ctx.ellipse(p.x, p.y, p.size, p.size * 0.45, p.rot, 0, Math.PI * 2);
			else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;

		// Lumière de l'heure, de la saison et du temps
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		// La couleur : l'image repasse sur elle-même en « lumière douce », comme une seconde couche d'aquarelle. Les
		// couleurs se saturent, les sombres se creusent, les blancs restent doux (pas de contour dur). Réglable (tuning).
		const vivid = this.vivid ?? this.state.vivid ?? 0.75;
		if (vivid > 0.01) {
			ctx.globalCompositeOperation = 'soft-light';
			ctx.globalAlpha = vivid;
			ctx.drawImage(this.canvas, 0, 0);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}
		// Vu de loin, c'est une carte : ni l'heure ni le temps ne l'assombrissent.
		if (!glyph && !this.state.intro && amb.a > 0.001) {
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
		if (grey && !glyph) {
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

		if (!glyph) { world(); this.drawAmbient(ctx, v); }

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

		// Vers luisants : la femelle brille posée au pied d'une herbe, d'une lueur verte qui respire lentement ;
		// le mâle, plus discret, vole doucement autour.
		if (!glyph && night > 0 && !this.precip()) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalCompositeOperation = 'lighter';
			const n = this.glow.width;
			for (const s of this.ambient ?? []) {
				if (s.kind !== 'glow') continue;
				const t = this.t + s.ph;
				const wx = s.male ? s.x + Math.sin(t * 0.37) * 26 + Math.sin(t * 1.3) * 5 : s.x;
				const wy = s.male ? s.y + Math.sin(t * 0.29) * 10 + Math.cos(t * 1.1) * 4 : s.y;
				const x = wx * S + tx, y = wy * S + ty;
				if (x < -40 || x > cw + 40 || y < -40 || y > ch + 40) continue;
				const size = n * this.cam.z * (s.male ? 0.35 : 0.7);
				const a = night * (s.male ? 0.35 + 0.25 * Math.sin(t * 3) : 0.7 + 0.3 * Math.sin(t * 0.8));
				ctx.globalAlpha = a;
				ctx.drawImage(this.glow, x - size / 2, y - size / 2, size, size);
				// Le petit point de lumière vert-jaune, bien net au cœur de la lueur.
				ctx.fillStyle = 'rgb(200,255,120)';
				ctx.beginPath(); ctx.arc(x, y, (s.male ? 0.9 : 1.6) * S, 0, Math.PI * 2); ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}

		if (!glyph && this.dew?.length) { world(); this.drawDew(ctx); }
		if (!glyph && this.items.some(it => it.kind === 'collecteur')) { world(); this.drawJarTags(ctx); }
		if (!glyph && this.farmer?.hidden) { world(); this.drawSmoke(ctx); }
		if (this.floats?.length) { world(); this.drawFloats(ctx); }
		if (this.farmer?.say && this.t < this.farmer.say.until) { world(); this.drawSay(ctx, this.farmer); }

		if (this.ghost) {
			const { kind, x, y } = this.ghost, box = this.ghostBox(kind, this.ghost.level, this.ghost.plant), ok = this.canPlace(kind, x, y, this.lifted);
			world();
			ctx.globalAlpha = 0.6;
			const img = kind === 'plant' ? this.spriteFor(this.ghost.plant, false)?.canvas : this.itemSprite(kind, this.ghost.rot, this.lifted?.kind === 'potager' ? null : this.lifted).canvas;
			const art = kind === 'plant' ? plantArt(this.ghost.plant) : box;
			if (img) ctx.drawImage(img, x - art.ax, y - art.ay, art.w, art.h);
			ctx.globalAlpha = 1;
			// Le pied de l'objet et sa portée bougent doucement : pointillés qui tournent, halo qui respire, et une onde
			// qui part du centre vers le bord de la portée. On les voit tout de suite, même sur un jardin chargé.
			const z = this.cam.z, t = this.t, pulse = 0.5 + 0.5 * Math.sin(t * 4);
			const rx = box.w * (kind === 'plant' ? 0.25 : 0.42), ry = box.w * (kind === 'plant' ? 0.08 : 0.14);
			const col = ok ? '95,147,62' : '192,68,47';
			if (this.nearUse?.[kind]) {
				const R = this.nearR;
				ctx.fillStyle = 'rgba(244,194,62,0.10)';
				ctx.beginPath(); ctx.ellipse(x, y, R, R, 0, 0, Math.PI * 2); ctx.fill();
				// L'onde : un anneau qui grandit jusqu'au bord et s'efface.
				const w = (t * 0.6) % 1;
				ctx.strokeStyle = `rgba(244,194,62,${0.55 * (1 - w)})`;
				ctx.lineWidth = 3 / z;
				ctx.beginPath(); ctx.ellipse(x, y, R * (0.25 + 0.75 * w), R * (0.25 + 0.75 * w), 0, 0, Math.PI * 2); ctx.stroke();
				// Le bord : un trait clair dessous, des pointillés dorés qui tournent dessus.
				ctx.strokeStyle = 'rgba(255,250,235,0.7)';
				ctx.lineWidth = 5 / z;
				ctx.beginPath(); ctx.ellipse(x, y, R, R, 0, 0, Math.PI * 2); ctx.stroke();
				ctx.setLineDash([10 / z, 7 / z]);
				ctx.lineDashOffset = -t * 24 / z;
				ctx.strokeStyle = `rgba(226,160,30,${0.75 + 0.25 * pulse})`;
				ctx.lineWidth = 3 / z;
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.lineDashOffset = 0;
			}
			ctx.beginPath();
			ctx.ellipse(x, y, rx * (1 + 0.06 * pulse), ry * (1 + 0.06 * pulse), 0, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(${col},${0.16 + 0.14 * pulse})`;
			ctx.fill();
			ctx.strokeStyle = 'rgba(255,250,235,0.75)';
			ctx.lineWidth = 5 / z;
			ctx.stroke();
			ctx.setLineDash([7 / z, 5 / z]);
			ctx.lineDashOffset = -t * 18 / z;
			ctx.strokeStyle = `rgba(${col},0.95)`;
			ctx.lineWidth = 3 / z;
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.lineDashOffset = 0;
		}

		world();
		this.drawWeather(ctx);
		if (this.introFx) { world(); this.introFx(ctx); }
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

		if (glyph || this.lockedCells().some(c => this.lockedInfo?.(c))) this.drawLabels(ctx, glyph, S, tx, ty);
		// Les pastilles passent par-dessus tout, étiquettes des parcelles comprises.
		if (this.cam.z < POI_Z && !this.ghost && !this.state.intro) this.drawPOI(ctx, S, tx, ty);
		else this.poiHits = null;
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

	/** Le pourtour des clairières ouvertes, calculé une fois par forme du jardin : la brume de la lisière s'y pose. */
	edges() {
		const n = cellsOpen(this.place), key = `${n}|${this.scaleSig()}`;
		if (this.edgeCache?.key === key) return this.edgeCache;
		const open = this.openCells();
		const box = pts => {
			const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
			return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
		};
		const fence = [];
		for (const i of open) for (const run of this.outerRuns(i, open.filter(j => j !== i))) fence.push({ run, ...box(run) });
		this.edgeCache = { key, fence };
		return this.edgeCache;
	}

	/** Étiquettes : en vue d'ensemble, chaque parcelle ; toujours, ce qu'il faut pour ouvrir la suivante. */
	drawLabels(ctx, all, S, tx, ty) {
		const dpr = this.dpr, place = this.place;
		const km = place.km ?? 0;
		ctx.textAlign = 'center';
		const cells = all ? [...this.openCells(), ...this.lockedCells()] : this.lockedCells();
		// Vue d'ensemble : seules les parcelles voisines du jardin disent « Terre inconnue » ; les étiquettes qui se
		// chevaucheraient ne sont pas dessinées (les parcelles ouvertes passent d'abord).
		const openPos = this.openCells().map(c => cellPos(c));
		const frontier = i => { const [gx, gy] = cellPos(i); return openPos.some(([x, y]) => Math.abs(x - gx) + Math.abs(y - gy) === 1); };
		const taken = [];
		const free = (x0, y0, x1, y1) => !taken.some(r => x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]);
		for (const i of cells) {
			const [ox, oy] = cellOrigin(i);
			const isOpen = i < cellsOpen(place);
			const info = isOpen ? null : this.lockedInfo?.(i);
			// Une parcelle qu'on ne peut pas encore explorer ne dit rien : on ne dévoile pas la suite.
			if (!isOpen && !info) continue;
			if (all && !isOpen && !frontier(i)) continue;
			const title = isOpen ? cellName(place, i) : info.title;
			// Vu de loin, une parcelle fermée ne dit que l'essentiel (le prix, ou ce qu'il manque).
			const grow = isOpen && this.cellScale(i) < 1 ? this.growInfo?.(i) : null;
			let sub = isOpen ? grow ?? `${place.plants.filter(p => cellOf(p) === i && p.growth >= 1).length} plantes` : all ? info.hint : info.sub;
			// Centre de la parcelle à l'écran ; une parcelle fermée garde son étiquette visible tant qu'on en voit un bout.
			const cw = this.canvas.width, ch = this.canvas.height;
			const sx0 = ox * S + tx, sx1 = (ox + PARCEL_W) * S + tx, sy0 = oy * S + ty, sy1 = (oy + PARCEL_H) * S + ty;
			// De loin, l'étiquette suit la taille de la parcelle à l'écran ; trop petite, juste son nom, sans cadre.
			const cellW = sx1 - sx0, tiny = all && cellW < 110 * dpr;
			if (all && cellW < 46 * dpr) continue;
			if (tiny) {
				// De très loin, les terres inconnues ne disent rien : la carte reste lisible.
				if (!isOpen) continue;
				const fs = Math.max(9, Math.min(13, cellW / dpr / 8)) * dpr;
				ctx.font = `${Math.round(fs)}px Courgette, cursive`;
				const label = cellName(place, i);
				let tw2 = ctx.measureText(label).width, txt = label;
				while (tw2 > cellW - 6 * dpr && txt.length > 4) { txt = `${txt.slice(0, -2)}…`; tw2 = ctx.measureText(txt).width; }
				const cx = (sx0 + sx1) / 2, cy = (sy0 + sy1) / 2;
				if (!free(cx - tw2 / 2 - 4 * dpr, cy - fs, cx + tw2 / 2 + 4 * dpr, cy + 4 * dpr)) continue;
				taken.push([cx - tw2 / 2 - 4 * dpr, cy - fs, cx + tw2 / 2 + 4 * dpr, cy + 4 * dpr]);
				ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(253,247,231,0.85)'; ctx.lineJoin = 'round';
				ctx.strokeText(txt, cx, cy);
				ctx.fillStyle = isOpen ? '#1F6B47' : '#8A846E';
				ctx.fillText(txt, cx, cy);
				continue;
			}
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
			const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
			ctx.font = `${Math.round((all ? 12 : 13) * dpr)}px Nunito, sans-serif`;
			const sw = ctx.measureText(sub).width;
			ctx.font = `${Math.round((all ? 15 : 20) * dpr)}px Courgette, cursive`;
			const w = Math.min(room, Math.max(tw, sw, (all ? 70 : 130) * dpr) + (all ? 16 : 32) * dpr);
			// Une ligne trop longue pour l'étiquette : on garde l'essentiel (le prix, sans les km), puis on coupe.
			if (all && sw > w - 10 * dpr) {
				ctx.font = `${Math.round(12 * dpr)}px Nunito, sans-serif`;
				sub = sub.split(' · ')[0];
				while (ctx.measureText(sub).width > w - 10 * dpr && sub.length > 4) sub = `${sub.slice(0, -2)}…`;
				ctx.font = `${Math.round(15 * dpr)}px Courgette, cursive`;
			}
			let x = (sx0 + sx1) / 2, y = (sy0 + sy1) / 2;
			if (!all) {
				const seenW = Math.min(sx1, cw) - Math.max(sx0, 0), seenH = Math.min(sy1, ch) - Math.max(sy0, 0);
				// Parcelle hors de l'écran ou à peine visible : une petite flèche au bord, vers elle.
				if (seenW < w + 16 * dpr || seenH < 200 * dpr) {
					// Plusieurs voisines possibles : on ne montre que celles qu'on voit, sans flèche au bord.
					if (this.lockedCells().filter(c => this.lockedInfo?.(c)).length === 1) this.drawEdgeHint(ctx, sx0, sx1, sy0, sy1, info.hint);
					continue;
				}
				x = Math.max(Math.max(sx0, 0) + w / 2 + 8 * dpr, Math.min(Math.min(sx1, cw) - w / 2 - 8 * dpr, x));
				y = Math.max(Math.max(sy0, 0) + 140 * dpr, Math.min(Math.min(sy1, ch) - 260 * dpr, y));
			}
			const r0 = [x - w / 2, y - 34 * dpr - extra / 2, x + w / 2, y + 28 * dpr + extra / 2];
			if (all && !free(...r0)) continue;
			taken.push(r0);
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
		ctx.save();
		ctx.translate(b.x, b.y - (b.lift ?? 0));
		const k = CRITTER_SIZE[b.kind] ?? 1;
		if (b.kind === 'farmer' || b.kind === 'dog' || b.kind === 'cat' || b.kind === 'hen') {
			const vx = b.x - (b.vx0 ?? b.x), vy = b.y - (b.vy0 ?? b.y);
			b.vx0 = b.x; b.vy0 = b.y;
			if (Math.hypot(vx, vy) > 0.02) b.view = Math.abs(vy) > Math.abs(vx) * 1.2 ? (vy > 0 ? 'down' : 'up') : 'side';
			// Une tâche (ratisser, arroser, cueillir…) se fait toujours de profil.
			if (!['run', 'stand', 'stroll'].includes(b.mode)) b.view = 'side';
			if (b.view !== 'side' || SHEET_READY(b)) {
				ctx.scale(k, k);
				if (!drawFromSheet(ctx, b)) drawCritter(ctx, b.kind, b.t, b.mode, b.p, b);
				ctx.restore();
				return;
			}
		}
		const off = TOPDOWN[b.kind];
		if (off != null && b.head != null) {
			// Vue de dessus : la tête pointe vers la vitesse ; dans un virage, les ailes se resserrent (inclinaison).
			ctx.rotate(b.head + off);
			ctx.scale(k, k * (1 - Math.min(0.3, Math.abs(b.bank ?? 0) * 0.5)));
		} else {
			// De profil : nez qui monte ou pique, et demi-tour en quelques images (la bête s'amincit puis se retourne).
			if (b.pitch) ctx.rotate(b.pitch);
			const f = b.face ?? (b.dir || 1);
			ctx.scale((Math.abs(f) < 0.15 ? (f < 0 ? -0.15 : 0.15) : f) * k, k);
		}
		if (b.kind === 'hare') b.winter = (this.season?.winter ?? 0) > 0.5;
		drawCritter(ctx, b.kind, b.t, b.mode, b.p, b);
		ctx.restore();
		// En promenade, une laisse souple relie la main du jardinier au collier du chien.
		const pet = this.pet;
		if (b === pet && pet.kind === 'dog' && this.farmer?.mode === 'stroll' && this.farmer.hand) {
			const f = this.farmer, fk = CRITTER_SIZE.farmer, pk = CRITTER_SIZE.dog;
			const hx = f.x + f.hand[0] * f.dir * fk, hy = f.y + f.hand[1] * fk;
			const cx = pet.x + pet.dir * 9 * pk, cy = pet.y - 13 * pk;
			ctx.strokeStyle = 'rgba(120,40,30,0.85)';
			ctx.lineWidth = 1.2;
			ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + cx) / 2, Math.max(hy, cy) + 12, cx, cy); ctx.stroke();
		}
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
