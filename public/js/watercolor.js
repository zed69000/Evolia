// Primitives de peinture aquarelle : hasard déterministe, lavis, rubans, feuilles et grain de papier.
// Tout est dessiné en unités « monde » : l'appelant met le contexte à l'échelle avant.

export function rng(seed) {
	let s = seed >>> 0;
	const r = () => {
		s = (s + 0x6D2B79F5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	r.range = (a, b) => a + (b - a) * r();
	r.gauss = () => {
		let u = 0, v = 0;
		while (!u) u = r();
		while (!v) v = r();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	};
	r.pick = arr => arr[Math.floor(r() * arr.length)];
	return r;
}

export const clamp01 = x => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = x => 1 - Math.pow(1 - clamp01(x), 2.2);

export function hexRgb(hex) {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
	const [r, g, b] = hexRgb(hex);
	return `rgba(${r},${g},${b},${a})`;
}

export function mix(h1, h2, t) {
	const a = hexRgb(h1), b = hexRgb(h2);
	return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function tracePts(ctx, pts) {
	ctx.beginPath();
	ctx.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
	ctx.closePath();
}

// Subdivise chaque arête et décale le milieu : c'est ce qui donne le bord irrégulier d'un lavis.
function deform(pts, depth, variance, r) {
	for (let d = 0; d < depth; d++) {
		const out = [];
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i], q = pts[(i + 1) % pts.length];
			const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
			out.push(p, [(p[0] + q[0]) / 2 + r.gauss() * len * variance, (p[1] + q[1]) / 2 + r.gauss() * len * variance]);
		}
		pts = out;
	}
	return pts;
}

function blobPts(cx, cy, rx, ry, sides, r) {
	const pts = [];
	const off = r() * Math.PI * 2;
	for (let i = 0; i < sides; i++) {
		const a = off + (i / sides) * Math.PI * 2;
		const k = 0.85 + r() * 0.3;
		pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
	}
	return pts;
}

/** Tache de couleur : plusieurs couches translucides déformées, plus un bord légèrement plus foncé. */
export function wash(ctx, cx, cy, rx, ry, color, r, o = {}) {
	const layers = o.layers ?? 12;
	const alpha = o.alpha ?? 0.08;
	const v = o.variance ?? 0.2;
	const base = deform(blobPts(cx, cy, rx, ry, o.sides ?? 8, r), 2, v, r);
	ctx.fillStyle = rgba(color, alpha);
	for (let i = 0; i < layers; i++) {
		tracePts(ctx, deform(base, 2, v, r));
		ctx.fill();
	}
	const edge = o.edge ?? 0.2;
	if (edge > 0) {
		ctx.strokeStyle = rgba(mix(color, '#1a2810', 0.4), edge);
		ctx.lineWidth = o.edgeWidth ?? Math.max(0.35, Math.min(rx, ry) * 0.05);
		ctx.lineJoin = 'round';
		tracePts(ctx, deform(base, 1, v * 0.5, r));
		ctx.stroke();
	}
}

/** Polyligne qui part de (x, y) dans la direction `angle` en tournant de `bend` radians au total. */
export function curve(x, y, angle, length, bend, segs = 8) {
	const pts = [[x, y]];
	const step = length / segs;
	for (let i = 0; i < segs; i++) {
		angle += bend / segs;
		x += Math.cos(angle) * step;
		y += Math.sin(angle) * step;
		pts.push([x, y]);
	}
	return pts;
}

export function pointAt(pts, t) {
	const f = clamp01(t) * (pts.length - 1);
	const i = Math.min(pts.length - 2, Math.floor(f));
	const k = f - i;
	return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
}

/** Trait effilé (tige, branche, brin d'herbe) peint en deux passes. */
export function ribbon(ctx, pts, w0, w1, color, r, alpha = 0.85) {
	const L = [], R = [];
	for (let i = 0; i < pts.length; i++) {
		const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
		let tx = b[0] - a[0], ty = b[1] - a[1];
		const len = Math.hypot(tx, ty) || 1;
		tx /= len; ty /= len;
		const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
		L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
		R.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
	}
	const shape = L.concat(R.reverse());
	ctx.fillStyle = rgba(color, alpha * 0.55);
	tracePts(ctx, shape);
	ctx.fill();
	tracePts(ctx, deform(shape, 1, 0.05, r));
	ctx.fill();
	ctx.strokeStyle = rgba(mix(color, '#1a1208', 0.45), alpha * 0.3);
	ctx.lineWidth = Math.max(0.3, w0 * 0.12);
	tracePts(ctx, shape);
	ctx.stroke();
}

/** Feuille en amande, de la base (x, y) vers `ang`. */
export function leaf(ctx, x, y, len, w, ang, color, r, alpha = 0.8) {
	if (len <= 0.2) return;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(ang);
	const j = () => r.gauss() * w * 0.12;
	ctx.fillStyle = rgba(color, alpha * 0.45);
	for (let i = 0; i < 2; i++) {
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.quadraticCurveTo(len * 0.4 + j(), -w + j(), len + j(), j());
		ctx.quadraticCurveTo(len * 0.5 + j(), w * 0.9 + j(), 0, 0);
		ctx.fill();
	}
	ctx.strokeStyle = rgba(mix(color, '#14240c', 0.45), alpha * 0.35);
	ctx.lineWidth = Math.max(0.3, w * 0.1);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(len * 0.4, -w, len, 0);
	ctx.quadraticCurveTo(len * 0.5, w * 0.9, 0, 0);
	ctx.stroke();
	ctx.globalAlpha = 0.6;
	ctx.beginPath();
	ctx.moveTo(len * 0.1, 0);
	ctx.lineTo(len * 0.75, 0);
	ctx.stroke();
	ctx.globalAlpha = 1;
	ctx.restore();
}

/** Tuile de grain de papier, posée en motif par-dessus toute la scène. */
export function paperTexture(size = 256, seed = 7) {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const g = c.getContext('2d');
	const r = rng(seed);
	for (let i = 0; i < size * size * 0.08; i++) {
		const dark = r() < 0.6;
		g.fillStyle = dark ? `rgba(90,70,40,${r.range(0.02, 0.07)})` : `rgba(255,252,240,${r.range(0.05, 0.14)})`;
		g.fillRect(r() * size, r() * size, r.range(0.6, 1.8), r.range(0.6, 1.8));
	}
	g.strokeStyle = 'rgba(120,100,60,0.05)';
	g.lineWidth = 0.6;
	for (let i = 0; i < 70; i++) {
		const x = r() * size, y = r() * size, a = r() * Math.PI * 2, l = r.range(4, 14);
		g.beginPath();
		g.moveTo(x, y);
		g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
		g.stroke();
	}
	return c;
}
