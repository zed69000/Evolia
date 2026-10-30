// Peintres des plantes et du décor. Chaque plante est redessinée à partir de sa graine (seed),
// donc elle garde la même forme d'un stade de croissance à l'autre. Son espèce (species.js)
// donne le `look` : forme de fleur, couleurs, silhouette d'arbre…
// Repère local : origine au pied de la plante, y négatif vers le haut.

import { rng, wash, ribbon, curve, pointAt, leaf, ease, clamp01, mix, rgba } from './watercolor.js';
import { SPECIES_BY_ID, speciesIn, speciesOf } from './species.js';

export const PLANT_TYPES = {
	herbe: { name: 'Herbe folle', plural: 'herbes folles', cost: 15, spacing: 16, box: { w: 72, h: 76, ax: 36, ay: 62 } },
	fleur: { name: 'Fleur', plural: 'fleurs', cost: 60, spacing: 24, box: { w: 90, h: 140, ax: 45, ay: 126 } },
	buisson: { name: 'Arbuste', plural: 'arbustes', cost: 150, spacing: 48, box: { w: 200, h: 145, ax: 100, ay: 125 } },
	arbre: { name: 'Arbre', plural: 'arbres', cost: 400, spacing: 82, box: { w: 340, h: 315, ax: 170, ay: 297 } },
};

const GREENS = ['#326832', '#488641', '#5F933E', '#7FAA48'];
const FOLIAGE = ['#2A6034', '#3E7A3C', '#6E9E46'];
const CANOPY = ['#1C5A35', '#326832', '#5F933E'];

/** Tire l'espèce d'une nouvelle plante parmi celles du lieu. Les espèces encore inconnues sortent plus souvent. */
/** Espèce d'une nouvelle plante : souvent une pas encore découverte ; dans un coin, souvent une de ses favorites. */
export function newVariant(type, place, known = {}, favor = []) {
	const list = speciesIn(place, type);
	if (!list.length) return { species: speciesIn('prairie', type)[0].id };
	const liked = list.filter(x => favor.includes(x.id));
	if (liked.length && Math.random() < 0.7) return { species: liked[Math.floor(Math.random() * liked.length)].id };
	const fresh = list.filter(x => !known[x.id]);
	const pool = fresh.length && Math.random() < 0.6 ? fresh : list;
	return { species: pool[Math.floor(Math.random() * pool.length)].id };
}

export function plantName(p) {
	const name = SPECIES_BY_ID[speciesOf(p)]?.name ?? PLANT_TYPES[p.type].name;
	if (p.type === 'arbre' && p.growth < 1) return `Jeune ${name.split(' ')[0].toLowerCase()}`;
	return name;
}

/** Ombre de contact, juste sous la plante ; l'ombre portée suit le vrai soleil et se dessine dans le jardin. */
function shadow(ctx, rx, ry, d) {
	wash(ctx, 0, 1, rx * 0.55, ry * 0.65, '#2E4A22', d, { layers: 4, alpha: 0.045, edge: 0 });
}

/** Herbes dorées en automne, ternes en hiver. */
function grassTone(c, env) {
	const s = env.season;
	if (!s) return c;
	return mix(mix(c, '#B8A858', (s.autumn ?? 0) * 0.35), '#A0A088', (s.winter ?? 0) * 0.4);
}

function seedMound(ctx, d) {
	wash(ctx, 0, 0, 7, 3, '#8A6A3E', d, { layers: 6, alpha: 0.12, edge: 0.15 });
	wash(ctx, 0, -2, 2.4, 1.7, '#6B4A2B', d, { layers: 4, alpha: 0.3, edge: 0 });
}

// ─── Herbes ───────────────────────────────────────────────────

function paintHerbe(ctx, g, seed, look, env = {}) {
	const r = rng(seed);
	const tone = c => grassTone(c, env);
	const form = look.form ?? 'graminees';
	const d = rng(seed ^ 0x9e37);
	shadow(ctx, 12, 3, d);
	if (g <= 0) { seedMound(ctx, d); return { top: -6, r: 6 }; }
	const k = 0.35 + 0.65 * ease(g);

	if (form === 'fougere') {
		const fronds = Array.from({ length: 6 }, (_, i) => ({ a: (i - 2.5) * 0.36 + r.gauss() * 0.1, len: r.range(24, 36), c: r.pick(['#3E7A3A', '#4E8A3E', '#6E9A48']) }));
		const n = 2 + Math.round(g * 4);
		for (const f of fronds.slice(0, n)) {
			const side = Math.sign(f.a) || 1;
			const pts = curve(0, 0, -Math.PI / 2 + f.a, f.len * k, side * 0.9, 9);
			ribbon(ctx, pts, 1.4, 0.4, tone(f.c), d);
			for (let i = 2; i < pts.length; i++) {
				const [x, y] = pts[i];
				const [px, py] = pts[i - 1];
				const dir = Math.atan2(y - py, x - px);
				const l = 7 * (1 - i / pts.length * 0.75) * k;
				leaf(ctx, x, y, l, l * 0.32, dir - 1.25, tone(f.c), d, 0.75);
				leaf(ctx, x, y, l, l * 0.32, dir + 1.25, tone(f.c), d, 0.75);
			}
		}
		return { top: -26 * k, r: 12 };
	}
	if (form === 'jonc') {
		const stems = Array.from({ length: 14 }, () => ({ x: r.gauss() * 3, len: r.range(28, 50), a: r.gauss() * 0.12, c: r.pick(['#3E6A3A', '#4E7A3A', '#5A7A40']) }));
		const n = 4 + Math.round(g * 10);
		stems.slice(0, n).forEach((s, i) => {
			const pts = curve(s.x, 0, -Math.PI / 2 + s.a, s.len * k, s.a * 0.5, 6);
			ribbon(ctx, pts, 1.8, 0.5, tone(s.c), d);
			if (g >= 1 && i % 4 === 0) { const p = pointAt(pts, 0.78); wash(ctx, p[0] + 1.5, p[1], 1.6, 2.6, '#8A6A3A', d, { layers: 4, alpha: 0.35, edge: 0.2 }); }
		});
		return { top: -40 * k, r: 6 };
	}
	if (form === 'oyat') {
		const blades = Array.from({ length: 10 }, () => ({ x: r.gauss() * 4, len: r.range(30, 52), a: r.gauss() * 0.5, bend: r.gauss() * 1.1, c: r.pick(['#8AA07A', '#A8B488', '#9DB08A', '#7A9070']) }));
		const n = 3 + Math.round(g * 7);
		for (const b of blades.slice(0, n)) ribbon(ctx, curve(b.x, 0, -Math.PI / 2 + b.a, b.len * k, b.bend, 7), 2.2, 0.3, tone(b.c), d, 0.9);
		return { top: -36 * k, r: 10 };
	}
	const palette = look.palette ?? GREENS;
	const blades = Array.from({ length: 9 }, () => ({
		x: r.gauss() * 4, len: r.range(14, 34), ang: -Math.PI / 2 + r.gauss() * 0.32, bend: r.gauss() * 0.5, w: r.range(2, 3.2), c: r.pick(palette),
	}));
	const n = 2 + Math.round(g * 7);
	blades.slice(0, n).forEach((b, i) => {
		const pts = curve(b.x, 0, b.ang, b.len * k, b.bend, 6);
		ribbon(ctx, pts, b.w, 0.3, tone(b.c), d, 0.9);
		// Épillets au bout des plus hauts brins, une fois l'herbe montée en graines.
		if (g >= 1 && i < 3 && b.len > 24) { const p = pts[pts.length - 1]; wash(ctx, p[0], p[1] - 2, 1.4, 3.4, '#C8B87A', d, { layers: 4, alpha: 0.35, edge: 0.25 }); }
	});
	return { top: -30 * k, r: 8 };
}

/**
 * Tapis d'herbe peint au sol sous chaque touffe : les touffes voisines se fondent en une pelouse continue.
 * Origine au centre ; `palette` vient de l'espèce, `season` jaunit en automne. Rayon utile : 64 × 30.
 */
