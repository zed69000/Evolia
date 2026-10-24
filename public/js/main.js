// Interface : bandeau, suivi automatique du mouvement, récolte des pas, récap, carnet, biodiversité, tutoriel.

import { load, save, reset, newPlace, allPlants, ACTIVITIES, ACTIVITY_BY_ID, MAX_SPEED_KMH, activityFor, effortFor, dayKey, todayMeters, addDistance, STEP_LENGTH_M } from './state.js';
import { Garden, CELLS, CELL_KM, cellsOpen } from './garden.js';
import { zoneName } from './zones.js';
import { PlacesMap } from './map.js';
import { PLANT_TYPES, DECOR, plantName } from './plants.js';
import { GpsTracker, MotionTracker, SimTracker } from './tracker.js';
import { SOURCES, bestSource, harvest, classifyCadence } from './harvest.js';
import { PLACES, PLACE_BY_ID, SPECIES_BY_ID, checkSpecies, placeOpen, speciesOf } from './species.js';
import { Encyclopedia, thumbCopy } from './encyclopedia.js';
import { Sky, WEATHER_LABEL } from './weather.js';
import { EcoPanel, tick, summaryHtml, addBoost, boostLeft, visualExtra, rates, GUILDS, BOOST_MULT, BOOST_PER_MIN } from './idle.js';
import { paperTexture } from './watercolor.js';
import { Soundscape } from './audio.js';
import { ITEMS, ITEM_ORDER } from './deco.js';
import { VERSION } from './version.js';
import { rollDay, markActive, giftReady, giftFor, claimGift, claim, toClaim, noteTap, noteQuest, challengesHtml, weekHtml, nextGoal, albumHtml, collection } from './daily.js';

const params = new URLSearchParams(location.search);
const DEV_KEY = 'evolia.dev';
const readDev = () => { try { return localStorage.getItem(DEV_KEY) === '1'; } catch (e) { return false; } };
// Mode test : ?dev=1 dans l'adresse, ou l'interrupteur de la page Options (indispensable dans l'appli installée).
let DEV = params.has('dev') || readDev();
const $ = s => document.querySelector(s);

document.documentElement.style.setProperty('--paper', `url(${paperTexture(200, 11).toDataURL()})`);

const state = load();
state.totals.steps ??= 0;
state.placesOpen ??= { prairie: true };
const garden = new Garden($('#garden'), state);
garden.idleBonus = sp => visualExtra(state, sp.place, sp);
if (params.has('h')) garden.hourOverride = parseFloat(params.get('h'));
if (params.has('date')) garden.dateOverride = params.get('date');
const sky = new Sky(state, garden, () => renderHud());
// Sons de la nature : ils démarrent au premier toucher (règle des navigateurs).
const sound = new Soundscape(garden, state);
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => sound.unlock(), { passive: true });
if (params.has('weather')) { sky.override = params.get('weather'); sky.apply(false); }
if (DEV) window.evolia = { garden, state, sky, sound };

