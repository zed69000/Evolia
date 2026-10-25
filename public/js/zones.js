// Le sol des lieux et leurs coins : chaque parcelle d'un lieu est un petit milieu à part (le champ de
// coquelicots, le verger, la haie…) avec ses espèces favorites, ses plantes de départ et son sol.
//
// Le sol est découpé en cases (une par parcelle de la grille) peintes à l'avance. Pour qu'on ne voie
// jamais de raccord, chaque tache, touffe ou caillou est défini en coordonnées du monde et peint, à
// l'identique et dans le même ordre, dans toutes les cases qu'il touche.

import { rng, wash, leaf, ribbon, curve, rgba } from './watercolor.js';

export const PARCEL_W = 420;
export const PARCEL_H = 1200;
// Parcelles d'un lieu, dans l'ordre où elles s'ouvrent, et kilomètres à faire sur place pour chacune.
export const CELLS = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [-1, 1], [2, 0], [2, 1], [0, 2], [1, 2], [-1, 2], [2, 2]];
export const CELL_KM = [0, 1, 2.5, 4.5, 7, 10, 14, 19, 25, 32, 40, 50];
const CELL_AT = new Map(CELLS.map(([x, y], i) => [`${x},${y}`, i]));
export const cellIndexAt = (gx, gy) => CELL_AT.get(`${gx},${gy}`) ?? -1;

// Sol de chaque lieu : couleur de fond, grandes nappes, bords, petites pousses.
export const GROUND = {
	prairie: { base: '#B5C565', washes: ['#9AB450', '#A3BD57', '#CDC88D', '#B9C668', '#7FAA48', '#B9C668'], sprigs: ['#5F933E', '#7FAA48', '#488641'], stones: '#C9B48A' },
	marais: { base: '#A6C27A', washes: ['#8FB98A', '#9AC08A', '#B9CC8A', '#7FAA6A', '#C8D0A0'], sprigs: ['#4E7A4A', '#6E9A5A'], stones: '#A8B898' },
	foret: { base: '#7E9A55', washes: ['#6E8A4A', '#5F7F45', '#8AA060', '#9A9A60', '#7A7A48'], sprigs: ['#3E6A35', '#4E7A3E'], stones: '#9A8A6A', leaves: ['#A8783A', '#C8903A', '#8A5A2A', '#B8A050'], sun: '#E8E0A0' },
	montagne: { base: '#AEB894', washes: ['#A2AE86', '#BCC2A6', '#98A880', '#C6C8B8', '#B0B0A4', '#8FA27A'], sprigs: ['#5E7F5A', '#6F8F7A', '#7A8A6A'], stones: '#A0A098', rocks: true },
	littoral: { base: '#E9DAB4', washes: ['#DCCB9E', '#F0E4C4', '#E4D2A8', '#D2C090'], sprigs: ['#9DB08A', '#A8B488'], stones: '#C8C0B0', sea: true },
};

