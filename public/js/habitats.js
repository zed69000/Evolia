// L'économie des habitats (nouvelles parties, state.eco2), façon jeu incrémental, réglée avec docs/equilibre-evolia.html.
//
// L'activité physique est le moteur, de trois façons :
//  - chaque km rapporte du nectar, plus trois heures de la production du jardin (le pas grandit avec le jardin) ;
//  - les habitats ne travaillent à plein que pendant l'élan qui suit une sortie (5 % au repos) ;
//  - les pas font pousser les plantes, et les habitats ne produisent bien que s'il y a assez de plantes autour.
//
// Six habitats forment une échelle, à la façon de Cookie Clicker : les premiers se remboursent en deux ou trois heures
// d'élan (le début va vite), les suivants de plus en plus lentement, et chacun s'ouvre avec les km parcourus.
// Chaque exemplaire coûte 15 % de plus que le précédent, et chaque parcelle en accueille un nombre limité (PER_PARCEL) ;
// les améliorations, qui doublent la production, s'ouvrent en remplissant des parcelles. Chaque espèce découverte
// ajoute 1 % à toute la production.
// Réglé avec docs/rythme-achats.js (500 joueurs, ouverture par ouverture) : 62 % d'activité pour un marcheur régulier.

import { ITEMS } from './deco.js';
import { GUILD_OF } from './idle.js';

export const LADDER = {
	massif: { cost: 15, prod: 6, km: 0 },
	ruche: { cost: 100, prod: 32, km: 0 },
	hotel: { cost: 600, prod: 120, km: 2 },
	nichoir: { cost: 5000, prod: 480, km: 12 },
	mare: { cost: 50000, prod: 2000, km: 50 },
	haie: { cost: 600000, prod: 9600, km: 150 },
};
export const LADDER_ORDER = Object.keys(LADDER);
/**
 * Au plus tant d'exemplaires de chaque habitat par parcelle : cinquante nichoirs au même endroit ne servent à rien.
 * Pour en avoir plus, on pose ailleurs ou on explore une nouvelle parcelle (des kilomètres : l'activité reste le moteur).
 */
export const PER_PARCEL = { massif: 6, ruche: 3, hotel: 2, nichoir: 3, mare: 1, haie: 2 };
/**
 * Neuf améliorations par habitat. Elles s'ouvrent au premier exemplaire, puis en remplissant 1 à 4 parcelles de cet
 * habitat ; c'est surtout leur prix qui freine, comme dans Cookie Clicker.
 */
const UPG_PARCELS = [0, 1, 1, 2, 2, 3, 3, 4, 4];
export const UPG_AT = UPG_PARCELS;
const upgNeed = (kind, u) => Math.max(1, UPG_PARCELS[u] * PER_PARCEL[kind]);
/** Les parcelles ouvertes, tous lieux confondus. */
export const parcelsOf = state => Object.values(state.places ?? {}).reduce((a, p) => a + Math.max(1, p.cells ?? 1), 0);
/** Combien d'exemplaires de cet habitat on peut avoir en tout, avec les parcelles ouvertes. */
export const ladderCap = (state, kind) => PER_PARCEL[kind] * parcelsOf(state);
// Comme Cookie Clicker : 10, 50, 500, 50 000, 5 millions puis 500 millions de fois le prix de base. Les premières
// arrivent vite, les dernières absorbent le nectar de la fin de partie.
const UPG_COST = [10, 50, 500, 50000, 5e6, 5e8, 5e10, 5e12, 5e14];
/** La part de la production quand on ne bouge pas (hors élan). */
export const REST = 0.05;
/** Chaque km rapporte aussi ces heures de production du jardin. */
export const KM_HOURS = 3;
/** Ce qu'un km marché vaut en heures de production : KM_HOURS, plus l'élan (12 min de marche × 7 = 1,4 h). Pour l'affichage. */
export const KM_VALUE_H = KM_HOURS + 1.4;
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
	if (ownedOf(state, kind) >= ladderCap(state, kind)) return `${PER_PARCEL[kind]} par parcelle au plus : explore une nouvelle parcelle`;
	return null;
}

