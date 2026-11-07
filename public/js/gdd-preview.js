// GDD preview scenes. Imported by main.js only when Tuning.preview is true (?tuning=preview), never otherwise.
// The inline guard in index.html has already replaced storage and sensors by the time this runs, so the garden
// built here lives in memory and disappears with the page. tools/app/copy-web.mjs leaves this file out of the app.

import { addDistance, dayKey } from './state.js';
import { addBoost, addWaiting, boostLeft, boostMult, habitatBonus, maxBoostH, rates, vitality } from './idle.js';
import { itemCost, ITEMS } from './deco.js';
import { collection, giftFor } from './daily.js';
import { PLACES, SPECIES, SPECIES_BY_ID } from './species.js';
import { DECOR, PLANT_TYPES, plantName } from './plants.js';
import { fmtNum } from './format.js';

let api, g, s, pl, voiceOut = null;
const params = new URLSearchParams(location.search);
const slug = params.get('gdd') ?? '';
const $ = q => document.querySelector(q);
const wait = ms => new Promise(r => setTimeout(r, ms));
const num = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const round = (n, d = 2) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });
const minutes = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const debug = window.evoliaPreview = { slug, runs: 0, beat: '', measures: {} };

// ─── Caption ─────────────────────────────────────────────────

const NONE = 'Aucun curseur dans ce chapitre';
const NONE_STEP = 'Aucun curseur pour cette étape';
let chapterTitle = '', liveFn = null;

function buildLegend() {
	const style = document.createElement('style');
	style.textContent = `
		html, body { overflow: hidden; }
		#gdd-legend { max-width: 480px; margin: 0 auto; min-height: 58px; padding: 5px 10px 6px; box-sizing: border-box; background: #FDF7E7; color: #3A2A20;
			border-bottom: 1.5px dashed #C9BE9C; font: 600 11.5px/14.5px Nunito, system-ui, sans-serif; pointer-events: none; }
		#gdd-title { display: block; font: 400 13px/16px Courgette, Georgia, serif; color: #1F6B47; }
		#gdd-live { display: block; color: #A8582A; font-weight: 800; min-height: 14.5px; }
		#gdd-sliders { display: block; color: #5A6B4E; }
		#app { height: calc(100dvh - var(--gdd-legend, 58px)); }
		#gdd-finger, #gdd-finger2 { position: absolute; z-index: 60; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; pointer-events: none; display: none;
			background: rgba(253, 247, 231, .55); border: 2px solid rgba(58, 42, 32, .7); box-shadow: 0 2px 6px rgba(40, 30, 20, .3); transition: left .6s ease, top .6s ease, transform .15s ease; }
		#gdd-finger.press { transform: scale(.72); }
		.gdd-quiet #toasts, .gdd-noquest #quest { display: none !important; }`;
	document.head.appendChild(style);
	const el = document.createElement('div');
	el.id = 'gdd-legend';
	el.innerHTML = '<span id="gdd-title"></span><span id="gdd-live"></span><span id="gdd-sliders"></span>';
	document.body.insertBefore(el, document.body.firstChild);
	const fit = () => document.documentElement.style.setProperty('--gdd-legend', `${el.offsetHeight}px`);
	new ResizeObserver(fit).observe(el);
	fit();
	setInterval(refreshLive, 250);
}

function refreshLive() {
	const text = liveFn?.() ?? '';
	const el = $('#gdd-live');
	if (el && el.textContent !== text) el.textContent = text;
}

/** One step of a scene: what is on screen, a measure refreshed live, and the sliders acting on it. */
function beat(what, sliders, live = null) {
	debug.beat = what;
	$('#gdd-title').textContent = `${chapterTitle} · ${what}`;
	$('#gdd-sliders').textContent = sliders;
	liveFn = typeof live === 'string' ? () => live : live;
	refreshLive();
}

// ─── Demo garden ─────────────────────────────────────────────

const BIOME_ORDER = ['prairie', 'marais', 'foret', 'montagne', 'littoral'];
let baseline;

function plant(type, count, ci) {
	for (let i = 0; i < count; i++) g.spawn(s.place, type, 1, g.place_(s.place, type, ci), ci);
}

function put(kind, x, y, extra = {}) {
	const spot = g.nearestPlace(kind, x, y);
	if (!spot) return null;
	const it = g.placeItem(kind, spot[0], spot[1], 0);
	it.paid = ITEMS[kind].cost;
	return Object.assign(it, extra);
}

