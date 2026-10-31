// Aménager son jardin : une cabane, un banc, des abris pour les animaux… achetés avec le nectar et posés
// où l'on veut à l'intérieur de la clôture. Chaque objet est peint à l'aquarelle, comme le reste du jardin,
// avec sa base en (0, 0). Les objets d'abri renforcent une équipe de l'écosystème, et attirent un animal visible.
// Ceux qui ont un devant et un dos (banc, cabane…) se tournent par pas de 45° : ils sont construits en volumes
// simples, projetés dans la même vue légèrement plongeante que le jardin.

import { rng, wash, ribbon, curve, leaf, rgba } from './watercolor.js';

// km : kilomètres au total pour pouvoir le construire ; team : équipe de l'écosystème renforcée (power membres) ;
// attracts : espèce dont il ajoute un individu visible ; turn : se tourne par pas de 45° ;
// cat : onglet d'« Aménager » (habitat : abri pour la faune, qui s'améliore ; recolte : utile ; deco : pour le plaisir).
export const ITEMS = {
	collecteur: { cat: 'recolte', name: 'Un collecteur de nectar', cost: 60, km: 0, text: 'Une jarre où tes butineurs déposent leur récolte : elle garde le nectar pour toi. Touche-la pour tout récupérer, et améliore-la pour qu’elle en garde plus.', box: { w: 110, h: 130, ax: 55, ay: 112 } },
	banc: { cat: 'deco', name: 'Un banc', cost: 40, km: 0, turn: true, text: 'Pour s’asseoir et regarder le jardin vivre.', box: { w: 130, h: 104, ax: 65, ay: 78 } },
	massif: { cat: 'habitat', name: 'Un massif mellifère', cost: 25, km: 0, team: 'pollinisateur', power: 1, attracts: 'bourdon', text: 'Lavande, bourrache et thym : un buffet pour les butineurs.', box: { w: 110, h: 70, ax: 55, ay: 56 } },
	bois: { cat: 'habitat', name: 'Un tas de bois', cost: 30, km: 0, team: 'sol', power: 1, attracts: 'herisson', text: 'Carabes, cloportes et champignons y décomposent le bois.', box: { w: 110, h: 70, ax: 55, ay: 56 } },
	pierres: { cat: 'habitat', name: 'Un tas de pierres', cost: 30, km: 0, team: 'regulateur', power: 1, attracts: 'lezard', text: 'Les lézards viennent s’y chauffer au soleil.', box: { w: 100, h: 60, ax: 50, ay: 46 } },
	mangeoire: { cat: 'habitat', name: 'Une mangeoire', cost: 45, km: 1, turn: true, team: 'semeur', power: 1, attracts: 'merle', text: 'Les oiseaux qu’elle nourrit sèment ensuite baies et noisettes.', box: { w: 80, h: 120, ax: 40, ay: 104 } },
	nichoir: { cat: 'habitat', name: 'Un nichoir', cost: 60, km: 2, turn: true, team: 'regulateur', power: 1, attracts: 'mesange', text: 'Une mésange y élève ses petits… et mange les chenilles.', box: { w: 70, h: 136, ax: 35, ay: 124 } },
	lanterne: { cat: 'deco', name: 'Une lanterne', cost: 50, km: 2, text: 'Une lumière douce pour les soirées, tournée vers le sol.', box: { w: 50, h: 110, ax: 25, ay: 104 } },
	compost: { cat: 'habitat', name: 'Un bac à compost', cost: 60, km: 3, turn: true, team: 'sol', power: 1, attracts: 'lombric', text: 'Épluchures et feuilles mortes deviennent une terre noire pleine de vers.', box: { w: 100, h: 90, ax: 50, ay: 70 } },
	hotel: { cat: 'habitat', name: 'Un hôtel à insectes', cost: 80, km: 3, turn: true, team: 'pollinisateur', power: 1, attracts: 'abeille', text: 'Abeilles solitaires et coccinelles y passent l’hiver.', box: { w: 110, h: 140, ax: 55, ay: 124 } },
	mare: { cat: 'habitat', name: 'Une petite mare', cost: 90, km: 4, team: 'regulateur', power: 2, text: 'Libellules et grenouilles chassent les moustiques qui y dansent.', box: { w: 160, h: 80, ax: 80, ay: 40 } },
	cabane: { cat: 'recolte', name: 'Une petite cabane', cost: 200, km: 5, turn: true, text: 'Ton abri au fond du jardin, et la maison de ton jardinier. Agrandis-la, et choisis sa couleur.', box: { w: 200, h: 215, ax: 100, ay: 175 },
		levels: { max: 3, cost: [0, 0, 600, 2000], km: [0, 0, 15, 50], name: ['', 'petite cabane', 'cabane à auvent', 'chalet'] },
		boxes: [null, null, { w: 220, h: 235, ax: 110, ay: 180 }, { w: 340, h: 255, ax: 125, ay: 195 }] },
	abri: { cat: 'habitat', name: 'Un abri à hérisson', cost: 70, km: 6, turn: true, team: 'regulateur', power: 1, attracts: 'herisson', text: 'Une petite maison sous les feuilles, où il passe l’hiver.', box: { w: 90, h: 70, ax: 45, ay: 50 } },
	ruche: { cat: 'habitat', name: 'Une ruche en paille', cost: 120, km: 6, team: 'pollinisateur', power: 2, attracts: 'abeille', text: 'Toute une colonie d’abeilles pour polliniser tes fleurs.', box: { w: 80, h: 90, ax: 40, ay: 78 } },
	bain: { cat: 'habitat', name: 'Un bain d’oiseaux', cost: 100, km: 8, team: 'semeur', power: 1, attracts: 'merle', text: 'De l’eau fraîche : les oiseaux reviennent, et sèment autour.', box: { w: 80, h: 90, ax: 40, ay: 80 } },
	potager: { cat: 'recolte', name: 'Un carré de potager', cost: 90, km: 5, needs: 'cabane', team: 'semeur', power: 2, attracts: ['lapin', 'lievre'], text: 'Salades, choux et tomates, cultivés par ton fermier ou ta fermière, poussent quand tu marches. Pose les carrés côte à côte pour agrandir le potager.', box: { w: 150, h: 100, ax: 75, ay: 64 } },
	sandarium: { cat: 'habitat', name: 'Un sandarium', cost: 70, km: 4, team: 'pollinisateur', power: 1, attracts: 'abeille', text: 'Un carré de sable au soleil : les abeilles sauvages qui nichent au sol y creusent leurs terriers.', box: { w: 130, h: 70, ax: 65, ay: 42 } },
	haie: { cat: 'habitat', name: 'Une haie de bois mort', cost: 110, km: 10, team: 'regulateur', power: 2, attracts: 'herisson', text: 'Des branches empilées entre des piquets : roitelets et hérissons s’y cachent, et elle se tasse en terreau.', box: { w: 190, h: 100, ax: 95, ay: 74 } },
	muret: { cat: 'habitat', name: 'Un muret de pierres sèches', cost: 140, km: 15, team: 'regulateur', power: 2, attracts: 'lezard', text: 'Des pierres posées sans mortier, qui gardent la chaleur : lézards, orvets et papillons s’y abritent.', box: { w: 190, h: 90, ax: 95, ay: 66 } },
	pas: { cat: 'deco', name: 'Des pas japonais', cost: 20, km: 0, text: 'Quelques pierres plates dans l’herbe, pour flâner sans tasser le sol.', box: { w: 150, h: 60, ax: 75, ay: 32 } },
	epouvantail: { cat: 'deco', name: 'Un épouvantail', cost: 80, km: 6, text: 'Chapeau de paille et chemise à carreaux : il veille sur le potager, et les oiseaux s’y posent quand même.', box: { w: 100, h: 160, ax: 50, ay: 148 } },
	arche: { cat: 'deco', name: 'Une arche de roses', cost: 120, km: 20, turn: true, team: 'pollinisateur', power: 1, attracts: 'paon-du-jour', text: 'Un passage fleuri pour les papillons.', box: { w: 170, h: 190, ax: 85, ay: 172 } },
};
export const ITEM_ORDER = ['collecteur', 'banc', 'pas', 'massif', 'bois', 'pierres', 'mangeoire', 'nichoir', 'lanterne', 'compost', 'hotel', 'sandarium', 'mare', 'cabane', 'potager', 'abri', 'ruche', 'epouvantail', 'bain', 'haie', 'muret', 'arche'];

