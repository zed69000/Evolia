// Règles du jeu (activités, effort) et sauvegarde locale.

import { CELLS, PARCEL_W, PARCEL_H } from './zones.js';

// Seuils et multiplicateurs repris du prototype Unity (Assets/Data/Activities).
export const ACTIVITIES = [
	{ id: 'marche-lente', name: 'Marche lente', min: 1, mult: 0.8, base: 2.5, plant: 'herbe' },
	{ id: 'marche', name: 'Marche', min: 3.5, mult: 1, base: 4, plant: 'fleur' },
	{ id: 'marche-rapide', name: 'Marche rapide', min: 5, mult: 1.3, base: 5.5, plant: 'buisson' },
	{ id: 'marche-tres-rapide', name: 'Marche très rapide', min: 6.5, mult: 1.6, base: 7, plant: 'buisson' },
	{ id: 'jogging', name: 'Jogging', min: 7.5, mult: 2, base: 8, plant: 'buisson' },
	// La randonnée : une marche qui grimpe. Elle n'a pas de vitesse à elle, c'est le dénivelé qui la révèle
	// (voir hikeFor) ; plus d'effort que la marche, et des arbres plutôt que des fleurs.
	{ id: 'randonnee', name: 'Randonnée', min: Infinity, mult: 1.4, base: 4, plant: 'arbre', hike: true },
	// Le trail : la même chose en courant, dans les montées et les descentes.
	{ id: 'trail', name: 'Trail', min: Infinity, mult: 3, base: 9, plant: 'arbre', hike: true },
	{ id: 'course', name: 'Course', min: 9, mult: 2.5, base: 10.5, plant: 'arbre' },
	{ id: 'course-rapide', name: 'Course rapide', min: 12, mult: 3, base: 13.5, plant: 'arbre' },
	{ id: 'sprint', name: 'Sprint', min: 15, mult: 4, base: 16, plant: 'arbre' },
	// À vélo : un vrai effort, mais on va bien plus loin qu'à pied ; un kilomètre à vélo compte pour 0,4 km
	// dans la progression (parcelles, lieux, objectif du jour). Repéré par la vitesse, et par l'absence de pas.
	{ id: 'velo', name: 'Vélo', min: Infinity, mult: 0.9, base: 18, plant: 'arbre', counts: 0.4, bike: true },
	// Pas en intérieur (ménage, cuisine, maison) : seulement détecté par la cadence, jamais par le GPS.
	{ id: 'menage', name: 'Ménage et petits pas', min: Infinity, mult: 0.5, base: 1, plant: 'herbe', indoor: true },
];

export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map(a => [a.id, a]));

/** Au-delà, on considère que la personne est en vélo ou en voiture. */
export const MAX_SPEED_KMH = 35;
export const BIKE_KMH = 16;

/** L'activité d'après la vitesse ; `noSteps` : le téléphone ne sent aucun pas (on pédale, on ne court pas). */
export function activityFor(speedKmh, noSteps = false) {
	if (speedKmh > MAX_SPEED_KMH) return null;
	if (speedKmh >= BIKE_KMH || (noSteps && speedKmh >= 11)) return ACTIVITY_BY_ID.velo;
	let best = null;
	for (const a of ACTIVITIES) if (speedKmh >= a.min) best = a;
	return best;
}

/**
 * Randonnée (ou trail) ou simple marche (ou course) ? `log` : les derniers échantillons GPS { t, dist, climb } (en ms, m, m gravis).
 * On parle de randonnée quand, à allure de marche, on a monté au moins 25 m en 10 minutes (ou sur une pente
 * moyenne de 6 % ou plus) ; une fois partie, elle continue dans les montées, les descentes et les courts replats tant
 * qu'on a encore monté ou descendu au moins 10 m sur les 10 dernières minutes.
 */
export const HIKE_WINDOW = 10 * 60000;
export function hikeFor(log, now, wasHiking) {
	let climb = 0, drop = 0, dist = 0;
	for (const e of log) if (now - e.t <= HIKE_WINDOW) { climb += e.climb; drop += e.drop ?? 0; dist += e.dist; }
	// Partie, elle continue tant que ça monte ou que ça descend encore (le trail, c'est aussi les descentes).
	if (wasHiking) return climb + drop >= 10;
	return climb >= 25 || (dist >= 150 && climb / dist >= 0.06);
}

export function effortFor(distanceM, speedKmh, act) {
	const speedFactor = Math.max(0.5, Math.min(1.5, speedKmh / act.base));
	return (distanceM / 10) * act.mult * speedFactor;
}

export const STEP_LENGTH_M = 0.75;

/**
 * Une sortie fait pousser un peu de tout : l'allure choisit la plante dominante, le reste va aux étages du dessous.
 * Le coureur a ainsi aussi des fleurs (et leurs butineurs), la marcheuse quelques herbes.
 */
