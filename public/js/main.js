// Interface : bandeau, marche en cours, récolte des pas, récap, carnet, biodiversité.

import { load, save, reset, ACTIVITIES, ACTIVITY_BY_ID, MAX_SPEED_KMH, activityFor, effortFor, dayKey, dayNumber, todayMeters, addDistance, STEP_LENGTH_M } from './state.js';
import { Garden } from './garden.js';
import { PLANT_TYPES, DECOR, plantName } from './plants.js';
import { GpsTracker, MotionTracker, SimTracker } from './tracker.js';
import { SOURCES, bestSource, harvest, classifyCadence } from './harvest.js';
import { SPECIES_BY_ID, checkSpecies, speciesOf } from './species.js';
import { Encyclopedia } from './encyclopedia.js';
import { paperTexture } from './watercolor.js';
import { VERSION } from './version.js';

const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const $ = s => document.querySelector(s);

document.documentElement.style.setProperty('--paper', `url(${paperTexture(200, 11).toDataURL()})`);

const state = load();
state.totals.steps ??= 0;
const garden = new Garden($('#garden'), state);
if (params.has('h')) garden.hourOverride = parseFloat(params.get('h'));
if (DEV) window.evolia = { garden, state };

const DECOR_MSG = {
	pond: 'Une mare est apparue dans ton jardin',
	mushrooms: 'Des champignons ont poussé',
	log: 'Un vieux tronc est apparu',
};
const TYPE_COLOR = { herbe: '#A3BD57', fleur: '#EE8FA4', buisson: '#5F933E', arbre: '#1F6B47' };

