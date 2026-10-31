// Le sol des lieux et leurs coins : chaque parcelle d'un lieu est un petit milieu à part (le champ de
// coquelicots, le verger, la haie…) avec ses espèces favorites, ses plantes de départ et son sol.
//
// Le sol est découpé en cases (une par parcelle de la grille) peintes à l'avance. Pour qu'on ne voie
// jamais de raccord, chaque tache, touffe ou caillou est défini en coordonnées du monde et peint, à
// l'identique et dans le même ordre, dans toutes les cases qu'il touche.

import { rng, wash, leaf, ribbon, curve, rgba, mix } from './watercolor.js';

export const PARCEL_W = 420;
export const PARCEL_H = 1200;
// Parcelles du jardin, dans l'ordre où elles s'ouvrent, et kilomètres à faire au total pour chacune.
// Chaque parcelle a son milieu (prairie, marais, forêt…), choisi à son ouverture.
export const CELLS = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [-1, 1], [2, 0], [2, 1], [0, 2], [1, 2], [-1, 2], [2, 2],
	[-2, 0], [3, 0], [-2, 1], [3, 1], [0, 3], [1, 3], [-1, 3], [2, 3], [-2, 2], [3, 2], [-2, 3], [3, 3]];
export const CELL_KM = [0, 1, 2.5, 4.5, 7, 10, 14, 19, 25, 32, 40, 50, 60, 70, 82, 95, 110, 125, 140, 160, 180, 200, 225, 250];
const CELL_AT = new Map(CELLS.map(([x, y], i) => [`${x},${y}`, i]));
export const cellIndexAt = (gx, gy) => CELL_AT.get(`${gx},${gy}`) ?? -1;

// Sol de chaque lieu : couleur de fond, grandes nappes, bords, petites pousses.
export const GROUND = {
	prairie: { base: '#B5C565', washes: ['#9AB450', '#A3BD57', '#CDC88D', '#B9C668', '#7FAA48', '#B9C668'], sprigs: ['#5F933E', '#7FAA48', '#488641'], stones: '#C9B48A' },
	marais: { base: '#A6C27A', washes: ['#8FB98A', '#9AC08A', '#B9CC8A', '#7FAA6A', '#C8D0A0'], sprigs: ['#4E7A4A', '#6E9A5A'], stones: '#A8B898' },
	// La forêt : un sol d'humus brun-vert sous le couvert, une litière de feuilles toute l'année, des fougères et de la mousse.
	foret: { base: '#6E7444', washes: ['#5E6A3A', '#7A7046', '#4E6236', '#8A8050', '#6A7A42', '#5A5434'], sprigs: ['#3E6A35', '#4E7A3E', '#2E5A2E'], stones: '#8A7A5A', leaves: ['#8A6A3A', '#A8783A', '#6E5230', '#B8904A', '#7A5A2E'], sun: '#F0E4A0', litter: true },
	// La montagne : un alpage vert et fleuri, semé de vrais rochers (voir boulder).
	montagne: { base: '#A8B67E', washes: ['#98AC72', '#B6C08E', '#8CA468', '#C4C6AE', '#A6AE80', '#7E9862'], sprigs: ['#5E7F5A', '#6F8F6A', '#7A8A5A'], stones: '#A0A098', rocks: true },
	// Le littoral : un sable blond et chaud, des touffes d'oyat, des coquillages.
	littoral: { base: '#EEDDB2', washes: ['#E6D2A0', '#F4E8C6', '#E2CE9C', '#EADAB0'], sprigs: ['#9DB08A', '#A8B488'], stones: '#D8CCB4', sea: true, dune: true },
};