export function paintTurf(ctx, seed, palette = GREENS, season) {
	const r = rng(seed), d = rng(seed ^ 0x51ed);
	const tone = c => grassTone(c, { season });
	wash(ctx, 0, 0, 52, 23, tone(palette[1] ?? palette[0]), d, { layers: 7, alpha: 0.07, edge: 0, variance: 0.3 });
	wash(ctx, r.gauss() * 6, r.gauss() * 2, 36, 16, tone(palette[0]), d, { layers: 6, alpha: 0.07, edge: 0, variance: 0.3 });
	// Brins courts, plus serrés au centre, couchés dans tous les sens comme une vraie pelouse.
	for (let i = 0; i < 140; i++) {
		const a = r() * Math.PI * 2, k = Math.sqrt(r());
		const x = Math.cos(a) * 52 * k, y = Math.sin(a) * 23 * k;
		const len = (4 + r() * 7) * (1 - k * 0.45);
		const lean = r.gauss() * 0.5;
		ctx.strokeStyle = rgba(tone(r.pick(palette)), 0.55 - k * 0.3);
		ctx.lineWidth = 1 + r() * 0.8;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.quadraticCurveTo(x + lean * len * 0.3, y - len * 0.6, x + lean * len, y - len);
		ctx.stroke();
	}
	// Quelques pâquerettes et trèfles perdus dans l'herbe.
	for (let i = 0; i < 5; i++) {
		const x = r.gauss() * 26, y = r.gauss() * 11;
		if (r() < 0.5) { ctx.fillStyle = rgba('#FBF6EC', 0.85); ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#E8C23A'; ctx.beginPath(); ctx.arc(x, y, 0.6, 0, Math.PI * 2); ctx.fill(); }
		else wash(ctx, x, y, 2.6, 1.4, tone('#4E8A3E'), d, { layers: 3, alpha: 0.35, edge: 0 });
	}
	// Bord fondu : la pelouse se perd dans le sol, sans contour.
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const W = ctx.canvas.width, H = ctx.canvas.height;
	ctx.translate(W / 2, H / 2);
	ctx.scale(1, H / W);
	const fade = ctx.createRadialGradient(0, 0, W * 0.18, 0, 0, W * 0.5);
	fade.addColorStop(0, 'rgba(0,0,0,1)');
	fade.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.globalCompositeOperation = 'destination-in';
	ctx.fillStyle = fade;
	ctx.fillRect(-W, -W, W * 2, W * 2);
	ctx.restore();
}

// ─── Fleurs ───────────────────────────────────────────────────

function petalRing(ctx, x, y, n, dist, rx, ry, rot, color, d) {
	for (let k = 0; k < n; k++) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot + (k * Math.PI * 2) / n);
		wash(ctx, dist, 0, rx, ry, color, d, { layers: 8, alpha: 0.15 });
		ctx.restore();
	}
}

function center(ctx, x, y, rad, color, d) {
	wash(ctx, x, y, rad, rad, color, d, { layers: 6, alpha: 0.3, edge: 0.25 });
}

/** Tête de fleur épanouie (b : ouverture de 0 à 1). Renvoie le haut de la fleur. */
function head(ctx, L, stem, tip, b, s, rot, d) {
	const [x, y] = tip;
	const c = L.color;
	switch (L.shape) {
		case 'etoile':
			for (let k = 0; k < 5; k++) leaf(ctx, x, y, (5 + 8 * b) * s, (2.4 + 2.4 * b) * s, rot + (k * Math.PI * 2) / 5, c, d, 0.95);
			center(ctx, x, y, (1.4 + 1.2 * b) * s, L.center ?? '#F4C23E', d);
			return y - 12 * s;
		case 'quatre':
			petalRing(ctx, x, y, 4, (3 + 5 * b) * s, (4.5 + 6 * b) * s, (4 + 5 * b) * s, rot, c, d);
			center(ctx, x, y, (1.8 + 1.4 * b) * s, L.center ?? '#2A1E18', d);
			return y - 12 * s;
		case 'tulipe':
			leaf(ctx, x, y, (9 + 13 * b) * s, (4 + 5 * b) * s, -Math.PI / 2 - 0.42, c, d, 0.9);
			leaf(ctx, x, y, (9 + 13 * b) * s, (4 + 5 * b) * s, -Math.PI / 2 + 0.42, c, d, 0.9);
			leaf(ctx, x, y + 1, (10 + 14 * b) * s, (4.5 + 5 * b) * s, -Math.PI / 2, c, d, 1);
			return y - (12 + 12 * b) * s;
		case 'globe':
			wash(ctx, x, y - (4 + 4 * b) * s, (4 + 4 * b) * s, (4 + 4.5 * b) * s, c, d, { layers: 12, alpha: 0.16, edge: 0.3 });
			leaf(ctx, x, y, (6 + 7 * b) * s, (3 + 3 * b) * s, -Math.PI / 2 - 0.35, mix(c, '#FDF7E7', 0.25), d, 0.7);
			return y - (10 + 9 * b) * s;
		case 'clochette': {
			const n = L.bells ?? 3;
			const bs = (L.bellSize ?? (n > 4 ? 0.75 : 1)) * s;
			for (let i = 0; i < n; i++) {
				let px, py, side;
				if (L.umbel) {
					const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
					px = x + Math.cos(a) * 6 * bs; py = y + Math.sin(a) * 4 * bs + 4 * bs; side = Math.sign(Math.cos(a)) || 1;
				} else {
					// Grappe : les clochettes s'étagent le long du haut de la tige, en quinconce.
					const t = n === 1 ? 1 : (L.oneSide ? 0.38 : 0.5) + ((L.oneSide ? 0.62 : 0.5) * i) / (n - 1);
					[px, py] = pointAt(stem, t);
					side = L.oneSide ? (i % 3 === 2 ? -1 : 1) : i % 2 ? 1 : -1;
					px += side * (L.oneSide ? 4.5 : 3);
				}
				const hang = (L.turban ? 5 : 3) * bs;
				ribbon(ctx, [[px - side * 3, py], [px, py + hang * 0.4], [px, py + hang]], 0.9, 0.6, '#5F933E', d);
				const by = py + hang;
				if (L.turban) {
					for (const a of [-0.9, -0.35, 0.35, 0.9]) leaf(ctx, px, by + 3 * bs, (5 + 5 * b) * bs, (1.8 + 1.4 * b) * bs, -Math.PI / 2 + a * 1.4, c, d, 0.95);
					wash(ctx, px, by + 2 * bs, 1.4 * bs, 2 * bs, mix(c, '#2A1E18', 0.4), d, { layers: 4, alpha: 0.3, edge: 0 });
				} else {
					leaf(ctx, px, by, (4 + 5 * b) * bs, (2 + 2 * b) * bs, Math.PI / 2 - 0.35, c, d, 0.95);
					leaf(ctx, px, by, (4 + 5 * b) * bs, (2 + 2 * b) * bs, Math.PI / 2 + 0.35, c, d, 0.95);
					leaf(ctx, px, by, (4.5 + 5 * b) * bs, (2.2 + 2 * b) * bs, Math.PI / 2, mix(c, '#FDF7E7', 0.15), d, 1);
					if (L.fringe) {
						ctx.strokeStyle = c; ctx.lineWidth = 0.5;
						for (let f = -2; f <= 2; f++) { ctx.beginPath(); ctx.moveTo(px + f * 1.3 * bs, by + (6 + 3 * b) * bs); ctx.lineTo(px + f * 1.6 * bs, by + (8 + 4 * b) * bs); ctx.stroke(); }
					}
				}
			}
			return y - 6;
		}
		case 'ombelle': {
			const R = (6 + 8 * b) * s;
			for (let k = 0; k < 9; k++) {
				const a = -Math.PI / 2 + (k - 4) * 0.22;
				const ex = x + Math.cos(a) * R, ey = y + Math.sin(a) * R * 0.55 - R * 0.35;
				ribbon(ctx, [[x, y], [(x + ex) / 2, (y + ey) / 2 - 1], [ex, ey]], 0.7, 0.4, '#6E9A48', d, 0.7);
			}
			const dots = L.style === 'etoile' ? 10 : 26;
			const r2 = rng(Math.round(x * 13 + y * 7) + 99);
			for (let k = 0; k < dots; k++) {
				const a = Math.PI + r2() * Math.PI, rr = Math.sqrt(r2()) * R * 1.05;
				const dx = x + Math.cos(a) * rr, dy = y - R * 0.45 + Math.sin(a) * rr * 0.4;
				if (L.style === 'etoile') for (let q = 0; q < 6; q++) leaf(ctx, dx, dy, 2.6 * s * (0.5 + b * 0.5), 0.9 * s, (q * Math.PI) / 3, c, d, 0.9);
				else wash(ctx, dx, dy, 1.3 * s, 1.2 * s, c, d, { layers: 3, alpha: 0.4, edge: 0.2 });
			}
			if (L.center && L.center !== c) center(ctx, x, y - R * 0.45, 1.3 * s, L.center, d);
			return y - R;
		}
		case 'epi': {
			const n = 16;
			for (let i = 0; i < n; i++) {
				const t = 0.5 + (0.5 * i) / (n - 1);
				const [px, py] = pointAt(stem, t);
				const side = i % 2 ? 1 : -1;
				const rad = (1.5 + 2.2 * b) * (1.15 - (t - 0.5) * 1.2) * s;
				const col = L.color2 && t > 0.82 ? L.color2 : c;
				wash(ctx, px + side * rad * 0.7, py, rad, rad * 0.85, col, d, { layers: 4, alpha: 0.3, edge: 0.2 });
			}
			return y - 4;
		}
		case 'capitule': {
			const n = L.style === 'frange' ? 9 : L.style === 'epine' ? 12 : 15;
			const len = (5 + 7 * b) * s, w = (L.style === 'frange' ? 2.2 : 1.2) * (0.7 + 0.5 * b) * s;
			for (let k = 0; k < n; k++) leaf(ctx, x, y, L.style === 'epine' ? len * 1.2 : len, L.style === 'epine' ? w * 0.6 : w, rot + (k * Math.PI * 2) / n, c, d, 0.95);
			center(ctx, x, y, (L.style === 'frange' ? 2 : 2.4 + 2.2 * b) * s, L.center ?? '#F4C23E', d);
			return y - len;
		}
		case 'pompon': {
			const R = (3.5 + 4 * b) * s;
			wash(ctx, x, y - R * 0.6, R, R, c, d, { layers: 10, alpha: 0.16, edge: 0.25 });
			const r2 = rng(Math.round(x * 31 + y * 17) + 5);
			for (let k = 0; k < 14; k++) {
				const a = r2() * Math.PI * 2, rr = Math.sqrt(r2()) * R * 0.85;
				wash(ctx, x + Math.cos(a) * rr, y - R * 0.6 + Math.sin(a) * rr, 0.9 * s, 0.9 * s, mix(c, '#3A1A2A', 0.3), d, { layers: 2, alpha: 0.4, edge: 0 });
			}
			return y - R * 1.6;
		}
		case 'iris': {
			const big = (7 + 8 * b) * s, w = (3 + 3 * b) * s;
			for (const a of [0.15, Math.PI - 0.15, Math.PI / 2]) leaf(ctx, x, y, big, w, a, c, d, 0.95);
			for (const a of [-Math.PI / 2, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45]) leaf(ctx, x, y, big * 0.75, w * 0.6, a, mix(c, '#FDF7E7', 0.2), d, 0.9);
			ctx.strokeStyle = 'rgba(120,70,20,0.5)';
			ctx.lineWidth = 0.4;
			for (const a of [0.15, Math.PI - 0.15, Math.PI / 2]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * big * 0.6, y + Math.sin(a) * big * 0.6); ctx.stroke(); }
			return y - big;
		}
		default: { // marguerite
			const n = L.petals ?? 5;
			petalRing(ctx, x, y, n, (4 + 7 * b) * s, (4 + 7 * b) * s, (3 + 4 * b) * s, rot, c, d);
			center(ctx, x, y, (2.5 + 2.5 * b) * s, L.center ?? '#F4C23E', d);
			return y - 8 * s;
		}
	}
}