// Les coins de chaque lieu. La parcelle 0 est le cœur du lieu ; les suivantes prennent ces coins dans l'ordre.
// favor : espèces qui y poussent le plus souvent ; start : plantes de départ [type, nombre, croissance] ;
// marks : ce qui se voit au sol ; tint : teinte de quelques grandes nappes.
export const ZONES = {
	prairie: [
		{ name: 'Le champ de coquelicots', favor: ['coquelicot', 'bleuet', 'marguerite'], start: [['fleur', 6, 1], ['herbe', 4, 1], ['fleur', 2, 0.4]], marks: ['carpet:#D8443A', 'carpet:#5B7FD0'], tint: '#C8C478' },
		{ name: 'Le verger', favor: ['merisier', 'sureau', 'trefle-violet'], start: [['arbre', 2, 0.35], ['herbe', 6, 1], ['fleur', 2, 1]], marks: ['mown', 'path'], tint: '#9DBA5A' },
		{ name: 'La haie bocagère', favor: ['aubepine', 'prunellier', 'eglantier'], start: [['buisson', 3, 0.7], ['herbe', 5, 1], ['fleur', 2, 1]], marks: ['path'], tint: '#8EAE4E' },
		{ name: 'Le ruisseau', favor: ['bouton-or', 'geranium', 'campanule'], start: [['herbe', 6, 1], ['fleur', 3, 1]], marks: ['brook'], tint: '#9CC070' },
		{ name: 'La prairie de fauche', favor: ['sauge-des-pres', 'trefle-violet', 'carotte-sauvage', 'marguerite'], start: [['fleur', 5, 1], ['herbe', 4, 1]], marks: ['hay'], tint: '#D4C88A' },
		{ name: 'La rocaille', favor: ['viperine', 'campanule', 'bourrache'], start: [['fleur', 3, 1], ['herbe', 3, 1], ['buisson', 1, 0.6]], marks: ['rocks'], tint: '#CDC398' },
		{ name: 'Le bosquet', favor: ['chene', 'tilleul', 'sureau'], start: [['arbre', 2, 0.3], ['buisson', 1, 0.8], ['herbe', 4, 1]], marks: ['moss', 'shade'], tint: '#7FA048' },
	],
	marais: [
		{ name: 'La roselière', favor: ['jonc', 'salicaire', 'iris-marais'], start: [['herbe', 7, 1], ['fleur', 3, 1]], marks: ['puddles', 'reeds'], tint: '#8FB98A' },
		{ name: 'Le fossé', favor: ['menthe-aquatique', 'myosotis', 'populage'], start: [['fleur', 4, 1], ['herbe', 4, 1]], marks: ['brook'], tint: '#9AC08A' },
		{ name: 'La saulaie', favor: ['saule-blanc', 'saule-marsault'], start: [['arbre', 1, 0.4], ['buisson', 2, 0.7], ['herbe', 4, 1]], marks: ['moss'], tint: '#7FAA6A' },
		{ name: 'La prairie humide', favor: ['reine-des-pres', 'populage', 'salicaire'], start: [['fleur', 5, 1], ['herbe', 4, 1]], marks: ['carpet:#F0EAD0', 'puddles'], tint: '#B9CC8A' },
		{ name: "L'aulnaie", favor: ['aulne', 'viorne', 'bourdaine'], start: [['arbre', 1, 0.4], ['buisson', 2, 0.6], ['herbe', 4, 1]], marks: ['shade', 'moss'], tint: '#6E9A5A' },
		{ name: 'Les mares', favor: ['iris-marais', 'myosotis', 'jonc'], start: [['herbe', 5, 1], ['fleur', 3, 1]], marks: ['puddles', 'puddles'], tint: '#9AC08A' },
	],
	foret: [
		{ name: 'La clairière', favor: ['digitale', 'primevere', 'violette'], start: [['fleur', 5, 1], ['herbe', 4, 1]], marks: ['sun', 'carpet:#B05AA0'], tint: '#9AA060' },
		{ name: 'Le sous-bois', favor: ['fougere', 'ail-des-ours', 'muguet'], start: [['herbe', 7, 1], ['fleur', 3, 1]], marks: ['moss', 'shade', 'twigs'], tint: '#5F7F45' },
		{ name: 'La hêtraie', favor: ['hetre', 'charme', 'anemone'], start: [['arbre', 2, 0.3], ['herbe', 4, 1], ['fleur', 2, 1]], marks: ['leaves', 'shade'], tint: '#9A8A50' },
		{ name: 'Le ruisseau forestier', favor: ['fougere', 'pervenche', 'ail-des-ours'], start: [['herbe', 6, 1], ['fleur', 3, 1]], marks: ['brook', 'moss'], tint: '#6E8A4A' },
		{ name: 'La lisière', favor: ['noisetier', 'ronce', 'bouleau'], start: [['buisson', 3, 0.7], ['herbe', 4, 1], ['fleur', 2, 1]], marks: ['path'], tint: '#8AA060' },
		{ name: 'Le tapis de jacinthes', favor: ['jacinthe', 'anemone', 'pervenche'], start: [['fleur', 6, 1], ['herbe', 3, 1]], marks: ['carpet:#6070C8', 'carpet:#7A88D8'], tint: '#7A8A58' },
	],
	montagne: [
		{ name: "L'alpage fleuri", favor: ['gentiane', 'arnica', 'trolle'], start: [['fleur', 6, 1], ['herbe', 4, 1]], marks: ['carpet:#3A60C8', 'carpet:#F0C030'], tint: '#C8D3A0' },
		{ name: 'Les rochers', favor: ['edelweiss', 'genevrier', 'soldanelle'], start: [['fleur', 3, 1], ['herbe', 3, 1], ['buisson', 1, 0.6]], marks: ['rocks', 'rocks'], tint: '#C0C0B0' },
		{ name: 'La combe à neige', favor: ['soldanelle', 'gentiane'], start: [['fleur', 4, 1], ['herbe', 3, 1]], marks: ['snow'], tint: '#D0D8B0' },
		{ name: 'Le torrent', favor: ['trolle', 'lys-martagon'], start: [['herbe', 5, 1], ['fleur', 3, 1]], marks: ['brook', 'rocks'], tint: '#A8BC80' },
		{ name: 'La lande', favor: ['rhododendron', 'myrtille', 'genevrier'], start: [['buisson', 3, 0.7], ['herbe', 4, 1], ['fleur', 1, 1]], marks: ['moss'], tint: '#9FB878' },
		{ name: 'Le bois de mélèzes', favor: ['meleze', 'pin-cembro', 'epicea'], start: [['arbre', 2, 0.3], ['herbe', 4, 1], ['fleur', 2, 1]], marks: ['leaves', 'shade'], tint: '#A8B078' },
	],
	littoral: [
		{ name: 'La dune grise', favor: ['immortelle', 'oyat'], start: [['herbe', 6, 1], ['fleur', 3, 1]], marks: ['ripples'], tint: '#D8CCA8' },
		{ name: 'Les galets', favor: ['criste', 'armerie'], start: [['fleur', 4, 1], ['herbe', 3, 1]], marks: ['pebbles', 'pebbles'], tint: '#D2C8B0' },
		{ name: 'La lande à ajoncs', favor: ['ajonc', 'armerie', 'immortelle'], start: [['buisson', 3, 0.7], ['herbe', 4, 1], ['fleur', 2, 1]], marks: ['carpet:#E8C020'], tint: '#C8C890' },
		{ name: 'La pinède', favor: ['pin-maritime', 'chene-vert', 'tamaris'], start: [['arbre', 2, 0.3], ['herbe', 4, 1], ['fleur', 1, 1]], marks: ['needles', 'shade'], tint: '#B8B080' },
		{ name: 'La lette humide', favor: ['oyat', 'liseron-dunes'], start: [['herbe', 6, 1], ['fleur', 3, 1]], marks: ['puddles'], tint: '#C8D0A0' },
		{ name: 'Le haut de plage', favor: ['lys-de-mer', 'liseron-dunes', 'panicaut'], start: [['fleur', 5, 1], ['herbe', 3, 1]], marks: ['ripples', 'pebbles'], tint: '#F0E4C4' },
	],
};

