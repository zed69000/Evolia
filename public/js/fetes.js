// Les fêtes du monde au jardin : à chaque fête, le jardin se décore tout seul (guirlandes, lanternes, lampes,
// citrouilles…), sans rien à acheter et sans toucher à l'économie, sauf quelques petites récompenses de jeu (lutins,
// œufs) et un défi. Plusieurs fêtes peuvent tomber en même temps (Noël et Hanoucca, Halloween et Diwali).
//
// Les fêtes à date fixe ont leur jour et leur mois ; les fêtes mobiles (calendriers lunaires, Pâques) ont une table de
// dates par année. À compléter avant 2031.
//
// En test : ?fete=noel force une fête (plusieurs : ?fete=noel,hanoucca), ?fete=aucune les coupe.

/** Les dates des fêtes mobiles, par année : [mois, jour] du jour principal. */
const MOBILE = {
	// Hanoucca : premier soir (huit soirs).
	hanoucca: { 2026: [12, 4], 2027: [12, 24], 2028: [12, 12], 2029: [12, 1], 2030: [12, 20] },
	// Nouvel An lunaire : le premier jour (la fête dure jusqu'à la fête des lanternes, quinze jours plus tard).
	lunaire: { 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] },
	// Ramadan : premier jour (environ 29 jours, puis l'Aïd el-Fitr). Dates à un jour près selon les pays.
	ramadan: { 2027: [2, 8], 2028: [1, 28], 2029: [1, 16], 2030: [1, 5] },
	holi: { 2027: [3, 22], 2028: [3, 11], 2029: [3, 1], 2030: [3, 20] },
	// Pâques : le dimanche.
	paques: { 2027: [3, 28], 2028: [4, 16], 2029: [4, 1], 2030: [4, 21] },
	miautomne: { 2026: [9, 25], 2027: [9, 15], 2028: [10, 3], 2029: [9, 22], 2030: [9, 12] },
	diwali: { 2026: [11, 8], 2027: [10, 29], 2028: [10, 17], 2029: [11, 5], 2030: [10, 26] },
};

/**
 * Les fêtes. `fixed` : [mois, jour] de début et de fin (la fin peut tomber l'année suivante). `mobile` : la clé de la
 * table et la fenêtre autour du jour principal, en jours [avant, après].
 */