function paintFleurOne(ctx, g, seed, L, env = {}) {
	const r = rng(seed);
	const [h0, h1] = L.h ?? [48, 72];
	const H = r.range(h0, h1), lean = r.gauss() * 0.1, bend = r.gauss() * 0.15;
	const leaves = [0.1, 0.24, 0.4, 0.56].map((t, i) => ({
		t, side: (i % 2 ? 1 : -1) * (r() < 0.85 ? 1 : -1), len: r.range(16, 24), w: r.range(5.5, 7.5), ang: r.range(0.5, 0.9),
	}));
	const base = Array.from({ length: 7 }, (_, i) => ({ a: -Math.PI / 2 + (i - 3) * 0.42 + r.gauss() * 0.1, len: r.range(0.55, 0.85), bend: r.gauss() * 0.4 }));
	const rot = r() * Math.PI * 2;
	const lc = L.leafColor ?? '#5F933E';
	const s = L.size ?? 1;
	const d = rng(seed ^ 0x51ed);
	shadow(ctx, 10, 3, d);
	if (g < 0.06) { seedMound(ctx, d); return { top: -6, r: 6 }; }

	const h = Math.max(6, H * ease((g - 0.04) / 0.7));
	const grow = clamp01((g - 0.06) / 0.4);
	const leafKind = L.leaf ?? 'large';
	if (leafKind === 'fine') {
		for (const b of base.slice(0, 4)) ribbon(ctx, curve(b.a * 0.1, 0, b.a * 0.55 - Math.PI / 4, H * b.len * grow, b.bend, 6), 2.6, 0.3, lc, d, 0.85);
	} else if (leafKind === 'broad') {
		for (const a of [-0.32, 0.3]) leaf(ctx, 0, 0, H * 0.55 * grow, 6.5 * grow, -Math.PI / 2 + a, lc, d);
	} else if (leafKind === 'rosette') {
		for (const b of base.slice(0, 6)) leaf(ctx, 0, 0, 13 * grow, 4.8 * grow, b.a * 1.4 + (b.a < -Math.PI / 2 ? -0.5 : 0.5), lc, d);
	}
	const stem = curve(0, 0, -Math.PI / 2 + lean, h, bend, 10);
	if (leafKind === 'large') {
		leaves.forEach((Lf, i) => {
			const k = clamp01((g - 0.1 - i * 0.1) / 0.2);
			if (!k) return;
			const p = pointAt(stem, Lf.t);
			leaf(ctx, p[0], p[1], Lf.len * k, Lf.w * k, -Math.PI / 2 + Lf.side * Lf.ang, r.pick([lc, mix(lc, '#C8D890', 0.3)]), d);
		});
	}
	ribbon(ctx, stem, 2.4, 1.3, mix(lc, '#5F933E', 0.5), d);
	const tip = stem[stem.length - 1];

	const coty = 1 - clamp01((g - 0.2) / 0.15);
	if (coty > 0 && leafKind === 'large') {
		leaf(ctx, tip[0], tip[1], 8 * coty, 3.5 * coty, -Math.PI / 2 - 0.9, '#7FAA48', d);
		leaf(ctx, tip[0], tip[1], 8 * coty, 3.5 * coty, -Math.PI / 2 + 0.9, '#7FAA48', d);
	}
	if (g >= 0.5 && g < 0.72) {
		const bs = (g - 0.5) / 0.22;
		wash(ctx, tip[0], tip[1] - 3 - 2 * bs, (2.5 + 2.5 * bs) * s, (3.5 + 3 * bs) * s, L.color2 ?? L.color, d, { layers: 8, alpha: 0.13 });
		leaf(ctx, tip[0], tip[1], 5, 2, -Math.PI / 2 - 0.6, '#5F933E', d);
		leaf(ctx, tip[0], tip[1], 5, 2, -Math.PI / 2 + 0.6, '#5F933E', d);
		return { top: tip[1] - 8, r: 7 };
	}
	if (g < 0.72) return { top: tip[1] - 4, r: 7 };

	const b = ease((g - 0.72) / 0.28);
	if (L.cluster) {
		for (const side of [-1, 1]) {
			const p = pointAt(stem, 0.78);
			const t2 = [p[0] + side * 7, p[1] - 4];
			ribbon(ctx, [p, [p[0] + side * 4, p[1] - 3], t2], 1, 0.7, '#5F933E', d);
			head(ctx, L, stem, t2, b * 0.85, s * 0.85, rot + side, d);
		}
	}
	const top = head(ctx, L, stem, tip, b, s, rot, d);
	if (env.detail && b > 0.5) details(ctx, L, tip, b, s, rot);
	return { top, r: 7 * s };
}

/** De près : nervures des pétales et étamines au cœur des fleurs ouvertes. */
function details(ctx, L, [x, y], b, s, rot) {
	const shape = L.shape ?? 'marguerite';
	const n = { marguerite: L.petals ?? 5, quatre: 4, etoile: 5, capitule: 15 }[shape];
	if (!n) return;
	const len = { marguerite: 10, quatre: 10, etoile: 11, capitule: 10 }[shape] * b * s;
	ctx.strokeStyle = rgba(mix(L.color, '#2A1E18', 0.45), 0.35);
	ctx.lineWidth = 0.3;
	for (let k = 0; k < n; k++) {
		const a = rot + (k * Math.PI * 2) / n;
		ctx.beginPath();
		ctx.moveTo(x + Math.cos(a) * len * 0.25, y + Math.sin(a) * len * 0.25);
		ctx.lineTo(x + Math.cos(a) * len * 0.9, y + Math.sin(a) * len * 0.9);
		ctx.stroke();
	}
	const core = L.center ?? '#F4C23E';
	ctx.fillStyle = rgba(mix(core, '#5A3A10', 0.4), 0.7);
	for (let k = 0; k < 9; k++) {
		const a = k * 2.4, rr = Math.sqrt(k / 9) * 2.2 * s;
		ctx.beginPath();
		ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.35 * s, 0, Math.PI * 2);
		ctx.fill();
	}
}

