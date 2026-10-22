// Petites bêtes du jardin, dessinées à chaque image (elles bougent) autour de (0, 0), en unités monde.
// `t` anime les ailes ; `mode` vaut 'perch' quand l'animal est posé.

const ell = (ctx, x, y, rx, ry, rot = 0) => {
	ctx.beginPath();
	ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
	ctx.fill();
};

const DRAW = {
	bee(ctx, t) {
		const flap = Math.abs(Math.sin(t * 38));
		ctx.fillStyle = 'rgba(253,247,231,0.75)';
		ell(ctx, -1, -4, 3.2, 4.5 * flap + 0.8);
		ell(ctx, 2, -4, 2.6, 3.8 * flap + 0.6);
		ctx.fillStyle = '#E3A33A';
		ell(ctx, 0, 0, 6, 4.2);
		ctx.fillStyle = 'rgba(58,42,32,0.85)';
		ell(ctx, -1.6, 0, 1.1, 3.9);
		ell(ctx, 1.4, 0, 1.1, 4);
		ell(ctx, 5.4, -0.4, 2.2, 2.2);
	},

	butterfly(ctx, t, mode) {
		const flap = mode === 'perch' ? 0.35 + 0.25 * Math.abs(Math.cos(t * 3)) : 0.2 + 0.8 * Math.abs(Math.cos(t * 12));
		ctx.save();
		ctx.scale(flap, 1);
		ctx.fillStyle = 'rgba(240,138,60,0.92)';
		ell(ctx, -4.5, -3, 4.6, 4);
		ell(ctx, 4.5, -3, 4.6, 4);
		ctx.fillStyle = 'rgba(58,42,32,0.7)';
		ell(ctx, -5.5, -4, 1, 0.9);
		ell(ctx, 5.5, -4, 1, 0.9);
		ctx.fillStyle = 'rgba(244,194,62,0.9)';
		ell(ctx, -3.2, 2.2, 2.8, 2.6);
		ell(ctx, 3.2, 2.2, 2.8, 2.6);
		ctx.restore();
		ctx.fillStyle = '#3A2A20';
		ell(ctx, 0, 0, 0.9, 4.2);
	},

	dragonfly(ctx, t) {
		const flap = Math.abs(Math.sin(t * 30));
		ctx.fillStyle = 'rgba(225,242,246,0.6)';
		ell(ctx, -1, -2, 7, 1.6 * flap + 0.5, -0.25);
		ell(ctx, -1, 2, 7, 1.6 * flap + 0.5, 0.25);
		ell(ctx, 2, -2, 6, 1.4 * flap + 0.5, 0.25);
		ell(ctx, 2, 2, 6, 1.4 * flap + 0.5, -0.25);
		ctx.fillStyle = '#C8402A';
		ell(ctx, -3, 0, 9, 1.1);
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
		ctx.strokeStyle = 'rgba(58,40,24,0.85)';
		ctx.lineWidth = 0.8;
		ctx.lineCap = 'round';
		for (let i = 0; i < 16; i++) {
			const a = Math.PI * (1.02 + (i / 15) * 1.0);
			const x = -1 + Math.cos(a) * 7, y = -0.5 + Math.sin(a) * 4.5;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
			ctx.stroke();
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
		ctx.beginPath();
		ctx.moveTo(6.8, -2.4);
		ctx.lineTo(8.6, -2);
		ctx.lineTo(6.8, -1.6);
		ctx.fill();
	},

	firefly(ctx, t) {
		ctx.fillStyle = 'rgba(250,226,110,0.35)';
		ell(ctx, 1.5, 0, 6, 6);
		ctx.fillStyle = '#3A2A20';
		ell(ctx, -1, 0, 3.6, 1.6);
		ctx.fillStyle = '#F6E27A';
		ell(ctx, 2.2, 0, 1.8, 1.5);
	},

	worm(ctx) {
		ctx.strokeStyle = '#C98A86';
		ctx.lineWidth = 2.4;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(-9, 1);
		ctx.bezierCurveTo(-5, -4, -1, 5, 3, 0);
		ctx.bezierCurveTo(5, -2, 7, -2, 9, -1);
		ctx.stroke();
		ctx.strokeStyle = '#B06F6C';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(-2.4, 1.2);
		ctx.lineTo(-1.2, 1.6);
		ctx.stroke();
	},
};

export function drawCritter(ctx, kind, t = 0, mode) {
	DRAW[kind]?.(ctx, t, mode);
}
