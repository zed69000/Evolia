// Aménager son jardin : une cabane, un banc, des abris pour les animaux… achetés avec le nectar et posés
// où l'on veut à l'intérieur de la clôture. Chaque objet est peint à l'aquarelle, comme le reste du jardin,
// avec sa base en (0, 0). Certains attirent un animal de plus quand l'espèce est déjà découverte.

import { rng, wash, ribbon, curve, leaf, rgba } from './watercolor.js';

// km : kilomètres au total pour pouvoir le construire ; attracts : espèce dont il ajoute un individu visible.
export const ITEMS = {
	banc: { name: 'Un banc', cost: 40, km: 0, text: 'Pour s’asseoir et regarder le jardin vivre.', box: { w: 110, h: 80, ax: 55, ay: 66 } },
	bois: { name: 'Un tas de bois', cost: 30, km: 0, text: 'Hérissons, carabes et champignons y trouvent refuge.', attracts: 'herisson', box: { w: 110, h: 70, ax: 55, ay: 56 } },
	pierres: { name: 'Un tas de pierres', cost: 30, km: 0, text: 'Les lézards viennent s’y chauffer au soleil.', attracts: 'lezard', box: { w: 100, h: 60, ax: 50, ay: 46 } },
	nichoir: { name: 'Un nichoir', cost: 60, km: 2, text: 'Une mésange peut y élever ses petits.', attracts: 'mesange', box: { w: 60, h: 120, ax: 30, ay: 112 } },
	lanterne: { name: 'Une lanterne', cost: 50, km: 2, text: 'Une lumière douce pour les soirées, tournée vers le sol.', box: { w: 50, h: 110, ax: 25, ay: 104 } },
	hotel: { name: 'Un hôtel à insectes', cost: 80, km: 3, text: 'Abeilles solitaires et coccinelles y passent l’hiver.', attracts: 'abeille', box: { w: 90, h: 120, ax: 45, ay: 110 } },
	cabane: { name: 'Une petite cabane', cost: 200, km: 5, text: 'Ton abri au fond du jardin.', box: { w: 170, h: 170, ax: 85, ay: 150 } },
	ruche: { name: 'Une ruche en paille', cost: 150, km: 12, text: 'Des abeilles de plus pour polliniser tes fleurs.', attracts: 'abeille', box: { w: 80, h: 90, ax: 40, ay: 78 } },
	arche: { name: 'Une arche de roses', cost: 120, km: 20, text: 'Un passage fleuri pour les papillons.', attracts: 'paon-du-jour', box: { w: 150, h: 170, ax: 75, ay: 160 } },
};
export const ITEM_ORDER = ['banc', 'bois', 'pierres', 'nichoir', 'lanterne', 'hotel', 'cabane', 'ruche', 'arche'];

const shade = (g, d, rx, ry = rx * 0.3) => wash(g, rx * 0.12, 2, rx, ry, '#2E4A22', d, { layers: 5, alpha: 0.07, edge: 0 });

function plank(g, x, y, w, h, col, d, alpha = 0.9) {
	g.fillStyle = rgba(col, alpha);
	g.beginPath();
	g.roundRect(x, y, w, h, Math.min(2, h / 3));
	g.fill();
	g.strokeStyle = rgba('#3A2414', 0.35);
	g.lineWidth = 0.8;
	g.stroke();
	wash(g, x + w / 2, y + h / 2, w * 0.45, h * 0.4, '#FFF4DC', d, { layers: 2, alpha: 0.05, edge: 0 });
}

function paintBanc(g) {
	const d = rng(41);
	shade(g, d, 50);
	for (const x of [-38, 30]) plank(g, x, -26, 7, 26, '#6E4A2C', d);
	plank(g, -46, -32, 92, 9, '#9A6A40', d);
	plank(g, -44, -58, 88, 8, '#A87A4C', d);
	plank(g, -44, -46, 88, 6, '#A87A4C', d);
	for (const x of [-36, 32]) plank(g, x, -58, 5, 28, '#6E4A2C', d);
	return { top: -58 };
}