/** Les onglets d'« Aménager ». */
export const CATS = [
	{ id: 'habitat', name: 'Habitats', intro: 'Des abris pour la faune : chacun renforce une équipe de l’écosystème. Plutôt que d’en poser partout, améliore-les : un abri soigné accueille plus de monde.' },
	{ id: 'recolte', name: 'Récolte', intro: 'De quoi garder ton nectar, loger un fermier ou une fermière, et cultiver un potager.' },
	{ id: 'deco', name: 'Décoration', intro: 'Pour le plaisir des yeux : de quoi flâner, s’asseoir et veiller tard.' },
];

/**
 * Un habitat s'améliore jusqu'au niveau 5 : chaque niveau compte comme un exemplaire de plus (power × niveau),
 * pour bien plus cher, et n'est possible qu'après assez de kilomètres faits au total.
 */
export const MAX_LEVEL = 5;
export const LEVEL_NAME = ['', 'simple', 'garni', 'fleuri', 'foisonnant', 'remarquable'];
export const LEVEL_KM = [0, 0, 10, 30, 70, 150];
const LEVEL_MULT = [0, 0, 4, 12, 35, 100];
export const canLevel = kind => ITEMS[kind]?.cat === 'habitat';
/** La boîte d'un objet posé : la cabane grandit avec son niveau. */
export const itemBox = (kind, level = 1) => ITEMS[kind].boxes?.[level] ?? ITEMS[kind].box;
export const levelCost = (kind, level) => Math.round((ITEMS[kind].cost * LEVEL_MULT[level]) / 5) * 5;
/** Combien de membres un objet posé fait venir dans son équipe. */
export const itemPower = it => (ITEMS[it.kind]?.power ?? 0) * (canLevel(it.kind) ? it.level ?? 1 : 1);

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

/** Les couleurs de cabane, au choix (gratuit, depuis la cabane posée). */
export const CABIN_STYLES = [
	{ name: 'bois naturel', wall: '#9A6A40', alt: '#A87A4C', trim: '#6E4A2C', roof: '#7A4A34', shut: '#6E4A2C' },
	{ name: 'rouge', wall: '#B4473C', alt: '#BE5246', trim: '#F2EEE0', roof: '#8A8A80', shut: '#5E8A5A' },
	{ name: 'vert sauge', wall: '#5E8A6A', alt: '#679473', trim: '#F2EEE0', roof: '#4A5A6A', shut: '#F2EEE0' },
	{ name: 'bleu gris', wall: '#6A84A0', alt: '#748EAA', trim: '#F2EEE0', roof: '#5A4A40', shut: '#F2EEE0' },
	{ name: 'miel', wall: '#C89A5A', alt: '#D2A666', trim: '#7A5232', roof: '#5E3A2A', shut: '#7A5232' },
];

