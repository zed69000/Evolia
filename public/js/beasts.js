// Mammifères animés par poses-clés : on décrit quelques poses d'un cycle (appel, poussée, suspension, réception…)
// et on glisse de l'une à l'autre en douceur, comme sur une planche d'animation.
// Vue de profil, tournée vers +x, pieds au sol en y = 0 (y négatif vers le haut), en unités monde.
// Chaque dessinateur reçoit l'état de la bête `s` : `s.ph` (phase du cycle en cours, 0 → 1), `s.mode`, `s.t`.

const TAU = Math.PI * 2;
const smooth = u => u * u * (3 - 2 * u);

/** Pose à la phase `ph` d'un cycle décrit par des clés [[phase, {param: valeur}], …] (la dernière rejoint la première). */
function pose(keys, ph) {
	ph = ((ph % 1) + 1) % 1;
	let i = keys.length - 1;
	while (i > 0 && keys[i][0] > ph) i--;
	const [p0, a] = keys[i], [p1raw, b] = keys[(i + 1) % keys.length];
	const p1 = p1raw <= p0 ? p1raw + 1 : p1raw;
	const u = smooth((ph - p0) / (p1 - p0));
	const out = {};
	for (const k in a) out[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * u;
	return out;
}

/** Mélange de deux poses (pour passer en douceur de la course à l'arrêt). */
const blend = (a, b, u) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + ((b[k] ?? a[k]) - a[k]) * u]));

const ell = (ctx, x, y, rx, ry, rot, color) => {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
	ctx.fill();
};

/** Direction d'un angle compté depuis la verticale descendante, positif vers l'avant. */
const dir = a => [Math.sin(a), Math.cos(a)];

/** Patte en deux segments, effilée, depuis (x, y) ; renvoie le bout. */
function limb(ctx, x, y, a1, l1, a2, l2, w1, w2, color) {
	const [dx1, dy1] = dir(a1), [dx2, dy2] = dir(a2);
	const kx = x + dx1 * l1, ky = y + dy1 * l1;
	const fx = kx + dx2 * l2, fy = ky + dy2 * l2;
	ctx.strokeStyle = color;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = w1;
	ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.stroke();
	ctx.lineWidth = w2;
	ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
	return [fx, fy];
}

/** Patte à deux os qui pose le pied sur un point donné (genou vers l'avant si bend > 0). */
function ikLeg(ctx, hx, hy, fx, fy, l1, l2, bend, w1, w2, color, hoof) {
	let dx = fx - hx, dy = fy - hy;
	let d = Math.hypot(dx, dy);
	const max = (l1 + l2) * 0.999;
	if (d > max) { dx *= max / d; dy *= max / d; d = max; fx = hx + dx; fy = hy + dy; }
	const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
	const base = Math.atan2(dy, dx);
	const ka = base - bend * a;
	const kx = hx + Math.cos(ka) * l1, ky = hy + Math.sin(ka) * l1;
	ctx.strokeStyle = color;
	ctx.lineCap = 'round';
	ctx.lineWidth = w1;
	ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
	ctx.lineWidth = w2;
	ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
	if (hoof) ell(ctx, fx + 0.4, fy - 0.3, w2 * 0.75, w2 * 0.55, 0, hoof);
}

/** Pied d'une patte au pas : appui (le pied recule au sol) puis lever (il revient vers l'avant en l'air). */
function gaitFoot(u, stride, lift, duty = 0.62) {
	u = ((u % 1) + 1) % 1;
	if (u < duty) return [stride * (0.5 - u / duty), 0];
	const v = (u - duty) / (1 - duty);
	return [stride * (-0.5 + smooth(v)), -Math.sin(v * Math.PI) * lift];
}

// ─── Lapin et lièvre : le bond ─────────────────────────────────────

