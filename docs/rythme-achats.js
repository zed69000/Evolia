// Rythme des achats, ouverture par ouverture (l'appli ouverte plusieurs fois par jour, une sortie par jour).
// node rythme.js [jeu.json]  — le fichier remplace les réglages (pour comparer l'actuel et une proposition).
const fs = require('fs');
const P = Object.assign({
	LADDER: { massif: [50, 0.6, 0], ruche: [300, 3, 1], hotel: [1200, 14, 4], nichoir: [6000, 60, 8], mare: [30000, 280, 15], haie: [150000, 1300, 25] },
	UPG_AT: [1, 5, 25, 50], UPG_COST: [5, 25, 250, 2500], KM_HOURS: 4, REST: 0.05, WALK: 60, FIRST_HIVE: 100, GROW: 1.15,
}, process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {});
const ORDER = Object.keys(P.LADDER);
const rnd = (a, b) => a + Math.random() * (b - a);
const COST = { herbe: 15, fleur: 60, buisson: 150, arbre: 400 };
const MIX = { herbe: [['herbe', 1]], fleur: [['herbe', .25], ['fleur', .75]], buisson: [['herbe', .15], ['fleur', .25], ['buisson', .6]], arbre: [['fleur', .15], ['buisson', .25], ['arbre', .6]] };
const CAP = { herbe: 60, fleur: 40, buisson: 6, arbre: 2 };
function pace(kmh) {
	if (kmh >= 7.5) return { eff: 125 * (kmh >= 9 ? 2.1 : 1.8), plant: 'arbre' };
	if (kmh >= 5.5) return { eff: 125 * 1.25, plant: 'buisson' };
	if (kmh >= 3.5) return { eff: 125, plant: 'fleur' };
	return { eff: 100, plant: 'herbe' };
}
const PROFILES = [
	['Sédentaire', 0.10, { km: () => rnd(0.2, 1), kmh: 3.8, p: 0.45 }],
	['Marcheur occasionnel', 0.20, { km: () => rnd(1, 2.5), kmh: 4.5, p: 0.6 }],
	['Marcheur régulier', 0.25, { km: () => rnd(2.5, 4.5), kmh: 5, p: 0.85 }],
	['Marcheur rapide', 0.15, { km: () => rnd(3, 6), kmh: 6, p: 0.85 }],
	['Coureur', 0.15, { km: () => rnd(5, 10), kmh: 10, p: 0.6 }],
	['Sportif du week-end', 0.10, { km: () => rnd(8, 15), kmh: 7, p: 1, weekend: true }],
	['Grand sportif', 0.05, { km: () => rnd(10, 20), kmh: 10, p: 0.9 }],
];