// Les coins de chaque lieu. La parcelle 0 est le cœur du lieu ; les suivantes prennent ces coins dans l'ordre.
// favor : espèces qui y poussent le plus souvent ; start : plantes de départ [type, nombre, croissance] ;
// marks : ce qui se voit au sol ; tint : teinte de quelques grandes nappes.
export const ZONES = {
	prairie: [
		{ name: 'Le champ de coquelicots', favor: ['coquelicot', 'bleuet', 'marguerite'], start: [['fleur', 6, 1], ['herbe', 4, 1], ['fleur', 2, 0.4]], marks: ['carpet:#D8443A', 'carpet:#5B7FD0'], tint: '#C8C478' },
		{ name: 'Le verger', favor: ['pommier', 'poirier', 'merisier', 'prunier', 'groseillier', 'framboisier', 'fraisier'], start: [['arbre', 2, 0.35], ['herbe', 6, 1], ['fleur', 2, 1]], marks: ['mown', 'path'], tint: '#9DBA5A' },
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
		{ name: 'Le sous-bois', favor: ['fougere', 'ail-des-ours', 'muguet'], start: [['arbre', 2, 1], ['herbe', 7, 1], ['fleur', 3, 1]], marks: ['moss', 'shade', 'twigs'], tint: '#5F7F45' },
		{ name: 'La hêtraie', favor: ['hetre', 'charme', 'anemone'], start: [['arbre', 3, 1], ['arbre', 1, 0.3], ['herbe', 4, 1], ['fleur', 2, 1]], marks: ['leaves', 'shade'], tint: '#9A8A50' },
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
		{ name: 'Le bois de mélèzes', favor: ['meleze', 'pin-cembro', 'epicea'], start: [['arbre', 3, 1], ['arbre', 1, 0.3], ['herbe', 4, 1], ['fleur', 2, 1]], marks: ['leaves', 'shade'], tint: '#A8B078' },
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

/**
 * Le coin d'une parcelle, d'après son rang parmi les parcelles du même milieu : la première (rang 0) est le cœur
 * de ce milieu (sans coin, avec ses mares, ses vieux arbres…), les suivantes tournent dans la liste.
 */
export function zoneOf(biome, rank) {
	if (rank <= 0) return null;
	const list = ZONES[biome];
	return list[(rank - 1) % list.length];
}

/** Le nom d'un coin ; quand la liste recommence (au-delà de 6 ou 7 parcelles), on va « plus loin ». */
export function zoneName(biome, rank, placeName) {
	const zone = zoneOf(biome, rank);
	if (!zone) return placeName;
	return Math.floor((rank - 1) / ZONES[biome].length) ? `${zone.name}, plus loin` : zone.name;
}

/**
 * Une case du sol : son milieu, son rang parmi les parcelles de ce milieu (-1 hors des parcelles : la campagne
 * sauvage) et, pour le cœur du marais, l'origine de la parcelle (ses ruisseaux relient les mares).
 * `at(gx, gy)` donne la case voisine : le sol se mélange d'un milieu à l'autre, sans couture.
 */
const tileKey = t => `${t.biome}:${t.rank}`;

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
function tileFeatures(tile, gx, gy) {
	const biome = tile.biome, G = GROUND[biome], W = PARCEL_W, H = PARCEL_H;
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
	if (G.rocks) {
		// Des rochers posés dans l'alpage, quelques gros, beaucoup de petits, et des coulées de cailloux.
		for (let i = 0; i < 11; i++) { const x = ox + r.range(0, W), y = oy + r.range(30, H), s = r() < 0.25 ? r.range(18, 30) : r.range(7, 15), seed = r() * 1e9; add(3, x, y, s * 1.8, (g, rr, tone) => boulder(g, x, y, s, rng(seed), tone)); }
		for (let k = 0; k < 3; k++) {
			const x = ox + r.range(40, W - 40), y = oy + r.range(80, H - 40);
			for (let j = 0; j < 22; j++) { const px = x + r.gauss() * 34, py = y + r.gauss() * 14, s = r.range(2, 5); washAt(3, px, py, s, s * 0.7, r.pick(['#A8A498', '#BCB8AC', '#8E8A80', '#C8C4B8']), { layers: 4, alpha: 0.4, edge: 0.4 }); }
		}
	}
	if (G.litter) {
		// Sous le couvert : de grandes ombres douces, des taches de soleil, de la mousse, des fougères, des branches tombées.
		for (let i = 0; i < 9; i++) washAt(1, ox + r.range(0, W), oy + r.range(0, H), r.range(90, 170), r.range(60, 120), '#26402A', { layers: 7, alpha: 0.06, edge: 0 });
		for (let i = 0; i < 16; i++) washAt(1, ox + r.range(0, W), oy + r.range(0, H), r.range(14, 34), r.range(8, 18), '#D8C060', { layers: 5, alpha: 0.05, edge: 0 });
		for (let i = 0; i < 10; i++) washAt(1, ox + r.range(0, W), oy + r.range(0, H), r.range(26, 60), r.range(16, 36), '#4E7A32', { layers: 6, alpha: 0.09, edge: 0.1 });
		for (let i = 0; i < 12; i++) { const x = ox + r.range(10, W - 10), y = oy + r.range(30, H), s = r.range(0.7, 1.25), seed = r() * 1e9; add(3, x, y, 34 * s, (g, rr, tone) => fern(g, x, y, s, rng(seed), tone)); }
		for (let i = 0; i < 6; i++) {
			const x = ox + r.range(30, W - 30), y = oy + r.range(40, H - 40), a = r.range(-0.5, 0.5) + (r() < 0.5 ? Math.PI : 0), L = r.range(26, 48);
			const pts = curve(x, y, a, L, r.gauss() * 0.2, 6);
			add(3, x, y, L + 4, (g, rr) => { ribbon(g, pts, 3.4, 1.6, '#5A3E24', rr, 0.7); ribbon(g, pts.map(([px, py]) => [px - 0.6, py - 1]), 1.2, 0.6, '#A07A4E', rr, 0.5); });
		}
	}
	if (G.dune) {
		// Touffes d'oyat et coquillages sur le sable.
		for (let i = 0; i < 26; i++) { const x = ox + r.range(0, W), y = oy + r.range(sea ? 300 : 20, H), s = r.range(0.7, 1.3), seed = r() * 1e9; add(3, x, y, 26 * s, (g, rr, tone) => oyat(g, x, y, s, rng(seed), tone)); }
		for (let i = 0; i < 40; i++) {
			const x = ox + r.range(0, W), y = oy + r.range(sea ? 180 : 20, H), s = r.range(1.6, 3.2), col = r.pick(['#FBF6EC', '#F2D8D0', '#F4E8D4', '#E8C8B8']), a = r() * 6.28;
			add(3, x, y, s + 2, (g, rr) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = rgba('#B89A70', 0.35); g.beginPath(); g.ellipse(0.6, 0.8, s, s * 0.7, 0, 0, 6.28); g.fill(); g.fillStyle = rgba(col, 0.95); g.beginPath(); g.ellipse(0, 0, s, s * 0.7, 0, 0, 6.28); g.fill(); g.strokeStyle = rgba('#C8A890', 0.6); g.lineWidth = 0.4; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(0, s * 0.6); g.lineTo(k * s * 0.6, -s * 0.5); g.stroke(); } g.restore(); });
		}
	}

	// La mer, en haut de la première rangée du littoral : du bleu profond au large au turquoise sur le sable,
	// des reflets de lumière dans l'eau claire, puis plusieurs liserés d'écume et le sable mouillé.
	if (sea) {
		out.push({ layer: 1, x0: ox, y0: oy - 10, x1: ox + W, y1: oy + 150, seed: 1, paint: g => {
			const grd = g.createLinearGradient(0, oy - 10, 0, oy + 150);
			grd.addColorStop(0, 'rgba(30,110,150,0.97)');
			grd.addColorStop(0.45, 'rgba(56,160,182,0.93)');
			grd.addColorStop(0.8, 'rgba(110,204,198,0.88)');
			grd.addColorStop(1, 'rgba(160,220,206,0)');
			g.fillStyle = grd;
			g.fillRect(ox, oy - 10, W, 160);
		} });
		for (let i = 0; i < 14; i++) washAt(1, ox + r.range(0, W), oy + r.range(-30, 110), r.range(90, 160), r.range(30, 60), r.pick(['#3E8AAA', '#6FBCC4', '#5AA8BC']), { layers: 8, alpha: 0.08, edge: 0 });
		// Reflets : un réseau de fines lignes claires, comme le soleil au fond de l'eau peu profonde.
		for (let i = 0; i < 26; i++) {
			const x = ox + r.range(0, W), y = oy + r.range(30, 125), w = r.range(14, 34);
			add(2, x, y, w, (g, rr) => { for (let k = 0; k < 3; k++) ribbon(g, curve(x - w / 2, y + k * 3 + rr.gauss(), rr.gauss() * 0.4, w, rr.gauss() * 0.8, 6), 1, 0.4, '#E8FAF6', rr, 0.35); });
		}
		// Sable mouillé, plus sombre, au ras de l'eau.
		for (let i = 0; i < 12; i++) washAt(1, ox + r.range(0, W), oy + r.range(146, 172), r.range(60, 110), r.range(8, 14), '#C8B488', { layers: 6, alpha: 0.12, edge: 0 });
		// Liserés d'écume : un trait principal ondulé, puis deux plus fins et troués, plus au large.
		for (const [y, w, al, gaps] of [[140, 3, 0.75, 0], [124, 2, 0.5, 0.3], [104, 1.6, 0.35, 0.5]]) {
			const y0 = oy + y + r.gauss() * 3;
			add(3, ox + W / 2, y0, W / 2 + 30, (g, rr) => {
				let x = ox - 12;
				while (x < ox + W + 12) {
					const len = rr.range(50, 120);
					if (rr() >= gaps) ribbon(g, curve(x, y0 + Math.sin(x * 0.02) * 4, rr.gauss() * 0.05, len, rr.gauss() * 0.08, 14), w, w * 0.5, '#FDFBF3', rr, al);
					x += len + (gaps ? rr.range(10, 40) : 0);
				}
			});
		}
	}

	// Le coin de cette parcelle : sa teinte et ce qui se voit au sol. Ruisseaux et sentiers la traversent de bord à bord.
	const zone = zoneOf(biome, tile.rank);
	if (zone) {
		for (let i = 0; i < 8; i++) washAt(1, ox + r.range(60, W - 60), oy + r.range(120, H - 120), r.range(80, 160), r.range(60, 130), zone.tint, { layers: 8, alpha: 0.07, edge: 0, variance: 0.3 });
		for (const m of zone.marks) marks(m, add, washAt, r, ox, oy, W, H, top, out.avoid);
		const rl = rng(hash(biome, 'long', gx, gy));
		for (const m of zone.marks) if (m === 'brook' || m === 'path') {
			const f = crossing(m, rl, ox, oy, W, H, top, hash(biome, m, gx, gy));
			out.push(f);
			out.avoid.push(f);
		}
	}
	// Le cœur du marais : une rivière descend jusqu'à la mare aux grenouilles, qui se déverse dans la grande mare, puis dans celle du bas.
	if (tile.rank === 0 && biome === 'marais') for (const st of MARSH_STREAMS) { const f = stream(st, ox, oy); out.push(f); out.avoid.push(f); }

	// Au-delà des parcelles, la campagne sauvage continue : buissons, bosquets, hautes herbes.
	if (tile.rank < 0) wild(biome, add, washAt, r, ox, oy, W, H, top);

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
	// En forêt, la litière couvre le sol toute l'année.
	const fallen = G.litter ? 520 : G.leaves ? H / 6 : 0;
	for (let i = 0; i < fallen; i++) dropLeaf(add, r, ox + r.range(0, W), oy + r.range(top, H), G.leaves, 0);
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
	const trees = biome === 'littoral' ? 1 : biome === 'foret' ? 0 : biome === 'montagne' ? 0 : 4;
	// En forêt, une futaie serrée : troncs, puis houppiers sombres qui se chevauchent.
	if (biome === 'foret') {
		const crowns = [];
		for (let i = 0; i < 20; i++) crowns.push([ox + r.range(10, W - 10), oy + r.range(top + 60, H - 10), r.range(45, 80)]);
		crowns.sort((a, b) => a[1] - b[1]);
		for (const [x, y, s] of crowns) {
			washAt(3, x + s * 0.35, y + s * 0.1, s * 0.85, s * 0.3, '#1E3220', { layers: 5, alpha: 0.08, edge: 0 });
			add(3, x, y, s * 0.3, (g, rr) => ribbon(g, [[x, y], [x + rr.gauss() * 1.5, y - s * 0.45]], s * 0.09, s * 0.07, '#4A3424', rr, 0.75));
			washAt(3, x, y - s * 0.7, s * 0.85, s * 0.65, r.pick(['#24482A', '#2E5630', '#3A5E2E']), { layers: 10, alpha: 0.14, edge: 0.18 });
			washAt(3, x - s * 0.25, y - s * 0.95, s * 0.45, s * 0.35, '#5A8A44', { layers: 6, alpha: 0.1, edge: 0 });
		}
	}
	if (biome === 'littoral') for (let i = 0; i < 18; i++) { const x = ox + r.range(10, W - 10), y = oy + r.range(top + 60, H - 10), s = r.range(0.8, 1.4), seed = r() * 1e9; add(3, x, y, 26 * s, (g, rr, tone) => oyat(g, x, y, s, rng(seed), tone)); }
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
		for (let i = 0; i < 6; i++) {
			const x = ox + r.range(40, W - 40), y = oy + r.range(top + 80, H - 40), s = r.range(22, 40), seed = r() * 1e9;
			add(3, x, y, s * 1.8, (g, rr, tone) => boulder(g, x, y, s, rng(seed), tone));
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

// ─── Rochers, fougères, oyats ──────────────────────────────────

/** Un rocher vu un peu de haut : son ombre portée, un bloc à facettes (dessus clair, flanc à l'ombre), lichens, fissures. */
function boulder(g, x, y, s, rr, tone) {
	wash(g, x + s * 0.45, y + s * 0.18, s * 1.15, s * 0.36, tone('#3A3A34'), rr, { layers: 4, alpha: 0.1, edge: 0 });
	const n = 7, pts = [];
	for (let k = 0; k < n; k++) {
		const a = (k / n) * Math.PI * 2 + rr.range(-0.2, 0.2), d = s * rr.range(0.75, 1.05);
		pts.push([x + Math.cos(a) * d, y - s * 0.35 + Math.sin(a) * d * 0.62]);
	}
	const poly = (P, col, al) => { g.fillStyle = rgba(col, al); g.beginPath(); P.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); };
	poly(pts, tone(rr.pick(['#9A968A', '#A8A498', '#8E8A80'])), 0.95);
	// Flanc à l'ombre (en bas à droite), dessus éclairé (en haut à gauche).
	poly([pts[0], pts[1], pts[2], pts[3], [x + s * 0.1, y - s * 0.2]], tone('#6A665C'), 0.5);
	poly([pts[4], pts[5], pts[6], [x + s * 0.2, y - s * 0.6], [x - s * 0.1, y - s * 0.35]], tone('#D2CEC2'), 0.6);
	g.strokeStyle = rgba('#4A463E', 0.45); g.lineWidth = Math.max(0.6, s * 0.05);
	g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.stroke();
	g.beginPath(); g.moveTo(x - s * 0.1, y - s * 0.55); g.lineTo(x + s * 0.12, y - s * 0.25); g.lineTo(x + s * 0.05, y - s * 0.05); g.stroke();
	for (let k = 0; k < 3; k++) wash(g, x + rr.range(-0.5, 0.4) * s, y - s * rr.range(0.3, 0.75), s * 0.12, s * 0.08, rr.pick(['#C8B850', '#D8D090', '#9AA060']), rr, { layers: 2, alpha: 0.5, edge: 0.2 });
}

/** Une fougère : des frondes arquées, chacune garnie de petites folioles. */
function fern(g, x, y, s, rr, tone) {
	wash(g, x + 4 * s, y + 2, 20 * s, 6 * s, tone('#2A3A22'), rr, { layers: 3, alpha: 0.08, edge: 0 });
	const fronds = 6 + Math.floor(rr() * 3);
	for (let k = 0; k < fronds; k++) {
		const a = -Math.PI / 2 + (k / (fronds - 1) - 0.5) * 2.6 + rr.gauss() * 0.1, L = (22 + rr() * 10) * s;
		const pts = curve(x, y, a, L, (a + Math.PI / 2) * 0.5, 7);
		const col = tone(rr.pick(['#4E8A3A', '#5E9A44', '#3E7A34']));
		ribbon(g, pts, 1.1 * s, 0.4, col, rr, 0.85);
		for (let j = 1; j < pts.length - 1; j++) {
			const [px, py] = pts[j], [qx, qy] = pts[j + 1], dir = Math.atan2(qy - py, qx - px), len = (1 - j / pts.length) * 7 * s + 2;
			leaf(g, px, py, len, len * 0.32, dir - 1.1, col, rr, 0.75);
			leaf(g, px, py, len, len * 0.32, dir + 1.1, col, rr, 0.75);
		}
	}
}

/** Une touffe d'oyat : de longues feuilles fines et souples, couleur paille et vert-de-gris. */
function oyat(g, x, y, s, rr, tone) {
	wash(g, x + 3 * s, y + 1.5, 13 * s, 4 * s, tone('#B89A60'), rr, { layers: 3, alpha: 0.16, edge: 0 });
	for (let k = 0; k < 12; k++) {
		const a = -Math.PI / 2 + rr.gauss() * 0.55, L = (12 + rr() * 14) * s;
		ribbon(g, curve(x + rr.gauss() * 3 * s, y, a, L, a * 0.6 + rr.gauss() * 0.2, 6), 1.3 * s, 0.2, tone(rr.pick(['#9DB08A', '#B4BC90', '#C8C098', '#8AA07A'])), rr, 0.85);
	}
}

// ─── Le relief ─────────────────────────────────────────────────
// Une altitude continue sur tout le jardin : les cases se raccordent sans couture, et d'un milieu à l'autre
// le relief se fond sur quelques pas. Elle ne change rien au jeu (on plante et on pose partout pareil), mais
// elle se voit : ombres des pentes, rochers et neige en montagne, rides des dunes, creux moussus, bas-fonds humides.

const RELIEF = {
	prairie: { amp: 0.45, scale: 950, light: 0.5 },
	marais: { amp: 0.25, scale: 800, light: 0.25, damp: true },
	foret: { amp: 0.7, scale: 700, light: 0.65, moss: true },
	montagne: { amp: 2.2, scale: 560, light: 1.1, fine: 0.22, snow: 1.9, shade: [50, 62, 80], lit: 0.35 },
	littoral: { amp: 0.55, scale: 240, light: 0.45, dunes: 0.3, fine: 0.22, shade: [150, 116, 70], lit: 0.6 },
};

export function heightAt(biome, x, y) {
	const R = RELIEF[biome], s = R.scale;
	const h = Math.sin(x / s + 1.3) * Math.cos(y / (s * 1.25) + 0.4)
		+ 0.5 * Math.sin((x * 0.6 + y * 0.8) / (s * 0.45) + 2.1)
		// Ondulation fine : seulement pour la montagne et les dunes ; ailleurs elle dessinait des rayures dans le pré.
		+ (R.fine ?? 0) * Math.sin((x * -0.7 + y * 0.5) / (s * 0.2) + 4.2);
	return h * R.amp;
}

// Largeur du fondu entre deux milieux voisins, de part et d'autre de leur frontière.
const BLEND = 190;

/**
 * Part de chaque milieu en un point de la case (gx, gy) : 1 pour le sien au milieu de la case ; près d'un bord
 * qui touche un autre milieu, moitié-moitié sur la frontière. Le calcul est le même vu des deux côtés : pas de couture.
 */
function weights(at, gx, gy, x, y) {
	const own = at(gx, gy).biome, W = PARCEL_W, H = PARCEL_H, ox = gx * W, oy = gy * H;
	const w = { [own]: 1 };
	for (const [dx, dy, d] of [[-1, 0, x - ox], [1, 0, ox + W - x], [0, -1, y - oy], [0, 1, oy + H - y]]) {
		const b = at(gx + dx, gy + dy).biome;
		if (b === own || d >= BLEND) continue;
		const k = 0.5 * (1 - Math.max(0, d) / BLEND);
		w[b] = (w[b] ?? 0) + k;
		w[own] -= k;
	}
	return w;
}

/**
 * Le relief mélangé en un point : hauteur, lumière, couleur de l'ombre, éclat des pentes au soleil, et la part de
 * forêt (mousse) et de marais (bas-fonds humides). Tout est pondéré : rien ne s'arrête net sur une frontière.
 */
function mixed(at, gx, gy, x, y) {
	const w = weights(at, gx, gy, x, y);
	let h = 0, light = 0, lit = 0;
	const shade = [0, 0, 0];
	for (const [b, k] of Object.entries(w)) {
		const R = RELIEF[b], sh = R.shade ?? [30, 44, 40];
		h += k * heightAt(b, x, y); light += k * R.light; lit += k * (R.lit ?? 1);
		for (let c = 0; c < 3; c++) shade[c] += k * sh[c];
	}
	return { h, light, lit, shade, moss: w.foret ?? 0, damp: w.marais ?? 0, own: w[at(gx, gy).biome] };
}

/** Ombrage des pentes (lumière venue d'en haut à gauche), en une petite image lissée posée sur la case. */
function reliefSteps(at, gx, gy) {
	// La grille déborde d'un pas tout autour : le lissage ne voit jamais le bord de la case (pas de couture).
	const biome = at(gx, gy).biome, W = PARCEL_W, H = PARCEL_H, ox = gx * W, oy = gy * H;
	const R = RELIEF[biome], step = 12, nx = Math.ceil(W / step) + 3, ny = Math.ceil(H / step) + 3, gx0 = ox - step, gy0 = oy - step;
	const hs = new Float32Array(nx * ny), ls = new Float32Array(nx * ny), owns = new Float32Array(nx * ny), ms = [];
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
		const m = mixed(at, gx, gy, gx0 + i * step, gy0 + j * step);
		hs[j * nx + i] = m.h; ls[j * nx + i] = m.light; owns[j * nx + i] = m.own; ms[j * nx + i] = m;
	}
	const hAt = (i, j) => hs[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
	const steps = [];
	steps.push(g => {
		const c = document.createElement('canvas');
		c.width = nx; c.height = ny;
		const img = c.getContext('2d').createImageData(nx, ny);
		for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			const dx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * step), dy = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * step);
			// Pente éclairée (face au nord-ouest) : plus claire ; pente à l'ombre : plus sombre.
			const k = j * nx + i, s = Math.max(-1, Math.min(1, (dx * 0.7 + dy * 0.7) * -420 * ls[k])), h = hs[k], m = ms[k];
			let r = 255, gg = 250, b = 228, a = s > 0 ? s * 85 * m.lit : 0;
			if (s < 0) { [r, gg, b] = m.shade; a = -s * 150; }
			if (m.moss && h < -0.35) { r = 40; gg = 72; b = 38; a = Math.max(a, Math.min(70, (-0.35 - h) * 160) * m.moss); }
			if (m.damp && h < -0.12) { r = 60; gg = 96; b = 84; a = Math.max(a, Math.min(60, (-0.12 - h) * 300) * m.damp); }
			img.data[k * 4] = r; img.data[k * 4 + 1] = gg; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = a;
		}
		c.getContext('2d').putImageData(img, 0, 0);
		g.save();
		g.imageSmoothingEnabled = true;
		g.imageSmoothingQuality = 'high';
		g.drawImage(c, 0, 0, nx, ny, gx0 - step / 2, gy0 - step / 2, nx * step, ny * step);
		g.restore();
	});
	// Rides de sable (dunes) : lignes de niveau, une ombre dessous, un liseré clair dessus ; elles s'effacent avant la frontière.
	const gap = R.dunes;
	if (gap) steps.push(g => {
		const segs = [];
		for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
			if (owns[j * nx + i] < 0.7) continue;
			const a = hs[j * nx + i], b = hs[j * nx + i + 1], c = hs[(j + 1) * nx + i + 1], d = hs[(j + 1) * nx + i];
			const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
			for (let lv = Math.ceil(lo / gap) * gap; lv <= hi; lv += gap) {
				const pts = [];
				const edge = (h0, h1, x0, y0, x1, y1) => { if ((h0 < lv) !== (h1 < lv)) { const t = (lv - h0) / (h1 - h0); pts.push([gx0 + (x0 + (x1 - x0) * t) * step, gy0 + (y0 + (y1 - y0) * t) * step]); } };
				edge(a, b, i, j, i + 1, j); edge(b, c, i + 1, j, i + 1, j + 1); edge(c, d, i + 1, j + 1, i, j + 1); edge(d, a, i, j + 1, i, j);
				if (pts.length >= 2) segs.push([pts[0], pts[1]]);
			}
		}
		g.save();
		g.lineCap = 'round';
		for (const [p, q] of segs) { g.strokeStyle = 'rgba(150,120,70,0.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0], p[1] + 2.5); g.lineTo(q[0], q[1] + 2.5); g.stroke(); }
		for (const [p, q] of segs) { g.strokeStyle = 'rgba(255,248,226,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
		g.restore();
	});
	// Neige d'altitude : des plaques douces sur les sommets. Chaque case peint aussi les plaques de ses voisines
	// de montagne qui débordent chez elle : pas de neige coupée net.
	if (R.snow) steps.push(g => {
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (at(gx + dx, gy + dy).biome !== 'montagne') continue;
			const nx0 = ox + dx * W, ny0 = oy + dy * H, r = rng(hash(biome, 'snow', nx0, ny0));
			for (let k = 0; k < 70; k++) {
				const x = nx0 + r.range(0, W), y = ny0 + r.range(0, H);
				const keep = mixed(at, gx + dx, gy + dy, x, y).h >= R.snow + r.range(-0.3, 0.3), rx = r.range(20, 50), ry = r.range(10, 22), seed = r() * 1e9;
				if (!keep || x + rx * 1.3 < ox || x - rx * 1.3 > ox + W || y + ry * 1.3 < oy || y - ry * 1.3 > oy + H) continue;
				wash(g, x, y, rx, ry, '#F8FAFC', rng(seed), { layers: 6, alpha: 0.22, edge: 0.3 });
			}
		}
	});
	return steps;
}

