// Le quiz des fiches : trois questions sur les espèces dont on a lu la fiche, de temps en temps, quand il n'y a plus
// rien à aménager. Il montre si l'on lit les fiches, et rapporte du nectar : de plus en plus à mesure que la série de
// bonnes réponses s'allonge (et la base suit le gain d'une fiche, qui grandit avec les espèces et la production).

import { SPECIES, SPECIES_BY_ID, groupOf } from './species.js';
import { GUILDS, GUILD_OF } from './idle.js';

const WHEN_NAME = { day: 'Le jour', night: 'La nuit', dusk: 'Au crépuscule' };

/**
 * Trois questions par quiz, trois quiz par jour, qui se débloquent à 8 h, 13 h et 18 h. Ceux qu'on n'a pas faits
 * restent en réserve jusqu'à minuit (on peut tous les faire le soir) ; le lendemain, la réserve repart de zéro.
 */
export const QUIZ_LEN = 3, QUIZ_HOURS = [8, 13, 18], QUIZ_PER_DAY = QUIZ_HOURS.length;
/** Gardé pour l'ancien bouton « Plus tard » (il ne repousse plus rien). */
export const QUIZ_GAP = 0;
/** Il faut au moins tant de plantes et tant d'animaux dont la fiche est lue depuis la veille. */
export const QUIZ_MIN_PLANTS = 4, QUIZ_MIN_ANIMALS = 4;
/** Une espèce ne revient pas avant tant d'autres questions. */
const SPACING = 8;
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Les espèces dont on peut parler : fiche lue, découvertes avant aujourd'hui (on a eu le temps de lire). */
export function quizPool(state) {
	const today = dayOf(Date.now());
	return Object.keys(state.speciesSeen ?? {}).filter(id => {
		const sp = SPECIES_BY_ID[id], t = state.species[id];
		return state.speciesSeen[id] && sp && sp.kind !== 'milieu' && typeof t === 'number' && dayOf(t) !== today;
	});
}
/** Assez de plantes et d'animaux connus pour un quiz ? */
export function quizEnough(state) {
	const pool = quizPool(state).map(id => SPECIES_BY_ID[id]);
	return pool.filter(s => s.kind === 'plante').length >= QUIZ_MIN_PLANTS && pool.filter(s => s.kind === 'animal').length >= QUIZ_MIN_ANIMALS;
}
/** Note une réponse : l'historique sert à étaler les questions et garde le score de chaque espèce. */
export function noteAnswer(state, id, ok) {
	const qz = state.quiz ??= {};
	(qz.asked ??= []).push(id);
	if (qz.asked.length > 40) qz.asked.splice(0, qz.asked.length - 40);
	const r = (qz.score ??= {})[id] ??= { ok: 0, ko: 0 };
	if (ok) r.ok++; else r.ko++;
}
/** La série de bonnes réponses multiplie le gain : × 1, × 1,25, × 1,5… jusqu'à × 2. */
export const streakMult = streak => Math.min(2, 1 + 0.25 * streak);

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** La première phrase d'un texte, entière, ou null si elle est trop longue (jamais de réponse coupée par « … »). */
const sentence = txt => {
	const t = String(txt ?? '').split(/(?<=[.!?])\s/)[0].trim();
	return t && t.length <= 115 ? t : null;
};

// Les mots qui désignent une espèce (« merle », « marguerite »…), sans les mots trop courants (« grande », « petit »…).
const WORD_USE = {};
for (const sp of SPECIES) for (const w of new Set(norm(sp.name).split(/[^a-z]+/))) if (w.length >= 5) WORD_USE[w] = (WORD_USE[w] ?? 0) + 1;
const nameWords = sp => norm(sp.name).split(/[^a-z]+/).filter(w => w.length >= 5 && WORD_USE[w] <= 3);
/** Le texte nomme-t-il l'espèce ? (La réponse se lirait dans la question.) */
const names = (sp, txt) => { const t = norm(txt); return nameWords(sp).some(w => t.includes(w.slice(0, -1))); };