// Cycle d'un bond, d'après une planche de lapin : ramassé, poussée des pattes arrière, corps tendu en l'air,
// réception sur les pattes avant, les pattes arrière repassent devant.
const HOP = [
	[0, { lift: 0, tilt: 0.04, len: 0.86, hip: 1.25, foot: -1.5, fore: 0.05, ear: -0.05 }],
	[0.2, { lift: 2.6, tilt: 0.42, len: 1.02, hip: -0.55, foot: -1.15, fore: 0.95, ear: 0.25 }],
	[0.42, { lift: 8.5, tilt: 0.06, len: 1.24, hip: -1.25, foot: -1.75, fore: 1.25, ear: 0.55 }],
	[0.62, { lift: 3.2, tilt: -0.36, len: 1.02, hip: -0.85, foot: -1.95, fore: 0.2, ear: 0.35 }],
	[0.82, { lift: 1.1, tilt: -0.12, len: 0.88, hip: 0.85, foot: -1.05, fore: -0.25, ear: 0.1 }],
];
const SIT = { lift: -1, tilt: 0.1, len: 0.86, hip: 0.95, foot: -1.5, fore: 0.1, ear: -0.05 };
const ALERT = { lift: -1, tilt: 0.85, len: 0.9, hip: 1.2, foot: -1.55, fore: 0.6, ear: -0.4 };

function leporid(ctx, s, p) {
	const hare = !!p.hare;
	const fur = p.winter && s.winter ? '#F2F0EA' : p.fur, dark = p.winter && s.winter ? '#D8D4CA' : p.dark, belly = p.belly;
	let P;
	if (s.mode === 'run') P = pose(HOP, s.ph);
	else {
		// À l'arrêt : il broute, s'assoit, se dresse de temps en temps pour écouter.
		const up = s.alert ?? 0;
		P = blend(SIT, ALERT, up);
	}
	const legK = hare ? 1.25 : 1;
	const nib = s.mode === 'run' ? 0 : Math.max(0, Math.sin(s.t * 1.3)) * (1 - (s.alert ?? 0));
	const L = P.len, hipX = -5 * L, chestX = 5.2 * L;
	const by = -7 * legK - P.lift;
	// On pivote autour de l'arrière-train : quand il se dresse, c'est l'avant qui monte.
	ctx.save();
	ctx.translate(hipX, by + 4);
	ctx.rotate(-P.tilt);
	ctx.translate(-hipX, -4);
	// Pattes du côté éloigné, plus sombres, derrière le corps.
	limb(ctx, hipX - 0.8, 1, P.hip + 0.15, 4.6 * legK, P.foot - 0.1, 6 * legK, 3.2, 2, dark);
	limb(ctx, chestX - 1, 3, P.fore + 0.25, 3.6 * legK, P.fore + 0.5, 1.4, 1.8, 1.6, dark);
	const hx = chestX + 3.6 + (hare ? 0.6 : 0), hy = -3.4 + nib * 3.2;
	const earLen = hare ? 11.5 : 9, earA = -2.0 + P.ear + Math.sin(s.t * 3.1) * 0.04;
	// Corps : arrière-train rond, dos, poitrail.
	ell(ctx, 0, 0, 8.8 * L, 6 / Math.sqrt(L), 0, fur);
	ell(ctx, hipX, -0.2, 5.8, 5.6, 0, fur);
	ell(ctx, chestX, 0.6, 4.4, 4.6, 0, fur);
	ell(ctx, 0.5, 3.2, 7 * L, 2.4, 0, belly);
	ell(ctx, -1, -3.6, 6.5 * L, 1.8, 0, 'rgba(255,248,235,0.18)');
	// Queue en pompon, blanche dessous.
	ell(ctx, hipX - 5.2, -2.4, 2.6, 2.4, 0, hare ? dark : '#F6F2EA');
	if (!hare) ell(ctx, hipX - 4.6, -3.4, 1.6, 1.2, 0, fur);
	// Patte arrière proche : la cuisse puis le long pied.
	ell(ctx, hipX + 0.4, 0.6, 4.4, 4.8, -0.3, dark);
	ell(ctx, hipX + 0.2, 0.2, 4, 4.4, -0.3, fur);
	limb(ctx, hipX + 0.4, 2.4, P.hip, 4.2 * legK, P.foot, 6.2 * legK, 3.4, 2.2, fur);
	// Patte avant proche.
	limb(ctx, chestX, 3.2, P.fore, 3.4 * legK, P.fore + 0.35, 1.4, 2, 1.8, fur);
	// Tête, museau, œil, nez : la tête reste à peu près droite quand le corps se cabre.
	ctx.translate(hx, hy);
	ctx.rotate(P.tilt * 0.8);
	ctx.translate(-hx, -hy);
	ell(ctx, hx - 1.4 + Math.cos(earA - 0.12) * earLen * 0.5, hy - 2 + Math.sin(earA - 0.12) * earLen * 0.5, earLen * 0.5, 1.9, earA - 0.12, dark);
	ell(ctx, hx, hy, 4.6, 3.8, 0.15, fur);
	ell(ctx, hx + 3.4, hy + 1.2, 2.2, 1.9, 0.2, belly);
	ell(ctx, hx + 1.6, hy - 0.9, 1.25, 1.25, 0, '#2A1A14');
	ell(ctx, hx + 1.9, hy - 1.3, 0.4, 0.4, 0, '#FDF7E7');
	ell(ctx, hx + 5.1, hy + 0.6, 0.7, 0.55, 0, '#D88A88');
	if (nib > 0.3) ell(ctx, hx + 4.4, hy + 2.4 + Math.sin(s.t * 18) * 0.4, 0.9, 0.5, 0, '#6E9A48');
	// Oreille proche, intérieur rosé, bout noir pour le lièvre.
	const ex = hx - 0.6, ey = hy - 2.6;
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(earA + Math.PI / 2);
	ell(ctx, 0, -earLen * 0.5, 2.1, earLen * 0.5, 0, fur);
	ell(ctx, 0.2, -earLen * 0.5, 1.1, earLen * 0.38, 0, '#E8B0A8');
	if (hare) ell(ctx, 0, -earLen * 0.93, 1.6, 1.4, 0, '#2A2220');
	ctx.restore();
	ctx.restore();
}