// ─── Ruisseaux et sentiers ─────────────────────────────────────
// Ils traversent leur parcelle de bord à bord, et se fondent dans le terrain à leurs deux bouts (effacés en dégradé) : une source, une perte,
// un chemin qui se perd dans l'herbe. Ils ne débordent jamais sur une autre parcelle (qui peut être d'un autre milieu).

/** Ligne qui serpente d'un bord à l'autre de la parcelle, verticale ou horizontale. */
function across(r, ox, oy, W, H, top, vertical, amp) {
	const a1 = amp * r.range(0.7, 1), a2 = amp * r.range(0.25, 0.4), p1 = r() * 6.28, p2 = r() * 6.28;
	const off = t => a1 * Math.sin(t / 520 + p1) + a2 * Math.sin(t / 170 + p2);
	const pts = [];
	if (vertical) {
		const cx = ox + W * r.range(0.3, 0.7), y0 = oy + top + 10, y1 = oy + H - 10;
		for (let y = y0; y <= y1; y += 30) pts.push([Math.max(ox + 40, Math.min(ox + W - 40, cx + off(y - y0) - off(0))), y]);
	} else {
		const cy = oy + top + (H - top) * r.range(0.3, 0.7);
		for (let x = ox + 10; x <= ox + W - 10; x += 30) pts.push([x, cy + off(x - ox) - off(0)]);
	}
	return pts;
}