/** L'amélioration suivante d'un habitat : { level, cost, ok } (ok : assez d'exemplaires posés), ou null. */
export function nextUpgrade(state, kind) {
	const u = upgOf(state, kind);
	if (u >= UPG_AT.length) return null;
	const need = upgNeed(kind, u);
	return { level: u + 1, cost: LADDER[kind].cost * UPG_COST[u], need, ok: ownedOf(state, kind) >= need };
}

/**
 * Chaque habitat posé a son niveau (1 à 5 : simple, garni, fleuri, foisonnant, remarquable), qui multiplie sa propre
 * production : de petits achats réguliers entre deux grosses améliorations, et ils se voient dans le jardin.
 */
export const LEVEL_PROD = [0, 1, 1.5, 2, 3, 4];
const LEVEL_PRICE = [0, 0, 3, 8, 20, 50];
export const LEVEL_KM2 = [0, 0, 2, 6, 15, 30];
/** Les niveaux déjà gagnés par les habitats d'une sorte (un habitat niveau 3 en compte 2). */
const levelsBought = (state, kind) => allItems(state).filter(it => it.kind === kind).reduce((a, it) => a + Math.max(0, (it.level ?? 1) - 1), 0);
/**
 * Le prix pour passer un habitat posé au niveau `level` : × 3, 8, 20, 50 son prix de base, et 15 % de plus pour chaque
 * niveau déjà gagné par cette sorte d'habitat (comme les exemplaires) : les niveaux s'étalent sur toute la partie.
 */
export const levelPrice = (kind, level, state = null) => Math.round((LADDER[kind].cost * LEVEL_PRICE[level] * Math.pow(1.15, state ? levelsBought(state, kind) : 0)) / 5) * 5;
/** Les exemplaires d'un habitat, niveaux compris (un habitat niveau 3 compte pour 2). */
export const levelsOf = (state, kind) => allItems(state).filter(it => it.kind === kind).reduce((a, it) => a + LEVEL_PROD[Math.min(5, it.level ?? 1)], 0);

/** La production d'un habitat (un exemplaire, améliorations comprises), en nectar par heure d'élan. */
export const unitProd = (state, kind) => LADDER[kind].prod * Math.pow(2, upgOf(state, kind));

// ─── L'agencement : chaque habitat vit de ce qui pousse autour de lui ───
/** La portée d'un habitat : les plantes et les massifs à moins de cette distance comptent pour lui. */
export const NEAR_R = 200;
/** Ce que vaut chaque plante pour chaque habitat (les butineurs veulent des fleurs, le nichoir des arbres…). */
export const NEAR_USE = {
	massif: { fleur: 1, buisson: 1.5, arbre: 1 },
	ruche: { fleur: 1, buisson: 1.5, arbre: 1 },
	hotel: { fleur: 1, buisson: 1.5, arbre: 1 },
	nichoir: { fleur: 0.3, buisson: 2, arbre: 4 },
	mare: { herbe: 0.3, fleur: 1, buisson: 1 },
	haie: { fleur: 0.5, buisson: 2, arbre: 2 },
};
/** Ce qu'il faut autour d'un habitat pour qu'il produise à plein. */
export const NEAR_NEED = 3;
/** Une ruche ou un hôtel gagne 20 % par massif mellifère tout proche (60 % au plus) : les butineurs y mangent. */
export const SYN_PER = 0.2, SYN_MAX = 0.6;
const POLLINATED = new Set(['massif', 'ruche', 'hotel']);

