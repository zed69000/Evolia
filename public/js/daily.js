// Revenir chaque jour : un cadeau qui grandit avec la série de jours actifs, trois petits défis,
// le prochain objectif toujours en vue, et l'album de tout ce qu'on a ouvert.
// Une journée « active » : au moins ACTIVE_M mètres. Rater un jour ne remet pas la série à zéro,
// elle est seulement divisée par deux : on encourage, on ne punit pas.

import { dayKey, todayMeters, allPlants, autoGoal } from './state.js';
import { PLACES, PLACE_BY_ID, PLACE_DE, SPECIES, SPECIES_BY_ID, placeOpen } from './species.js';
import { DECOR } from './plants.js';
import { CELLS, CELL_KM, cellsOpen } from './garden.js';
import { zoneName } from './zones.js';

export const ACTIVE_M = 500;

const fmt = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
const matureCount = state => allPlants(state).filter(p => p.growth >= 1).length;

/** Tirage stable pour la journée : les mêmes défis toute la journée, d'autres demain. */
function dayRng(key) {
	let h = 2166136261;
	for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
}

function makeChallenges(state, key) {
	const r = dayRng(key);
	const goal = state.goalKm ?? 3;
	const km = Math.max(1, Math.round(goal * [0.5, 0.75, 1][Math.floor(r() * 3)] * 2) / 2);
	const observe = r() < 0.5
		? { id: 'quest', kind: 'observe', n: 1 + Math.floor(r() * 2), reward: 25 }
		: { id: 'taps', kind: 'observe', n: 3 + Math.floor(r() * 2), reward: 25 };
	return [
		{ id: 'move', kind: 'move', n: km, reward: 40, boost: 30 },
		observe,
		{ id: 'bloom', kind: 'bloom', n: 2 + Math.floor(r() * 3), reward: 30 },
	];
}

/** Ouvre la journée : série, défis du jour, point de départ pour compter les plantes écloses. */
export function rollDay(state) {
	const key = dayKey();
	const d = state.daily ??= { streak: 0, best: 0 };
	if (d.day === key) return false;
	if (d.lastActive && d.lastActive !== yesterday() && d.lastActive !== key) d.streak = Math.floor(d.streak / 2);
	d.day = key;
	state.goalKm = autoGoal(state);
	d.challenges = makeChallenges(state, key);
	d.claimed = {};
	d.quests = 0;
	d.taps = [];
	d.matureStart = matureCount(state);
	return true;
}

/** À appeler quand des mètres s'ajoutent : le premier demi-kilomètre du jour allonge la série. */
export function markActive(state) {
	const d = state.daily;
	if (!d || d.lastActive === d.day || todayMeters(state) < ACTIVE_M) return false;
	d.streak += 1;
	d.lastActive = d.day;
	d.best = Math.max(d.best ?? 0, d.streak);
	return true;
}

export const giftReady = state => state.daily && state.daily.giftDay !== state.daily.day;

/** Cadeau du jour : du nectar, plus généreux avec la série ; à partir de 3 jours, un peu d'élan en plus. */
export function giftFor(state) {
	const s = state.daily?.streak ?? 0;
	return { nectar: 20 + 10 * Math.min(s, 10), boost: s >= 3 ? 15 + 5 * Math.min(s - 3, 9) : 0 };
}

export function claimGift(state) {
	const g = giftFor(state);
	state.daily.giftDay = state.daily.day;
	return g;
}

export function progress(state, c) {
	const d = state.daily;
	if (c.kind === 'move') return todayMeters(state) / 1000;
	if (c.id === 'quest') return d.quests ?? 0;
	if (c.id === 'taps') return (d.taps ?? []).length;
	if (c.kind === 'bloom') return Math.max(0, matureCount(state) - (d.matureStart ?? 0));
	return 0;
}

export const isDone = (state, c) => progress(state, c) >= c.n;
export const toClaim = state => (state.daily?.challenges ?? []).filter(c => isDone(state, c) && !state.daily.claimed[c.id]);