/** Les bouts d'un tracé : le cinquième de ses points de chaque côté, qui se fondent dans le terrain. */
const endsOf = n => Math.max(2, Math.round(n / 5));

/**
 * Peint un tracé (sentier, ruisseau) à part, puis efface ses bouts `tips` en dégradé, avec quelques trous d'usure :
 * il se fond dans le terrain, sans pointe ni bord net. `fade` : longueur du fondu.
 */
function softEnds(g, item, tips, fade, rr, draw, after) {
	const T = g.getTransform(), k = Math.hypot(T.a, T.b);
	const x0 = item.x0, y0 = item.y0, W = item.x1 - x0, H = item.y1 - y0;
	const c = document.createElement('canvas');
	c.width = Math.max(1, Math.ceil(W * k)); c.height = Math.max(1, Math.ceil(H * k));
	const o = c.getContext('2d');
	o.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
	draw(o);
	o.globalCompositeOperation = 'destination-out';
	for (const [x, y, dx, dy] of tips) {
		// Plein effacement au bout, aucun à `fade` pas de là, en suivant une courbe douce.
		const grd = o.createRadialGradient(x, y, 0, x, y, fade);
		grd.addColorStop(0, 'rgba(0,0,0,1)');
		grd.addColorStop(0.35, 'rgba(0,0,0,0.8)');
		grd.addColorStop(0.7, 'rgba(0,0,0,0.3)');
		grd.addColorStop(1, 'rgba(0,0,0,0)');
		o.fillStyle = grd;
		o.fillRect(x - fade, y - fade, fade * 2, fade * 2);
		// L'usure : de petits trous, plus nombreux vers le bout (l'herbe reprend, la terre affleure par places).
		for (let q = 0; q < 22; q++) {
			const t = Math.pow(rr(), 1.6), px = x + dx * t * fade + rr.gauss() * 9, py = y + dy * t * fade + rr.gauss() * 6;
			o.fillStyle = `rgba(0,0,0,${0.55 * (1 - t)})`;
			o.beginPath(); o.ellipse(px, py, rr.range(3, 9), rr.range(2, 6), rr() * 3, 0, Math.PI * 2); o.fill();
		}
	}
	g.drawImage(c, x0, y0, W, H);
	after?.();
}