/** Le coin d'une parcelle : la 0 est le cœur du lieu (sans coin), les suivantes tournent dans la liste. */
export function zoneOf(biome, ci) {
	if (ci <= 0) return null;
	const list = ZONES[biome];
	return list[(ci - 1) % list.length];
}

export function zoneName(biome, ci, placeName) {
	return zoneOf(biome, ci)?.name ?? placeName;
}

// ─── Le sol ────────────────────────────────────────────────────

const hash = (...xs) => {
	let h = 2166136261;
	for (const x of xs) for (const ch of String(x)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
};

/**
 * Éléments du sol d'une case, en coordonnées du monde : { layer, x0, y0, x1, y1, paint(g, tone) }.
 * Chaque élément porte sa graine : il se peint à l'identique, quelle que soit la case qui le dessine.
 */
function tileFeatures(biome, gx, gy) {
	const G = GROUND[biome], W = PARCEL_W, H = PARCEL_H;
	const ox = gx * W, oy = gy * H;
	const r = rng(hash(biome, gx, gy));
	const sea = !!G.sea && gy === 0;
	const top = sea ? 260 : 0;
	const out = [];
	out.avoid = []; // ruisseaux, mares et sentiers : les plantes n'y poussent pas
	const add = (layer, x, y, rad, paint) => out.push({ layer, x0: x - rad, y0: y - rad, x1: x + rad, y1: y + rad, seed: hash(biome, gx, gy, out.length), paint });
	const washAt = (layer, x, y, rx, ry, col, o) => add(layer, x, y, Math.max(rx, ry) * 1.3, (g, rr, tone) => wash(g, x, y, rx, ry, tone(col), rr, o));

	// Grandes nappes du fond.
	for (let i = 0; i < 46; i++) washAt(0, ox + r.range(0, W), oy + r.range(0, H), r.range(70, 150), r.range(50, 120), r.pick(G.washes), { layers: 8, alpha: 0.06, edge: 0, variance: 0.25 });
	if (G.sun) for (let i = 0; i < 8; i++) washAt(0, ox + r.range(20, W - 20), oy + r.range(20, H), r.range(30, 60), r.range(18, 34), G.sun, { layers: 5, alpha: 0.035, edge: 0 });
	if (G.rocks) for (let i = 0; i < 34; i++) { const s = r.range(6, 22); washAt(3, ox + r.range(0, W), oy + r.range(20, H), s, s * 0.6, r.pick(['#A8A498', '#BCB8AC', '#9A968A']), { layers: 7, alpha: 0.16, edge: 0.4 }); }

	// La mer, en haut de la première rangée du littoral.
	if (sea) {
		for (let i = 0; i < 14; i++) washAt(1, ox + r.range(0, W), oy + r.range(-30, 110), r.range(90, 160), r.range(40, 70), r.pick(['#6FAEC0', '#8FC4CC', '#5FA0B8']), { layers: 8, alpha: 0.1, edge: 0 });
		out.push({ layer: 1, x0: ox, y0: oy - 10, x1: ox + W, y1: oy + 120, seed: 1, paint: g => { g.fillStyle = 'rgba(111,174,192,0.55)'; g.fillRect(ox, oy - 10, W, 130); } });
		for (let i = 0; i < 10; i++) washAt(1, ox + r.range(0, W), oy + r.range(150, 190), r.range(60, 110), r.range(10, 18), '#CFC09A', { layers: 6, alpha: 0.1, edge: 0 });
		for (const y of [120, 138, 156]) {
			const y0 = oy + y + r.gauss() * 3, b0 = r.gauss() * 0.04, b1 = r.gauss() * 0.06;
			add(3, ox + W / 2, y0, W / 2 + 30, (g, rr) => ribbon(g, curve(ox - 12, y0, b0, W + 24, b1, 20), 2.4, 1.6, '#FDFBF3', rr, 0.6));
		}
	}

	// Le coin de cette parcelle : sa teinte et ce qui se voit au sol.
	const zone = zoneOf(biome, cellIndexAt(gx, gy));
	if (zone) {
		for (let i = 0; i < 8; i++) washAt(1, ox + r.range(60, W - 60), oy + r.range(120, H - 120), r.range(80, 160), r.range(60, 130), zone.tint, { layers: 8, alpha: 0.07, edge: 0, variance: 0.3 });
		for (const m of zone.marks) marks(m, add, washAt, r, ox, oy, W, H, top, out.avoid);
	}

	// Au-delà des parcelles, la campagne sauvage continue : buissons, bosquets, hautes herbes.
	if (cellIndexAt(gx, gy) < 0) wild(biome, add, washAt, r, ox, oy, W, H, top);

	// Petites pousses, feuilles mortes, cailloux.
	for (let i = 0; i < (sea ? 110 : 300); i++) {
		const x = ox + r.range(0, W), y = oy + r.range(top, H), s = r.range(0.6, 1.25), col = r.pick(G.sprigs), third = r() < 0.3;
		add(3, x, y, 10, (g, rr, tone) => {
			const c = tone(col);
			leaf(g, x, y, 6 * s, 2.4 * s, -Math.PI / 2 - 0.6, c, rr, 0.55);
			leaf(g, x, y, 6 * s, 2.4 * s, -Math.PI / 2 + 0.6, c, rr, 0.55);
			if (third) leaf(g, x, y, 7 * s, 2 * s, -Math.PI / 2, c, rr, 0.55);
		});
	}
	const fallen = (G.leaves ? H / 6 : 0);
	for (let i = 0; i < fallen; i++) dropLeaf(add, r, ox + r.range(0, W), oy + r.range(top, H), G.leaves, 1);
	// En automne, des feuilles mortes partout (le nombre suit la saison, au moment de peindre).
	for (let i = 0; i < 140; i++) dropLeaf(add, r, ox + r.range(0, W), oy + r.range(top, H), G.leaves ?? ['#C8742E', '#E09A3A', '#B85A2A', '#D8B048'], i / 140, true);
	for (let i = 0; i < 22; i++) washAt(3, ox + r.range(0, W), oy + r.range(top, H), r.range(3, 6), r.range(2, 4), G.stones, { layers: 5, alpha: 0.25, edge: 0.3 });
	return out;
}

function dropLeaf(add, r, x, y, colors, rank, autumnOnly = false) {
	const len = r.range(4, 7), w = r.range(1.6, 2.6), ang = r() * 6.28, col = r.pick(colors);
	add(3, x, y, 8, (g, rr, tone, season) => {
		if (autumnOnly && rank > (season?.autumn ?? 0) * 0.85) return;
		leaf(g, x, y, len, w, ang, col, rr, 0.5);
	});
}

/** Ce qui donne son caractère à un coin : ruisseau, chemin, rocaille, tapis de fleurs, flaques… */
function marks(kind, add, washAt, r, ox, oy, W, H, top, avoid) {
	const [name, arg] = kind.split(':');
	const cx = ox + W / 2, cy = oy + H / 2;
	switch (name) {
		case 'mown':
			for (let i = 0; i < 7; i++) washAt(1, ox + r.range(60, W - 60), oy + r.range(200, H - 200), r.range(70, 120), r.range(40, 70), '#C4D47A', { layers: 6, alpha: 0.08, edge: 0 });
			break;
		case 'hay': {
			// Andains de foin, en lignes dorées un peu courbes.
			for (let k = 0; k < 6; k++) {
				const y0 = oy + top + 180 + k * 140 + r.gauss() * 10, b = r.gauss() * 0.15;
				const pts = curve(ox + 50, y0, r.gauss() * 0.06, W - 100, b, 12);
				add(2, cx, y0, W / 2, (g, rr) => ribbon(g, pts, 12, 9, '#D8B860', rr, 0.4));
			}
			break;
		}
		case 'rocks':
			for (let k = 0; k < 4; k++) {
				const x = ox + r.range(70, W - 70), y = oy + r.range(top + 160, H - 160);
				for (let j = 0; j < 6; j++) {
					const s = r.range(10, 26);
					washAt(3, x + r.gauss() * 28, y + r.gauss() * 16, s, s * 0.65, r.pick(['#A8A498', '#BCB8AC', '#9A968A', '#C8C0B0']), { layers: 7, alpha: 0.2, edge: 0.45 });
				}
			}
			break;
		case 'carpet':
			// Un tapis de petites taches de couleur, comme des fleurs vues de loin.
			for (let k = 0; k < 3; k++) {
				const x = ox + r.range(90, W - 90), y = oy + r.range(top + 160, H - 160), R = r.range(60, 110);
				const dots = Array.from({ length: 70 }, () => { const a = r() * 6.28, d = Math.sqrt(r()) * R; return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, r.range(1.4, 2.6)]; });
				add(3, x, y, R + 4, g => {
					g.fillStyle = arg;
					for (const [px, py, s] of dots) { g.globalAlpha = 0.55; g.beginPath(); g.arc(px, py, s, 0, Math.PI * 2); g.fill(); }
					g.globalAlpha = 1;
				});
			}
			break;
		case 'moss':
			for (let i = 0; i < 9; i++) washAt(1, ox + r.range(40, W - 40), oy + r.range(top + 60, H - 60), r.range(30, 70), r.range(20, 45), '#5A8A3A', { layers: 6, alpha: 0.08, edge: 0 });
			break;
		case 'shade':
			for (let i = 0; i < 6; i++) washAt(1, ox + r.range(40, W - 40), oy + r.range(top + 60, H - 60), r.range(80, 150), r.range(60, 110), '#4A6A3A', { layers: 6, alpha: 0.06, edge: 0 });
			break;
		case 'sun':
			for (let i = 0; i < 6; i++) washAt(1, ox + r.range(80, W - 80), oy + r.range(top + 100, H - 100), r.range(60, 120), r.range(40, 80), '#F0E8A8', { layers: 6, alpha: 0.07, edge: 0 });
			break;
		case 'twigs':
			for (let i = 0; i < 14; i++) {
				const x = ox + r.range(30, W - 30), y = oy + r.range(top + 40, H - 40), a = r() * 6.28, L = r.range(12, 28);
				const pts = curve(x, y, a, L, r.gauss() * 0.3, 4);
				add(3, x, y, L + 2, (g, rr) => ribbon(g, pts, 2.2, 1.2, '#7A5A38', rr, 0.6));
			}
			break;
		case 'leaves':
			for (let i = 0; i < 120; i++) dropLeaf(add, r, ox + r.range(0, W), oy + r.range(top, H), ['#A8783A', '#C8903A', '#8A5A2A', '#B8A050'], 0);
			break;
		case 'needles':
			for (let i = 0; i < 8; i++) washAt(1, ox + r.range(40, W - 40), oy + r.range(top + 60, H - 60), r.range(40, 90), r.range(30, 60), '#B08A5A', { layers: 6, alpha: 0.08, edge: 0 });
			break;
		case 'puddles':
			for (let i = 0; i < 4; i++) {
				const x = ox + r.range(70, W - 70), y = oy + r.range(top + 140, H - 140), s = r.range(22, 46);
				washAt(2, x, y, s * 1.4, s * 0.8, '#6E9A5A', { layers: 5, alpha: 0.08, edge: 0 });
				washAt(2, x, y, s, s * 0.55, '#8CC0C8', { layers: 8, alpha: 0.14, edge: 0.25 });
				avoid.push({ pts: [[x, y]], r: s * 1.1 });
			}
			break;
		case 'reeds':
			for (let k = 0; k < 5; k++) {
				const x = ox + r.range(50, W - 50), y = oy + r.range(top + 120, H - 120);
				for (let j = 0; j < 12; j++) {
					const px = x + r.gauss() * 18, py = y + r.gauss() * 8, L = r.range(14, 26), a = -Math.PI / 2 + r.gauss() * 0.2;
					add(3, px, py, L, (g, rr) => leaf(g, px, py, L, 2, a, '#6E8A3A', rr, 0.6));
				}
			}
			break;
		case 'snow':
			for (let i = 0; i < 5; i++) washAt(2, ox + r.range(70, W - 70), oy + r.range(top + 140, H - 140), r.range(40, 90), r.range(24, 50), '#F6F8F8', { layers: 8, alpha: 0.2, edge: 0.15 });
			break;
		case 'pebbles':
			for (let i = 0; i < 70; i++) {
				const s = r.range(3, 8);
				washAt(3, ox + r.range(30, W - 30), oy + r.range(top + 40, H - 40), s, s * 0.7, r.pick(['#B8B0A0', '#D0C8B8', '#A09888', '#C8BCA8']), { layers: 4, alpha: 0.35, edge: 0.4 });
			}
			break;
		case 'ripples':
			for (let k = 0; k < 9; k++) {
				const y0 = oy + top + 120 + k * 100 + r.gauss() * 10;
				const pts = curve(ox + r.range(30, 120), y0, r.gauss() * 0.08, r.range(160, 260), r.gauss() * 0.3, 10);
				add(2, pts[5][0], y0, 140, (g, rr) => ribbon(g, pts, 3, 2, '#C8B488', rr, 0.4));
			}
			break;
	}
}