// ─── Saisons ──────────────────────────────────────────────────

const AUTUMN = ['#C8742E', '#E09A3A', '#B85A2A', '#D8B048', '#A84A28'];
const hash = i => (((i + 1) * 2654435761) >>> 0) / 4294967296;

/** Couleur d'un feuillage selon la saison : cuivrée en automne, terne en hiver (sauf feuillage persistant). */
function seasonal(color, L, env, i) {
	const s = env.season;
	if (!s || L.evergreen) return color;
	let c = color;
	if (s.autumn > 0) c = mix(c, AUTUMN[i % AUTUMN.length], s.autumn * (0.35 + 0.65 * hash(i)));
	if (s.winter > 0) c = mix(c, '#8A8A70', s.winter * 0.45);
	return c;
}
/** En plein hiver, arbres et arbustes à feuilles caduques n'ont plus que leurs branches. */
const bare = (L, env) => !L.evergreen && (env.season?.winter ?? 0) > 0.55;
/** Au printemps, certains arbres et arbustes se couvrent de fleurs blanches. */
const blooming = (L, env) => !!L.blossom && (env.season?.spring ?? 0) > 0.35;

// ─── Arbustes ─────────────────────────────────────────────────
// Port : en dôme, étalé (bas et large), dressé (tiges visibles, en vase) ou en tiges arquées (ronce, églantier).

function paintBuisson(ctx, g, seed, L, env = {}) {
	const r = rng(seed);
	const f = L.foliage ?? FOLIAGE;
	const shape = L.shape ?? 'dome';
	const sx = shape === 'spreading' ? 1.35 : shape === 'upright' ? 0.72 : 1;
	const sy = shape === 'spreading' ? 0.62 : shape === 'upright' ? 1.25 : 1;
	const blobs = Array.from({ length: 13 }, (_, i) => {
		const layer = i < 5 ? 0 : i < 10 ? 1 : 2;
		const a = Math.PI + r() * Math.PI;
		const rad = layer === 2 ? r.range(0.2, 0.6) : r.range(0.3, 0.85);
		return {
			x: Math.cos(a) * rad * (layer === 2 ? 0.7 : 1) - (layer === 2 ? 0.2 : 0),
			y: -0.5 + Math.sin(a) * rad * 0.65 - layer * 0.1 - (layer === 2 ? 0.15 : 0),
			s: layer === 2 ? r.range(0.18, 0.26) : r.range(0.36, 0.46),
			c: layer === 0 ? r.pick([mix(f[0], '#102818', 0.2), f[0]]) : layer === 1 ? r.pick([f[0], f[1]]) : r.pick([f[1], f[2]]),
		};
	});
	const ticks = Array.from({ length: 16 }, () => ({ a: Math.PI + r() * Math.PI, k: r.range(0.85, 1.05) }));
	const n = L.dotCount ?? 7;
	const dots = Array.from({ length: n }, () => ({ x: r.gauss() * 0.42, y: -0.62 + r.gauss() * 0.26 }));
	const stems = Array.from({ length: 6 }, (_, i) => ({ x: r.gauss() * 2, a: -Math.PI / 2 + (i - 2.5) * 0.24 + r.gauss() * 0.08, len: r.range(0.8, 1.1), bend: r.gauss() * 0.3 }));
	const canes = Array.from({ length: 7 }, (_, i) => ({ a: -Math.PI / 2 + (i - 3) * 0.3 + r.gauss() * 0.1, len: r.range(0.9, 1.25), bend: (i < 3 ? -1 : i > 3 ? 1 : r.gauss()) * r.range(0.9, 1.5) }));
	const d = rng(seed ^ 0x2b0c);

	if (g < 0.1) {
		shadow(ctx, 10, 3, d);
		if (g < 0.03) { seedMound(ctx, d); return { top: -6, r: 6 }; }
		const s = 0.4 + (g / 0.1) * 0.6;
		for (const a of [-0.7, 0, 0.7]) leaf(ctx, 0, 0, 12 * s, 4.5 * s, -Math.PI / 2 + a, f[1], d);
		return { top: -12 * s, r: 8 };
	}
	const R = (12 + 42 * ease((g - 0.08) / 0.92)) * (L.low ? 0.65 : 1) * (shape === 'spreading' ? 0.85 : 1);
	shadow(ctx, R * 1.05 * sx, R * 0.24, d);
	const leafless = bare(L, env);
	const caneTips = [];

	if (shape === 'upright' || (leafless && shape !== 'arching')) {
		for (const st of stems) ribbon(ctx, curve(st.x, 0, st.a, R * (leafless ? 1.35 : 0.9) * sy * st.len, st.bend, 6), 2.4, 0.5, '#6B4A2B', d, 0.85);
	}
	if (shape === 'arching') {
		canes.forEach((cn, i) => {
			const pts = curve(0, 0, cn.a, R * 1.4 * cn.len, cn.bend, 9);
			ribbon(ctx, pts, 2.2, 0.6, leafless ? '#6B4A2B' : '#6A5A2A', d, 0.85);
			caneTips.push(pts[pts.length - 1], pointAt(pts, 0.7));
			if (leafless) return;
			for (let k = 2; k < pts.length; k++) {
				const [x, y] = pts[k], [px, py] = pts[k - 1];
				const dir = Math.atan2(y - py, x - px);
				leaf(ctx, x, y, 4 + R * 0.09, 1.8 + R * 0.03, dir + (k % 2 ? 1.1 : -1.1), seasonal(f[k % 3], L, env, i * 9 + k), d, 0.85);
			}
		});
	}
	if (!leafless) {
		if (shape === 'arching') {
			blobs.slice(0, 6).forEach((b, i) => wash(ctx, b.x * R * sx, b.y * R * sy, b.s * R * 0.66, b.s * R * 0.6, seasonal(b.c, L, env, i), d, { layers: 10, alpha: 0.08 }));
		} else {
			// Un buisson se peint comme une petite couronne posée au sol : bouquets éclairés en haut à gauche, ombre froide dessous.
			const lobes = crownLobes(r, 0, -0.62 * R * sy, R * sx * 0.95, R * 0.62 * sy, 6, 0.48);
			for (const l of lobes) l.y = Math.min(l.y, -l.r * 0.55);
			const pal = [f[0], f[1], f[2] ?? f[1]];
			foliage(ctx, lobes, pal, L, env, d, {
				midY: -0.55 * R * sy, leaf: 3 + R * 0.08, detail: env.detail,
				core: { x: R * 0.1, y: -R * 0.28, rx: R * 0.8 * sx, ry: R * 0.22 },
			});
			if (L.gloss) for (const l of lobes.slice(0, 4)) wash(ctx, l.x - l.r * 0.35, l.y - l.r * 0.35, 2.4, 1.3, '#FDF7E7', d, { layers: 3, alpha: 0.4, edge: 0 });
		}
	}
	const spots = shape === 'arching' ? caneTips.map(([x, y]) => ({ x: x / R, y: y / R })) : dots.map(p => ({ x: p.x * sx, y: p.y * sy }));
	if (!leafless && blooming(L, env)) {
		for (const p of [...spots, ...spots.map(q => ({ x: q.x + 0.15, y: q.y + 0.1 }))]) wash(ctx, p.x * R, p.y * R, 2.2, 2, L.blossom, d, { layers: 4, alpha: 0.45 * env.season.spring, edge: 0.15 });
	} else if (g >= 1 && L.dots && !leafless) {
		const style = L.dotStyle ?? 'berry';
		for (const p of spots) {
			const x = p.x * R, y = p.y * R;
			if (style === 'catkin') wash(ctx, x, y + 4, 1.4, 3.8, L.dots, d, { layers: 4, alpha: 0.4, edge: 0.25 });
			else if (style === 'plume') wash(ctx, x, y - 4, 2, 6, L.dots, d, { layers: 6, alpha: 0.3, edge: 0.15 });
			else if (style === 'flower') wash(ctx, x, y, 3.2, 2.8, L.dots, d, { layers: 6, alpha: 0.3, edge: 0.2 });
			else wash(ctx, x, y, L.dotSize ?? 2.3, L.dotSize ?? 2.3, L.dots, d, { layers: 5, alpha: 0.32, edge: 0.3 });
			if (env.detail && style === 'berry') wash(ctx, x - 0.6, y - 0.7, 0.6, 0.5, '#FDF7E7', d, { layers: 2, alpha: 0.6, edge: 0 });
		}
	}
	return { top: -1.45 * R * sy, r: R * sx };
}