/** Les deux bouts d'un tracé, chacun avec la direction qui rentre vers le milieu. */
function tipsOf(pts) {
	const n = pts.length, dir = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
	return [[...pts[0], ...dir(pts[0], pts[Math.min(n - 1, 3)])], [...pts[n - 1], ...dir(pts[n - 1], pts[Math.max(0, n - 4)])]];
}

/** Des touffes d'herbe qui poussent sur les bouts d'un sentier : il disparaît sous elles. */
function overgrow(g, pts, rr, w) {
	const n = pts.length, e = endsOf(n);
	for (const i of [...Array(e + 1).keys(), ...Array.from({ length: e + 1 }, (_, k) => n - 1 - k)]) {
		const [x, y] = pts[i], far = i <= e ? 1 - i / e : 1 - (n - 1 - i) / e;
		for (let q = 0; q < 2 + far * 4; q++) {
			const px = x + rr.gauss() * w * 0.4, py = y + rr.gauss() * w * 0.25;
			for (let k = 0; k < 3; k++) ribbon(g, curve(px + rr.gauss() * 2, py, -Math.PI / 2 + rr.gauss() * 0.35, rr.range(4, 9), rr.gauss() * 0.3, 3), 1.1, 0.3, rr.pick(['#6E9A42', '#7FAA48', '#5F8A3A']), rr, 0.7);
		}
	}
}