/** Campagne sauvage, peinte en masses douces : on la devine sous la brume, au-delà de la clôture. */
function wild(biome, add, washAt, r, ox, oy, W, H, top) {
	const dark = { prairie: '#4E7A3A', marais: '#4E7A5A', foret: '#2E5A30', montagne: '#4E6A4A', littoral: '#7A8A5A' }[biome];
	const light = { prairie: '#7FAA48', marais: '#7FAA6A', foret: '#4E7A3E', montagne: '#7F9A6A', littoral: '#A8B488' }[biome];
	const trees = biome === 'littoral' ? 2 : biome === 'foret' ? 7 : biome === 'montagne' ? 0 : 4;
	// En montagne, des sapins serrés et de gros blocs de rocher plutôt que des arbres ronds.
	if (biome === 'montagne') {
		for (let i = 0; i < 26; i++) {
			const x = ox + r.range(20, W - 20), y = oy + r.range(top + 60, H - 20), s = r.range(14, 26);
			washAt(3, x + s * 0.5, y + 2, s * 0.9, s * 0.25, '#2E4A22', { layers: 4, alpha: 0.08, edge: 0 });
			add(3, x, y, s * 2.2, (g, rr, tone) => {
				for (let k = 0; k < 3; k++) {
					const w = s * (0.9 - k * 0.22), yy = y - k * s * 0.55;
					g.fillStyle = rgba(tone(k ? '#3A6A40' : '#2A5232'), 0.85);
					g.beginPath(); g.moveTo(x, yy - s * 0.95); g.lineTo(x + w, yy); g.lineTo(x - w, yy); g.closePath(); g.fill();
				}
			});
		}
		for (let i = 0; i < 4; i++) {
			const x = ox + r.range(40, W - 40), y = oy + r.range(top + 80, H - 40), s = r.range(26, 48);
			washAt(3, x + s * 0.3, y + s * 0.2, s * 1.1, s * 0.35, '#3A3A30', { layers: 5, alpha: 0.1, edge: 0 });
			washAt(3, x, y - s * 0.3, s, s * 0.6, '#9A968C', { layers: 9, alpha: 0.24, edge: 0.45 });
			washAt(3, x - s * 0.3, y - s * 0.5, s * 0.5, s * 0.25, '#E4E0D6', { layers: 4, alpha: 0.25, edge: 0 });
		}
	}
	for (let i = 0; i < trees; i++) {
		const x = ox + r.range(40, W - 40), y = oy + r.range(top + 80, H - 40), s = r.range(50, 85);
		washAt(3, x + s * 0.3, y + s * 0.15, s * 0.9, s * 0.35, '#2E4A22', { layers: 5, alpha: 0.06, edge: 0 });
		washAt(3, x, y - s * 0.5, s, s * 0.8, dark, { layers: 10, alpha: 0.12, edge: 0.15 });
		washAt(3, x - s * 0.25, y - s * 0.75, s * 0.55, s * 0.45, light, { layers: 6, alpha: 0.1, edge: 0 });
	}
	for (let i = 0; i < 10; i++) {
		const x = ox + r.range(20, W - 20), y = oy + r.range(top + 40, H - 20), s = r.range(18, 34);
		washAt(3, x, y - s * 0.4, s, s * 0.6, r() < 0.5 ? dark : light, { layers: 7, alpha: 0.12, edge: 0.1 });
	}
	for (let k = 0; k < 6; k++) {
		const x = ox + r.range(20, W - 20), y = oy + r.range(top + 40, H - 20);
		for (let j = 0; j < 7; j++) {
			const px = x + r.gauss() * 10, L = r.range(10, 20), a = -Math.PI / 2 + r.gauss() * 0.35;
			add(3, px, y, L, (g, rr, tone) => leaf(g, px, y, L, 2, a, tone(light), rr, 0.55));
		}
	}
}