/** Une planche de façade, pour les cabanes. */
function plankRow(g, x, y, w, h, col, d) {
	g.fillStyle = rgba(col, 0.95);
	g.fillRect(x, y, w, h);
	g.strokeStyle = rgba('#3A2414', 0.28);
	g.lineWidth = 0.8;
	g.strokeRect(x, y, w, h);
	wash(g, x + w / 2, y + h / 2, w * 0.45, h * 0.4, '#FFF4DC', d, { layers: 1, alpha: 0.05, edge: 0 });
}

/** Une fenêtre peinte sur une façade : carreaux éclairés, croisillon, volets facultatifs. */
function windowAt(g2, x, y, w, h, st, shutters) {
	g2.fillStyle = rgba('#FBE7A8', 0.95); g2.fillRect(x, y, w, h);
	g2.strokeStyle = rgba(st.trim, 0.95); g2.lineWidth = 2.2;
	g2.strokeRect(x, y, w, h); g2.beginPath(); g2.moveTo(x + w / 2, y); g2.lineTo(x + w / 2, y + h); g2.moveTo(x, y + h / 2); g2.lineTo(x + w, y + h / 2); g2.stroke();
	if (shutters) for (const sx of [x - w * 0.48, x + w + 1]) {
		g2.fillStyle = rgba(st.shut, 0.95); g2.fillRect(sx, y - 1, w * 0.46, h + 2);
		g2.strokeStyle = rgba('#3A2414', 0.25); g2.lineWidth = 0.8;
		for (let k = 1; k < 4; k++) { g2.beginPath(); g2.moveTo(sx, y + (h * k) / 4); g2.lineTo(sx + w * 0.46, y + (h * k) / 4); g2.stroke(); }
	}
}

/**
 * La cabane, en trois tailles (on l'agrandit en l'améliorant) et cinq couleurs :
 * 1 petite cabane de planches ; 2 cabane à auvent, sa terrasse et sa table, volets aux fenêtres ;
 * 3 chalet en madriers, double porte, grande terrasse couverte sur le côté et bacs fleuris.
 */
