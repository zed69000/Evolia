// Le quiz des fiches : trois questions sur les espèces dont on a lu la fiche, de temps en temps, quand il n'y a plus
// rien à aménager. Il montre si l'on lit les fiches, et rapporte du nectar : de plus en plus à mesure que la série de
// bonnes réponses s'allonge (et la base suit le gain d'une fiche, qui grandit avec les espèces et la production).

import { SPECIES, SPECIES_BY_ID, PLACE_BY_ID } from './species.js';

/** Combien de questions par quiz, au plus de quiz par jour, et l'attente entre deux (en ms). */
export const QUIZ_LEN = 3, QUIZ_PER_DAY = 3, QUIZ_GAP = 3 * 3600000;
/** Il faut avoir lu au moins tant de fiches. */
export const QUIZ_MIN_READ = 5;
/** La série de bonnes réponses multiplie le gain : × 1, × 1,5, × 2… jusqu'à × 4. */
export const streakMult = streak => Math.min(4, 1 + 0.5 * streak);

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const first = txt => {
	const s = String(txt ?? '').split(/(?<=[.!?…])\s/)[0];
	return s.length > 120 ? `${s.slice(0, 117).replace(/\s+\S*$/, '')}…` : s;
};
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Le texte, sans le nom de l'espèce (ni ses premiers mots) : sinon la réponse saute aux yeux. */
function masked(sp, txt) {
	let out = String(txt ?? '');
	const words = [sp.name, ...sp.name.split(/\s+/).filter(w => w.length >= 4)];
	for (const w of words) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?', 'gi'), '…');
	return norm(out).includes(norm(sp.name.split(/\s+/)[0])) ? null : out;
}

/** Trois réponses : la bonne et deux autres du même genre, mélangées. */
function choices(right, others) {
	const pool = shuffle([...new Set(others.filter(o => o && o !== right))]).slice(0, 2);
	return pool.length < 2 ? null : shuffle([right, ...pool]);
}

/** Une question sur l'espèce `sp` (fiche lue), ou null si elle ne s'y prête pas. */
function questionFor(sp, state) {
	const same = SPECIES.filter(o => o.id !== sp.id && o.kind === sp.kind);
	const kinds = shuffle(['fact', 'role', 'help', 'place']);
	for (const k of kinds) {
		if (k === 'fact' && sp.fact) {
			const txt = masked(sp, first(sp.fact));
			// Les autres choix : de préférence des espèces que le joueur connaît aussi.
			const known = same.filter(o => state.species[o.id]).map(o => o.name);
			const c = choices(sp.name, [...shuffle(known), ...shuffle(same.map(o => o.name))].slice(0, 6));
			if (txt && c) return { sp: sp.id, kind: k, q: `Quelle espèce ? « ${txt} »`, choices: c, right: sp.name };
		}
		if (k === 'role' && sp.role) {
			const c = choices(first(sp.role), same.map(o => first(o.role)));
			if (c && masked(sp, first(sp.role))) return { sp: sp.id, kind: k, q: `À quoi sert : ${sp.name} ?`, choices: c.map(t => masked(sp, t) ?? t), right: masked(sp, first(sp.role)) };
		}
		if (k === 'help' && sp.help) {
			const c = choices(first(sp.help), same.map(o => first(o.help)));
			if (c) return { sp: sp.id, kind: k, q: `Comment aider : ${sp.name} ?`, choices: c, right: first(sp.help) };
		}
		if (k === 'place' && PLACE_BY_ID[sp.place]) {
			const c = choices(PLACE_BY_ID[sp.place].name, Object.values(PLACE_BY_ID).map(p => p.name));
			if (c) return { sp: sp.id, kind: k, q: `Où vit : ${sp.name} ?`, choices: c, right: PLACE_BY_ID[sp.place].name };
		}
	}
	return null;
}

/** Un quiz : des espèces dont la fiche a été lue (les plus récentes d'abord, un peu au hasard). */
export function makeQuiz(state) {
	const read = Object.keys(state.speciesSeen ?? {}).filter(id => state.speciesSeen[id] && SPECIES_BY_ID[id] && SPECIES_BY_ID[id].kind !== 'milieu');
	if (read.length < QUIZ_MIN_READ) return null;
	const recent = read.sort((a, b) => (state.species[b] ?? 0) - (state.species[a] ?? 0));
	const pool = shuffle(recent.slice(0, 12)).concat(shuffle(recent.slice(12)));
	const out = [];
	for (const id of pool) {
		if (out.length >= QUIZ_LEN) break;
		const q = questionFor(SPECIES_BY_ID[id], state);
		if (q) out.push(q);
	}
	return out.length === QUIZ_LEN ? out : null;
}

/** Le quiz peut-il venir maintenant (attente, nombre par jour, fiches lues) ? */
export function quizReady(state, day) {
	const qz = state.quiz ??= {};
	if (qz.day !== day) { qz.day = day; qz.n = 0; }
	if ((qz.n ?? 0) >= QUIZ_PER_DAY || Date.now() - (qz.at ?? 0) < QUIZ_GAP) return false;
	return Object.keys(state.speciesSeen ?? {}).length >= QUIZ_MIN_READ;
}

export { pick };