export function claim(state, id) {
	const c = state.daily.challenges.find(x => x.id === id);
	if (!c || !isDone(state, c) || state.daily.claimed[id]) return null;
	state.daily.claimed[id] = Date.now();
	return c;
}

export function noteTap(state, spId) {
	const d = state.daily;
	if (d && !d.taps.includes(spId)) d.taps.push(spId);
}

export function noteQuest(state) {
	if (state.daily) state.daily.quests = (state.daily.quests ?? 0) + 1;
}

const LABEL = {
	move: c => `Bouge ${fmt(c.n, c.n % 1 ? 1 : 0)} km aujourd'hui`,
	quest: c => `Gagne ${c.n} fois au jeu « Trouve… »`,
	taps: c => `Touche ${c.n} animaux différents`,
	bloom: c => `Fais pousser ${c.n} plantes jusqu'au bout`,
};
const ICON = { move: '👟', observe: '🔍', bloom: '🌼' };

export function challengesHtml(state) {
	return `<ul class="challenges">${state.daily.challenges.map(c => {
		const p = progress(state, c), done = p >= c.n, got = state.daily.claimed[c.id];
		const shown = c.kind === 'move' ? `${fmt(Math.min(p, c.n))} / ${fmt(c.n, c.n % 1 ? 1 : 0)} km` : `${Math.min(p, c.n)} / ${c.n}`;
		const prize = `+${c.reward} nectar${c.boost ? ` · élan ×3 pendant ${c.boost} min` : ''}`;
		return `<li class="ch${done ? ' done' : ''}${got ? ' got' : ''}">
			<span class="ch-ico" aria-hidden="true">${ICON[c.kind]}</span>
			<div class="ch-body"><b>${LABEL[c.id](c)}</b>
				<div class="bar"><i style="width:${Math.min(100, (p / c.n) * 100)}%"></i></div>
				<small>${shown} · ${prize}</small></div>
			${got ? '<span class="ch-ok">✓</span>' : done ? `<button class="btn primary small" data-claim="${c.id}">Prendre</button>` : ''}
		</li>`;
	}).join('')}</ul>`;
}

/** Les 7 derniers jours : un point plein pour chaque jour actif. */
export function weekHtml(state) {
	const letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
	const out = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date(); d.setDate(d.getDate() - i);
		const on = (state.days[dayKey(d)] ?? 0) >= ACTIVE_M;
		out.push(`<span class="wk${on ? ' on' : ''}${i === 0 ? ' today' : ''}"><i></i>${letters[d.getDay()]}</span>`);
	}
	return `<div class="week-dots">${out.join('')}</div>`;
}

/** Le plus proche objectif, en kilomètres : nouvelle parcelle, décor, nouveau lieu, ou objectif du jour. */
export function nextGoal(state) {
	const place = state.places[state.place];
	const total = state.totals.distance / 1000;
	const goals = [];
	const n = cellsOpen(place);
	if (n < CELLS.length) goals.push({ km: CELL_KM[n] - place.km, text: `pour ouvrir ${zoneName(state.place, n, 'une parcelle').toLowerCase()}` });
	for (const [k, d] of Object.entries(DECOR)) {
		if (d.place === state.place && !d.always && !place.unlocked[k]) goals.push({ km: d.km - place.km, text: `pour ${DECOR_TEASE[k] ?? 'une surprise'}` });
	}
	for (const p of PLACES) {
		if (state.places[p.id] || placeOpen(state, p)) continue;
		const missing = p.found - Object.keys(state.species).length;
		if (missing > 0 && p.km - total <= 0) goals.push({ km: 0, species: missing, text: `pour ouvrir ${p.name.toLowerCase()}` });
		else if (missing <= 0) goals.push({ km: p.km - total, text: `pour ouvrir ${p.name.toLowerCase()}` });
	}
	const today = state.goalKm - todayMeters(state) / 1000;
	if (today > 0) goals.push({ km: today, text: "pour l'objectif du jour" });
	const best = goals.filter(g => g.km > 0 || g.species).sort((a, b) => (a.species ? 0.5 : a.km) - (b.species ? 0.5 : b.km))[0];
	if (!best) {
		// Tout est ouvert : reste à compléter l'herbier du lieu.
		const h = herbarium(state, state.place), left = h.total - h.found;
		return left > 0 ? `Encore ${left} espèce${left > 1 ? 's' : ''} pour compléter l’herbier ${PLACE_DE[state.place]}` : null;
	}
	if (best.species) return `Encore ${best.species} espèce${best.species > 1 ? 's' : ''} à découvrir ${best.text}`;
	return `Plus que ${fmt(Math.max(0.1, Math.ceil(best.km * 10) / 10))} km ${best.text}`;
}

