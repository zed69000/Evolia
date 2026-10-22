// Petites bêtes du jardin, dessinées à chaque image (elles bougent) autour de (0, 0), en unités monde.
// `t` anime ailes et pattes ; `mode` vaut 'perch' quand l'animal est posé ; `p` porte les couleurs de l'espèce.

const ell = (ctx, x, y, rx, ry, rot = 0) => {
	ctx.beginPath();
	ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
	ctx.fill();
};
const line = (ctx, pts, w, color) => {
	ctx.strokeStyle = color;
	ctx.lineWidth = w;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(pts[0][0], pts[0][1]);
	for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
	ctx.stroke();
};

const DRAW = {
	bee(ctx, t, mode, p) {
		const flap = Math.abs(Math.sin(t * 38));
		const k = p.bumble ? 1.35 : 1;
		ctx.fillStyle = 'rgba(253,247,231,0.75)';
		ell(ctx, -1, -4 * k, 3.2 * k, 4.5 * flap + 0.8);
		ell(ctx, 2, -4 * k, 2.6 * k, 3.8 * flap + 0.6);
		if (p.bumble) {
			ctx.fillStyle = '#2A2420'; ell(ctx, 0, 0, 7.5, 5.6);
			ctx.fillStyle = '#F2C230'; ell(ctx, 1.5, -1, 2.2, 5.2);
			ctx.fillStyle = '#F4F0E8'; ell(ctx, -6, 0, 2, 3.8);
			ctx.fillStyle = '#2A2420'; ell(ctx, 6.8, -0.4, 2.6, 2.6);
			return;
		}
		ctx.fillStyle = '#E3A33A';
		ell(ctx, 0, 0, 6, 4.2);
		ctx.fillStyle = 'rgba(58,42,32,0.85)';
		ell(ctx, -1.6, 0, 1.1, 3.9);
		ell(ctx, 1.4, 0, 1.1, 4);
		ell(ctx, 5.4, -0.4, 2.2, 2.2);
	},

	butterfly(ctx, t, mode, p) {
		const flap = mode === 'perch' ? 0.35 + 0.25 * Math.abs(Math.cos(t * 3)) : 0.2 + 0.8 * Math.abs(Math.cos(t * 12));
		const k = p.small ? 0.7 : 1;
		ctx.save();
		ctx.scale(flap * k, k);
		ctx.fillStyle = p.w1 ?? '#F08A3C';
		ctx.globalAlpha = 0.92;
		ell(ctx, -4.5, -3, 4.6, 4);
		ell(ctx, 4.5, -3, 4.6, 4);
		ctx.fillStyle = p.w2 ?? '#F4C23E';
		ell(ctx, -3.2, 2.2, 2.8, 2.6);
		ell(ctx, 3.2, 2.2, 2.8, 2.6);
		ctx.globalAlpha = 0.8;
		ctx.fillStyle = p.spot ?? '#3A2A20';
		ell(ctx, -5.5, -4, 1.1, 1);
		ell(ctx, 5.5, -4, 1.1, 1);
		ctx.restore();
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#3A2A20';
		ell(ctx, 0, 0, 0.9, 4.2 * k);
	},

	dragonfly(ctx, t, mode, p) {
		const flap = Math.abs(Math.sin(t * 30));
		ctx.fillStyle = p.wing ?? 'rgba(225,242,246,0.6)';
		const w = p.slim ? 0.75 : 1;
		ell(ctx, -1, -2, 7 * w, 1.6 * flap + 0.5, -0.25);
		ell(ctx, -1, 2, 7 * w, 1.6 * flap + 0.5, 0.25);
		ell(ctx, 2, -2, 6 * w, 1.4 * flap + 0.5, 0.25);
		ell(ctx, 2, 2, 6 * w, 1.4 * flap + 0.5, -0.25);
		ctx.fillStyle = p.body ?? '#C8402A';
		ell(ctx, -3, 0, 9, p.slim ? 0.8 : 1.1);
		ell(ctx, 6, 0, 1.8, 1.8);
	},

	ladybug(ctx) {
		ctx.fillStyle = '#2A1E18';
		ell(ctx, 2.8, 0, 1.6, 1.5);
		ctx.fillStyle = '#D23A2A';
		ell(ctx, 0, 0, 3.2, 2.7);
		ctx.fillStyle = '#2A1E18';
		ctx.fillRect(-3.2, -0.2, 6.2, 0.4);
		for (const [x, y] of [[-1.4, -1.3], [-1.4, 1.3], [0.6, -1.5], [0.6, 1.5], [1.9, 0], [-2.4, 0]]) ell(ctx, x, y, 0.55, 0.55);
	},

	beetle(ctx, t) {
		ctx.fillStyle = '#3A2418';
		for (const s of [-1, 1]) for (const x of [-3, 0, 3]) line(ctx, [[x, 0], [x + s * 0.5, s * 5]], 0.6, '#2A1A10');
		ell(ctx, -1.5, 0, 6, 3.6);
		ctx.fillStyle = '#5A3A24';
		ell(ctx, -2, -0.6, 4.6, 1.4);
		ctx.fillStyle = '#2A1A10';
		ell(ctx, 5, 0, 2.4, 2.2);
		const open = 0.15 * Math.sin(t * 2);
		for (const s of [-1, 1]) line(ctx, [[6.5, s * 1], [10, s * (2.6 + open)], [12, s * (1.2 + open)]], 1.1, '#6B3A20');
	},

	frog(ctx, t) {
		const puff = 1 + 0.08 * Math.max(0, Math.sin(t * 2.4));
		ctx.fillStyle = '#8A5A2E';
		ell(ctx, -5, 3, 4, 2.2, 0.3);
		ell(ctx, 5, 3, 4, 2.2, -0.3);
		ctx.fillStyle = '#B9783E';
		ell(ctx, 0, 0, 7, 5.5 * puff);
		ctx.fillStyle = '#E8C49A';
		ell(ctx, 0, 2.5, 4, 2.2 * puff);
		ctx.fillStyle = '#6B3E1E';
		ell(ctx, -2, -1, 1.2, 0.8);
		ell(ctx, 2.6, 0.5, 1, 0.7);
		ctx.fillStyle = '#B9783E';
		ell(ctx, -3, -4.5, 2, 2);
		ell(ctx, 3, -4.5, 2, 2);
		ctx.fillStyle = '#2A1E18';
		ell(ctx, -3, -4.8, 1, 1);
		ell(ctx, 3, -4.8, 1, 1);
	},

	lizard(ctx, t, mode, p) {
		const k = p.big ? 1.25 : 1;
		const wig = Math.sin(t * (p.swim ? 5 : 9)) * 1.2;
		ctx.save();
		ctx.scale(k, k);
		ctx.globalAlpha = p.swim ? 0.85 : 1;
		const body = [[-14, wig * 1.4], [-9, -wig], [-4, wig * 0.5], [0, 0], [4, 0]];
		line(ctx, body, 1.4, p.body);
		line(ctx, body.slice(1), 2.6, p.body);
		line(ctx, body.slice(2), 3.6, p.body);
		for (const [x, s] of [[-2.5, 1], [-2.5, -1], [2.2, 1], [2.2, -1]]) line(ctx, [[x, 0], [x + (x > 0 ? 1.6 : -1.6), s * (2.6 + (s * wig > 0 ? 0.8 : 0))]], 0.9, p.body);
		ctx.fillStyle = p.body;
		ell(ctx, 5.6, 0, 2.6, 1.8);
		ctx.fillStyle = p.belly;
		ell(ctx, 0, 0.6, 3, 0.8);
		ctx.fillStyle = p.spots;
		for (const x of [-7, -3.5, 0, 3]) ell(ctx, x, -0.4, p.big ? 1.2 : 0.6, p.big ? 1 : 0.5);
		ctx.fillStyle = '#1A1210';
		ell(ctx, 6.4, -0.8, 0.5, 0.5);
		ctx.restore();
		ctx.globalAlpha = 1;
	},

	hedgehog(ctx, t) {
		const step = Math.sin(t * 8) * 0.6;
		ctx.fillStyle = '#4A3424';
		ell(ctx, -4, 4 + step * 0.5, 1.6, 1.2);
		ell(ctx, 4, 4 - step * 0.5, 1.6, 1.2);
		ctx.fillStyle = '#C8A27A';
		ell(ctx, 8, 1.5, 4.5, 3);
		ctx.fillStyle = '#2A1E18';
		ell(ctx, 12.2, 1.6, 1.1, 1);
		ell(ctx, 8.6, 0.4, 0.6, 0.6);
		ctx.fillStyle = '#7A5A3A';
		ell(ctx, -1, -0.5, 9, 6);
		for (let i = 0; i < 16; i++) {
			const a = Math.PI * (1.02 + (i / 15) * 1.0);
			const x = -1 + Math.cos(a) * 7, y = -0.5 + Math.sin(a) * 4.5;
			line(ctx, [[x, y], [x + Math.cos(a) * 3, y + Math.sin(a) * 3]], 0.8, 'rgba(58,40,24,0.85)');
		}
	},

	squirrel(ctx, t, mode) {
		const hop = mode === 'perch' ? 0 : Math.abs(Math.sin(t * 9)) * 2.5;
		ctx.save();
		ctx.translate(0, -hop);
		ctx.fillStyle = '#B4582A';
		ell(ctx, -8, -7, 4.5, 8, -0.5);
		ctx.fillStyle = '#C8683A';
		ell(ctx, -9, -10, 3, 5.5, -0.5);
		ctx.fillStyle = '#B4582A';
		ell(ctx, 0, 0, 6, 4.2);
		ell(ctx, 5.5, -3, 3.2, 3);
		ctx.beginPath(); ctx.moveTo(5, -5.5); ctx.lineTo(4.4, -9); ctx.lineTo(6.4, -6); ctx.fill();
		ctx.fillStyle = '#F4E8D0';
		ell(ctx, 1.5, 1.8, 3, 1.6);
		ctx.fillStyle = '#1A1210';
		ell(ctx, 6.6, -3.6, 0.7, 0.7);
		ctx.restore();
	},

	marmot(ctx, t, mode) {
		const up = Math.sin(t * 0.7) > 0.6;
		ctx.fillStyle = '#8A6A48';
		if (up) {
			ell(ctx, 0, -6, 4.8, 8);
			ctx.fillStyle = '#A88A68'; ell(ctx, 0, -4, 3, 5.5);
			ctx.fillStyle = '#8A6A48'; ell(ctx, 0, -15, 3.6, 3.4);
			ctx.fillStyle = '#1A1210'; ell(ctx, 1.4, -15.6, 0.6, 0.6);
			ctx.fillStyle = '#5A4430'; ell(ctx, 3.2, -14.4, 0.9, 0.7);
		} else {
			ell(ctx, -7, 1, 3.4, 2, 0.4);
			ell(ctx, 0, -1, 8, 5);
			ctx.fillStyle = '#A88A68'; ell(ctx, 0, 1.4, 5.5, 2.2);
			ctx.fillStyle = '#8A6A48'; ell(ctx, 7.5, -2, 3.4, 3);
			ctx.fillStyle = '#1A1210'; ell(ctx, 8.6, -2.8, 0.6, 0.6);
		}
	},

	tit(ctx, t, mode) {
		const flap = mode === 'perch' ? 0 : Math.abs(Math.sin(t * 22));
		ctx.fillStyle = '#5E7FA0';
		ell(ctx, -6, 0.5, 3.6, 1.4, 0.35);
		ctx.fillStyle = '#F2D04E';
		ell(ctx, 0, 1, 5, 4);
		ctx.fillStyle = '#4E86C0';
		ell(ctx, -1.5, -1 - flap * 3, 4, 2.4 + flap * 1.5, -0.2);
		ctx.fillStyle = '#FDF7E7';
		ell(ctx, 4, -2.4, 3, 2.6);
		ctx.fillStyle = '#3E8FD0';
		ell(ctx, 4, -4.4, 2.8, 1.3);
		ctx.fillStyle = '#2A1E18';
		ctx.fillRect(2.2, -2.9, 4, 0.7);
		ell(ctx, 4.8, -2.6, 0.6, 0.6);
		ctx.beginPath(); ctx.moveTo(6.8, -2.4); ctx.lineTo(8.6, -2); ctx.lineTo(6.8, -1.6); ctx.fill();
	},

	bird(ctx, t, mode, p) {
		const flap = mode === 'perch' || p.walker ? 0 : Math.abs(Math.sin(t * 22));
		const legs = p.walker ? Math.sin(t * 14) * 1.4 : 0;
		if (p.walker) {
			line(ctx, [[0, 3], [-1 - legs, 7]], 0.7, '#3A2A20');
			line(ctx, [[1, 3], [1 + legs, 7]], 0.7, '#3A2A20');
		}
		ctx.fillStyle = p.body;
		ell(ctx, -6, 0, 3.4, 1.3, 0.3);
		ell(ctx, 0, 0.5, 5, 3.6);
		ctx.fillStyle = p.belly;
		ell(ctx, 1, 2, 3.6, 1.8);
		ctx.fillStyle = p.body;
		ell(ctx, -1.5, -0.8 - flap * 3, 4, 2.2 + flap * 1.5, -0.2);
		ell(ctx, 4.5, -2.6, 2.8, 2.6);
		ctx.fillStyle = p.cap;
		ell(ctx, 4.2, -4.2, 2.4, 1.2);
		if (p.collar) { ctx.fillStyle = '#2A2420'; ell(ctx, 3, -0.4, 0.8, 1.6); }
		ctx.fillStyle = '#1A1210';
		ell(ctx, 5.4, -2.8, 0.6, 0.6);
		ctx.beginPath(); ctx.moveTo(7, -2.8); ctx.lineTo(7 + (p.beak ?? 2), -2.3); ctx.lineTo(7, -1.8); ctx.fill();
	},

	heron(ctx, t) {
		const nod = Math.sin(t * 0.8) * 1.2;
		line(ctx, [[0, 0], [-1, 14]], 1, '#6A6A60');
		line(ctx, [[2, 0], [3, 14]], 1, '#6A6A60');
		ctx.fillStyle = '#9AA0A8';
		ell(ctx, 0, -4, 7, 5, -0.3);
		ctx.fillStyle = '#7A808A';
		ell(ctx, -3, -4, 6, 3.4, -0.4);
		line(ctx, [[4, -7], [7, -12], [5, -17 + nod], [7, -21 + nod]], 2.2, '#C8CCD0');
		ctx.fillStyle = '#E8EAEC';
		ell(ctx, 8, -21.5 + nod, 2.6, 2.1);
		ctx.fillStyle = '#2A2420';
		ctx.fillRect(6.5, -23 + nod, 4, 0.7);
		ctx.fillStyle = '#E3A33A';
		ctx.beginPath(); ctx.moveTo(10, -22 + nod); ctx.lineTo(17, -20.8 + nod); ctx.lineTo(10, -20.6 + nod); ctx.fill();
	},

	owl(ctx, t) {
		const blink = (t % 4) < 0.15;
		ctx.fillStyle = '#7A5A3A';
		ell(ctx, 0, 0, 6, 8);
		ctx.fillStyle = '#9A7A52';
		ell(ctx, 0, -6, 5.2, 4.6);
		ctx.fillStyle = '#C8A878';
		ell(ctx, -2.2, -6, 2.3, 2.3);
		ell(ctx, 2.2, -6, 2.3, 2.3);
		ctx.fillStyle = '#1A1210';
		if (!blink) { ell(ctx, -2.2, -6, 1.2, 1.2); ell(ctx, 2.2, -6, 1.2, 1.2); }
		ctx.fillStyle = '#5A4028';
		for (const y of [0, 3]) for (const x of [-2.5, 0, 2.5]) ell(ctx, x, y, 0.8, 0.5);
	},

	eagle(ctx, t) {
		const flex = Math.sin(t * 1.2) * 0.08;
		ctx.fillStyle = '#4A3424';
		for (const s of [-1, 1]) {
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.quadraticCurveTo(s * 14, -6 - flex * 20, s * 28, -2 + flex * 10);
			ctx.lineTo(s * 26, 2);
			ctx.quadraticCurveTo(s * 12, 4, 0, 4);
			ctx.fill();
		}
		ell(ctx, 0, 1, 3.2, 7);
		ell(ctx, 0, -6.5, 2.4, 2.4);
		ctx.fillStyle = '#C8A060';
		ell(ctx, 0, -7.5, 1.6, 1.4);
		ctx.fillStyle = '#3A2A1C';
		ell(ctx, 0, 9, 3.6, 2.6);
	},

	gull(ctx, t) {
		const flap = Math.sin(t * 3) * 3;
		ctx.fillStyle = '#B8C0C8';
		for (const s of [-1, 1]) {
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.quadraticCurveTo(s * 10, -6 + flap, s * 20, -1 + flap);
			ctx.lineTo(s * 19, 2 + flap * 0.5);
			ctx.quadraticCurveTo(s * 9, 2, 0, 3);
			ctx.fill();
		}
		ctx.fillStyle = '#2A2420';
		for (const s of [-1, 1]) ell(ctx, s * 19, flap, 1.6, 1.2);
		ctx.fillStyle = '#F4F4F2';
		ell(ctx, 0, 1, 3, 6);
		ell(ctx, 0, -5, 2.2, 2.2);
		ctx.fillStyle = '#E8C43E';
		ell(ctx, 0, -7.4, 0.8, 1.4);
	},

	crab(ctx, t) {
		const scuttle = Math.sin(t * 10) * 0.8;
		for (const s of [-1, 1]) for (const i of [-2, 0, 2]) line(ctx, [[i, 0], [i + s * 0.3, s * 4], [i + s * 1.4 + scuttle, s * 6]], 0.7, '#4A5A2A');
		ctx.fillStyle = '#5A6A30';
		ell(ctx, 0, 0, 5.6, 4);
		ctx.fillStyle = '#6E7E3A';
		ell(ctx, -0.6, -1, 3.6, 2);
		for (const s of [-1, 1]) { ctx.fillStyle = '#4A5A2A'; ell(ctx, 6.4, s * 3.4, 2.4, 1.6, s * 0.5); }
		ctx.fillStyle = '#1A1210';
		ell(ctx, 5, -1.2, 0.5, 0.5);
		ell(ctx, 5, 1.2, 0.5, 0.5);
	},

	firefly(ctx) {
		ctx.fillStyle = 'rgba(250,226,110,0.35)';
		ell(ctx, 1.5, 0, 6, 6);
		ctx.fillStyle = '#3A2A20';
		ell(ctx, -1, 0, 3.6, 1.6);
		ctx.fillStyle = '#F6E27A';
		ell(ctx, 2.2, 0, 1.8, 1.5);
	},

	worm(ctx) {
		line(ctx, [[-9, 1], [-5, -2], [-1, 2], [3, 0], [6, -1.5], [9, -1]], 2.4, '#C98A86');
		line(ctx, [[-2.4, 1.2], [-1.2, 1.6]], 1, '#B06F6C');
	},
};

export function drawCritter(ctx, kind, t = 0, mode, params = {}) {
	DRAW[kind]?.(ctx, t, mode, params);
}

/** Taille d'affichage dans le jardin, et hauteur de vol (pour placer l'ombre au sol). */
export const CRITTER_SIZE = { hedgehog: 1.6, frog: 1.4, tit: 1.4, bird: 1.4, ladybug: 1.2, squirrel: 1.5, marmot: 1.6, lizard: 1.2, heron: 1.8, owl: 1.5, eagle: 1.6, gull: 1.3, crab: 1.3, beetle: 1.2 };
export const FLIGHT = { bee: 24, butterfly: 24, dragonfly: 24, frog: 6, hedgehog: 9, squirrel: 8, marmot: 7, lizard: 3, heron: 18, crab: 4, eagle: 160, gull: 110 };
