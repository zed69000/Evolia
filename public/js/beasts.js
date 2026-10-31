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
	const graze = moving || k.noGraze ? 0 : smooth(Math.max(0, Math.min(1, (Math.sin(s.t * 0.45) + 0.2) * 1.6)));
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
	// Chien et chat : un ventre rentré entre la hanche et un poitrail plus profond.
	ell(ctx, 0, by - (k.tuck ? k.bodyH * 0.08 : 0), k.bodyL * 0.52, k.bodyH * (k.tuck ? 0.4 : 0.5), 0, k.fur);
	ell(ctx, -k.bodyL * 0.3, by - k.bodyH * 0.05, k.bodyL * 0.26, k.bodyH * 0.52, 0, k.fur);
	if (k.chest) ell(ctx, k.bodyL * 0.28, by + k.bodyH * 0.06, k.bodyL * 0.25, k.bodyH * 0.5 * k.chest, -0.1, k.fur);
	// Ombre douce sous le ventre, lumière sur le dos (le soleil vient d'en haut à gauche).
	if (k.tuck) {
		ell(ctx, 0, by + k.bodyH * 0.22, k.bodyL * 0.45, k.bodyH * 0.18, 0, 'rgba(60,30,10,0.12)');
		ell(ctx, -k.bodyL * 0.1, by - k.bodyH * 0.38, k.bodyL * 0.36, k.bodyH * 0.1, 0, 'rgba(255,245,225,0.22)');
	}
	if (k.stripes) {
		ctx.strokeStyle = k.stripes; ctx.lineWidth = 1; ctx.lineCap = 'round';
		for (let i = 0; i < 5; i++) { const x = -k.bodyL * 0.38 + i * k.bodyL * 0.16; ctx.beginPath(); ctx.moveTo(x, by - k.bodyH * 0.42); ctx.quadraticCurveTo(x + 1.2, by - k.bodyH * 0.1, x + 0.4, by + k.bodyH * 0.1); ctx.stroke(); }
	}
	if (k.chest) ell(ctx, k.bodyL * 0.3, by + k.bodyH * 0.38, k.bodyL * 0.14, k.bodyH * 0.22, 0, k.belly);
	else ell(ctx, 0, by + k.bodyH * 0.28, k.bodyL * 0.38, k.bodyH * 0.2, 0, k.belly);
	ell(ctx, -k.bodyL * 0.05, by - k.bodyH * 0.3, k.bodyL * 0.4, k.bodyH * 0.12, 0, 'rgba(255,248,235,0.14)');
	if (k.rump) ell(ctx, -k.bodyL * 0.5, by - k.bodyH * 0.05, k.bodyH * 0.32, k.bodyH * 0.42, 0, k.rump);
	leg(0, true); leg(1, true);
	// Cou et tête : relevée, ou au ras du sol pour brouter.
	const nx = k.bodyL * 0.42, ny = by - k.bodyH * 0.2;
	const up = [nx + k.neck * (k.neckFwd ?? 0.45), by - k.neck * (k.neckFwd ? 0.75 : 0.95)];
	const down = [nx + k.neck * 0.75, -k.head * 0.55];
	const hx = up[0] + (down[0] - up[0]) * graze, hy = up[1] + (down[1] - up[1]) * graze + (moving ? Math.sin(ph * TAU * 2) * 0.6 : 0);
	ctx.strokeStyle = k.fur;
	ctx.lineCap = 'round';
	ctx.lineWidth = k.neckW;
	ctx.beginPath();
	ctx.moveTo(nx - 2, ny + 1);
	ctx.quadraticCurveTo(nx + (hx - nx) * 0.3, hy + (ny - hy) * 0.6, hx - 1, hy + 0.8);
	ctx.stroke();
	if (k.collar) {
		ctx.strokeStyle = k.collar; ctx.lineWidth = 1.4;
		ctx.beginPath(); ctx.moveTo(hx - 3.2, hy + 0.6); ctx.lineTo(hx - 1.4, hy + 3.4); ctx.stroke();
		ell(ctx, hx - 1.4, hy + 3.8, 0.8, 0.8, 0, '#E8C040');
	}
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