// ─── Écureuil : bonds souples, queue en panache ───────────────────

// tA : départ de la queue au-dessus de l'horizontale ; tB : combien elle se recourbe vers l'avant.
const SQ_HOP = [
	[0, { lift: 0, tilt: 0.1, len: 0.85, hip: 1.1, foot: -1.4, fore: 0.1, tA: 0.7, tB: 1.3 }],
	[0.25, { lift: 3, tilt: 0.45, len: 1.05, hip: -0.6, foot: -1.2, fore: 0.9, tA: 0.45, tB: 0.7 }],
	[0.5, { lift: 7.5, tilt: 0, len: 1.25, hip: -1.2, foot: -1.6, fore: 1.2, tA: 0.2, tB: 0.3 }],
	[0.72, { lift: 2.5, tilt: -0.4, len: 1, hip: -0.7, foot: -1.8, fore: 0.15, tA: 0.5, tB: 0.9 }],
];
const SQ_SIT = { lift: 0, tilt: 1.0, len: 0.85, hip: 1.0, foot: -1.55, fore: 2.0, tA: 1.25, tB: 1.0 };

function squirrel(ctx, s) {
	const fur = '#B8562A', dark = '#8E3E1E', light = '#D27A44', belly = '#F4E6CC';
	const P = s.mode === 'run' ? pose(SQ_HOP, s.ph) : SQ_SIT;
	const chew = s.mode === 'run' ? 0 : Math.sin(s.t * 14) * 0.5;
	const L = P.len, hipX = -4.5 * L, chestX = 4.5 * L;
	const hipY = -6 - P.lift + 3.5;
	// Panache : une chaîne de boules partie de la croupe, qui ondule avec un temps de retard.
	const segs = 9;
	let tx = hipX - 2.5, ty = hipY - 1.5, ta = Math.PI + P.tA;
	const pts = [];
	for (let i = 0; i < segs; i++) {
		const wave = Math.sin(s.t * 3 - i * 0.6) * 0.07;
		ta += P.tB / segs + wave;
		tx += Math.cos(ta) * 2.4;
		ty += Math.sin(ta) * 2.4;
		pts.push([tx, ty, 2.2 + Math.sin((i / (segs - 1)) * Math.PI * 0.9) * 2.6]);
	}
	for (const [x, y, r] of pts) ell(ctx, x, y, r + 0.9, r + 0.9, 0, dark);
	for (const [x, y, r] of pts) ell(ctx, x, y, r, r, 0, fur);
	for (const [x, y, r] of pts) ell(ctx, x - 0.4, y - 0.6, r * 0.55, r * 0.55, 0, light);
	ctx.save();
	ctx.translate(hipX, hipY);
	ctx.rotate(-P.tilt);
	ctx.translate(-hipX, -3.5);
	limb(ctx, hipX - 0.6, 1.2, P.hip + 0.15, 3.6, P.foot - 0.1, 4.6, 2.6, 1.6, dark);
	limb(ctx, chestX - 0.6, 2.4, P.fore + 0.2, 4.4, P.fore + 0.5, 1.2, 1.5, 1.3, dark);
	ell(ctx, 0, 0, 7.2 * L, 4.4, 0, fur);
	ell(ctx, hipX, 0.4, 4.4, 4.2, 0, fur);
	ell(ctx, 1, 2.6, 5.4 * L, 1.8, 0, belly);
	limb(ctx, hipX + 0.3, 2, P.hip, 3.4, P.foot, 4.8, 2.8, 1.8, fur);
	limb(ctx, chestX, 2.6, P.fore, 4.2, P.fore + 0.4, 1.2, 1.6, 1.4, fur);
	const hx = chestX + 3.2, hy = -3;
	ctx.translate(hx, hy);
	ctx.rotate(P.tilt * 0.85);
	ctx.translate(-hx, -hy);
	ell(ctx, hx, hy, 3.8, 3.3, 0.1, fur);
	ell(ctx, hx + 1.6, hy + 1.8 + chew * 0.3, 2.2, 1.3, 0.1, belly);
	ell(ctx, hx + 1.3, hy - 0.8, 1.05, 1.05, 0, '#1A1210');
	ell(ctx, hx + 1.55, hy - 1.15, 0.35, 0.35, 0, '#FDF7E7');
	ell(ctx, hx + 3.7, hy + 0.5, 0.55, 0.45, 0, '#3A2420');
	// Oreilles à pinceaux.
	for (const [ox, c] of [[-1.6, dark], [-0.4, fur]]) {
		ctx.fillStyle = c;
		ctx.beginPath();
		ctx.moveTo(hx + ox - 1.2, hy - 2.4);
		ctx.lineTo(hx + ox - 0.4, hy - 6.4);
		ctx.lineTo(hx + ox + 0.3, hy - 7.6);
		ctx.lineTo(hx + ox + 0.8, hy - 2.6);
		ctx.fill();
	}
	// Assis : une noisette entre les pattes.
	if (s.mode !== 'run') ell(ctx, hx + 2.6, hy + 3.4 + chew * 0.2, 1.5, 1.3, 0, '#9A6A3A');
	ctx.restore();
}