/** Points tous les `step` pas le long d'un tracé, avec leur direction et leur distance depuis le début. */
function along(pts, step) {
	const out = [];
	let d = 0;
	for (let k = 1; k < pts.length; k++) {
		const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], L = Math.hypot(x1 - x0, y1 - y0) || 1;
		for (let s = 0; s < L; s += step) out.push([x0 + ((x1 - x0) * s) / L, y0 + ((y1 - y0) * s) / L, (x1 - x0) / L, (y1 - y0) / L, d + s]);
		d += L;
	}
	return { pts: out, length: d };
}

/** Une largeur qui varie doucement le long d'un tracé : jamais un tuyau régulier. */
const varying = (rr, w) => {
	const p1 = rr() * 6.28, p2 = rr() * 6.28;
	return s => w * (0.82 + 0.2 * Math.sin(s / 75 + p1) + 0.1 * Math.sin(s / 24 + p2));
};

/**
 * Un cours d'eau peint comme les mares : des lavis qui se chevauchent, des berges irrégulières, une largeur qui
 * varie, de l'herbe mouillée tout autour et quelques reflets. `widen(t)` (t de 0 à 1) l'élargit, par exemple à
 * son embouchure dans une mare.
 */
function waterCourse(g, pts, w, rr, widen = () => 1) {
	const { pts: S, length: L } = along(pts, 5), width = varying(rr, w);
	const W = ([, , , , d]) => width(d) * widen(d / L);
	S.forEach((q, i) => { if (i % 3 === 0) wash(g, q[0], q[1], W(q) * 1.25, W(q) * 1.05, '#7FAA48', rr, { layers: 3, alpha: 0.035, edge: 0, variance: 0.3 }); });
	S.forEach((q, i) => { if (i % 2 === 0) wash(g, q[0], q[1], W(q) * 0.62, W(q) * 0.56, '#3E7E7A', rr, { layers: 2, alpha: 0.05, edge: 0, variance: 0.25 }); });
	for (const q of S) wash(g, q[0], q[1], W(q) * 0.52, W(q) * 0.47, '#5BB5B0', rr, { layers: 3, alpha: 0.09, edge: 0, variance: 0.25 });
	S.forEach((q, i) => { if (i % 3 === 0) wash(g, q[0] - 2, q[1] - 2, W(q) * 0.26, W(q) * 0.2, '#8FD0C8', rr, { layers: 2, alpha: 0.08, edge: 0 }); });
	// Les berges : le même trait sombre et irrégulier que le bord des mares, de chaque côté.
	const bank = mix('#5BB5B0', '#1a2810', 0.4);
	for (const side of [-1, 1]) {
		const line = S.map(q => { const k = side * W(q) * 0.5 + rr.gauss() * 0.8; return [q[0] - q[3] * k, q[1] + q[2] * k]; });
		g.strokeStyle = rgba(bank, 0.3);
		g.lineWidth = 2.2;
		g.lineJoin = g.lineCap = 'round';
		g.beginPath();
		line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
		g.stroke();
	}
	// Des reflets clairs, de-ci de-là, dans le sens du courant.
	S.forEach(([x, y, dx, dy], i) => {
		if (i % 11 || rr() < 0.3) return;
		const len = rr.range(10, 22), side = rr.gauss() * w * 0.12;
		ribbon(g, [[x - dy * side, y + dx * side], [x - dy * side + dx * len, y + dx * side + dy * len]], 1.4, 0.6, '#FDF7E7', rr, 0.5);
	});
}

