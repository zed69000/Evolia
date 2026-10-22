// Peintres des plantes et du décor. Chaque plante est redessinée à partir de sa graine (seed),
// donc elle garde la même forme d'un stade de croissance à l'autre.
// Repère local : origine au pied de la plante, y négatif vers le haut.

import { rng, wash, ribbon, curve, pointAt, leaf, ease, clamp01 } from './watercolor.js';
import { FLOWERS, BUSHES, TREES, SPECIES_BY_ID, speciesOf } from './species.js';

export const PLANT_TYPES = {
	herbe: { name: 'Herbe folle', plural: 'herbes folles', cost: 15, spacing: 16, box: { w: 64, h: 64, ax: 32, ay: 54 } },
	fleur: { name: 'Fleur', plural: 'fleurs', cost: 60, spacing: 24, box: { w: 84, h: 130, ax: 42, ay: 118 } },
	buisson: { name: 'Buisson', plural: 'buissons', cost: 150, spacing: 48, box: { w: 144, h: 122, ax: 72, ay: 108 } },
	arbre: { name: 'Arbre', plural: 'arbres', cost: 400, spacing: 82, box: { w: 280, h: 300, ax: 140, ay: 284 } },
};

const GREENS = ['#326832', '#488641', '#5F933E', '#7FAA48'];
/** Tire l'espèce d'une nouvelle plante. Les espèces encore inconnues sortent un peu plus souvent. */
export function newVariant(type, known = {}) {
	const pick = list => {
		const fresh = list.filter(x => !known[x.id]);
		const pool = fresh.length && Math.random() < 0.6 ? fresh : list;
		return pool[Math.floor(Math.random() * pool.length)];
	};
	if (type === 'fleur') { const f = pick(FLOWERS); return { species: f.id, color: f.color, shape: f.shape }; }
	if (type === 'buisson') { const b = pick(BUSHES); return { species: b.id, berry: b.berry }; }
	if (type === 'arbre') { const t = pick(TREES); return { species: t.id, fruit: t.fruit }; }
	return { species: 'graminees' };
}

export function plantName(p) {
	const name = SPECIES_BY_ID[speciesOf(p)]?.name ?? PLANT_TYPES[p.type].name;
	if (p.type === 'arbre' && p.growth < 1) return `Jeune ${name.split(' ')[0].toLowerCase()}`;
	return name;
}

function shadow(ctx, rx, ry, d, dx = 3) {
	wash(ctx, dx, 1, rx, ry, '#2E4A22', d, { layers: 5, alpha: 0.05, edge: 0 });
}

function seedMound(ctx, d) {
	wash(ctx, 0, 0, 7, 3, '#8A6A3E', d, { layers: 6, alpha: 0.12, edge: 0.15 });
	wash(ctx, 0, -2, 2.4, 1.7, '#6B4A2B', d, { layers: 4, alpha: 0.3, edge: 0 });
}

function paintHerbe(ctx, g, seed) {
	const r = rng(seed);
	const blades = Array.from({ length: 9 }, () => ({
		x: r.gauss() * 4, len: r.range(14, 34), ang: -Math.PI / 2 + r.gauss() * 0.32,
		bend: r.gauss() * 0.5, w: r.range(2, 3.2), c: r.pick(GREENS),
	}));
	const d = rng(seed ^ 0x9e37);
	shadow(ctx, 12, 3, d);
	if (g <= 0) { seedMound(ctx, d); return { top: -6 }; }
	const n = 2 + Math.round(g * 7);
	const k = 0.35 + 0.65 * ease(g);
	for (const b of blades.slice(0, n)) ribbon(ctx, curve(b.x, 0, b.ang, b.len * k, b.bend, 6), b.w, 0.3, b.c, d, 0.9);
	return { top: -30 * k };
}