// ─── Arbres ───────────────────────────────────────────────────

function sapling(ctx, g, r, d, lean, tBend, color = '#5F933E') {
	shadow(ctx, 10, 3, d);
	if (g < 0.05) { seedMound(ctx, d); return { top: -6, r: 6 }; }
	const h = 8 + 40 * ((g - 0.05) / 0.15);
	const stem = curve(0, 0, -Math.PI / 2 + lean, h, tBend, 6);
	ribbon(ctx, stem, 2.6, 1.2, '#7A6A3A', d);
	const n = 2 + Math.floor(((g - 0.05) / 0.15) * 4);
	for (let i = 0; i < n; i++) {
		const p = pointAt(stem, 0.4 + (i / n) * 0.6);
		leaf(ctx, p[0], p[1], 9, 3.6, -Math.PI / 2 + (i % 2 ? 0.8 : -0.8), color, d);
	}
	return { top: -h, r: 8 };
}

function paintConifere(ctx, g, r, d, L, lean, env) {
	const meleze = L.form === 'meleze';
	const pal = meleze ? ['#5A8A3A', '#7FA65A', '#A8C070'] : ['#1F4A35', '#2E5E45', '#4A7A55'];
	const tiers = Array.from({ length: 9 }, () => ({ jx: r.gauss() * 0.06, jw: r.range(0.85, 1.15) }));
	const fruits = Array.from({ length: 6 }, () => ({ x: r.gauss() * 0.3, t: r.range(0.3, 0.8) }));
	const look = { ...L, evergreen: !meleze };
	if (g < 0.2) return sapling(ctx, g, r, d, lean, 0, pal[1]);
	const c = ease((g - 0.2) / 0.8);
	const Hc = 50 + 170 * c, W = 26 + 84 * c, T = 12 + 22 * c;
	shadow(ctx, W * 0.6, W * 0.16, d);
	ribbon(ctx, curve(0, 0, -Math.PI / 2 + lean, T + Hc * 0.85, 0, 8), 3 + 6 * c, 1, '#5A3A22', d, 0.95);
	const leafless = bare(look, env);
	tiers.forEach((t, i) => {
		const k = i / tiers.length;
		const y = -T - k * Hc - Hc * 0.06;
		const w = W * (L.round ? Math.sqrt(1 - k * 0.92) : 1 - k * 0.9) * t.jw;
		const x = Math.sin(lean) * (T + k * Hc) + t.jx * W;
		if (meleze || leafless) for (const s of [-1, 1]) ribbon(ctx, curve(x, y, s > 0 ? 0.25 : Math.PI - 0.25, w * 0.55, s * 0.5, 4), 0.9, 0.3, '#6B4A2B', d, 0.6);
		if (leafless) return;
		wash(ctx, x, y, w * 0.55, Hc / tiers.length * 0.75, seasonal(pal[0], look, env, i), d, { layers: meleze ? 7 : 10, alpha: meleze ? 0.1 : 0.13 });
		wash(ctx, x - w * 0.12, y - Hc / tiers.length * 0.2, w * 0.38, Hc / tiers.length * 0.4, seasonal(pal[1], look, env, i + 9), d, { layers: 6, alpha: 0.1, edge: 0.1 });
		if (env.detail) {
			// De près : les aiguilles en petits traits sous chaque étage.
			ctx.strokeStyle = 'rgba(20,50,30,0.35)';
			ctx.lineWidth = 0.4;
			for (let q = -4; q <= 4; q++) {
				ctx.beginPath();
				ctx.moveTo(x + q * w * 0.11, y + 1);
				ctx.lineTo(x + q * w * 0.12, y + Hc / tiers.length * 0.45);
				ctx.stroke();
			}
		}
	});
	if (!leafless) wash(ctx, -W * 0.15, -T - Hc * 0.55, W * 0.15, Hc * 0.25, pal[2], d, { layers: 6, alpha: 0.08, edge: 0 });
	if (g >= 1 && L.fruit) for (const f of fruits) wash(ctx, f.x * W, -T - f.t * Hc, 1.6, 2.6, L.fruit, d, { layers: 4, alpha: 0.4, edge: 0.2 });
	return { top: -T - Hc, r: W * 0.5 };
}

// ─── Feuillages à l'aquarelle ─────────────────────────────────
// Comme on peint un arbre au pinceau, lumière venue d'en haut à gauche : un lavis pâle et chaud sur toute la masse,
// des tons moyens décalés vers le bas, un croissant d'ombre froide sous chaque bouquet, des touches sombres
// entre les bouquets (peinture en négatif), des feuilles nettes sur les bords, puis quelques rehauts clairs.

/**
 * Masse de feuillage faite de bouquets ronds `lobes` ({ x, y, r }). `pal` : [sombre, moyen, clair].
 * `o.midY` : sous cette hauteur, on est dans le dessous ombré ; `o.core` : l'ombre propre sous la masse.
 */
function foliage(ctx, lobes, pal, L, env, d, o = {}) {
	const tone = (c, i) => seasonal(c, L, env, i);
	const warm = mix(pal[2], '#E2D676', 0.4);
	const cool = mix(pal[0], '#22385A', 0.28);
	const deep = mix(cool, '#0E1A1A', 0.35);
	const midY = o.midY ?? 0;
	lobes.forEach((l, i) => wash(ctx, l.x, l.y, l.r * 1.06, l.r * 0.9, tone(warm, i), d, { layers: 6, alpha: 0.14, edge: 0.1, variance: 0.25 }));
	lobes.forEach((l, i) => wash(ctx, l.x + l.r * 0.12, l.y + l.r * 0.16, l.r * 0.84, l.r * 0.7, tone(pal[1], i + 7), d, { layers: 7, alpha: 0.13, edge: 0.16 }));
	lobes.forEach((l, i) => wash(ctx, l.x + l.r * 0.28, l.y + l.r * 0.36, l.r * 0.62, l.r * 0.42, tone(cool, i + 13), d, { layers: 6, alpha: 0.15, edge: 0.08 }));
	if (o.core) wash(ctx, o.core.x, o.core.y, o.core.rx, o.core.ry, tone(deep, 3), d, { layers: 7, alpha: 0.13, edge: 0 });
	// Les creux entre deux bouquets voisins, dans le bas de la masse, restent sombres.
	for (let i = 0; i < lobes.length; i++) for (let j = i + 1; j < lobes.length; j++) {
		const a = lobes[i], b = lobes[j], m = Math.min(a.r, b.r);
		if (Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 0.95 || (a.y + b.y) / 2 < midY) continue;
		wash(ctx, (a.x + b.x) / 2 + d.gauss() * 2, (a.y + b.y) / 2 + m * 0.25, m * 0.3, m * 0.2, tone(deep, i + j), d, { layers: 4, alpha: 0.2, edge: 0 });
	}
	// Bords : des feuilles nettes, claires du côté du soleil, froides dessous.
	const size = o.leaf ?? 6, n = o.detail ? 11 : 7;
	lobes.forEach((l, i) => {
		for (let q = 0; q < n; q++) {
			const a = Math.PI * 0.85 + (q / (n - 1)) * Math.PI * 1.25 + d.gauss() * 0.12;
			const lit = Math.cos(a - 3.93);
			leaf(ctx, l.x + Math.cos(a) * l.r * 0.92, l.y + Math.sin(a) * l.r * 0.78, size * d.range(0.8, 1.2), size * 0.42, a + d.gauss() * 0.5, tone(lit > 0.3 ? warm : pal[1], i * 11 + q), d, 0.6);
		}
		for (let q = 0; q < 3; q++) {
			const a = Math.PI * 0.15 + q * 0.35 + d.gauss() * 0.1;
			leaf(ctx, l.x + Math.cos(a) * l.r * 0.85, l.y + Math.sin(a) * l.r * 0.7, size * 0.9, size * 0.4, a, tone(cool, i * 5 + q), d, 0.5);
		}
	});
	if (o.detail) {
		for (let i = 0; i < lobes.length * 5; i++) {
			const l = lobes[i % lobes.length], a = d() * 6.28, k = Math.sqrt(d());
			const x = l.x + Math.cos(a) * l.r * 0.75 * k, y = l.y + Math.sin(a) * l.r * 0.6 * k;
			const lit = (l.x - x) + (l.y - y) > 0 ? warm : y > midY ? cool : pal[1];
			leaf(ctx, x, y, size * 0.8, size * 0.36, d() * 6.28, tone(lit, i + 60), d, 0.45);
		}
	}
	lobes.filter(l => l.y < midY).forEach((l, i) => wash(ctx, l.x - l.r * 0.3, l.y - l.r * 0.32, l.r * 0.3, l.r * 0.2, tone(mix(warm, '#FFF6C8', 0.35), i + 40), d, { layers: 4, alpha: 0.12, edge: 0 }));
}