// ─── Grands animaux à quatre pattes : chevreuil, chamois, renard ─────

/**
 * Quadrupède : corps, cou, tête, quatre pattes posées au sol par cinématique inverse.
 * `s.ph` avance avec la distance parcourue ; à l'arrêt, il broute (tête au sol) ou lève la tête pour écouter.
 */
function quadruped(ctx, s, k) {
	const moving = s.mode === 'run';
	const ph = s.ph ?? 0;
	const graze = moving ? 0 : smooth(Math.max(0, Math.min(1, (Math.sin(s.t * 0.45) + 0.2) * 1.6)));
	const bob = moving ? Math.abs(Math.sin(ph * TAU * 2)) * k.bob : 0;
	const by = -k.legH - bob;
	const phase = k.trot ? [0, 0.5, 0.5, 0] : [0, 0.25, 0.5, 0.75]; // arrière G, avant G, arrière D, avant D
	const hips = [[-k.bodyL * 0.42, by + k.bodyH * 0.25], [k.bodyL * 0.38, by + k.bodyH * 0.3]];
	const leg = (i, near) => {
		const hind = i % 2 === 0;
		const [hx, hy] = hips[hind ? 0 : 1];
		const [fx, fy] = moving ? gaitFoot(ph + phase[i], k.stride, k.lift) : [hind ? -0.5 : 0.8, 0];
		const l1 = k.legH * (hind ? 0.42 : 0.4), l2 = k.legH * (hind ? 0.5 : 0.48);
		ikLeg(ctx, hx + (near ? 0 : -1.2), hy, hx + fx + (near ? 0 : -1.2), fy, l1, l2, hind ? -1 : 1, k.legW * (hind ? 1.5 : 1.15), k.legW, near ? k.leg : k.legFar, k.hoof);
	};
	leg(2, false); leg(3, false);
	// Queue (renard : grand panache ; cervidés : petite queue sur le miroir blanc).
	if (k.tail) k.tail(ctx, -k.bodyL * 0.5, by - k.bodyH * 0.1, s);
	ell(ctx, 0, by, k.bodyL * 0.52, k.bodyH * 0.5, 0, k.fur);
	ell(ctx, -k.bodyL * 0.3, by - k.bodyH * 0.05, k.bodyL * 0.26, k.bodyH * 0.52, 0, k.fur);
	ell(ctx, 0, by + k.bodyH * 0.28, k.bodyL * 0.38, k.bodyH * 0.2, 0, k.belly);
	ell(ctx, -k.bodyL * 0.05, by - k.bodyH * 0.3, k.bodyL * 0.4, k.bodyH * 0.12, 0, 'rgba(255,248,235,0.14)');
	if (k.rump) ell(ctx, -k.bodyL * 0.5, by - k.bodyH * 0.05, k.bodyH * 0.32, k.bodyH * 0.42, 0, k.rump);
	leg(0, true); leg(1, true);
	// Cou et tête : relevée, ou au ras du sol pour brouter.
	const nx = k.bodyL * 0.42, ny = by - k.bodyH * 0.2;
	const up = [nx + k.neck * 0.45, by - k.neck * 0.95];
	const down = [nx + k.neck * 0.75, -k.head * 0.55];
	const hx = up[0] + (down[0] - up[0]) * graze, hy = up[1] + (down[1] - up[1]) * graze + (moving ? Math.sin(ph * TAU * 2) * 0.6 : 0);
	ctx.strokeStyle = k.fur;
	ctx.lineCap = 'round';
	ctx.lineWidth = k.neckW;
	ctx.beginPath();
	ctx.moveTo(nx - 2, ny + 1);
	ctx.quadraticCurveTo(nx + (hx - nx) * 0.3, hy + (ny - hy) * 0.6, hx - 1, hy + 0.8);
	ctx.stroke();
	k.headDraw(ctx, hx, hy, graze, s);
}

