// Revenir chaque jour : un cadeau qui grandit avec la série de jours actifs, trois petits défis,
// le prochain objectif toujours en vue, et l'album de tout ce qu'on a ouvert.
// Une journée « active » : au moins ACTIVE_M mètres. Rater un jour ne remet pas la série à zéro,
// elle est seulement divisée par deux : on encourage, on ne punit pas.

import { dayKey, todayMeters, allPlants, autoGoal, biomeKm } from './state.js';
import { PLACES, PLACE_BY_ID, PLACE_DE, SPECIES, SPECIES_BY_ID, placeOpen, unreadSpecies, speciesWaiting, UNREAD_MAX } from './species.js';
import { DECOR } from './plants.js';
import { boostMult } from './idle.js';
import { CELLS, CELL_KM, cellsOpen, cellName } from './garden.js';
import { fmtFixed, fmtNum } from './format.js';

export const ACTIVE_M = 500;

const fmt = (n, d = 1) => fmtFixed(n, d);
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
	return { nectar: Tuning.num('cadeau.base', 20) + Tuning.num('cadeau.par_jour', 10) * Math.min(s, 10), boost: s >= 3 ? 15 + 5 * Math.min(s - 3, 9) : 0 };
}

export function claimGift(state) {
	const g = giftFor(state);
	state.daily.giftDay = state.daily.day;
	return g;
}

// ─── Les défis du moment : la vraie météo devient une occasion de bouger ───
// Quand un moment se présente dans la journée (soleil, pluie, nuit, hiver), un défi de plus apparaît pour lui, une
// fois par jour : marcher sous la pluie, profiter du soleil, découvrir un visiteur de la nuit, braver le froid.
const MOMENT_CH = {
	pluie: { id: 'm-pluie', kind: 'mkm', moment: 'pluie', n: 1, reward: 80, boost: 45, label: 'Marche 1 km sous la pluie', icon: '☂' },
	soleil: { id: 'm-soleil', kind: 'mkm', moment: 'soleil', n: 1.5, reward: 50, boost: 30, label: 'Profite du soleil : marche 1,5 km', icon: '☀' },
	nuit: { id: 'm-nuit', kind: 'visitor', moment: 'nuit', n: 1, reward: 60, label: 'Découvre un visiteur de la nuit (touche-le)', icon: '☾' },
	hiver: { id: 'm-hiver', kind: 'mkm', moment: 'hiver', n: 1, reward: 80, boost: 45, label: 'Brave le froid : marche 1 km', icon: '❄' },
};
/** Les défis de fête : ils comptent les kilomètres du jour, comme le défi « Bouger ». */
const FETE_CH = {
	terre: { id: 'f-terre', kind: 'move', n: 2, reward: 120, boost: 60, label: 'Jour de la Terre : marche 2 km pour la planète', icon: '🌍' },
};
/** Ajoute le défi d'une fête, une fois ; vrai s'il vient d'apparaître. */
export function addFeteChallenge(state, id) {
	const d = state.daily, c = FETE_CH[id];
	if (!d?.challenges || !c || d.challenges.some(x => x.id === c.id)) return false;
	d.challenges.push({ ...c });
	return true;
}
/** Ajoute le défi du moment, une fois par jour ; vrai s'il vient d'apparaître. */
export function addMomentChallenge(state, moment) {
	const d = state.daily, c = MOMENT_CH[moment];
	if (!d?.challenges || !c || d.challenges.some(x => x.id === c.id)) return false;
	d.challenges.push({ ...c });
	return true;
}
/** Des mètres faits pendant un moment (pour les défis du moment). */
export function noteMomentMeters(state, moment, m) {
	const d = state.daily;
	if (!d) return;
	(d.momentM ??= {})[moment] = (d.momentM[moment] ?? 0) + m;
}
/** Un visiteur du moment découvert. */
export function noteVisitor(state, moment) {
	const d = state.daily;
	if (d) (d.visitors ??= {})[moment] = (d.visitors[moment] ?? 0) + 1;
}

export function progress(state, c) {
	const d = state.daily;
	if (c.kind === 'mkm') return (d.momentM?.[c.moment] ?? 0) / 1000;
	if (c.kind === 'visitor') return d.visitors?.[c.moment] ?? 0;
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
	'm-pluie': c => c.label, 'm-soleil': c => c.label, 'm-nuit': c => c.label, 'm-hiver': c => c.label,
	move: c => `Bouge ${fmt(c.n, c.n % 1 ? 1 : 0)} km`,
	quest: c => `Gagne ${c.n} fois au jeu « Trouve… »`,
	taps: c => `Touche ${c.n} animaux différents`,
	bloom: c => `Fais pousser ${c.n} plantes jusqu'au bout`,
};
const ICON = { move: '👟', observe: '🔍', bloom: '🌼', mkm: '🌦', visitor: '✨' };