const fmt = (n, d = 2) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = n => Math.round(n).toLocaleString('fr-FR');
const fmtTime = s => {
	s = Math.floor(s);
	const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)} min`);
const plural = (n, type) => (n > 1 ? PLANT_TYPES[type].plural : PLANT_TYPES[type].name.toLowerCase());
const sleep = ms => new Promise(r => setTimeout(r, ms));

let saveTimer = 0;
function persist(now = false) {
	clearTimeout(saveTimer);
	if (now) save(state);
	else saveTimer = setTimeout(() => save(state), 3000);
}

const species = new Encyclopedia($('#species'), state, () => { persist(); updateSpeciesDot(); });

// ─── Mise en page ─────────────────────────────────────────────

function updatePads() {
	const app = $('#app').getBoundingClientRect();
	const hud = $('#hud').getBoundingClientRect();
	const sheet = (walk ? $('#walk') : $('#home')).getBoundingClientRect();
	garden.setPads(hud.bottom - app.top + 10, app.bottom - sheet.top + 10);
}
new ResizeObserver(() => updatePads()).observe($('#app'));

// ─── Bandeau ──────────────────────────────────────────────────

function renderHud() {
	const km = todayMeters(state) / 1000;
	$('#hud-day').textContent = `Jour ${dayNumber(state)}`;
	$('#hud-km').textContent = `${fmt(km, km < 10 ? 2 : 1)} / ${state.goalKm} km`;
	$('#hud-steps').textContent = `≈ ${fmtInt((km * 1000) / STEP_LENGTH_M)} pas`;
	const k = Math.min(1, km / state.goalKm);
	$('#ring-fg').style.strokeDashoffset = String(113.1 * (1 - k));
}

// ─── Messages ─────────────────────────────────────────────────

function toast(text, color = '#F4C23E', onClick = null) {
	const el = document.createElement('div');
	el.className = 'toast';
	el.innerHTML = `<i style="background:${color}"></i><span></span>`;
	el.querySelector('span').textContent = text;
	if (onClick) { el.classList.add('link'); el.addEventListener('click', onClick); }
	const box = $('#toasts');
	box.appendChild(el);
	while (box.children.length > 3) box.firstChild.remove();
	setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, onClick ? 5000 : 3200);
}

function showModal(html) {
	$('#modal-card').innerHTML = html;
	$('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; }

// ─── Espèces ──────────────────────────────────────────────────

function updateSpeciesDot() {
	$('#species-dot').hidden = !Object.keys(state.species).some(id => !state.speciesSeen?.[id]);
}

/** Annonce les espèces qui viennent d'apparaître. `quiet` : au tout premier lancement, sans bruit. */
function announceSpecies(quiet = false) {
	const found = checkSpecies(state);
	if (!found.length) return;
	persist();
	updateSpeciesDot();
	if (quiet) return;
	for (const sp of found) toast(`Nouvelle espèce : ${sp.name}`, '#F08A3C', () => species.open(sp.id));
}
setInterval(() => { if (!walk) announceSpecies(); }, 4000);

// ─── Toucher une plante ───────────────────────────────────────

let cardTimer = 0;
garden.onTap = hit => {
	const card = $('#plant-card');
	clearTimeout(cardTimer);
	if (!hit) { card.hidden = true; return; }
	const p = hit.plant;
	const id = speciesOf(p);
	const known = !!state.species[id];
	const pct = Math.round(p.growth * 100);
	const born = new Date(p.born).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
	card.innerHTML = `<b>${plantName(p)}</b>${pct >= 100 ? 'En pleine forme' : `Pousse à ${pct} %`}
		<div class="bar"><i style="width:${pct}%"></i></div>Née le ${born}
		${known ? '<span class="more">Son rôle dans la nature ›</span>' : ''}`;
	card.classList.toggle('link', known);
	card.onclick = known ? () => { card.hidden = true; species.open(id); } : null;
	card.style.left = `${Math.max(90, Math.min($('#app').clientWidth - 90, hit.x))}px`;
	card.style.top = `${Math.max(170, hit.y - 20)}px`;
	card.hidden = false;
	cardTimer = setTimeout(() => { card.hidden = true; }, 4500);
};

// ─── Marche en direct ─────────────────────────────────────────

let walk = null;

async function keepAwake() {
	try { walk.lock = await navigator.wakeLock?.request('screen'); } catch (e) { /* pas grave */ }
}

async function startWalk(useSim = DEV || !GpsTracker.available()) {
	if (walk) return;
	$('#plant-card').hidden = true;
	walk = { start: Date.now(), simTime: 0, distance: 0, steps: 0, effort: 0, events: [], speed: 0, act: null, sim: useSim, touched: new Set(), lastGpsMove: 0 };
	$('#home').classList.add('off');
	$('#walk').classList.remove('off');
	// iOS n'accorde l'accéléromètre que pendant le geste qui lance la marche : on le demande en premier.
	const motionOk = !useSim && (await MotionTracker.permit());
	startTracker();
	if (motionOk) {
		walk.motion = new MotionTracker(handleSample, classifyCadence);
		walk.motion.start();
	}
	garden.setFollow(true);
	keepAwake();
	walk.tick = setInterval(renderWalk, 1000);
	renderWalk();
	setTimeout(updatePads, 450);
}

function startTracker() {
	walk.tracker?.stop();
	const Tracker = walk.sim ? SimTracker : GpsTracker;
	walk.tracker = new Tracker(handleSample, handleStatus);
	if (walk.sim) {
		walk.tracker.speedKmh = parseFloat($('#sim-speed').value);
		walk.tracker.timeScale = parseFloat($('#sim-ts .on').dataset.ts);
	}
	$('#sim').hidden = !walk.sim;
	$('#btn-sim').hidden = walk.sim || !DEV;
	walk.tracker.start();
}

function setGpsLabel(cls, text) {
	const el = $('#walk-gps');
	el.className = `gps ${cls}`;
	el.querySelector('span').textContent = text;
}

function handleStatus(st) {
	if (st.kind === 'searching') setGpsLabel('', 'Recherche du GPS…');
	if (st.kind === 'sim') setGpsLabel('', 'Mode test');
	if (st.kind === 'ok') setGpsLabel('ok', `GPS ±${Math.round(st.accuracy)} m`);
	if (st.kind === 'weak') setGpsLabel('weak', `Signal faible (±${Math.round(st.accuracy)} m)`);
	if (st.kind === 'error') {
		setGpsLabel('err', st.code === 1 ? 'Position refusée' : 'GPS indisponible');
		if (DEV) $('#btn-sim').hidden = false;
		if (st.code === 1 && !walk?.motion) toast('Autorise la position pour suivre ta marche', '#C0442F');
	}
}

// Walk-time: en mode test le temps peut être accéléré, la durée suit alors le temps simulé.
const walkSeconds = w => (w.sim ? w.simTime : (Date.now() - w.start) / 1000);

function handleSample(s) {
	if (!walk) return;
	let act;
	if (s.motion) {
		walk.steps += s.steps;
		// Le GPS a la priorité dehors ; l'accéléromètre prend le relais quand il ne voit plus de déplacement.
		if (Date.now() - walk.lastGpsMove < 15000) { renderWalk(); return; }
		if (s.steps) setGpsLabel('ok', 'Pas comptés au podomètre');
		act = s.act ? ACTIVITY_BY_ID[s.act] : null;
	} else {
		walk.simTime += s.dt;
		if (s.dist > 0 && !walk.sim) walk.lastGpsMove = Date.now();
		act = activityFor(s.speedKmh);
	}
	walk.speed = s.speedKmh;
	walk.act = act;
	if (act && s.dist > 0) {
		walk.distance += s.dist;
		addDistance(state, s.dist);
		const effort = effortFor(s.dist, s.speedKmh, act);
		walk.effort += effort;
		state.totals.effort += effort;
		for (const ev of garden.addEffort(act.plant, effort)) {
			walk.events.push(ev);
			if (ev.kind === 'mature' && ev.plant.type !== 'herbe') toast(`${plantName(ev.plant)} a fini de pousser`, TYPE_COLOR[ev.plant.type]);
			if (ev.kind === 'seed' && ev.plant.type === 'arbre') toast(`Une graine de ${plantName(ev.plant).split(' ')[1] ?? 'arbre'} est plantée`, TYPE_COLOR.arbre);
		}
		if (garden.current) walk.touched.add(garden.current);
		checkUnlocks();
		announceSpecies();
		renderHud();
		persist();
	}
	renderWalk();
}

function checkUnlocks() {
	const km = state.totals.distance / 1000;
	for (const [key, d] of Object.entries(DECOR)) {
		if (state.unlocked[key] || km < d.km) continue;
		state.unlocked[key] = true;
		garden.reveal(key);
		toast(DECOR_MSG[key], '#5BB5B0');
		walk?.events.push({ kind: 'decor', key });
	}
}

function renderWalk() {
	if (!walk) return;
	$('#walk-km').textContent = fmt(walk.distance / 1000);
	$('#walk-time').textContent = fmtTime(walkSeconds(walk));
	$('#walk-speed').textContent = fmt(walk.speed, 1);
	$('#walk-steps').textContent = fmtInt(walk.steps || walk.distance / STEP_LENGTH_M);
	const pill = $('#walk-act');
	if (walk.speed > MAX_SPEED_KMH) { pill.className = 'pill fast'; pill.textContent = 'Trop rapide pour marcher'; }
	else if (!walk.act) { pill.className = 'pill pause'; pill.textContent = walk.speed ? 'En pause' : 'En attente'; }
	else { pill.className = 'pill'; pill.textContent = walk.act.name; }
	const p = garden.current;
	if (p) {
		const pct = Math.floor(p.growth * 100);
		$('#grow-name').textContent = plantName(p);
		$('#grow-pct').textContent = `${pct} %`;
		$('#grow-bar').style.width = `${pct}%`;
	}
}

function endWalk() {
	if (!walk) return;
	walk.tracker.stop();
	walk.motion?.stop();
	clearInterval(walk.tick);
	walk.lock?.release?.();
	garden.setFollow(false);
	const w = walk;
	walk = null;
	$('#walk').classList.add('off');
	$('#home').classList.remove('off');
	setTimeout(updatePads, 450);

	const duration = walkSeconds(w);
	const matured = {};
	for (const ev of w.events) if (ev.kind === 'mature') matured[ev.plant.type] = (matured[ev.plant.type] ?? 0) + 1;
	if (w.distance > 10) {
		// `end` sert à ne pas recompter ces pas lors de la prochaine récolte.
		state.walks.unshift({ start: w.start, end: w.sim ? undefined : Date.now(), duration, distance: w.distance, effort: w.effort, matured });
		state.walks.length = Math.min(state.walks.length, 100);
		state.totals.walks += 1;
		state.totals.steps += w.steps;
	}
	persist(true);
	renderHud();
	showRecap(w, duration, matured);
}

function growthChips(matured, touched) {
	const chips = [];
	for (const type of Object.keys(PLANT_TYPES)) if (matured[type]) chips.push(`<span class="chip">+${matured[type]} ${plural(matured[type], type)}</span>`);
	for (const p of touched) {
		if (p.growth >= 1) continue;
		const pct = Math.floor(p.growth * 100);
		chips.push(`<span class="chip">${plantName(p)} · ${pct < 1 ? 'graine plantée' : `${pct} %`}</span>`);
	}
	return chips;
}

function showRecap(w, duration, matured) {
	const chips = growthChips(matured, w.touched);
	for (const ev of w.events) if (ev.kind === 'decor') chips.push(`<span class="chip gold">${DECOR[ev.key].name}</span>`);
	const title = w.distance < 10 ? 'À bientôt' : w.distance > 3000 ? 'Quelle balade !' : 'Belle marche !';
	const sub = w.distance < 10 ? 'Pas encore de pas enregistrés cette fois.' : 'Voici ce qui a poussé grâce à toi.';
	showModal(`
		<h2>${title}</h2><p>${sub}</p>
		<div class="walk-stats">
			<div><b>${fmt(w.distance / 1000)}</b><span>km</span></div>
			<div><b>${fmtTime(duration)}</b><span>durée</span></div>
			<div><b>${fmtInt(w.steps || w.distance / STEP_LENGTH_M)}</b><span>pas</span></div>
		</div>
		<div class="chips">${chips.join('')}</div>
		<button class="btn primary" data-close>Retour au jardin</button>`);
}

// ─── Récolte des pas faits appli fermée ───────────────────────

let harvesting = false;

async function maybeHarvest(source = SOURCES[state.harvestSource], since = state.lastHarvest) {
	if (harvesting || walk || !source) return;
	harvesting = true;
	try {
		const skip = state.walks.filter(w => w.end).map(w => [w.start, w.end]);
		const res = await harvest(source, since, skip);
		if (source.id !== 'mock') state.lastHarvest = Date.now();
		persist(true);
		if (res && res.steps >= 30) await playHarvest(res, source);
	} catch (e) {
		console.warn('Récolte impossible', e);
	}
	harvesting = false;
}

/** Fait pousser le jardin devant la personne, allure par allure, puis montre le bilan. */
async function playHarvest(res, source) {
	for (const [k, m] of Object.entries(res.days)) state.days[k] = (state.days[k] ?? 0) + m;
	state.totals.distance += res.distance;
	state.totals.steps += res.steps;
	renderHud();
	closeModal();
	toast(`${fmtInt(res.steps)} pas récoltés pendant ton absence`, '#A3BD57');
	garden.setFollow(true);
	const rows = [];
	for (const g of res.groups.sort((a, b) => b.effort - a.effort)) {
		const matured = {}, touched = new Set();
		const chunks = 8;
		for (let i = 0; i < chunks; i++) {
			for (const ev of garden.addEffort(g.act.plant, g.effort / chunks)) if (ev.kind === 'mature') matured[ev.plant.type] = (matured[ev.plant.type] ?? 0) + 1;
			if (garden.current) touched.add(garden.current);
			await sleep(140);
		}
		state.totals.effort += g.effort;
		rows.push(`<li><b>${g.act.name}</b> · ${fmtMin(g.minutes)} · ${fmtInt(g.steps)} pas<br>${growthChips(matured, touched).join('')}</li>`);
	}
	garden.setFollow(false);
	checkUnlocks();
	persist(true);
	showModal(`
		<h2>Pendant ton absence</h2>
		<p>${fmtInt(res.steps)} pas · ${fmt(res.distance / 1000)} km, comptés par ${source.label}. Même le ménage fait pousser ton jardin.</p>
		<ul class="harvest-rows">${rows.join('')}</ul>
		<button class="btn primary" data-close>Voir mon jardin</button>`);
	announceSpecies();
}

/** Propose, une fois, de lire les pas comptés par le téléphone (seulement dans l'appli installée). */
async function offerHarvest() {
	if (state.harvestSource || state.harvestDeclined) return;
	const source = await bestSource(false);
	if (!source) return;
	showModal(`
		<h2>Ton jardin pousse même appli fermée</h2>
		<p>Ton téléphone compte déjà tes pas avec ${source.label}. Evolia peut les relire à chaque ouverture : la marche, les courses, et même le ménage font pousser ton jardin. Ces données restent sur ton téléphone.</p>
		<button class="btn primary" id="btn-allow">Autoriser</button>
		<button class="btn ghost wide" data-close id="btn-later">Plus tard</button>`);
	$('#btn-later').onclick = () => { state.harvestDeclined = true; persist(true); };
	$('#btn-allow').onclick = async () => {
		closeModal();
		let ok = false;
		try { ok = await source.authorize(); } catch (e) { console.warn(e); }
		if (!ok) { toast("Sans autorisation, seules les marches suivies en direct comptent", '#C0442F'); return; }
		state.harvestSource = source.id;
		const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
		state.lastHarvest = midnight.getTime(); // premier cadeau : les pas d'aujourd'hui
		persist(true);
		maybeHarvest();
	};
}

document.addEventListener('visibilitychange', () => {
	if (document.hidden) { persist(true); return; }
	if (walk) keepAwake();
	else if (Date.now() - state.lastHarvest > 5 * 60000) maybeHarvest();
});

// ─── Carnet ───────────────────────────────────────────────────

function renderJournal() {
	const km = state.totals.distance / 1000;
	const mature = t => state.plants.filter(p => p.type === t && p.growth >= 1).length;
	const days = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date(); d.setDate(d.getDate() - i);
		days.push({ d, km: (state.days[dayKey(d)] ?? 0) / 1000, today: i === 0 });
	}
	const max = Math.max(state.goalKm * 1.2, ...days.map(x => x.km));
	const letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
	const walks = state.walks.slice(0, 12).map(w => {
		const date = new Date(w.start).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
		return `<li><span>${date}</span><span><b>${fmt(w.distance / 1000)} km</b> · ${fmtTime(w.duration)}</span></li>`;
	}).join('');
	const src = SOURCES[state.harvestSource];
	$('#journal').innerHTML = `
		<div class="panel-head"><h2>Carnet</h2><button class="close" data-close-journal aria-label="Fermer">×</button></div>
		<div class="tiles">
			<div class="tile"><b>${fmt(km, 1)}</b><span>km au total</span></div>
			<div class="tile"><b>${fmtInt(state.totals.steps)}</b><span>pas récoltés</span></div>
			<div class="tile"><b>${state.plants.filter(p => p.growth >= 1).length}</b><span>plantes</span></div>
		</div>
		<h3>Ces 7 derniers jours</h3>
		<div class="week">
			<div class="goal" style="bottom:${(state.goalKm / max) * 100}%" title="Objectif"></div>
			${days.map(x => `<div class="col${x.today ? ' today' : ''}"><div class="b" style="height:${(x.km / max) * 100}%"></div><span>${letters[x.d.getDay()]}</span></div>`).join('')}
		</div>
		<h3>Objectif du jour</h3>
		<div class="seg" id="goal-seg">${[2, 3, 5, 8].map(g => `<button data-goal="${g}" class="${g === state.goalKm ? 'on' : ''}">${g} km</button>`).join('')}</div>
		<h3>Pas comptés appli fermée</h3>
		<p class="empty">${src ? `Activé avec ${src.label}. Dernière récolte : ${new Date(state.lastHarvest).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : "Disponible dans l'appli mobile : tes pas seront relus à chaque ouverture."}</p>
		<h3>Ton jardin</h3>
		<ul class="rows">
			${Object.entries(PLANT_TYPES).map(([t, d]) => `<li><span>${d.plural[0].toUpperCase() + d.plural.slice(1)} <small>· ${ACTIVITIES.filter(a => a.plant === t).map(a => a.name.toLowerCase()).join(', ')}</small></span><b>${mature(t)}</b></li>`).join('')}
			${Object.entries(DECOR).map(([k, d]) => `<li><span>${d.name}</span><b>${state.unlocked[k] ? '✓' : `à ${d.km} km`}</b></li>`).join('')}
		</ul>
		<h3>Dernières marches</h3>
		${walks ? `<ul class="rows">${walks}</ul>` : '<p class="empty">Ta première marche apparaîtra ici.</p>'}
		${DEV ? `<div class="dev">Mode test · heure du jardin <b id="dev-h">${garden.hourOverride ?? 'réelle'}</b>
			<input type="range" id="dev-hour" min="0" max="24" step="0.25" value="${garden.hourOverride ?? new Date().getHours()}">
			<button id="dev-harvest">Simuler une journée d'activité</button>
			<button id="dev-reset">Effacer le jardin</button></div>` : ''}
		<p class="ver">Evolia v${VERSION}</p>`;
}