/** Bouquets d'une couronne ovale : une couronne de bouquets autour, deux ou trois au cœur, le bas un peu aplati. */
function crownLobes(r, cx, cy, rx, ry, n, size = 0.42) {
	const lobes = [];
	const off = r() * 6.28;
	for (let i = 0; i < n; i++) {
		const a = off + (i / n) * Math.PI * 2 + r.gauss() * 0.15;
		const low = Math.sin(a) > 0;
		lobes.push({ x: cx + Math.cos(a) * rx * 0.62, y: cy + Math.sin(a) * ry * (low ? 0.45 : 0.62), r: rx * size * r.range(0.85, 1.12) * (low ? 0.9 : 1) });
	}
	for (let i = 0; i < Math.max(2, Math.round(n / 3)); i++) lobes.push({ x: cx + r.gauss() * rx * 0.2, y: cy - ry * 0.15 + r.gauss() * ry * 0.15, r: rx * size * r.range(0.9, 1.1) });
	return lobes.sort((a, b) => a.y - b.y);
}

/** Tronc effilé, évasé au pied, ombré du côté opposé au soleil. Renvoie les points de son axe. */
function trunkPaint(ctx, d, len, wb, wt, lean, bend, birch, detail) {
	const spine = curve(0, 0, -Math.PI / 2 + lean, len, bend, 12);
	const width = t => (wb + (wt - wb) * t) * (t < 0.12 ? 1 + ((0.12 - t) / 0.12) * 0.75 : 1);
	const left = [], right = [];
	spine.forEach((p, i) => {
		const t = i / (spine.length - 1), q = spine[Math.min(i + 1, spine.length - 1)], pr = spine[Math.max(i - 1, 0)];
		const ang = Math.atan2(q[1] - pr[1], q[0] - pr[0]) + Math.PI / 2, w = width(t) / 2;
		left.push([p[0] - Math.cos(ang) * w, p[1] - Math.sin(ang) * w]);
		right.push([p[0] + Math.cos(ang) * w, p[1] + Math.sin(ang) * w]);
	});
	const bark = birch ? '#EEE9DC' : '#8A6040', dark = birch ? '#A8A090' : '#4A3020', lite = birch ? '#FFFFFF' : '#B88E62';
	const poly = (pts, color, a) => {
		ctx.fillStyle = rgba(color, a);
		ctx.beginPath();
		pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.fill();
	};
	poly([...left, ...right.slice().reverse()], bark, 0.96);
	// Côté ombre (le soleil vient de gauche), puis un rehaut clair du côté éclairé.
	poly([...spine.map((p, i) => [p[0] + (right[i][0] - p[0]) * 0.1, p[1]]), ...right.slice().reverse()], dark, birch ? 0.45 : 0.5);
	ribbon(ctx, left.map((p, i) => [p[0] * 0.75 + spine[i][0] * 0.25, p[1]]), Math.max(1, wb * 0.16), 0.6, lite, d, birch ? 0.6 : 0.35);
	// Racines : deux bosses au pied, dans l'herbe.
	for (const s of [-1, 1]) wash(ctx, s * wb * 0.7, -1, wb * 0.45, wb * 0.18, dark, d, { layers: 4, alpha: 0.25, edge: 0 });
	if (birch) {
		for (let i = 0; i < 12; i++) {
			const t = d.range(0.05, 0.85), p = pointAt(spine, t), w = width(t);
			wash(ctx, p[0] + d.range(-0.2, 0.25) * w, p[1], w * d.range(0.15, 0.4), 0.9, '#2A2420', d, { layers: 3, alpha: 0.55, edge: 0 });
		}
	} else if (detail) {
		for (let i = 0; i < 8; i++) {
			const x0 = d.range(-0.3, 0.3), t0 = d.range(0, 0.6);
			ribbon(ctx, spine.slice(Math.floor(t0 * 12), Math.floor(t0 * 12) + 4).map((p, k) => [p[0] + x0 * width(t0 + k / 12), p[1]]), 0.8, 0.3, '#3A2414', d, 0.45);
		}
	}
	return spine;
}

/** Branches nues, qui se divisent jusqu'aux rameaux (l'hiver). */
function twigs(ctx, x, y, ang, len, w, depth, d, col) {
	const pts = curve(x, y, ang, len, d.gauss() * 0.25, 4);
	ribbon(ctx, pts, w, Math.max(0.4, w * 0.6), col, d, 0.85);
	if (depth <= 0) return;
	const [ex, ey] = pts[pts.length - 1];
	const n = 2 + (d() < 0.4 ? 1 : 0);
	for (let k = 0; k < n; k++) twigs(ctx, ex, ey, ang + (k - (n - 1) / 2) * 0.55 + d.gauss() * 0.15, len * 0.68, w * 0.62, depth - 1, d, col);
}

const CROWNS = {
	feuillu: { h: 1, rx: 0.42, ry: 0.32, fork: 0.55, n: 7, lobe: 0.42 },
	bouleau: { h: 1.08, rx: 0.3, ry: 0.36, fork: 0.75, n: 8, lobe: 0.42 },
	saule: { h: 0.85, rx: 0.48, ry: 0.28, fork: 0.5, n: 7, lobe: 0.42 },
	colonne: { h: 1.1, rx: 0.17, ry: 0.42, fork: 0.85, n: 7, lobe: 0.62 },
	parasol: { h: 1.08, rx: 0.42, ry: 0.13, fork: 0.2, n: 8, lobe: 0.3 },
};
const CROWN_PAL = {
	bouleau: ['#4E7A3A', '#7AA04E', '#B4CC72'],
	saule: ['#4E7A3A', '#7AA04E', '#B8CC78'],
	parasol: ['#1E3A2A', '#2E5238', '#5A7A4E'],
	feuillu: ['#1E5030', '#3A7438', '#7FA848'],
};