// Le bouquetin : plus trapu, gris-brun, une barbiche et de grandes cornes annelées en arc vers l'arrière.
const IBEX = {
	...CHAMOIS, legH: 15, bodyL: 27, bodyH: 13.5, neckW: 6, fur: '#8C7C64', belly: '#A8987C', leg: '#6A5A46', legFar: '#4E4232',
	headDraw(ctx, x, y, graze, s) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(0.3 + graze * 0.85);
		ell(ctx, 3, 0, 5.2, 3.4, 0, '#8C7C64');
		ell(ctx, 6.8, 0.9, 2.2, 1.8, 0.1, '#7A6A54');
		ell(ctx, 5.8, 3.4, 0.9, 1.8, 0.2, '#4E4232');
		ell(ctx, 2.6, -1, 0.8, 0.8, 0, '#1A1210');
		ell(ctx, -1, -3, 1.3, 2.2, -0.6, '#7A6A54');
		ctx.lineCap = 'round';
		ctx.strokeStyle = '#6A5A44'; ctx.lineWidth = 2.6;
		ctx.beginPath(); ctx.moveTo(1.6, -2.4); ctx.quadraticCurveTo(-1, -12, -8, -9.5); ctx.stroke();
		ctx.strokeStyle = 'rgba(240,226,196,0.6)'; ctx.lineWidth = 0.7;
		for (const [a, b] of [[0.6, -5.8], [-0.6, -8.2], [-2.6, -9.8], [-5, -10.2]]) { ctx.beginPath(); ctx.moveTo(a - 1, b - 0.4); ctx.lineTo(a + 1, b + 0.6); ctx.stroke(); }
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

// ─── Le chien ou le chat de la cabane ───────────────────────────

/** Une queue qui remue (chien) ou ondule lentement, dressée (chat). */
const petTail = (len, w, col, tip, wag, up, droop = 0) => (ctx, x, y, s) => {
	const a = -up + Math.sin(s.t * wag) * (s.mode === 'run' ? 0.15 : 0.35);
	const ex = x - len * Math.cos(a), ey = y + len * Math.sin(a) * 0.9;
	// Une queue effilée : un trait large à la base, plus fin au bout, qui pend puis remonte (droop).
	for (const [lw, c] of [[w, col], [w * 0.55, 'rgba(255,240,215,0.25)']]) {
		ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x + 1, y);
		ctx.quadraticCurveTo(x - len * 0.55, y + len * droop - len * 0.2 + Math.sin(a) * len * 0.3, ex, ey);
		ctx.stroke();
	}
	if (tip) ell(ctx, x - len * Math.cos(a), y + len * Math.sin(a) * 0.9, w * 0.55, w * 0.55, 0, tip);
};

const DOG = {
	// D'après une planche de marche : chien élancé, pattes longues, poitrail profond, ventre rentré, cou tendu en avant.
	legH: 13, bodyL: 22, bodyH: 8, neck: 7.5, neckW: 5.4, head: 4.4, stride: 11, lift: 3.4, bob: 0.6, legW: 1.7, noGraze: true,
	chest: 1.25, tuck: true, neckFwd: 0.9,
	fur: '#C8904E', belly: '#E8CCA0', leg: '#C08848', legFar: '#9A6A38', hoof: null, rump: null,
	tail: petTail(12, 2.2, '#B07A40', null, 6, -0.05, 0.75),
	collar: '#C8483A', eye: [3.2, -1.3],
	headDraw(ctx, x, y) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(0.12);
		ell(ctx, 1, 0, 4.3, 3.7, 0, '#C8904E');
		ell(ctx, 0.2, -1.4, 3, 1.6, -0.2, 'rgba(255,240,210,0.22)');
		// Museau franc, qui s'affine vers la truffe ; le dessous plus clair.
		ctx.fillStyle = '#C8904E';
		ctx.beginPath(); ctx.moveTo(2, -2.4); ctx.quadraticCurveTo(6.6, -2, 8.6, 0); ctx.quadraticCurveTo(7.2, 2.8, 2, 3.2); ctx.fill();
		ctx.fillStyle = '#E8CCA0';
		ctx.beginPath(); ctx.moveTo(2.6, 1.4); ctx.quadraticCurveTo(6.8, 1.4, 8.4, 0.9); ctx.quadraticCurveTo(7, 3, 2.6, 3.2); ctx.fill();
		ell(ctx, 8.6, -0.1, 1.15, 1, 0, '#2A1E18');
		ell(ctx, 8.3, -0.4, 0.35, 0.25, 0, 'rgba(255,255,255,0.6)');
		ell(ctx, 3.2, -1.3, 0.8, 0.75, 0, '#1A1210');
		ell(ctx, 3.4, -1.5, 0.25, 0.25, 0, 'rgba(255,255,255,0.8)');
		// Oreille tombante, rabattue vers l'arrière.
		ctx.fillStyle = '#8A5A2E';
		ctx.beginPath(); ctx.moveTo(0.6, -2.4); ctx.quadraticCurveTo(-2.8, -1, -2.4, 3.6); ctx.quadraticCurveTo(-0.6, 2, 1.4, -1.4); ctx.fill();
		ctx.restore();
	},
};

