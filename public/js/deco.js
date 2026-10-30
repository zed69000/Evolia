// Aménager son jardin : une cabane, un banc, des abris pour les animaux… achetés avec le nectar et posés
// où l'on veut à l'intérieur de la clôture. Chaque objet est peint à l'aquarelle, comme le reste du jardin,
// avec sa base en (0, 0). Les objets d'abri renforcent une équipe de l'écosystème, et attirent un animal visible.
// Ceux qui ont un devant et un dos (banc, cabane…) se tournent par pas de 45° : ils sont construits en volumes
// simples, projetés dans la même vue légèrement plongeante que le jardin.

import { rng, wash, ribbon, curve, leaf, rgba } from './watercolor.js';

// km : kilomètres au total pour pouvoir le construire ; team : équipe de l'écosystème renforcée (power membres) ;
// attracts : espèce dont il ajoute un individu visible ; turn : se tourne par pas de 45°.
export const ITEMS = {
	banc: { name: 'Un banc', cost: 40, km: 0, turn: true, text: 'Pour s’asseoir et regarder le jardin vivre.', box: { w: 130, h: 104, ax: 65, ay: 78 } },
	massif: { name: 'Un massif mellifère', cost: 25, km: 0, team: 'pollinisateur', power: 1, attracts: 'bourdon', text: 'Lavande, bourrache et thym : un buffet pour les butineurs.', box: { w: 110, h: 70, ax: 55, ay: 56 } },
	bois: { name: 'Un tas de bois', cost: 30, km: 0, team: 'sol', power: 1, attracts: 'herisson', text: 'Carabes, cloportes et champignons y décomposent le bois.', box: { w: 110, h: 70, ax: 55, ay: 56 } },
	pierres: { name: 'Un tas de pierres', cost: 30, km: 0, team: 'regulateur', power: 1, attracts: 'lezard', text: 'Les lézards viennent s’y chauffer au soleil.', box: { w: 100, h: 60, ax: 50, ay: 46 } },
	mangeoire: { name: 'Une mangeoire', cost: 45, km: 1, turn: true, team: 'semeur', power: 1, attracts: 'merle', text: 'Les oiseaux qu’elle nourrit sèment ensuite baies et noisettes.', box: { w: 80, h: 120, ax: 40, ay: 104 } },
	nichoir: { name: 'Un nichoir', cost: 60, km: 2, turn: true, team: 'regulateur', power: 1, attracts: 'mesange', text: 'Une mésange y élève ses petits… et mange les chenilles.', box: { w: 70, h: 136, ax: 35, ay: 124 } },
	lanterne: { name: 'Une lanterne', cost: 50, km: 2, text: 'Une lumière douce pour les soirées, tournée vers le sol.', box: { w: 50, h: 110, ax: 25, ay: 104 } },
	compost: { name: 'Un bac à compost', cost: 60, km: 3, turn: true, team: 'sol', power: 1, attracts: 'lombric', text: 'Épluchures et feuilles mortes deviennent une terre noire pleine de vers.', box: { w: 100, h: 90, ax: 50, ay: 70 } },
	hotel: { name: 'Un hôtel à insectes', cost: 80, km: 3, turn: true, team: 'pollinisateur', power: 1, attracts: 'abeille', text: 'Abeilles solitaires et coccinelles y passent l’hiver.', box: { w: 110, h: 140, ax: 55, ay: 124 } },
	mare: { name: 'Une petite mare', cost: 90, km: 4, team: 'regulateur', power: 2, text: 'Libellules et grenouilles chassent les moustiques qui y dansent.', box: { w: 160, h: 80, ax: 80, ay: 40 } },
	cabane: { name: 'Une petite cabane', cost: 200, km: 5, turn: true, text: 'Ton abri au fond du jardin.', box: { w: 200, h: 215, ax: 100, ay: 175 } },
	abri: { name: 'Un abri à hérisson', cost: 70, km: 6, turn: true, team: 'regulateur', power: 1, attracts: 'herisson', text: 'Une petite maison sous les feuilles, où il passe l’hiver.', box: { w: 90, h: 70, ax: 45, ay: 50 } },
	ruche: { name: 'Une ruche en paille', cost: 120, km: 6, team: 'pollinisateur', power: 2, attracts: 'abeille', text: 'Toute une colonie d’abeilles pour polliniser tes fleurs.', box: { w: 80, h: 90, ax: 40, ay: 78 } },
	bain: { name: 'Un bain d’oiseaux', cost: 100, km: 8, team: 'semeur', power: 1, attracts: 'merle', text: 'De l’eau fraîche : les oiseaux reviennent, et sèment autour.', box: { w: 80, h: 90, ax: 40, ay: 80 } },
	potager: { name: 'Un carré de potager', cost: 90, km: 5, turn: true, needs: 'cabane', team: 'semeur', power: 2, attracts: ['lapin', 'lievre'], text: 'Le jardinier de la cabane y cultive salades, choux et tomates : de quoi nourrir oiseaux, lapins et butineurs. Pose-en plusieurs pour l’agrandir.', box: { w: 170, h: 120, ax: 85, ay: 72 } },
	arche: { name: 'Une arche de roses', cost: 120, km: 20, turn: true, team: 'pollinisateur', power: 1, attracts: 'paon-du-jour', text: 'Un passage fleuri pour les papillons.', box: { w: 170, h: 190, ax: 85, ay: 172 } },
};
export const ITEM_ORDER = ['banc', 'massif', 'bois', 'pierres', 'mangeoire', 'nichoir', 'lanterne', 'compost', 'hotel', 'mare', 'cabane', 'potager', 'abri', 'ruche', 'bain', 'arche'];

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