function pastDays() {
	[0, 3.4, 2.1, 0, 4.2, 3, 3.8].forEach((km, i) => {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const k = dayKey(d);
		s.days[k] = km * 1000;
		(s.effortDays ??= {})[k] = km * 125;
	});
	s.days[dayKey()] = 1200;
	s.effortDays[dayKey()] = 150;
}

function buildGarden() {
	const now = Date.now();
	s.createdAt = now - 24 * 86400000;
	s.totals = { distance: 84000, effort: 10500, walks: 26, steps: 112000 };
	s.seenNight = s.seenRain = true;
	s.sound = { on: false, vol: 0.7 };
	s.music = { on: false, vol: 0.5 };
	s.gardener = 'fermiere';
	s.pet = 'chien';
	s.complete = Object.fromEntries(PLACES.map(p => [p.id, now]));
	s.goalKm = 3.5;
	s.backupAt = now - 2 * 86400000;
	pastDays();
	['prairie', ...BIOME_ORDER.slice(1)].forEach((b, i) => g.openCell(i + 1, b));
	pl.km = 11;
	pl.xp = 1500;
	for (const [key, d] of Object.entries(DECOR)) if (!d.always) pl.unlocked[key] = now;
	put('cabane', 110, 420);
	put('potager', 235, 480, { km0: 82.8 });
	put('potager', 300, 480, { km0: 82.8 });
	put('poulailler', 330, 640, { km0: 83.7 });
	put('collecteur', 190, 640, { level: 3 });
	put('collecteur', 60, 830, { level: 3 });
	put('ruche', 80, 620);
	put('hotel', 130, 760);
	put('massif', 240, 760);
	put('banc', 320, 790);
	put('mangeoire', 60, 700);
	for (const ci of [0, 1]) { plant('fleur', 12, ci); plant('herbe', 12, ci); plant('buisson', 3, ci); }
	plant('arbre', 2, 0);
	for (const ci of [2, 3, 4, 5]) { plant('fleur', 7, ci); plant('herbe', 6, ci); plant('buisson', 2, ci); plant('arbre', 1, ci); }
	for (const p of pl.plants) p.growth = 1;
	api.announceSpecies(true);
	const seen = {};
	for (const sp of SPECIES) {
		if (sp.kind !== 'animal') continue;
		seen[sp.place] = (seen[sp.place] ?? 0) + 1;
		if (sp.place === 'prairie' || seen[sp.place] <= 6) s.species[sp.id] ??= now;
	}
	api.announceSpecies(true);
	s.walks = [5.1, 3.2, 2.4, 4.3, 3.8].map((km, i) => ({ start: now - (i + 1) * 86400000, duration: km * 720, distance: km * 1000, effort: km * 125, matured: { fleur: 1 }, place: s.place }));
	s.daily.streak = 6;
	s.daily.best = 9;
	s.daily.lastActive = s.daily.day;
	s.daily.giftDay = s.daily.day;
	s.nectar = 640;
	s.pending = 0;
	s.ground = 0;
	addWaiting(s, 180, false, s.place);
	s.ground = 14;
	s.pending += 14;
	s.lastHarvest = now;
	s.lastIdle = now;
	s.boostUntil = 0;
	g.builds.length = 0;
	g.particles.length = 0;
	baseline = {
		json: JSON.stringify({ totals: s.totals, days: s.days, effortDays: s.effortDays, nectar: s.nectar, pending: s.pending, ground: s.ground, walks: s.walks, daily: s.daily, goalKm: s.goalKm }),
		km: pl.km, xp: pl.xp, succ: JSON.stringify(pl.succ ?? {}), ids: new Set(pl.plants.map(p => p.id)),
		items: pl.items.map(it => ({ it, stock: it.stock ?? 0, km0: it.km0, level: it.level })),
	};
}

/** Puts the demo garden back as it was built, so that one repetition never leaks into the next. */
function resetDemo() {
	closeAll();
	if (api.session()) { api.endSession(); api.closeModal(); }
	Object.assign(s, JSON.parse(baseline.json));
	delete s.idleLast;
	s.boostUntil = 0;
	s.lastIdle = Date.now();
	pl.km = baseline.km;
	pl.xp = baseline.xp;
	pl.succ = JSON.parse(baseline.succ);
	pl.plants = pl.plants.filter(p => baseline.ids.has(p.id));
	for (const p of pl.plants) p.growth = 1;
	pl.items.length = 0;
	for (const b of baseline.items) { Object.assign(b.it, { stock: b.stock, km0: b.km0, level: b.level }); pl.items.push(b.it); }
	g.current = null;
	g.setFollow(false);
	g.nextPopulate = 0;
	g.hourOverride = params.has('h') ? parseFloat(params.get('h')) : 11;
	g.dateOverride = params.get('date') ?? `${new Date().getFullYear()}-06-15`;
	api.sky.override = params.get('weather') ?? 'clear';
	api.sky.apply(false);
	g.onPeek(false);
	api.renderHud();
	api.renderStatus();
	api.renderDaily();
}