// ─── Le relief ─────────────────────────────────────────────────
// Une altitude continue sur tout le monde de chaque lieu : les cases se raccordent sans couture. Elle ne change
// rien au jeu (on plante et on pose partout pareil), mais elle se voit : ombres des pentes, corniches rocheuses
// et neige en montagne, rides des dunes au littoral, creux moussus en forêt, bas-fonds humides au marais.

const RELIEF = {
	prairie: { amp: 0.45, scale: 950, light: 0.5 },
	marais: { amp: 0.25, scale: 800, light: 0.25, damp: true },
	foret: { amp: 0.7, scale: 700, light: 0.65, moss: true },
	montagne: { amp: 2.2, scale: 560, light: 1.3, slope: 1 / 1300, ledges: 0.75, snow: 2.2 },
	littoral: { amp: 0.55, scale: 240, light: 0.75, dunes: 0.3 },
};

export function heightAt(biome, x, y) {
	const R = RELIEF[biome], s = R.scale;
	let h = Math.sin(x / s + 1.3) * Math.cos(y / (s * 1.25) + 0.4)
		+ 0.5 * Math.sin((x * 0.6 + y * 0.8) / (s * 0.45) + 2.1)
		+ 0.22 * Math.sin((x * -0.7 + y * 0.5) / (s * 0.2) + 4.2);
	h *= R.amp;
	// En montagne, le terrain monte vers le haut de l'écran : on grimpe en ouvrant les parcelles du haut.
	if (R.slope) h -= y * R.slope;
	return h;
}