// ─── Volumes tournants ──────────────────────────────────────────
// x vers la droite, y vers la personne qui regarde, z vers le haut ; la rotation tourne l'objet sur lui-même.
const GROUND = 0.36, RISE = 0.95;
const LIGHT = (() => { const v = [-0.5, 0.45, 0.75], n = Math.hypot(...v); return v.map(c => c / n); })();

function view(rot) {
	const c = Math.cos(rot), s = Math.sin(rot);
	const turn = ([x, y, z]) => [x * c - y * s, x * s + y * c, z];
	return {
		turn,
		at: p => { const [X, Y, Z] = turn(p); return [X, Y * GROUND - Z * RISE]; },
		vec: p => { const [X, Y, Z] = turn(p); return [X, Y * GROUND - Z * RISE]; },
		depth: p => turn(p)[1],
	};
}

/** Une couleur plus claire (k > 1) ou plus sombre (k < 1). */
function tone(hex, k) {
	const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
	return `#${((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')}`;
}

/**
 * Une face plane : polygone (points 3D), normale, couleur, et peinture facultative dans son propre repère
 * (origine o, axe u vers la droite, axe v vers le haut ; on y peint en (fx, -fy) comme le reste des objets).
 */
const face = (pts, n, color, paint = null, o = null, u = null, v = null) => ({ pts, n, color, paint, o, u, v });

