// Règles du jeu (activités, effort) et sauvegarde locale.

// Seuils et multiplicateurs repris du prototype Unity (Assets/Data/Activities).
export const ACTIVITIES = [
	{ id: 'marche-lente', name: 'Marche lente', min: 1, mult: 0.8, base: 2.5, plant: 'herbe' },
	{ id: 'marche', name: 'Marche', min: 3.5, mult: 1, base: 4, plant: 'fleur' },
	{ id: 'marche-rapide', name: 'Marche rapide', min: 5, mult: 1.3, base: 5.5, plant: 'buisson' },
	{ id: 'marche-tres-rapide', name: 'Marche très rapide', min: 6.5, mult: 1.6, base: 7, plant: 'buisson' },
	{ id: 'jogging', name: 'Jogging', min: 7.5, mult: 2, base: 8, plant: 'buisson' },
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

export function effortFor(distanceM, speedKmh, act) {
	const speedFactor = Math.max(0.5, Math.min(1.5, speedKmh / act.base));
	return (distanceM / 10) * act.mult * speedFactor;
}

export const STEP_LENGTH_M = 0.75;

const KEY = 'evolia.v1';

export function dayKey(d = new Date()) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const newPlace = () => ({ plants: [], worldH: 1000, unlocked: {}, km: 0, arrived: Date.now() });

function fresh() {
	return {
		v: 2,
		createdAt: Date.now(),
		goalKm: 2.5,
		place: 'prairie',
		places: { prairie: newPlace() },
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

export function load() {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return migrate({ ...fresh(), v: 1, ...JSON.parse(raw) });
	} catch (e) { /* stockage indisponible : on repart d'un jardin neuf */ }
	return fresh();
}

/** Tous les spécimens, tous lieux confondus. */
export const allPlants = s => Object.values(s.places).flatMap(p => p.plants);

export function save(state) {
	try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* idem */ }
}

export function reset() {
	try { localStorage.removeItem(KEY); } catch (e) { /* idem */ }
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