const CAT = {
	legH: 8.5, bodyL: 17, bodyH: 6.4, neck: 4, neckW: 4, head: 3.6, stride: 7.5, lift: 2.4, bob: 0.4, legW: 1.2, noGraze: true, tuck: true,
	stripes: 'rgba(160,80,30,0.55)', eye: [2.4, -0.8],
	fur: '#E0904A', belly: '#F6E4CC', leg: '#D8843E', legFar: '#B86A2E', hoof: null, rump: null,
	tail: petTail(12, 2, '#D8843E', '#B86A2E', 1.6, 1.3, -0.2),
	headDraw(ctx, x, y) {
		ctx.save();
		ctx.translate(x, y);
		ell(ctx, 1.2, 0, 3.6, 3.2, 0, '#E0904A');
		ell(ctx, 3.6, 1.1, 1.8, 1.4, 0, '#F6E4CC');
		ell(ctx, 4.8, 0.6, 0.55, 0.45, 0, '#C86A6A');
		ell(ctx, 2.4, -0.8, 0.75, 0.6, 0, '#4A6A2A');
		ell(ctx, 2.5, -0.8, 0.25, 0.5, 0, '#1A1210');
		for (const [ox, c] of [[-1.2, '#B86A2E'], [1.2, '#E0904A']]) {
			ctx.fillStyle = c;
			ctx.beginPath(); ctx.moveTo(ox - 1.6, -2.2); ctx.lineTo(ox, -5.6); ctx.lineTo(ox + 1.4, -2.4); ctx.fill();
		}
		// Rayures du tigré, sur le front.
		ctx.strokeStyle = 'rgba(150,80,30,0.7)'; ctx.lineWidth = 0.5;
		for (const k of [-0.6, 0.4]) { ctx.beginPath(); ctx.moveTo(k, -3); ctx.lineTo(k + 0.4, -1.4); ctx.stroke(); }
		ctx.restore();
	},
};

/** Le compagnon endormi, roulé en boule au soleil : la queue enroulée devant, la tête posée, les yeux fermés. */
function curled(ctx, s, k) {
	const br = 1 + Math.sin(s.t * 1.6) * 0.04, R = k.bodyL * 0.46, H = k.bodyH;
	ell(ctx, 0, -H * 0.6, R, H * 0.7 * br, 0, k.fur);
	ell(ctx, -R * 0.2, -H * 0.95, R * 0.6, H * 0.18, 0, 'rgba(255,245,225,0.22)');
	ell(ctx, 0, -H * 0.12, R * 0.9, H * 0.16, 0, 'rgba(60,30,10,0.12)');
	// La queue fait le tour par devant.
	ctx.strokeStyle = k.leg; ctx.lineWidth = H * 0.32; ctx.lineCap = 'round';
	ctx.beginPath(); ctx.ellipse(0, -H * 0.42, R * 1.02, H * 0.5, 0, 0.15, 2.7); ctx.stroke();
	// La tête posée sur le devant, un peu penchée.
	ctx.save();
	ctx.translate(R * 0.55, -H * 0.55);
	ctx.rotate(0.25);
	ctx.scale(0.9, 0.9);
	k.headDraw(ctx, 0, 0);
	const [ex, ey] = k.eye;
	ell(ctx, ex, ey, 1, 0.9, 0, k.fur);
	ctx.strokeStyle = 'rgba(26,18,16,0.85)'; ctx.lineWidth = 0.5;
	ctx.beginPath(); ctx.arc(ex, ey - 0.4, 0.8, 0.3, Math.PI - 0.3); ctx.stroke();
	ctx.restore();
}

function pet(ctx, s, k) {
	if (s.mode === 'sleep') return curled(ctx, s, k);
	quadruped(ctx, s, k);
}