function closeAll() {
	api.closeModal();
	api.eco.close();
	api.species.close();
	api.places.close();
	api.closeDeco();
	api.closeJournal();
	api.closeOptions();
	api.endPlacing();
	api.debugPanel.show(false);
	$('#plant-card').hidden = true;
	fingers();
}

// ─── Scene tools ─────────────────────────────────────────────

/** Sends simulated samples through the game's own tracking path: 30 steps, about 6.6 s, whatever the distance. */
async function walk(kmh, meters) {
	const step = meters / 30;
	for (let i = 0; i < 30; i++) {
		api.onSample({ dist: step, dt: step / (kmh / 3.6), speedKmh: kmh, sim: true });
		await wait(220);
	}
}

/** Ends the running walk; the game opens its own summary. */
async function endWalk() {
	api.endSession();
	await wait(300);
}

function look(x, y, z = 1) { g.setFollow(false); g.flyTo(x, y, z); }
const lookAt = (it, z = 1.1) => look(it.x, it.y - 40, z);

function toScreen(x, y) {
	return [(x - g.cam.cx) * g.base * g.cam.z + g.canvas.clientWidth / 2, (y - g.cam.cy) * g.base * g.cam.z + g.canvas.clientHeight / 2];
}

/** Animals in the free middle part of the screen, between the banner and the bottom sheet. */
function critters() {
	const H = g.canvas.clientHeight, W = g.canvas.clientWidth;
	return g.insects.filter(b => {
		if (b.leaving || b.gone || !SPECIES_BY_ID[b.sp]) return false;
		const [x, y] = toScreen(b.x, b.y);
		return x > 30 && x < W - 30 && y > H * 0.2 && y < H * 0.68;
	});
}

const firstItem = kind => g.items.find(i => i.kind === kind);
const fullestJar = () => g.items.filter(i => i.kind === 'collecteur').sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))[0];
const someFlower = () => pl.plants.find(p => !p.c && p.type === 'fleur' && p.y > 450 && p.y < 720);

async function follow(target, ms, z) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const e = target();
		if (e) look(e.x, e.y - 20, z);
		await wait(300);
	}
}

async function scrollTo(el, top, ms = 1800) {
	const from = el.scrollTop, t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const k = (Date.now() - t0) / ms;
		el.scrollTop = from + (top - from) * k * k * (3 - 2 * k);
		await wait(40);
	}
	el.scrollTop = top;
}

/** Gentle read-through of an open panel, from top to bottom. */
async function browse(id, ms = 3200) {
	const el = $(id);
	el.scrollTop = 0;
	await wait(900);
	await scrollTo(el, Math.min(el.scrollHeight - el.clientHeight, 900), ms);
	await wait(500);
}

async function centerIn(panel, node, ms = 1200) {
	if (!node) return;
	const p = $(panel), top = node.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - p.clientHeight / 2 + node.offsetHeight / 2;
	await scrollTo(p, Math.max(0, top), ms);
}

/** The drawn fingertips of the gesture chapter. Called with no argument, they go away. */
function fingers(...points) {
	for (const [i, id] of ['gdd-finger', 'gdd-finger2'].entries()) {
		let el = $(`#${id}`);
		if (!el && !points[i]) continue;
		if (!el) {
			el = document.createElement('i');
			el.id = id;
			$('#app').appendChild(el);
		}
		el.style.display = points[i] ? 'block' : 'none';
		if (points[i]) { el.style.left = `${points[i][0]}px`; el.style.top = `${points[i][1]}px`; }
	}
}

async function press(ms = 220) {
	const el = $('#gdd-finger');
	el.classList.add('press');
	await wait(ms);
	el.classList.remove('press');
}

async function tapWorld(x, y, hit) {
	const [sx, sy] = toScreen(x, y);
	fingers([sx, sy]);
	await wait(650);
	await press();
	api.endQuest();
	g.onTap({ ...hit, x: sx, y: sy });
}

function tapNow(x, y, hit) {
	const [sx, sy] = toScreen(x, y);
	g.onTap({ ...hit, x: sx, y: sy });
}

// ─── Scenes ──────────────────────────────────────────────────

