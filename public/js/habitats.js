// L'économie des habitats (nouvelles parties, state.eco2), façon jeu incrémental, réglée avec docs/equilibre-evolia.html.
//
// L'activité physique est le moteur, de trois façons :
//  - chaque km rapporte du nectar, plus deux heures de la production du jardin (le pas grandit avec le jardin) ;
//  - les habitats ne travaillent à plein que pendant l'élan qui suit une sortie (5 % au repos) ;
//  - les pas font pousser les plantes, et les habitats ne produisent bien que s'il y a assez de plantes autour.
//
// Six habitats forment une échelle : chacun coûte environ cinq fois le précédent et produit environ cinq fois plus.
// Chaque exemplaire coûte 15 % de plus que le précédent ; posséder 1, 5, 25, 50 exemplaires débloque une amélioration
// qui double leur production. Chaque espèce découverte ajoute 1 % à toute la production.

import { ITEMS } from './deco.js';

export const LADDER = {
	massif: { cost: 50, prod: 0.6, km: 0 },
	ruche: { cost: 300, prod: 3, km: 1 },
	hotel: { cost: 1200, prod: 14, km: 4 },
	nichoir: { cost: 6000, prod: 60, km: 8 },
	mare: { cost: 30000, prod: 280, km: 15 },
	haie: { cost: 150000, prod: 1300, km: 25 },
};
export const LADDER_ORDER = Object.keys(LADDER);
export const UPG_AT = [1, 5, 25, 50];
const UPG_COST = [5, 25, 250, 2500];
/** La part de la production quand on ne bouge pas (hors élan). */
export const REST = 0.05;
/** Chaque km rapporte aussi ces heures de production du jardin. */
export const KM_HOURS = 4;
/** La première ruche reste à 100 nectar : la fiche de l'abeille la paie, dans l'introduction. */
const FIRST_HIVE = 100;
/** Au plus tant d'heures de production rattrapées appli fermée. */
const MAX_AWAY_H = 48;

const allItems = state => Object.values(state.places ?? {}).flatMap(p => p.items ?? []);
export const ownedOf = (state, kind) => allItems(state).filter(it => it.kind === kind).length;
export const upgOf = (state, kind) => state.upg?.[kind] ?? 0;
export const isLadder = kind => !!LADDER[kind];

/** Le prix du prochain exemplaire d'un habitat de l'échelle. */
export function ladderPrice(state, kind) {
	const n = ownedOf(state, kind);
	if (kind === 'ruche' && n === 0) return FIRST_HIVE;
	return Math.round((LADDER[kind].cost * Math.pow(1.15, n)) / 5) * 5;
}

/** Pourquoi un habitat de l'échelle n'est pas encore proposé (ou null s'il l'est). */
export function ladderLock(state, kind) {
	// Le massif et la ruche sont libres (la ruche est le premier achat de l'introduction) ; ensuite, chaque habitat
	// demande d'avoir posé le précédent.
	const i = LADDER_ORDER.indexOf(kind), km = (state.totals?.distance ?? 0) / 1000;
	if (i > 1 && !ownedOf(state, LADDER_ORDER[i - 1])) return `après avoir posé ${ITEMS[LADDER_ORDER[i - 1]].name.toLowerCase()}`;
	if (km < LADDER[kind].km) return `dès ${LADDER[kind].km} km parcourus`;
	return null;
}

/** L'amélioration suivante d'un habitat : { level, cost, ok } (ok : assez d'exemplaires posés), ou null. */
export function nextUpgrade(state, kind) {
	const u = upgOf(state, kind);
	if (u >= UPG_AT.length) return null;
	return { level: u + 1, cost: LADDER[kind].cost * UPG_COST[u], need: UPG_AT[u], ok: ownedOf(state, kind) >= UPG_AT[u] };
}

/** La production d'un habitat (un exemplaire, améliorations comprises), en nectar par heure d'élan. */
export const unitProd = (state, kind) => LADDER[kind].prod * Math.pow(2, upgOf(state, kind));

/** Ce que les plantes permettent : les habitats ne produisent pleinement qu'avec deux plantes chacun, au moins. */
export function plantCover(state) {
	let green = 0, homes = 0;
	for (const p of Object.values(state.places ?? {})) {
		for (const pl of p.plants ?? []) if (pl.growth >= 1) green += pl.type === 'arbre' ? 8 : pl.type === 'buisson' ? 3 : pl.type === 'fleur' ? 1 : 0.25;
	}
	for (const k of LADDER_ORDER) homes += ownedOf(state, k);
	return homes ? Math.min(1, green / (2 * homes)) : 1;
}

/** La production du jardin, en nectar par heure d'élan, tous habitats confondus ; `byKind` détaille par habitat. */
export function prodPerHour(state, byKind = null) {
	const bio = 1 + Object.keys(state.species ?? {}).length / 100, cover = plantCover(state);
	let total = 0;
	for (const k of LADDER_ORDER) {
		const v = ownedOf(state, k) * unitProd(state, k) * bio * cover;
		if (byKind) byKind[k] = v;
		total += v;
	}
	return total;
}

/**
 * Fait produire le jardin depuis la dernière fois : à plein pendant l'élan, à 5 % ensuite (appli fermée comprise,
 * 48 h au plus). Renvoie le nectar gagné, et la part des ruches, qui devient du miel.
 */
export function produce(state, now = Date.now()) {
	const last = state.prodAt ?? now;
	state.prodAt = now;
	const from = Math.max(last, now - MAX_AWAY_H * 3600000);
	if (now <= from) return { nectar: 0, honey: 0 };
	const boostEnd = Math.min(now, Math.max(from, state.boostUntil ?? 0));
	const hours = (boostEnd - from) / 3600000 + ((now - boostEnd) / 3600000) * REST;
	const byKind = {};
	const perH = prodPerHour(state, byKind);
	return { nectar: perH * hours, honey: (byKind.ruche ?? 0) * hours };
}