/** Trois réponses : la bonne et deux autres, mélangées ; null s'il n'y en a pas deux autres. */
function choices(right, others) {
	const pool = [...new Set(others.filter(o => o && o !== right))].slice(0, 2);
	return pool.length < 2 ? null : shuffle([right, ...pool]);
}

/**
 * Les autres espèces pour les mauvaises réponses. Facile : d'autres groupes (une plante face à des oiseaux, un
 * insecte face à des fleurs), on les distingue d'un coup d'œil. Moyen et difficile : le même groupe ; difficile, de
 * préférence des espèces que le joueur connaît (il a pu les confondre).
 */
function others(sp, state, level) {
	const g = groupOf(sp), known = o => !!state.species[o.id];
	const all = shuffle(SPECIES.filter(o => o.id !== sp.id && o.kind !== 'milieu'));
	if (level === 0) {
		const by = gr => all.filter(o => groupOf(o) === gr).sort((x, y) => known(y) - known(x));
		const [a, b] = ['plantes', 'insectes', 'animaux'].filter(gr => gr !== g);
		return [by(a)[0], by(b)[0], ...by(a).slice(1)].filter(Boolean);
	}
	const same = all.filter(o => groupOf(o) === g);
	return level === 2 ? same.sort((x, y) => known(y) - known(x)) : same;
}

/** Le genre d'une espèce : le type d'une plante (fleur, arbre…), la forme d'un animal (oiseau, papillon…). */
const sortOf = o => (o.kind === 'plante' ? o.type : o.critter?.kind);

/** Les niveaux, pour le joueur. */
export const QUIZ_LEVEL = ['Facile', 'Moyen', 'Plus dur'];

/**
 * Une question de ce niveau sur l'espèce `sp` (fiche lue), ou null si elle ne s'y prête pas. Chaque question montre
 * l'espèce (sa photo, son nom) et pose une question courte, complète, en « tu » ; les réponses sont des phrases
 * entières, sans nom d'espèce qui la trahirait.
 *   0 Facile   : « Qui est sur cette photo ? » face à des espèces d'autres groupes.
 *   1 Moyen    : la photo face au même groupe ; « Quand le vois-tu ? » ; sa famille au jardin ; ce qu'elle fait.
 *   2 Plus dur : « De quelle espèce parle cette phrase ? » ; comment l'aider ; ce qu'elle fait, face au même groupe.
 */
function questionFor(sp, state, level) {
	const alt = others(sp, state, level), show = { id: sp.id, name: sp.name };
	const kinds = level === 0 ? ['photo'] : level === 1 ? shuffle(['photo', 'when', 'family', 'role']) : shuffle(['fact', 'help', 'role']);
	for (const k of kinds) {
		if (k === 'photo') {
			const c = choices(sp.name, alt.map(o => o.name));
			if (c) return { sp: sp.id, kind: k, level, photo: sp.id, q: 'Qui est sur cette photo ?', choices: c, right: sp.name };
		}
		if (k === 'when' && WHEN_NAME[sp.critter?.when]) {
			const right = WHEN_NAME[sp.critter.when], c = choices(right, shuffle(Object.values(WHEN_NAME)));
			if (c) return { sp: sp.id, kind: k, level, show, q: 'À quel moment de la journée vois-tu le plus souvent cet animal ?', choices: c, right };
		}
		if (k === 'family' && GUILD_OF[sp.id]) {
			const right = GUILDS[GUILD_OF[sp.id]].name, c = choices(right, shuffle(Object.values(GUILDS).map(g => g.name)));
			if (c) return { sp: sp.id, kind: k, level, show, q: 'Dans ton jardin, à quelle famille appartient cet animal ?', choices: c, right };
		}
		if ((k === 'role' || k === 'help') && sentence(sp[k]) && !names(sp, sentence(sp[k]))) {
			const right = sentence(sp[k]);
			// Les autres réponses viennent d'espèces d'un autre genre (un arbre face à une fleur, un oiseau face à une
			// grenouille) : deux conseils presque pareils rendraient la question injuste.
			const c = choices(right, alt.filter(o => o.kind === sp.kind && sortOf(o) !== sortOf(sp)).map(o => { const t = sentence(o[k]); return t && !names(o, t) ? t : null; }));
			const q = k === 'role' ? 'Que fait cette espèce dans la nature ?' : 'Comment peux-tu aider cette espèce ?';
			if (c) return { sp: sp.id, kind: k, level, show, q, choices: c, right };
		}
		if (k === 'fact' && sentence(sp.fact) && !names(sp, sentence(sp.fact))) {
			const c = choices(sp.name, alt.map(o => o.name));
			if (c) return { sp: sp.id, kind: k, level, q: `De quelle espèce parle cette phrase ?<span class="quiz-quote">« ${sentence(sp.fact)} »</span>`, choices: c, right: sp.name };
		}
	}
	return null;
}