/** Un pavé : centre de sa base (cx, cy, z), largeur w (x), profondeur dp (y), hauteur h ; `paint` par face. */
function box(cx, cy, z, w, dp, h, color, paint = {}) {
	const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - dp / 2, y1 = cy + dp / 2, z1 = z + h;
	return {
		at: [cx, cy, z + h / 2],
		faces: [
			face([[x0, y1, z], [x1, y1, z], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], color, paint.front, [x0, y1, z], [1, 0, 0], [0, 0, 1]),
			face([[x1, y0, z], [x0, y0, z], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0], color, paint.back, [x1, y0, z], [-1, 0, 0], [0, 0, 1]),
			face([[x1, y1, z], [x1, y0, z], [x1, y0, z1], [x1, y1, z1]], [1, 0, 0], color, paint.right, [x1, y1, z], [0, -1, 0], [0, 0, 1]),
			face([[x0, y0, z], [x0, y1, z], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0], color, paint.left, [x0, y0, z], [0, 1, 0], [0, 0, 1]),
			face([[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], [0, 0, 1], paint.topColor ?? color, paint.top, [x0, y1, z1], [1, 0, 0], [0, -1, 0]),
		],
	};
}

/** Un toit à deux pans, faîte dans le sens de la profondeur (pignon sur le devant), avec débord. */
function roof(cx, cy, z, w, dp, rise, over, color, paint = null, gable = tone(color, 1.1)) {
	const hw = w / 2 + over, hd = dp / 2 + over, top = z + rise;
	const L = Math.hypot(hw, rise), nl = [-rise / L, 0, hw / L], nr = [rise / L, 0, hw / L];
	return {
		at: [cx, cy, z + rise / 2],
		faces: [
			face([[cx - hw, cy + hd, z], [cx, cy + hd, top], [cx, cy - hd, top], [cx - hw, cy - hd, z]], nl, color, paint, [cx - hw, cy + hd, z], [0, -1, 0], [hw / L, 0, rise / L]),
			face([[cx + hw, cy - hd, z], [cx, cy - hd, top], [cx, cy + hd, top], [cx + hw, cy + hd, z]], nr, color, paint, [cx + hw, cy - hd, z], [0, 1, 0], [-hw / L, 0, rise / L]),
			face([[cx - hw + over, cy + hd - over, z], [cx + hw - over, cy + hd - over, z], [cx, cy + hd - over, top - over * rise / hw]], [0, 1, 0], gable),
			face([[cx + hw - over, cy - hd + over, z], [cx - hw + over, cy - hd + over, z], [cx, cy - hd + over, top - over * rise / hw]], [0, -1, 0], gable),
		],
	};
}

/** Peint des volumes dans l'ordre (du fond vers l'avant), faces cachées omises, éclairage doux venu d'en haut à gauche. */
function build(g, d, rot, solids) {
	const V = view(rot);
	solids.sort((a, b) => V.depth(a.at) - V.depth(b.at));
	for (const s of solids) {
		const faces = s.faces.map(f => ({ f, nn: V.turn(f.n) })).filter(({ nn }) => nn[1] * RISE + nn[2] * GROUND > 1e-4 || nn[2] > 0.99);
		faces.sort((a, b) => V.depth(a.f.pts[0]) - V.depth(b.f.pts[0]));
		for (const { f, nn } of faces) {
			const lit = 0.72 + 0.32 * Math.max(0, nn[0] * LIGHT[0] + nn[1] * LIGHT[1] + nn[2] * LIGHT[2]);
			g.beginPath();
			f.pts.forEach((p, i) => { const [x, y] = V.at(p); i ? g.lineTo(x, y) : g.moveTo(x, y); });
			g.closePath();
			if (f.color) {
				g.fillStyle = rgba(tone(f.color, lit), 0.95);
				g.fill();
				g.strokeStyle = rgba('#3A2414', 0.3);
				g.lineWidth = 0.8;
				g.stroke();
			}
			if (!f.paint) continue;
			// La face devient une feuille plane où l'on peint comme sur un objet de face.
			const [ox, oy] = V.at(f.o), [ux, uy] = V.vec(f.u), [vx, vy] = V.vec(f.v);
			g.save();
			g.clip();
			g.transform(ux, uy, -vx, -vy, ox, oy);
			g.globalAlpha = Math.min(1, lit);
			f.paint(g, d);
			g.restore();
		}
	}
	return V;
}

const planksH = (w, h, step, col) => (g, d) => {
	g.strokeStyle = rgba(col, 0.35);
	g.lineWidth = 0.9;
	for (let y = -step; y > -h; y -= step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + d.gauss() * 0.4); g.stroke(); }
	wash(g, w / 2, -h / 2, w * 0.45, h * 0.4, '#FFF4DC', d, { layers: 2, alpha: 0.06, edge: 0 });
};
const planksV = (w, h, step, col) => (g, d) => {
	g.strokeStyle = rgba(col, 0.35);
	g.lineWidth = 0.9;
	for (let x = step; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + d.gauss() * 0.4, -h); g.stroke(); }
	wash(g, w / 2, -h / 2, w * 0.45, h * 0.4, '#FFF4DC', d, { layers: 2, alpha: 0.06, edge: 0 });
};

// ─── Les objets ─────────────────────────────────────────────────

function paintBanc(g, rot) {
	const d = rng(41);
	shade(g, d, 50);
	const wood = '#A87A4C', dark = '#6E4A2C';
	build(g, d, rot, [
		...[[-38, 8], [38, 8], [-38, -8], [38, -8]].map(([x, y]) => box(x, y, 0, 6, 6, 24, dark)),
		box(0, 0, 24, 94, 26, 5, '#9A6A40', { top: planksV(94, 26, 18.8, '#5A3A20') }),
		...[-36, 36].map(x => box(x, -11, 29, 5, 5, 32, dark)),
		box(0, -12, 38, 90, 3, 7, wood),
		box(0, -12, 50, 90, 3, 8, wood),
	]);
	return { top: -64 };
}