const ROE = {
	legH: 17, bodyL: 25, bodyH: 11, neck: 13, neckW: 5.2, head: 6, stride: 9, lift: 4, bob: 0.6, legW: 1.5,
	fur: '#A8622C', belly: '#C89060', leg: '#94562A', legFar: '#7A4420', hoof: '#2A1E18', rump: '#F4EEE2',
	headDraw(ctx, x, y, graze, s) {
		const a = 0.25 + graze * 0.9;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(a);
		ell(ctx, 2.4, 0, 4.4, 3.2, 0, '#A8622C');
		ell(ctx, 5.6, 0.9, 2.8, 1.9, 0.15, '#9A5A2A');
		ell(ctx, 8, 1.1, 1, 0.85, 0, '#1E1612');
		ell(ctx, 6.6, 2.5, 1.4, 0.7, 0.1, '#F4EEE2');
		ell(ctx, 2.6, -1, 0.9, 0.9, 0, '#1A1210');
		const flick = Math.sin(s.t * 2.3) > 0.97 ? -0.5 : 0;
		for (const [ox, c] of [[-1.6, '#7A4420'], [-0.4, '#A8622C']]) ell(ctx, ox, -4, 1.6, 3.4, -0.5 + flick, c);
		// Les bois du brocard.
		ctx.strokeStyle = '#6A4A2E';
		ctx.lineWidth = 0.9;
		ctx.beginPath(); ctx.moveTo(0.6, -2.6); ctx.lineTo(0.2, -8); ctx.moveTo(0.4, -5.6); ctx.lineTo(1.8, -6.8); ctx.stroke();
		ctx.restore();
	},
};