function paintFleur(ctx, g, seed, v) {
	const r = rng(seed);
	const H = r.range(48, 72), lean = r.gauss() * 0.1, bend = r.gauss() * 0.15;
	const leaves = [0.1, 0.24, 0.4, 0.56].map((t, i) => ({
		t, side: (i % 2 ? 1 : -1) * (r() < 0.85 ? 1 : -1), len: r.range(16, 24), w: r.range(5.5, 7.5), ang: r.range(0.5, 0.9),
	}));
	const rot = r() * Math.PI * 2;
	const d = rng(seed ^ 0x51ed);
	shadow(ctx, 10, 3, d);
	if (g < 0.06) { seedMound(ctx, d); return { top: -6 }; }

	const h = Math.max(6, H * ease((g - 0.04) / 0.7));
	const stem = curve(0, 0, -Math.PI / 2 + lean, h, bend, 10);
	leaves.forEach((L, i) => {
		const s = clamp01((g - 0.1 - i * 0.1) / 0.2);
		if (!s) return;
		const p = pointAt(stem, L.t);
		leaf(ctx, p[0], p[1], L.len * s, L.w * s, -Math.PI / 2 + L.side * L.ang, r.pick(['#5F933E', '#7FAA48']), d);
	});
	ribbon(ctx, stem, 2.4, 1.3, '#5F933E', d);
	const tip = stem[stem.length - 1];

	const coty = 1 - clamp01((g - 0.2) / 0.15);
	if (coty > 0) {
		leaf(ctx, tip[0], tip[1], 8 * coty, 3.5 * coty, -Math.PI / 2 - 0.9, '#7FAA48', d);
		leaf(ctx, tip[0], tip[1], 8 * coty, 3.5 * coty, -Math.PI / 2 + 0.9, '#7FAA48', d);
	}
	if (g >= 0.5 && g < 0.72) {
		const bs = (g - 0.5) / 0.22;
		wash(ctx, tip[0], tip[1] - 3 - 2 * bs, 2.5 + 2.5 * bs, 3.5 + 3 * bs, v.color, d, { layers: 8, alpha: 0.13 });
		leaf(ctx, tip[0], tip[1], 5, 2, -Math.PI / 2 - 0.6, '#5F933E', d);
		leaf(ctx, tip[0], tip[1], 5, 2, -Math.PI / 2 + 0.6, '#5F933E', d);
		return { top: tip[1] - 8 };
	}
	if (g >= 0.72) {
		const b = ease((g - 0.72) / 0.28);
		if (v.shape === 'tulipe') {
			leaf(ctx, tip[0], tip[1], 9 + 13 * b, 4 + 5 * b, -Math.PI / 2 - 0.42, v.color, d, 0.9);
			leaf(ctx, tip[0], tip[1], 9 + 13 * b, 4 + 5 * b, -Math.PI / 2 + 0.42, v.color, d, 0.9);
			leaf(ctx, tip[0], tip[1] + 1, 10 + 14 * b, 4.5 + 5 * b, -Math.PI / 2, v.color, d, 1);
			return { top: tip[1] - 12 - 12 * b };
		}
		for (let k = 0; k < 5; k++) {
			ctx.save();
			ctx.translate(tip[0], tip[1]);
			ctx.rotate(rot + (k * Math.PI * 2) / 5);
			wash(ctx, 4 + 7 * b, 0, 4 + 7 * b, 3 + 4 * b, v.color, d, { layers: 9, alpha: 0.14 });
			ctx.restore();
		}
		wash(ctx, tip[0], tip[1], 2.5 + 2.5 * b, 2.5 + 2.5 * b, v.color === '#F4C23E' ? '#C97A2B' : '#F4C23E', d, { layers: 6, alpha: 0.28 });
		return { top: tip[1] - 4 };
	}
	return { top: tip[1] - 4 };
}