export function challengesHtml(state) {
	return `<ul class="challenges">${state.daily.challenges.map(c => {
		const p = progress(state, c), done = p >= c.n, got = state.daily.claimed[c.id];
		const shown = c.kind === 'move' || c.kind === 'mkm' ? `${fmt(Math.min(p, c.n))} / ${fmt(c.n, c.n % 1 ? 1 : 0)} km` : `${Math.min(p, c.n)} / ${c.n}`;
		const boost = c.boost ? `<small class="ch-boost">Bonus : élan ×${fmtNum(boostMult())} pendant ${c.boost} min</small>` : '';
		const end = got ? '<span class="ch-ok" aria-label="Pris">✓</span>'
			: done ? `<button class="btn primary small" data-claim="${c.id}">Récupérer<small>+${c.reward} nectar</small></button>`
			: `<span class="ch-prize">+${c.reward}<small>nectar</small></span>`;
		// Défi rempli : une coche « Terminé » remplace la barre, le bouton Récupérer attend à droite.
		const prog = done ? `<div class="ch-done"><span class="ch-check" aria-hidden="true">✓</span>${got ? 'Récupéré' : 'Terminé'} · ${shown}</div>`
			: `<div class="ch-prog"><div class="bar"><i style="width:${Math.min(100, (p / c.n) * 100)}%"></i></div><small>${shown}</small></div>`;
		return `<li class="ch${done ? ' done' : ''}${got ? ' got' : ''}">
			<span class="ch-ico" aria-hidden="true">${c.icon ?? ICON[c.kind]}</span>
			<div class="ch-body"><b>${LABEL[c.id](c)}</b>
				${prog}
				${done ? '' : boost}</div>
			${end}
		</li>`;
	}).join('')}</ul>`;
}

/** Les 7 derniers jours : un point plein pour chaque jour actif. */
export function weekHtml(state) {
	const letters = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
	const out = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date(); d.setDate(d.getDate() - i);
		const on = (state.days[dayKey(d)] ?? 0) >= ACTIVE_M;
		out.push(`<span class="wk${on ? ' on' : ''}${i === 0 ? ' today' : ''}"><i></i>${letters[d.getDay()]}</span>`);
	}
	return `<div class="week-dots">${out.join('')}</div>`;
}