const CHAMOIS = {
	...ROE, legH: 15, bodyL: 24, bodyH: 12, fur: '#9A7448', belly: '#B89064', leg: '#3A2A20', legFar: '#2A1E18', rump: null,
	headDraw(ctx, x, y, graze, s) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(0.3 + graze * 0.85);
		ell(ctx, 3, 0, 5, 3.2, 0, '#E8DCC4');
		ctx.strokeStyle = '#2A1E18'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(1, -1.4); ctx.lineTo(7, 0.6); ctx.stroke();
		ell(ctx, 7.4, 0.8, 1.4, 1.2, 0, '#2A1E18');
		ell(ctx, 2.6, -1, 0.8, 0.8, 0, '#1A1210');
		ell(ctx, -1, -3.4, 1.4, 2.6, -0.6, '#9A7448');
		// Cornes en crochet.
		ctx.strokeStyle = '#1A1210'; ctx.lineWidth = 1.1;
		ctx.beginPath(); ctx.moveTo(1, -2.6); ctx.quadraticCurveTo(0.6, -8.4, -1.8, -7.6); ctx.stroke();
		ctx.restore();
	},
};

const FOX = {
	legH: 10, bodyL: 22, bodyH: 8.5, neck: 6, neckW: 5, head: 4, stride: 10, lift: 3.4, bob: 0.9, legW: 1.4, trot: true,
	fur: '#C8662A', belly: '#F2E6D4', leg: '#2A1E18', legFar: '#1A1210', hoof: null, rump: null,
	tail(ctx, x, y, s) {
		const sw = Math.sin(s.t * 2.2) * 0.12;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(0.35 + sw);
		ell(ctx, -9, 0, 10, 3.6, 0, '#B85A24');
		ell(ctx, -8, -0.8, 7, 2, 0, '#D47A3A');
		ell(ctx, -18, 0.2, 2.8, 2.6, 0, '#F4EEE2');
		ctx.restore();
	},
	headDraw(ctx, x, y, graze) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(0.1 + graze * 0.8);
		ell(ctx, 1.6, 0, 4.2, 3.4, 0, '#C8662A');
		ctx.fillStyle = '#C8662A';
		ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(9.6, 0.8); ctx.lineTo(3, 2.4); ctx.fill();
		ctx.fillStyle = '#F2E6D4';
		ctx.beginPath(); ctx.moveTo(2.6, 1); ctx.lineTo(9, 1.2); ctx.lineTo(2.4, 3.2); ctx.fill();
		ell(ctx, 9.4, 0.8, 0.8, 0.7, 0, '#1A1210');
		ell(ctx, 3.6, -0.8, 0.7, 0.6, 0, '#1A1210');
		for (const [ox, c] of [[-1.4, '#8E4418'], [0.4, '#C8662A']]) {
			ctx.fillStyle = c;
			ctx.beginPath(); ctx.moveTo(ox - 1.8, -2); ctx.lineTo(ox, -7.4); ctx.lineTo(ox + 1.6, -2.2); ctx.fill();
		}
		ctx.restore();
	},
};

// ─── Le paysan du potager ─────────────────────────────────────────

const SKIN = '#E8B898';