function paintBuisson(ctx, g, seed, v) {
	const r = rng(seed);
	const blobs = Array.from({ length: 13 }, (_, i) => {
		const layer = i < 5 ? 0 : i < 10 ? 1 : 2;
		const a = Math.PI + r() * Math.PI;
		const rad = layer === 2 ? r.range(0.2, 0.6) : r.range(0.3, 0.85);
		return {
			layer,
			x: Math.cos(a) * rad * (layer === 2 ? 0.7 : 1) - (layer === 2 ? 0.2 : 0),
			y: -0.5 + Math.sin(a) * rad * 0.65 - layer * 0.1 - (layer === 2 ? 0.15 : 0),
			s: layer === 2 ? r.range(0.18, 0.26) : r.range(0.36, 0.46),
			c: layer === 0 ? r.pick(['#1C5A35', '#326832']) : layer === 1 ? r.pick(['#326832', '#488641']) : r.pick(['#5F933E', '#7FAA48']),
		};
	});
	const ticks = Array.from({ length: 16 }, () => ({ a: Math.PI + r() * Math.PI, k: r.range(0.85, 1.05) }));
	const berries = Array.from({ length: 7 }, () => ({ x: r.gauss() * 0.4, y: -0.6 + r.gauss() * 0.25 }));
	const d = rng(seed ^ 0x2b0c);

	if (g < 0.1) {
		shadow(ctx, 10, 3, d);
		if (g < 0.03) { seedMound(ctx, d); return { top: -6 }; }
		const s = 0.4 + (g / 0.1) * 0.6;
		for (const a of [-0.7, 0, 0.7]) leaf(ctx, 0, 0, 12 * s, 4.5 * s, -Math.PI / 2 + a, '#5F933E', d);
		return { top: -12 * s };
	}
	const R = 12 + 42 * ease((g - 0.08) / 0.92);
	shadow(ctx, R * 1.05, R * 0.24, d, R * 0.15);
	for (const b of blobs) wash(ctx, b.x * R, b.y * R, b.s * R * 1.1, b.s * R, b.c, d, { layers: 10, alpha: 0.1 });
	for (const t of ticks) {
		const x = Math.cos(t.a) * R * 0.95 * t.k, y = -0.55 * R + Math.sin(t.a) * R * 0.8 * t.k;
		leaf(ctx, x, y, 3 + R * 0.08, 1.2 + R * 0.03, t.a, '#1C5A35', d, 0.55);
	}
	if (g >= 1) {
		for (const b of berries) wash(ctx, b.x * R, b.y * R, 2.3, 2.3, v.berry, d, { layers: 5, alpha: 0.3, edge: 0.3 });
	}
	return { top: -1.45 * R };
}