/** Le plus proche objectif, en kilomètres : nouvelle parcelle, décor, nouveau milieu, ou objectif du jour. */
export function nextGoal(state) {
	// D'abord les fiches à lire, quand elles retiennent de nouvelles espèces.
	const unread = unreadSpecies(state).length;
	if (unread >= UNREAD_MAX && speciesWaiting(state)) {
		const n = unread - UNREAD_MAX + 1;
		return `Lis ${n} fiche${n > 1 ? 's' : ''} d'espèce${n > 1 ? 's' : ''} : de nouvelles espèces attendent (+10 nectar chacune)`;
	}
	const place = state.places[state.place], present = place.biomes ?? ['prairie'];
	const total = state.totals.distance / 1000;
	const goals = [];
	const n = cellsOpen(place);
	for (const [k, d] of Object.entries(DECOR)) {
		if (present.includes(d.place) && !d.always && !place.unlocked[k]) goals.push({ km: d.km - biomeKm(place, d.place), text: `pour ${DECOR_TEASE[k] ?? 'une surprise'}` });
	}
	for (const p of PLACES) {
		if (present.includes(p.id) || placeOpen(state, p)) continue;
		const missing = p.found - Object.keys(state.species).length;
		if (missing > 0 && p.km - total <= 0) goals.push({ km: 0, species: missing, text: `pour découvrir ${p.name.toLowerCase()}` });
		else if (missing <= 0) goals.push({ km: p.km - total, text: `pour découvrir ${p.name.toLowerCase()}` });
	}
	const today = state.goalKm - todayMeters(state) / 1000;
	if (today > 0) goals.push({ km: today, text: "pour l'objectif du jour" });
	const best = goals.filter(g => g.km > 0 || g.species).sort((a, b) => (a.species ? 0.5 : a.km) - (b.species ? 0.5 : b.km))[0];
	if (!best) {
		// Tout est ouvert : reste à compléter l'herbier d'un des milieux du jardin.
		for (const b of present) {
			const h = herbarium(state, b), left = h.total - h.found;
			if (left > 0) return `Encore ${left} espèce${left > 1 ? 's' : ''} pour compléter l’herbier ${PLACE_DE[b]}`;
		}
		return null;
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
	return PLACES.filter(p => (state.places[state.place]?.biomes ?? []).includes(p.id) && !done[p.id] && (h => h.found >= h.total)(herbarium(state, p.id)));
}

const DECOR_TEASE = {
	pond: 'une mare', murger: 'un muret de pierres', log: 'un vieux tronc', nenuphars: 'des nénuphars', roseliere: 'une roselière',
	mushrooms: 'des champignons', litiere: 'un tapis de feuilles', souche: 'une vieille souche', eboulis: 'un éboulis', neve: 'un névé',
	laisse: 'la laisse de mer', ganivelles: 'des ganivelles',
};

// ─── Les albums de saison : chaque saison son album, à compléter avant qu'elle finisse ───
const SEASON_NAME = { printemps: 'Printemps', ete: 'Été', automne: 'Automne', hiver: 'Hiver' };
/** La saison d'une date (hémisphère nord, saisons météorologiques) et sa clé : « automne-2026 », « hiver-2026 »… */
export function seasonOf(t = Date.now()) {
	const d = new Date(t), m = d.getMonth();
	const s = m >= 2 && m <= 4 ? 'printemps' : m >= 5 && m <= 7 ? 'ete' : m >= 8 && m <= 10 ? 'automne' : 'hiver';
	// L'hiver commence en décembre : décembre 2026, janvier et février 2027 font « hiver 2026-2027 ».
	const y = s === 'hiver' && m <= 1 ? d.getFullYear() - 1 : d.getFullYear();
	return { key: `${s}-${y}`, season: s, name: s === 'hiver' ? `${SEASON_NAME[s]} ${y}-${y + 1}` : `${SEASON_NAME[s]} ${y}` };
}
/** Le but d'un album de saison, et ses récompenses. */
export const SEASON_GOALS = [{ n: 10, reward: 300 }, { n: 25, reward: 1000 }, { n: 50, reward: 4000 }];
/** Les découvertes d'une saison (d'après la date de chaque découverte). */
export function seasonFinds(state, key) {
	return Object.entries(state.species).filter(([id, t]) => typeof t === 'number' && SPECIES_BY_ID[id] && seasonOf(t).key === key).map(([id]) => id);
}
/** Les paliers de l'album de la saison atteints et pas encore payés ; les marque payés. */
export function seasonRewards(state) {
	const s = seasonOf(), n = seasonFinds(state, s.key).length, paid = (state.seasonPaid ??= {});
	const out = [];
	for (const g of SEASON_GOALS) if (n >= g.n && !paid[`${s.key}:${g.n}`]) { paid[`${s.key}:${g.n}`] = Date.now(); out.push({ ...g, season: s }); }
	return out;
}
/** L'album de la saison en cours, puis les saisons passées. */
export function seasonHtml(state) {
	const cur = seasonOf(), found = seasonFinds(state, cur.key), next = SEASON_GOALS.find(g => found.length < g.n);
	const keys = [...new Set(Object.values(state.species).filter(t => typeof t === 'number').map(t => seasonOf(t).key))].filter(k => k !== cur.key).sort().reverse();
	const nameOf = k => { const [s, y] = k.split('-'); return s === 'hiver' ? `${SEASON_NAME[s]} ${y}-${+y + 1}` : `${SEASON_NAME[s]} ${y}`; };
	return `<div class="season card">
		<b>${cur.name}</b><span>${found.length} découverte${found.length > 1 ? 's' : ''} cette saison</span>
		${next ? `<div class="bar"><i style="width:${Math.min(100, found.length / next.n * 100)}%"></i></div><small>Prochain palier : ${next.n} découvertes, +${next.reward} nectar. La saison finit avec son album : chaque saison a ses fleurs, ses bêtes et ses moments.</small>` : '<small>Album complet pour cette saison : bravo !</small>'}
		${found.length ? `<p class="season-list">${found.map(id => `<span data-open-sp="${id}">${SPECIES_BY_ID[id].name}</span>`).join(' · ')}</p>` : ''}
	</div>
	${keys.length ? `<ul class="rows">${keys.map(k => `<li><span>${nameOf(k)}</span><b>${seasonFinds(state, k).length}</b></li>`).join('')}</ul>` : ''}`;
}

/** Album : tout ce qui s'est ouvert, du plus récent au plus ancien, groupé par jour. */
export function albumHtml(state, limit = 40) {
	const items = [];
	for (const [id, t] of Object.entries(state.species)) {
		const sp = SPECIES_BY_ID[id];
		if (sp && typeof t === 'number') items.push({ t, html: `<li data-open-sp="${id}"><i class="al-dot" style="background:${PLACE_BY_ID[sp.place]?.color ?? '#A3BD57'}"></i><span>${sp.name}</span><small>${sp.kind === 'milieu' ? 'milieu' : sp.kind === 'animal' ? 'animal' : 'plante'}</small></li>` });
	}
	for (const [id, t] of Object.entries(state.placesOpen ?? {})) {
		if (typeof t === 'number' && PLACE_BY_ID[id]) items.push({ t, html: `<li><i class="al-dot big" style="background:${PLACE_BY_ID[id].color}"></i><span><b>${PLACE_BY_ID[id].name}</b></span><small>nouveau milieu</small></li>` });
	}
	for (const [pid, pl] of Object.entries(state.places)) {
		for (const [n, t] of Object.entries(pl.cellDates ?? {})) items.push({ t, html: `<li><i class="al-dot fence"></i><span>${cellName(pl, Number(n))}</span><small>nouvelle parcelle</small></li>` });
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