// ─── Le jardinier ou la jardinière ─────────────────────────────────

const SKIN = '#E8B898', SKIN_SH = '#C9967A';
const LEG1 = 6.9, LEG2 = 6.7, STRIDE = 8;

/** Bras en deux segments : manche jusqu'au coude (retroussée), avant-bras et main nus. Renvoie la main. */
function arm(ctx, x, y, a1, a2, sleeve) {
	const [dx1, dy1] = dir(a1), [dx2, dy2] = dir(a2);
	const ex = x + dx1 * 4.6, ey = y + dy1 * 4.6, hx = ex + dx2 * 4.2, hy = ey + dy2 * 4.2;
	ctx.lineCap = 'round';
	ctx.strokeStyle = SKIN_SH; ctx.lineWidth = 1.7;
	ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
	ctx.strokeStyle = sleeve; ctx.lineWidth = 2.5;
	ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx1 * 4.9, y + dy1 * 4.9); ctx.stroke();
	ell(ctx, hx + dx2 * 0.5, hy + dy2 * 0.5, 1.05, 1.15, 0, SKIN);
	return [hx + dx2 * 0.6, hy + dy2 * 0.6];
}

/** Jambe : pantalon, puis une botte qui pointe vers l'avant (talon relevé si `tip`). */
function leg(ctx, hx, hy, fx, fy, color, tip = 0) {
	ikLeg(ctx, hx, hy, fx, fy - 0.9, LEG1, LEG2, -1, 3.1, 2.5, color);
	ctx.save();
	ctx.translate(fx, fy);
	ctx.rotate(-tip);
	ctx.fillStyle = '#5A3A22';
	ctx.beginPath(); ctx.roundRect(-1.4, -2.2, 3.1, 2.2, 0.8); ctx.fill();
	ell(ctx, 1.4, -0.75, 1.9, 0.85, 0, '#5A3A22');
	ctx.fillStyle = '#2E1E14'; ctx.fillRect(-1.5, -0.35, 4.9, 0.55);
	ctx.restore();
}

/**
 * Le jardinier, de profil (tourné vers +x, pieds en y = 0) : marche (seul, avec la brouette ou avec son animal),
 * ratisse, arrose, se repose debout, s'assoit sur un banc, cueille des fruits dans un arbre, contemple le jardin.
 */