/** Paysan : marche (avec ou sans brouette), ratisse, arrose. Origine aux pieds. */
function farmer(ctx, s) {
	const t = s.t, mode = s.mode;
	const walk = mode === 'run' || mode === 'barrow';
	const ph = (s.ph ?? 0) * TAU;
	const sw = walk ? Math.sin(ph) : 0;
	const bob = walk ? Math.abs(Math.cos(ph)) * 0.8 : 0;
	const rake = mode === 'rake' ? Math.sin(t * 2.4) : 0;
	const water = mode === 'water';
	const hipY = -15 - bob, shY = -27 - bob;
	const lean = mode === 'rake' ? 0.12 : mode === 'barrow' ? 0.14 : 0.03;
	const legs = (sign, color) => {
		const a = sw * 0.45 * sign;
		const kneeA = a + (walk ? Math.max(0, -Math.sin(ph + (sign > 0 ? 0 : Math.PI))) * 0.5 : 0) - 0.05;
		limb(ctx, 0, hipY, a, 7.6, kneeA - 0.15, 7.4, 3.4, 3, color);
		const [dx1, dy1] = dir(a), [dx2, dy2] = dir(kneeA - 0.15);
		const fx = dx1 * 7.6 + dx2 * 7.4, fy = hipY + dy1 * 7.6 + dy2 * 7.4;
		ell(ctx, fx + 1.2, fy + 0.4, 2.6, 1.4, 0, '#C88A3A');
	};
	legs(-1, '#3E5E78');
	// Bras du fond.
	const armBack = walk && mode !== 'barrow' ? -sw * 0.5 : mode === 'barrow' ? 0.9 : mode === 'rake' ? 0.6 + rake * 0.35 : 0.2;
	limb(ctx, -0.6, shY + 1.5, armBack, 5.6, armBack + 0.4, 5.2, 2.6, 2.2, '#B85A3A');
	legs(1, '#4E6E88');
	ctx.save();
	ctx.translate(0, hipY);
	ctx.rotate(lean);
	// Salopette, chemise, tête et chapeau de paille.
	ell(ctx, 0.2, -6.2, 4.2, 7.2, 0, '#C8643E');
	ctx.fillStyle = '#5E8AA8';
	ctx.beginPath(); ctx.roundRect(-3.8, -7.2, 7.8, 8.6, 2); ctx.fill();
	ctx.fillRect(-2.6, -11, 1.2, 4); ctx.fillRect(1.6, -11, 1.2, 4);
	ell(ctx, 0.9, -15.4, 3.4, 3.6, 0, SKIN);
	ell(ctx, -1.6, -15.6, 1.6, 2.4, 0, '#7A4A2A');
	ell(ctx, 1.8, -12.6, 2.2, 1.3, 0.2, '#8A5A34');
	ell(ctx, 2.6, -16, 0.45, 0.5, 0, '#1A1210');
	ell(ctx, 4.2, -15, 0.8, 0.7, 0, '#E0A080');
	ell(ctx, 3.2, -14.4, 0.7, 0.4, 0, '#C87A60');
	ell(ctx, 0.6, -18.2, 7.2, 1.7, 0, '#E8B860');
	ell(ctx, 0.4, -19.6, 3.6, 2.4, 0, '#E8B860');
	ell(ctx, 0.4, -18.8, 3.6, 0.7, 0, '#C8643E');
	ctx.restore();
	// Bras proche et outil.
	const sx = Math.sin(lean) * -12 + 0.4, sy = shY + 2;
	if (mode === 'rake') {
		const a = 0.75 + rake * 0.35;
		const [hx, hy] = limb(ctx, sx, sy, a, 5.4, a + 0.6, 5, 2.6, 2.2, '#C8643E');
		const tx = hx + 16 * Math.cos(0.5 + rake * 0.18), ty = hy + 16 * Math.sin(0.5 + rake * 0.18);
		ctx.strokeStyle = '#8A5A2E'; ctx.lineWidth = 1.1;
		ctx.beginPath(); ctx.moveTo(hx - 6 * Math.cos(0.5), hy - 6 * Math.sin(0.5)); ctx.lineTo(tx, Math.min(ty, -0.5)); ctx.stroke();
		ctx.strokeStyle = '#4A3A2E'; ctx.lineWidth = 0.8;
		ctx.beginPath(); ctx.moveTo(tx - 1, -1.2); ctx.lineTo(tx + 4.5, -1.2);
		for (let i = 0; i < 5; i++) { ctx.moveTo(tx - 0.6 + i * 1.2, -1.2); ctx.lineTo(tx - 0.6 + i * 1.2, 0.4); }
		ctx.stroke();
		ell(ctx, hx, hy, 1.2, 1.2, 0, SKIN);
	} else if (water) {
		const [hx, hy] = limb(ctx, sx, sy, 1.2, 5.4, 1.5, 5, 2.6, 2.2, '#C8643E');
		ell(ctx, hx + 2.6, hy + 1.6, 3.4, 2.6, 0, '#7A9AA8');
		ctx.strokeStyle = '#7A9AA8'; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(hx + 5, hy + 1); ctx.lineTo(hx + 10, hy + 3.6); ctx.stroke();
		ctx.fillStyle = 'rgba(150,200,230,0.7)';
		for (let i = 0; i < 4; i++) {
			const u = (t * 2.2 + i / 4) % 1;
			ctx.beginPath(); ctx.arc(hx + 10.5 + u * 2, hy + 4 + u * (-(hy + 4)), 0.5, 0, TAU); ctx.fill();
		}
	} else if (mode === 'barrow') {
		const [hx, hy] = limb(ctx, sx, sy, 0.95, 5.6, 1.15, 5.2, 2.6, 2.2, '#C8643E');
		barrow(ctx, hx, hy, s);
	} else {
		limb(ctx, sx, sy, walk ? sw * 0.5 : -0.1, 5.6, (walk ? sw * 0.5 : -0.1) + 0.3, 5.2, 2.6, 2.2, '#C8643E');
	}
}