function paintCabane(g, rot, level = 1, style = 0) {
	const d = rng(47), st = CABIN_STYLES[style % CABIN_STYLES.length];
	const L = Math.max(1, Math.min(3, level));
	const W = [0, 121, 128, 176][L], D = [0, 88, 92, 108][L], H = [0, 78, 80, 86][L], rise = [0, 52, 54, 58][L];
	const porch = L === 2 ? 36 : 0, pl = L === 3 ? 9 : 11;
	shade(g, d, [0, 86, 96, 150][L], [0, 22, 28, 34][L]);
	// Planches debout, ou madriers couchés pour le chalet.
	const boards = (w, h) => (g2, d2) => {
		if (L === 3) for (let i = 0; i * pl < h; i++) plankRow(g2, 0, -(i + 1) * pl, w, pl, i % 2 ? st.alt : st.wall, d2);
		else for (let i = 0; i * pl < w; i++) plankRow(g2, i * pl, -h, pl, h, i % 2 ? st.alt : st.wall, d2);
	};
	const doorW = L === 3 ? 40 : 26, doorX = L === 1 ? 46 : W * 0.42 - doorW / 2;
	const winX = L === 1 ? 84 : W * 0.72;
	const front = (g2, d2) => {
		boards(W, H)(g2, d2);
		g2.fillStyle = rgba(L === 1 ? '#6E4A2C' : st.shut, 0.97); g2.fillRect(doorX, -56, doorW, 56);
		g2.strokeStyle = rgba(L === 1 ? '#4A2E1A' : st.trim, 0.9); g2.lineWidth = 2; g2.strokeRect(doorX, -56, doorW, 56);
		if (L === 3) {
			g2.beginPath(); g2.moveTo(doorX + doorW / 2, -56); g2.lineTo(doorX + doorW / 2, 0); g2.stroke();
			windowAt(g2, doorX + 4, -50, doorW / 2 - 8, 22, st, false);
			windowAt(g2, doorX + doorW / 2 + 4, -50, doorW / 2 - 8, 22, st, false);
		} else if (L === 2) windowAt(g2, doorX + 6, -48, doorW - 12, 16, st, false);
		g2.fillStyle = rgba('#3A2414', 0.9); g2.beginPath(); g2.arc(doorX + doorW - 5, -27, 2, 0, 6.28); g2.fill();
		windowAt(g2, winX, -58, 22, 18, L === 1 ? { trim: '#4A2E1A' } : st, L >= 2);
		if (L === 3) windowAt(g2, W * 0.12, -58, 22, 18, st, true);
		for (let i = 0; i < 8; i++) leaf(g2, 4 + d2.range(-2, 5), -6 - i * 8, 9, 4, -Math.PI / 2 + d2.gauss() * 0.8, '#4E8A3E', d2, 0.8);
	};
	const side = (g2, d2) => {
		boards(D, H)(g2, d2);
		windowAt(g2, D * 0.4, -56, 18, 16, L === 1 ? { trim: '#4A2E1A' } : st, L >= 2);
	};
	const back = (g2, d2) => boards(W, H)(g2, d2);
	const roofCol = L === 1 ? '#7A4A34' : st.roof;
	const shingles = (g2, d2) => {
		g2.strokeStyle = rgba('#2A1E1A', 0.35); g2.lineWidth = 1;
		for (let y = -8; y > -90; y -= 9) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(220, y); g2.stroke(); }
		for (let i = 0; i < 4; i++) wash(g2, d2.range(10, 120), d2.range(-60, -10), d2.range(6, 12), d2.range(3, 5), '#6E9A4A', d2, { layers: 5, alpha: 0.3, edge: 0 });
	};
	const deckTop = (w, dp) => (g2, d2) => { for (let x = 0; x < w; x += 8) plankRow(g2, x, -dp, 8, dp, x % 16 ? '#C8A070' : '#BC9464', d2); };
	const solids = [
		box(0, 0, 0, W, D, H, st.wall, { front, back, left: side, right: side }),
		box(28, -18, H + rise * 0.6, 12, 12, 34, '#8A7A6A'),
	];
	if (L === 2) {
		// Le toit s'avance au-dessus d'une terrasse, posé sur deux poteaux ; une table devant la fenêtre.
		solids.push(box(0, D / 2 + porch / 2, 0, W, porch, 4, '#BC9464', { top: deckTop(W, porch), topColor: '#C8A070' }));
		for (const x of [-W / 2 + 6, W / 2 - 6]) solids.push(box(x, D / 2 + porch - 5, 4, 6, 6, H - 4, st.shut));
		solids.push(box(W * 0.22, D / 2 + porch * 0.45, 4, 34, 14, 18, '#E8E2D2'), box(W * 0.22, D / 2 + porch * 0.45 + 12, 4, 30, 6, 9, '#E8E2D2'));
		solids.push(roof(0, porch / 2, H, W, D + porch, rise, 8, roofCol, shingles, st.alt));
	} else solids.push(roof(0, 0, H, W, D, rise, 8, roofCol, shingles, L === 1 ? '#A87A4C' : st.alt));
	if (L === 3) {
		// Grande terrasse couverte sur la droite : plancher, poteaux, toit plat, table ; bacs fleuris devant.
		const tx = W / 2 + 40, tw = 80, td = D + 24;
		solids.push(box(tx, 8, 0, tw, td, 5, '#BC9464', { top: deckTop(tw, td), topColor: '#C8A070' }));
		for (const y of [8 + td / 2 - 5, 8 - td / 2 + 5]) solids.push(box(tx + tw / 2 - 5, y, 5, 6, 6, H - 5, '#7A5232'));
		solids.push(box(tx, 8, H, tw + 10, td + 8, 5, st.roof));
		solids.push(box(tx - 4, 12, 5, 30, 22, 20, '#8A6040'), box(tx - 4, 34, 5, 24, 6, 12, '#8A6040'));
		const flowers = (g2, d2) => { for (let i = 0; i < 6; i++) wash(g2, d2.range(2, 20), d2.range(-9, -1), 3, 2.5, d2.pick(['#E87A9A', '#F2D24A', '#FFFFFF', '#5F933E']), d2, { layers: 3, alpha: 0.7, edge: 0.2 }); };
		for (const x of [-W / 2 + 16, -W / 2 + 46]) solids.push(box(x, D / 2 + 9, 0, 22, 10, 12, '#7A5232', { top: flowers }));
	}
	const V = build(g, d, rot, solids);
	// Lueur de la fenêtre, là où elle se trouve une fois la cabane tournée (devant ou côté, selon ce qu'on voit).
	const fy = V.turn([0, 1, 0])[1], ry = V.turn([1, 0, 0])[1];
	const win = fy > 0.3 ? [winX + 11 - W / 2, D / 2, 49] : ry > 0.3 ? [W / 2 + 0.5, 0, 48] : ry < -0.3 ? [-W / 2 - 0.5, 0, 48] : null;
	const top = V.at([0, 0, H + rise + 20])[1] - 10;
	// Le seuil de la porte, avant rotation : le jardinier y entre et en sort.
	const door = [doorX + doorW / 2 - W / 2, D / 2 + porch + 12];
	if (!win) return { top, door };
	const [gx, gy] = V.at(win);
	return { top, glow: gy, glowX: gx, door };
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

/** Taille d'une parcelle de potager au sol (largeur, profondeur à l'écran) : les parcelles s'alignent sur cette grille. */
export const PLOT = { w: 130, h: 44 };

/**
 * La terre d'une parcelle, à même le sol : un cœur opaque qui déborde un peu de la case (deux parcelles voisines
 * se soudent sans couture), un bord fondu, des sillons qui se prolongent d'une parcelle à l'autre.
 */
export function paintSoil(g, seed) {
	const d = rng(seed);
	const W = PLOT.w, H = PLOT.h;
	g.save();
	g.filter = 'blur(3px)';
	g.fillStyle = rgba('#6A4A2E', 0.95);
	g.beginPath();
	g.roundRect(-W / 2 - 6, -H / 2 - 5, W + 12, H + 10, 10);
	g.fill();
	g.restore();
	for (let i = 0; i < 10; i++) wash(g, d.range(-W / 2 + 6, W / 2 - 6), d.range(-H / 2 + 3, H / 2 - 3), d.range(8, 18), d.range(3, 6), d.pick(['#7E5A38', '#5A3E26', '#8A6644']), d, { layers: 3, alpha: 0.25, edge: 0 });
	// Sillons, tous les 11 : ils tombent au même endroit d'une parcelle à l'autre.
	g.strokeStyle = rgba('#3E2A18', 0.42);
	g.lineWidth = 1.5;
	for (let y = -H / 2 + 5.5; y < H / 2; y += 11) {
		g.beginPath();
		g.moveTo(-W / 2 - 4, y);
		for (let x = -W / 2; x <= W / 2 + 4; x += 13) g.lineTo(x, y + d.gauss() * 0.5);
		g.stroke();
		g.strokeStyle = rgba('#9A7650', 0.3);
		g.beginPath(); g.moveTo(-W / 2 - 4, y - 2); g.lineTo(W / 2 + 4, y - 2); g.stroke();
		g.strokeStyle = rgba('#3E2A18', 0.42);
	}
	for (let i = 0; i < 18; i++) { g.fillStyle = rgba(d.pick(['#4A3220', '#9A7A58']), 0.6); g.beginPath(); g.arc(d.range(-W / 2, W / 2), d.range(-H / 2, H / 2), d.range(0.6, 1.4), 0, 6.28); g.fill(); }
}