function farmer(ctx, s) {
	const t = s.t, mode = s.mode, fem = !!s.fem;
	const C = fem
		? { shirt: '#D0607A', sh: '#B04C64', legs: '#4E6A86', legsFar: '#3E566E', hair: '#7A4A2A' }
		: { shirt: '#C8643E', sh: '#A84E30', legs: '#5E8AA8', legsFar: '#48708C', hair: '#6A4428' };
	const walk = mode === 'run' || mode === 'barrow' || mode === 'stroll';
	const ph = s.ph ?? 0;
	const breath = Math.sin(t * 1.7) * 0.18;
	let hipX = 0, hipY = -14.15 + breath * 0.3, lean = 0.03, head = 0;
	let feet = [[-1.1, 0, 0], [1.3, 0, 0]];
	if (walk) {
		const f0 = gaitFoot(ph, STRIDE, 2), f1 = gaitFoot(ph + 0.5, STRIDE, 2);
		feet = [[f0[0], f0[1], f0[1] < -0.2 ? 0.25 : 0], [f1[0], f1[1], f1[1] < -0.2 ? 0.25 : 0]];
		hipY = -14 + Math.cos(ph * TAU * 2) * 0.4;
		lean = mode === 'barrow' ? 0.16 : 0.06;
	} else if (mode === 'rake') lean = 0.18 + Math.sin(t * 2.4) * 0.05;
	else if (mode === 'water') lean = 0.12;
	else if (mode === 'sit') {
		// Assis sur le banc : les jambes pendent et se balancent doucement.
		hipX = -0.6; hipY = -13.6; lean = -0.06;
		const k = Math.sin(t * 1.3) * 0.6;
		feet = [[5.6 + k, -2.6, -0.2], [6.6 - k, -2.4, -0.2]];
	} else if (mode === 'pick') {
		// Sur la pointe des pieds pour attraper un fruit, puis on redescend.
		const up = Math.max(0, Math.sin(t * 1.6));
		hipY = -14.15 - up * 0.9; lean = -0.12; head = -0.35;
		feet = [[-0.8, 0, up * 0.5], [1.2, 0, up * 0.5]];
	} else if (mode === 'gaze') {
		// On souffle un peu : poids sur une jambe, le regard au loin, une légère oscillation.
		hipX = Math.sin(t * 0.6) * 0.3; lean = -0.04; head = -0.12 + Math.sin(t * 0.4) * 0.06;
		feet = [[-1.6, 0, 0], [1.8, 0, 0]];
	}
	const swing = walk ? Math.sin(ph * TAU) : 0;
	// La jambe et le bras du fond, plus sombres.
	leg(ctx, hipX - 0.4, hipY, feet[0][0], feet[0][1], C.legsFar, feet[0][2]);
	ctx.save();
	ctx.translate(hipX, hipY);
	ctx.rotate(lean);
	const shX = -0.4, shY = -8.4;
	const back = mode === 'gaze' ? [-0.5, -1.6] : mode === 'pick' ? [0.25, 1.2] : mode === 'sit' ? [0.4, 1.3]
		: mode === 'barrow' ? [0.9, 1.1] : mode === 'rake' ? [0.7, 1.4] : mode === 'water' ? [0.2, 0.5] : walk ? [swing * 0.5, swing * 0.5 + 0.35] : [0.08, 0.2];
	const bh = arm(ctx, shX + 0.6, shY + 0.6, back[0], back[1], C.sh);
	// Un panier au bras : pendant la cueillette, et en rapportant les fruits.
	if (mode === 'pick' || s.basket) basket(ctx, bh[0], bh[1], s.basket);
	ctx.restore();
	leg(ctx, hipX + 0.4, hipY, feet[1][0], feet[1][1], C.legs, feet[1][2]);

	ctx.save();
	ctx.translate(hipX, hipY);
	ctx.rotate(lean);
	// Le buste : une chemise qui suit le dos et la poitrine, ceinture ou salopette, puis la tête.
	ctx.fillStyle = C.shirt;
	ctx.beginPath();
	ctx.moveTo(-2.8, 0.6);
	ctx.bezierCurveTo(-3.5, -3.5, -3.6, -6.6, -2.4, -8.8);
	ctx.quadraticCurveTo(-0.6, -9.9, 1.6, -9.2);
	ctx.bezierCurveTo(3.2, -7.4, 3.3, -4.4, 2.9, -2);
	ctx.lineTo(2.7, 0.6);
	ctx.closePath();
	ctx.fill();
	if (fem) {
		// Tablier clair noué dans le dos.
		ctx.fillStyle = '#EFE6CE';
		ctx.beginPath(); ctx.moveTo(0.6, -6.4); ctx.lineTo(3, -6.2); ctx.quadraticCurveTo(3.6, -1, 3.4, 4.6); ctx.lineTo(0.4, 4.4); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = '#D8CCB0'; ctx.lineWidth = 0.5;
		ctx.beginPath(); ctx.moveTo(0.6, -2); ctx.lineTo(-2.9, -1.6); ctx.stroke();
	} else {
		// Salopette : le plastron, une bretelle, une poche.
		ctx.fillStyle = C.legs;
		ctx.beginPath(); ctx.moveTo(-2.6, 0.8); ctx.lineTo(-2.4, -2.2); ctx.lineTo(0.2, -2.4); ctx.lineTo(0.4, -6.4); ctx.lineTo(2.9, -6.2); ctx.quadraticCurveTo(3.2, -2, 2.8, 0.8); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = C.legs; ctx.lineWidth = 0.9;
		ctx.beginPath(); ctx.moveTo(0.8, -6.3); ctx.quadraticCurveTo(-0.6, -8.6, -2.2, -8.2); ctx.stroke();
		ctx.fillStyle = C.legsFar; ctx.fillRect(1.1, -5.2, 1.4, 1.2);
		ell(ctx, 0.9, -6, 0.35, 0.35, 0, '#E8C060');
	}
	// Le cou et la tête (de profil : nez, oreille, œil, sourcil), cheveux, barbe, chapeau de paille.
	ctx.save();
	ctx.translate(0.4, -9.6);
	ctx.rotate(head);
	ctx.fillStyle = SKIN_SH; ctx.fillRect(-0.4, -1.4, 1.6, 1.8);
	ell(ctx, 0.6, -3.4, 2.2, 2.45, 0, SKIN);
	ell(ctx, 2.75, -3.3, 0.55, 0.62, 0.3, SKIN);
	ell(ctx, 2.15, -1.9, 0.6, 0.3, 0, '#C07860');
	ell(ctx, 1.6, -3.9, 0.32, 0.38, 0, '#2A1C14');
	ctx.strokeStyle = C.hair; ctx.lineWidth = 0.35; ctx.lineCap = 'round';
	ctx.beginPath(); ctx.moveTo(1.1, -4.6); ctx.lineTo(2.2, -4.5); ctx.stroke();
	ell(ctx, -0.5, -3.3, 0.6, 0.85, 0, SKIN_SH);
	ell(ctx, -1.05, -3.8, 1.25, 1.9, 0.15, C.hair);
	if (fem) {
		// La natte, qui se balance en marchant.
		ctx.strokeStyle = C.hair; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(-1.4, -2.6); ctx.quadraticCurveTo(-2.6 - swing * 0.6, 0, -2.3 - swing, 2.6); ctx.stroke();
		ell(ctx, -2.3 - swing, 2.9, 0.6, 0.5, 0, '#E8B860');
	} else {
		ctx.fillStyle = C.hair;
		ctx.beginPath(); ctx.moveTo(-0.2, -2.6); ctx.quadraticCurveTo(0.6, -0.4, 2.3, -1.2); ctx.quadraticCurveTo(2.6, -1.6, 2.2, -1.9); ctx.quadraticCurveTo(1, -1.2, 0.2, -2.8); ctx.fill();
	}
	ell(ctx, 0.5, -5.6, 4.6, 0.95, -0.04, '#D8A850');
	ell(ctx, 0.3, -6.5, 2.4, 1.5, 0, '#E8C060');
	ctx.fillStyle = fem ? '#D0607A' : '#8A5A34'; ctx.fillRect(-2.05, -5.95, 4.7, 0.6);
	if (fem) { ell(ctx, 2.4, -6.2, 0.9, 0.9, 0, '#F2F0E8'); ell(ctx, 2.4, -6.2, 0.38, 0.38, 0, '#F2C230'); }
	ctx.restore();
	// Le bras proche, et ce qu'il tient.
	const rk = Math.sin(t * 2.4);
	if (mode === 'rake') {
		const a = 0.85 + rk * 0.35;
		const [hx, hy] = arm(ctx, 0.6, shY + 0.6, a, a + 0.55, C.shirt);
		ctx.restore();
		const w = toWorld(hipX, hipY, lean, hx, hy);
		const tx = w[0] + 15 * Math.cos(0.55 + rk * 0.18), ty = w[1] + 15 * Math.sin(0.55 + rk * 0.18);
		ctx.strokeStyle = '#8A5A2E'; ctx.lineWidth = 0.9;
		ctx.beginPath(); ctx.moveTo(w[0] - 5 * Math.cos(0.55), w[1] - 5 * Math.sin(0.55)); ctx.lineTo(tx, Math.min(ty, -0.5)); ctx.stroke();
		ctx.strokeStyle = '#4A3A2E'; ctx.lineWidth = 0.7;
		ctx.beginPath(); ctx.moveTo(tx - 1, -1.2); ctx.lineTo(tx + 4.2, -1.2);
		for (let i = 0; i < 5; i++) { ctx.moveTo(tx - 0.6 + i * 1.15, -1.2); ctx.lineTo(tx - 0.6 + i * 1.15, 0.4); }
		ctx.stroke();
		return;
	}
	if (mode === 'water') {
		const [hx, hy] = arm(ctx, 0.6, shY + 0.6, 1.25, 1.55, C.shirt);
		ctx.restore();
		const [wx, wy] = toWorld(hipX, hipY, lean, hx, hy);
		ell(ctx, wx + 2.4, wy + 1.8, 3, 2.3, 0, '#7A9AA8');
		ell(ctx, wx + 1.4, wy + 0.6, 1.6, 0.5, 0, '#5E7E8C');
		ctx.strokeStyle = '#7A9AA8'; ctx.lineWidth = 0.9;
		ctx.beginPath(); ctx.moveTo(wx + 4.6, wy + 1.2); ctx.lineTo(wx + 9.4, wy + 3.8); ctx.stroke();
		ctx.fillStyle = 'rgba(150,200,230,0.7)';
		for (let i = 0; i < 4; i++) {
			const u = (t * 2.2 + i / 4) % 1;
			ctx.beginPath(); ctx.arc(wx + 9.8 + u * 2, wy + 4 + u * -(wy + 4), 0.45, 0, TAU); ctx.fill();
		}
		return;
	}
	if (mode === 'barrow') {
		const [hx, hy] = arm(ctx, 0.6, shY + 0.6, 0.95, 1.15, C.shirt);
		ctx.restore();
		const [wx, wy] = toWorld(hipX, hipY, lean, hx, hy);
		barrow(ctx, wx, wy, s);
		return;
	}
	const front = mode === 'gaze' ? [-0.45, -1.7] : mode === 'sit' ? [0.55, 1.45]
		: mode === 'pick' ? [Math.PI - 0.45 + Math.sin(t * 1.6) * 0.18, Math.PI - 0.25 + Math.sin(t * 1.6) * 0.25]
		: walk ? [-swing * 0.5, -swing * 0.5 + 0.35] : [0.05, 0.18 + breath * 0.2];
	const [hx, hy] = arm(ctx, 0.6, shY + 0.6, front[0], front[1], C.shirt);
	// Un fruit dans la main levée, de temps en temps.
	if (mode === 'pick' && Math.sin(t * 1.6) > 0.6) ell(ctx, hx, hy - 0.8, 0.9, 1, 0, s.fruit ?? '#D8402E');
	ctx.restore();
	// La laisse du chien, tenue par la main proche pendant la promenade (le garden la prolonge jusqu'au collier).
	if (mode === 'stroll') s.hand = toWorld(hipX, hipY, lean, hx, hy);
}