/** Un sentier peint au lavis : terre blonde, bord plus sombre, bande usée au milieu ; une largeur qui varie. */
function earthPath(g, pts, w, rr) {
	const { pts: S } = along(pts, 5), width = varying(rr, w);
	S.forEach((q, i) => { if (i % 2 === 0) wash(g, q[0], q[1], width(q[4]) * 0.62, width(q[4]) * 0.5, '#9A7E52', rr, { layers: 2, alpha: 0.07, edge: 0, variance: 0.3 }); });
	for (const q of S) wash(g, q[0], q[1], width(q[4]) * 0.5, width(q[4]) * 0.4, '#D2B482', rr, { layers: 3, alpha: 0.12, edge: 0, variance: 0.25 });
	S.forEach((q, i) => { if (i % 2 === 0) wash(g, q[0] - 1, q[1] - 1.5, width(q[4]) * 0.22, width(q[4]) * 0.17, '#E8D4A6', rr, { layers: 2, alpha: 0.08, edge: 0 }); });
}

function crossing(kind, r, ox, oy, W, H, top, seed) {
	if (kind === 'brook') {
		const pts = across(r, ox, oy, W, H, top, r() < 0.65, 90);
		const item = longItem(pts, 30, 'river', (g, rr) => softEnds(g, item, tipsOf(pts), 130, rr, o => waterCourse(o, pts, 30, rr)), seed);
		return item;
	}
	const pts = across(r, ox, oy, W, H, top, r() < 0.5, 60);
	const item = longItem(pts, 16, 'path', (g0, rr) => softEnds(g0, item, tipsOf(pts), 120, rr, g => {
		// Un chemin de terre blonde, bien lisible : un bord plus sombre où l'herbe le mord, la terre chaude,
		// une bande plus claire au milieu, usée par les pas ; des pierres plates à demi enfoncées,
		// des graviers, et des touffes d'herbe et de fleurs qui débordent sur les bords.
		earthPath(g, pts, 26, rr);
		for (let i = 0; i < pts.length; i++) {
			const [x0, y0] = pts[i], [x1, y1] = pts[i + 1] ?? pts[i];
			const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
			for (let k = 0; k < n; k++) {
				const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
				wash(g, x + rr.gauss() * 3, y + rr.gauss() * 2, rr.range(5, 10), rr.range(3, 5), rr.pick(['#C4A274', '#DCC292', '#B8966A']), rr, { layers: 2, alpha: 0.14, edge: 0 });
			}
			// Une pierre plate de temps en temps : un dessus clair, une ombre fraîche en bas.
			if (rr() < 0.45) {
				const px = x0 + rr.gauss() * 5, py = y0 + rr.gauss() * 3, s = rr.range(3.5, 6.5);
				wash(g, px + 0.8, py + s * 0.35, s, s * 0.45, '#7A6A58', rr, { layers: 2, alpha: 0.2, edge: 0 });
				wash(g, px, py, s, s * 0.55, rr.pick(['#C8BCA6', '#BDB09A', '#D4C8B2']), rr, { layers: 4, alpha: 0.55, edge: 0.4 });
				wash(g, px - s * 0.25, py - s * 0.15, s * 0.45, s * 0.2, '#F2EADA', rr, { layers: 2, alpha: 0.35, edge: 0 });
			}
			if (rr() < 0.6) wash(g, x0 + rr.gauss() * 7, y0 + rr.gauss() * 4, rr.range(0.8, 1.6), rr.range(0.6, 1.2), rr.pick(['#9A8A70', '#B8A888', '#7A6A58']), rr, { layers: 2, alpha: 0.55, edge: 0.3 });
			for (const side of [-1, 1]) {
				if (rr() < 0.7) for (let k = 0; k < 3; k++) ribbon(g, curve(x0 + side * rr.range(9, 13), y0 + rr.gauss() * 4, -Math.PI / 2 + side * 0.3 + rr.gauss() * 0.3, rr.range(4, 8), rr.gauss() * 0.3, 3), 1.1, 0.3, rr.pick(['#6E9A42', '#7FAA48', '#5F8A3A']), rr, 0.75);
				if (rr() < 0.12) wash(g, x0 + side * rr.range(11, 15), y0 + rr.gauss() * 4 - 5, 1.6, 1.4, rr.pick(['#FFFFFF', '#F2D24A', '#E87A9A']), rr, { layers: 2, alpha: 0.8, edge: 0.2 });
			}
		}
	}, () => overgrow(g0, pts, rr, 23)), seed);
	return item;
}