export const FETES = {
	noel: {
		name: 'Noël', fixed: [[12, 1], [1, 6]], color: '#C8302C',
		hello: 'Noël s’installe au jardin : des guirlandes sur la cabane et les haies, un sapin décoré, et un bonnet pour l’épouvantail. Des lutins se cachent : trouve-les !',
	},
	hanoucca: {
		name: 'Hanoucca', mobile: ['hanoucca', 0, 7], color: '#3E78C8',
		hello: 'Hanoucca : chaque soir, une chandelle de plus s’allume sur la ménorah, près de la cabane.',
	},
	nouvelan: {
		name: 'Nouvel An', fixed: [[12, 31], [1, 1]], color: '#8A5CC8',
		hello: 'Bonne année ! Ce soir, des feux d’artifice éclairent le ciel du jardin.',
	},
	lunaire: {
		name: 'Nouvel An lunaire', mobile: ['lunaire', 1, 14], color: '#D03A2C',
		hello: 'Nouvel An lunaire : des lanternes rouges sont suspendues dans les arbres du jardin.',
	},
	ramadan: {
		name: 'Ramadan et Aïd', mobile: ['ramadan', 0, 31], color: '#2E8A7A',
		hello: 'Ramadan : le soir, des lanternes s’allument dans les arbres, sous le croissant de lune.',
	},
	holi: {
		name: 'Holi', mobile: ['holi', 1, 0], color: '#E0408A',
		hello: 'Holi, la fête des couleurs : des nuages de poudres colorées s’envolent au-dessus des fleurs.',
	},
	paques: {
		name: 'Pâques', mobile: ['paques', 2, 1], color: '#E8A93A',
		hello: 'Pâques : des œufs sont cachés dans le jardin. Trouve-les !',
	},
	hanami: {
		name: 'Hanami', fixed: [[3, 25], [4, 15]], color: '#E890B0',
		hello: 'Hanami, la fête des cerisiers en fleur : des pétales roses volent au-dessus du jardin.',
	},
	terre: {
		name: 'Jour de la Terre', fixed: [[4, 22], [4, 22]], color: '#3A8A4A',
		hello: 'Jour de la Terre : un défi spécial t’attend, marche 2 km pour la planète.',
	},
	abeilles: {
		name: 'Journée des abeilles', fixed: [[5, 20], [5, 20]], color: '#E8B33A',
		hello: 'Journée mondiale des abeilles : tes ruches sont en fête, avec leurs fanions.',
	},
	stjean: {
		name: 'Saint-Jean', fixed: [[6, 21], [6, 24]], color: '#E8822E',
		hello: 'Les nuits les plus courtes de l’année : un feu de la Saint-Jean brûle près de la cabane, et les lucioles sont partout.',
	},
	miautomne: {
		name: 'Fête de la mi-automne', mobile: ['miautomne', 1, 1], color: '#E8A93A',
		hello: 'Fête de la mi-automne : des lanternes rondes s’allument dans les arbres, sous la pleine lune.',
	},
	diwali: {
		name: 'Diwali', mobile: ['diwali', 2, 2], color: '#E8822E',
		hello: 'Diwali, la fête des lumières : de petites lampes à huile s’allument au bord des allées et devant la cabane.',
	},
	halloween: {
		name: 'Halloween', fixed: [[10, 20], [11, 2]], color: '#E8722E',
		hello: 'Halloween : des citrouilles sculptées veillent dans le jardin, et des chauves-souris volent à la tombée du jour.',
	},
	morts: {
		name: 'Jour des morts', fixed: [[11, 1], [11, 2]], color: '#E89A2E',
		hello: 'Jour des morts : des guirlandes d’œillets d’Inde orange fleurissent la cabane.',
	},
};

const DAY = 86400000;
const at = (y, m, d) => new Date(y, m - 1, d).getTime();

/** La période d'une fête qui contient `date` : [début, fin] en millisecondes (fin incluse), ou null. */
function windowOf(id, date) {
	const f = FETES[id], y = date.getFullYear(), t = new Date(y, date.getMonth(), date.getDate()).getTime();
	if (f.fixed) {
		const [[m1, d1], [m2, d2]] = f.fixed;
		for (const yy of [y - 1, y]) {
			const a = at(yy, m1, d1), b = at(m2 < m1 ? yy + 1 : yy, m2, d2);
			if (t >= a && t <= b) return [a, b];
		}
		return null;
	}
	const [key, before, after] = f.mobile;
	for (const yy of [y - 1, y]) {
		const md = MOBILE[key][yy];
		if (!md) continue;
		const c = at(yy, md[0], md[1]), a = c - before * DAY, b = c + after * DAY;
		if (t >= a && t <= b) return [a, b];
	}
	return null;
}

/** Les fêtes du jour (leurs identifiants). */
export function fetesAt(date = new Date()) {
	return Object.keys(FETES).filter(id => windowOf(id, date));
}

/** La première fête du jour, ou null (compatibilité). */
export const feteAt = (date = new Date()) => fetesAt(date)[0] ?? null;

/** Le jour de la fête (0 le premier jour) : sert à Hanoucca (une chandelle de plus chaque soir). */
export function feteDay(id, date = new Date()) {
	const w = windowOf(id, date);
	if (!w) return -1;
	return Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - w[0]) / DAY);
}

/** L'année d'une fête en cours (celle où elle a commencé), pour ne l'annoncer qu'une fois par an. */
export function feteYear(id, date = new Date()) {
	const w = windowOf(id, date);
	return w ? new Date(w[0]).getFullYear() : date.getFullYear();
}