/** Un point du buste (repère tourné de `lean` autour de la hanche) ramené dans le repère du personnage. */
function toWorld(hipX, hipY, lean, x, y) {
	const c = Math.cos(lean), sn = Math.sin(lean);
	return [hipX + x * c - y * sn, hipY + x * sn + y * c];
}

/** Panier d'osier tenu par l'anse ; plein de fruits au retour. */
function basket(ctx, hx, hy, full) {
	ctx.strokeStyle = '#8A5A2E'; ctx.lineWidth = 0.5;
	ctx.beginPath(); ctx.arc(hx, hy + 2.2, 2.2, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
	ctx.fillStyle = '#B88A4E';
	ctx.beginPath(); ctx.moveTo(hx - 2.6, hy + 2.2); ctx.lineTo(hx + 2.6, hy + 2.2); ctx.lineTo(hx + 1.9, hy + 4.6); ctx.lineTo(hx - 1.9, hy + 4.6); ctx.closePath(); ctx.fill();
	ctx.strokeStyle = '#8A6234'; ctx.lineWidth = 0.3;
	ctx.beginPath(); ctx.moveTo(hx - 2.3, hy + 3.2); ctx.lineTo(hx + 2.3, hy + 3.2); ctx.moveTo(hx - 2.1, hy + 4); ctx.lineTo(hx + 2.1, hy + 4); ctx.stroke();
	if (full) for (const [x, c] of [[-1.3, '#D8402E'], [0, '#E05A34'], [1.3, '#C8B848']]) ell(ctx, hx + x, hy + 1.8, 0.95, 0.9, 0, c);
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
	chamois: (ctx, t, mode, p, s) => quadruped(ctx, s, p.ibex ? IBEX : CHAMOIS),
	fox: (ctx, t, mode, p, s) => quadruped(ctx, s, FOX),
	farmer: (ctx, t, mode, p, s) => farmer(ctx, s),
	dog: (ctx, t, mode, p, s) => pet(ctx, s, DOG),
	cat: (ctx, t, mode, p, s) => pet(ctx, s, CAT),
};

/** Allure de chaque bête : durée d'un bond ou longueur d'une foulée, vitesse au sol. */
export const GAIT = {
	rabbit: { hop: 0.46, len: 24 },
	hare: { hop: 0.42, len: 34 },
	squirrel: { hop: 0.38, len: 20 },
	roe: { stride: 18, speed: 16 },
	chamois: { stride: 16, speed: 14 },
	fox: { stride: 20, speed: 30 },
	farmer: { stride: 27, speed: 18 },
	dog: { stride: 24, speed: 26 },
	cat: { stride: 16, speed: 16 },
};