/** Ombrage des pentes (lumière venue d'en haut à gauche), en une petite image lissée posée sur la case. */
function reliefSteps(biome, ox, oy, W, H, tone) {
	// La grille déborde d'un pas tout autour : le lissage ne voit jamais le bord de la case (pas de couture).
	const R = RELIEF[biome], step = 12, nx = Math.ceil(W / step) + 3, ny = Math.ceil(H / step) + 3, gx0 = ox - step, gy0 = oy - step;
	const hs = new Float32Array(nx * ny);
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) hs[j * nx + i] = heightAt(biome, gx0 + i * step, gy0 + j * step);
	const at = (i, j) => hs[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
	const steps = [];
	steps.push(g => {
		const c = document.createElement('canvas');
		c.width = nx; c.height = ny;
		const img = c.getContext('2d').createImageData(nx, ny);
		for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * step), dy = (at(i, j + 1) - at(i, j - 1)) / (2 * step);
			// Pente éclairée (face au nord-ouest) : plus claire ; pente à l'ombre : plus sombre.
			const s = Math.max(-1, Math.min(1, (dx * 0.7 + dy * 0.7) * -420 * R.light));
			const k = (j * nx + i) * 4, h = hs[j * nx + i];
			let r = 255, gg = 250, b = 228, a = s > 0 ? s * 85 : 0;
			if (s < 0) { r = 30; gg = 44; b = 40; a = -s * 150; }
			if (R.moss && h < -0.35) { r = 40; gg = 72; b = 38; a = Math.max(a, Math.min(70, (-0.35 - h) * 160)); }
			if (R.damp && h < -0.12) { r = 60; gg = 96; b = 84; a = Math.max(a, Math.min(60, (-0.12 - h) * 300)); }
			// Montagne : juste sous chaque palier, une bande de roche grise, plus marquée là où ça monte fort.
			if (R.ledges) {
				const f = (((h / R.ledges) % 1) + 1) % 1, steep = Math.min(1, Math.hypot(dx, dy) * 260);
				const rock = f > 0.72 ? ((f - 0.72) / 0.28) * (0.45 + 0.55 * steep) : 0;
				if (rock * 170 > a) { r = 112; gg = 106; b = 96; a = rock * 170; }
			}
			img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = a;
		}
		c.getContext('2d').putImageData(img, 0, 0);
		g.save();
		g.imageSmoothingEnabled = true;
		g.imageSmoothingQuality = 'high';
		g.drawImage(c, 0, 0, nx, ny, gx0 - step / 2, gy0 - step / 2, nx * step, ny * step);
		g.restore();
	});
	// Corniches (montagne) ou rides de sable (dunes) : lignes de niveau, une ombre dessous, un liseré clair dessus.
	const gap = R.ledges ?? R.dunes;
	if (gap) steps.push(g => {
		const segs = [];
		for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
			const a = hs[j * nx + i], b = hs[j * nx + i + 1], c = hs[(j + 1) * nx + i + 1], d = hs[(j + 1) * nx + i];
			const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
			for (let lv = Math.ceil(lo / gap) * gap; lv <= hi; lv += gap) {
				const pts = [];
				const edge = (h0, h1, x0, y0, x1, y1) => { if ((h0 < lv) !== (h1 < lv)) { const t = (lv - h0) / (h1 - h0); pts.push([gx0 + (x0 + (x1 - x0) * t) * step, gy0 + (y0 + (y1 - y0) * t) * step]); } };
				edge(a, b, i, j, i + 1, j); edge(b, c, i + 1, j, i + 1, j + 1); edge(c, d, i + 1, j + 1, i, j + 1); edge(d, a, i, j + 1, i, j);
				if (pts.length >= 2) segs.push([pts[0], pts[1], lv]);
			}
		}
		g.save();
		g.lineCap = 'round';
		const dune = !R.ledges;
		if (dune) {
			for (const [p, q] of segs) { g.strokeStyle = 'rgba(150,120,70,0.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0], p[1] + 2.5); g.lineTo(q[0], q[1] + 2.5); g.stroke(); }
			for (const [p, q] of segs) { g.strokeStyle = 'rgba(255,248,226,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
		} else {
			// Arête claire en haut de chaque bande de roche, et quelques pierres éboulées au pied.
			// Tout dépend de la position : sans couture d'une case à l'autre.
			g.strokeStyle = 'rgba(240,236,226,0.55)'; g.lineWidth = 1.4;
			g.beginPath();
			for (const [p, q] of segs) { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
			g.stroke();
			for (const [p, q] of segs) {
				const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, tall = 8;
				const k = Math.abs(Math.sin(mx * 12.9898 + my * 78.233)) % 1;
				if (k < 0.3) {
					g.fillStyle = k < 0.15 ? 'rgba(150,146,136,0.8)' : 'rgba(176,172,162,0.75)';
					g.beginPath(); g.ellipse(mx + (k - 0.17) * 30, my + tall + 5 + k * 10, 2 + k * 8, 1.4 + k * 5, 0, 0, 6.28); g.fill();
				}
			}
		}
		g.restore();
	});
	// Neige d'altitude : des plaques douces, plus nombreuses à mesure qu'on monte.
	// Chaque case peint aussi les plaques de ses voisines qui débordent chez elle : pas de neige coupée net.
	if (R.snow) steps.push(g => {
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			const nx0 = ox + dx * W, ny0 = oy + dy * H, r = rng(hash(biome, 'snow', nx0, ny0));
			for (let k = 0; k < 70; k++) {
				const x = nx0 + r.range(0, W), y = ny0 + r.range(0, H), h = heightAt(biome, x, y);
				const keep = h >= R.snow + r.range(-0.3, 0.3), rx = r.range(20, 50), ry = r.range(10, 22), seed = r() * 1e9;
				if (!keep || x + rx * 1.3 < ox || x - rx * 1.3 > ox + W || y + ry * 1.3 < oy || y - ry * 1.3 > oy + H) continue;
				wash(g, x, y, rx, ry, '#F8FAFC', rng(seed), { layers: 6, alpha: 0.22, edge: 0.3 });
			}
		}
	});
	return steps;
}