const DECOR_MSG = {
	pond: 'Une mare est apparue dans ta prairie', murger: 'Un muret de pierres est apparu', log: 'Un vieux tronc est apparu',
	nenuphars: 'Des nénuphars fleurissent sur la mare', roseliere: 'Une roselière a poussé',
	mushrooms: 'Des amanites sont sorties de terre', litiere: 'Un tapis de feuilles couvre le sol', souche: 'Une vieille souche est apparue',
	eboulis: 'Un éboulis est apparu', neve: 'Un névé persiste au soleil',
	laisse: 'La mer a déposé sa laisse', ganivelles: 'Des ganivelles protègent la dune',
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
const fmtHour = h => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const plural = (n, type) => (n > 1 ? PLANT_TYPES[type].plural : PLANT_TYPES[type].name.toLowerCase());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const here = () => state.places[state.place];

let saveTimer = 0;
let resetting = false; // pendant « Recommencer », plus rien n'est réenregistré avant le rechargement
function persist(now = false) {
	clearTimeout(saveTimer);
	if (resetting) return;
	if (now) save(state);
	else saveTimer = setTimeout(() => save(state), 3000);
}

const species = new Encyclopedia($('#species'), state, () => { persist(); updateSpeciesDot(); });
const places = new PlacesMap($('#map'), state, travel);
const eco = new EcoPanel($('#eco'), state, gid => {
	toast(`${GUILDS[gid].upgrade.name} amélioré : de nouveaux animaux arrivent`, '#F4C23E');
	garden.nextPopulate = 0;
	renderHud();
	persist(true);
});

// ─── Bandeau ──────────────────────────────────────────────────

function renderHud() {
	const km = todayMeters(state) / 1000;
	$('#hud-day').textContent = PLACE_BY_ID[state.place].name;
	$('#hud-km').textContent = `${fmt(km, km < 10 ? 2 : 1)} / ${state.goalKm} km`;
	$('#hud-steps').innerHTML = `${sky.label()} · <span class="nectar${boostLeft(state) ? ' boost' : ''}">${fmtInt(state.nectar ?? 0)}</span>`;
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

// ─── Espèces et parcelles ─────────────────────────────────────

function updateSpeciesDot() {
	$('#species-dot').hidden = !Object.keys(state.species).some(id => !state.speciesSeen?.[id]);
}

/** Annonce les espèces et les parcelles qui viennent de s'ouvrir. `quiet` : au tout premier lancement, sans bruit. */
function announceSpecies(quiet = false) {
	const found = checkSpecies(state);
	const opened = PLACES.filter(p => !state.placesOpen[p.id] && placeOpen(state, p));
	for (const p of opened) state.placesOpen[p.id] = Date.now();
	if (!found.length && !opened.length) return;
	persist();
	updateSpeciesDot();
	if (quiet) return;
	if (found.length || opened.length) sound.chime(opened.length ? 3 : 2);
	for (const sp of found) toast(`${sp.kind === 'milieu' ? 'Nouveau milieu' : 'Nouvelle espèce'} : ${sp.name}`, '#F08A3C', () => species.open(sp.id));
	for (const p of opened) toast(`Nouveau lieu ouvert : ${p.name}`, p.color, () => places.open());
}
setInterval(announceSpecies, 4000);

/** Change de lieu : chaque lieu a son jardin, ses parcelles et ses espèces. */
function travel(id) {
	if (id === state.place || !placeOpen(state, id)) return;
	if (session) endSession();
	const first = !state.places[id];
	state.places[id] ??= newPlace();
	state.place = id;
	garden.setPlace(id);
	endQuest();
	renderHud();
	renderStatus();
	persist(true);
	const p = PLACE_BY_ID[id];
	if (first) {
		showModal(`<h2>${p.name}</h2><p>${p.intro}</p><p>Ici poussent d'autres espèces. Tes pas feront pousser ce jardin-là, et sa clôture reculera à mesure que tu bougeras.</p>
			<button class="btn primary" data-close>Explorer</button>`);
	} else toast(`Tu es dans ${p.name.toLowerCase()}`, p.color);
}

// ─── Toucher : plante, animal, parcelle ───────────────────────

let cardTimer = 0;
function placeCard(card, hit, ms = 4500) {
	card.style.left = `${Math.max(90, Math.min($('#app').clientWidth - 90, hit.x))}px`;
	card.style.top = `${Math.max(170, hit.y - 20)}px`;
	card.hidden = false;
	cardTimer = setTimeout(() => { card.hidden = true; }, ms);
}

garden.onTap = hit => {
	const card = $('#plant-card');
	clearTimeout(cardTimer);
	if (placing) return movePlacing(hit);
	if (!hit) { card.hidden = true; return; }
	if (hit.item) return tapItem(hit, card);
	if (hit.critter) return tapCritter(hit, card);
	if (hit.cell != null) {
		if (hit.open) garden.flyToCell(hit.cell);
		else toast(`${zoneName(state.place, hit.cell, 'Nouvelle parcelle')} : encore ${fmt(Math.max(0.1, Math.ceil((CELL_KM[hit.cell] - here().km) * 10) / 10), 1)} km dans ${PLACE_BY_ID[state.place].name.toLowerCase()}`, '#9A7448');
		return;
	}
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
	placeCard(card, hit);
};

// ─── Toucher un animal, et le jeu « Trouve… » pour les enfants ─

let quest = null;
const QUEST_REWARD = 15;

function tapCritter(hit, card) {
	const sp = SPECIES_BY_ID[hit.critter.sp];
	if (!sp) return;
	noteTap(state, sp.id);
	renderDaily();
	if (quest === sp.id) return winQuest(sp);
	card.innerHTML = `<b>${sp.name}</b>${sp.latin}<span class="more">Découvre son rôle ›</span>`;
	card.classList.add('link');
	card.onclick = () => { card.hidden = true; species.open(sp.id); };
	placeCard(card, hit, 4000);
}

/** Choisit un animal visible à l'écran à faire trouver. */
function pickQuest() {
	const v = garden.view();
	const seen = garden.insects.filter(b => !b.leaving && b.x > v.x0 && b.x < v.x0 + v.w && b.y > v.y0 && b.y < v.y0 + v.h);
	const present = [...new Set(seen.map(b => b.sp))].filter(id => id !== state.lastQuest);
	if (!present.length) return;
	quest = present[Math.floor(Math.random() * present.length)];
	state.lastQuest = quest;
	$('#quest-name').textContent = SPECIES_BY_ID[quest].name;
	$('#quest').hidden = false;
}

function endQuest() {
	quest = null;
	$('#quest').hidden = true;
}

function winQuest(sp) {
	sound.chime(2);
	endQuest();
	noteQuest(state);
	renderDaily();
	state.nectar = (state.nectar ?? 0) + QUEST_REWARD;
	persist();
	renderHud();
	showModal(`<h2>Bravo !</h2><p>Tu as trouvé : <b>${sp.name}</b></p><div class="bravo-thumb" id="bravo-thumb"></div>
		<p>${sp.role}</p><div class="chips"><span class="chip gold">+${QUEST_REWARD} nectar</span></div>
		<button class="btn primary" data-close>Continuer</button><button class="btn ghost wide" data-close data-open-sp="${sp.id}">Voir sa fiche</button>`);
	$('#bravo-thumb').appendChild(thumbCopy(sp, 110, false));
}

$('#quest').addEventListener('click', () => {
	const b = garden.insects.find(i => i.sp === quest && !i.leaving);
	if (!b) { endQuest(); return; }
	garden.focusOn(b.x, b.y);
	toast('Regarde bien par là, et touche-la du doigt !', '#F08A3C');
});
setInterval(() => {
	if (document.hidden || !$('#coach').hidden) return;
	if (quest && !garden.insects.some(b => b.sp === quest && !b.leaving)) endQuest();
	else if (!quest && $('#modal').hidden && !garden.glyph) pickQuest();
}, 9000);

// ─── Distance et décor ────────────────────────────────────────

/** Chaque mètre compte pour la journée, pour la parcelle, et rapporte du nectar (1 pour 5 m). */
function addMeters(m) {
	const before = state.totals.distance / 1000;
	addDistance(state, m);
	// Un nouvel aménagement devient possible (la cabane à 5 km…).
	const after = state.totals.distance / 1000;
	for (const k of ITEM_ORDER) {
		if (ITEMS[k].km > 0 && before < ITEMS[k].km && after >= ITEMS[k].km) {
			sound.chime(2);
			toast(`Tu peux maintenant installer ${ITEMS[k].name.toLowerCase()}`, '#9A7448', () => openDeco());
		}
	}
	here().km += m / 1000;
	state.nectar = (state.nectar ?? 0) + m / 5;
	if (markActive(state)) {
		const s = state.daily.streak;
		toast(s > 1 ? `Jour actif : ${s} jours de suite !` : 'Jour actif : ta série commence', '#F08A3C', () => showDaily());
	}
	renderDaily();
}

/** L'effort fait en bougeant compte double pour la vitalité de la parcelle. */
function addEffortXp(effort) {
	here().xp = (here().xp ?? 0) + effort * 2;
}

function checkUnlocks(events) {
	const pl = here();
	// La clôture recule : une nouvelle parcelle s'ouvre tous les quelques kilomètres faits dans ce lieu.
	for (let n = cellsOpen(pl); n < CELLS.length && pl.km >= CELL_KM[n]; n = cellsOpen(pl)) {
		garden.openCell(n);
		(pl.cellDates ??= {})[n] = Date.now();
		garden.flyToCell(n);
		sound.chime(3);
		toast(`La clôture recule : ${zoneName(state.place, n, 'une nouvelle parcelle').toLowerCase()} !`, '#9A7448');
		events?.push({ kind: 'cell', n });
	}
	for (const [key, d] of Object.entries(DECOR)) {
		if (d.place !== state.place || d.always || pl.unlocked[key] || pl.km < d.km) continue;
		pl.unlocked[key] = Date.now();
		garden.reveal(key);
		toast(DECOR_MSG[key], '#5BB5B0');
		events?.push({ kind: 'decor', key });
	}
}

// ─── Suivi automatique : pas de bouton, l'appli voit seule quand on bouge ─

const STOP_AFTER = 60000;
const tracking = { gps: null, motion: null, sim: null, lastGpsMove: 0, located: false };
let session = null;

/** Démarre le GPS et l'accéléromètre. `gesture` : appelé pendant un toucher (iOS ne donne l'accéléromètre qu'à ce moment). */
async function enableTracking(gesture = false) {
	if (!tracking.motion) {
		const needsGesture = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
		if (!needsGesture || gesture) {
			if (await MotionTracker.permit()) {
				tracking.motion = new MotionTracker(onSample, classifyCadence);
				tracking.motion.start();
			}
		}
	}
	if (!tracking.gps && GpsTracker.available()) {
		tracking.gps = new GpsTracker(onSample, onGpsStatus);
		tracking.gps.start();
	}
	state.tracking = true;
	persist(true);
	renderStatus();
}

/** Au lancement : reprendre le suivi sans redemander, si la position est déjà autorisée. */
async function resumeTracking() {
	if (!state.tracking) return;
	let granted = true;
	try { granted = (await navigator.permissions?.query({ name: 'geolocation' }))?.state !== 'prompt'; } catch (e) { /* navigateur sans API : on tente */ }
	if (granted) enableTracking(false);
	// Sur iPhone, l'accéléromètre attend le premier toucher.
	document.addEventListener('pointerdown', () => { if (state.tracking) enableTracking(true); }, { once: true });
}

function onGpsStatus(st) {
	tracking.gpsState = st.kind;
	if (st.kind === 'ok' && !tracking.located && tracking.gps?.last) {
		tracking.located = true;
		sky.setCoords(tracking.gps.last.coords.latitude, tracking.gps.last.coords.longitude);
	}
	if (st.kind === 'error' && st.code === 1 && !tracking.motion) toast('Autorise la position pour que tes pas comptent', '#C0442F');
	renderStatus();
}

// En mode test le temps peut être accéléré : la durée suit alors le temps simulé.
const sessionSeconds = w => (w.sim ? w.simTime : (Date.now() - w.start) / 1000);

function startSession(sim) {
	session = { start: Date.now(), simTime: 0, distance: 0, steps: 0, effort: 0, events: [], speed: 0, act: null, sim, touched: new Set(), lastMove: Date.now() };
	garden.setFollow(true);
	toast('Tu bouges : ton jardin pousse', '#F08A3C');
}

function onSample(s) {
	const now = Date.now();
	let act;
	if (s.motion) {
		if (session) session.steps += s.steps;
		// Dehors, le GPS a la priorité ; l'accéléromètre prend le relais quand il ne voit plus de déplacement.
		if (now - tracking.lastGpsMove < 15000) { renderStatus(); return; }
		act = s.act ? ACTIVITY_BY_ID[s.act] : null;
	} else {
		if (s.dist > 0 && !s.sim) tracking.lastGpsMove = now;
		act = activityFor(s.speedKmh);
	}
	if (!act || !(s.dist > 0)) {
		if (session) { session.speed = s.speedKmh ?? 0; session.act = null; if (s.sim) session.simTime += s.dt; }
		renderStatus();
		return;
	}
	if (!session) startSession(!!s.sim);
	if (s.sim) session.simTime += s.dt;
	session.lastMove = now;
	session.speed = s.speedKmh;
	session.act = act;
	session.distance += s.dist;
	addMeters(s.dist);
	const effort = effortFor(s.dist, s.speedKmh, act);
	session.effort += effort;
	state.totals.effort += effort;
	addEffortXp(effort);
	for (const ev of garden.addEffort(act.plant, effort)) {
		session.events.push(ev);
		if (ev.kind === 'mature' && ev.plant.type !== 'herbe') { toast(`${plantName(ev.plant)} a fini de pousser`, TYPE_COLOR[ev.plant.type]); sound.chime(1); }
	}
	if (garden.current) session.touched.add(garden.current);
	checkUnlocks(session.events);
	announceSpecies();
	renderHud();
	renderStatus();
	persist();
}

/** Une minute sans bouger : la balade se termine toute seule, avec un petit bilan. */
function endSession() {
	const w = session;
	session = null;
	garden.setFollow(false);
	const duration = sessionSeconds(w);
	const matured = {};
	for (const ev of w.events) if (ev.kind === 'mature') matured[ev.plant.type] = (matured[ev.plant.type] ?? 0) + 1;
	if (w.distance > 50) addBoost(state, (duration / 60) * BOOST_PER_MIN);
	if (w.distance > 10) {
		// `end` sert à ne pas recompter ces pas lors de la prochaine récolte.
		state.walks.unshift({ start: w.start, end: w.sim ? undefined : Date.now(), duration, distance: w.distance, effort: w.effort, matured, place: state.place });
		state.walks.length = Math.min(state.walks.length, 100);
		state.totals.walks += 1;
		state.totals.steps += w.steps;
		const grown = Object.entries(matured).map(([t, n]) => `+${n} ${plural(n, t)}`).join(', ');
		toast(`Balade finie : ${fmt(w.distance / 1000)} km${grown ? ` · ${grown}` : ''}`, '#F08A3C', () => showRecap(w, duration, matured));
	}
	persist(true);
	renderHud();
	renderStatus();
}
setInterval(() => {
	if (session && Date.now() - session.lastMove > STOP_AFTER) endSession();
	else renderStatus();
}, 5000);

function renderStatus() {
	const dot = $('#status-dot'), title = $('#status-title'), sub = $('#status-sub');
	$('#btn-track').hidden = !!state.tracking;
	$('#live').hidden = !session;
	if (session) {
		dot.className = 'status-dot moving';
		title.textContent = session.act?.name ?? 'En pause';
		sub.textContent = `Ton jardin pousse · élan ×${BOOST_MULT} à la fin`;
		$('#live-km').textContent = fmt(session.distance / 1000);
		$('#live-time').textContent = fmtTime(sessionSeconds(session));
		$('#live-speed').textContent = fmt(session.speed ?? 0, 1);
		$('#live-steps').textContent = fmtInt(session.steps || session.distance / STEP_LENGTH_M);
		const p = garden.current;
		if (p) {
			const pct = Math.floor(p.growth * 100);
			$('#grow-name').textContent = plantName(p);
			$('#grow-pct').textContent = `${pct} %`;
			$('#grow-bar').style.width = `${pct}%`;
		}
		return;
	}
	const r = rates(state, state.place);
	const x = boostLeft(state) ? BOOST_MULT : 1;
	dot.className = `status-dot${state.tracking ? ' idle' : ''}`;
	title.textContent = state.tracking ? 'Au repos' : 'Suivi en pause';
	sub.textContent = state.tracking
		? `Ton écosystème travaille · +${fmtInt(r.nectar * x)} nectar/h${x > 1 ? ` · élan ×${x}` : ''}`
		: 'Active le suivi : tes pas feront pousser le jardin';
	renderDaily();
}

// ─── Chaque jour : cadeau, défis, prochain objectif ───────────

function renderDaily() {
	if (!state.daily) return;
	const goal = session ? null : nextGoal(state);
	$('#next-goal').hidden = !goal;
	if (goal) $('#next-goal-text').textContent = goal;
	const done = state.daily.challenges.filter(c => state.daily.claimed[c.id]).length;
	$('#daily-count').textContent = `${done} / 3`;
	$('#daily-dot').hidden = !(giftReady(state) || toClaim(state).length);
}

/** Le panneau du jour ; `gift` : premier passage de la journée, avec le cadeau à ouvrir. */
function showDaily(gift = false) {
	const d = state.daily;
	const g = giftFor(state);
	const ready = giftReady(state);
	const streak = d.streak > 0 ? `<b>${d.streak} jour${d.streak > 1 ? 's' : ''} actif${d.streak > 1 ? 's' : ''}</b> de suite${d.best > d.streak ? ` · record ${d.best}` : ''}` : 'Bouge 500 m pour lancer ta série';
	const top = ready
		? `<div class="gift"><span class="gift-box" aria-hidden="true">🎁</span><div><p>${streak}. Ton jardin t'a gardé un cadeau :</p>
			<span class="chip gold">+${g.nectar} nectar</span>${g.boost ? `<span class="chip">élan ×3 · ${g.boost} min</span>` : ''}</div></div>`
		: `<p class="streak">${streak}</p>`;
	// Le bilan de l'absence reste replié : la fenêtre tient sur l'écran.
	const note = gift && idleNote ? `<details class="away"><summary>Pendant ton absence</summary>${idleNote}</details>` : '';
	if (gift) idleNote = '';
	const goal = nextGoal(state);
	showModal(`<div class="modal-body"><h2>${gift ? 'Bonjour !' : "Aujourd'hui"}</h2>
		${weekHtml(state)}${top}
		<h3 class="ch-title">Défis du jour</h3>${challengesHtml(state)}
		${goal ? `<p class="next-line">${goal}</p>` : ''}${note}</div>
		<div class="modal-foot">${ready ? '<button class="btn primary" id="btn-gift">Ouvrir le cadeau</button>' : '<button class="btn primary" data-close>Voir mon jardin</button>'}</div>`);
	$('#btn-gift')?.addEventListener('click', () => {
		const got = claimGift(state);
		sound.chime(3);
		state.nectar = (state.nectar ?? 0) + got.nectar;
		if (got.boost) addBoost(state, got.boost);
		garden.burst(garden.cam.cx, garden.cam.cy, 30, '#F4C23E');
		toast(`Cadeau : +${got.nectar} nectar${got.boost ? ` et élan ×3 pendant ${got.boost} min` : ''}`, '#F4C23E');
		persist(true);
		renderHud();
		renderDaily();
		showDaily();
	});
}

$('#modal').addEventListener('click', e => {
	const b = e.target.closest('[data-claim]');
	if (!b) return;
	const c = claim(state, b.dataset.claim);
	if (!c) return;
	state.nectar = (state.nectar ?? 0) + c.reward;
	if (c.boost) addBoost(state, c.boost);
	sound.chime(2);
	toast(`Défi réussi : +${c.reward} nectar${c.boost ? ` et élan ${c.boost} min` : ''}`, '#F08A3C');
	persist(true);
	renderHud();
	renderDaily();
	showDaily();
});

$('#daily').addEventListener('click', () => showDaily());

/** Nouveau jour (ouverture, ou retour dans l'appli) : on prépare les défis et on offre le cadeau. */
function newDay() {
	rollDay(state);
	persist();
	renderDaily();
	return giftReady(state);
}

$('#btn-track').addEventListener('click', () => { enableTracking(true); sky.locate(true); });

// ─── Récap d'une balade ───────────────────────────────────────

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
	for (const ev of w.events) if (ev.kind === 'cell') chips.push(`<span class="chip gold">${zoneName(state.place, ev.n, 'Nouvelle parcelle')}</span>`);
	const title = w.distance > 3000 ? 'Quelle balade !' : 'Belle balade !';
	let ecoLine = '';
	if (w.distance > 50) {
		const r = rates(state, state.place);
		const mins = Math.min(360, (duration / 60) * BOOST_PER_MIN);
		const flowers = ((r.grow.fleur ?? 0) * (BOOST_MULT - 1) * mins) / 60 / PLANT_TYPES.fleur.cost;
		ecoLine = `<p class="eco-gain">Ton écosystème profite de ta sortie : <b>+${fmtInt(w.distance / 5)} nectar</b> et production <b>×${BOOST_MULT}</b> pendant ${fmtMin(mins)}${flowers >= 0.5 ? `, soit environ ${fmtInt(flowers)} fleur${flowers >= 1.5 ? 's' : ''} en plus grâce à tes pollinisateurs` : ''}.</p>`;
	}
	showModal(`
		<h2>${title}</h2><p>Voici ce qui a poussé grâce à toi.</p>
		<div class="walk-stats">
			<div><b>${fmt(w.distance / 1000)}</b><span>km</span></div>
			<div><b>${fmtTime(duration)}</b><span>durée</span></div>
			<div><b>${fmtInt(w.steps || w.distance / STEP_LENGTH_M)}</b><span>pas</span></div>
		</div>
		<div class="chips">${chips.join('')}</div>
		${ecoLine}
		<button class="btn primary" data-close>Retour au jardin</button>`);
}

// ─── Récolte des pas faits appli fermée ───────────────────────

let harvesting = false;

async function maybeHarvest(source = SOURCES[state.harvestSource], since = state.lastHarvest) {
	if (harvesting || session || !source) return;
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
	here().km += res.distance / 1000;
	state.totals.steps += res.steps;
	state.nectar = (state.nectar ?? 0) + res.distance / 5;
	// Une minute d'élan par minute active, ménage compris.
	addBoost(state, res.groups.reduce((n, g) => n + g.minutes, 0));
	renderHud();
	closeModal();
	toast(`${fmtInt(res.steps)} pas récoltés pendant ton absence`, '#A3BD57');
	garden.setFollow(true);
	const rows = [], events = [];
	for (const g of res.groups.sort((a, b) => b.effort - a.effort)) {
		const matured = {}, touched = new Set();
		const chunks = 8;
		for (let i = 0; i < chunks; i++) {
			for (const ev of garden.addEffort(g.act.plant, g.effort / chunks)) if (ev.kind === 'mature') matured[ev.plant.type] = (matured[ev.plant.type] ?? 0) + 1;
			if (garden.current) touched.add(garden.current);
			await sleep(140);
		}
		state.totals.effort += g.effort;
		addEffortXp(g.effort);
		rows.push(`<li><b>${g.act.name}</b> · ${fmtMin(g.minutes)} · ${fmtInt(g.steps)} pas<br>${growthChips(matured, touched).join('')}</li>`);
	}
	garden.setFollow(false);
	checkUnlocks(events);
	persist(true);
	const decor = events.map(ev => `<span class="chip gold">${DECOR[ev.key].name}</span>`).join('');
	showModal(`
		<h2>Pendant ton absence</h2>
		<p>${fmtInt(res.steps)} pas · ${fmt(res.distance / 1000)} km, comptés par ${source.label}. Même le ménage fait pousser ton jardin.</p>
		<ul class="harvest-rows">${rows.join('')}</ul>${decor ? `<div class="chips">${decor}</div>` : ''}
		${idleNote ? `<p>Et ton écosystème a travaillé :</p>${idleNote}` : ''}
		<button class="btn primary" data-close>Voir mon jardin</button>`);
	idleNote = '';
	announceSpecies();
}

// ─── Écosystème qui travaille seul ────────────────────────────

let idleNote = '';

/** Fait travailler l'écosystème depuis la dernière fois ; `report` : montrer le bilan d'une longue absence. */
function runIdle(report = false) {
	const summary = tick(state, garden);
	renderHud();
	if (!summary) return;
	persist();
	if (report && summary.hours > 10 / 60) idleNote = summaryHtml(summary);
}
setInterval(() => { if (!document.hidden) runIdle(); }, 5000);

function showIdleRecap() {
	if (!idleNote || !$('#modal').hidden || !$('#coach').hidden) return;
	showModal(`<div class="modal-body"><h2>Pendant ton absence</h2><p>Tes animaux ont continué de travailler. Bouge pour tripler leur production.</p>
		${idleNote}</div><div class="modal-foot"><button class="btn primary" data-close>Voir mon jardin</button></div>`);
	idleNote = '';
}

/** Propose, une fois, de lire les pas comptés par le téléphone (seulement dans l'appli installée). */
async function offerHarvest() {
	if (state.harvestSource || state.harvestDeclined) return;
	const source = await bestSource(false);
	if (!source) return;
	showModal(`
		<h2>Ton jardin pousse même appli fermée</h2>
		<p>Ton téléphone compte déjà tes pas avec ${source.label}. Evolia peut les relire à chaque ouverture. Ces données restent sur ton téléphone.</p>
		<button class="btn primary" id="btn-allow">Autoriser</button>
		<button class="btn ghost wide" data-close id="btn-later">Plus tard</button>`);
	$('#btn-later').onclick = () => { state.harvestDeclined = true; persist(true); };
	$('#btn-allow').onclick = async () => {
		closeModal();
		let ok = false;
		try { ok = await source.authorize(); } catch (e) { console.warn(e); }
		if (!ok) { toast('Sans autorisation, seuls les pas faits appli ouverte comptent', '#C0442F'); return; }
		state.harvestSource = source.id;
		const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
		state.lastHarvest = midnight.getTime(); // premier cadeau : les pas d'aujourd'hui
		persist(true);
		maybeHarvest();
	};
}

document.addEventListener('visibilitychange', async () => {
	if (document.hidden) { persist(true); sound.pause(); return; }
	sound.resume();
	runIdle(true);
	if (Date.now() - state.lastHarvest > 5 * 60000) await maybeHarvest();
	if (newDay() && $('#modal').hidden) showDaily(true);
	else showIdleRecap();
	sky.refresh();
});

// ─── Carnet ───────────────────────────────────────────────────

function renderJournal() {
	const km = state.totals.distance / 1000;
	const plants = allPlants(state);
	const mature = t => plants.filter(p => p.type === t && p.growth >= 1).length;
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
	const pl = here();
	$('#journal').innerHTML = `
		<div class="panel-head"><h2>Carnet</h2><button class="close" data-close-journal aria-label="Fermer">×</button></div>
		<div class="tiles">
			<div class="tile"><b>${fmt(km, 1)}</b><span>km au total</span></div>
			<div class="tile"><b>${fmtInt(state.totals.steps)}</b><span>pas</span></div>
			<div class="tile"><b>${plants.filter(p => p.growth >= 1).length}</b><span>plantes</span></div>
		</div>
		<div class="tiles">
			<div class="tile"><b>${state.daily?.streak ?? 0}</b><span>jours de suite</span></div>
			<div class="tile"><b>${state.daily?.best ?? 0}</b><span>record</span></div>
			<div class="tile"><b>${collection(state).found}</b><span>espèces sur ${collection(state).total}</span></div>
		</div>
		<h3>Ces 7 derniers jours</h3>
		<div class="week">
			<div class="goal" style="bottom:${(state.goalKm / max) * 100}%" title="Objectif"></div>
			${days.map(x => `<div class="col${x.today ? ' today' : ''}"><div class="b" style="height:${(x.km / max) * 100}%"></div><span>${letters[x.d.getDay()]}</span></div>`).join('')}
		</div>
		<h3>Tous tes jardins</h3>
		<ul class="rows">
			${Object.entries(PLANT_TYPES).map(([t, d]) => `<li><span>${d.plural[0].toUpperCase() + d.plural.slice(1)} <small>· ${ACTIVITIES.filter(a => a.plant === t).map(a => a.name.toLowerCase()).join(', ')}</small></span><b>${mature(t)}</b></li>`).join('')}
		</ul>
		<h3>${PLACE_BY_ID[state.place].name} · ${fmt(pl.km, 1)} km ici</h3>
		<ul class="rows">
			${Object.entries(DECOR).filter(([, d]) => d.place === state.place && !d.always).map(([k, d]) => `<li><span>${d.name}</span><b>${pl.unlocked[k] ? '✓' : `à ${d.km} km`}</b></li>`).join('')}
		</ul>
		<h3>Ton album</h3>
		<div id="album">${albumHtml(state)}</div>
		<h3>Dernières balades</h3>
		${walks ? `<ul class="rows">${walks}</ul>` : '<p class="empty">Ta première balade apparaîtra ici.</p>'}
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
	const al = e.target.closest('[data-open-sp]');
	if (al) species.open(al.dataset.openSp);
});

// ─── De près : la récolte du nectar en direct ─────────────────

// Le compteur du bandeau, cible des gouttes de nectar (coordonnées dans le canevas).
garden.nectarTarget = () => {
	const el = $('#hud-steps .nectar'), c = garden.canvas.getBoundingClientRect();
	if (!el) return [garden.canvas.clientWidth - 60, 40];
	const r = el.getBoundingClientRect();
	return [r.left - c.left + 6, r.top - c.top + r.height / 2];
};
garden.onNectar = () => {
	const el = $('#hud-steps .nectar');
	if (!el) return;
	el.classList.remove('bump');
	void el.offsetWidth; // relance l'animation
	el.classList.add('bump');
};

/** Production par heure, dans tous les lieux (l'écosystème travaille partout à la fois). */
function nectarPerHour() {
	const x = boostLeft(state) ? BOOST_MULT : 1;
	return Object.keys(state.places).reduce((a, id) => a + rates(state, id).nectar, 0) * x;
}

function renderZoomInfo() {
	const card = $('#zoom-info');
	// De près, une petite icône ; les détails ne s'ouvrent que si on la touche (et restent ouverts ensuite).
	const close = garden.cam.z >= 1.3 && !garden.glyph && !placing && $('#modal').hidden && $('#coach').hidden;
	$('#btn-zoom-info').hidden = !close;
	$('#btn-zoom-info').classList.toggle('on', !!state.showZoomInfo);
	const show = close && !!state.showZoomInfo;
	card.hidden = !show;
	if (!show) return;
	const x = boostLeft(state) ? BOOST_MULT : 1;
	const r = rates(state, state.place);
	// Le total avance en direct entre deux passages de l'écosystème (toutes les 5 s).
	const live = (state.nectar ?? 0) + nectarPerHour() * (Date.now() - (state.lastIdle ?? Date.now())) / 3600000;
	const rows = Object.entries(GUILDS).filter(([gid]) => r.members[gid] > 0).map(([gid, g]) =>
		`<li><span>${g.name} <small>×${r.members[gid]}</small></span><b>+${fmt(g.nectar * r.members[gid] * r.mult * x, 1)}/h</b></li>`).join('');
	const growing = garden.current && garden.current.growth < 1 ? garden.current : null;
	card.innerHTML = `<div class="zi-head"><b>Récolte du nectar</b>${x > 1 ? `<span class="zi-boost">élan ×${x} · ${fmtMin(boostLeft(state) / 60000)}</span>` : ''}</div>
		<div class="zi-total"><span class="nectar">${live.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><small>+${fmt(r.nectar * x, 1)}/h ici</small></div>
		${rows ? `<ul>${rows}</ul>` : '<p>Découvre des pollinisateurs : ils récoltent le nectar pour toi.</p>'}
		<p class="zi-move">En marchant : +1 nectar tous les 5 m${x === 1 ? ', et la récolte triple ensuite' : ''}.</p>
		${growing ? `<p class="zi-grow">${plantName(growing)} · ${Math.floor(growing.growth * 100)} %</p>` : ''}`;
}
setInterval(renderZoomInfo, 250);
$('#btn-zoom-info').addEventListener('click', () => {
	state.showZoomInfo = !state.showZoomInfo;
	persist();
	renderZoomInfo();
});

// Mode test : images par seconde, pour vérifier la fluidité sur un vrai téléphone.
setInterval(() => {
	const el = $('#fps');
	el.hidden = !DEV;
	if (DEV) el.textContent = `${Math.round(garden.fps ?? 0)} i/s · ${garden.place.plants.length} plantes · ${garden.insects.length} bêtes`;
}, 500);

// ─── Aménager : cabane, banc, abris pour les animaux ──────────

let placing = null; // { kind, item? } pendant qu'on choisit la place d'un objet

function renderDeco() {
	const km = state.totals.distance / 1000;
	const nectar = state.nectar ?? 0;
	const here_ = garden.items;
	$('#deco').innerHTML = `
		<div class="panel-head"><h2>Aménager</h2><button class="close" data-close-deco aria-label="Fermer">×</button></div>
		<p class="sp-intro">Installe de quoi rendre ton jardin accueillant, pour toi et pour les animaux. Tout se paie en nectar, et se range quand tu veux (le nectar t'est rendu).</p>
		<div class="deco-list">${ITEM_ORDER.map(k => {
			const it = ITEMS[k], locked = km < it.km, poor = nectar < it.cost, n = here_.filter(x => x.kind === k).length;
			const action = locked ? `<span class="deco-lock">dès ${it.km} km parcourus</span>`
				: `<button class="btn primary small" data-buy="${k}" ${poor ? 'disabled' : ''}>${poor ? `il manque ${fmtInt(it.cost - nectar)}` : 'Installer'}</button>`;
			return `<div class="deco-card${locked ? ' locked' : ''}"><div class="deco-art" data-art="${k}"></div>
				<div class="deco-body"><h3>${it.name}</h3><p>${it.text}</p>
				<div class="deco-row"><span class="nectar">${it.cost}</span>${n ? `<small>${n} ici</small>` : ''}${action}</div></div></div>`;
		}).join('')}</div>`;
	for (const el of $('#deco').querySelectorAll('[data-art]')) {
		const sp = garden.itemSprite(el.dataset.art), c = document.createElement('canvas');
		c.width = sp.canvas.width; c.height = sp.canvas.height;
		c.getContext('2d').drawImage(sp.canvas, 0, 0);
		el.appendChild(c);
	}
}

function openDeco() {
	renderDeco();
	$('#deco').classList.add('open');
	$('#deco').setAttribute('aria-hidden', 'false');
}
function closeDeco() {
	$('#deco').classList.remove('open');
	$('#deco').setAttribute('aria-hidden', 'true');
}

/** Choisir la place d'un objet : un fantôme suit le doigt, vert si la place convient ; « Installer ici » confirme. */
function startPlacing(kind, item = null) {
	closeDeco();
	placing = { kind, item };
	garden.lifted = item;
	const [cx, cy] = item ? [item.x, item.y] : garden.toWorld(garden.canvas.clientWidth / 2, garden.canvas.clientHeight * 0.45);
	garden.ghost = { kind, x: cx, y: cy };
	$('#placing-name').textContent = ITEMS[kind].name;
	$('#app').classList.add('placing');
	$('#placing').hidden = false;
	renderPlacing();
}

function renderPlacing() {
	const ok = garden.canPlace(placing.kind, garden.ghost.x, garden.ghost.y, placing.item);
	$('#placing-hint').textContent = ok ? 'Bonne place. Touche ailleurs pour la changer.' : 'Touche le jardin, à l’intérieur de la clôture.';
	$('#btn-place').disabled = !ok;
}

function movePlacing(hit) {
	if (!hit) return;
	const [wx, wy] = garden.toWorld(hit.x, hit.y);
	garden.ghost = { kind: placing.kind, x: wx, y: wy };
	renderPlacing();
}

function endPlacing() {
	placing = null;
	garden.ghost = null;
	garden.lifted = null;
	$('#app').classList.remove('placing');
	$('#placing').hidden = true;
}

$('#btn-place').addEventListener('click', () => {
	const { kind, item } = placing, { x, y } = garden.ghost;
	if (!garden.canPlace(kind, x, y, item)) return;
	if (item) {
		item.x = Math.round(x); item.y = Math.round(y);
		garden.clearUnder(item);
		garden.popItem(item);
	} else {
		if ((state.nectar ?? 0) < ITEMS[kind].cost) { toast('Pas assez de nectar', '#C0442F'); return endPlacing(); }
		state.nectar -= ITEMS[kind].cost;
		garden.placeItem(kind, x, y);
		toast(`${ITEMS[kind].name} : installé${/^Une /.test(ITEMS[kind].name) ? 'e' : ''} !`, '#9A7448');
	}
	sound.chime(2);
	endPlacing();
	renderHud();
	persist(true);
});
$('#btn-place-cancel').addEventListener('click', endPlacing);

function tapItem(hit, card) {
	const it = hit.item, def = ITEMS[it.kind];
	card.innerHTML = `<b>${def.name}</b>${def.text}
		<div class="item-actions"><button class="btn ghost" data-move>Déplacer</button><button class="btn ghost" data-store>Ranger (+${def.cost})</button></div>`;
	card.classList.remove('link');
	card.classList.add('actions');
	card.onclick = e => {
		if (e.target.closest('[data-move]')) { card.hidden = true; startPlacing(it.kind, it); }
		if (e.target.closest('[data-store]')) {
			card.hidden = true;
			garden.items.splice(garden.items.indexOf(it), 1);
			state.nectar = (state.nectar ?? 0) + def.cost;
			garden.nextPopulate = 0;
			toast(`${def.name} rangé${/^Une /.test(def.name) ? 'e' : ''} : +${def.cost} nectar`, '#9A7448');
			renderHud();
			persist(true);
		}
	};
	placeCard(card, hit, 6000);
}

$('#deco').addEventListener('click', e => {
	if (e.target.closest('[data-close-deco]')) return closeDeco();
	const b = e.target.closest('[data-buy]');
	if (b && !b.disabled) startPlacing(b.dataset.buy);
});
$('#btn-deco').addEventListener('click', openDeco);

// ─── Options : version, réglages, mode test ───────────────────

const isApp = () => !!window.Capacitor?.isNativePlatform?.();

function renderOptions() {
	const src = SOURCES[state.harvestSource];
	$('#options').innerHTML = `
		<div class="panel-head"><h2>Options</h2><button class="close" data-close-options aria-label="Fermer">×</button></div>
		<div class="opt-version"><img src="assets/logo.png" alt=""><div><b>Evolia v${VERSION}</b><span>${isApp() ? 'Appli Android' : 'Version web'} · données gardées sur ce téléphone</span></div></div>
		<h3>Objectif du jour</h3>
		<div class="seg" id="goal-seg">${[2, 3, 5, 8].map(g => `<button data-goal="${g}" class="${g === state.goalKm ? 'on' : ''}">${g} km</button>`).join('')}</div>
		<h3>Suivi de tes pas</h3>
		<p class="empty">${state.tracking ? "Actif : dès que tu bouges appli ouverte, une balade démarre toute seule et s'arrête après une minute d'immobilité." : 'En pause.'}
			${src ? ` Pas relus appli fermée avec ${src.label} ; dernière récolte : ${new Date(state.lastHarvest).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : isApp() ? '' : " Dans l'appli mobile, les pas faits appli fermée sont aussi relus."}</p>
		${state.tracking ? '' : '<button class="btn ghost wide" id="btn-track-2">Activer le suivi</button>'}
		${isApp() && !src ? '<button class="btn ghost wide" id="opt-harvest">Relire les pas faits appli fermée</button>' : ''}
		<h3>Le ciel</h3>
		<p class="empty">${sky.label()} · lever ${fmtHour(garden.sun.rise)}, coucher ${fmtHour(garden.sun.set)}.
			${state.coords ? 'Météo réelle de ton coin (position arrondie à 10 km, envoyée à Open-Meteo).' : 'Active ta position approximative pour voir la vraie météo et le vrai coucher du soleil.'}</p>
		${state.coords ? '' : '<button class="btn ghost wide" id="btn-sky">Utiliser ma position approximative</button>'}
		<h3>Sons de la nature</h3>
		<label class="switch"><input type="checkbox" id="opt-sound" ${sound.settings.on ? 'checked' : ''}><i></i><span>Vent, pluie, oiseaux et petites bêtes de ton jardin</span></label>
		${sound.settings.on ? `<input type="range" id="opt-volume" class="volume" min="0" max="1" step="0.05" value="${sound.settings.vol}" aria-label="Volume">` : ''}
		<h3>Aide</h3>
		<button class="btn ghost wide" id="opt-coach">Revoir le tutoriel</button>
		<a class="btn ghost wide opt-link" href="privacy.html" target="_blank" rel="noopener">Confidentialité</a>
		<h3>Recommencer</h3>
		<p class="empty">Efface ton jardin, tes lieux, tes espèces et tes balades sur ce téléphone, pour repartir d'une prairie neuve.</p>
		<button class="btn ghost wide danger" id="opt-reset">Recommencer à zéro</button>
		<h3>Mode test</h3>
		<label class="switch"><input type="checkbox" id="opt-dev" ${DEV ? 'checked' : ''}><i></i><span>Outils de test et raccourcis (pour essayer le jeu sans marcher)</span></label>
		${DEV ? `<div class="dev">Heure du jardin <b id="dev-h">${garden.hourOverride ?? 'réelle'}</b>
			<input type="range" id="dev-hour" min="0" max="24" step="0.25" value="${garden.hourOverride ?? new Date().getHours()}">
			<button id="dev-hour-real">Revenir à l'heure réelle</button>
			<div class="dev-label">Météo</div>
			<div class="seg" id="dev-weather">${['réelle', ...Object.keys(WEATHER_LABEL)].map(k => `<button data-w="${k}" class="${(sky.override ?? 'réelle') === k ? 'on' : ''}">${WEATHER_LABEL[k] ?? 'Réelle'}</button>`).join('')}</div>
			<div class="dev-label">Déplacement simulé <b id="sim-v">${tracking.sim ? `${fmt(tracking.sim.speedKmh, 1)} km/h` : 'arrêté'}</b></div>
			<input type="range" id="sim-speed" min="0" max="20" step="0.5" value="${tracking.sim?.speedKmh ?? 5}">
			<div class="seg" id="sim-ts">${[1, 10, 60].map(t => `<button data-ts="${t}" class="${(tracking.sim?.timeScale ?? 1) === t ? 'on' : ''}">×${t}</button>`).join('')}</div>
			<button id="dev-sim">${tracking.sim ? 'Arrêter le déplacement simulé' : 'Simuler un déplacement'}</button>
			<button id="dev-harvest">Simuler une journée d'activité</button>
			<button id="dev-km">+1 km ici (agrandir la clôture)</button>
			<button id="dev-km10">+10 km (ouvrir des lieux)</button>
			<button id="dev-nectar">+500 nectar</button>
			<button id="dev-day">Nouveau jour (cadeau et défis)</button>
			<button id="dev-reset" class="danger">Effacer le jardin</button></div>` : ''}`;
}

function openOptions() {
	renderOptions();
	$('#options').classList.add('open');
	$('#options').setAttribute('aria-hidden', 'false');
}
function closeOptions() {
	$('#options').classList.remove('open');
	$('#options').setAttribute('aria-hidden', 'true');
}

$('#options').addEventListener('click', async e => {
	if (e.target.closest('[data-close-options]')) return closeOptions();
	const g = e.target.closest('[data-goal]');
	if (g) { state.goalKm = Number(g.dataset.goal); persist(true); renderHud(); renderDaily(); renderOptions(); }
	const w = e.target.closest('[data-w]');
	if (w) { sky.override = w.dataset.w === 'réelle' ? null : w.dataset.w; sky.apply(); renderOptions(); }
	const ts = e.target.closest('[data-ts]');
	if (ts && tracking.sim) { tracking.sim.timeScale = Number(ts.dataset.ts); renderOptions(); }
	const id = e.target.id;
	if (id === 'btn-sky') { await sky.locate(true); persist(true); renderOptions(); }
	if (id === 'btn-track-2') { enableTracking(true); sky.locate(true); renderOptions(); }
	if (id === 'opt-harvest') { state.harvestDeclined = false; closeOptions(); offerHarvest(); }
	if (id === 'opt-coach') { closeOptions(); coach(0); }
	if (id === 'dev-hour-real') { garden.hourOverride = null; renderOptions(); }
	if (id === 'dev-sim') {
		if (tracking.sim) { tracking.sim.stop(); tracking.sim = null; }
		else {
			tracking.sim = new SimTracker(s => onSample({ ...s, sim: true }), () => {});
			tracking.sim.speedKmh = parseFloat($('#sim-speed').value);
			tracking.sim.timeScale = Number($('#sim-ts .on')?.dataset.ts ?? 1);
			tracking.sim.start();
		}
		renderOptions();
	}
	if (id === 'dev-harvest') { closeOptions(); maybeHarvest(SOURCES.mock, Date.now() - 16 * 3600000); }
	if (id === 'dev-km' || id === 'dev-km10') { addMeters(id === 'dev-km' ? 1000 : 10000); checkUnlocks(); announceSpecies(); renderHud(); persist(true); renderOptions(); }
	if (id === 'dev-nectar') { state.nectar = (state.nectar ?? 0) + 500; renderHud(); persist(true); toast('+500 nectar', '#F4C23E'); }
	if (id === 'dev-day') {
		if (state.daily) state.daily.day = null;
		rollDay(state);
		state.daily.giftDay = null;
		persist(true);
		renderDaily();
		closeOptions();
		showDaily(true);
	}
	if ((id === 'dev-reset' || id === 'opt-reset') && confirm('Recommencer à zéro ? Ton jardin, tes lieux, tes espèces et tes balades seront effacés.')) {
		clearTimeout(saveTimer);
		resetting = true;
		reset();
		location.reload();
	}
});
$('#options').addEventListener('change', e => {
	if (e.target.id === 'opt-sound') { sound.setOn(e.target.checked); persist(true); renderOptions(); return; }
	if (e.target.id === 'opt-volume') { persist(true); return; }
	if (e.target.id !== 'opt-dev') return;
	DEV = e.target.checked;
	try { localStorage.setItem(DEV_KEY, DEV ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
	if (DEV) window.evolia = { garden, state, sky, sound };
	renderOptions();
});
$('#options').addEventListener('input', e => {
	if (e.target.id === 'opt-volume') sound.setVolume(parseFloat(e.target.value));
	if (e.target.id === 'dev-hour') {
		garden.hourOverride = parseFloat(e.target.value);
		$('#dev-h').textContent = `${e.target.value} h`;
	}
	if (e.target.id === 'sim-speed' && tracking.sim) {
		tracking.sim.speedKmh = parseFloat(e.target.value);
		$('#sim-v').textContent = `${fmt(tracking.sim.speedKmh, 1)} km/h`;
	}
});

// ─── Boutons ──────────────────────────────────────────────────

$('#btn-journal').addEventListener('click', openJournal);
$('#btn-options').addEventListener('click', openOptions);
$('#btn-species').addEventListener('click', () => species.open());
$('#btn-eco').addEventListener('click', () => eco.open());
$('#hud').addEventListener('click', () => places.open());
$('#modal').addEventListener('click', e => {
	const sp = e.target.closest('[data-open-sp]');
	if (sp) species.open(sp.dataset.openSp);
	if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal();
});

// ─── Tutoriel express : trois étapes, presque sans texte ──────

const COACH = [
	{ title: 'Ton jardin est vivant', text: 'Glisse pour te promener, pince pour zoomer.', actions: [['Suivant', 'next']] },
	{ title: 'Bouge, il pousse', text: 'Tes pas le font grandir. Même le ménage.', actions: [['Activer le suivi', 'track'], ['Plus tard', 'next']] },
	{ title: 'Touche les animaux', text: 'Chaque espèce a un rôle. Découvre-les.', actions: [["C'est parti", 'done']] },
];

function coach(step = 0) {
	const c = COACH[step], el = $('#coach');
	el.querySelector('.coach-card').innerHTML = `
		<div class="coach-dots">${COACH.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
		<h2>${c.title}</h2><p>${c.text}</p>
		<div class="coach-actions">${c.actions.map(([label, act], i) => `<button class="btn ${i ? 'ghost' : 'primary'}" data-coach="${act}">${label}</button>`).join('')}</div>`;
	el.hidden = false;
	el.onclick = async e => {
		const act = e.target.closest('[data-coach]')?.dataset.coach;
		if (!act) return;
		if (act === 'track') { enableTracking(true); sky.locate(true); }
		if (act === 'done') {
			el.hidden = true;
			state.seenIntro = true;
			persist(true);
			setTimeout(offerHarvest, 400);
			renderDaily();
			return;
		}
		coach(step + 1);
	};
}

// ─── Démarrage ────────────────────────────────────────────────

// Le logo pendant 1 s, puis un fondu doux vers le jardin.
const splash = $('#splash');
setTimeout(() => {
	splash.classList.add('out');
	setTimeout(() => splash.remove(), 1300);
}, 1000);

// Glisser dans le jardin efface l'interface pour le voir en entier ; relâcher la fait revenir.
garden.onPeek = on => {
	$('#app').classList.toggle('peek', on);
	if (on) $('#plant-card').hidden = true;
};

renderHud();
renderStatus();
const firstRun = !state.seenIntro;
rollDay(state);
checkUnlocks();
announceSpecies(firstRun);
updateSpeciesDot();
persist(true);
if (!sky.override) sky.start();
resumeTracking();
if (firstRun) {
	setTimeout(() => coach(0), 1600);
} else {
	runIdle(true);
	maybeHarvest().then(() => (newDay() ? setTimeout(() => showDaily(true), 300) : showIdleRecap()));
}