function openJournal() {
	renderJournal();
	$('#journal').classList.add('open');
	$('#journal').setAttribute('aria-hidden', 'false');
}
function closeJournal() {
	$('#journal').classList.remove('open');
	$('#journal').setAttribute('aria-hidden', 'true');
}

$('#journal').addEventListener('click', e => {
	if (e.target.closest('[data-close-journal]')) closeJournal();
	const g = e.target.closest('[data-goal]');
	if (g) { state.goalKm = Number(g.dataset.goal); persist(true); renderHud(); renderJournal(); }
	if (e.target.id === 'dev-harvest') { closeJournal(); maybeHarvest(SOURCES.mock, Date.now() - 16 * 3600000); }
	if (e.target.id === 'dev-reset' && confirm('Effacer tout le jardin ?')) { reset(); location.reload(); }
});
$('#journal').addEventListener('input', e => {
	if (e.target.id === 'dev-hour') {
		garden.hourOverride = parseFloat(e.target.value);
		$('#dev-h').textContent = `${e.target.value} h`;
	}
});

// ─── Boutons ──────────────────────────────────────────────────

$('#btn-walk').addEventListener('click', () => startWalk());
$('#btn-stop').addEventListener('click', endWalk);
$('#btn-journal').addEventListener('click', openJournal);
$('#btn-species').addEventListener('click', () => species.open());
$('#btn-sim').addEventListener('click', () => { walk.sim = true; startTracker(); });
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });
$('#sim-speed').addEventListener('input', e => {
	$('#sim-v').textContent = `${fmt(parseFloat(e.target.value), 1)} km/h`;
	if (walk?.tracker instanceof SimTracker) walk.tracker.speedKmh = parseFloat(e.target.value);
});
$('#sim-ts').addEventListener('click', e => {
	const b = e.target.closest('button');
	if (!b) return;
	for (const x of $('#sim-ts').children) x.classList.toggle('on', x === b);
	if (walk?.tracker instanceof SimTracker) walk.tracker.timeScale = parseFloat(b.dataset.ts);
});