/** Ce qui pousse dans une parcelle : deux cultures par parcelle, selon la parcelle. */
const CROPS = [['salade', 'carotte'], ['chou', 'salade'], ['tomate', 'courge'], ['carotte', 'chou'], ['tomate', 'salade']];

/**
 * Un carré de potager à même la terre. `stage` (0 → 1) : les légumes poussent avec les kilomètres ;
 * `soil` : peindre aussi la terre (aperçu dans la liste et pendant qu'on le place ; au jardin, la terre est peinte au sol).
 */
function paintPotager(g, rot, stage = 1, soil = true, seed = 88) {
	const d = rng(seed);
	if (soil) paintSoil(g, seed);
	const crops = CROPS[seed % CROPS.length];
	const k = 0.25 + 0.75 * stage;
	// Quatre rangs dans les sillons, du fond vers l'avant.
	for (let r = 0; r < 4; r++) {
		const y = -PLOT.h / 2 + 5.5 + r * 11, kind = crops[r % 2];
		const n = kind === 'tomate' || kind === 'courge' ? 4 : 6;
		for (let i = 0; i < n; i++) {
			const x = -PLOT.w / 2 + (i + 0.5) * (PLOT.w / n) + d.gauss() * 1.5;
			if (stage < 0.12) {
				// Semis : deux petites feuilles qui pointent.
				for (const a of [-0.6, 0.6]) leaf(g, x, y, 3.5, 1.5, -Math.PI / 2 + a, '#7FB04A', d, 0.85);
				continue;
			}
			g.save();
			g.translate(x, y);
			g.scale(k, k);
			VEG[kind](g, 0, 0, d);
			g.restore();
		}
	}
	return { top: -34 * k };
}

/** Un pot de nectar en verre, coiffé d'un tissu à carreaux noué, rempli jusqu'à `fill`. Origine au pied du pot. */
function nectarJar(g, x, y, w, h, fill, d, cloth = '#C8483A') {
	// Verre : un corps arrondi, un col, des reflets.
	const body = () => { g.beginPath(); g.moveTo(x - w * 0.42, y - h * 0.82); g.quadraticCurveTo(x - w * 0.56, y - h * 0.5, x - w * 0.46, y - h * 0.08); g.quadraticCurveTo(x, y + h * 0.04, x + w * 0.46, y - h * 0.08); g.quadraticCurveTo(x + w * 0.56, y - h * 0.5, x + w * 0.42, y - h * 0.82); g.closePath(); };
	g.save();
	body();
	g.fillStyle = rgba('#EAF2EE', 0.55);
	g.fill();
	g.clip();
	const top = y - h * 0.08 - (h * 0.72) * Math.max(0.05, Math.min(1, fill));
	const grd = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
	grd.addColorStop(0, '#E8A02A'); grd.addColorStop(0.45, '#F6C843'); grd.addColorStop(1, '#D8861E');
	g.fillStyle = grd;
	g.fillRect(x - w, top, w * 2, y - top + 2);
	g.fillStyle = rgba('#FFF2B0', 0.75);
	g.beginPath(); g.ellipse(x, top, w * 0.48, 1.6, 0, 0, Math.PI * 2); g.fill();
	g.restore();
	body();
	g.strokeStyle = rgba('#7A8A84', 0.75); g.lineWidth = 1; g.stroke();
	g.fillStyle = rgba('#FFFFFF', 0.6);
	g.beginPath(); g.ellipse(x - w * 0.26, y - h * 0.5, w * 0.07, h * 0.24, -0.1, 0, Math.PI * 2); g.fill();
	// Couvercle de tissu à carreaux, qui retombe en corolle, noué d'une ficelle.
	const cy = y - h * 0.86;
	g.fillStyle = rgba(cloth, 0.95);
	g.beginPath();
	g.moveTo(x - w * 0.6, cy + h * 0.12);
	for (let k = 0; k <= 6; k++) { const t = k / 6; g.lineTo(x - w * 0.6 + t * w * 1.2, cy + h * 0.12 + (k % 2 ? h * 0.05 : 0)); }
	g.quadraticCurveTo(x + w * 0.5, cy - h * 0.12, x, cy - h * 0.13);
	g.quadraticCurveTo(x - w * 0.5, cy - h * 0.12, x - w * 0.6, cy + h * 0.12);
	g.fill();
	g.strokeStyle = rgba('#FFFFFF', 0.7); g.lineWidth = 0.9;
	for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * w * 0.2, cy - h * 0.1); g.lineTo(x + k * w * 0.24, cy + h * 0.13); g.stroke(); }
	g.beginPath(); g.moveTo(x - w * 0.52, cy + h * 0.02); g.lineTo(x + w * 0.52, cy + h * 0.02); g.stroke();
	g.strokeStyle = rgba('#8A6A3A', 0.95); g.lineWidth = 1.3;
	g.beginPath(); g.moveTo(x - w * 0.44, cy + h * 0.07); g.lineTo(x + w * 0.44, cy + h * 0.07); g.stroke();
	// Petite étiquette.
	g.fillStyle = rgba('#FBF3DC', 0.95);
	g.fillRect(x - w * 0.22, y - h * 0.42, w * 0.44, h * 0.16);
	g.fillStyle = rgba('#E3A33A', 0.95);
	g.beginPath(); g.ellipse(x, y - h * 0.34, w * 0.07, h * 0.05, 0, 0, Math.PI * 2); g.fill();
}