const MIX = {
	arbre: [['fleur', 0.15], ['buisson', 0.25], ['arbre', 0.6]],
	buisson: [['herbe', 0.15], ['fleur', 0.25], ['buisson', 0.6]],
	fleur: [['herbe', 0.25], ['fleur', 0.75]],
	herbe: [['herbe', 1]],
};
export const effortMix = plant => MIX[plant] ?? [[plant, 1]];

const KEY = 'evolia.v1';

export function dayKey(d = new Date()) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const newPlace = () => ({ plants: [], worldH: 1000, unlocked: {}, km: 0, arrived: Date.now(), biomes: ['prairie'] });

// ─── Un seul jardin, un milieu par parcelle ─────────────────────
// Depuis la 0.7, tous les milieux vivent dans le même jardin : chaque parcelle a le sien (place.biomes[ci]).
// La première parcelle d'un milieu est son « cœur » : ses mares, ses vieux arbres, ses décors.

export const GARDEN = 'jardin';
export const BIOMES = ['prairie', 'marais', 'foret', 'montagne', 'littoral'];
/** Le milieu d'une parcelle. */
export const biomeOf = (place, ci = 0) => place?.biomes?.[ci] ?? 'prairie';
/** La parcelle cœur d'un milieu, ou -1 s'il n'est pas (encore) dans le jardin. */
export const heartOf = (place, biome) => (place?.biomes ?? ['prairie']).indexOf(biome);
/** Le rang d'une parcelle parmi celles de son milieu (0 : le cœur). */
export function rankOf(place, ci) {
	const b = biomeOf(place, ci);
	let n = 0;
	for (let j = 0; j < ci; j++) if (biomeOf(place, j) === b) n++;
	return n;
}
/** Les milieux présents dans le jardin. */
export const biomesIn = place => new Set(place?.biomes ?? ['prairie']);
/** Kilomètres faits depuis que le cœur d'un milieu est dans le jardin (pour ses décors). */
export const biomeKm = (place, biome) => Math.max(0, (place?.km ?? 0) - (place?.heartKm?.[biome] ?? 0));

function fresh() {
	return {
		createdAt: Date.now(),
		goalKm: 2.5,
		v: 3,
		place: GARDEN,
		places: { [GARDEN]: newPlace() },
		walks: [],
		days: {},
		totals: { distance: 0, effort: 0, walks: 0, steps: 0 },
		species: {},
		lastHarvest: Date.now(),
		harvestSource: null,
		nectar: 0,
		lastIdle: Date.now(),
		boostUntil: 0,
	};
}

/** Avant les lieux (v1), il n'y avait qu'un jardin : il devient la prairie. */
function migrate(s) {
	if (s.v >= 2) return s;
	const { mushrooms, ...unlocked } = s.unlocked ?? {};
	s.places = { prairie: { plants: s.plants ?? [], worldH: s.worldH ?? 1000, unlocked, km: (s.totals?.distance ?? 0) / 1000, arrived: s.createdAt } };
	s.place = 'prairie';
	delete s.plants; delete s.worldH; delete s.unlocked;
	s.v = 2;
	return s;
}

/**
 * 0.7 : les lieux (prairie, marais, forêt…) deviennent les parcelles d'un seul jardin. On les met bout à bout,
 * dans l'ordre des lieux : chaque plante garde sa place dans sa parcelle, chaque objet suit la sienne.
 */
function mergePlaces(s) {
	if (s.v >= 3) return s;
	const km = (s.totals?.distance ?? 0) / 1000;
	const G = { ...newPlace(), biomes: [], items: [], km, xp: 0, succ: {}, upgrades: {}, heartKm: {}, renewed: {}, seeded: true, arrived: s.createdAt ?? Date.now() };
	const at = (x, y) => CELLS.findIndex(([gx, gy]) => gx === Math.floor(x / PARCEL_W) && gy === Math.floor(y / PARCEL_H));
	for (const id of BIOMES) {
		const P = s.places?.[id];
		if (!P) continue;
		const n = Math.min(CELLS.length, P.cells ?? 1), map = [];
		for (let i = 0; i < n && G.biomes.length < CELLS.length; i++) { map[i] = G.biomes.length; G.biomes.push(id); }
		if (!map.length) continue;
		for (const p of P.plants ?? []) {
			const j = map[p.c ?? 0];
			if (j == null) continue;
			if (j) p.c = j; else delete p.c;
			G.plants.push(p);
		}
		for (const it of P.items ?? []) {
			// L'objet suit sa parcelle (ou la plus proche, s'il était posé au bord).
			let i = at(it.x, it.y);
			if (map[i] == null) i = map.reduce((best, _, k) => {
				const d = Math.hypot((CELLS[k][0] + 0.5) * PARCEL_W - it.x, (CELLS[k][1] + 0.5) * PARCEL_H - it.y);
				return d < best.d ? { k, d } : best;
			}, { k: 0, d: Infinity }).k;
			const j = map[i];
			it.x += (CELLS[j][0] - CELLS[i][0]) * PARCEL_W;
			it.y += (CELLS[j][1] - CELLS[i][1]) * PARCEL_H;
			G.items.push(it);
		}
		Object.assign(G.unlocked, P.unlocked ?? {});
		G.xp += P.xp ?? 0;
		for (const [k, v] of Object.entries(P.succ ?? {})) G.succ[k] = (G.succ[k] ?? 0) + v;
		for (const [k, v] of Object.entries(P.upgrades ?? {})) G.upgrades[k] = (G.upgrades[k] ?? 0) + v;
		G.heartKm[id] = Math.max(0, km - (P.km ?? 0));
		G.renewed[id] = 1;
	}
	if (!G.biomes.length) G.biomes.push('prairie');
	G.cells = G.biomes.length;
	s.places = { [GARDEN]: G };
	s.place = GARDEN;
	s.v = 3;
	return s;
}