/** Feuillus : chêne, tilleul, hêtre, bouleau, saule pleureur, peuplier, pin parasol… */
function paintBroadleaf(ctx, g, r, d, seed, L, env, form, lean) {
	const k = ease((g - 0.2) / 0.8);
	const leafless = bare(L, env);
	const pal = L.canopy ?? CROWN_PAL[form] ?? CROWN_PAL.feuillu;
	const shape = CROWNS[form] ?? CROWNS.feuillu;
	const H = Math.min(280, (70 + 190 * k) * shape.h);
	const rx = H * shape.rx * (form === 'feuillu' ? (L.spread ?? 1) : 1), ry = H * shape.ry;
	const crownY = -H + ry;
	const wb = (4 + 16 * k) * (form === 'bouleau' ? 0.65 : form === 'saule' ? 1.2 : 1);
	const forkY = crownY + ry * shape.fork;
	const bend = r.gauss() * 0.12 + (form === 'parasol' ? 0.25 * Math.sign(r.gauss()) : 0);
	const spine = trunkPaint(ctx, d, -forkY, wb, wb * 0.5, lean, bend, form === 'bouleau', env.detail);
	const [fx, fy] = spine[spine.length - 1];
	const lobes = crownLobes(r, fx, crownY, rx, ry, shape.n, shape.lobe);
	const limb = form === 'bouleau' ? '#5A4A3A' : '#5A3A22';
	// Charpentières : du haut du tronc vers les bouquets du bas et des côtés (le feuillage les recouvre en partie).
	const limbs = lobes.filter(l => l.y > crownY - ry * 0.3).slice(0, 4);
	for (const l of limbs) ribbon(ctx, [[fx, fy + 4], [(fx + l.x) / 2, (fy + l.y) / 2 + 4], [l.x, l.y]], wb * 0.45, 1.2, limb, d, 0.9);
	if (g <= 0.3 || leafless) {
		if (leafless) for (const l of lobes.slice(0, 5)) twigs(ctx, fx, fy, Math.atan2(l.y - fy, l.x - fx), Math.hypot(l.x - fx, l.y - fy) * 0.55, wb * 0.4, 3, d, limb);
		return { top: crownY - ry, r: rx };
	}
	foliage(ctx, lobes, pal, L, env, d, {
		midY: crownY + ry * 0.1, leaf: 4 + H * 0.022, detail: env.detail,
		core: { x: fx + rx * 0.1, y: crownY + ry * 0.55, rx: rx * 0.7, ry: ry * 0.32 },
	});
	if (form === 'saule') {
		// Rideaux de branches qui pendent presque jusqu'au sol, feuilles fines le long de chacune.
		const dd = rng(seed ^ 0x5a1e);
		for (let i = 0; i < 26; i++) {
			const t = i / 25, x0 = fx + (t - 0.5) * rx * 2.1 + dd.gauss() * 4;
			const y0 = crownY + ry * (0.2 + Math.abs(t - 0.5) * 0.6) + dd.gauss() * 3;
			const pts = curve(x0, y0, Math.PI / 2 + (t - 0.5) * 0.25, -y0 * dd.range(0.5, 0.78), (t - 0.5) * -0.2, 7);
			const col = seasonal(dd.pick([pal[1], pal[2], mix(pal[2], '#E2D676', 0.3)]), L, env, i);
			// Un rideau : une coulée de vert le long de la branche, puis des feuilles qui en débordent.
			for (let q = 1; q < pts.length; q++) wash(ctx, pts[q][0], pts[q][1], 3.2 - q * 0.25, 5, col, dd, { layers: 3, alpha: 0.16, edge: 0 });
			for (let q = 1; q < pts.length; q++) leaf(ctx, pts[q][0] + (q % 2 ? 2 : -2), pts[q][1], 9, 2.6, Math.PI / 2 + (q % 2 ? -0.5 : 0.5), seasonal(dd.pick([pal[1], pal[2]]), L, env, i * 9 + q), dd, 0.6);
		}
	}
	const inLobe = q => { const l = lobes[Math.floor(q() * lobes.length)]; return [l.x + q.gauss() * l.r * 0.4, l.y + q.gauss() * l.r * 0.3]; };
	if (blooming(L, env)) {
		const dd = rng(seed ^ 0x2121);
		for (let i = 0; i < 30; i++) { const [x, y] = inLobe(dd); wash(ctx, x, y, 2, 1.8, L.blossom, dd, { layers: 3, alpha: 0.5 * env.season.spring, edge: 0.1 }); }
	} else if (g >= 1 && L.fruit) {
		const dd = rng(seed ^ 0x3131);
		for (let i = 0; i < 10; i++) { const [x, y] = inLobe(dd); wash(ctx, x, y, 2, 2, L.fruit, dd, { layers: 4, alpha: 0.42, edge: 0.25 }); }
	}
	return { top: crownY - ry * 1.05, r: rx };
}

function paintArbre(ctx, g, seed, L, env = {}) {
	const r = rng(seed);
	const form = L.form ?? 'feuillu';
	const lean = r.gauss() * 0.05, tBend = r.gauss() * 0.1;
	const d = rng(seed ^ 0x7a11);
	if (form === 'conifere' || form === 'meleze') return paintConifere(ctx, g, r, d, L, lean, env);
	if (g < 0.2) return sapling(ctx, g, r, d, lean, tBend);
	return paintBroadleaf(ctx, g, r, d, seed, L, env, form, lean);
}

/**
 * Une fleur des champs pousse en touffe : plusieurs tiges d'âges différents, serrées autour de la première.
 * Les petites fleurs (pâquerettes, violettes…) forment des touffes plus fournies.
 */
function paintFleur(ctx, g, seed, L, env = {}) {
	const r = rng(seed ^ 0x40f1);
	const small = (L.h?.[1] ?? 60) < 40;
	const n = g < 0.35 ? 1 : (small ? 4 : 2) + Math.floor(r() * (small ? 3 : 2)) - (g < 0.7 ? 1 : 0);
	const stems = Array.from({ length: n - 1 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * r.range(5, small ? 14 : 16), y: r.range(-2, 3), k: r.range(0.72, 0.92), g: Math.min(1, g * r.range(0.75, 1)) }));
	stems.sort((a, b) => a.y - b.y);
	for (const [i, st] of stems.entries()) {
		ctx.save();
		ctx.translate(st.x, st.y);
		ctx.scale(st.k, st.k);
		paintFleurOne(ctx, st.g, seed + (i + 1) * 7919, L, env);
		ctx.restore();
	}
	return paintFleurOne(ctx, g, seed, L, env);
}

const PAINTERS = { herbe: paintHerbe, fleur: paintFleur, buisson: paintBuisson, arbre: paintArbre };

export function lookOf(p) {
	return SPECIES_BY_ID[speciesOf(p)]?.look ?? {};
}

/**
 * Dessine la plante dans un contexte déjà placé sur son pied. `env` : { detail, season } — de près on ajoute
 * des détails, et la saison colore ou dénude le feuillage. Renvoie { top, r } (hauteur et rayon au sol, unités monde).
 */
export function paintPlant(ctx, p, growth = p.growth, env = {}) {
	return PAINTERS[p.type](ctx, growth, p.seed, lookOf(p), env);
}

// ─── Décor de chaque lieu (souvent débloqué au fil des kilomètres) ──────

export const DECOR = {
	pond: { place: 'prairie', name: 'La mare', km: 3, x: 115, y: 860, rad: 115, water: true, box: { w: 250, h: 160, ax: 125, ay: 90 } },
	murger: { place: 'prairie', name: 'Le muret de pierres', km: 6, x: 370, y: 790, rad: 44, box: { w: 120, h: 70, ax: 60, ay: 52 } },
	log: { place: 'prairie', name: 'Le vieux tronc', km: 10, x: 320, y: 920, rad: 70, box: { w: 160, h: 90, ax: 80, ay: 62 } },
	bigpond: { place: 'marais', name: 'La grande mare', always: true, x: 210, y: 560, rad: 175, water: true, scale: 1.65, box: { w: 420, h: 270, ax: 210, ay: 150 } },
	nenuphars: { place: 'marais', name: 'Les nénuphars', km: 2, x: 210, y: 561, rad: 0, box: { w: 420, h: 270, ax: 210, ay: 150 } },
	roseliere: { place: 'marais', name: 'La roselière', km: 5, x: 80, y: 840, rad: 75, box: { w: 180, h: 130, ax: 90, ay: 108 } },
	mushrooms: { place: 'foret', name: 'Les amanites', km: 3, x: 330, y: 760, rad: 32, box: { w: 80, h: 70, ax: 40, ay: 60 } },
	litiere: { place: 'foret', name: 'Le tapis de feuilles', km: 6, x: 110, y: 880, rad: 60, box: { w: 160, h: 80, ax: 80, ay: 50 } },
	souche: { place: 'foret', name: 'La vieille souche', km: 9, x: 300, y: 930, rad: 45, box: { w: 120, h: 100, ax: 60, ay: 72 } },
	eboulis: { place: 'montagne', name: "L'éboulis", km: 3, x: 330, y: 820, rad: 80, box: { w: 210, h: 130, ax: 105, ay: 88 } },
	neve: { place: 'montagne', name: 'Le névé', km: 6, x: 100, y: 300, rad: 90, box: { w: 230, h: 120, ax: 115, ay: 64 } },
	laisse: { place: 'littoral', name: 'La laisse de mer', km: 3, x: 210, y: 215, rad: 0, box: { w: 430, h: 70, ax: 215, ay: 40 } },
	ganivelles: { place: 'littoral', name: 'Les ganivelles', km: 6, x: 210, y: 640, rad: 30, box: { w: 320, h: 80, ax: 160, ay: 62 } },
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

function paintBigPond(ctx) {
	ctx.save();
	ctx.scale(1.65, 1.65);
	paintPond(ctx);
	ctx.restore();
	return { top: -100 };
}

function paintNenuphars(ctx) {
	const d = rng(9090);
	for (const [x, y, s, fl] of [[-80, -20, 1.2, 1], [-40, 30, 1, 0], [30, -40, 1.1, 1], [70, 20, 0.9, 0], [10, 10, 1.3, 1], [-110, 20, 0.8, 0], [110, -10, 1, 1]]) {
		wash(ctx, x, y, 14 * s, 8 * s, '#5F8A42', d, { layers: 9, alpha: 0.2, edge: 0.3 });
		ctx.fillStyle = 'rgba(91,181,176,0.9)';
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + 14 * s, y - 2 * s);
		ctx.lineTo(x + 12 * s, y + 3 * s);
		ctx.fill();
		if (fl) {
			for (let k = 0; k < 8; k++) leaf(ctx, x - 2, y - 3, 7 * s, 2.6 * s, -Math.PI / 2 + (k - 3.5) * 0.4, '#FDFBF3', d, 0.95);
			wash(ctx, x - 2, y - 4, 2.2, 1.8, '#F4C23E', d, { layers: 4, alpha: 0.4 });
		}
	}
	return { top: -40 };
}