// ─── Rivières et sentiers au long cours ────────────────────────
// Ils traversent un coin du lieu et continuent bien au-delà, sous la brume : le monde ne s'arrête pas au bord.

const SPAN = 7000;
const longCache = new Map();

/** Ligne qui serpente en passant par (cx, cy), sur ±SPAN, verticale ou horizontale. */
function meander(r, cx, cy, vertical, amp) {
	const a1 = amp * r.range(0.7, 1), a2 = amp * r.range(0.25, 0.4), p1 = r() * 6.28, p2 = r() * 6.28;
	const off = t => a1 * Math.sin(t / 520 + p1) + a2 * Math.sin(t / 170 + p2);
	const o0 = off(0), pts = [];
	for (let t = -SPAN; t <= SPAN; t += 30) {
		const d = off(t) - o0;
		pts.push(vertical ? [cx + d, cy + t] : [cx + t, cy + d]);
	}
	return pts;
}

function longFeatures(biome) {
	let list = longCache.get(biome);
	if (list) return list;
	list = [];
	const axes = []; // [verticale ?, abscisse ou ordonnée] : deux tracés parallèles ne se superposent jamais
	const orient = (want, cx, cy) => {
		const clash = v => axes.some(([av, c]) => av === v && Math.abs(c - (v ? cx : cy)) < 300);
		const v = clash(want) ? !want : want;
		axes.push([v, v ? cx : cy]);
		return v;
	};
	ZONES[biome].forEach((z, zi) => {
		const ci = zi + 1;
		if (ci >= CELLS.length) return;
		const [gx, gy] = CELLS[ci], cx = (gx + 0.5) * PARCEL_W, cy = (gy + 0.5) * PARCEL_H;
		const r = rng(hash(biome, 'long', zi));
		for (const m of z.marks) {
			if (m === 'brook') {
				// Une rivière : verticale, sauf si elle devait traverser le cœur du lieu (alors elle passe de côté, à l'horizontale).
				const pts = meander(r, cx, cy, orient(gx !== 0, cx, cy), 110);
				list.push(longItem(pts, 30, 'river', (g, rr) => {
					ribbon(g, pts, 48, 48, '#7FAA48', rr, 0.3);
					ribbon(g, pts, 24, 24, '#7FB8C8', rr, 0.75);
					ribbon(g, pts.map(([x, y]) => [x - 3, y - 2]), 5, 5, '#E8F4F4', rr, 0.45);
				}, hash(biome, 'river', zi)));
			}
			if (m === 'path') {
				const pts = meander(r, cx, cy, orient(gx !== 0, cx, cy), 70);
				list.push(longItem(pts, 16, 'path', (g, rr) => {
					ribbon(g, pts, 24, 24, '#CDB98A', rr, 0.42);
					ribbon(g, pts, 11, 11, '#D8C8A0', rr, 0.32);
				}, hash(biome, 'path', zi)));
			}
		}
	});
	longCache.set(biome, list);
	return list;
}