/**
 * Les niveaux des trois questions : du plus simple au plus dur. Les deux premiers quiz restent doux (facile,
 * facile, moyen), le temps de comprendre comment ça marche.
 */
export const quizLevels = state => ((state.quiz?.total ?? 0) < 2 ? [0, 0, 1] : [0, 1, 2]);

/** Un quiz : des espèces dont la fiche a été lue, de la question la plus simple à la plus dure. */
export function makeQuiz(state) {
	if (!quizEnough(state)) return null;
	// Jamais une espèce posée il y a peu : d'abord celles qu'on n'a jamais eues, puis les plus anciennes, en mêlant
	// plantes et animaux ; une espèce ratée revient plus tôt (mais jamais à la suite).
	const asked = state.quiz?.asked ?? [], recent = new Set(asked.slice(-SPACING));
	const lastAt = id => { const i = asked.lastIndexOf(id); return i < 0 ? -1e9 : i; };
	const missed = id => (state.quiz?.score?.[id]?.ko ?? 0) > (state.quiz?.score?.[id]?.ok ?? 0);
	const pool = quizPool(state).filter(id => !recent.has(id))
		.sort((a, b) => (lastAt(a) - (missed(a) ? 6 : 0)) - (lastAt(b) - (missed(b) ? 6 : 0)) || Math.random() - 0.5);
	const plants = pool.filter(id => SPECIES_BY_ID[id].kind === 'plante'), animals = pool.filter(id => SPECIES_BY_ID[id].kind === 'animal');
	const mixed = [];
	while (plants.length || animals.length) { if (animals.length) mixed.push(animals.shift()); if (plants.length) mixed.push(plants.shift()); }
	const out = [], used = new Set();
	for (const level of quizLevels(state)) {
		for (const id of mixed) {
			if (used.has(id)) continue;
			const q = questionFor(SPECIES_BY_ID[id], state, level);
			if (q) { out.push(q); used.add(id); break; }
		}
	}
	return out.length === QUIZ_LEN ? out : null;
}

/** Le quiz peut-il venir maintenant (attente, nombre par jour, fiches lues) ? */
/** Les quiz débloqués aujourd'hui à cette heure (0 à 3). */
export const quizUnlocked = (now = new Date()) => QUIZ_HOURS.filter(h => now.getHours() >= h).length;
/** Combien de quiz attendent en réserve (débloqués aujourd'hui, pas encore faits). */
export function quizBank(state, day) {
	const qz = state.quiz ??= {};
	if (qz.day !== day) { qz.day = day; qz.n = 0; }
	if (!quizEnough(state)) return 0;
	return Math.max(0, quizUnlocked() - (qz.n ?? 0));
}
/** L'heure du prochain quiz aujourd'hui, ou null. */
export const nextQuizHour = (now = new Date()) => QUIZ_HOURS.find(h => now.getHours() < h) ?? null;
export function quizReady(state, day) {
	return quizBank(state, day) > 0;
}

export { pick };