// ─── Plusieurs sauvegardes ───────────────────────────────────────
// Chaque partie a sa clé ; la première garde l'ancienne clé, pour que les jardins existants ne bougent pas.
const SLOTS_KEY = 'evolia.slots';
const keyOf = id => (id === 'main' ? KEY : `${KEY}.${id}`);

/** La liste des parties de ce téléphone et celle qui est en cours. */
export function slots() {
	try {
		const s = JSON.parse(localStorage.getItem(SLOTS_KEY));
		if (s?.list?.length && s.list.some(x => x.id === s.active)) return s;
	} catch (e) { /* pas encore de liste */ }
	return { active: 'main', list: [{ id: 'main', name: 'Ma partie', at: Date.now() }] };
}
const writeSlots = s => { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(s)); } catch (e) { /* idem */ } };

/** Ce qu'on montre d'une partie dans la liste : kilomètres, espèces, dernière fois qu'on y a joué. */
export function slotSummary(id) {
	try {
		const s = JSON.parse(localStorage.getItem(keyOf(id)));
		return s ? { km: (s.totals?.distance ?? 0) / 1000, species: Object.keys(s.species ?? {}).length, nectar: s.nectar ?? 0 } : null;
	} catch (e) { return null; }
}

/** Une nouvelle partie : vide, ou copie d'un jardin (`from`). Renvoie son identifiant. */
export function createSlot(name, from = null) {
	const s = slots(), id = Math.random().toString(36).slice(2, 9);
	s.list.push({ id, name, at: Date.now() });
	writeSlots(s);
	if (from) try { localStorage.setItem(keyOf(id), JSON.stringify(from)); } catch (e) { /* idem */ }
	return id;
}
/** La partie à charger au prochain démarrage. */
export function useSlot(id) {
	const s = slots();
	if (!s.list.some(x => x.id === id)) return;
	s.active = id;
	writeSlots(s);
}
export function renameSlot(id, name) {
	const s = slots(), it = s.list.find(x => x.id === id);
	if (it && name) { it.name = name; writeSlots(s); }
}
/** Efface une partie (jamais celle en cours). */
export function deleteSlot(id) {
	const s = slots();
	if (id === s.active) return;
	s.list = s.list.filter(x => x.id !== id);
	writeSlots(s);
	try { localStorage.removeItem(keyOf(id)); } catch (e) { /* idem */ }
}

export function load() {
	try {
		const raw = localStorage.getItem(keyOf(slots().active));
		if (raw) return mergePlaces(migrate({ ...fresh(), v: 1, ...JSON.parse(raw) }));
	} catch (e) { /* stockage indisponible : on repart d'un jardin neuf */ }
	return fresh();
}

/** Tous les spécimens, tous lieux confondus. */
export const allPlants = s => Object.values(s.places).flatMap(p => p.plants);

export function save(state) {
	try { localStorage.setItem(keyOf(slots().active), JSON.stringify(state)); } catch (e) { /* idem */ }
}

export function reset() {
	try { localStorage.removeItem(keyOf(slots().active)); } catch (e) { /* idem */ }
}

export function dayNumber(state) {
	const start = new Date(state.createdAt); start.setHours(0, 0, 0, 0);
	const now = new Date(); now.setHours(0, 0, 0, 0);
	return Math.round((now - start) / 86400000) + 1;
}

/**
 * Objectif du jour, fixé par le jeu : un peu plus que la moyenne des jours actifs de la semaine passée,
 * arrondi au demi-kilomètre, entre 1,5 et 12 km ; 2,5 km pour commencer.
 */
export function autoGoal(state) {
	const km = [];
	for (let i = 1; i <= 7; i++) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const m = state.days[dayKey(d)] ?? 0;
		if (m > 300) km.push(m / 1000);
	}
	if (!km.length) return state.goalKm ? Math.min(state.goalKm, 3) : 2.5;
	const avg = km.reduce((a, b) => a + b, 0) / km.length;
	return Math.max(1.5, Math.min(12, Math.round(avg * 1.1 * 2) / 2));
}

export function todayMeters(state) {
	return state.days[dayKey()] ?? 0;
}

export function addDistance(state, meters) {
	const k = dayKey();
	state.days[k] = (state.days[k] ?? 0) + meters;
	state.totals.distance += meters;
}
