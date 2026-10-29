// Récolte : les pas comptés par le téléphone pendant que l'appli était fermée.
// Le système (Santé sur iOS, Health Connect sur Android) compte en continu ; à l'ouverture,
// on relit les pas depuis la dernière récolte et on en déduit l'allure minute par minute.

import { ACTIVITY_BY_ID, effortFor, dayKey } from './state.js';

const MIN = 60000;
const MAX_BACK = 7 * 24 * 60 * MIN;

// Cadence (pas par minute) → allure. La foulée grandit avec la cadence.
const CADENCE = [
	{ max: 45, act: 'menage', stride: 0.5 },
	{ max: 90, act: 'marche-lente', stride: 0.6 },
	{ max: 110, act: 'marche', stride: 0.72 },
	{ max: 135, act: 'marche-rapide', stride: 0.8 },
	{ max: 155, act: 'jogging', stride: 1.0 },
	{ max: Infinity, act: 'course', stride: 1.2 },
];

export function classifyCadence(spm) {
	return CADENCE.find(c => spm < c.max);
}

/** Répartit des échantillons { start, end, steps } minute par minute. */
function toMinutes(samples, from, to) {
	const minutes = new Map();
	for (const s of samples) {
		const start = Math.max(s.start, from), end = Math.min(Math.max(s.end, s.start + MIN), to);
		if (end <= start || s.steps <= 0) continue;
		const share = s.steps * ((end - start) / Math.max(MIN, s.end - s.start));
		for (let t = Math.floor(start / MIN) * MIN; t < end; t += MIN) {
			const part = (Math.min(end, t + MIN) - Math.max(start, t)) / (end - start);
			minutes.set(t, (minutes.get(t) ?? 0) + share * part);
		}
	}
	return minutes;
}

/**
 * Transforme les pas en effort par allure. `skip` : intervalles [début, fin] déjà comptés
 * par une marche suivie en direct, pour ne pas compter deux fois.
 */
export function digest(samples, from, to, skip = []) {
	const groups = {}, days = {};
	let steps = 0, distance = 0;
	for (const [t, n] of toMinutes(samples, from, to)) {
		if (n < 8) continue; // quelques pas isolés : bruit du capteur
		if (skip.some(([a, b]) => t + MIN > a && t < b)) continue;
		const band = classifyCadence(n);
		const act = ACTIVITY_BY_ID[band.act];
		const dist = n * band.stride;
		const speed = n * band.stride * 0.06;
		const g = groups[act.id] ??= { act, steps: 0, minutes: 0, distance: 0, effort: 0 };
		g.steps += n;
		g.minutes += 1;
		g.distance += dist;
		g.effort += effortFor(dist, speed, act);
		steps += n;
		distance += dist;
		const k = dayKey(new Date(t));
		days[k] = (days[k] ?? 0) + dist;
	}
	return { groups: Object.values(groups), steps, distance, days };
}

// ─── Sources ──────────────────────────────────────────────────

const cap = () => window.Capacitor;
const plugin = name => (cap()?.isNativePlatform?.() ? cap().registerPlugin(name) : null);

/** Santé (iOS) / Health Connect (Android), via @capgo/capacitor-health. */
const health = {
	id: 'health',
	label: cap()?.getPlatform?.() === 'ios' ? 'Santé' : 'Health Connect',
	async available() {
		const H = plugin('Health');
		if (!H) return false;
		try { return (await H.isAvailable()).available; } catch (e) { return false; }
	},
	async authorize() {
		const H = plugin('Health');
		const r = await H.requestAuthorization({ read: ['steps'], write: [] });
		// iOS ne dit jamais si la lecture est autorisée ; ailleurs la réponse varie selon les versions :
		// le plus sûr est d'essayer de lire la dernière heure.
		if (cap().getPlatform() === 'ios' || r?.readAuthorized?.includes?.('steps')) return true;
		try {
			const now = Date.now();
			await H.readSamples({ dataType: 'steps', startDate: new Date(now - 3600000).toISOString(), endDate: new Date(now).toISOString(), limit: 1 });
			return true;
		} catch (e) { return false; }
	},
	async read(from, to) {
		const H = plugin('Health');
		const range = { startDate: new Date(from).toISOString(), endDate: new Date(to).toISOString() };
		const [{ samples }, { samples: hourly }] = await Promise.all([
			H.readSamples({ dataType: 'steps', ...range, limit: 20000, ascending: true }),
			H.queryAggregated({ dataType: 'steps', ...range, bucket: 'hour', aggregation: 'sum' }),
		]);
		const raw = samples.map(s => ({ start: Date.parse(s.startDate), end: Date.parse(s.endDate), steps: s.value }));
		// Téléphone et montre peuvent compter les mêmes pas : on ramène chaque heure au total dédoublonné.
		for (const h of hourly) {
			const a = Date.parse(h.startDate), b = Date.parse(h.endDate);
			const inHour = raw.filter(s => s.start >= a && s.start < b);
			const sum = inHour.reduce((n, s) => n + s.steps, 0);
			if (sum > h.value && sum > 0) for (const s of inHour) s.steps *= h.value / sum;
		}
		return raw;
	},
};

/** Podomètre du téléphone (CMPedometer garde 7 jours d'historique sur iOS), via @capgo/capacitor-pedometer. */
const pedometer = {
	id: 'pedometer',
	label: 'Podomètre',
	async available() {
		const P = plugin('CapacitorPedometer');
		if (!P) return false;
		try { return (await P.isAvailable()).stepCounting; } catch (e) { return false; }
	},
	async authorize() {
		return (await plugin('CapacitorPedometer').requestPermissions()).activityRecognition === 'granted';
	},
	async read(from, to) {
		const P = plugin('CapacitorPedometer');
		const out = [];
		for (let t = from; t < to; t += 10 * MIN) {
			const end = Math.min(to, t + 10 * MIN);
			const m = await P.getMeasurement({ start: t, end });
			if (m.numberOfSteps > 0) out.push({ start: t, end, steps: m.numberOfSteps });
		}
		return out;
	},
};

/** Journée imaginaire, pour tester au bureau (?dev=1). */
const mock = {
	id: 'mock',
	label: 'Journée simulée',
	async available() { return true; },
	async authorize() { return true; },
	async read(from, to) {
		const out = [];
		const add = (startMin, minutes, spm) => {
			const start = from + startMin * MIN;
			if (start + minutes * MIN > to) return;
			for (let i = 0; i < minutes; i++) {
				out.push({ start: start + i * MIN, end: start + (i + 1) * MIN, steps: Math.max(0, spm + (Math.random() - 0.5) * 16) });
			}
		};
		const span = Math.max(1, (to - from) / MIN);
		const k = span / (16 * 60); // une « journée » de 16 h étalée sur la période
		add(20 * k, 35, 28);   // ménage du matin
		add(120 * k, 25, 104); // marche vers le travail
		add(400 * k, 15, 30);  // cuisine
		add(560 * k, 30, 122); // marche rapide du midi
		add(780 * k, 20, 162); // footing du soir
		add(900 * k, 25, 70);  // balade tranquille
		return out;
	},
};

export const SOURCES = { health, pedometer, mock };

/** Première source disponible sur cet appareil. */
export async function bestSource(dev) {
	for (const s of [health, pedometer]) if (await s.available()) return s;
	return dev ? mock : null;
}

export async function harvest(source, since, skip) {
	const to = Date.now();
	const from = Math.max(since, to - MAX_BACK);
	if (to - from < MIN) return null;
	const samples = await source.read(from, to);
	return { from, to, ...digest(samples, from, to, skip) };
}