/** Brouette pleine de terre et de jeunes pousses, tenue par les poignées en (hx, hy). */
function barrow(ctx, hx, hy, s) {
	const wx = hx + 17, wy = -3.2;
	const spin = (s.dist ?? 0) / 3.2;
	ctx.strokeStyle = '#7A4E2A'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
	ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(wx, wy); ctx.stroke();
	ctx.beginPath(); ctx.moveTo(hx + 7, hy + 4); ctx.lineTo(hx + 7, -0.4); ctx.stroke();
	ctx.fillStyle = '#A8743E';
	ctx.beginPath(); ctx.moveTo(hx + 3, hy - 0.5); ctx.lineTo(wx + 2, hy - 1.5); ctx.lineTo(wx - 2, hy + 5.5); ctx.lineTo(hx + 6, hy + 5.5); ctx.closePath(); ctx.fill();
	ell(ctx, hx + 11, hy - 0.8, 7.4, 1.8, -0.05, '#5A3E26');
	for (const ox of [7, 11, 15]) {
		ctx.strokeStyle = '#5F933E'; ctx.lineWidth = 0.7;
		ctx.beginPath(); ctx.moveTo(hx + ox, hy - 1.4); ctx.lineTo(hx + ox, hy - 3.6); ctx.stroke();
		ell(ctx, hx + ox - 1, hy - 3.8, 1.2, 0.6, -0.4, '#6E9E46');
		ell(ctx, hx + ox + 1, hy - 3.8, 1.2, 0.6, 0.4, '#6E9E46');
	}
	ell(ctx, wx, wy, 3.2, 3.2, 0, '#3A2A20');
	ell(ctx, wx, wy, 2.2, 2.2, 0, '#8A6A4A');
	ctx.strokeStyle = '#3A2A20'; ctx.lineWidth = 0.5;
	ctx.beginPath();
	for (let i = 0; i < 4; i++) { const a = spin + (i * Math.PI) / 4; ctx.moveTo(wx - Math.cos(a) * 2.2, wy - Math.sin(a) * 2.2); ctx.lineTo(wx + Math.cos(a) * 2.2, wy + Math.sin(a) * 2.2); }
	ctx.stroke();
}

const LAPIN = { fur: '#9C8466', dark: '#7A644A', belly: '#E8DCC8' };
const LIEVRE = { fur: '#A88A5E', dark: '#806640', belly: '#E8DCC0', hare: true };

export const BEASTS = {
	rabbit: (ctx, t, mode, p, s) => leporid(ctx, s, { ...LAPIN, ...p }),
	hare: (ctx, t, mode, p, s) => leporid(ctx, s, { ...LIEVRE, ...p }),
	squirrel: (ctx, t, mode, p, s) => squirrel(ctx, s),
	roe: (ctx, t, mode, p, s) => quadruped(ctx, s, ROE),
	chamois: (ctx, t, mode, p, s) => quadruped(ctx, s, CHAMOIS),
	fox: (ctx, t, mode, p, s) => quadruped(ctx, s, FOX),
	farmer: (ctx, t, mode, p, s) => farmer(ctx, s),
};

/** Allure de chaque bête : durée d'un bond ou longueur d'une foulée, vitesse au sol. */
export const GAIT = {
	rabbit: { hop: 0.46, len: 24 },
	hare: { hop: 0.42, len: 34 },
	squirrel: { hop: 0.38, len: 20 },
	roe: { stride: 18, speed: 16 },
	chamois: { stride: 16, speed: 14 },
	fox: { stride: 20, speed: 30 },
	farmer: { stride: 15, speed: 12 },
};