/** L'herbier d'un lieu : ses espèces trouvées, sur toutes celles qui y vivent. */
export function herbarium(state, placeId) {
	const all = SPECIES.filter(s => s.place === placeId);
	return { found: all.filter(s => state.species[s.id]).length, total: all.length };
}

/** Compléter l'herbier d'un lieu rapporte une belle récompense, une seule fois par lieu. */
export const HERBARIUM_REWARD = 500;
export function newlyComplete(state) {
	const done = (state.complete ??= {});
	return PLACES.filter(p => state.places[p.id] && !done[p.id] && (h => h.found >= h.total)(herbarium(state, p.id)));
}

const DECOR_TEASE = {
	pond: 'une mare', murger: 'un muret de pierres', log: 'un vieux tronc', nenuphars: 'des nénuphars', roseliere: 'une roselière',
	mushrooms: 'des champignons', litiere: 'un tapis de feuilles', souche: 'une vieille souche', eboulis: 'un éboulis', neve: 'un névé',
	laisse: 'la laisse de mer', ganivelles: 'des ganivelles',
};

/** Album : tout ce qui s'est ouvert, du plus récent au plus ancien, groupé par jour. */
export function albumHtml(state, limit = 40) {
	const items = [];
	for (const [id, t] of Object.entries(state.species)) {
		const sp = SPECIES_BY_ID[id];
		if (sp && typeof t === 'number') items.push({ t, html: `<li data-open-sp="${id}"><i class="al-dot" style="background:${PLACE_BY_ID[sp.place]?.color ?? '#A3BD57'}"></i><span>${sp.name}</span><small>${sp.kind === 'milieu' ? 'milieu' : sp.kind === 'animal' ? 'animal' : 'plante'}</small></li>` });
	}
	for (const [id, t] of Object.entries(state.placesOpen ?? {})) {
		if (typeof t === 'number') items.push({ t, html: `<li><i class="al-dot big" style="background:${PLACE_BY_ID[id].color}"></i><span><b>${PLACE_BY_ID[id].name}</b></span><small>nouveau lieu</small></li>` });
	}
	for (const [pid, pl] of Object.entries(state.places)) {
		for (const [n, t] of Object.entries(pl.cellDates ?? {})) items.push({ t, html: `<li><i class="al-dot fence"></i><span>${zoneName(pid, Number(n), 'Parcelle')} · ${PLACE_BY_ID[pid].name.toLowerCase()}</span><small>clôture agrandie</small></li>` });
		for (const [k, t] of Object.entries(pl.unlocked ?? {})) if (typeof t === 'number' && DECOR[k]) items.push({ t, html: `<li><i class="al-dot" style="background:#5BB5B0"></i><span>${DECOR[k].name}</span><small>décor</small></li>` });
	}
	items.sort((a, b) => b.t - a.t);
	if (!items.length) return '<p class="empty">Tes découvertes apparaîtront ici, jour après jour.</p>';
	const today = dayKey(), yest = yesterday();
	let html = '', last = '';
	for (const it of items.slice(0, limit)) {
		const d = new Date(it.t), k = dayKey(d);
		if (k !== last) {
			if (last) html += '</ul>';
			const label = k === today ? "Aujourd'hui" : k === yest ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
			html += `<h4 class="al-day">${label}</h4><ul class="rows album">`;
			last = k;
		}
		html += it.html;
	}
	return `${html}</ul>`;
}

/** Combien d'espèces au total, pour donner l'échelle de la collection. */
export const collection = state => ({ found: Object.keys(state.species).length, total: SPECIES.length });