function paintRoseliere(ctx) {
	const d = rng(5151);
	wash(ctx, 0, 0, 80, 16, '#6E8A4A', d, { layers: 8, alpha: 0.1, edge: 0 });
	for (let i = 0; i < 46; i++) {
		const x = d.gauss() * 32, len = d.range(55, 100);
		const pts = curve(x, d.range(-8, 8), -Math.PI / 2 + d.gauss() * 0.08, len, d.gauss() * 0.2, 7);
		ribbon(ctx, pts, 1.6, 0.6, d.pick(['#8A9A5A', '#A8A870', '#7A8A4A']), d, 0.85);
		if (i % 2) leaf(ctx, ...pointAt(pts, 0.5), 18, 2, -Math.PI / 2 + (i % 4 ? 0.9 : -0.9), '#8AA05A', d, 0.7);
		if (i % 3 === 0) { const p = pts[pts.length - 1]; wash(ctx, p[0] + 2, p[1] + 4, 2.5, 8, '#9A7A5A', d, { layers: 5, alpha: 0.3, edge: 0.15 }); }
	}
	return { top: -100 };
}

function paintMurger(ctx) {
	const d = rng(2468);
	wash(ctx, 4, 2, 54, 10, '#2E4A22', d, { layers: 5, alpha: 0.06, edge: 0 });
	for (const [x, y, rx, ry] of [[-34, -8, 16, 10], [-12, -6, 18, 11], [12, -8, 17, 10], [34, -6, 14, 9], [-22, -24, 15, 9], [2, -26, 17, 10], [24, -22, 13, 9], [-8, -40, 14, 8], [14, -40, 11, 7]]) {
		wash(ctx, x, y, rx, ry, d.pick(['#A8A498', '#C0BCB0', '#8A867A', '#B4AC98']), d, { layers: 10, alpha: 0.16, edge: 0.45 });
	}
	for (const [x, y] of [[-30, -16], [20, -32], [-4, -48]]) wash(ctx, x, y, 6, 2.5, '#7FAA48', d, { layers: 4, alpha: 0.25, edge: 0 });
	return { top: -46 };
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

function paintLitiere(ctx) {
	const d = rng(3131);
	wash(ctx, 0, 0, 70, 22, '#8A6A3A', d, { layers: 8, alpha: 0.1, edge: 0 });
	for (let i = 0; i < 70; i++) {
		const a = d() * Math.PI * 2, rr = Math.sqrt(d());
		leaf(ctx, Math.cos(a) * rr * 66, Math.sin(a) * rr * 20 - 4, d.range(6, 10), d.range(2.5, 4), d() * Math.PI * 2, d.pick(['#A8783A', '#C8903A', '#8A5A2A', '#B8A050', '#9A4A2A']), d, 0.8);
	}
	for (let i = 0; i < 4; i++) ribbon(ctx, curve(d.range(-50, 30), d.range(-10, 8), d.gauss() * 0.4, d.range(20, 36), d.gauss() * 0.3, 4), 1.6, 0.8, '#6B4A2B', d, 0.8);
	return { top: -24 };
}

function paintSouche(ctx) {
	const d = rng(8282);
	wash(ctx, 6, 2, 40, 9, '#2E4A22', d, { layers: 5, alpha: 0.07, edge: 0 });
	for (const s of [-1, 1, -0.4, 0.5]) ribbon(ctx, curve(s * 14, -4, s > 0 ? 0.3 : Math.PI - 0.3, 18, s * 0.4, 4), 7, 1, '#6B4A2B', d);
	wash(ctx, 0, -20, 26, 22, '#7A5130', d, { layers: 14, alpha: 0.13 });
	wash(ctx, 0, -40, 24, 8, '#C8A070', d, { layers: 10, alpha: 0.16, edge: 0.35 });
	ctx.strokeStyle = 'rgba(122,81,48,0.5)';
	ctx.lineWidth = 0.6;
	for (const k of [0.35, 0.6, 0.85]) { ctx.beginPath(); ctx.ellipse(0, -40, 22 * k, 7 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
	for (const [x, y] of [[-18, -30], [16, -16]]) wash(ctx, x, y, 8, 5, '#6E9A48', d, { layers: 5, alpha: 0.25, edge: 0 });
	for (const [x, y] of [[20, -28], [22, -22]]) wash(ctx, x, y, 7, 2.6, '#E3A33A', d, { layers: 6, alpha: 0.3, edge: 0.3 });
	return { top: -48 };
}

function paintEboulis(ctx) {
	const d = rng(6464);
	wash(ctx, 0, 0, 96, 22, '#8A8A80', d, { layers: 8, alpha: 0.08, edge: 0 });
	for (let i = 0; i < 26; i++) {
		const x = d.gauss() * 42, y = -Math.abs(d.gauss()) * 26 - 4, s = d.range(5, 15);
		wash(ctx, x, y, s, s * 0.65, d.pick(['#A8A498', '#BCB8AC', '#8E8A80', '#C8C4B8']), d, { layers: 8, alpha: 0.18, edge: 0.45 });
	}
	return { top: -70 };
}

function paintNeve(ctx) {
	const d = rng(7171);
	wash(ctx, 0, 0, 104, 44, '#E8EEF2', d, { layers: 14, alpha: 0.14, edge: 0.15 });
	wash(ctx, -12, -6, 70, 26, '#FAFCFC', d, { layers: 10, alpha: 0.15, edge: 0 });
	wash(ctx, 36, 14, 26, 10, '#B8C4CC', d, { layers: 6, alpha: 0.12, edge: 0 });
	return { top: -40 };
}

function paintLaisse(ctx) {
	const d = rng(5353);
	for (let i = 0; i < 26; i++) {
		const x = -200 + i * 16 + d.gauss() * 5;
		ribbon(ctx, curve(x, d.gauss() * 4, d.gauss() * 0.6, d.range(12, 24), d.gauss() * 1.2, 5), 2.6, 0.8, d.pick(['#4A5A2A', '#5A4A2A', '#3A4A30']), d, 0.8);
	}
	for (const [x, y, l, a] of [[-120, -4, 40, 0.1], [60, 2, 52, -0.08], [150, -2, 30, 0.2]]) ribbon(ctx, curve(x, y, a, l, 0.1, 5), 4.5, 3, '#C8B8A0', d, 0.95);
	for (let i = 0; i < 14; i++) wash(ctx, d.range(-190, 190), d.gauss() * 6, 1.8, 1.4, '#FDFBF3', d, { layers: 3, alpha: 0.5, edge: 0.3 });
	return { top: -14 };
}

function paintGanivelles(ctx) {
	const d = rng(4747);
	wash(ctx, 0, 4, 150, 14, '#E8D8B0', d, { layers: 8, alpha: 0.14, edge: 0 });
	const xs = [];
	for (let x = -140; x <= 140; x += 6) xs.push(x);
	for (const x of xs) {
		const y = Math.sin(x * 0.012) * 8;
		ribbon(ctx, [[x, y], [x + d.gauss() * 0.4, y - 16], [x + d.gauss() * 0.6, y - 30 - d.range(0, 4)]], 2.2, 1.6, d.pick(['#9A7A5A', '#8A6A4A', '#A88A68']), d, 0.95);
	}
	ctx.strokeStyle = 'rgba(80,70,60,0.6)';
	ctx.lineWidth = 0.6;
	for (const h of [-8, -22]) {
		ctx.beginPath();
		xs.forEach((x, i) => { const y = Math.sin(x * 0.012) * 8 + h; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
		ctx.stroke();
	}
	return { top: -34 };
}

export const DECOR_PAINTERS = {
	pond: paintPond, bigpond: paintBigPond, nenuphars: paintNenuphars, roseliere: paintRoseliere, murger: paintMurger, log: paintLog,
	mushrooms: paintMushrooms, litiere: paintLitiere, souche: paintSouche, eboulis: paintEboulis, neve: paintNeve,
	laisse: paintLaisse, ganivelles: paintGanivelles,
};

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