function paintMassif(g) {
	const d = rng(50);
	shade(g, d, 50);
	wash(g, 0, -6, 48, 14, '#6E5A3A', d, { layers: 6, alpha: 0.2, edge: 0.2 });
	for (let i = 0; i < 26; i++) {
		const x = d.range(-44, 44), y = d.range(-16, 4);
		const tall = d.range(14, 34);
		ribbon(g, curve(x, y, -Math.PI / 2 + d.gauss() * 0.15, tall, d.gauss() * 0.2, 4), 1.2, 0.6, '#5F8A3E', d, 0.8);
		const col = d.pick(['#9A7AD0', '#8A6AC8', '#5A8AD8', '#F2D24A', '#FFFFFF', '#B08AE0']);
		const [hx, hy] = [x, y - tall];
		if (col.startsWith('#9A') || col.startsWith('#8A') || col.startsWith('#B0')) for (let k = 0; k < 4; k++) wash(g, hx, hy + k * 3, 2.5, 2, col, d, { layers: 3, alpha: 0.5, edge: 0.3 });
		else wash(g, hx, hy, 4, 3.5, col, d, { layers: 4, alpha: 0.55, edge: 0.3 });
	}
	return { top: -44 };
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

function paintMangeoire(g, rot) {
	const d = rng(51);
	shade(g, d, 22, 7);
	const seeds = (g2, d2) => { for (let i = 0; i < 40; i++) { g2.fillStyle = rgba(d2.pick(['#C8A060', '#8A6A3A', '#E8D8A8']), 0.9); g2.beginPath(); g2.arc(d2.range(3, 37), d2.range(-27, -3), 1.4, 0, 6.28); g2.fill(); } };
	build(g, d, rot, [
		box(0, 0, 0, 6, 6, 62, '#6E4A2C'),
		box(0, 0, 62, 40, 30, 4, '#9A6A40', { top: seeds }),
		...[[-17, 12], [17, 12], [-17, -12], [17, -12]].map(([x, y]) => box(x, y, 66, 3, 3, 16, '#6E4A2C')),
		roof(0, 0, 82, 40, 30, 12, 5, '#6E8A4A'),
	]);
	return { top: -100 };
}

function paintNichoir(g, rot) {
	const d = rng(44);
	shade(g, d, 18, 6);
	const front = (g2, d2) => {
		planksV(32, 34, 8, '#5A3A20')(g2, d2);
		g2.fillStyle = rgba('#2A1A0E', 0.88);
		g2.beginPath(); g2.arc(16, -20, 5, 0, Math.PI * 2); g2.fill();
		plank(g2, 14, -11, 4, 3, '#5A3A20', d2);
	};
	build(g, d, rot, [
		box(0, 0, 0, 6, 6, 70, '#7A5232'),
		box(0, 0, 68, 32, 28, 34, '#B08050', { front }),
		roof(0, 0, 102, 32, 28, 12, 4, '#6E8A4A', null, '#B08050'),
	]);
	return { top: -128 };
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

function paintCompost(g, rot) {
	const d = rng(52);
	shade(g, d, 44, 12);
	const slats = (w, h) => (g2, d2) => {
		for (let y = 0; y > -h; y -= 9) { g2.fillStyle = rgba('#3A2A18', 0.75); g2.fillRect(0, y - 2, w, 2); }
		planksV(w, h, 20, '#5A3A20')(g2, d2);
	};
	const soil = (g2, d2) => {
		g2.fillStyle = rgba('#3E2A1A', 0.95); g2.fillRect(0, -44, 60, 44);
		for (let i = 0; i < 9; i++) wash(g2, d2.range(6, 54), d2.range(-40, -4), d2.range(3, 6), d2.range(2, 3), d2.pick(['#7FAA48', '#D88A3A', '#E8D07A', '#5A3A24']), d2, { layers: 3, alpha: 0.45, edge: 0.2 });
	};
	build(g, d, rot, [box(0, 0, 0, 60, 44, 32, '#9A6A40', { front: slats(60, 32), back: slats(60, 32), left: slats(44, 32), right: slats(44, 32), top: soil, topColor: '#3E2A1A' })]);
	return { top: -46 };
}

function paintHotel(g, rot) {
	const d = rng(46);
	shade(g, d, 40, 10);
	// Cases : bûchettes percées, tiges creuses, pommes de pin (peintes sur la façade).
	const cells = (g2, d2) => {
		g2.translate(34, 30);
		[[-28, -90, 26, 20], [2, -90, 26, 20], [-28, -66, 26, 18], [2, -66, 26, 18], [-28, -46, 56, 14]].forEach(([x, y, w, h], i) => {
			g2.fillStyle = rgba('#5A3A20', 0.9); g2.fillRect(x, y, w, h);
			if (i % 2 === 0) for (let k = 0; k < 6; k++) { g2.fillStyle = rgba('#D8B07A', 0.95); g2.beginPath(); g2.arc(x + 5 + (k % 3) * 8, y + 5 + Math.floor(k / 3) * 9, 3.2, 0, 6.28); g2.fill(); g2.fillStyle = '#2A1A0E'; g2.beginPath(); g2.arc(x + 5 + (k % 3) * 8, y + 5 + Math.floor(k / 3) * 9, 1.1, 0, 6.28); g2.fill(); }
			else for (let k = 0; k < 8; k++) ribbon(g2, curve(x + 2, y + 2 + k * (h / 8), 0, w - 4, d2.gauss() * 0.05, 4), 1.6, 1.4, '#D8C070', d2, 0.8);
		});
	};
	build(g, d, rot, [
		...[-27, 27].map(x => box(x, 0, 0, 6, 6, 30, '#6E4A2C')),
		box(0, 0, 30, 68, 24, 66, '#9A6A40', { front: cells, left: planksH(24, 66, 10, '#5A3A20'), right: planksH(24, 66, 10, '#5A3A20') }),
		roof(0, 0, 96, 68, 24, 18, 5, '#8A3A2A', null, '#9A6A40'),
	]);
	return { top: -122 };
}

function paintMare(g) {
	const d = rng(53);
	wash(g, 0, 2, 74, 30, '#6E5A3A', d, { layers: 6, alpha: 0.18, edge: 0.2 });
	wash(g, 0, 0, 66, 25, '#4A7A8A', d, { layers: 10, alpha: 0.3, edge: 0.4 });
	wash(g, -8, -3, 50, 17, '#7AAAB8', d, { layers: 6, alpha: 0.3, edge: 0 });
	wash(g, -18, -8, 22, 5, '#E8F2F0', d, { layers: 4, alpha: 0.35, edge: 0 });
	// Un nénuphar, des pierres au bord, des roseaux d'un côté.
	wash(g, 20, 4, 10, 5, '#5F933E', d, { layers: 5, alpha: 0.5, edge: 0.3 });
	wash(g, 22, 2, 3, 2.5, '#F2B8C8', d, { layers: 3, alpha: 0.7, edge: 0.2 });
	for (const [x, y, s] of [[-64, 6, 9], [-52, 20, 7], [58, 14, 8], [40, 24, 6]]) wash(g, x, y, s, s * 0.65, '#B8B2A4', d, { layers: 6, alpha: 0.35, edge: 0.4 });
	for (let i = 0; i < 12; i++) {
		const x = d.range(44, 70), y = d.range(-18, 0);
		ribbon(g, curve(x, y, -Math.PI / 2 + d.gauss() * 0.12, d.range(22, 40), d.gauss() * 0.2, 5), 1.6, 0.5, '#6E8A3E', d, 0.85);
		if (i % 3 === 0) { g.fillStyle = rgba('#6A4A2A', 0.9); g.beginPath(); g.ellipse(x + 1, y - 30, 2, 6, 0, 0, 6.28); g.fill(); }
	}
	return { top: -40, water: true };
}

function paintCabane(g, rot) {
	const d = rng(47);
	shade(g, d, 86, 22);
	// Façade : planches, porte, fenêtre éclairée ; côtés : planches et une petite fenêtre.
	const front = (g2, d2) => {
		for (let i = 0; i < 11; i++) plank(g2, i * 11, -78, 11, 78, i % 2 ? '#A87A4C' : '#9A6A40', d2, 0.95);
		plank(g2, 46, -54, 26, 54, '#6E4A2C', d2);
		g2.fillStyle = rgba('#3A2414', 0.9); g2.beginPath(); g2.arc(67, -27, 2, 0, 6.28); g2.fill();
		g2.fillStyle = rgba('#FBE7A8', 0.95); g2.fillRect(84, -58, 22, 18);
		g2.strokeStyle = rgba('#4A2E1A', 0.9); g2.lineWidth = 2;
		g2.strokeRect(84, -58, 22, 18); g2.beginPath(); g2.moveTo(95, -58); g2.lineTo(95, -40); g2.moveTo(84, -49); g2.lineTo(106, -49); g2.stroke();
		for (let i = 0; i < 8; i++) leaf(g2, 4 + d2.range(-2, 5), -6 - i * 8, 9, 4, -Math.PI / 2 + d2.gauss() * 0.8, '#4E8A3E', d2, 0.8);
	};
	const side = (g2, d2) => {
		for (let i = 0; i < 8; i++) plank(g2, i * 11, -78, 11, 78, i % 2 ? '#A87A4C' : '#9A6A40', d2, 0.95);
		g2.fillStyle = rgba('#FBE7A8', 0.85); g2.fillRect(34, -56, 18, 16);
		g2.strokeStyle = rgba('#4A2E1A', 0.9); g2.lineWidth = 2; g2.strokeRect(34, -56, 18, 16);
	};
	const back = (g2, d2) => { for (let i = 0; i < 11; i++) plank(g2, i * 11, -78, 11, 78, i % 2 ? '#A87A4C' : '#9A6A40', d2, 0.95); };
	const shingles = (g2, d2) => {
		g2.strokeStyle = rgba('#4A2A1E', 0.45); g2.lineWidth = 1;
		for (let y = -8; y > -70; y -= 9) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(110, y); g2.stroke(); }
		for (let i = 0; i < 4; i++) wash(g2, d2.range(10, 90), d2.range(-60, -10), d2.range(6, 12), d2.range(3, 5), '#6E9A4A', d2, { layers: 5, alpha: 0.35, edge: 0 });
	};
	const V = build(g, d, rot, [
		box(0, 0, 0, 121, 88, 78, '#9A6A40', { front, back, left: side, right: side }),
		roof(0, 0, 78, 121, 88, 52, 8, '#7A4A34', shingles, '#A87A4C'),
		box(28, -18, 112, 12, 12, 34, '#8A7A6A'),
	]);
	// Lueur de la fenêtre, là où elle se trouve une fois la cabane tournée (devant ou côté, selon ce qu'on voit).
	const fy = V.turn([0, 1, 0])[1], ry = V.turn([1, 0, 0])[1];
	const win = fy > 0.3 ? [34.5, 44, 49] : ry > 0.3 ? [60.5, 0, 48] : ry < -0.3 ? [-60.5, 0, 48] : null;
	if (!win) return { top: -150 };
	const [gx, gy] = V.at(win);
	return { top: -150, glow: gy, glowX: gx };
}

function paintAbri(g, rot) {
	const d = rng(54);
	shade(g, d, 36, 12);
	const front = (g2, d2) => {
		planksV(46, 22, 9, '#5A3A20')(g2, d2);
		g2.fillStyle = rgba('#1E140C', 0.92);
		g2.beginPath(); g2.moveTo(6, 0); g2.lineTo(6, -9); g2.arc(14, -9, 8, Math.PI, 0); g2.lineTo(22, 0); g2.closePath(); g2.fill();
	};
	const leaves = (g2, d2) => { for (let i = 0; i < 12; i++) wash(g2, d2.range(4, 46), d2.range(-30, -4), d2.range(4, 8), d2.range(3, 5), d2.pick(['#C87A3A', '#A8602A', '#D8A050', '#8A5A2A']), d2, { layers: 4, alpha: 0.5, edge: 0.3 }); };
	build(g, d, rot, [
		box(0, 0, 0, 46, 36, 22, '#8A6040', { front }),
		roof(0, 0, 22, 46, 36, 12, 4, '#9A7A50', leaves, '#8A6040'),
	]);
	return { top: -40 };
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

function paintBain(g) {
	const d = rng(55);
	shade(g, d, 30, 9);
	// Un pied de pierre, une vasque, un peu d'eau qui brille.
	wash(g, 0, -4, 18, 6, '#9A968A', d, { layers: 6, alpha: 0.35, edge: 0.4 });
	g.fillStyle = rgba('#B8B2A4', 0.95);
	g.beginPath(); g.moveTo(-9, -4); g.lineTo(-6, -50); g.lineTo(6, -50); g.lineTo(9, -4); g.closePath(); g.fill();
	wash(g, -3, -28, 3, 18, '#D8D2C4', d, { layers: 3, alpha: 0.3, edge: 0 });
	g.fillStyle = rgba('#A8A294', 0.97);
	g.beginPath(); g.ellipse(0, -54, 34, 12, 0, 0, Math.PI); g.lineTo(-34, -58); g.ellipse(0, -58, 34, 11, 0, Math.PI, 0); g.closePath(); g.fill();
	g.fillStyle = rgba('#C8C2B4', 0.97);
	g.beginPath(); g.ellipse(0, -60, 34, 11, 0, 0, 6.28); g.fill();
	wash(g, 0, -60, 27, 8, '#6A9AAA', d, { layers: 7, alpha: 0.4, edge: 0.3 });
	wash(g, -9, -62, 9, 2.5, '#EAF4F4', d, { layers: 3, alpha: 0.45, edge: 0 });
	return { top: -72 };
}

function paintArche(g, rot) {
	const d = rng(49);
	shade(g, d, 70, 10);
	// L'arche est plate : on la peint de face sur un plan vertical, que la rotation incline à l'écran.
	const V = view(rot), [cx, uy] = V.vec([1, 0, 0]);
	// Vue exactement de profil, une arche plate disparaîtrait : on la garde un peu ouverte.
	const ux = Math.sign(cx || 1) * Math.max(0.3, Math.abs(cx));
	g.save();
	g.transform(ux, uy, 0, RISE, 0, 0);
	const left = curve(-56, 0, -Math.PI / 2, 120, 0.15, 10), arc = [], right = curve(56, 0, -Math.PI / 2, 120, -0.15, 10);
	for (let k = 0; k <= 16; k++) { const a = Math.PI + (k / 16) * Math.PI; arc.push([Math.cos(a) * 54, -118 + Math.sin(a) * 34]); }
	for (const pts of [left, right, arc]) ribbon(g, pts, 4, 4, '#6E5A3A', d, 0.9);
	for (const pts of [left, right, arc]) for (let i = 0; i < pts.length; i++) {
		const [x, y] = pts[i];
		leaf(g, x, y, 10, 4, d() * 6.28, d.pick(['#3E7A3C', '#4E8A3E', '#5F933E']), d, 0.85);
		if (i % 2 === 0) { wash(g, x + d.gauss() * 4, y + d.gauss() * 4, 5, 5, d.pick(['#E87A9A', '#F2A0B8', '#D85A80']), d, { layers: 6, alpha: 0.4, edge: 0.3 }); }
	}
	g.restore();
	return { top: -156 };
}

/** Légumes debout dans le potager, peints à leur place une fois le carré tourné (du fond vers l'avant). */
const VEG = {
	salade(g, x, y, d) {
		for (let i = 0; i < 7; i++) leaf(g, x, y - 2, 8, 5, -Math.PI / 2 + (i - 3) * 0.45, d.pick(['#8ACB5A', '#A8D86A', '#7AB84A']), d, 0.9);
		wash(g, x, y - 4, 4, 3, '#C8E890', d, { layers: 3, alpha: 0.5, edge: 0 });
	},
	chou(g, x, y, d) {
		for (let i = 0; i < 6; i++) leaf(g, x, y - 1, 10, 6, -Math.PI / 2 + (i - 2.5) * 0.55, '#6A9A8A', d, 0.85);
		wash(g, x, y - 6, 6, 5.5, '#A8C8B0', d, { layers: 4, alpha: 0.6, edge: 0.3 });
	},
	carotte(g, x, y, d) {
		g.fillStyle = rgba('#E8762E', 0.95);
		g.beginPath(); g.ellipse(x, y - 1, 2.2, 1.4, 0, 0, 6.28); g.fill();
		for (let i = 0; i < 5; i++) ribbon(g, curve(x, y - 2, -Math.PI / 2 + (i - 2) * 0.35, 9 + d() * 4, d.gauss() * 0.4, 5), 1.2, 0.2, '#5F933E', d, 0.9);
	},
	tomate(g, x, y, d) {
		g.strokeStyle = rgba('#8A6A44', 0.9); g.lineWidth = 1.4;
		g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 30); g.stroke();
		for (let i = 0; i < 6; i++) leaf(g, x + d.gauss() * 2, y - 6 - i * 4, 7, 4, -Math.PI / 2 + (i % 2 ? 1 : -1) * 0.9, '#4E8A3E', d, 0.85);
		for (let i = 0; i < 4; i++) { g.fillStyle = rgba(d.pick(['#D8402A', '#E8622E', '#C8302A']), 0.95); g.beginPath(); g.arc(x + d.range(-4, 4), y - d.range(8, 24), 2.2, 0, 6.28); g.fill(); }
	},
	courge(g, x, y, d) {
		for (let i = 0; i < 4; i++) leaf(g, x + d.gauss() * 4, y - 2, 11, 8, -Math.PI / 2 + (i - 1.5) * 0.8, '#5F933E', d, 0.85);
		wash(g, x + 3, y - 3, 6.5, 4.8, '#E8902E', d, { layers: 5, alpha: 0.6, edge: 0.3 });
		g.strokeStyle = rgba('#B8641E', 0.6); g.lineWidth = 0.8;
		for (const k of [-2.5, 0, 2.5]) { g.beginPath(); g.moveTo(x + 3 + k, y - 7.5); g.quadraticCurveTo(x + 3 + k * 1.4, y - 3, x + 3 + k, y + 1.5); g.stroke(); }
	},
};

function paintPotager(g, rot) {
	const d = rng(88);
	shade(g, d, 80, 22);
	const soil = (g2, d2) => {
		g2.fillStyle = rgba('#5A3E26', 0.96); g2.fillRect(0, -76, 130, 76);
		// Sillons ratissés.
		g2.strokeStyle = rgba('#3E2A18', 0.45); g2.lineWidth = 1.4;
		for (let y = -10; y > -76; y -= 7) { g2.beginPath(); g2.moveTo(3, y); g2.lineTo(127, y + d2.gauss() * 0.6); g2.stroke(); }
		for (let i = 0; i < 14; i++) wash(g2, d2.range(6, 124), d2.range(-72, -4), 3, 1.6, '#7A5A3A', d2, { layers: 2, alpha: 0.35, edge: 0 });
	};
	const V = build(g, d, rot, [box(0, 0, 0, 130, 76, 9, '#9A6A40', { front: planksH(130, 9, 9, '#5A3A20'), back: planksH(130, 9, 9, '#5A3A20'), left: planksH(76, 9, 9, '#5A3A20'), right: planksH(76, 9, 9, '#5A3A20'), top: soil, topColor: '#5A3E26' })]);
	// Trois rangs : tomates au fond, choux et salades, carottes et une courge devant.
	const rows = [['tomate', -24, 4], ['chou', -4, 5], ['salade', 9, 6], ['carotte', 22, 6]];
	const plants = [];
	for (const [kind, y, n] of rows) for (let i = 0; i < n; i++) plants.push({ kind, p: [-52 + (i + 0.5) * (104 / n) + d.gauss() * 1.5, y, 9] });
	plants.push({ kind: 'courge', p: [44, 24, 9] });
	plants.sort((a, b) => V.depth(a.p) - V.depth(b.p));
	for (const { kind, p } of plants) { const [x, y] = V.at(p); VEG[kind](g, x, y, d); }
	return { top: -48 };
}

/** Peintres : (contexte, rotation en radians) → { top, glow?, glowX?, water? }. */
export const ITEM_PAINTERS = {
	banc: paintBanc, massif: paintMassif, bois: paintBois, pierres: paintPierres, mangeoire: paintMangeoire, nichoir: paintNichoir,
	lanterne: paintLanterne, compost: paintCompost, hotel: paintHotel, mare: paintMare, cabane: paintCabane, potager: paintPotager, abri: paintAbri,
	ruche: paintRuche, bain: paintBain, arche: paintArche,
};

/** Combien d'individus de plus d'une espèce les objets posés dans ce lieu attirent. */
export function attracted(place, spId) {
	let n = 0;
	for (const it of place?.items ?? []) if ([].concat(ITEMS[it.kind]?.attracts ?? []).includes(spId)) n++;
	return n;
}

const UNIT = {
	pollinisateur: ['pollinisateur', 'pollinisateurs'], semeur: ['semeur', 'semeurs'],
	sol: ['habitant du sol', 'habitants du sol'], regulateur: ['prédateur utile', 'prédateurs utiles'],
};

/** Ce qu'un objet apporte à l'écosystème, en quelques mots (ou '' pour un objet de décor). */
export function itemHelp(kind) {
	const it = ITEMS[kind];
	return it.team ? `+${it.power} ${UNIT[it.team][it.power > 1 ? 1 : 0]}` : '';
}