function paintArbre(ctx, g, seed, v = {}) {
	const r = rng(seed);
	const lean = r.gauss() * 0.05, tBend = r.gauss() * 0.1;
	const branches = Array.from({ length: 5 }, (_, i) => ({
		t: r.range(0.5, 0.95), side: i % 2 ? 1 : -1, ang: r.range(0.35, 0.95), len: r.range(0.3, 0.55), bend: r.gauss() * 0.3, sub: r.range(0.4, 0.7),
	}));
	const blobs = Array.from({ length: 24 }, (_, i) => {
		const layer = i < 9 ? 0 : i < 18 ? 1 : 2;
		const a = r() * Math.PI * 2;
		const rad = Math.sqrt(r()) * (layer === 2 ? 0.55 : 0.8);
		return {
			x: Math.cos(a) * rad * 0.95 - (layer === 2 ? 0.2 : 0) + (layer === 0 ? 0.08 : 0),
			y: Math.sin(a) * rad * 0.6 - (layer === 2 ? 0.22 : 0) + (layer === 0 ? 0.12 : 0),
			s: layer === 2 ? r.range(0.16, 0.24) : r.range(0.26, 0.38),
			c: layer === 0 ? r.pick(['#1C5A35', '#326832']) : layer === 1 ? r.pick(['#326832', '#488641']) : r.pick(['#5F933E', '#7FAA48']),
		};
	});
	const ticks = Array.from({ length: 22 }, () => ({ a: r() * Math.PI * 2, k: r.range(0.85, 1.05) }));
	const fruits = Array.from({ length: 9 }, () => ({ x: r.gauss() * 0.45, y: r.gauss() * 0.3 }));
	const d = rng(seed ^ 0x7a11);

	if (g < 0.2) {
		shadow(ctx, 10, 3, d);
		if (g < 0.05) { seedMound(ctx, d); return { top: -6 }; }
		const h = 8 + 40 * ((g - 0.05) / 0.15);
		const stem = curve(0, 0, -Math.PI / 2 + lean, h, tBend, 6);
		ribbon(ctx, stem, 2.6, 1.2, '#7A6A3A', d);
		const n = 2 + Math.floor(((g - 0.05) / 0.15) * 4);
		for (let i = 0; i < n; i++) {
			const p = pointAt(stem, 0.4 + (i / n) * 0.6);
			leaf(ctx, p[0], p[1], 9, 3.6, -Math.PI / 2 + (i % 2 ? 0.8 : -0.8), '#5F933E', d);
		}
		return { top: -h };
	}

	const k = ease((g - 0.2) / 0.8);
	const T = 30 + 90 * k, tw = 3 + 11 * k;
	const c = g > 0.3 ? ease((g - 0.3) / 0.7) : 0;
	const C = 18 + 87 * c;
	shadow(ctx, 16 + C * 1.0, 5 + C * 0.25, d, C * 0.3);

	const trunk = curve(0, 0, -Math.PI / 2 + lean, T, tBend, 10);
	for (const s of [-1, 1]) ribbon(ctx, curve(0, -tw * 0.5, s > 0 ? 0.45 : Math.PI - 0.45, tw * 0.9, s * 0.3, 4), tw * 0.5, 0.6, '#6B4A2B', d);
	ribbon(ctx, trunk, tw, tw * 0.45, '#7A5130', d, 0.95);
	ribbon(ctx, trunk.map(p => [p[0] + tw * 0.22, p[1]]), tw * 0.45, tw * 0.2, '#4A2E1A', d, 0.5);
	for (const b of branches) {
		const p = pointAt(trunk, b.t);
		const ang = -Math.PI / 2 + b.side * b.ang;
		const pts = curve(p[0], p[1], ang, b.len * T, b.bend, 6);
		ribbon(ctx, pts, tw * 0.45 * (1 - b.t * 0.4), 0.8, '#6B4A2B', d);
		const q = pointAt(pts, b.sub);
		ribbon(ctx, curve(q[0], q[1], ang - b.side * 0.5, b.len * T * 0.45, 0, 4), 1.6, 0.5, '#6B4A2B', d);
	}

	const top = trunk[trunk.length - 1];
	if (g <= 0.3) return { top: top[1] };
	const cx = top[0], cy = top[1] - C * 0.3;
	for (const b of blobs) wash(ctx, cx + b.x * C, cy + b.y * C, b.s * C * 1.15, b.s * C, b.c, d, { layers: 10, alpha: 0.11, sides: 9 });
	for (const t of ticks) {
		const x = cx + Math.cos(t.a) * C * 0.92 * t.k, y = cy + Math.sin(t.a) * C * 0.62 * t.k;
		leaf(ctx, x, y, 3 + C * 0.07, 1.4 + C * 0.025, t.a, '#1C5A35', d, 0.5);
	}
	for (const b of branches.slice(0, 2)) {
		ribbon(ctx, curve(cx, cy + C * 0.35, -Math.PI / 2 + b.side * b.ang, C * 0.35, b.bend, 4), 2.2, 0.6, '#4A2E1A', d, 0.45);
	}
	if (g >= 1) for (const f of fruits) wash(ctx, cx + f.x * C, cy + f.y * C, 1.9, 1.9, v.fruit ?? '#B07A3A', d, { layers: 4, alpha: 0.4, edge: 0.2 });
	return { top: cy - C * 0.75 };
}

const PAINTERS = { herbe: paintHerbe, fleur: paintFleur, buisson: paintBuisson, arbre: paintArbre };

/** Dessine la plante dans un contexte déjà placé sur son pied. Renvoie { top } (hauteur de la tête, en unités monde). */
export function paintPlant(ctx, p, growth = p.growth) {
	return PAINTERS[p.type](ctx, growth, p.seed, p.variant ?? {});
}

// ─── Décor (débloqué au fil des kilomètres) ────────────────────────────

export const DECOR = {
	pond: { name: 'La mare', km: 3, x: 115, y: 860, rad: 115, box: { w: 250, h: 160, ax: 125, ay: 90 } },
	mushrooms: { name: 'Les champignons', km: 6, x: 370, y: 780, rad: 32, box: { w: 80, h: 70, ax: 40, ay: 60 } },
	log: { name: 'Le vieux tronc', km: 10, x: 320, y: 920, rad: 70, box: { w: 160, h: 90, ax: 80, ay: 62 } },
};