/**
 * Collecteur de nectar : un petit garde-manger en bois sous un toit de bardeaux, où s'alignent des pots de nectar.
 * `fill` (0 → 1) : le niveau doré dans les pots ; `level` (1 → 3) : un, deux puis trois pots, et le toit qui s'orne.
 */
function paintCollecteur(g, rot, fill = 0.5, level = 1) {
	const d = rng(61);
	shade(g, d, 40, 11);
	const wood = '#9A6A40';
	const shingles = (g2, d2) => {
		g2.strokeStyle = rgba('#4A2A1E', 0.4); g2.lineWidth = 1;
		for (let y = -5; y > -26; y -= 5) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(80, y); g2.stroke(); }
		if (level >= 3) for (let i = 0; i < 3; i++) wash(g2, d2.range(10, 60), d2.range(-20, -6), 6, 3, '#6E9A4A', d2, { layers: 4, alpha: 0.35, edge: 0 });
	};
	const back = (g2, d2) => { for (let i = 0; i < 6; i++) plank(g2, i * 11, -62, 11, 62, i % 2 ? '#A87A4C' : '#946238', d2, 0.95); };
	const V = build(g, d, 0, [
		box(0, -12, 0, 66, 4, 62, wood, { front: back }),
		box(-31, 2, 0, 4, 26, 62, '#8A5A34'),
		box(31, 2, 0, 4, 26, 62, '#8A5A34'),
		box(0, 2, 18, 66, 26, 4, '#A87A4C'),
		roof(0, 0, 62, 66, 30, 16, 6, '#7A4A34', shingles, '#A87A4C'),
	]);
	// Les pots, posés sur l'étagère.
	const n = Math.max(1, Math.min(3, level));
	const xs = n === 1 ? [0] : n === 2 ? [-14, 14] : [-20, 0, 20];
	const cloths = ['#C8483A', '#3E7FB0', '#E8A02A'];
	xs.forEach((x, i) => { const [px, py] = V.at([x, 6, 22]); nectarJar(g, px, py, n === 1 ? 32 : n === 2 ? 24 : 18, n === 1 ? 40 : n === 2 ? 34 : 30, fill, d, cloths[i]); });
	// Sous l'étagère : une louche en bois et une abeille posée sur le toit.
	const [lx, ly] = V.at([-14, 8, 2]);
	g.strokeStyle = rgba('#7A5130', 0.95); g.lineWidth = 2; g.lineCap = 'round';
	g.beginPath(); g.moveTo(lx, ly - 2); g.lineTo(lx + 16, ly - 9); g.stroke();
	g.fillStyle = rgba('#8A6040', 0.95); g.beginPath(); g.ellipse(lx - 2, ly - 1, 4, 2.6, 0.2, 0, Math.PI * 2); g.fill();
	const [bx, by] = V.at([18, 0, 80]);
	g.fillStyle = '#F2C230'; g.beginPath(); g.ellipse(bx, by, 3.4, 2.4, 0, 0, Math.PI * 2); g.fill();
	g.fillStyle = '#2A2420'; g.fillRect(bx - 1, by - 2.3, 1.2, 4.6); g.fillRect(bx + 1.4, by - 2.1, 1, 4.2);
	g.fillStyle = 'rgba(253,247,231,0.8)'; g.beginPath(); g.ellipse(bx - 1, by - 3.2, 2.2, 1.3, -0.5, 0, Math.PI * 2); g.fill();
	return { top: V.at([0, 0, 80])[1] - 6 };
}

/** Sandarium : un carré de sable blond au ras du sol, bordé de pierres, percé de petits terriers. */
function paintSandarium(g) {
	const d = rng(62);
	wash(g, 0, 2, 58, 20, '#6E5A3A', d, { layers: 5, alpha: 0.16, edge: 0.2 });
	wash(g, 0, 0, 52, 17, '#E8D2A0', d, { layers: 10, alpha: 0.32, edge: 0.4 });
	wash(g, -10, -3, 34, 9, '#F6E8C4', d, { layers: 5, alpha: 0.3, edge: 0 });
	for (let i = 0; i < 9; i++) {
		const x = d.range(-38, 38), y = d.range(-10, 9);
		wash(g, x, y + 1, 4, 2, '#C8A870', d, { layers: 3, alpha: 0.4, edge: 0 });
		g.fillStyle = rgba('#4A3420', 0.85); g.beginPath(); g.ellipse(x, y, 1.6, 1, 0, 0, 6.28); g.fill();
	}
	for (let a = 0; a < 6.28; a += 0.42) wash(g, Math.cos(a) * 56, Math.sin(a) * 19, d.range(5, 8), d.range(3.5, 5), d.pick(['#B8B2A4', '#A8A498', '#C8C0B0']), d, { layers: 5, alpha: 0.4, edge: 0.4 });
	for (let i = 0; i < 6; i++) ribbon(g, curve(d.range(-50, 50), d.range(-18, -10), -Math.PI / 2 + d.gauss() * 0.3, d.range(8, 16), d.gauss() * 0.3, 4), 1.2, 0.3, '#7FAA48', d, 0.8);
	// Une abeille sauvage qui rentre au terrier.
	g.fillStyle = '#B8743A'; g.beginPath(); g.ellipse(14, -16, 3.2, 2, 0.3, 0, 6.28); g.fill();
	g.fillStyle = 'rgba(253,247,231,0.75)'; g.beginPath(); g.ellipse(13, -19, 2.2, 1.2, -0.4, 0, 6.28); g.fill();
	return { top: -30 };
}