function longItem(pts, r, kind, paint, seed) {
	const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
	return { pts, r, kind, paint, seed, x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, y0: Math.min(...ys) - 30, y1: Math.max(...ys) + 30 };
}

/** Distance d'un point à une ligne brisée, avec un rejet rapide par boîte. */
function nearLine(a, x, y, pad) {
	if (x < a.x0 - pad || x > a.x1 + pad || y < a.y0 - pad || y > a.y1 + pad) return false;
	for (let k = 0; k < a.pts.length; k++) {
		const [px, py] = a.pts[k];
		if (Math.abs(px - x) > a.r + pad + 40 || Math.abs(py - y) > a.r + pad + 40) continue;
		if (Math.hypot(px - x, py - y) < a.r + pad) return true;
		const q = a.pts[k + 1];
		if (q) {
			const dx = q[0] - px, dy = q[1] - py, L2 = dx * dx + dy * dy || 1;
			const t = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / L2));
			if (Math.hypot(px + dx * t - x, py + dy * t - y) < a.r + pad) return true;
		}
	}
	return false;
}

const featureCache = new Map();
function featuresOf(biome, gx, gy) {
	const key = `${biome}:${gx},${gy}`;
	let f = featureCache.get(key);
	if (!f) featureCache.set(key, (f = tileFeatures(biome, gx, gy)));
	return f;
}

/** Le point (monde) tombe-t-il sur une rivière, une flaque ou un sentier ? */
export function keepOut(biome, x, y, pad = 0) {
	const gx = Math.floor(x / PARCEL_W), gy = Math.floor(y / PARCEL_H);
	for (const a of featuresOf(biome, gx, gy).avoid) if (nearLine({ ...a, x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity }, x, y, pad)) return true;
	return longFeatures(biome).some(a => nearLine(a, x, y, pad));
}

/**
 * Peint la case (gx, gy) d'un lieu dans `g`, déjà à l'échelle : son sol et tout ce qui déborde des cases voisines.
 * `tone` recolore selon la saison ; l'ordre de peinture est le même pour toutes les cases (pas de raccord).
 */
export function paintTile(g, biome, gx, gy, tone, season) {
	for (const step of tileSteps(biome, gx, gy, tone, season)) step(g);
}

/** La même peinture, découpée en petites étapes : on peut l'étaler sur plusieurs images sans jamais figer l'écran. */
export function tileSteps(biome, gx, gy, tone, season) {
	const W = PARCEL_W, H = PARCEL_H, ox = gx * W, oy = gy * H;
	const steps = [g => {
		g.save();
		g.translate(-ox, -oy);
		g.fillStyle = tone(GROUND[biome].base);
		g.fillRect(ox, oy, W, H);
	}];
	const all = [];
	for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) {
		for (const f of featuresOf(biome, x, y)) if (f.x1 > ox && f.x0 < ox + W && f.y1 > oy && f.y0 < oy + H) all.push(f);
	}
	// Même ordre partout : par couche, puis par case, puis dans l'ordre de création ;
	// rivières et sentiers passent entre le sol et les petits détails.
	all.sort((a, b) => a.layer - b.layer);
	for (const f of all) if (f.layer < 2) steps.push(g => f.paint(g, rng(f.seed), tone, season));
	for (const f of longFeatures(biome)) if (f.x1 > ox && f.x0 < ox + W && f.y1 > oy && f.y0 < oy + H) steps.push(g => f.paint(g, rng(f.seed)));
	steps.push(...reliefSteps(biome, ox, oy, W, H, tone));
	for (const f of all) if (f.layer >= 2) steps.push(g => f.paint(g, rng(f.seed), tone, season));
	steps.push(g => g.restore());
	return steps;
}