function paintPond(ctx) {
	const d = rng(4242);
	wash(ctx, 0, 0, 112, 60, '#7FAA48', d, { layers: 10, alpha: 0.09, edge: 0 });
	wash(ctx, 0, 0, 98, 50, '#5BB5B0', d, { layers: 16, alpha: 0.12, edge: 0.3 });
	wash(ctx, -12, -8, 66, 30, '#8FD0C8', d, { layers: 10, alpha: 0.1, edge: 0.04 });
	for (const [x, y, l] of [[-40, -14, 30], [10, 6, 42], [-6, 22, 24]]) {
		ribbon(ctx, curve(x, y, 0, l, 0.1, 5), 1.4, 0.6, '#FDF7E7', d, 0.5);
	}
	for (const [x, y, s] of [[40, -10, 1], [58, 10, 0.8], [-60, 14, 0.9]]) {
		wash(ctx, x, y, 11 * s, 6.5 * s, '#7FAA48', d, { layers: 8, alpha: 0.18 });
	}
	wash(ctx, 40, -12, 3, 2.5, '#EE8FA4', d, { layers: 6, alpha: 0.3 });
	for (let i = 0; i < 14; i++) {
		const a = Math.PI * 1.05 + (i / 13) * Math.PI * 0.6;
		const x = Math.cos(a) * 96, y = Math.sin(a) * 50;
		ribbon(ctx, curve(x, y, -Math.PI / 2 + d.gauss() * 0.25, d.range(18, 38), d.gauss() * 0.4, 6), 2.6, 0.4, d.pick(['#488641', '#5F933E']), d, 0.9);
	}
	for (const [x, y] of [[-70, -52], [-48, -60]]) {
		ribbon(ctx, curve(x, y + 18, -Math.PI / 2, 30, 0.05, 5), 1.4, 1, '#5F933E', d);
		wash(ctx, x, y - 14, 2.6, 6.5, '#7A5130', d, { layers: 6, alpha: 0.3 });
	}
	return { top: -60 };
}

function paintMushrooms(ctx) {
	const d = rng(777);
	const one = (x, y, s) => {
		wash(ctx, x + 4 * s, y + 1, 12 * s, 3 * s, '#2E4A22', d, { layers: 4, alpha: 0.06, edge: 0 });
		ribbon(ctx, curve(x, y, -Math.PI / 2, 20 * s, 0.05, 4), 8 * s, 6 * s, '#EFE3C8', d, 0.95);
		wash(ctx, x, y - 20 * s, 15 * s, 9 * s, '#C0442F', d, { layers: 14, alpha: 0.13 });
		wash(ctx, x, y - 14 * s, 12 * s, 2.6 * s, '#8A3A2A', d, { layers: 5, alpha: 0.12, edge: 0 });
		for (const [dx, dy] of [[-6, -23], [3, -26], [8, -19], [-2, -18]]) {
			wash(ctx, x + dx * s, y + dy * s, 2 * s, 1.6 * s, '#FDF7E7', d, { layers: 4, alpha: 0.5, edge: 0 });
		}
	};
	one(-6, 0, 1);
	one(18, 4, 0.55);
	return { top: -30 };
}

function paintLog(ctx) {
	const d = rng(1312);
	wash(ctx, 8, 2, 66, 9, '#2E4A22', d, { layers: 5, alpha: 0.06, edge: 0 });
	ctx.save();
	ctx.rotate(-0.12);
	wash(ctx, 0, -16, 60, 17, '#8A5A34', d, { layers: 14, alpha: 0.12 });
	wash(ctx, 4, -25, 50, 6, '#B07A48', d, { layers: 8, alpha: 0.1, edge: 0 });
	for (const y of [-20, -12, -6]) ribbon(ctx, curve(-44, y, 0, 92, d.gauss() * 0.1, 8), 1.2, 0.5, '#4A2E1A', d, 0.5);
	wash(ctx, -58, -16, 11, 16, '#4A2E1A', d, { layers: 10, alpha: 0.18 });
	wash(ctx, -58, -16, 7, 11, '#2A1A0E', d, { layers: 8, alpha: 0.25, edge: 0 });
	for (const [x, y, s] of [[-10, -32, 1], [22, -30, 0.7], [44, -26, 0.6]]) wash(ctx, x, y, 12 * s, 4 * s, '#7FAA48', d, { layers: 6, alpha: 0.2 });
	ctx.restore();
	return { top: -36 };
}

export const DECOR_PAINTERS = { pond: paintPond, mushrooms: paintMushrooms, log: paintLog };