/** Combien d'espèces découvertes dans chaque famille (pollinisateurs, semeurs, vie du sol, prédateurs utiles). */
export function guildCounts(state) {
	const n = { pollinisateur: 0, semeur: 0, sol: 0, regulateur: 0 };
	for (const id of Object.keys(state.species ?? {})) { const g = GUILD_OF[id]; if (g) n[g]++; }
	return n;
}
/** Ce que rapportent les familles : +5 % par espèce, chacune sur ce qu'elle fait. */
export const GUILD_BONUS = 0.05;
/**
 * Le moment (state.moment, réglé par le jardin d'après le vrai ciel) : chaque temps a son bonus, il n'y a pas de
 * mauvais temps. Soleil : les butineurs (+25 % aux ruches, massifs, hôtels). Pluie : les plantes poussent plus vite
 * (+50 % à chaque pas). Nuit : les prédateurs utiles chassent (+25 % au voisinage). Hiver : les oiseaux sèment plus
 * souvent.
 */
export const MOMENTS = {
	soleil: { name: 'Soleil', icon: '☀', what: 'les butineurs s’activent : ruches, massifs et hôtels +25 %' },
	pluie: { name: 'Pluie', icon: '☂', what: 'la terre boit : tes pas font pousser 50 % de plantes en plus' },
	nuit: { name: 'Nuit', icon: '☾', what: 'les prédateurs utiles chassent : voisinage des habitats +25 %' },
	hiver: { name: 'Hiver', icon: '❄', what: 'les oiseaux de la mangeoire sèment plus souvent arbustes et arbres' },
	jour: { name: 'Jour', icon: '◌', what: 'un temps calme, sans bonus' },
};
export const guildEffect = state => {
	const n = guildCounts(state), m = state.moment ?? 'jour';
	return {
		n,
		pollen: (1 + GUILD_BONUS * n.pollinisateur) * (m === 'soleil' ? 1.25 : 1), // production des ruches, massifs et hôtels
		soil: (1 + GUILD_BONUS * n.sol) * (m === 'pluie' ? 1.5 : 1), // les pas font pousser plus de plantes
		guard: (1 + GUILD_BONUS * n.regulateur) * (m === 'nuit' ? 1.25 : 1), // les plantes autour des habitats comptent plus
		sow: n.semeur + (m === 'hiver' ? 4 : 0), // les oiseaux sèment plus souvent
	};
};
/** Le voisinage d'un habitat posé (0 à 1), calculé par le jardin (it.near) ; 1 tant qu'il n'a pas été mesuré. */
export const nearOf = (state, it) => Math.min(1, (it.near ?? 1) * guildEffect(state).guard);

/** Ce que les plantes permettent : les habitats ne produisent pleinement qu'avec deux plantes chacun, au moins. */
export function plantCover(state) {
	let green = 0, homes = 0;
	for (const p of Object.values(state.places ?? {})) {
		for (const pl of p.plants ?? []) if (pl.growth >= 1) green += pl.type === 'arbre' ? 8 : pl.type === 'buisson' ? 3 : pl.type === 'fleur' ? 1 : 0.25;
	}
	for (const k of LADDER_ORDER) homes += ownedOf(state, k);
	return homes ? Math.min(1, green / (2 * homes)) : 1;
}

/** Ce que produit un habitat posé, en nectar par heure d'élan : son niveau, son voisinage, ses massifs voisins. */
export function itemProd(state, it, ge = guildEffect(state)) {
	if (!LADDER[it.kind]) return 0;
	const bio = 1 + Object.keys(state.species ?? {}).length / 100;
	const fam = POLLINATED.has(it.kind) ? ge.pollen : 1;
	return unitProd(state, it.kind) * LEVEL_PROD[Math.min(5, it.level ?? 1)] * Math.min(1, (it.near ?? 1) * ge.guard) * (1 + (it.syn ?? 0)) * bio * fam;
}

/** La production du jardin, en nectar par heure d'élan, tous habitats confondus ; `byKind` détaille par habitat. */
export function prodPerHour(state, byKind = null) {
	const ge = guildEffect(state);
	let total = 0;
	for (const k of LADDER_ORDER) if (byKind) byKind[k] = 0;
	for (const it of allItems(state)) {
		if (!LADDER[it.kind]) continue;
		const v = itemProd(state, it, ge);
		if (byKind) byKind[it.kind] += v;
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