/** Haie de bois mort (haie de Benjes) : des branches entassées entre deux rangs de piquets, un peu de lierre dessus. */
function paintHaie(g) {
	const d = rng(63);
	shade(g, d, 92, 18);
	const stakes = [-80, -48, -16, 16, 48, 80];
	for (const x of stakes) plank(g, x - 2.5, -52 - 6, 5, 54, '#6E4A2C', d);
	for (let i = 0; i < 70; i++) {
		const x = d.range(-84, 84), y = d.range(-44, -2), a = d.gauss() * 0.5 + (d() < 0.5 ? 0 : Math.PI);
		ribbon(g, curve(x, y, a, d.range(16, 34), d.gauss() * 0.4, 4), d.range(1.4, 3), 0.6, d.pick(['#7A5232', '#5A3A20', '#8A6A44', '#9A7A54']), d, 0.85);
	}
	for (let i = 0; i < 10; i++) wash(g, d.range(-80, 80), d.range(-44, -6), d.range(5, 10), d.range(3, 5), d.pick(['#C87A3A', '#A8602A', '#D8A050']), d, { layers: 4, alpha: 0.35, edge: 0.3 });
	for (let i = 0; i < 16; i++) leaf(g, d.range(-70, 70), d.range(-48, -20), 7, 4, d() * 6.28, d.pick(['#3E6A3A', '#4E7A3E']), d, 0.85);
	for (const x of stakes) plank(g, x - 2.5 + 3, -48, 5, 50, '#5E3E24', d);
	return { top: -62 };
}

/** Muret de pierres sèches : des pierres plates empilées sans mortier, mousse et une fleur dans les joints. */
function paintMuret(g) {
	const d = rng(64);
	shade(g, d, 92, 16);
	for (let row = 0; row < 4; row++) {
		const y = -6 - row * 11, half = 86 - row * 6;
		for (let x = -half + (row % 2) * 8; x < half; x += d.range(15, 22)) {
			const w = d.range(8, 11), h = d.range(5, 6.5);
			wash(g, x + w, y, w, h, d.pick(['#B8B2A4', '#A8A498', '#C8C0B0', '#9A968A']), d, { layers: 6, alpha: 0.42, edge: 0.5 });
			wash(g, x + w * 0.8, y - h * 0.4, w * 0.5, h * 0.3, '#EEEAE0', d, { layers: 3, alpha: 0.22, edge: 0 });
		}
	}
	for (let i = 0; i < 7; i++) wash(g, d.range(-70, 70), d.range(-44, -4), d.range(4, 8), 2.5, '#6E9A4A', d, { layers: 4, alpha: 0.35, edge: 0 });
	for (const [x, y] of [[-40, -40], [30, -46], [62, -18]]) for (let k = 0; k < 4; k++) wash(g, x + Math.cos(k * 1.57) * 2.5, y + Math.sin(k * 1.57) * 2.5, 2.2, 2.2, '#F2E070', d, { layers: 3, alpha: 0.6, edge: 0.2 });
	// Un lézard au soleil, sur le dessus.
	ribbon(g, curve(-8, -50, 0.1, 26, 0.5, 8), 2.6, 0.3, '#6E8A3A', d, 0.95);
	return { top: -56 };
}

/** Pas japonais : quelques dalles plates qui serpentent dans l'herbe. */
function paintPas(g) {
	const d = rng(65);
	for (const [x, y, s] of [[-56, 8, 13], [-26, -2, 14], [6, 6, 13], [36, -4, 14], [62, 4, 11]]) {
		wash(g, x, y + 2, s + 2, s * 0.45, '#4A5A32', d, { layers: 4, alpha: 0.14, edge: 0 });
		wash(g, x, y, s, s * 0.42, d.pick(['#C8C0B0', '#BCB8AC', '#D2CABA']), d, { layers: 8, alpha: 0.4, edge: 0.5 });
		wash(g, x - s * 0.3, y - s * 0.12, s * 0.45, s * 0.16, '#F2EEE4', d, { layers: 3, alpha: 0.3, edge: 0 });
		for (let k = 0; k < 3; k++) ribbon(g, curve(x + d.range(-s, s), y + s * 0.4, -Math.PI / 2 + d.gauss() * 0.3, d.range(5, 9), 0, 3), 1, 0.3, '#7FAA48', d, 0.8);
	}
	return { top: -14 };
}