const SCENES = {
	'vue-ensemble': { title: "Vue d'ensemble", quiet: true, async run() {
		const b = g.bounds();
		beat('tout le jardin', NONE, () => `${g.openCells().length} parcelles · ${collection(s).found} espèces sur ${collection(s).total}`);
		g.onPeek(true);
		look((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, g.zMin());
		await wait(4500);
		g.onPeek(false);
		for (const biome of BIOME_ORDER) {
			const ci = g.heart(biome);
			if (ci < 0) continue;
			beat(`le milieu : ${PLACES.find(p => p.id === biome).name.toLowerCase()}`, NONE, 'Un seul jardin, un milieu par parcelle');
			g.flyToCell(ci);
			await wait(3200);
		}
		g.flyToCell(0);
		beat('bouger fait pousser', NONE, () => `${num((api.session()?.distance ?? 0) / 1000, 2)} km simulés, sans téléphone`);
		await walk(5, 500);
		await endWalk();
		await wait(3500);
	} },

	'boucle-de-jeu': { title: 'Boucle de jeu', async run() {
		const sl = 'Aucun curseur ici : les chiffres sont dans Mécaniques';
		beat('1/5 départ, aucun bouton', sl, () => `La balade démarre seule · ${num((api.session()?.distance ?? 0) / 1000, 2)} km`);
		await walk(5, 500);
		beat("2/5 l'allure choisit la plante", sl, () => `${api.session()?.act?.name ?? ''} · ${g.current ? plantName(g.current) : ''}`);
		await walk(10.5, 500);
		beat('3/5 fin : bilan et élan', sl, () => `Élan ×${fmtNum(boostMult())} pendant ${minutes(boostLeft(s) / 60000)}`);
		await endWalk();
		await wait(3800);
		api.closeModal();
		const jar = fullestJar();
		beat('4/5 vider le collecteur', sl, () => `Bourse : ${num(s.nectar)} nectar`);
		lookAt(jar);
		await wait(1600);
		tapNow(jar.x, jar.y - 40, { item: jar });
		await wait(3600);
		beat('5/5 aménager avec le nectar', sl, () => `Bourse : ${num(s.nectar)} nectar`);
		api.openDeco('habitat');
		await wait(2400);
		api.startPlacing('pierres');
		await wait(1800);
		$('#btn-place').click();
		await wait(2800);
	} },

	personnages: { title: 'Personnages', quiet: true, async run() {
		s.gardener = debug.runs % 2 ? 'fermiere' : 'fermier';
		s.pet = debug.runs % 2 ? 'chien' : 'chat';
		beat(s.gardener === 'fermiere' ? 'la fermière' : 'le fermier', NONE, () => (g.farmer?.hidden ? 'À la cabane : la cheminée fume' : 'Ramasse les œufs, récolte, ratisse, arrose'));
		await follow(() => (g.farmer?.hidden ? firstItem('cabane') : g.farmer), 5000, 1.8);
		beat(s.pet === 'chien' ? 'le chien' : 'le chat', NONE, s.pet === 'chien' ? 'Suit le jardinier partout' : 'Flâne et fait la sieste au soleil');
		await follow(() => g.pet, 3500, 2);
		beat('poules et coqs', NONE, () => `${g.hens?.length ?? 0} bêtes autour du poulailler`);
		await follow(() => g.hens?.[0], 4000, 1.9);
		beat('la faune de jour', NONE, 'Chaque animal a un nom, un rôle, une fiche');
		look(190, 600, 1.2);
		await wait(1500);
		const kinds = new Set();
		for (let n = 0; n < 8 && kinds.size < 3; n++) {
			const b = critters().find(c => !kinds.has(c.kind));
			if (!b) { await wait(500); continue; }
			kinds.add(b.kind);
			look(b.x, b.y, 1.9);
			await wait(1000);
			api.endQuest();
			tapNow(b.x, b.y, { critter: b });
			await wait(2500);
			$('#plant-card').hidden = true;
		}
		beat('la faune de nuit', NONE, 'Hérisson et hulotte sortent, les abeilles dorment');
		g.hourOverride = 22.5;
		look(190, 620, 1.1);
		await wait(5000);
		g.hourOverride = 11;
		beat('toutes les espèces', NONE, () => `${collection(s).found} découvertes sur ${collection(s).total}`);
		api.species.open();
		await browse('#species');
		api.species.open('herisson');
		$('#species').scrollTop = 0;
		await wait(3200);
		api.species.close();
	} },

	controles: { title: 'Contrôles', quiet: true, async run() {
		const W = g.canvas.clientWidth, H = g.canvas.clientHeight;
		look(190, 600, 1);
		await wait(1000);
		beat('glisser', NONE, "L'interface s'efface et revient au relâcher");
		fingers([W * 0.75, H * 0.45]);
		await wait(650);
		await press();
		g.onPeek(true);
		fingers([W * 0.25, H * 0.45]);
		look(310, 600, 1);
		await wait(1400);
		g.onPeek(false);
		fingers();
		beat('pincer', NONE, () => `Zoom ${num(g.cam.z, 1)} (jusqu'à 3,2)`);
		look(190, 620, 1);
		fingers([W * 0.42, H * 0.48], [W * 0.58, H * 0.52]);
		await wait(650);
		fingers([W * 0.2, H * 0.38], [W * 0.8, H * 0.62]);
		look(190, 620, 2.6);
		await wait(2000);
		fingers([W * 0.42, H * 0.48], [W * 0.58, H * 0.52]);
		look(190, 620, 1);
		await wait(1800);
		fingers();
		beat('toucher une plante', NONE, 'Nom, avancement, lien vers sa fiche');
		const flower = someFlower();
		if (flower) {
			look(flower.x, flower.y - 20, 1.3);
			await wait(1400);
			await tapWorld(flower.x, flower.y - 16, { plant: flower });
			await wait(2500);
		}
		$('#plant-card').hidden = true;
		beat('toucher un animal', NONE, 'Nom, nom latin, lien vers sa fiche');
		look(190, 600, 1.2);
		await wait(1000);
		const b = critters()[0];
		if (b) { await tapWorld(b.x, b.y, { critter: b }); await wait(2500); }
		$('#plant-card').hidden = true;
		beat('toucher un collecteur', NONE, () => `Il se vide d'un geste · bourse ${num(s.nectar)}`);
		const jar = fullestJar();
		lookAt(jar);
		await wait(1400);
		await tapWorld(jar.x, jar.y - 40, { item: jar });
		await wait(2800);
		beat('toucher un aménagement', NONE, 'Améliorer, tourner, déplacer, ranger');
		const hotel = firstItem('hotel');
		lookAt(hotel);
		await wait(1400);
		await tapWorld(hotel.x, hotel.y - 30, { item: hotel });
		await wait(3000);
		$('#plant-card').hidden = true;
		beat('appui long', NONE, 'Il soulève directement, puis on le fait glisser');
		await press(700);
		g.onLongPress({ item: hotel });
		await wait(3000);
		fingers();
		$('#btn-place-cancel').click();
		await wait(600);
	} },

	mecaniques: { title: 'Mécaniques', async run() {
		const w = () => api.session();
		beat('marche à 5 km/h', "Curseurs : effort d'un km, nectar par effort", () => `${num((w()?.distance ?? 0) / 1000, 2)} km → ${num(w()?.effort ?? 0)} effort → ${num(w()?.nectar ?? 0)} nectar`);
		await walk(5, 1000);
		const e0 = w().effort, n0 = w().nectar, d0 = w().distance;
		debug.measures.walk1km = { effort: e0, nectar: n0 };
		await wait(1000);
		beat('course à 10,5 km/h', "Curseurs : bonus des sports intenses, effort d'un km", () => `${num(((w()?.distance ?? d0) - d0) / 1000, 2)} km → ${num((w()?.effort ?? e0) - e0)} effort → ${num((w()?.nectar ?? n0) - n0)} nectar`);
		await walk(10.5, 1000);
		debug.measures.run1km = { effort: w().effort - e0, nectar: w().nectar - n0 };
		await wait(1000);
		const duration = w().simTime / 60;
		beat("fin de sortie : l'élan", "Curseurs : force de l'élan, durée de l'élan", () => `Sortie de ${minutes(duration)} → élan ×${fmtNum(boostMult())} pendant ${minutes(boostLeft(s) / 60000)}`);
		await endWalk();
		debug.measures.boostMinutes = boostLeft(s) / 60000;
		debug.measures.boostMult = boostMult();
		await wait(4800);
		api.closeModal();
		const perHour = () => rates(s, s.place).nectar;
		beat('écosystème sous élan', "Curseur : force de l'élan", () => `Sans élan +${num(perHour())}/h → avec +${num(perHour() * boostMult())}/h`);
		api.eco.open();
		await wait(3600);
		beat('élan accumulé au plus', 'Curseur : élan maximum', () => `Longue sortie : plafond à ${minutes(boostLeft(s) / 60000)}`);
		addBoost(s, 100000);
		debug.measures.boostCapHours = boostLeft(s) / 3600000;
		debug.measures.boostCapSetting = maxBoostH();
		api.eco.render();
		await wait(3200);
		api.eco.close();
		s.boostUntil = 0;
		s.days = {};
		s.effortDays = {};
		s.ground = 0;
		s.pending = 0;
		for (const it of g.items) if (it.kind === 'collecteur') it.stock = 0;
		s.lastIdle = Date.now() - 20 * 3600000;
		api.runIdle(true);
		const away = s.idleLast;
		debug.measures.away = { hours: away?.hours, nectar: away?.nectar, floorPerDay: (away?.nectar / away?.hours) * 24 / (1 + habitatBonus(s)) };
		beat('20 h sans bouger', 'Curseurs : absence rattrapée, nectar minimum par jour', `${num(away?.hours ?? 0)} h rattrapées → +${num(away?.nectar ?? 0)} nectar`);
		api.showIdleRecap();
		await wait(4500);
		api.closeModal();
		debug.measures.vitality = vitality(pl);
		beat('vitalité du jardin', 'Curseur : bonus de vitalité', () => `Niveau ${vitality(pl).level} → production +${num(vitality(pl).bonus * 100)} %`);
		api.eco.open();
		await wait(600);
		await centerIn('#eco', $('#eco .eco-vit'));
		await wait(3000);
		api.eco.close();
	} },

	'jardin-et-monde': { title: 'Jardin et monde', quiet: true, async run() {
		const RATE = 40, TICK = 150, name = { herbe: 'herbe folle', fleur: 'fleur', buisson: 'arbuste', arbre: 'arbre' };
		const sliders = { herbe: "Curseur : coût d'une herbe", fleur: "Curseur : coût d'une fleur", buisson: "Curseur : coût d'un arbuste", arbre: "Curseur : coût d'un arbre" };
		debug.measures.growMs = {};
		look(190, 640, 1.2);
		await wait(800);
		for (const t of ['herbe', 'fleur', 'buisson', 'arbre']) {
			const p = g.spawn(s.place, t, 0, g.place_(s.place, t, 0), 0);
			g.current = p;
			g.setFollow(true);
			const t0 = Date.now();
			beat(`pousse : ${name[t]}`, sliders[t], () => `${num(p.growth * PLANT_TYPES[t].cost)} / ${num(PLANT_TYPES[t].cost)} effort, à ${RATE} par seconde`);
			while (p.growth < 1) {
				for (const q of pl.plants) if (q !== p && q.type === t && q.growth < 1) q.growth = 1;
				g.addEffort(t, (RATE * TICK) / 1000);
				await wait(TICK);
			}
			debug.measures.growMs[t] = Date.now() - t0;
			g.setFollow(false);
			await wait(1100);
		}
		const coop = firstItem('poulailler'), bed = firstItem('potager');
		const km0 = s.totals.distance / 1000, hens = coop.flock?.hens ?? 3;
		for (const it of g.items) if (it.kind === 'potager' || it.kind === 'poulailler') it.km0 = km0;
		look((coop.x + bed.x) / 2, (coop.y + bed.y) / 2 - 30, 0.8);
		const walked = () => s.totals.distance / 1000 - km0;
		// Phantom items read the game's own formulas before the gardener collects anything.
		const eggs = () => g.eggsOf({ km0, flock: { hens } }), bedPct = () => g.bedStage({ km0 });
		beat('potager et poulailler', 'Curseurs : maturité du potager, ponte par kilomètre', () => `${num(walked(), 1)} km → potager ${num(bedPct() * 100)} % · ${eggs()} œufs de ${hens} poules`);
		await wait(1200);
		let eggsAt1 = null;
		while (walked() < 12 && bedPct() < 1) {
			addDistance(s, 100);
			if (eggsAt1 == null && walked() >= 1) eggsAt1 = eggs();
			api.renderHud();
			await wait(180);
		}
		debug.measures.ripeAtKm = walked();
		debug.measures.eggsAt1Km = eggsAt1 ?? eggs();
		await wait(3500);
		beat('un seul jardin, plusieurs milieux', NONE_STEP, () => `${g.openCells().length} parcelles ouvertes`);
		for (const biome of ['marais', 'foret']) { g.flyToCell(g.heart(biome)); await wait(2500); }
		g.flyToCell(0);
		await wait(1000);
	} },

	progression: { title: 'Progression', async run() {
		s.daily.giftDay = null;
		beat('le cadeau du jour', 'Curseurs : cadeau base, gain par jour de série', () => `Série ${s.daily.streak} j : ${num(Tuning.num('cadeau.base', 20))} + ${num(Tuning.num('cadeau.par_jour', 10))} × ${Math.min(s.daily.streak, 10)} = ${num(giftFor(s).nectar)} nectar`);
		debug.measures.gift = giftFor(s).nectar;
		api.showDaily(true);
		await wait(3200);
		$('#btn-gift')?.click();
		await wait(2400);
		api.closeModal();
		const prices = () => [0, 1, 2, 3].map(n => itemCost('hotel', n));
		beat('prix des aménagements', 'Curseur : hausse du prix par exemplaire', () => `Hôtel à insectes : ${prices().map(p => num(p)).join(' → ')}`);
		debug.measures.prices = prices();
		api.openDeco('habitat');
		await wait(900);
		await centerIn('#deco', $('#deco [data-art="hotel"]')?.closest('.deco-card'));
		await wait(3200);
		api.closeDeco();
		beat('le jeu « Trouve… »', 'Curseur : récompense de « Trouve… »', () => `Trouver l'animal : +${num(Tuning.num('trouve.recompense', 15))} nectar`);
		look(190, 620, 1.2);
		await wait(1600);
		let b = critters()[0];
		for (let n = 0; n < 8 && !b; n++) { await wait(500); b = critters()[0]; }
		if (b) {
			const nectar0 = s.nectar;
			api.setQuest(b.sp);
			await wait(1800);
			$('#quest').click();
			await wait(1600);
			tapNow(b.x, b.y, { critter: b });
			debug.measures.questGain = s.nectar - nectar0;
			await wait(3500);
			api.closeModal();
		}
		beat('le carnet de la semaine', NONE_STEP, () => `Objectif ${num(s.goalKm, 1)} km · série ${s.daily.streak} jours`);
		api.openJournal();
		await browse('#journal');
		api.closeJournal();
	} },

	'direction-artistique': { title: 'Direction artistique', quiet: true, async run() {
		const b = g.bounds(), year = new Date().getFullYear();
		g.onPeek(true);
		const zooms = [
			['vue lointaine', 'Sous 0,5 : rendu simplifié', () => look((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0.42)],
			['pastilles', 'Sous 0,85 : pastilles sur ce qui attend', () => look(200, 620, 0.72)],
			['aquarelle', 'Zoom 1 : lavis, ombres, grain de papier', () => look(200, 620, 1)],
			['détail renforcé', 'Dès 1,6 : aquarelle détaillée', () => look(180, 660, 1.8)],
			['zoom maximum', 'Zoom 3,2', () => look(200, 700, 3.2)],
		];
		for (const [what, live, go] of zooms) { beat(what, NONE, live); go(); await wait(3200); }
		look(200, 620, 1);
		const skies = [
			['matin', 'Soleil rasant, longues ombres', 7.5, null, 'clear'],
			['couchant', 'Lumière chaude du soir', 19.3, null, 'clear'],
			['nuit', 'Lucioles et lanternes', 22.5, null, 'clear'],
			['pluie', 'Gouttes, ciel couvert', 11, null, 'rain'],
			['automne', "Feuilles d'automne", 11, `${year}-10-20`, 'clear'],
			['neige', 'Hiver et neige', 11, `${year}-01-15`, 'snow'],
		];
		for (const [what, live, h, date, w] of skies) {
			beat(what, NONE, live);
			g.hourOverride = h;
			if (date) g.dateOverride = date;
			api.sky.override = w;
			api.sky.apply(false);
			await wait(3200);
		}
		g.onPeek(false);
	} },

	son: { title: 'Son', quiet: true, async run() {
		s.sound.on = true;
		s.music.on = true;
		const running = () => api.sound.ctx?.state === 'running';
		const cries = ['merle', 'rougegorge', 'bourdon', 'poule', 'grenouille', 'rossignol', 'chien', 'fauvette'];
		const places = [['cris proches, le jour', 11, 'clear'], ['fond : la pluie', 11, 'rain'], ['fond : les grillons, la nuit', 22.5, 'clear']];
		let lastName = '';
		look(190, 620, 1.3);
		for (const [what, h, w] of places) {
			g.hourOverride = h;
			api.sky.override = w;
			api.sky.apply(false);
			beat(what, "Curseur : volume des cris d'animaux", () => `Niveau ${round(Tuning.num('son.niveau_cris', 0.12))} · ${running() ? (lastName ? `dernier cri : ${lastName}` : 'à l\'écoute') : "touche l'aperçu pour entendre"}`);
			for (let n = 0; n < 3; n++) {
				const list = critters(), who = list[n % Math.max(1, list.length)];
				// The burst follows the level, so the slider also reads without sound.
				const burst = Math.round(Tuning.num('son.niveau_cris', 0.12) * 90);
				g.burst(who?.x ?? 190, (who?.y ?? 620) - 10, burst, '#3E8FD0');
				debug.measures.burst = burst;
				if (running()) {
					const name = cries[(debug.runs + n) % cries.length];
					if (api.sound.sample(name, 0, 1)) { lastName = name; debug.measures.lastGain = voiceOut?.g.gain.value; debug.measures.lastCry = name; }
				}
				await wait(3000);
			}
		}
	} },

	interface: { title: 'Interface', quiet: true, async run() {
		beat('écran principal', NONE, 'Bandeau en haut, feuille en bas, jardin plein écran');
		look(190, 600, 1);
		await wait(3500);
		const panels = [
			['Aménager', () => api.openDeco('habitat'), '#deco', () => api.closeDeco(), 'Habitats, Récolte, Décoration'],
			['Écosystème', () => api.eco.open(), '#eco', () => api.eco.close(), 'À récolter, élan, équipes, vitalité'],
			['Espèces', () => api.species.open(), '#species', () => api.species.close(), 'Par milieu ; silhouette si non découverte'],
			['Carnet', () => api.openJournal(), '#journal', () => api.closeJournal(), 'Totaux, 7 derniers jours, album, balades'],
			['Carte', () => api.places.open(), '#map', () => api.places.close(), 'Les 5 milieux et leur progression'],
			['Options', () => api.openOptions(), '#options', () => api.closeOptions(), 'Objectif, suivi, sons, parties'],
		];
		for (const [what, open, id, close, live] of panels) {
			beat(what, NONE, live);
			open();
			await browse(id);
			close();
			await wait(500);
		}
		beat('fenêtre Défis du jour', NONE, 'Toutes les fenêtres ont une croix et défilent');
		api.showDaily();
		await wait(3200);
		api.closeModal();
		beat('bulle sur une plante', NONE, "Toujours entière à l'écran, 4 à 6 s");
		const flower = someFlower();
		if (flower) {
			look(flower.x, flower.y - 20, 1.3);
			await wait(1400);
			tapNow(flower.x, flower.y - 16, { plant: flower });
			await wait(3000);
		}
		$('#plant-card').hidden = true;
	} },

	monetisation: { title: 'Monétisation', quiet: true, async run() {
		beat('aucune pub, aucun achat', NONE, "Pas d'écran dédié : voici l'écran normal");
		look(190, 600, 1);
		await wait(4000);
		const jar = fullestJar();
		beat('le nectar se gagne en jouant', NONE, () => `Bourse : ${num(s.nectar)} nectar`);
		lookAt(jar);
		await wait(1600);
		tapNow(jar.x, jar.y - 40, { item: jar });
		await wait(3600);
		beat('il se dépense sans argent', NONE, 'Aménager : tous les prix sont en nectar');
		api.openDeco('recolte');
		await wait(4500);
		api.closeDeco();
	} },

	technique: { title: 'Technique', quiet: true, async run() {
		beat('écran le plus proche : Options', NONE, 'Version, suivi, sauvegardes, mode test');
		api.openOptions();
		await browse('#options', 3800);
		await centerIn('#options', $('#options .slots'));
		await wait(2800);
		api.closeOptions();
		beat('le panneau de débogage', NONE, 'Aperçu : capteurs coupés, partie temporaire');
		api.debugPanel.show(true);
		await wait(5500);
		api.debugPanel.show(false);
		beat('le rendu : canevas 2D', NONE, () => `${Math.round(g.fps ?? 0)} images/s · ${pl.plants.length} plantes · ${g.insects.length} bêtes`);
		look(190, 600, 1);
		await wait(4000);
	} },
};

async function loop(scene) {
	for (;;) {
		try {
			resetDemo();
			debug.runs++;
			await scene.run();
			await wait(600);
		} catch (e) {
			console.warn('GDD preview scene', e);
			await wait(2000);
		}
	}
}

export function startPreview(gameApi) {
	api = gameApi;
	g = api.garden;
	s = api.state;
	pl = g.place;
	document.getElementById('splash')?.remove();
	const scene = SCENES[slug] ?? SCENES['vue-ensemble'];
	chapterTitle = scene.title;
	debug.scene = SCENES[slug] ? slug : 'vue-ensemble';
	debug.state = s;
	debug.garden = g;
	$('#app').classList.toggle('gdd-quiet', !!scene.quiet);
	$('#app').classList.toggle('gdd-noquest', scene !== SCENES.progression);
	buildLegend();
	buildGarden();
	const voice = api.sound.voice.bind(api.sound);
	api.sound.voice = (pan, level) => (voiceOut = voice(pan, level));
	Tuning.onChange(refreshLive);
	loop(scene);
}