function play(pr, days = 90) {
	const S = { nectar: 0, km: 0, species: 2, own: { ruche: 1 }, upg: {}, plants: { herbe: 0, fleur: 1, buisson: 0, arbre: 0 }, growing: {}, cells: 1, size: 0.4, grows: 0, kmSpent: 0, boostUntil: 0, t: 0 };
	const M = { buys: [], upgGain: [], opens: [], actN: 0, idleN: 0, prodAt: {}, first: {} };
	const homes = () => ORDER.reduce((a, k) => a + (S.own[k] ?? 0), 0);
	const unit = k => P.LADDER[k][1] * 2 ** (S.upg[k] ?? 0);
	const prodH = () => {
		const green = S.plants.fleur + 3 * S.plants.buisson + 8 * S.plants.arbre + S.plants.herbe * .25;
		const cover = homes() ? Math.min(1, green / (2 * homes())) : 1;
		return ORDER.reduce((a, k) => a + (S.own[k] ?? 0) * unit(k), 0) * (1 + S.species / 100) * cover;
	};
	// Production continue entre deux instants (en heures depuis le début).
	const run = to => {
		const from = S.t; if (to <= from) return;
		const be = Math.min(to, Math.max(from, S.boostUntil));
		const h = (be - from) + (to - be) * P.REST, n = prodH() * h;
		S.nectar += n; M.idleN += n; S.t = to;
	};
	const buy = (d, h) => {
		let count = 0;
		for (let g = 0; g < 300; g++) {
			const o = [];
			if (S.size < 1) o.push({ k: 'terrain', c: Math.round(60 * 1.35 ** S.grows / 10) * 10, v: 1e9, go: () => { S.size = Math.min(1, S.size + .15); S.grows++; } });
			else { const pk = 1.5 * 1.5 ** (S.cells - 1); if (S.km - S.kmSpent >= pk) o.push({ k: 'parcelle', c: Math.round(600 * 2.3 ** (S.cells - 1) / 10) * 10, v: 1e8, go: () => { S.cells++; S.size = .4; S.kmSpent += pk; } }); }
			ORDER.forEach((k, i) => {
				if (S.km < P.LADDER[k][2] || (i > 1 && !S.own[ORDER[i - 1]])) return;
				const n = S.own[k] ?? 0, c = (k === 'ruche' && !n) ? P.FIRST_HIVE : Math.round(P.LADDER[k][0] * P.GROW ** n / 5) * 5;
				o.push({ k, c, v: unit(k) / c, go: () => { S.own[k] = n + 1; } });
				const u = S.upg[k] ?? 0;
				if (u < P.UPG_AT.length && n >= P.UPG_AT[u]) {
					const c2 = P.LADDER[k][0] * P.UPG_COST[u];
					o.push({ k: 'upg', c: c2, v: n * unit(k) / c2, go: () => { const before = prodH(); S.upg[k] = u + 1; M.upgGain.push({ d, gain: before ? prodH() / before - 1 : 0 }); } });
				}
			});
			o.sort((a, b) => b.v - a.v || a.c - b.c);
			const x = o.find(z => z.c <= S.nectar);
			if (!x) break;
			S.nectar -= x.c; x.go(); count++; M.buys.push(d + h / 24);
			if (M.first[x.k] == null) M.first[x.k] = d;
		}
		return count;
	};
	// L'intro : 100 nectar de la fiche → la ruche (déjà posée), puis le joueur ouvre l'appli plusieurs fois par jour.
	for (let d = 0; d < days; d++) {
		const weekend = d % 7 === 5 || d % 7 === 6;
		let kmToday = 0, kmh = pr.kmh;
		if (pr.weekend) { kmToday = weekend ? pr.km() : rnd(0.2, 0.8); if (!weekend) kmh = 4.5; }
		else if (d === 0 || Math.random() < pr.p) kmToday = pr.km() * rnd(0.7, 1.3);
		const walkAt = d * 24 + rnd(8, 19);
		// Les ouvertures : 3 à 6 dans la journée, plus une juste après la sortie.
		const opens = Array.from({ length: Math.floor(rnd(3, 7)) }, () => d * 24 + rnd(7.5, 23)).concat(kmToday ? [walkAt + kmToday / kmh + 0.01] : []).sort((a, b) => a - b);
		let walked = !kmToday;
		for (const t of opens) {
			if (!walked && t > walkAt) {
				run(walkAt);
				const pc = pace(kmh), effort = kmToday * pc.eff, ph = prodH();
				const n = kmToday * P.WALK + kmToday * P.KM_HOURS * ph;
				S.nectar += n; M.actN += n; S.km += kmToday;
				S.t = walkAt + kmToday / kmh;
				S.boostUntil = Math.max(S.boostUntil, S.t) + Math.min(8, kmToday / kmh * 7);
				S.boostUntil = Math.min(S.boostUntil, S.t + 8);
				for (const [ty, share] of MIX[pc.plant]) {
					let e = effort * share;
					while (e > 0 && S.plants[ty] < CAP[ty] * (S.cells - 1 + S.size)) {
						const g = (S.growing[ty] ?? 0) + e / COST[ty];
						if (g >= 1) { S.plants[ty]++; e = (g - 1) * COST[ty]; S.growing[ty] = 0; } else { S.growing[ty] = g; e = 0; }
					}
				}
				// Espèces (simplifié) : 6, 4, 3 puis 2 par jour, 10 nectar la fiche.
				const q = [6, 4, 3][d] ?? 2; S.species = Math.min(319, S.species + q); S.nectar += q * 10; M.actN += q * 10;
				walked = true;
			}
			run(Math.max(t, S.t));
			const before = M.buys.length;
			buy(d, t - d * 24);
			M.opens.push({ d, bought: M.buys.length - before });
		}
		run((d + 1) * 24);
		M.prodAt[d] = prodH();
	}
	return { M, S };
}

const N = 500, out = {};
for (let i = 0; i < N; i++) {
	let r = Math.random(), idx = 0;
	for (; idx < PROFILES.length - 1 && r > PROFILES[idx][1]; idx++) r -= PROFILES[idx][1];
	(out[PROFILES[idx][0]] ??= []).push(play(PROFILES[idx][2]));
}
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed?.(2) ?? s[Math.floor(s.length / 2)] : null; };
const rows = [];
for (const [name, runs] of Object.entries(out)) {
	const buysIn = (a, b) => med(runs.map(r => r.M.buys.filter(x => x >= a && x < b).length));
	const openOk = (a, b) => med(runs.map(r => { const o = r.M.opens.filter(x => x.d >= a && x.d < b); return Math.round(100 * o.filter(x => x.bought).length / o.length); }));
	const upg = (a, b) => med(runs.flatMap(r => r.M.upgGain.filter(x => x.d >= a && x.d < b).map(x => Math.round(x.gain * 100))));
	const f = k => med(runs.map(r => r.M.first[k] ?? null));
	rows.push({ name, n: runs.length, act: Math.round(100 * med(runs.map(r => r.M.actN / (r.M.actN + r.M.idleN)))),
		achatsJ1: buysIn(0, 1), achatsS1: buysIn(0, 7), achatsS4: buysIn(21, 28), ouvAvecAchatS1: openOk(0, 7), ouvAvecAchatS4: openOk(21, 28),
		gainAmelioS1: upg(0, 7), amelioS1: med(runs.map(r => r.M.upgGain.filter(x => x.d < 7).length)),
		prodJ1: Math.round(med(runs.map(r => r.M.prodAt[0]))), prodJ7: Math.round(med(runs.map(r => r.M.prodAt[6]))), prodJ30: Math.round(med(runs.map(r => r.M.prodAt[29]))), prodJ90: Math.round(med(runs.map(r => r.M.prodAt[89]))),
		hotel: f('hotel'), nichoir: f('nichoir'), mare: f('mare'), haie: f('haie') });
}
console.table(rows);