// ─── Démarrage ────────────────────────────────────────────────

renderHud();
updatePads();
const firstRun = !state.seenIntro;
announceSpecies(firstRun);
updateSpeciesDot();
persist(true);
if (firstRun) {
	showModal(`
		<h2>Bienvenue</h2>
		<p>Ce jardin pousse quand tu bouges. Chaque façon de te déplacer fait naître une plante différente, et chaque plante attire de nouvelles espèces.</p>
		<ul class="legend">
			<li><i class="dot" style="background:${TYPE_COLOR.herbe}"></i><span><b>Ménage, marche lente</b> · herbes folles</span></li>
			<li><i class="dot" style="background:${TYPE_COLOR.fleur}"></i><span><b>Marche</b> · fleurs sauvages</span></li>
			<li><i class="dot" style="background:${TYPE_COLOR.buisson}"></i><span><b>Marche rapide, jogging</b> · arbustes à baies</span></li>
			<li><i class="dot" style="background:${TYPE_COLOR.arbre}"></i><span><b>Course</b> · grands arbres</span></li>
		</ul>
		<button class="btn primary" data-close id="btn-start">C'est parti</button>`);
	$('#btn-start').addEventListener('click', () => setTimeout(offerHarvest, 400));
	state.seenIntro = true;
	persist(true);
} else {
	offerHarvest();
	maybeHarvest();
}