function paintBois(g) {
	const d = rng(42);
	shade(g, d, 52);
	const logs = [[-30, -12], [0, -12], [30, -12], [-15, -32], [15, -32], [0, -50]];
	for (const [x, y] of logs) {
		wash(g, x, y, 15, 14, '#7A4E2C', d, { layers: 8, alpha: 0.2 });
		wash(g, x, y, 11, 10, '#D8B07A', d, { layers: 6, alpha: 0.35, edge: 0.3 });
		g.strokeStyle = rgba('#8A5A34', 0.5); g.lineWidth = 0.7;
		for (const r of [4, 7]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
	}
	for (let i = 0; i < 4; i++) wash(g, d.range(-40, 40), d.range(-45, -5), 6, 3, '#7FAA48', d, { layers: 4, alpha: 0.25, edge: 0 });
	return { top: -62 };
}

function paintPierres(g) {
	const d = rng(43);
	shade(g, d, 48);
	for (const [x, y, s] of [[-26, -10, 16], [4, -12, 20], [30, -8, 14], [-10, -28, 15], [16, -30, 13], [2, -42, 11]]) {
		wash(g, x, y, s, s * 0.7, d.pick(['#A8A498', '#BCB8AC', '#9A968A', '#C8C0B0']), d, { layers: 9, alpha: 0.28, edge: 0.5 });
		wash(g, x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.25, '#EEEAE0', d, { layers: 4, alpha: 0.2, edge: 0 });
	}
	return { top: -50 };
}

function paintNichoir(g) {
	const d = rng(44);
	shade(g, d, 18, 6);
	plank(g, -3, -70, 6, 70, '#7A5232', d);
	plank(g, -20, -104, 40, 36, '#B08050', d);
	g.fillStyle = rgba('#2A1A0E', 0.85);
	g.beginPath(); g.arc(0, -88, 5, 0, Math.PI * 2); g.fill();
	plank(g, -2, -80, 4, 2, '#5A3A20', d);
	g.fillStyle = rgba('#6E8A4A', 0.95);
	g.beginPath(); g.moveTo(-26, -100); g.lineTo(0, -114); g.lineTo(26, -100); g.lineTo(22, -97); g.lineTo(0, -108); g.lineTo(-22, -97); g.closePath(); g.fill();
	wash(g, -6, -106, 10, 3, '#9ABA6A', d, { layers: 4, alpha: 0.3, edge: 0 });
	return { top: -114 };
}

function paintLanterne(g) {
	const d = rng(45);
	shade(g, d, 14, 5);
	plank(g, -2.5, -78, 5, 78, '#4A3A2A', d);
	plank(g, -14, -82, 28, 4, '#4A3A2A', d);
	g.fillStyle = rgba('#FBE7A8', 0.9);
	g.beginPath(); g.roundRect(-9, -100, 18, 20, 3); g.fill();
	wash(g, 0, -90, 7, 8, '#F4C23E', d, { layers: 6, alpha: 0.35, edge: 0 });
	g.strokeStyle = rgba('#3A2A1A', 0.8); g.lineWidth = 1.4;
	g.beginPath(); g.roundRect(-9, -100, 18, 20, 3); g.moveTo(0, -100); g.lineTo(0, -80); g.stroke();
	g.fillStyle = rgba('#3A2A1A', 0.9);
	g.beginPath(); g.moveTo(-12, -100); g.lineTo(0, -108); g.lineTo(12, -100); g.closePath(); g.fill();
	return { top: -108, glow: -90 };
}

function paintHotel(g) {
	const d = rng(46);
	shade(g, d, 40, 10);
	for (const x of [-30, 24]) plank(g, x, -30, 6, 30, '#6E4A2C', d);
	plank(g, -34, -96, 68, 70, '#9A6A40', d);
	// Cases : bûchettes percées, tiges creuses, pommes de pin.
	const cells = [[-28, -90, 26, 20], [2, -90, 26, 20], [-28, -66, 26, 18], [2, -66, 26, 18], [-28, -46, 56, 16]];
	cells.forEach(([x, y, w, h], i) => {
		g.fillStyle = rgba('#5A3A20', 0.9); g.fillRect(x, y, w, h);
		if (i % 2 === 0) for (let k = 0; k < 6; k++) { g.fillStyle = rgba('#D8B07A', 0.95); g.beginPath(); g.arc(x + 5 + (k % 3) * 8, y + 5 + Math.floor(k / 3) * 9, 3.2, 0, 6.28); g.fill(); g.fillStyle = '#2A1A0E'; g.beginPath(); g.arc(x + 5 + (k % 3) * 8, y + 5 + Math.floor(k / 3) * 9, 1.1, 0, 6.28); g.fill(); }
		else for (let k = 0; k < 8; k++) ribbon(g, curve(x + 2, y + 2 + k * (h / 8), 0, w - 4, d.gauss() * 0.05, 4), 1.6, 1.4, '#D8C070', d, 0.8);
	});
	g.fillStyle = rgba('#8A3A2A', 0.95);
	g.beginPath(); g.moveTo(-42, -94); g.lineTo(0, -112); g.lineTo(42, -94); g.lineTo(38, -90); g.lineTo(0, -106); g.lineTo(-38, -90); g.closePath(); g.fill();
	return { top: -112 };
}

function paintCabane(g) {
	const d = rng(47);
	shade(g, d, 82, 18);
	// Murs en planches, porte, fenêtre éclairée d'une lumière chaude.
	for (let i = 0; i < 11; i++) plank(g, -60 + i * 11, -78, 11, 78, i % 2 ? '#A87A4C' : '#9A6A40', d, 0.95);
	plank(g, -14, -54, 26, 54, '#6E4A2C', d);
	g.fillStyle = rgba('#3A2414', 0.9); g.beginPath(); g.arc(7, -27, 2, 0, 6.28); g.fill();
	g.fillStyle = rgba('#FBE7A8', 0.95); g.fillRect(24, -58, 26, 20);
	wash(g, 37, -48, 10, 7, '#F4C23E', d, { layers: 5, alpha: 0.3, edge: 0 });
	g.strokeStyle = rgba('#4A2E1A', 0.9); g.lineWidth = 2;
	g.strokeRect(24, -58, 26, 20); g.beginPath(); g.moveTo(37, -58); g.lineTo(37, -38); g.moveTo(24, -48); g.lineTo(50, -48); g.stroke();
	// Toit en bardeaux, débordant, avec un peu de mousse.
	const roof = [[-76, -74], [0, -132], [76, -74], [70, -70], [0, -122], [-70, -70]];
	g.fillStyle = rgba('#7A4A34', 0.97);
	g.beginPath(); roof.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
	g.strokeStyle = rgba('#4A2A1E', 0.45); g.lineWidth = 1;
	for (let k = 1; k < 6; k++) {
		const t = k / 6;
		g.beginPath(); g.moveTo(-76 * (1 - t), -74 - 58 * t); g.lineTo(76 * (1 - t), -74 - 58 * t); g.stroke();
	}
	for (let i = 0; i < 7; i++) wash(g, d.range(-50, 50), d.range(-112, -80), d.range(6, 14), d.range(3, 6), '#6E9A4A', d, { layers: 5, alpha: 0.3, edge: 0 });
	plank(g, 30, -138, 12, 30, '#8A7A6A', d);
	// Une plante grimpante sur le côté.
	for (let i = 0; i < 9; i++) leaf(g, -62 + d.range(-4, 6), -6 - i * 8, 9, 4, -Math.PI / 2 + d.gauss() * 0.8, '#4E8A3E', d, 0.8);
	return { top: -138, glow: -48, glowX: 37 };
}

function paintRuche(g) {
	const d = rng(48);
	shade(g, d, 36, 9);
	plank(g, -30, -10, 60, 10, '#7A5232', d);
	// Ruche en paille : un dôme cerclé.
	for (let k = 0; k < 6; k++) {
		const y = -14 - k * 10, w = 30 * Math.cos((k / 6) * 1.3) + 4;
		wash(g, 0, y, w, 7, k % 2 ? '#D8B060' : '#C89A48', d, { layers: 7, alpha: 0.3, edge: 0.3 });
	}
	wash(g, 0, -74, 10, 7, '#D8B060', d, { layers: 6, alpha: 0.3, edge: 0.3 });
	g.fillStyle = rgba('#2A1A0E', 0.9); g.beginPath(); g.ellipse(0, -16, 6, 4, 0, 0, 6.28); g.fill();
	return { top: -80 };
}

function paintArche(g) {
	const d = rng(49);
	shade(g, d, 70, 10);
	const left = curve(-56, 0, -Math.PI / 2, 120, 0.15, 10), arc = [], right = curve(56, 0, -Math.PI / 2, 120, -0.15, 10);
	for (let k = 0; k <= 16; k++) { const a = Math.PI + (k / 16) * Math.PI; arc.push([Math.cos(a) * 54, -118 + Math.sin(a) * 34]); }
	for (const pts of [left, right, arc]) ribbon(g, pts, 4, 4, '#6E5A3A', d, 0.9);
	for (const pts of [left, right, arc]) for (let i = 0; i < pts.length; i++) {
		const [x, y] = pts[i];
		leaf(g, x, y, 10, 4, d() * 6.28, d.pick(['#3E7A3C', '#4E8A3E', '#5F933E']), d, 0.85);
		if (i % 2 === 0) { wash(g, x + d.gauss() * 4, y + d.gauss() * 4, 5, 5, d.pick(['#E87A9A', '#F2A0B8', '#D85A80']), d, { layers: 6, alpha: 0.4, edge: 0.3 }); }
	}
	return { top: -156 };
}

export const ITEM_PAINTERS = {
	banc: paintBanc, bois: paintBois, pierres: paintPierres, nichoir: paintNichoir, lanterne: paintLanterne,
	hotel: paintHotel, cabane: paintCabane, ruche: paintRuche, arche: paintArche,
};

/** Combien d'individus de plus d'une espèce les objets posés dans ce lieu attirent. */
export function attracted(place, spId) {
	let n = 0;
	for (const it of place?.items ?? []) if (ITEMS[it.kind]?.attracts === spId) n++;
	return n;
}