/** Épouvantail : une croix de bois, une chemise à carreaux, un chapeau de paille ; un merle sur le bras. */
function paintEpouvantail(g) {
	const d = rng(66);
	shade(g, d, 26, 7);
	plank(g, -2.5, -128, 5, 128, '#7A5232', d);
	plank(g, -40, -96, 80, 5, '#7A5232', d);
	// La chemise, et ses carreaux.
	g.fillStyle = rgba('#C8483A', 0.92);
	g.beginPath(); g.moveTo(-30, -98); g.lineTo(30, -98); g.lineTo(18, -86); g.lineTo(16, -52); g.lineTo(-16, -52); g.lineTo(-18, -86); g.closePath(); g.fill();
	g.strokeStyle = rgba('#7A2A22', 0.5); g.lineWidth = 1;
	for (let x = -26; x < 30; x += 7) { g.beginPath(); g.moveTo(x, -98); g.lineTo(x * 0.6, -52); g.stroke(); }
	for (let y = -92; y < -52; y += 7) { g.beginPath(); g.moveTo(-24, y); g.lineTo(24, y); g.stroke(); }
	// La paille qui dépasse des manches et du bas.
	for (const [x, y, a] of [[-38, -94, Math.PI], [38, -94, 0], [-8, -52, Math.PI / 2], [8, -52, Math.PI / 2]]) for (let k = 0; k < 4; k++) ribbon(g, curve(x, y, a + d.gauss() * 0.4, d.range(6, 11), 0, 3), 1, 0.3, '#E8C860', d, 0.9);
	// La tête en toile et le chapeau.
	wash(g, 0, -110, 10, 11, '#E8D8B0', d, { layers: 6, alpha: 0.5, edge: 0.4 });
	g.fillStyle = rgba('#3A2A1A', 0.8); g.beginPath(); g.arc(-4, -112, 1.4, 0, 6.28); g.arc(4, -112, 1.4, 0, 6.28); g.fill();
	wash(g, 0, -120, 22, 5, '#D8B060', d, { layers: 6, alpha: 0.5, edge: 0.3 });
	wash(g, 0, -126, 11, 7, '#E8C870', d, { layers: 6, alpha: 0.5, edge: 0.3 });
	plank(g, -11, -124, 22, 3, '#C8483A', d);
	// Un merle posé sur le bras.
	g.fillStyle = '#2A2420'; g.beginPath(); g.ellipse(28, -102, 6, 4, -0.2, 0, 6.28); g.fill();
	g.beginPath(); g.arc(33, -106, 3, 0, 6.28); g.fill();
	g.fillStyle = '#F2A02A'; g.beginPath(); g.moveTo(35.5, -106.5); g.lineTo(39, -105.5); g.lineTo(35.5, -104.5); g.fill();
	return { top: -132 };
}

/**
 * Ce qui pousse autour d'un habitat amélioré : herbes, fleurs sauvages et mousse, de plus en plus fournies
 * à chaque niveau. `front` : les touffes de devant (peintes après l'objet), sinon celles de derrière.
 */
const FLAT_ADORN = new Set(['mare', 'sandarium']);

export function paintAdorn(g, kind, level, front) {
	if (level < 2) return;
	const d = rng(70 + level * 7 + (front ? 1 : 0)), b = ITEMS[kind].box;
	const rx = Math.min(b.ax, b.w - b.ax) * 0.88, ry = Math.min(rx * 0.32, (b.h - b.ay) * 0.8 + 6);
	const n = (level - 1) * 4 + (front ? 2 : 0);
	const flowers = level >= 5 ? ['#F2D24A', '#E87A9A', '#FFFFFF', '#9A7AD0', '#F08A3C'] : level >= 3 ? ['#F2D24A', '#E87A9A', '#FFFFFF', '#9A7AD0'] : ['#FFFFFF', '#F2D24A'];
	for (let i = 0; i < n; i++) {
		let a = front ? d.range(0.15, Math.PI - 0.15) : d.range(Math.PI + 0.1, 2 * Math.PI - 0.1);
		// Autour d'une mare ou d'un sandarium, les touffes restent sur les bords, pas dans l'eau ni le sable.
		if (FLAT_ADORN.has(kind)) a = (i % 2 ? 0 : Math.PI) + d.range(-0.45, 0.45) * (front ? -1 : 1);
		const far = FLAT_ADORN.has(kind) ? d.range(0.95, 1) : d.range(0.75, 1);
		const x = Math.cos(a) * rx * far, y = Math.sin(a) * ry * d.range(0.7, 1);
		if (level >= 3 && d() < 0.4) wash(g, x, y, d.range(5, 9), 3, '#6E9A4A', d, { layers: 3, alpha: 0.3, edge: 0 });
		for (let k = 0; k < 3; k++) ribbon(g, curve(x + d.gauss() * 2, y, -Math.PI / 2 + d.gauss() * 0.35, d.range(6, 10 + level * 2), d.gauss() * 0.3, 4), 1.1, 0.3, d.pick(['#5F933E', '#7FAA48', '#6E8A3E']), d, 0.85);
		if (d() < 0.35 + level * 0.1) wash(g, x + d.gauss() * 2, y - d.range(8, 12 + level * 2), 2.4, 2.2, d.pick(flowers), d, { layers: 3, alpha: 0.65, edge: 0.2 });
	}
}

/** Peintres : (contexte, rotation en radians) → { top, glow?, glowX?, water? }. */
export const ITEM_PAINTERS = {
	banc: paintBanc, massif: paintMassif, bois: paintBois, pierres: paintPierres, mangeoire: paintMangeoire, nichoir: paintNichoir,
	lanterne: paintLanterne, compost: paintCompost, hotel: paintHotel, mare: paintMare, cabane: paintCabane, potager: paintPotager, collecteur: paintCollecteur, abri: paintAbri,
	ruche: paintRuche, bain: paintBain, arche: paintArche, sandarium: paintSandarium, haie: paintHaie, muret: paintMuret, pas: paintPas, epouvantail: paintEpouvantail,
};

/**
 * Prix d'un objet : chaque exemplaire déjà posé (tous lieux confondus) le rend 1,4 fois plus cher.
 * Le premier de chaque reste bon marché ; garnir tout un monde devient un vrai projet.
 */
export function itemCost(kind, owned = 0) {
	return Math.round((ITEMS[kind].cost * Math.pow(1.4, owned)) / 5) * 5;
}

/** Combien d'individus de plus d'une espèce les objets posés dans ce lieu attirent. */
export function attracted(place, spId) {
	let n = 0;
	// Un habitat fleuri (niveau 3) en attire un de plus, un habitat remarquable (niveau 5) encore un.
	for (const it of place?.items ?? []) if ([].concat(ITEMS[it.kind]?.attracts ?? []).includes(spId)) n += 1 + ((it.level ?? 1) >= 3) + ((it.level ?? 1) >= 5);
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