// Le marais (dans sa parcelle cœur) : une rivière descend du haut de la parcelle jusqu'à la mare aux grenouilles,
// qui se déverse dans la grande mare, puis dans la mare du bas (les mares sont des décors de plants.js, toujours là).
const MARSH_STREAMS = [
	// Chaque ruisseau part du milieu d'une mare et finit au milieu de la suivante : les mares, peintes par-dessus,
	// cachent ses bouts, et l'eau coule sans trou de l'une à l'autre.
	{ from: [150, 0], to: [100, 236], w: 36, amp: 40, seed: 1, spring: true },
	{ from: [112, 262], to: [196, 540], w: 34, amp: 38, seed: 2 },
	{ from: [236, 590], to: [306, 924], w: 36, amp: 42, seed: 3 },
];

/** Un cours d'eau d'un point à un autre (coordonnées de la parcelle) : un lit d'herbe humide, l'eau, un reflet clair. */
function stream({ from: [x0, y0], to: [x1, y1], w, amp, seed, spring }, ox, oy) {
	const r = rng(hash('marais', 'stream', seed)), p1 = r() * 6.28, p2 = r() * 6.28, pts = [];
	const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(4, Math.ceil(L / 30));
	for (let k = 0; k <= n; k++) {
		const t = k / n, fade = Math.min(1, t * 6, (1 - t) * 6);
		// Au moins un vrai méandre, quelle que soit la longueur du ruisseau.
		const d = (amp * Math.sin(t * Math.PI * 1.5 + p1) + amp * 0.35 * Math.sin(t * Math.PI * 3.6 + p2)) * fade;
		pts.push([ox + x0 + (x1 - x0) * t + d * (y1 - y0) / L, oy + y0 + (y1 - y0) * t - d * (x1 - x0) / L]);
	}
	// Les bouts finissent sous les mares, en s'évasant comme une embouchure ; la rivière d'arrivée, elle, naît d'une
	// source qui se fond dans le sol.
	const mouth = t => 1 + 0.7 * Math.max(0, (t - 0.82) / 0.18) + (spring ? 0 : 0.7 * Math.max(0, (0.18 - t) / 0.18));
	const paint = (g, rr) => waterCourse(g, pts, w, rr, mouth);
	const item = longItem(pts, w * 0.6 + 6, 'river', spring ? (g, rr) => softEnds(g, item, tipsOf(pts).slice(0, 1), 110, rr, o => paint(o, rr)) : paint, hash('marais', 'stream', seed));
	return item;
}

function longItem(pts, r, kind, paint, seed) {
	const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
	// La boîte déborde largement : l'herbe mouillée des berges et l'embouchure dans les mares ne sont jamais coupées.
	return { layer: 1.5, pts, r, kind, paint, seed, x0: Math.min(...xs) - 80, x1: Math.max(...xs) + 80, y0: Math.min(...ys) - 80, y1: Math.max(...ys) + 80 };
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
/** Les ruisseaux de la case (gx, gy), pour y faire couler l'eau. */
export const riversIn = (at, gx, gy) => featuresOf(at(gx, gy), gx, gy).filter(f => f.kind === 'river');

function featuresOf(tile, gx, gy) {
	const key = `${tileKey(tile)}:${gx},${gy}`;
	let f = featureCache.get(key);
	if (!f) featureCache.set(key, (f = tileFeatures(tile, gx, gy)));
	return f;
}

/** Le point (monde) tombe-t-il sur un ruisseau, une flaque ou un sentier ? `at(gx, gy)` : la case du jardin. */
export function keepOut(at, x, y, pad = 0) {
	const gx = Math.floor(x / PARCEL_W), gy = Math.floor(y / PARCEL_H);
	for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
		for (const a of featuresOf(at(gx + dx, gy + dy), gx + dx, gy + dy).avoid) {
			if (nearLine(a.x0 != null ? a : { ...a, x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity }, x, y, pad)) return true;
		}
	}
	return false;
}

/** Une signature des cases autour de (gx, gy) : la peinture d'une case change quand une voisine change de milieu. */
export function tileSig(at, gx, gy) {
	const out = [];
	for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) out.push(tileKey(at(x, y)));
	return out.join('|');
}

/**
 * La peinture de la case (gx, gy), découpée en petites étapes : on peut l'étaler sur plusieurs images sans
 * jamais figer l'écran. `tone` recolore selon la saison ; l'ordre de peinture est le même pour toutes les cases.
 */
export function tileSteps(at, gx, gy, tone, season) {
	const W = PARCEL_W, H = PARCEL_H, ox = gx * W, oy = gy * H, own = at(gx, gy).biome;
	const steps = [g => {
		g.save();
		g.translate(-ox, -oy);
		g.fillStyle = tone(GROUND[own].base);
		g.fillRect(ox, oy, W, H);
		// Vers un voisin d'un autre milieu, le fond prend peu à peu sa couleur : moitié-moitié sur la frontière.
		for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
			const b = at(gx + dx, gy + dy).biome;
			if (b === own) continue;
			const ex = dx < 0 ? ox : dx > 0 ? ox + W : null, ey = dy < 0 ? oy : dy > 0 ? oy + H : null;
			const grd = ex != null ? g.createLinearGradient(ex, 0, ex - dx * BLEND, 0) : g.createLinearGradient(0, ey, 0, ey - dy * BLEND);
			const col = tone(GROUND[b].base);
			grd.addColorStop(0, rgba(col, 0.5));
			grd.addColorStop(1, rgba(col, 0));
			g.fillStyle = grd;
			g.fillRect(ox, oy, W, H);
		}
	}];
	const all = [];
	for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) {
		for (const f of featuresOf(at(x, y), x, y)) if (f.x1 > ox && f.x0 < ox + W && f.y1 > oy && f.y0 < oy + H) all.push(f);
	}
	// Même ordre partout : par couche, puis par case, puis dans l'ordre de création ;
	// ruisseaux et sentiers passent entre le sol et les petits détails.
	all.sort((a, b) => a.layer - b.layer);
	for (const f of all) if (f.layer < 2) steps.push(g => f.paint(g, rng(f.seed), tone, season));
	steps.push(...reliefSteps(at, gx, gy));
	for (const f of all) if (f.layer >= 2) steps.push(g => f.paint(g, rng(f.seed), tone, season));
	steps.push(g => g.restore());
	return steps;
}
