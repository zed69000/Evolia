// Interface : bandeau, suivi automatique du mouvement, récolte des pas, récap, carnet, biodiversité, tutoriel.

import { nectarPerEffort, addDayEffort, slots, slotSummary, createSlot, useSlot, renameSlot, deleteSlot, load, save, reset, allPlants, biomeKm, heartOf, ACTIVITIES, ACTIVITY_BY_ID, MAX_SPEED_KMH, activityFor, effortFor, hikeFor, HIKE_WINDOW, dayKey, todayMeters, addDistance, STEP_LENGTH_M, effortMix } from './state.js';
import { Garden, CELLS, CELL_KM, cellsOpen, cellName, cellOrigin, TURN_VIEWS, snapRot } from './garden.js';
const LINK_KINDS = new Set(['haie', 'muret', 'pas']);
import { PlacesMap } from './map.js';
import { PLANT_TYPES, DECOR, plantName } from './plants.js';
import { GpsTracker, MotionTracker, SimTracker } from './tracker.js';
import { SOURCES, bestSource, harvest, classifyCadence } from './harvest.js';
import { PLACES, PLACE_BY_ID, PLACE_DE, PLACE_IN, SPECIES, SPECIES_BY_ID, checkSpecies, placeOpen, speciesOf, unreadSpecies, speciesWaiting, UNREAD_MAX } from './species.js';
import { Encyclopedia, READ_REWARD, thumbCopy } from './encyclopedia.js';
import { Sky, WEATHER_LABEL } from './weather.js';
import { EcoPanel, tick, summaryHtml, addBoost, boostLeft, visualExtra, rates, GUILDS, boostMult, boostPerMin, maxBoostH, nectarCapacity, hasCollector, COLLECTOR_CAP, COLLECTOR_UPGRADE, addWaiting, ECO2_WALK, groundOf, jarOf, jarCap, stockOf, jarCapOf, emptyJar, drainGround } from './idle.js';
import { paperTexture } from './watercolor.js';
import { Soundscape } from './audio.js';
import { ITEMS, ITEM_ORDER, itemHelp, itemCost, fitsPlace, CATS, MAX_LEVEL, LEVEL_NAME, LEVEL_KM, canLevel, levelCost, CABIN_STYLES, seedBirds, birdHelp } from './deco.js';
import { VERSION } from './version.js';
import { startIntro, INTRO_NECTAR, FLOWER, FLOWER_SEED } from './intro.js';
import { makeQuiz, quizReady, streakMult, QUIZ_GAP, QUIZ_PER_DAY, noteAnswer, QUIZ_MIN_PLANTS, QUIZ_MIN_ANIMALS, quizEnough } from './quiz.js';
import { LADDER, isLadder, ladderPrice, ladderLock, nextUpgrade, unitProd, prodPerHour, produce, KM_HOURS, KM_VALUE_H, UPG_AT, REST, plantCover, ownedOf, PER_PARCEL, LEVEL_PROD, LEVEL_KM2, levelPrice, levelsOf, MOMENTS, NEAR_USE, NEAR_R, NEAR_NEED, SYN_PER, SYN_MAX, guildEffect, nearOf, itemProd, GUILD_BONUS } from './habitats.js';
import { exportCode, importCode, backupAge } from './backup.js';
import { DebugPanel, debugOn, setDebug, debugLog, ago, dur, trace, traceFlush } from './debug.js';
import { canNotify, askNotify, scheduleReminders, clearReminders } from './notify.js';
import { rollDay, markActive, giftReady, giftFor, claimGift, claim, toClaim, noteTap, noteQuest, challengesHtml, weekHtml, nextGoal, albumHtml, collection, herbarium, newlyComplete, HERBARIUM_REWARD, addMomentChallenge, noteMomentMeters, noteVisitor, seasonHtml, seasonRewards } from './daily.js';
import { fmtFixed as fmt, fmtInt, fmtNum } from './format.js';

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
garden.idleBonus = sp => visualExtra(state, state.place, sp);
// L'agencement (nouvelle économie) : chaque habitat de l'échelle vit des plantes à sa portée.
Object.assign(garden, { nearUse: NEAR_USE, nearR: NEAR_R, nearNeed: NEAR_NEED, synPer: SYN_PER, synMax: SYN_MAX });
/** Remesure le voisinage des habitats d'ici, et ce que les semeurs découverts apportent aux oiseaux. */
function updateNear() {
	if (!state.eco2) return;
	updateMoment();
	garden.measureNear();
	garden.sowBonus = guildEffect(state).sow;
}
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

const species = new Encyclopedia($('#species'), state, e => {
	// La première lecture d'une fiche rapporte un peu de nectar, directement dans la bourse.
	if (e?.reward) { state.nectar = (state.nectar ?? 0) + e.reward; renderHud(); sound.chime?.(1); rewardFly(e.reward); }
	persist();
	updateSpeciesDot();
});
// Pendant l'introduction, la toute première fiche lue rapporte de quoi s'offrir la première ruche.
// Au début, la page Espèces ne montre que ce qu'on a découvert, en plantes et insectes.
species.simple = () => !!state.intro || (state.eco2 && Object.keys(state.species).length < 12);
species.rewardFor = () => (state.intro && !state.introPaid ? ((state.introPaid = true), INTRO_NECTAR) : state.intro ? null : readReward());
species.rewardPreview = () => readReward();
const places = new PlacesMap($('#map'), state, showBiome);
// Aider une équipe de l'écosystème, c'est poser l'objet qui l'attire (s'il est débloqué et payable), sinon voir la liste.
// La récolte en attente : sans collecteur, elle perle sur les fleurs ; avec, elle remplit les jarres.
// Avec un collecteur, quelques gouttes restent visibles sur les fleurs : on voit que la récolte attend, et en toucher une vide tout.
garden.dewAmount = () => groundOf(state);
// Le chantier d'un objet posé : un « toc » à chaque coup de marteau, une petite cloche à la fin.
garden.onBuildTap = k => sound.knock(k);
garden.onBuildDone = () => sound.chime(2);
// Chaque collecteur a sa réserve, remplie par les fleurs qui l'entourent.
garden.jarStock = it => ({ v: stockOf(state, it), cap: jarCapOf(it) });

/**
 * La cagnotte : quand on récolte, la bourse ne saute pas d'un coup, elle grimpe. Un flot de gouttes part du collecteur
 * (ou de la fleur), chacune tinte un peu plus haut que la précédente en arrivant, puis un grand « +N » et une gerbe dorée.
 * Plus la récolte est grosse, plus ça dure (jusqu'à 3 s).
 */
let purseAnim = null;
const shownNectar = () => {
	if (!purseAnim) return state.nectar ?? 0;
	const k = Math.max(0, Math.min(1, (performance.now() - purseAnim.t0) / purseAnim.dur));
	// Départ doux, montée régulière, arrivée qui ralentit : comme le compteur d'une cagnotte.
	return purseAnim.from + (purseAnim.to - purseAnim.from) * k * k * (3 - 2 * k);
};
/** Le compteur de la bourse monte de `from` jusqu'au montant réel, après `delay` ms (l'arrivée du premier nectar). */
function countPurse(from, delay = 0, dur = 1400) {
	purseAnim = { from, to: state.nectar ?? 0, t0: performance.now() + delay, dur, drops: 0, got: 0 };
	const step = () => {
		const el = $('#hud-steps .nectar');
		if (el) el.textContent = fmtInt(shownNectar());
		if (purseAnim && performance.now() < purseAnim.t0 + purseAnim.dur) return requestAnimationFrame(step);
		purseAnim = null;
		renderHud();
	};
	requestAnimationFrame(step);
}

// ─── Le quiz des fiches (quiz.js) ───
/**
 * Plus rien à faire ? Rien d'achetable (habitat, amélioration, niveau, terrain, parcelle), aucune fiche à lire, pas
 * de sortie en cours : c'est le moment du quiz.
 */
function nothingToDo() {
	if (!state.eco2 || state.intro || session || unreadSpecies(state).length) return false;
	const nectar = state.nectar ?? 0, prices = [];
	for (const k of Object.keys(LADDER)) {
		if (!ladderLock(state, k)) prices.push(ladderPrice(state, k));
		const u = nextUpgrade(state, k); if (u?.ok) prices.push(u.cost);
	}
	for (const it of garden.items) { const nx = isLadder(it.kind) && nextLevel(it); if (nx?.ok) prices.push(nx.cost); }
	if (growable() != null) prices.push(growPrice());
	return !prices.some(p => p <= nectar);
}

/**
 * Ce que rapporte une bonne réponse, avant la série : 10 nectar, plus 3 par espèce découverte, plus un quart d'heure
 * de la production du jardin. Un quiz réussi vaut donc près d'une heure de production : un vrai coup de pouce quand il
 * n'y a plus rien à faire, sans jamais valoir une sortie.
 */
const quizBase = () => Math.max(15, Math.round((10 + 3 * Object.keys(state.species).length + prodPerHour(state) * 0.25) / 5) * 5);

/** La ligne du quiz dans les défis du jour : quand il arrive, ou un bouton pour jouer. */
function quizLine() {
	if (!state.eco2 || state.intro) return '';
	const qz = state.quiz ?? {}, today = qz.day === dayKey() ? qz.n ?? 0 : 0, wait = (qz.at ?? 0) + QUIZ_GAP - Date.now();
	const what = !quizEnough(state) ? `Il arrive quand tu connais ${QUIZ_MIN_PLANTS} plantes et ${QUIZ_MIN_ANIMALS} animaux depuis au moins un jour.`
		: today >= QUIZ_PER_DAY ? 'Fini pour aujourd’hui : reviens demain.'
		: wait > 0 ? `Le prochain dans ${Math.ceil(wait / 3600000)} h.` : null;
	return `<div class="quiz-line"><span class="ch-ico" aria-hidden="true">❓</span><div><b>Quiz des fiches</b><small>${what ?? `Trois questions sur tes espèces · ${fmtInt(quizBase())} nectar par bonne réponse`}</small></div>${what ? '' : '<button class="btn primary small" id="btn-quiz">Jouer</button>'}</div>`;
}

/** Proposer le quiz (une fenêtre qui explique, puis trois questions). `force` : outils du développeur. */
function offerQuiz(force = false) {
	const qs = makeQuiz(state);
	if (!qs) { if (force) toast(`Le quiz porte sur les fiches lues avant aujourd’hui : il en faut ${QUIZ_MIN_PLANTS} de plantes et ${QUIZ_MIN_ANIMALS} d’animaux`, '#9A7448'); return; }
	const base = quizBase(), streak = state.quizStreak ?? 0;
	showModal(`<h2>Le quiz des fiches</h2>
		<p>Trois questions sur les espèces que tu connais. Bonne réponse : <b>${fmtInt(base)} nectar</b>, plus encore si tu enchaînes (jusqu’à × 4). Tu peux feuilleter ton livre des espèces.</p>
		${streak ? `<p class="item-tip">Ta série en cours : ${streak} bonne${streak > 1 ? 's' : ''} réponse${streak > 1 ? 's' : ''} (× ${fmtNum(streakMult(streak))}).</p>` : ''}
		<button class="btn primary" id="quiz-go">Jouer</button>
		<button class="btn ghost wide" id="quiz-later">Plus tard</button>`);
	$('#quiz-go').onclick = () => runQuiz(qs, 0, { right: 0, gain: 0 });
	// « Plus tard » : on le reproposera dans une demi-heure.
	$('#quiz-later').onclick = () => { (state.quiz ??= {}).at = Date.now() - QUIZ_GAP + 30 * 60000; persist(); closeModal(); };
}

/** Une question du quiz ; puis la suivante, puis le bilan. */
function runQuiz(qs, i, score) {
	const q = qs[i];
	showModal(`<h2>Question ${i + 1} sur ${qs.length}</h2>
		<p class="quiz-q">${q.q}</p>
		<div class="quiz-choices">${q.choices.map((c, k) => `<button class="btn ghost wide quiz-c" data-k="${k}">${c}</button>`).join('')}</div>
		<p class="quiz-res" hidden></p>
		<button class="btn ghost wide" id="quiz-book">Feuilleter le livre des espèces</button>
		<button class="btn primary" id="quiz-next" hidden>${i + 1 < qs.length ? 'Question suivante' : 'Voir le bilan'}</button>`);
	const box = $('#modal');
	box.querySelectorAll('.quiz-c').forEach(b => b.onclick = () => {
		if (box.querySelector('.quiz-c.right, .quiz-c.wrong')) return;
		const ok = q.choices[Number(b.dataset.k)] === q.right, res = box.querySelector('.quiz-res');
		noteAnswer(state, q.sp, ok);
		box.querySelectorAll('.quiz-c').forEach(x => { if (q.choices[Number(x.dataset.k)] === q.right) x.classList.add('right'); });
		if (ok) {
			const m = streakMult(state.quizStreak ?? 0), gain = Math.round(quizBase() * m);
			state.quizStreak = (state.quizStreak ?? 0) + 1;
			state.nectar = (state.nectar ?? 0) + gain;
			score.right++; score.gain += gain;
			const r = b.getBoundingClientRect();
			rewardFly(gain, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
			sound.chime(2);
			res.innerHTML = `Bravo ! <b>+${fmtInt(gain)} nectar</b>${m > 1 ? ` · série × ${fmtNum(m)}` : ''}`;
		} else {
			b.classList.add('wrong');
			state.quizStreak = 0;
			res.innerHTML = `Raté : la bonne réponse est en vert. <a href="#" data-quiz-sp="${q.sp}">Relire la fiche</a>`;
		}
		res.hidden = false;
		box.querySelector('#quiz-next').hidden = false;
		renderHud(); persist(true);
	});
	// Feuilleter le livre : la question attend, et revient à la fermeture du livre.
	box.querySelector('#quiz-book').onclick = () => {
		box.hidden = true;
		species.open();
		const back = () => ($('#species').classList.contains('open') ? setTimeout(back, 300) : (box.hidden = false));
		setTimeout(back, 400);
	};
	box.querySelector('#quiz-next').onclick = () => (i + 1 < qs.length ? runQuiz(qs, i + 1, score) : endQuiz(qs, score));
	box.querySelector('.quiz-res').onclick = e => { const a = e.target.closest('[data-quiz-sp]'); if (a) { e.preventDefault(); closeModal(); species.open(a.dataset.quizSp); } };
}

/** Le bilan du quiz : le score, le gain, et un bonus pour un sans-faute. */
function endQuiz(qs, score) {
	const qz = (state.quiz ??= {});
	qz.n = (qz.n ?? 0) + 1;
	qz.at = Date.now();
	let bonus = 0;
	if (score.right === qs.length) { bonus = quizBase(); state.nectar = (state.nectar ?? 0) + bonus; score.gain += bonus; }
	persist(true); renderHud();
	showModal(`<h2>${score.right === qs.length ? 'Sans-faute !' : score.right ? 'Bien joué' : 'La prochaine fois'}</h2>
		<p>${score.right} bonne${score.right > 1 ? 's' : ''} réponse${score.right > 1 ? 's' : ''} sur ${qs.length} · <b>+${fmtInt(score.gain)} nectar</b>${bonus ? ` (dont ${fmtInt(bonus)} pour le sans-faute)` : ''}.</p>
		${state.quizStreak ? `<p class="item-tip">Série : ${state.quizStreak}. Elle continue au prochain quiz.</p>` : ''}
		<button class="btn primary" data-close>Voir mon jardin</button>`);
	if (bonus) rewardFly(bonus);
	sound.chime(3);
}

// De temps en temps : quand il n'y a plus rien à faire, le quiz se propose (trois par jour au plus, trois heures
// d'écart au moins).
setInterval(() => {
	if (!$('#modal').hidden || document.querySelector('.panel.open') || placing || document.hidden) return;
	if (quizReady(state, dayKey()) && nothingToDo()) whenFree(() => $('#modal').hidden && offerQuiz());
}, 60000);

/**
 * Lire une fiche rapporte de plus en plus : 10 nectar, plus 3 par espèce déjà découverte, plus six minutes de la
 * production du jardin (nouvelles parties). Les fiches gardent leur intérêt toute la partie.
 */
function readReward() {
	if (!state.eco2) return READ_REWARD;
	const found = Object.keys(state.species).length;
	return Math.max(10, Math.round((10 + 3 * found + prodPerHour(state) * 0.1) / 5) * 5);
}

/**
 * Toute récompense se voit : une volée de gouttes de nectar part de `from` (l'endroit gagné, ou le milieu de
 * l'écran) et rejoint la bourse, dont le compteur monte avec elles. Si une page est ouverte, la volée part à sa
 * fermeture, pour qu'on la voie arriver. Le nectar est déjà compté : ce n'est que le spectacle.
 */
function rewardFly(amount, from = null) {
	if (!(amount >= 1)) return;
	const go = () => {
		const app = $('#app'), box = app.getBoundingClientRect(), to = $('#hud-steps').getBoundingClientRect();
		if (!to.width) return;
		const tx = to.left - box.left + 22, ty = to.top - box.top + to.height / 2;
		const sx0 = from ? from.x - box.left : box.width / 2, sy0 = from ? from.y - box.top : box.height * 0.5;
		const n = Math.max(4, Math.min(14, Math.round(3 + Math.log10(amount) * 3))), gap = 70, fly = 850;
		countPurse(Math.max(0, (state.nectar ?? 0) - amount), fly * 0.8, (n - 1) * gap + 500);
		const coins = Array.from({ length: n }, (_, i) => {
			const el = document.createElement('i');
			el.className = 'intro-coin reward-coin';
			app.append(el);
			const sx = sx0 + (Math.random() - 0.5) * 60, sy = sy0 + (Math.random() - 0.5) * 30;
			return { el, sx, sy, cx: (sx + tx) / 2 + (Math.random() - 0.5) * 120, cy: Math.min(sy, ty) - 50 - Math.random() * 70, t0: i * gap, trail: 0, done: false };
		});
		const start = performance.now();
		const frame = () => {
			const now = performance.now() - start;
			let alive = false;
			for (const k of coins) {
				const t = (now - k.t0) / fly;
				if (t < 0) { k.el.style.opacity = '0'; alive = true; continue; }
				if (t >= 1) {
					if (!k.done) { k.done = true; k.el.remove(); sound.drip?.(Math.min(1, coins.indexOf(k) / coins.length)); }
					continue;
				}
				alive = true;
				const e = t * t * (3 - 2 * t), u = 1 - e;
				const x = u * u * k.sx + 2 * u * e * k.cx + e * e * tx, y = u * u * k.sy + 2 * u * e * k.cy + e * e * ty;
				k.el.style.opacity = '1';
				k.el.style.left = `${x}px`;
				k.el.style.top = `${y}px`;
				k.el.style.transform = `scale(${1 - 0.4 * e})`;
				if (now - k.trail > 45) {
					k.trail = now;
					const dot = document.createElement('i');
					dot.className = 'intro-trail reward-coin';
					dot.style.left = `${x}px`;
					dot.style.top = `${y}px`;
					app.append(dot);
					setTimeout(() => dot.remove(), 500);
				}
			}
			if (alive) requestAnimationFrame(frame);
			else { const p = $('#hud-steps'); p.classList.remove('got'); void p.offsetWidth; p.classList.add('got'); }
		};
		requestAnimationFrame(frame);
	};
	// On attend que la page qui couvre la bourse (fiche, espèces, aménager…) soit fermée, pour voir la volée.
	const wait = () => (document.querySelector('.panel.open, #species.open, #deco.open, #journal.open, #options.open, #eco.open') ? setTimeout(wait, 400) : go());
	wait();
}

function jackpot(v, x, y) {
	if (v < 1) return;
	const big = v >= 40;
	const dur = big ? Math.min(3000, 900 + Math.log10(v) * 600) : 600;
	const drops = big ? Math.min(36, 8 + Math.round(v / 15)) : 3;
	purseAnim = { from: (purseAnim ? shownNectar() : (state.nectar ?? 0) - v), to: state.nectar ?? 0, t0: performance.now() + 500, dur, drops, got: 0 };
	garden.pourFrom({ x, y }, drops, dur / 1000, y);
	garden.floatText(x, y - 20, `+${fmtInt(v)}`);
	if (big) $('#hud-steps').classList.add('jackpot');
	const step = () => {
		const el = $('#hud-steps .nectar');
		if (el) el.textContent = fmtInt(shownNectar());
		if (purseAnim && performance.now() < purseAnim.t0 + purseAnim.dur) return requestAnimationFrame(step);
		purseAnim = null;
		$('#hud-steps').classList.remove('jackpot');
		if (big) { sound.chime(3); garden.burst(x, y - 30, 30, '#F4C23E'); }
		renderHud();
	};
	requestAnimationFrame(step);
}

/** Faire passer de la récolte en attente au compteur : celle du sol (`ground`) ou celle des collecteurs. */
function collect(amount, ground = false, taken = false) {
	const v = taken ? amount : Math.max(0, Math.min(ground ? groundOf(state) : jarOf(state), amount));
	if (v <= 0) return 0;
	if (!taken) state.pending -= v;
	if (ground) state.ground -= v;
	state.nectar = (state.nectar ?? 0) + v;
	state.collectedOnce = true;
	sound.chime(1);
	renderHud();
	renderStatus();
	persist();
	return v;
}

/** Le fermier ou la fermière de la cabane, au choix ; `the` : « Le fermier » plutôt que « un fermier ». */
function farmerName(the = false) {
	const f = state.gardener === 'fermiere';
	return the ? (f ? 'La fermière' : 'Le fermier') : f ? 'une fermière' : 'un fermier';
}

const PETS = { chien: 'Un chien', chat: 'Un chat' };

/** Le compagnon du fermier : un chien qui le suit partout, un chat qui fait la sieste, ou personne. */
function choosePet(then) {
	showModal(`<h2>Et un compagnon ?</h2><p>Un chien qui suit ${farmerName(true).toLowerCase()} partout, ou un chat qui flâne et fait la sieste au soleil.</p>
		<div class="pet-pick"><div class="farmer-pick"><button class="btn ghost" data-pet="chien">Un chien</button><button class="btn ghost" data-pet="chat">Un chat</button></div>
		<button class="btn ghost wide" data-pet="">Personne pour l’instant</button></div>`);
	$('#modal').querySelector('.pet-pick').addEventListener('click', e => {
		const b = e.target.closest('[data-pet]');
		if (!b) return;
		state.pet = b.dataset.pet || null;
		persist(true);
		$('#modal').hidden = true;
		then?.();
	});
}

/** Qui s'installe dans la cabane : on choisit à la première cabane, et on peut changer d'avis depuis la cabane. */
function chooseFarmer(then) {
	showModal(`<h2>Qui s’installe ?</h2><p>Quelqu’un vient vivre dans ta cabane et cultivera ton potager.</p>
		<div class="farmer-pick"><button class="btn ghost" data-farmer="fermier">Un fermier</button><button class="btn ghost" data-farmer="fermiere">Une fermière</button></div>`);
	$('#modal').querySelector('.farmer-pick').addEventListener('click', e => {
		const b = e.target.closest('[data-farmer]');
		if (!b) return;
		state.gardener = b.dataset.farmer;
		persist(true);
		$('#modal').hidden = true;
		then?.();
	});
}

// ─── Le panier du fermier, et le troc ─────────────────────────
// Ce que produit la ferme (œufs, légumes, fruits, miel) va dans le panier, rangé à la cabane. On le troque
// ensuite contre du nectar, quand on veut : de quoi s'offrir un compost, des poules, une parcelle de plus…

// Le prix de chaque produit au troc, en nectar (par œuf, par légume, par kilo de fruits, par pot de miel).
const GOODS = {
	oeufs: { one: 'œuf', many: 'œufs', price: 15, icon: '🥚' },
	legumes: { one: 'légume', many: 'légumes', price: 15, icon: '🥬' },
	pommes: { one: 'kg de pommes', many: 'kg de pommes', price: 20, icon: '🍎' },
	poires: { one: 'kg de poires', many: 'kg de poires', price: 22, icon: '🍐' },
	cerises: { one: 'kg de cerises', many: 'kg de cerises', price: 30, icon: '🍒' },
	prunes: { one: 'kg de prunes', many: 'kg de prunes', price: 22, icon: '🫐' },
	miel: { one: 'pot de miel', many: 'pots de miel', price: 60, icon: '🍯' },
};
const EGG_NECTAR = GOODS.oeufs.price;
const FRUIT_OF = { pommier: 'pommes', poirier: 'poires', merisier: 'cerises', prunier: 'prunes' };
const basket = () => (state.stock ??= {});
const basketCount = () => Object.values(basket()).reduce((a, n) => a + n, 0);
const goodLabel = (k, n) => `${fmtInt(n)} ${n > 1 ? GOODS[k].many : GOODS[k].one}`;

/** Range des produits dans le panier, avec un message qui ouvre le troc. */
function addGood(k, n, by) {
	if (n <= 0) return;
	basket()[k] = (basket()[k] ?? 0) + n;
	persist();
	toast(`${by} : ${GOODS[k].icon} ${goodLabel(k, n)} dans le panier · touche pour troquer`, '#5F933E', openMarket);
}

/** Le troc : le panier, le prix de chaque produit, et ce qu'il rapporte en nectar. */
function openMarket() {
	const goods = Object.entries(basket()).filter(([k, n]) => n > 0 && GOODS[k]);
	const total = goods.reduce((a, [k, n]) => a + n * GOODS[k].price, 0);
	showModal(`<div class="modal-body"><h2>Le panier de la ferme</h2>
		${goods.length ? `<p>Troque ce que ta ferme a produit contre du nectar, pour t'offrir de nouveaux aménagements.</p>
		<ul class="harvest-rows">${goods.map(([k, n]) => `<li><span>${GOODS[k].icon} <b>${goodLabel(k, n)}</b> · ${GOODS[k].price} nectar ${GOODS[k].one.startsWith('kg') ? 'le kg' : 'pièce'}</span>
			<button class="btn ghost small" data-sell="${k}">Troquer · ${fmtInt(n * GOODS[k].price)}</button></li>`).join('')}</ul>`
		: `<p>Le panier est vide. ${farmerName(true)} y range les œufs des poules, les légumes du potager, les fruits du verger et le miel des ruches.</p>`}</div>
		<div class="modal-foot">${goods.length ? `<button class="btn primary" data-sell="all">Tout troquer · ${fmtInt(total)} nectar</button>` : ''}<button class="btn ghost" data-close>Fermer</button></div>`);
	for (const b of $('#modal').querySelectorAll('[data-sell]')) b.addEventListener('click', () => {
		const keys = b.dataset.sell === 'all' ? goods.map(([k]) => k) : [b.dataset.sell];
		let gain = 0;
		for (const k of keys) { gain += (basket()[k] ?? 0) * GOODS[k].price; basket()[k] = 0; }
		state.nectar = (state.nectar ?? 0) + gain;
		persist(true);
		renderHud();
		sound.chime(2);
		toast(`Troc : +${fmtInt(gain)} nectar`, '#E3A33A');
		openMarket();
	});
}

// Le jardinier ramasse les œufs du poulailler : ils vont dans le panier.
garden.onEggs = (coop, n) => {
	addGood('oeufs', n, farmerName(true));
	garden.say(n === 1 ? 'Un œuf de plus !' : `${['', '', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six'][n] ?? n} œufs de plus !`);
};

// Le jardinier récolte une parcelle mûre du potager : des légumes (plus, si on y a épandu du compost).
garden.onHarvest = () => {
	const boosted = (state.compostBoost ?? 0) > 0;
	if (boosted) state.compostBoost--;
	addGood('legumes', boosted ? 6 : 4, farmerName(true));
	garden.say(boosted ? 'Le compost a fait des merveilles !' : ['Belle récolte !', 'Des légumes pour ce soir !', 'Le panier est plein !'][Math.floor(Math.random() * 3)]);
};

// Il cueille aussi les fruits mûrs des arbres fruitiers (une fois toutes les quelques heures par arbre) ;
// un arbre soigné en donne davantage.
const PICK_EVERY = 4 * 3600000;
garden.onPick = tree => {
	const fruit = FRUIT_OF[speciesOf(tree)];
	if (!fruit || Date.now() - (tree.pickedAt ?? 0) < PICK_EVERY) return;
	tree.pickedAt = Date.now();
	const kg = 2 + 2 * (tree.care ?? 0);
	addGood(fruit, kg, farmerName(true));
	garden.say(`${kg} kg de ${fruit} !`);
};

// Les ruches : la colonie produit du miel ; le fermier en prend une part (réglable), le reste nourrit les abeilles.
// Une ruche accueille 6 abeilles au plus ; il en vient autant que les fleurs en attirent (une, plus une par trois
// fleurs écloses). Chaque abeille fait du miel ; il faut du temps (et des fleurs) pour en remplir un pot.
// Une ruche neuve n'accueille que 3 abeilles : on l'agrandit (3 de plus par niveau, de plus en plus cher) ou l'on en
// pose une autre (chaque ruche coûte plus que la précédente).
const HIVE_SEATS = 3, HONEY_PER_BEE = 0.05; // pots par heure et par abeille si l'on prenait tout (pendant l'élan)
// Les abeilles travaillent surtout dans l'élan d'une sortie : au repos, la ruche ne fait presque rien (5 %).
const HONEY_REST = 0.05;
const hiveCap = () => garden.items.filter(it => it.kind === 'ruche').reduce((n, it) => n + HIVE_SEATS * (it.level ?? 1), 0);
const hiveBees = () => {
	const flowers = here().plants.filter(p => p.type === 'fleur' && p.growth >= 1).length;
	return Math.min(hiveCap(), hiveCap() ? 1 + Math.floor(flowers / 3) : 0);
};
setInterval(() => {
	const bees = hiveBees();
	if (state.eco2 || !bees || (garden.season?.winter ?? 0) > 0.6) return;
	const pace = !state.eco2 || boostLeft(state) > 0 ? 1 : HONEY_REST;
	state.honeyAcc = (state.honeyAcc ?? 0) + bees * HONEY_PER_BEE * pace * (state.honeyShare ?? 0.3) / 60;
	if (state.honeyAcc >= 1) {
		const n = Math.floor(state.honeyAcc);
		state.honeyAcc -= n;
		addGood('miel', n, 'Les ruches');
	}
}, 60000);

// Nouvelle économie : les habitats produisent, à plein pendant l'élan d'une sortie, à 5 % au repos ; la part des
// ruches devient du miel (un pot pour 60 nectar), le reste va dans la bourse.
function runHabitats() {
	if (!state.eco2 || state.intro) { state.prodAt = Date.now(); return; }
	updateNear();
	const got = produce(state);
	const honey = got.honey * (state.honeyShare ?? 0.3) / 0.3;
	state.honeyAcc = (state.honeyAcc ?? 0) + honey / 60;
	state.nectar = (state.nectar ?? 0) + Math.max(0, got.nectar - got.honey);
	if (state.honeyAcc >= 1) {
		const n = Math.floor(state.honeyAcc);
		state.honeyAcc -= n;
		addGood('miel', n, 'Les ruches');
	}
	renderHud();
}
// Appli cachée, la jauge ne tourne pas : la production est alors comptée toutes les minutes (et au retour).
setInterval(() => { if (document.hidden || !gaugeOn()) runHabitats(); }, 60000);

/**
 * La jauge de récolte : l'hexagone de la bourse se remplit au rythme de la production du jardin ; plein, le nectar
 * tombe dans la bourse (« +N ») et il recommence. Un plein vaut dix secondes de production à plein : pendant l'élan,
 * il se remplit toutes les dix secondes ; au repos (5 %), en un peu plus de trois minutes. Son rythme dit tout de
 * suite si le jardin récolte vite.
 */
const GAUGE_FULL_S = 10;
let gaugeAcc = 0, gaugeRate = 0, gaugeAt = 0, gaugeLast = performance.now();
const gaugeOn = () => state.eco2 && !state.intro;
function gaugeTick() {
	const now = performance.now(), dt = Math.min(1, (now - gaugeLast) / 1000);
	gaugeLast = now;
	const purse = $('#hud-steps');
	if (!purse || !gaugeOn() || document.hidden) return;
	// La production à plein, remesurée toutes les cinq secondes (elle ne change qu'avec les achats et les plantes).
	if (now - gaugeAt > 5000) { gaugeAt = now; gaugeRate = prodPerHour(state); }
	if (gaugeRate <= 0) { purse.style.setProperty('--fill', '0%'); return; }
	const packet = gaugeRate * GAUGE_FULL_S / 3600, rate = gaugeRate * (boostLeft(state) > 0 ? 1 : REST) / 3600;
	gaugeAcc += rate * dt;
	if (gaugeAcc >= packet) {
		gaugeAcc = 0;
		const before = state.nectar ?? 0;
		runHabitats();
		const got = (state.nectar ?? 0) - before;
		if (got >= 1) gaugePop(got);
	}
	purse.style.setProperty('--fill', `${Math.round(Math.min(1, gaugeAcc / packet) * 100)}%`);
}
setInterval(gaugeTick, 200);

/**
 * La jauge de marche : pendant une sortie, le cercle de l'icône d'activité se remplit avec le nectar que rapportent
 * les pas (environ tous les 100 m en marchant, plus vite en courant : l'effort rapporte plus) ; plein, il verse
 * dans la bourse (« +N ») et recommence. Son rythme montre ce que la sortie récolte.
 */
let walkAcc = 0;
const walkPacket = () => Math.max(1, 0.1 * (ECO2_WALK * nectarPerEffort() * 125 + KM_HOURS * prodPerHour(state)));
const walkFill = () => Math.min(1, walkAcc / walkPacket());
function walkGauge(gain) {
	if (!session || !state.eco2 || state.intro || !(gain > 0)) return;
	walkAcc += gain;
	const packet = walkPacket();
	if (walkAcc >= packet) {
		const n = walkAcc;
		walkAcc = 0;
		gaugePop(n);
		const a = $('#hud-act');
		a.classList.remove('lap'); void a.offsetWidth; a.classList.add('lap');
	}
}

/** Le nectar récolté qui tombe dans la bourse : « +N » qui monte et s'efface, et une goutte. */
function gaugePop(n) {
	const purse = $('#hud-steps'), el = document.createElement('span');
	el.className = 'purse-pop';
	el.textContent = `+${fmtInt(n)}`;
	purse.append(el);
	setTimeout(() => el.remove(), 1300);
	purse.classList.remove('got'); void purse.offsetWidth; purse.classList.add('got');
	sound.drip?.(Math.min(1, Math.log10(1 + n) / 6));
}

// Le compost : il se remplit en marchant (épluchures, feuilles mortes) ; plein, on l'épand sur le potager.
const COMPOST_KM = 3;
const compostFill = it => Math.max(0, Math.min(1, (state.totals.distance / 1000 - (it.km0 ?? 0)) / COMPOST_KM));

const eco = new EcoPanel($('#eco'), state, kind => {
	const it = ITEMS[kind];
	if (state.totals.distance / 1000 >= it.km && !needsFirst(kind) && !natureLock(kind) && (state.nectar ?? 0) >= priceOf(kind)) startPlacing(kind);
	else openDeco(it.cat);
});

// ─── Bandeau ──────────────────────────────────────────────────

/**
 * L'objectif du jour atteint rapporte une récompense en nectar (les « jetons » du jeu), une fois par jour : on la
 * cumule pour s'offrir la cabane, un aménagement, un agrandissement… à chacun de choisir.
 */
const goalReward = () => Math.round(Math.max(1, state.goalKm ?? 2) * 60 / 10) * 10;
function checkDailyGoal() {
	if (!state.goalKm || state.goalPaid === dayKey() || todayMeters(state) < state.goalKm * 1000) return;
	state.goalPaid = dayKey();
	const gain = goalReward();
	state.nectar = (state.nectar ?? 0) + gain;
	rewardFly(gain);
	persist(true);
	sound.chime(3);
	toast(`Objectif du jour atteint : +${fmtInt(gain)} nectar à dépenser comme tu veux`, '#E3A33A', () => openDeco());
}

function renderHud() {
	checkDailyGoal();
	revealUi();
	const km = todayMeters(state) / 1000;
	$('#hud-day').textContent = cellName(here(), garden.active);
	// En toutes lettres : ce qu'on a fait aujourd'hui, puis l'objectif du jour (ou qu'il est atteint).
	const goal = fmt(state.goalKm, state.goalKm % 1 ? 1 : 0);
	$('#hud-km').textContent = km >= state.goalKm
		? `${fmt(km, km < 10 ? 1 : 0)} km aujourd'hui ✓`
		: `${fmt(km, 1)} km sur ${goal} aujourd'hui`;
	// La bourse de nectar, bien en vue ; dessous, ce qui attend d'être récolté (dans les fleurs ou le collecteur).
	// Plein : le collecteur ne prend plus rien, ou sans collecteur, les fleurs sont chargées.
	const pend = state.intro ? 0 : Math.floor(state.pending ?? 0), full = !state.intro && (hasCollector(state) ? jarOf(state) >= jarCap(state) : groundOf(state) >= 30);
	$('#hud-steps').innerHTML = `<span class="nectar${boostLeft(state) ? ' boost' : ''}">${fmtInt(shownNectar())}</span>`
		+ `<small class="${full ? 'full' : pend >= 1 ? 'wait' : ''}">${pend >= 1 ? `+${fmtInt(pend)} à récolter` : 'nectar'}</small>`;
	// Pendant une sortie, le cercle est la jauge de marche : il se remplit avec le nectar que rapportent les pas, verse
	// et recommence (voir walkGauge). Au repos, c'est l'objectif du jour.
	if (session && state.eco2 && !state.intro) {
		$('#ring-fg').style.strokeDashoffset = String(113.1 * (1 - walkFill()));
		$('#ring-fg2').style.strokeDashoffset = '113.1';
		$('#act-laps').hidden = true;
		return;
	}
	// Le cercle : l'objectif du jour ; une fois atteint, un tour doré se remplit, puis un autre, autant qu'on marche
	// (chaque tour vaut l'objectif du jour). Le nombre de tours s'affiche (× 2, × 3…), et la jauge ne s'arrête jamais.
	const r = km / state.goalKm, laps = Math.floor(r);
	$('#ring-fg').style.strokeDashoffset = String(113.1 * (1 - Math.min(1, r)));
	$('#ring-fg2').style.strokeDashoffset = String(113.1 * (1 - (r >= 1 ? r - laps : 0)));
	$('#hud-act').classList.toggle('goal-done', r >= 1);
	const lapEl = $('#act-laps');
	if (lapEl) {
		lapEl.hidden = laps < 1;
		if (lapEl.textContent !== `×${laps}` && laps >= 1) {
			lapEl.textContent = `×${laps}`;
			// Un tour de plus : le cercle brille un instant.
			if (renderHud.laps != null && laps > renderHud.laps) { $('#hud-act').classList.remove('lap'); void lapEl.offsetWidth; $('#hud-act').classList.add('lap'); sound.chime?.(2); }
		}
		renderHud.laps = laps;
	}
}

// ─── Messages ─────────────────────────────────────────────────

// Messages that arrive together (end of a walk: summary, nectar, discoveries) are merged into one, and a
// message stays long enough to be read while walking: its time grows with its length.
const TOAST_MERGE_MS = 1500, TOAST_MERGE_MAX = 3;
let lastToast = null;
// Le temps de lire : environ 15 lettres par seconde, plus deux secondes pour le voir arriver.
const toastTime = (text, link) => Math.max(link ? 6000 : 4500, Math.min(14000, 2000 + text.length * 70));
function hideToastLater(el) {
	clearTimeout(el._timer);
	el._timer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, toastTime(el._text, el._link));
}
function toast(text, color = '#F4C23E', onClick = null) {
	const prev = lastToast;
	if (!onClick && prev && !prev._link && prev.isConnected && !prev.classList.contains('out')
		&& Date.now() - prev._at < TOAST_MERGE_MS && prev._parts < TOAST_MERGE_MAX) {
		prev._text += ` · ${text}`;
		prev._parts += 1;
		prev._at = Date.now();
		prev.querySelector('span').textContent = prev._text;
		hideToastLater(prev);
		return;
	}
	const el = document.createElement('div');
	el.className = 'toast';
	el.innerHTML = `<i style="background:${color}"></i><span></span>`;
	el.querySelector('span').textContent = text;
	el._text = text; el._parts = 1; el._at = Date.now(); el._link = !!onClick;
	if (onClick) { el.classList.add('link'); el.addEventListener('click', onClick); }
	const box = $('#toasts');
	box.appendChild(el);
	while (box.children.length > 2) box.firstChild.remove();
	lastToast = el;
	hideToastLater(el);
}

/** Lance `fn` dès qu'aucune page (écosystème, espèces, carnet…) n'est ouverte par-dessus le jardin. */
function whenFree(fn) {
	if (!document.querySelector('.panel.open') && $('#coach').hidden && !placing && !$('#app').classList.contains('booting')) return fn();
	setTimeout(() => whenFree(fn), 1000);
}

function showModal(html) {
	// Toujours une croix pour fermer, et le contenu défile si la fenêtre est plus haute que l'écran.
	$('#modal-card').innerHTML = `<button class="modal-x" data-close aria-label="Fermer">×</button>${html}`;
	$('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; }

// ─── Espèces et parcelles ─────────────────────────────────────

function updateSpeciesDot() {
	$('#species-dot').hidden = !Object.keys(state.species).some(id => !state.speciesSeen?.[id]);
}

/** Annonce les espèces et les parcelles qui viennent de s'ouvrir. `quiet` : au tout premier lancement, sans bruit. */
// Entre deux découvertes, au moins ce délai : le temps de voir arriver la bête et d'ouvrir sa fiche.
const SPECIES_GAP = 30000;
// Les découvertes au compte-gouttes : quelques-unes les premiers jours pour lancer le jardin, puis une ou deux par
// jour, pour avoir le temps de lire chaque fiche et d'attendre la suivante.
const SPECIES_PER_DAY = [6, 4, 3];
const SPECIES_LATER = 2;
const gardenDay = () => Math.floor((Date.now() - (state.createdAt ?? Date.now())) / 86400000);
const speciesQuota = () => SPECIES_PER_DAY[gardenDay()] ?? SPECIES_LATER;
/** Les découvertes du jour (le compteur repart chaque matin). */
const speciesToday = () => (state.speciesDay?.day === dayKey() ? state.speciesDay.n : 0);

function announceSpecies(quiet = false) {
	if (state.intro) return;
	let found = [];
	if (quiet) {
		// Premier lancement : le jardin de départ arrive d'un coup, sans compter dans les fiches à lire.
		found = checkSpecies(state);
		for (const sp of found) (state.speciesStart ??= {})[sp.id] = true;
	} else if (speciesToday() >= speciesQuota()) {
		// Le compte du jour est atteint : on le dit une fois, si d'autres espèces attendent déjà.
		if (state.speciesDoneNote !== dayKey() && speciesWaiting(state)) {
			state.speciesDoneNote = dayKey();
			persist();
			toast('C’est tout pour aujourd’hui : d’autres espèces viendront demain dans ton jardin', '#9A7448');
		}
	} else if (unreadSpecies(state).length < UNREAD_MAX) {
		if (Date.now() >= (state.nextSpeciesAt ?? 0)) {
			found = checkSpecies(state, 1);
			if (found.length) {
				// Le premier jour, elles se suivent de près ; ensuite, au moins une heure entre deux.
				state.nextSpeciesAt = Date.now() + (gardenDay() === 0 ? SPECIES_GAP : 3600000);
				state.speciesDay = { day: dayKey(), n: speciesToday() + 1 };
			}
		}
	} else if (Date.now() - (state.readNudgeAt ?? 0) > 15 * 60000 && speciesWaiting(state)) {
		// Trop de fiches en attente : on le dit (tous les quarts d'heure au plus), et le message ouvre la première.
		state.readNudgeAt = Date.now();
		const first = unreadSpecies(state)[0];
		toast(`De nouvelles espèces attendent : lis d’abord tes fiches marquées Nouveau (+${fmtInt(readReward())} nectar chacune)`, '#F08A3C', () => species.open(first));
	}
	const opened = PLACES.filter(p => !state.placesOpen[p.id] && placeOpen(state, p));
	for (const p of opened) state.placesOpen[p.id] = Date.now();
	if (!found.length && !opened.length) return;
	persist();
	updateSpeciesDot();
	if (quiet) return;
	if (found.length || opened.length) sound.chime(opened.length ? 3 : 2);
	for (const sp of found) revealSpecies(sp);
	for (const p of opened) toast(`Nouveau milieu : ${p.name.toLowerCase()} ! Ses parcelles autour de ton jardin peuvent s’acheter`, p.color, () => garden.toggleOverview());
	celebrateHerbarium();
}

/** Un herbier complet : toutes les espèces d'un lieu trouvées. Une fête, et une récompense, une fois par lieu. */
/** Un palier de l'album de la saison atteint : une récompense, et on le dit. */
function checkSeason() {
	if (!state.eco2 || state.intro) return;
	for (const r of seasonRewards(state)) {
		state.nectar = (state.nectar ?? 0) + r.reward;
		rewardFly(r.reward);
		sound.chime(3);
		toast(`Album ${r.season.name} : ${r.n} découvertes · +${fmtInt(r.reward)} nectar`, '#F08A3C', () => openJournal());
		renderHud(); persist(true);
	}
}
setInterval(checkSeason, 20000);

// ─── Les révélations : une nouvelle parcelle, une nouvelle espèce (l'effet « waouh ») ───
/**
 * Un grand titre surgit au milieu de l'écran sur des rayons de lumière (la photo de l'espèce en médaillon), une gerbe
 * d'étincelles part de l'endroit découvert, une petite fanfare sonne. Une révélation à la fois ; elles attendent
 * qu'aucune page ne soit ouverte, pour qu'on ne les manque jamais. Toucher la révélation ouvre la fiche.
 */
const revealQueue = [];
let revealing = false;
function reveal(r) {
	revealQueue.push(r);
	if (!revealing) nextReveal();
}
function nextReveal() {
	const r = revealQueue.shift();
	if (!r) { revealing = false; return; }
	revealing = true;
	const show = () => {
		if (document.querySelector('.panel.open') || !$('#modal').hidden || placing || state.intro || $('#app').classList.contains('booting')) return setTimeout(show, 600);
		const el = document.createElement('div');
		el.className = `reveal${r.big ? ' reveal-big' : ''}`;
		el.style.setProperty('--rc', r.color ?? '#F4C23E');
		el.innerHTML = `<div class="reveal-rays"></div><div class="reveal-card">${r.img ? `<img src="${r.img}" alt="" onerror="this.remove()">` : ''}<small>${r.sub}</small><b>${r.title}</b>${r.open ? '<span>Touche pour voir sa fiche</span>' : ''}</div>`;
		$('#app').append(el);
		if (r.open) el.onclick = () => { el.remove(); r.open(); };
		// Dans le jardin : une gerbe d'étincelles, en plusieurs vagues.
		if (r.at) for (let k = 0; k < 4; k++) setTimeout(() => { garden.burst(r.at[0], r.at[1] - 20, r.big ? 40 : 18, k % 2 ? '#FFFFFF' : r.color ?? '#F4C23E'); }, k * 220);
		if (r.big) sound.fanfare?.(); else sound.chime(3);
		navigator.vibrate?.(r.big ? [30, 60, 30] : 20);
		setTimeout(() => el.classList.add('out'), r.big ? 3200 : 2600);
		setTimeout(() => { el.remove(); nextReveal(); }, r.big ? 3700 : 3100);
	};
	show();
}
/** Une nouvelle espèce : sa photo, son nom, ce qu'elle est ; et des étincelles là où elle vit. */
function revealSpecies(sp, why = '') {
	const kind = sp.kind === 'milieu' ? 'Nouveau milieu' : sp.kind === 'animal' ? 'Nouvel animal' : { arbre: 'Nouvel arbre', buisson: 'Nouvel arbuste', fleur: 'Nouvelle fleur', herbe: 'Nouvelle herbe' }[sp.type] ?? 'Nouvelle espèce';
	const p = here().plants.find(x => speciesOf(x) === sp.id && x.growth >= 1), b = garden.insects.find(x => x.sp === sp.id && !x.gone);
	const at = p ? (([ox, oy]) => [ox + p.x, oy + p.y])(garden.cellOriginOf(p)) : b ? [b.x, b.y] : null;
	reveal({ title: sp.name, sub: why ? `${kind} · ${why}` : kind, color: PLACE_BY_ID[sp.place]?.color ?? '#F08A3C', img: sp.kind === 'milieu' ? null : `species/${sp.id}.webp`, at, open: () => species.open(sp.id) });
}

function celebrateHerbarium() {
	for (const p of newlyComplete(state)) {
		state.complete[p.id] = Date.now();
		state.nectar = (state.nectar ?? 0) + HERBARIUM_REWARD;
		rewardFly(HERBARIUM_REWARD);
		persist(true);
		renderHud();
		sound.chime(3);
		whenFree(() => showModal(`<h2>Herbier complet !</h2>
			<p>Tu as trouvé les ${herbarium(state, p.id).total} espèces ${PLACE_DE[p.id]} : elles vivent toutes dans ton jardin. Ton écosystème t'offre ${HERBARIUM_REWARD} nectar.</p>
			<button class="btn primary" data-close>Merci !</button>`));
	}
}
setInterval(announceSpecies, 4000);

/** Va voir un milieu dans le jardin : la caméra file vers sa parcelle cœur. */
function showBiome(id) {
	const ci = heartOf(here(), id);
	if (ci >= 0) garden.flyToCell(ci);
}

// ─── Vue de loin : la carte et ses filtres ────────────────────

const MAP_FILTERS = [['new', '✨', 'Nouveautés'], ['harvest', '🍯', 'Récoltes'], ['grow', '🌳', 'Croissance'], ['next', '📍', 'À venir']];
const mapFilter = () => (state.mapFilter ??= { new: true, harvest: true, grow: false, next: false });

/** Les pastilles de chaque filtre (les récoltes viennent du jardin). */
function mapPills() {
	const pl = here(), fresh = SPECIES.filter(s => state.species[s.id] && !state.speciesSeen?.[s.id]);
	const specimen = {};
	if (fresh.length) for (const p of pl.plants) {
		if (p.growth < 1) continue;
		specimen[speciesOf(p)] ??= p;
	}
	const at = p => { const [ox, oy] = garden.cellOriginOf(p); return { x: ox + p.x, y: oy + p.y - 30 }; };
	const pills = { new: [], grow: [], next: [] };
	// Les espèces dont la fiche n'est pas encore lue : sur place si on la voit, sinon sur le cœur de son milieu.
	for (const s of fresh) {
		const p = specimen[s.id], b = p ? null : garden.insects.find(i => i.sp === s.id && !i.leaving && !i.hidden);
		let pos = p ? at(p) : b ? { x: b.x, y: b.y - 20 } : null;
		if (!pos) {
			const ci = heartOf(pl, s.place);
			if (ci < 0) continue;
			const [cx, cy] = garden.cellCenter(ci), h = [...s.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
			// Au-dessus du nom de la parcelle, pour ne pas le cacher.
			pos = { x: cx + (h % 240) - 120, y: cy - 90 - ((h >> 8) % 80) };
		}
		pills.new.push({ ...pos, icon: '✨', label: s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name, rank: 4, msg: `${s.name} : lis sa fiche, +${fmtInt(readReward())} nectar`, open: () => species.open(s.id) });
	}
	for (const p of pl.plants) {
		if (p.growth >= 1 || (p.type !== 'arbre' && p.type !== 'buisson')) continue;
		const pct = Math.floor(p.growth * 100);
		pills.grow.push({ ...at(p), icon: p.type === 'arbre' ? '🌳' : '🌿', label: `${pct} %`, rank: 1, msg: `${plantName(p)} : ${pct} %` });
	}
	// Le prochain décor de chaque milieu (la prochaine parcelle a déjà son étiquette).
	const nextDecor = {};
	for (const [key, d] of Object.entries(DECOR)) {
		if (d.always || pl.unlocked[key] || heartOf(pl, d.place) < 0) continue;
		if (!nextDecor[d.place] || d.km < DECOR[nextDecor[d.place]].km) nextDecor[d.place] = key;
	}
	for (const key of Object.values(nextDecor)) {
		const d = DECOR[key], left = fmt(Math.max(0.1, d.km - biomeKm(pl, d.place)), 1);
		pills.next.push({ ...garden.decorPos(key), icon: '📍', label: `${left} km`, rank: 0, stay: true, msg: `${d.name} : encore ${left} km dans ce milieu` });
	}
	return pills;
}

garden.mapExtras = () => {
	const f = mapFilter(), pills = mapPills();
	return Object.keys(pills).flatMap(k => (f[k] ? pills[k] : []));
};

function renderMapFilters() {
	const f = mapFilter(), pills = mapPills();
	const count = k => (k === 'harvest' ? garden.poiHarvest().length : pills[k].length);
	$('#map-filters').innerHTML = MAP_FILTERS.map(([k, icon, name]) => `<button class="map-chip${f[k] ? ' on' : ''}" data-filter="${k}" aria-pressed="${!!f[k]}">${icon} ${name}<b>${count(k)}</b></button>`).join('');
}
garden.onMapView = on => {
	$('#map-filters').hidden = !on;
	if (on) renderMapFilters();
};
$('#map-filters').addEventListener('click', e => {
	const b = e.target.closest('[data-filter]');
	if (!b) return;
	const f = mapFilter();
	f[b.dataset.filter] = !f[b.dataset.filter];
	renderMapFilters();
	persist();
});
setInterval(() => { if (!document.hidden && garden.mapView) renderMapFilters(); }, 2000);

// ─── Toucher : plante, animal, parcelle ───────────────────────

let cardTimer = 0;
function placeCard(card, hit, ms = 4500) {
	// La bulle se pose au-dessus du doigt, mais reste toujours entière à l'écran : décalée sur le côté près d'un bord,
	// et sous le doigt s'il n'y a pas la place au-dessus (sous le bandeau du haut).
	const app = $('#app'), H = app.clientHeight, pad = 10;
	// En paysage, le panneau est une colonne à droite : la bulle reste à sa gauche.
	const W = app.clientWidth - (garden.insetRight ?? 0);
	card.classList.remove('below');
	card.style.maxHeight = '';
	// Mesurée au milieu de l'écran : collée à un bord, elle se rétrécirait pour tenir.
	card.style.left = `${W / 2}px`;
	card.style.top = `${hit.y - 20}px`;
	card.hidden = false;
	const w = card.offsetWidth;
	let h = card.offsetHeight;
	card.style.left = `${Math.max(pad + w / 2, Math.min(W - pad - w / 2, hit.x))}px`;
	// Entre le bandeau du haut et le panneau du bas : jamais cachée derrière l'un ou l'autre.
	const ay = app.getBoundingClientRect().top, sheet = $('#home');
	const top = $('#hud').getBoundingClientRect().bottom - ay + 8;
	const bottom = (sheet && sheet.offsetParent && !garden.insetRight ? sheet.getBoundingClientRect().top - ay : H) - pad;
	// Plus haute que la place disponible (paysage) : elle défile.
	if (h > bottom - top) { card.style.maxHeight = `${bottom - top}px`; h = bottom - top; }
	if (hit.y - 20 - 14 - h < top) {
		card.classList.add('below');
		card.style.top = `${Math.max(top, Math.min(bottom - h, hit.y + 24))}px`;
	} else if (hit.y - 20 - 14 > bottom) card.style.top = `${bottom + 14}px`;
	cardTimer = setTimeout(() => { card.hidden = true; }, ms);
}

garden.onTap = hit => {
	const card = $('#plant-card');
	clearTimeout(cardTimer);
	if (placing) return movePlacing(hit);
	if (!hit) { card.hidden = true; return; }
	if (hit.poi) {
		card.hidden = true;
		const one = hit.poi.items?.length === 1 ? hit.poi.items[0] : null;
		if (!one?.stay) garden.flyTo(hit.poi.x, hit.poi.y, hit.poi.z);
		if (one?.msg) toast(one.msg, '#5F933E', one.open ?? null);
		// Les œufs ne se ramassent pas à la main : le jardinier passe les chercher.
		const eggs = hit.poi.items?.find(p => p.eggs);
		if (eggs) toast(`${eggs.eggs} œuf${eggs.eggs > 1 ? 's' : ''} : ${owned('cabane') ? `${farmerName(true).toLowerCase()} viendra les chercher pour le panier` : 'pose une cabane, ton jardinier viendra les chercher'} (${eggs.eggs * EGG_NECTAR} nectar au troc)`, '#5F933E');
		return;
	}
	if (hit.dew) {
		const d = hit.dew, v = collect(garden.takeDew(d), true);
		if (v >= 1) jackpot(v, d.x, d.y);
		return;
	}
	if (hit.item) return tapItem(hit, card);
	if (hit.critter) return tapCritter(hit, card);
	if (hit.cell != null) {
		if (hit.open && garden.cellScale(hit.cell) < 1) offerGrow(hit.cell);
		else if (hit.open) garden.flyToCell(hit.cell);
		else offerParcel(hit.cell);
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
	// Un arbre ou un arbuste adulte peut être replanté ailleurs.
	const fruit = pct >= 100 && FRUIT_OF[id], care = p.care ?? 0, careCost = 150 * (care + 1);
	if (fruit) card.insertAdjacentHTML('beforeend', `<small class="item-tip">Arbre fruitier : ${2 + 2 * care} kg de ${fruit} par cueillette${care ? ` (soigné ${care}/3)` : ''}.</small>`);
	if (pct >= 100 && (p.type === 'arbre' || p.type === 'buisson')) card.insertAdjacentHTML('beforeend', `<div class="item-actions">${fruit && care < 3 ? `<button class="btn primary" data-care ${(state.nectar ?? 0) < careCost ? 'disabled' : ''}>Le soigner · ${fmtInt(careCost)}</button>` : ''}<button class="btn ghost" data-move-plant>Déplacer</button></div>`);
	card.classList.toggle('link', known);
	card.onclick = e => {
		if (e.target.closest('[data-move-plant]')) { card.hidden = true; startMovingPlant(p); return; }
		if (e.target.closest('[data-care]')) {
			if ((state.nectar ?? 0) < careCost) return;
			state.nectar -= careCost;
			p.care = care + 1;
			persist(true);
			renderHud();
			sound.chime(1);
			card.hidden = true;
			toast(`${plantName(p)} soigné : ${2 + 2 * p.care} kg de ${fruit} par cueillette`, '#5F933E');
			return;
		}
		if (known) { card.hidden = true; species.open(id); }
	};
	placeCard(card, hit);
};

// ─── Toucher un animal, et le jeu « Trouve… » pour les enfants ─

let quest = null;
const questReward = () => Tuning.num('trouve.recompense', 15);

function tapCritter(hit, card) {
	const sp = SPECIES_BY_ID[hit.critter.sp];
	if (!sp) return;
	noteTap(state, sp.id);
	renderDaily();
	if (quest === sp.id) return winQuest(sp);
	// Un visiteur du moment (de nuit, sous la pluie, l'hiver…) : le toucher le fait découvrir, une récompense d'être là.
	if (!state.species[sp.id]) {
		state.species[sp.id] = Date.now();
		const vr = readReward() * 2;
		state.nectar = (state.nectar ?? 0) + vr;
		noteVisitor(state, garden.moment());
		{ const r = garden.canvas.getBoundingClientRect(), v = garden.view(), k = r.width / v.w; rewardFly(vr, { x: r.left + (hit.critter.x - v.x0) * k, y: r.top + (hit.critter.y - v.y0) * k }); }
		renderDaily();
		updateSpeciesDot(); renderHud(); persist(true);
		sound.chime(3);
		garden.burst(hit.critter.x, hit.critter.y - 10, 14, '#F4C23E');
		revealSpecies(sp, `découverte ${MOMENT_OF[garden.moment()] ?? 'rare'} · +${fmtInt(vr)} nectar`);
		return;
	}
	const g = state.eco2 && guildOfSp(sp.id);
	card.innerHTML = g ? `<b>${sp.name}</b><small class="item-tip">${GUILD_TEXT[g].name} · ${GUILD_TEXT[g].one}</small><span class="more">Sa fiche ›</span>`
		: `<b>${sp.name}</b>${sp.latin}<span class="more">Découvre son rôle ›</span>`;
	card.classList.add('link');
	card.onclick = () => { card.hidden = true; species.open(sp.id); };
	placeCard(card, hit, 4000);
}

// ─── Premières missions : apprendre le jeu en le faisant ─────────
// Trois gestes, un par un : marcher un peu, installer un collecteur, récolter le nectar. Chacune rapporte un peu de nectar.

const MISSIONS = [
	{ id: 'walk', text: 'Marche 300 m', help: 'Active le suivi et bouge : chaque pas compte, même à la maison, et rapporte du nectar.', done: () => state.totals.distance >= 300 },
	{ id: 'collect', text: 'Cueille les gouttes de nectar', help: 'Tes butineurs déposent du nectar en gouttes dorées sur les fleurs : touche-les pour le cueillir.', done: () => !!state.collectedOnce, go: () => focusDew() },
	{ id: 'collector', text: 'Installe un collecteur de nectar', help: 'Aménager › Récolte › Un collecteur de nectar : il garde la récolte pour toi.', done: () => hasCollector(state), go: () => openDeco('recolte') },
	{ id: 'jar', text: 'Vide ton collecteur', help: 'Quand l’étiquette dorée apparaît au-dessus du collecteur, touche-le pour tout récupérer.', done: () => !!state.collectedJar, go: () => focusJar() },
];
const MISSION_REWARD = 30;

function currentMission() {
	// Les nouvelles parties n'ont plus ces premières missions (gouttes, collecteur) : l'introduction les remplace.
	if (state.onboarded || state.intro || state.eco2) return null;
	return MISSIONS.find(m => !(state.missions ??= {})[m.id]) ?? null;
}

/** Valide les missions accomplies (dans l'ordre) et affiche la suivante. */
function renderMission() {
	let m = currentMission();
	while (m && m.done()) {
		state.missions[m.id] = Date.now();
		state.nectar = (state.nectar ?? 0) + MISSION_REWARD;
		rewardFly(MISSION_REWARD);
		toast(`Mission réussie : ${m.text.toLowerCase()} · +${MISSION_REWARD} nectar`, '#5F933E');
		sound.chime(2);
		m = currentMission();
		if (!m) { state.onboarded = true; toast('Tu connais l’essentiel : bonne balade !', '#F08A3C'); setTimeout(() => whenFree(offerNotify), 4000); }
		persist(true);
		renderHud();
	}
	const el = $('#mission');
	el.hidden = !m || !$('#coach').hidden;
	if (!m) return;
	if (quest) endQuest();
	$('#mission-step').textContent = `${MISSIONS.indexOf(m) + 1}/${MISSIONS.length}`;
	$('#mission-text').textContent = m.text;
}
setInterval(renderMission, 1500);
$('#mission').addEventListener('click', () => {
	const m = currentMission();
	if (!m) return;
	toast(m.help, '#5F933E');
	m.go?.();
});

// ─── Le guide : chaque nouveauté expliquée au bon moment ────────
// Une bulle à la fois, posée près du bouton ou de l'endroit concerné, qui s'illumine. Elle s'efface quand on
// touche « Compris » ou le bouton lui-même, et ne revient plus. Rien ne s'affiche par-dessus une page ouverte.

const owned = kind => Object.values(state.places).some(p => (p.items ?? []).some(i => i.kind === kind));
const ownedAny = cat => Object.values(state.places).some(p => (p.items ?? []).some(i => ITEMS[i.kind]?.cat === cat));
const totalKm = () => state.totals.distance / 1000;

const TIPS = [
	// La bourse d'abord, dès l'arrivée : tout le reste du guide en découle.
	{ id: 'purse', old: true, target: '#hud-steps', when: () => true,
		title: 'Ta bourse de nectar', get text() { return `Le nectar sert à aménager ton jardin. Tes pas en produisent (environ ${nectarPerKm()} par km en marchant, davantage en courant), tes animaux aussi : il se dépose sur les fleurs, et tu le cueilles. Dessous, ce qui t’attend.`; } },
	{ id: 'dew', old: true, target: '#hud-steps', when: () => groundOf(state) >= 2, show: () => focusDew(),
		title: 'Du nectar sur les fleurs', text: 'Tes butineurs déposent leur récolte en gouttes dorées sur les fleurs. Touche-les pour la cueillir : sinon elle attend, sans entrer dans ta bourse.' },
	{ id: 'deco', old: true, target: '#btn-deco', when: () => (state.nectar ?? 0) >= 60 && !hasCollector(state),
		title: 'Aménager', text: 'Tu as de quoi poser un collecteur : il garde la récolte de tes butineurs, plus besoin de cueillir les gouttes une à une.' },
	{ id: 'jar', old: true, target: '#hud-steps', when: () => jarOf(state) >= 5, show: () => focusJar(),
		title: 'Ton collecteur se remplit', text: 'L’étiquette au-dessus montre ce qu’il contient. Touche-le pour tout récupérer. Plein, il ne prend plus rien : le nectar reste au sol, en gouttes sur les fleurs. Vide-le, ou améliore-le.' },
	{ id: 'jarup', old: true, target: '#hud-steps', show: () => focusJar(),
		when: () => hasCollector(state) && jarOf(state) >= jarCap(state) && groundOf(state) >= 100 && garden.items.some(it => it.kind === 'collecteur' && (it.level ?? 1) < 3),
		title: 'Ton collecteur déborde', text: 'Ta récolte ne tient plus dans ton collecteur : le reste attend en gouttes sur les fleurs. Touche le collecteur au jardin pour l’améliorer (il garde 400, puis 1 000 nectar), ou poses-en un deuxième.' },
	{ id: 'eco', old: true, target: '#btn-eco', when: () => !!state.tips?.purse && SPECIES.some(sp => sp.kind === 'animal' && state.species[sp.id]),
		title: 'Ton écosystème', get text() { return `Les animaux découverts travaillent pour toi, même appli fermée : ils font pousser le jardin et récoltent du nectar. Quand tu bouges, ils travaillent ${fmtNum(boostMult())} fois plus.`; } },
	{ id: 'species', target: '#btn-species', when: () => (!!state.tips?.purse || state.eco2) && Object.keys(state.species).length >= 1,
		title: 'Les espèces', text: 'Chaque espèce a sa fiche. La lire te rapporte du nectar.' },
	{ id: 'habitats', old: true, target: '#btn-deco', when: () => ownedAny('habitat') || ((state.nectar ?? 0) >= 40 && hasCollector(state)),
		title: 'Des abris pour la faune', text: 'Dans Aménager › Habitats : chaque abri renforce une équipe d’animaux, et chaque niveau d’abri relève de 3 % ce que ton écosystème peut produire. Améliore-les plutôt que d’en poser partout.' },
	{ id: 'level', old: true, target: '#btn-deco', when: () => ownedAny('habitat') && totalKm() >= LEVEL_KM[2],
		title: 'Tes abris peuvent grandir', text: `Avec ${LEVEL_KM[2]} km parcourus, tes habitats passent au niveau 2. Touche-en un au jardin, ou ouvre Aménager, pour l’améliorer.` },
	{ id: 'cabane', old: true, target: '#btn-deco', when: () => totalKm() >= 5 && !owned('cabane'),
		title: 'Une cabane !', text: 'Avec 5 km parcourus, tu peux poser une cabane (Aménager › Récolte). Un fermier ou une fermière s’y installe et cultivera ton potager.' },
	{ id: 'potager', target: '#btn-deco', when: () => owned('cabane') && !owned('potager'),
		title: 'Le potager', text: 'Pose des carrés de potager près de la cabane, côte à côte : les légumes poussent quand tu marches, et chaque récolte rapporte du nectar.' },
	{ id: 'journal', target: '#btn-journal', when: () => (state.walks?.length ?? 0) >= 1,
		title: 'Ton carnet', text: 'Tes sorties, ta semaine, et l’album de la saison.' },
	{ id: 'biomes', target: '#hud-act', when: () => cellsOpen(here()) >= 2,
		title: 'Ton monde', text: 'Chaque nouvelle parcelle a son milieu et ses espèces. Touche l’icône d’activité pour voir ton monde.' },
	// ─── La nouvelle économie (nouvelles parties) : ce qu'il faut savoir, au moment où ça sert ───
	{ id: 'habitats2', eco2: true, target: '#btn-deco', when: () => (state.nectar ?? 0) >= 50 && !owned('massif'),
		title: 'Les habitats', text: 'Ils accueillent des animaux et te rapportent du nectar. Ouvre Aménager.' },
	{ id: 'elan', eco2: true, target: '#hud-act', when: () => (state.walks?.length ?? 0) >= 1 && boostLeft(state) > 0 && prodPerHour(state) > 0,
		title: 'L’élan', text: 'Après une sortie, tes habitats produisent à plein. Au repos, presque rien.' },
	{ id: 'kmvalue', eco2: true, target: '#hud-steps', when: () => prodPerHour(state) >= 3,
		title: 'Tes pas valent de plus en plus', get text() { return `Un km te rapporte maintenant environ ${fmtInt(60 + KM_HOURS * prodPerHour(state))} nectar.`; } },
	{ id: 'upgrade', eco2: true, target: '#btn-deco', when: () => Object.keys(LADDER).some(k => { const u = nextUpgrade(state, k); return u?.ok && (state.nectar ?? 0) >= u.cost; }),
		title: 'Une amélioration', text: 'Tu peux doubler la production d’un habitat. Ouvre Aménager.' },
	{ id: 'gauge', eco2: true, target: '#hud-steps', when: () => prodPerHour(state) > 0,
		title: 'Ta récolte', text: 'L’hexagone se remplit, puis verse dans ta bourse. Après une sortie, il va vingt fois plus vite.' },
	{ id: 'near', eco2: true, target: '#btn-deco', when: () => garden.items.some(it => isLadder(it.kind) && nearOf(state, it) < 0.5),
		title: 'Des plantes autour', text: 'Un habitat produit selon les plantes près de lui. Pose-le là où il y en a, le cercle doré montre sa portée.' },
	{ id: 'roles', eco2: true, target: '#btn-species', when: () => Object.keys(state.species).length >= 6,
		title: 'Chaque espèce aide', text: 'Touche un animal pour voir ce qu’il t’apporte.' },
	{ id: 'levels', eco2: true, target: '#btn-deco', when: () => garden.items.some(it => isLadder(it.kind) && (it.level ?? 1) === 1 && (() => { const nx = nextLevel(it); return nx?.ok && (state.nectar ?? 0) >= nx.cost; })()),
		title: 'Fais grandir tes habitats', text: 'Un habitat qui grandit produit plus. Touche-le, ou ouvre Aménager.' },
	{ id: 'birds', eco2: true, target: '#btn-deco', when: () => (here().noBirds ?? 0) > 0 && !seedBirds(here()),
		title: 'Il manque des oiseaux', text: 'Les oiseaux sèment arbustes et arbres. Pose une mangeoire ou un nichoir.' },
	{ id: 'plants', eco2: true, target: '#btn-deco', when: () => { const n = Object.keys(LADDER).reduce((a, k) => a + ownedCount(k), 0); return n >= 4 && here().plants.filter(p => p.growth >= 1 && p.type !== 'herbe').length < n * 2; },
		title: 'Il faut des plantes', text: 'Tes habitats manquent de plantes. Marche pour en faire pousser : vite pour des arbustes, en courant pour des arbres.' },
	{ id: 'daily', target: '#daily', when: () => totalKm() >= 1,
		title: 'Les défis du jour', text: 'Un cadeau et des défis chaque jour. Reviens souvent : le cadeau grossit.' },
];

let tipShown = null, lastTipEnd = 0;

// ─── L'interface se dévoile au fil du jeu ───
// Au départ : le jardin, la bourse, les espèces et les options. Le reste arrive quand il devient utile, avec un petit
// message ; l'astuce du bouton suit (elle attend qu'il soit visible). Une partie déjà avancée a tout d'un coup.
const UI_STEPS = [
	{ sel: '#btn-journal', name: 'le carnet de tes sorties', when: () => (state.walks?.length ?? 0) >= 1 || totalKm() >= 0.5 },
	{ sel: '#btn-deco', name: 'Aménager ton jardin', when: () => (here().buys ?? 0) >= 1 || (state.nectar ?? 0) >= 60 || Object.values(state.places).some(p => (p.items ?? []).length) },
	{ sel: '#btn-eco', name: 'ton écosystème', when: () => Object.keys(state.species).length - Object.keys(state.speciesStart ?? {}).length >= 3 },
	{ sel: '#daily', name: 'les défis du jour', when: () => totalKm() >= 1 || gardenDay() >= 1 },
];
function revealUi() {
	if (state.intro) return;
	if (!state.ui) {
		state.ui = {};
		const advanced = totalKm() >= 3 || owned('cabane') || Object.values(state.places).some(p => cellsOpen(p) > 1);
		if (advanced) for (const st of UI_STEPS) state.ui[st.sel] = 1;
	}
	for (const st of UI_STEPS) {
		const el = $(st.sel);
		if (!el) continue;
		if (!state.ui[st.sel] && st.when()) {
			state.ui[st.sel] = Date.now();
			el.classList.add('ui-new');
			setTimeout(() => el.classList.remove('ui-new'), 2600);
			toast(`Nouveau : ${st.name}`, '#5F933E');
			persist();
		}
		el.classList.toggle('ui-locked', !state.ui[st.sel]);
	}
}

/** La goutte de nectar la plus proche du centre de la vue, ou à défaut une fleur du jardin. */
function focusDew() {
	const d = garden.dew?.[0];
	if (d) garden.focusOn(d.x, d.y);
}
function focusJar() {
	// Le collecteur le plus rempli d'abord.
	const jars = garden.items.filter(i => i.kind === 'collecteur');
	const it = jars.sort((a, b) => stockOf(state, b) - stockOf(state, a))[0];
	if (it) garden.focusOn(it.x, it.y - 40);
}

/** Montre la prochaine explication utile, quand rien d'autre n'est ouvert. */
function nextTip() {
	if (state.intro || $('#app').classList.contains('booting') || tipShown || Date.now() - lastTipEnd < 20000 || placing || !$('#modal').hidden || !$('#coach').hidden || document.querySelector('.panel.open') || session) return;
	const done = (state.tips ??= {});
	const tip = TIPS.find(t => !done[t.id] && !(t.old && state.eco2) && !(t.eco2 && !state.eco2) && t.when());
	if (!tip) return;
	const target = $(tip.target);
	if (!target || target.offsetParent === null) return;
	tipShown = tip;
	// L'astuce montre l'endroit seulement si on ne fait rien d'autre.
	if (garden.autoCam()) tip.show?.();
	target.classList.add('tip-glow');
	const el = $('#tip');
	el.innerHTML = `<b>${tip.title}</b><p>${tip.text}</p><button class="btn primary small" data-tip-ok>Compris</button>`;
	el.hidden = false;
	// La bulle se place au-dessus d'un bouton du bas, ou sous un élément du haut ; sa pointe vise le bouton.
	const r = target.getBoundingClientRect(), app = $('#app').getBoundingClientRect();
	const below = r.top < app.height / 2;
	const w = Math.min(320, app.width - 24);
	const left = Math.max(12, Math.min(app.width - w - 12, r.left - app.left + r.width / 2 - w / 2));
	el.style.width = `${w}px`;
	el.style.left = `${left}px`;
	el.style.top = below ? `${r.bottom - app.top + 12}px` : '';
	el.style.bottom = below ? '' : `${app.bottom - r.top + 12}px`;
	el.classList.toggle('below', below);
	el.style.setProperty('--arrow', `${r.left - app.left + r.width / 2 - left}px`);
	sound.chime(1);
}

function endTip() {
	if (!tipShown) return;
	(state.tips ??= {})[tipShown.id] = Date.now();
	$(tipShown.target)?.classList.remove('tip-glow');
	$('#tip').hidden = true;
	tipShown = null;
	lastTipEnd = Date.now();
	persist();
}

$('#tip').addEventListener('click', e => { if (e.target.closest('[data-tip-ok]')) endTip(); });
// Toucher le bouton éclairé vaut « Compris ».
document.addEventListener('click', e => { if (tipShown && e.target.closest(tipShown.target)) endTip(); }, true);
setInterval(nextTip, 2500);

/**
 * Toucher l'objectif : quand il faut des espèces, on dit lesquelles chercher et comment, en commençant par le lieu
 * où l'on est ; sinon on rappelle simplement l'objectif.
 */
$('#next-goal').addEventListener('click', () => {
	const goal = nextGoal(state);
	if (!goal) return;
	// Des fiches à lire : on ouvre la première.
	if (goal.startsWith('Lis ')) { species.open(unreadSpecies(state)[0]); return; }
	if (!/espèce/.test(goal)) { toast(goal, '#9A7448'); return; }
	const present = here().biomes ?? ['prairie'];
	const open = PLACES.filter(p => present.includes(p.id) || placeOpen(state, p)).map(p => p.id);
	const todo = SPECIES.filter(s => open.includes(s.place) && !state.species[s.id] && s.hint)
		.sort((a, b) => (present.includes(a.place) ? 0 : 1) - (present.includes(b.place) ? 0 : 1) || (a.kind === 'plante' ? 1 : 0) - (b.kind === 'plante' ? 1 : 0))
		.slice(0, 6);
	showModal(`<div class="modal-body"><h2>À découvrir</h2><p>${goal}. Voici des pistes :</p>
		<ul class="harvest-rows">${todo.map(s => `<li><b>${PLACE_BY_ID[s.place].name}</b> · ${s.hint}</li>`).join('')}</ul></div>
		<div class="modal-foot"><button class="btn primary" data-close>D'accord</button></div>`);
});

/** Choisit un animal visible à l'écran à faire trouver. */
function pickQuest() {
	if (currentMission()) return;
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
	state.nectar = (state.nectar ?? 0) + questReward();
	persist();
	renderHud();
	showModal(`<h2>Bravo !</h2><p>Tu as trouvé : <b>${sp.name}</b></p><div class="bravo-thumb" id="bravo-thumb"></div>
		<p>${sp.role}</p><div class="chips"><span class="chip gold">+${questReward()} nectar</span></div>
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
	else if (!quest && !state.intro && $('#modal').hidden && !garden.glyph) pickQuest();
}, 9000);

// ─── Distance et décor ────────────────────────────────────────

/** Chaque mètre compte pour la journée, pour la parcelle, et rapporte du nectar (1 pour 5 m). */
/** L'effort d'une sortie, réparti entre la plante de l'allure et les étages du dessous (la dominante en dernier : c'est elle qu'on suit). */
function growMix(plant, effort) {
	// Pendant l'introduction, les pas ne font pousser que la première fleur (intro.js).
	if (state.intro) return [];
	// Nouvelle économie : chaque espèce de la vie du sol (vers de terre, fourmis…) fait pousser 5 % de plantes en plus.
	const soil = state.eco2 ? guildEffect(state).soil : 1;
	return effortMix(plant).flatMap(([type, share]) => garden.addEffort(type, effort * share * soil));
}

/** `nectar` : ce que rapportent ces mètres (par défaut 1 pour 5 m ; une sortie le calcule d'après l'effort). */
function addMeters(m, nectar = m / 5) {
	const n0 = state.nectar ?? 0;
	const before = state.totals.distance / 1000;
	addDistance(state, m);
	// Un nouvel aménagement devient possible (la cabane à 5 km…).
	const after = state.totals.distance / 1000;
	for (const k of ITEM_ORDER) {
		if (ITEMS[k].km > 0 && before < ITEMS[k].km && after >= ITEMS[k].km && !natureLock(k)) {
			sound.chime(2);
			toast(`Tu peux maintenant installer ${ITEMS[k].name.toLowerCase()}`, '#9A7448', () => openDeco(ITEMS[k].cat));
		}
	}
	here().km += m / 1000;
	// Le nectar de la marche se dépose comme celui des butineurs : en gouttes sur les fleurs, ou dans le collecteur.
	// Il n'est pas limité par la réserve : ce qu'on a gagné en marchant ne se perd jamais.
	addWaiting(state, nectar, false, state.place);
	// Nouvelle économie : chaque km vaut aussi KM_HOURS heures de la production du jardin (60 % activité, 40 % idle pour un joueur moyen).
	if (state.eco2 && !state.intro) state.nectar = (state.nectar ?? 0) + (m / 1000) * KM_HOURS * prodPerHour(state);
	walkGauge((state.nectar ?? 0) - n0);
	if (session && state.moment && state.moment !== 'jour') noteMomentMeters(state, state.moment, m);
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
	const pl = here(), buys = pl.buys ?? 0;
	// Assez de nectar pour le prochain achat (agrandir, ou une nouvelle parcelle) : on le dit une fois par achat.
	const next = growable(), price = next != null ? growPrice() : parcelPrice();
	if (cellsOpen(pl) < CELLS.length && (state.nectar ?? 0) >= price && (next != null || kmFree() >= parcelKm()) && pl.cellReady !== buys) {
		pl.cellReady = buys;
		events?.push({ kind: 'cell', n: buys });
		sound.chime(2);
		if (next != null) toast(`Tu peux agrandir ton terrain (${fmtInt(price)} nectar) · touche pour voir`, '#9A7448', () => offerGrow(next));
		else toast(`Tu peux explorer une parcelle voisine (${fmtInt(price)} nectar et ${kmTxt(parcelKm())}) : dézoome et touche-la`, '#9A7448', () => garden.toggleOverview());
	}
	for (const [key, d] of Object.entries(DECOR)) {
		if (heartOf(pl, d.place) < 0 || d.always || pl.unlocked[key] || biomeKm(pl, d.place) < d.km) continue;
		pl.unlocked[key] = Date.now();
		garden.reveal(key);
		toast(DECOR_MSG[key], '#5BB5B0', () => garden.showDecor(key));
		events?.push({ kind: 'decor', key });
	}
}

// ─── Agrandir : on achète, en nectar, chaque cran de terrain et chaque parcelle voisine ───
// Pas de terrain gagné en marchant : la marche rapporte du nectar (et l'objectif du jour), et c'est avec lui qu'on
// agrandit. Comme dans un jeu de gestion, chaque achat fait monter le prix du suivant. On agrandit d'abord son terrain
// jusqu'à sa taille pleine ; ensuite seulement on peut acheter une parcelle voisine (qui commence petite à son tour).

// Équilibre (nouvelle économie, voir docs/equilibre-evolia.html) : le terrain et les parcelles ont chacun leur hausse
// de prix, plus douce qu'avant (plus de mur après quatre parcelles), et l'activité physique reste le moteur.
/** Le prix du prochain cran d'agrandissement (60 nectar, puis +35 % à chaque cran). */
const growPrice = () => (state.eco2
	? Math.round((60 * Math.pow(1.35, here().grows ?? 0)) / 10) * 10
	: Math.round((40 * Math.pow(1.4, here().buys ?? 0)) / 10) * 10);
/** Une nouvelle parcelle : 500 nectar, puis ×1,7 à chaque parcelle (avant : deux fois et demie un cran). */
const parcelPrice = () => (state.eco2
	? Math.round((600 * Math.pow(2.3, Math.max(0, cellsOpen(here()) - 1))) / 10) * 10
	: Math.round((2.5 * growPrice()) / 10) * 10);
// Une parcelle voisine se paie aussi en kilomètres : c'est partir l'explorer. Les kilomètres marchés ici
// s'accumulent ; acheter une parcelle en dépense (de plus en plus à chaque parcelle). Les autres déblocages, eux,
// comptent toujours tout ce qu'on a marché.
/** Les kilomètres d'exploration qu'il faut pour la prochaine parcelle (1,5 km, puis ×1,5 à chaque parcelle). */
const parcelKm = () => Math.round(1.5 * Math.pow(1.5, Math.max(0, cellsOpen(here()) - 1)) * 10) / 10;
/** Les kilomètres d'exploration qu'on a en réserve (marchés ici, moins ceux déjà dépensés). */
const kmFree = () => Math.max(0, (here().km ?? 0) - (here().kmSpent ?? 0));
const kmTxt = v => `${fmt(Math.max(0.1, Math.ceil(v * 10) / 10), 1)} km`;
/** La première parcelle ouverte qui n'a pas encore sa taille pleine. */
const growable = () => garden.openCells().find(i => garden.cellScale(i) < 1);
const paid = (price, grow = false) => {
	state.nectar -= price;
	here().buys = (here().buys ?? 0) + 1;
	if (grow) here().grows = (here().grows ?? 0) + 1;
};

/** Ce qu'on lit sur une parcelle ouverte encore petite. */
garden.growInfo = i => `${Math.round(garden.cellScale(i) * 100)} % · agrandir : ${fmtInt(growPrice())} nectar`;

/** Toucher une parcelle ouverte encore petite : l'agrandir d'un cran. */
function offerGrow(i) {
	const price = growPrice(), nectar = state.nectar ?? 0, pct = Math.round(garden.cellScale(i) * 100);
	showModal(`<h2>Agrandir ton terrain</h2>
		<p>${cellName(here(), i)} fait ${pct} % de sa taille. Un cran de plus : ${Math.min(100, pct + 15)} %, de la place pour de nouvelles plantes et de nouveaux animaux.</p>
		<p class="item-tip">Chaque achat fait monter le prix du suivant. Le nectar se gagne en marchant, avec l’objectif du jour et au troc.</p>
		<div class="chips"><span class="chip gold">${fmtInt(price)} nectar</span></div>
		<button class="btn primary" id="btn-grow" ${nectar < price ? 'disabled' : ''}>${nectar < price ? `Il manque ${fmtInt(price - nectar)} nectar` : 'Agrandir'}</button>
		<button class="btn ghost wide" data-close>Plus tard</button>`);
	$('#btn-grow').onclick = () => {
		if ((state.nectar ?? 0) < price) return;
		paid(price, true);
		closeModal();
		const s = garden.growCell(i);
		sound.chime(3);
		toast(s >= 1 ? `${cellName(here(), i)} a sa taille pleine : tu peux acheter une parcelle voisine` : `Le terrain s’agrandit : ${Math.round(s * 100)} %`, '#5F933E');
		renderHud();
		persist(true);
		checkUnlocks();
	};
}

/** Ce qu'on lit sur une parcelle fermée : son milieu, et ce qu'il faut pour l'avoir. */
garden.lockedInfo = i => {
	// Rien n'est dévoilé à l'avance : ni le milieu qui attend, ni les parcelles qu'on ne peut pas encore explorer.
	const p = PLACE_BY_ID[garden.worldBiomeAt(i)], price = parcelPrice(), nectar = state.nectar ?? 0, km = parcelKm();
	if (!placeOpen(state, p) || growable() != null) return null;
	const ok = nectar >= price && kmFree() >= km;
	return { title: 'Terre inconnue', sub: `${fmtInt(price)} nectar · ${kmTxt(km)}${ok ? ' · touche pour l’explorer' : ''}`, hint: `${fmtInt(price)} nectar · ${kmTxt(km)}` };
};

/** Toucher une parcelle voisine : ce qu'elle est, et l'acheter si on peut. */
function offerParcel(i) {
	const biome = garden.worldBiomeAt(i), p = PLACE_BY_ID[biome], price = parcelPrice();
	if (!placeOpen(state, p)) return toast('Ce coin-là n’est pas encore accessible : continue de marcher et de découvrir des espèces', '#9A7448');
	const g = growable();
	if (g != null) return offerGrow(g);
	const nectar = state.nectar ?? 0, km = parcelKm(), free = kmFree();
	const missing = [nectar < price && `${fmtInt(price - nectar)} nectar`, free < km && kmTxt(km - free)].filter(Boolean);
	showModal(`<h2>Explorer une nouvelle parcelle</h2>
		<p>Personne ne sait ce qu’il y a là-bas : encore de la prairie, une mare, une forêt ? Tu le découvriras en l’explorant.</p>
		<p class="item-tip">Il faut du nectar et des kilomètres d’exploration (tu en as ${fmt(Math.floor(free * 10) / 10, 1)} km en réserve). Chaque parcelle coûte plus que la précédente.</p>
		<div class="chips"><span class="chip gold">${fmtInt(price)} nectar</span><span class="chip">${kmTxt(km)} d’exploration</span></div>
		<button class="btn primary" id="btn-parcel" ${missing.length ? 'disabled' : ''}>${missing.length ? `Il manque ${missing.join(' et ')}` : 'Explorer cette parcelle'}</button>
		<button class="btn ghost wide" data-close>Plus tard</button>`);
	$('#btn-parcel').onclick = () => {
		if ((state.nectar ?? 0) < price || kmFree() < km) return;
		here().kmSpent = (here().kmSpent ?? 0) + km;
		paid(price);
		closeModal();
		openParcel(garden.openAt(i, biome), biome);
		renderHud();
	};
}

/** Ouvre la parcelle `n` (déjà placée sur la grille) ; on le fête et la caméra y va. */
function openParcel(n, biome) {
	const pl = here();
	if (cellsOpen(pl) !== n + 1 && cellsOpen(pl) !== n) return;
	if (cellsOpen(pl) === n) garden.openCell(n, biome);
	delete pl.pendingCell;
	(pl.cellDates ??= {})[n] = Date.now();
	garden.flyToCell(n);
	persist(true);
	checkUnlocks();
	// L'effet « waouh » : la parcelle se dévoile.
	const [cx, cy] = garden.cellCenter(n);
	setTimeout(() => reveal({ title: cellName(pl, n), sub: `Nouvelle parcelle · ${PLACE_BY_ID[biome].name}`, color: PLACE_BY_ID[biome].color, at: [cx, cy], big: true }), 900);
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
			} else if (!tracking.motionRefused) { tracking.motionRefused = true; debugLog('Accéléromètre refusé ou indisponible'); }
		}
	}
	if (!tracking.gps && GpsTracker.available()) {
		tracking.gps = new GpsTracker(onSample, onGpsStatus);
		tracking.gps.onFix = f => trace('gps-point', f);
		tracking.gps.start();
		debugLog('Suivi lancé : GPS démarré');
	}
	if (tracking.motion && !tracking.motionLogged) { tracking.motionLogged = true; debugLog('Accéléromètre actif (compte les pas appli ouverte)'); }
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
	// Sur iPhone, l'accéléromètre attend un vrai geste : Safari n'accepte la demande qu'au moment où le doigt se
	// relève (« click »), pas quand il touche l'écran. On réessaie à chaque toucher tant qu'il n'est pas actif.
	const ask = () => {
		if (tracking.motion) { document.removeEventListener('click', ask, true); return; }
		if (state.tracking) enableTracking(true);
	};
	document.addEventListener('click', ask, true);
}

function onGpsStatus(st) {
	if (st.kind !== 'ok') trace('gps-état', { état: st.kind, ...(st.accuracy ? { précision: st.accuracy } : {}), ...(st.seconds ? { trou_s: st.seconds } : {}), ...(st.message ? { message: st.message } : {}) });
	if (st.kind === 'gap') { debugLog(`GPS : aucun point pendant ${dur(st.seconds)} (écran éteint ou appli en arrière-plan ?)`); return; }
	if (st.kind !== tracking.gpsState) debugLog(`GPS : ${{ searching: 'recherche', ok: 'bon signal', weak: `signal faible (±${Math.round(st.accuracy)} m)`, error: `erreur ${st.code} (${st.message})` }[st.kind] ?? st.kind}`);
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
	debugLog(sim ? 'Balade simulée commencée' : 'Balade commencée');
	trace('balade', { état: 'début' });
	session = { start: Date.now(), simTime: 0, distance: 0, steps: 0, effort: 0, events: [], speed: 0, act: null, sim, touched: new Set(), lastMove: Date.now() };
	garden.setFollow(true);
	sound.setWalking(true);
	toast('Tu bouges : ton jardin pousse', '#F08A3C');
}

function onSample(s) {
	const now = Date.now();
	let act;
	if (s.motion) {
		if (session) session.steps += s.steps;
		if (s.steps > 0) tracking.lastStep = now;
		// Dehors, le GPS a la priorité ; l'accéléromètre prend le relais quand il ne voit plus de déplacement.
		if (now - tracking.lastGpsMove < 15000) { trace('pas', { pas: s.steps, cadence: tracking.motion?.spm ?? 0, retenu: 'non (GPS prioritaire)' }); renderStatus(); return; }
		act = s.act ? ACTIVITY_BY_ID[s.act] : null;
	} else {
		if (s.dist > 0 && !s.sim) tracking.lastGpsMove = now;
		// Le téléphone sent des pas depuis peu : on court ; s'il n'en sent aucun à cette allure, on pédale.
		act = activityFor(s.speedKmh, !!tracking.motion && now - (tracking.lastStep ?? 0) > 20000);
		// Le téléphone sent des pas à l'instant : on est à pied, même si le GPS annonce une allure de vélo.
		if (act?.bike && tracking.motion && now - (tracking.lastStep ?? 0) < 10000) act = activityFor(Math.min(s.speedKmh, 14.9));
		// Le dénivelé des dix dernières minutes dit si c'est une randonnée (en marchant) ou un trail (en courant).
		const log = (tracking.hikeLog ??= []);
		log.push({ t: now, dist: s.dist ?? 0, climb: s.climb ?? 0, drop: s.drop ?? 0 });
		while (log.length && now - log[0].t > HIKE_WINDOW) log.shift();
		const onFoot = act && !act.bike && !act.indoor;
		tracking.hiking = onFoot && hikeFor(log, now, tracking.hiking);
		if (tracking.hiking) act = act.mult <= ACTIVITY_BY_ID['marche-tres-rapide'].mult ? ACTIVITY_BY_ID.randonnee : ACTIVITY_BY_ID.trail;
	}
	trace(s.motion ? 'pas' : s.sim ? 'simulé' : 'gps-mesure', s.motion
		? { pas: s.steps, cadence: tracking.motion?.spm ?? 0, km_h: s.speedKmh, retenu: act ? act.name : (now - tracking.lastGpsMove < 15000 ? 'non (GPS prioritaire)' : 'non') }
		: { m: s.dist, s: s.dt, km_h: s.speedKmh, montée: s.climb ?? 0, descente: s.drop ?? 0, activité: act?.name ?? 'aucune', balade_m: session ? Math.round(session.distance) : '-' });
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
	if (act.bike) session.bike = (session.bike ?? 0) + s.dist;
	// Les mètres faits en randonnée ou en trail, pour le titre du bilan.
	if (act.hike) session.hike = { ...(session.hike ?? {}), [act.id]: (session.hike?.[act.id] ?? 0) + s.dist };
	// Chaque mètre gravi vaut une dizaine de mètres à plat.
	if (s.climb > 0 && !act.bike) session.climb = (session.climb ?? 0) + s.climb;
	const effort = effortFor(s.dist, s.speedKmh, act) + (s.climb > 0 && !act.bike ? s.climb * act.mult : 0);
	// À pied, le nectar suit l'effort (montée comprise) ; à vélo, il garde sa part réduite, comme la progression.
	const nectar = act.bike ? (s.dist * (act.counts ?? 1)) / 5 : effort * nectarPerEffort();
	session.nectar = (session.nectar ?? 0) + nectar;
	addMeters(s.dist * (act.counts ?? 1), nectar);
	addDayEffort(state, effort);
	session.effort += effort;
	state.totals.effort += effort;
	addEffortXp(effort);
	for (const ev of growMix(act.plant, effort)) {
		session.events.push(ev);
		if (ev.kind === 'mature' && ev.plant.type !== 'herbe') { toast(`${plantName(ev.plant)} a fini de pousser`, TYPE_COLOR[ev.plant.type]); sound.chime(1); }
		if (ev.kind === 'nobird') noBirdsNote(ev.type);
		if (ev.kind === 'sown') toast(`${ev.by[0].toUpperCase() + ev.by.slice(1)} a semé : ${plantName(ev.plant).toLowerCase()}`, TYPE_COLOR[ev.plant.type]);
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
	walkAcc = 0;
	debugLog(`Balade finie : ${Math.round(w.distance)} m en ${dur(sessionSeconds(w))}`);
	trace('balade', { état: 'fin', m: w.distance, s: sessionSeconds(w), pas: w.steps });
	session = null;
	garden.setFollow(false);
	sound.setWalking(false);
	const duration = sessionSeconds(w);
	const matured = {};
	for (const ev of w.events) if (ev.kind === 'mature') matured[ev.plant.type] = (matured[ev.plant.type] ?? 0) + 1;
	if (w.distance > 50) addBoost(state, (duration / 60) * boostPerMin());
	if (w.distance > 10) {
		// `end` sert à ne pas recompter ces pas lors de la prochaine récolte.
		state.walks.unshift({ start: w.start, end: w.sim ? undefined : w.lastMove, duration, distance: w.distance, effort: w.effort, matured, place: state.place, ...(w.climb >= 10 ? { climb: Math.round(w.climb) } : {}), ...(w.hike ? { hike: Object.entries(w.hike).sort((a, b) => b[1] - a[1])[0][0] } : {}) });
		state.walks.length = Math.min(state.walks.length, 100);
		state.totals.walks += 1;
		state.totals.steps += w.steps;
		const grown = Object.entries(matured).map(([t, n]) => `+${n} ${plural(n, t)}`).join(', ');
		const bike = (w.bike ?? 0) > w.distance / 2;
		toast(`${bike ? 'Sortie à vélo' : 'Balade finie'} : ${fmt(w.distance / 1000)} km${bike ? ` (comptés ${fmt((w.distance - w.bike * 0.6) / 1000)} km)` : ''}${grown ? ` · ${grown}` : ''}`, '#F08A3C', () => showRecap(w, duration, matured));
		// Une vraie sortie mérite son bilan à l'écran, pas seulement un petit message : il s'ouvre de lui-même.
		if (w.distance >= 300) whenFree(() => { if ($('#modal').hidden) showRecap(w, duration, matured); });
	}
	// La relecture des pas attendait la fin de la balade : elle rattrape maintenant ce qui s'est fait autour.
	if (!w.sim && Date.now() - state.lastHarvest > 2 * 60000) setTimeout(() => maybeHarvest(), 1500);
	persist(true);
	renderHud();
	renderStatus();
}
setInterval(() => {
	if (session && Date.now() - session.lastMove > STOP_AFTER) endSession();
	else renderStatus();
}, 5000);

// ─── L'icône d'activité, en haut : au repos, marche, course ou vélo ───
const ACT_ICONS = {
	rest: '<circle cx="12" cy="4.6" r="2.2"/><path d="M12 7.5v6.5M12 14l-2.6 7M12 14l2.6 7M12 9.2l-3.4 3.4M12 9.2l3.4 3.4"/>',
	walk: '<circle cx="13" cy="4.6" r="2.2"/><path d="M12.6 7.6l-1.8 6M10.8 13.6l-2.8 7.2M10.8 13.6l3.2 3 .8 4.4M12.2 9.4l-3.4 2.8M12.2 9.4l3.4 2"/>',
	run: '<circle cx="15.4" cy="4.4" r="2.2"/><path d="M14.6 7.4l-3.4 6M11.2 13.4l-4 3.4-2.4-.8M11.2 13.4l4 2.6-1 5M13.6 9.2l-4.2.2M13.6 9.2l3.8 3.4"/>',
	bike: '<circle cx="6" cy="17" r="3.6"/><circle cx="18" cy="17" r="3.6"/><circle cx="13.5" cy="4.6" r="2"/><path d="M6 17l4-6h5l3 6M10 11l2.4 6L15 11M12.6 7.2l-1.6 3.8"/>',
};
function renderAct() {
	const a = session?.act, kind = !session ? 'rest' : a?.bike ? 'bike' : a && a.mult >= 2 ? 'run' : 'walk';
	const el = $('#hud-act');
	// Pendant une sortie : le cercle pulse, et une petite étiquette donne la sortie en direct (km, temps).
	const live = $('#act-live');
	if (live) {
		live.hidden = !session || !!state.intro;
		if (session) live.textContent = `${fmt(session.distance / 1000)} km · ${fmtTime(sessionSeconds(session))}`;
	}
	el?.classList.toggle('moving', !!session);
	if (!el || el.dataset.act === kind) return;
	el.dataset.act = kind;
	el.setAttribute('aria-label', kind === 'rest' ? 'Au repos' : a?.name ?? 'En mouvement');
	$('#act-ico').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ACT_ICONS[kind]}</svg>`;
}

/** Le détail derrière l'icône : l'activité en cours, les kilomètres du jour, l'objectif, les milieux. */
function showActivity() {
	const km = todayMeters(state) / 1000, goal = state.goalKm, next = nextGoal(state);
	const now = session
		? `<p><b>${session.act?.name ?? 'En mouvement'}</b> · ${fmt(session.distance / 1000)} km · ${fmtTime(sessionSeconds(session))}</p>`
		: `<p><b>${state.tracking ? 'Au repos' : 'Suivi en pause'}</b>${state.tracking ? '' : ' : active le suivi pour que tes pas comptent.'}</p>`;
	showModal(`<h2>Ton activité</h2>${now}
		<div class="chips"><span class="chip">${fmt(km, 1)} km aujourd’hui</span><span class="chip">objectif ${fmt(goal, goal % 1 ? 1 : 0)} km</span></div>
		${next ? `<p class="item-tip">${next}</p>` : ''}
		<button class="btn ghost wide" id="btn-act-places">Voir tout mon monde</button>
		<button class="btn primary" data-close>Fermer</button>`);
	// La carte des cinq milieux fixes n'a plus de sens dans un monde tiré pour chaque partie : on montre le sien, de loin.
	$('#btn-act-places').onclick = () => { closeModal(); if (!garden.glyph) garden.toggleOverview(); };
}

function renderStatus() {
	renderAct();
	// Sans suivi des pas, le jeu ne peut rien faire pousser : une alerte reste affichée tant qu'il n'est pas actif.
	$('#track-alert').hidden = !!state.intro || (!!state.tracking && !!(tracking.motion || tracking.gps));
	const dot = $('#status-dot'), title = $('#status-title'), sub = $('#status-sub');
	$('#btn-track').hidden = !!state.tracking;
	$('#live').hidden = !session;
	if (session) {
		dot.className = 'status-dot moving';
		title.textContent = session.act?.name ?? 'En pause';
		sub.textContent = `Ton jardin pousse · élan ×${fmtNum(boostMult())} à la fin`;
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
	const x = boostLeft(state) ? boostMult() : 1;
	dot.className = `status-dot${state.tracking ? ' idle' : ''}`;
	title.textContent = state.tracking ? 'Au repos' : 'Suivi en pause';
	// La récolte qui attend : dans les fleurs (à cueillir) ou dans les collecteurs (à vider d'un geste).
	const pend = Math.floor(state.pending ?? 0), full = hasCollector(state) && jarOf(state) >= jarCap(state);
	const wait = full ? ` · collecteur plein, ${fmtInt(pend)} à récolter` : pend >= 1 ? ` · ${fmtInt(pend)} à récolter` : r.capped && x === 1 ? ' · à plein : bouge pour plus' : '';
	// Personne au travail : on dit comment lancer l'écosystème plutôt qu'un petit chiffre qui ne vient de nulle part.
	const working = Object.values(r.members).some(n => n > 0);
	sub.textContent = working ? `Écosystème : +${fmtInt(r.nectar * x)} nectar/h${x > 1 ? ` · élan ×${fmtNum(x)}` : ''}${wait} ›`
		: `Écosystème : découvre un animal pour le lancer${wait} ›`;
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
	// Les défis du jour ne s'ouvrent seuls qu'une fois dévoilés (voir revealUi).
	if (gift && !state.ui?.['#daily']) return;
	const d = state.daily;
	const g = giftFor(state);
	const ready = giftReady(state);
	const streak = d.streak > 0 ? `<b>${d.streak} jour${d.streak > 1 ? 's' : ''} actif${d.streak > 1 ? 's' : ''}</b> de suite${d.best > d.streak ? ` · record ${d.best}` : ''}` : 'Bouge 500 m pour lancer ta série';
	const top = ready
		? `<div class="gift"><span class="gift-box" aria-hidden="true">🎁</span><div><p>${streak}. Ton jardin t'a gardé un cadeau :</p>
			<span class="chip gold">+${g.nectar} nectar</span>${g.boost ? `<span class="chip">élan ×${fmtNum(boostMult())} · ${g.boost} min</span>` : ''}</div></div>`
		: `<p class="streak">${streak}</p>`;
	// Le bilan de l'absence reste replié : la fenêtre tient sur l'écran.
	const note = gift && idleNote ? `<details class="away"><summary>Pendant ton absence</summary>${idleNote}</details>` : '';
	if (gift) idleNote = '';
	const goal = nextGoal(state);
	showModal(`<div class="modal-body"><h2>${gift ? 'Bonjour !' : "Aujourd'hui"}</h2>
		${weekHtml(state)}${top}
		<h3 class="ch-title">Défis du jour</h3>${challengesHtml(state)}${quizLine()}
		${goal ? `<p class="next-line">${goal}</p>` : ''}${note}</div>
		<div class="modal-foot">${ready ? '<button class="btn primary" id="btn-gift">Ouvrir le cadeau</button>' : '<button class="btn primary" data-close>Voir mon jardin</button>'}</div>`);
	$('#btn-quiz')?.addEventListener('click', () => offerQuiz(true));
	$('#btn-gift')?.addEventListener('click', () => {
		const got = claimGift(state);
		sound.chime(3);
		state.nectar = (state.nectar ?? 0) + got.nectar;
		if (got.boost) addBoost(state, got.boost);
		rewardFly(got.nectar);
		garden.burst(garden.cam.cx, garden.cam.cy, 30, '#F4C23E');
		toast(`Cadeau : +${got.nectar} nectar${got.boost ? ` et élan ×${fmtNum(boostMult())} pendant ${got.boost} min` : ''}`, '#F4C23E');
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
	{ const r = b.getBoundingClientRect(); rewardFly(c.reward, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
	sound.chime(2);
	toast(`Défi réussi : +${c.reward} nectar${c.boost ? ` et élan ×${fmtNum(boostMult())} pendant ${c.boost} min` : ''}`, '#F08A3C');
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
	for (const ev of w.events) if (ev.kind === 'cell') chips.push(`<span class="chip gold">${cellsOpen(here()) > ev.n ? cellName(here(), ev.n) : 'Nouvelle parcelle'}</span>`);
	for (const ev of w.events) if (ev.kind === 'sown') chips.push(`<span class="chip">Semé par ${ev.by} : ${plantName(ev.plant).toLowerCase()}</span>`);
	// Une sortie surtout en montée devient une randonnée ou un trail.
	const hike = Object.entries(w.hike ?? {}).sort((a, b) => b[1] - a[1])[0];
	const hiked = hike && hike[1] >= w.distance * 0.4 ? ACTIVITY_BY_ID[hike[0]] : null;
	const title = hiked ? (hiked.id === 'trail' ? 'Quel trail !' : 'Belle randonnée !') : w.distance > 3000 ? 'Quelle balade !' : 'Belle balade !';
	let ecoLine = '';
	if (w.distance > 50) {
		const r = rates(state, state.place);
		const mins = Math.min(maxBoostH() * 60, (duration / 60) * boostPerMin());
		const flowers = ((r.grow.fleur ?? 0) * (boostMult() - 1) * mins) / 60 / PLANT_TYPES.fleur.cost;
		ecoLine = `<p class="eco-gain">Ton écosystème profite de ta sortie : <b>+${fmtInt(w.nectar ?? w.distance / 5)} nectar à récolter</b> et production <b>×${fmtNum(boostMult())}</b> pendant ${fmtMin(mins)}${flowers >= 0.5 ? `, soit environ ${fmtInt(flowers)} fleur${flowers >= 1.5 ? 's' : ''} en plus grâce à tes pollinisateurs` : ''}.</p>`;
	}
	showModal(`
		<h2>${title}</h2><p>Voici ce qui a poussé grâce à toi.</p>
		<div class="walk-stats">
			<div><b>${fmt(w.distance / 1000)}</b><span>km</span></div>
			<div><b>${fmtTime(duration)}</b><span>durée</span></div>
			${w.climb >= 10 ? `<div><b>+${fmtInt(w.climb)}</b><span>m de montée</span></div>` : `<div><b>${fmtInt(w.steps || w.distance / STEP_LENGTH_M)}</b><span>pas</span></div>`}
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
		state.harvestInfo = { at: Date.now(), from: res?.from ?? since, steps: Math.round(res?.steps ?? 0), source: source.label };
		debugLog(`Relecture ${source.label} : ${state.harvestInfo.steps} pas depuis ${new Date(state.harvestInfo.from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
		persist(true);
		if (res && res.steps >= 30) await playHarvest(res, source);
		else if (res && res.to - res.from > 30 * 60000) {
			// Rien trouvé après une vraie absence : on le dit, pour qu'on sache où chercher.
			toast(`${source.label} n'a aucun pas depuis ${new Date(res.from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · voir Options`, '#C0442F', () => openOptions());
		}
	} catch (e) {
		console.warn('Récolte impossible', e);
		debugLog(`Relecture ${source.label} impossible : ${String(e?.message ?? e).slice(0, 80)}`);
		state.harvestInfo = { at: Date.now(), from: since, steps: 0, source: source.label, error: String(e?.message ?? e).slice(0, 120) };
		persist(true);
		toast(`Impossible de lire tes pas dans ${source.label} · voir Options`, '#C0442F', () => openOptions());
	}
	harvesting = false;
}

/** Fait pousser le jardin devant la personne, allure par allure, puis montre le bilan. */
async function playHarvest(res, source) {
	for (const [k, m] of Object.entries(res.days)) state.days[k] = (state.days[k] ?? 0) + m;
	state.totals.distance += res.distance;
	here().km += res.distance / 1000;
	state.totals.steps += res.steps;
	// Le nectar des pas relus suit leur effort, réparti sur les jours où ils ont été faits.
	const effortAll = res.groups.reduce((a, g) => a + g.effort, 0), nectar = effortAll * nectarPerEffort();
	for (const [k, m] of Object.entries(res.days)) if (res.distance > 0) addDayEffort(state, (effortAll * m) / res.distance, k);
	addWaiting(state, nectar, false, state.place);
	if (state.eco2 && !state.intro) state.nectar = (state.nectar ?? 0) + (res.distance / 1000) * KM_HOURS * prodPerHour(state);
	// L'élan des pas relus vaut celui d'une marche suivie en direct : 3 min par minute de vraie marche,
	// 2 min par minute de petits pas (ménage, marche lente).
	addBoost(state, res.groups.reduce((n, g) => n + g.minutes * (g.act.id === 'menage' || g.act.id === 'marche-lente' ? 2 : boostPerMin()), 0));
	renderHud();
	closeModal();
	toast(`${fmtInt(res.steps)} pas pendant ton absence · +${fmtInt(nectar)} nectar à récolter`, '#A3BD57');
	garden.setFollow(true, true);
	const rows = [], events = [];
	for (const g of res.groups.sort((a, b) => b.effort - a.effort)) {
		const matured = {}, touched = new Set();
		const chunks = 8;
		for (let i = 0; i < chunks; i++) {
			for (const ev of growMix(g.act.plant, g.effort / chunks)) if (ev.kind === 'mature') matured[ev.plant.type] = (matured[ev.plant.type] ?? 0) + 1;
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
	// Ce que la sortie a ouvert : nouvelles parcelles et nouveaux décors.
	const decor = events.map(ev => ev.kind === 'cell'
		? `<span class="chip gold">Nouvelle parcelle${cellsOpen(here()) > ev.n ? ` : ${cellName(here(), ev.n).toLowerCase()}` : ''}</span>`
		: `<span class="chip gold">${DECOR[ev.key]?.name ?? ''}</span>`).join('');
	showModal(`<div class="modal-body">
		<h2>Pendant ton absence</h2>
		<p>${fmtInt(res.steps)} pas · ${fmt(res.distance / 1000)} km, comptés par ${source.label}. Même le ménage fait pousser ton jardin.</p>
		<p class="harvest-info">Tes pas t’ont rapporté <b>+${fmtInt(nectar)} nectar</b>, selon l’effort fourni. Avec la récolte de tes animaux, il t’attend ${hasCollector(state) ? 'dans ton collecteur : touche-le pour tout récupérer' : 'en gouttes dorées sur les fleurs : touche-les pour le cueillir'}.</p>
		<ul class="harvest-rows">${rows.join('')}</ul>${decor ? `<div class="chips">${decor}</div>` : ''}
		${idleNote ? `<p>Et ton écosystème a travaillé :</p>${idleNote}` : ''}</div>
		<div class="modal-foot"><button class="btn primary" data-close>Voir mon jardin</button></div>`);
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
	showModal(`<div class="modal-body"><h2>Pendant ton absence</h2><p>Tes animaux ont continué de travailler. Bouge, et leur production sera multipliée par ${fmtNum(boostMult())}.</p>
		${idleNote}</div><div class="modal-foot"><button class="btn primary" data-close>Voir mon jardin</button></div>`);
	idleNote = '';
}

/** Propose, une fois, de lire les pas comptés par le téléphone (seulement dans l'appli installée). */
// Après « Plus tard », on ne redemande pas avant ce délai (sauf au prochain lancement de l'appli).
const HARVEST_ASK_AGAIN = 6 * 3600000;

/**
 * Rien ne relit les pas faits appli fermée : on le redemande à chaque lancement (« Plus tard » ne vaut que pour quelques
 * heures, sinon le joueur croit ses pas comptés alors qu'ils sont perdus). `force` : lancement de l'appli ou Options.
 */
async function offerHarvest(force = false) {
	if (state.harvestSource) return;
	if (!force && Date.now() - (state.harvestLaterAt ?? 0) < HARVEST_ASK_AGAIN) return;
	state.harvestLaterAt = Date.now();
	if (!isApp()) {
		// Sur le site, aucun navigateur ne peut lire les pas en arrière-plan : on le dit une fois par jour.
		if (state.webStepsNote !== dayKey()) {
			state.webStepsNote = dayKey();
			persist(true);
			// Une vraie fenêtre (et pas un message qui passe) : c'est important, et le joueur doit avoir le temps de le lire.
			const show = () => $('#modal').hidden ? showModal(`
				<h2>Sur le site, garde Evolia ouverte</h2>
				<p>Un navigateur ne peut pas compter tes pas quand la page est fermée : seuls les pas faits <b>Evolia ouverte</b> font pousser ton jardin. Garde-la ouverte pendant ta marche, ou installe l’appli Android.</p>
				<button class="btn primary" data-close>Compris</button>`) : setTimeout(show, 800);
			show();
		}
		return;
	}
	const source = await bestSource(false);
	if (!source) {
		// Ni Health Connect ni podomètre : on explique quoi installer, plutôt que de se taire.
		showModal(`
		<h2>Tes pas appli fermée ne comptent pas encore</h2>
		<p>Pour qu'Evolia relise tes pas quand elle est fermée, ton téléphone doit les compter : installe Health Connect, et une appli qui y écrit tes pas (Google Fit, Samsung Health…). Sinon, garde Evolia ouverte pendant ta marche.</p>
		<button class="btn primary" id="btn-hc">Installer Health Connect</button>
		<button class="btn ghost wide" data-close>Plus tard</button>`);
		$('#btn-hc').onclick = () => { closeModal(); window.open('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata', '_blank'); };
		persist(true);
		return;
	}
	persist(true);
	showModal(`
		<h2>Ton jardin pousse même appli fermée</h2>
		<p>Ton téléphone compte déjà tes pas avec ${source.label}. Evolia peut les relire à chaque ouverture. Ces données restent sur ton téléphone.</p>
		<button class="btn primary" id="btn-allow">Autoriser</button>
		<button class="btn ghost wide" data-close id="btn-later">Plus tard</button>`);
	$('#btn-later').onclick = () => { state.harvestLaterAt = Date.now(); persist(true); toast('D’accord : je te le redemanderai au prochain lancement', '#9A7448'); };
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
	trace('écran', { état: document.hidden ? 'caché' : 'visible' });
	if (document.hidden) { traceFlush(); tracking.hiddenAt = Date.now(); debugLog(session ? 'Écran éteint ou autre appli — pendant une balade' : 'Écran éteint ou autre appli'); persist(true); sound.pause(); planReminders(); return; }
	debugLog(`De retour${tracking.hiddenAt ? ` après ${dur((Date.now() - tracking.hiddenAt) / 1000)}` : ''}`);
	clearReminders();
	sound.resume();
	runIdle(true);
	// Une balade restée ouverte pendant que le téléphone dormait se termine là où on a cessé de bouger,
	// pour que la relecture des pas puisse compter tout le reste de la sortie.
	if (session && Date.now() - session.lastMove > STOP_AFTER) endSession();
	if (Date.now() - state.lastHarvest > 2 * 60000) await maybeHarvest();
	else if (!state.harvestSource) whenFree(() => $('#modal').hidden && offerHarvest());
	if (newDay()) whenFree(() => $('#modal').hidden && showDaily(true));
	else whenFree(showIdleRecap);
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
		<h3>Ton jardin</h3>
		<ul class="rows">
			${Object.entries(PLANT_TYPES).map(([t, d]) => `<li><span>${d.plural[0].toUpperCase() + d.plural.slice(1)} <small>· ${ACTIVITIES.filter(a => a.plant === t).map(a => a.name.toLowerCase()).join(', ')}</small></span><b>${mature(t)}</b></li>`).join('')}
		</ul>
		${[...new Set(pl.biomes ?? ['prairie'])].map(b => `<h3>${PLACE_BY_ID[b].name} · ${(pl.biomes ?? ['prairie']).filter(x => x === b).length} parcelle${(pl.biomes ?? ['prairie']).filter(x => x === b).length > 1 ? 's' : ''}</h3>
		<ul class="rows">
			${Object.entries(DECOR).filter(([, d]) => d.place === b && !d.always).map(([k, d]) => `<li><span>${d.name}</span><b>${pl.unlocked[k] ? '✓' : `dans ${fmt(Math.max(0.1, d.km - biomeKm(pl, b)), 1)} km`}</b></li>`).join('')}
		</ul>`).join('')}
		<h3>L’album de la saison</h3>
		${seasonHtml(state)}
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
garden.onNectar = n => {
	// Chaque goutte qui arrive tinte, un peu plus haut à mesure que la cagnotte monte.
	if (purseAnim) { purseAnim.got += n; sound.drip(Math.min(1, purseAnim.got / purseAnim.drops)); }
	const el = $('#hud-steps .nectar');
	if (!el) return;
	el.classList.remove('bump');
	void el.offsetWidth; // relance l'animation
	el.classList.add('bump');
};

/** Production par heure, dans tous les lieux (l'écosystème travaille partout à la fois). */
function nectarPerHour() {
	const x = boostLeft(state) ? boostMult() : 1;
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
	const x = boostLeft(state) ? boostMult() : 1;
	const r = rates(state, state.place);
	// Le total avance en direct entre deux passages de l'écosystème (toutes les 5 s).
	// La récolte qui attend avance en direct, jusqu'à la limite de la réserve.
	const live = Math.min(nectarCapacity(state), (state.pending ?? 0) + nectarPerHour() * (Date.now() - (state.lastIdle ?? Date.now())) / 3600000);
	const rows = Object.entries(GUILDS).filter(([gid]) => r.members[gid] > 0).map(([gid, g]) =>
		`<li><span>${g.name} <small>×${r.members[gid]}</small></span><b>+${fmt(g.nectar * r.members[gid] * r.mult * x, 1)}/h</b></li>`).join('');
	const growing = garden.current && garden.current.growth < 1 ? garden.current : null;
	card.innerHTML = `<div class="zi-head"><b>Récolte du nectar</b>${x > 1 ? `<span class="zi-boost">élan ×${fmtNum(x)} · ${fmtMin(boostLeft(state) / 60000)}</span>` : ''}</div>
		<div class="zi-total"><span class="nectar">${live.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><small>à récolter · +${fmt(r.nectar * x, 1)}/h ici</small></div>
		${rows ? `<ul>${rows}</ul>` : '<p>Découvre des pollinisateurs : ils récoltent le nectar pour toi.</p>'}
		<p class="zi-move">En marchant : environ +${nectarPerKm()} nectar par km, davantage en courant${x === 1 ? `, et la récolte est ensuite multipliée par ${fmtNum(boostMult())}` : ''}.</p>
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
// Aménager fige la vue : ni la croissance suivie, ni le guide, ni une découverte ne déplacent la caméra.
garden.camLock = () => !!placing || $('#deco').classList.contains('open');
// Elle ne part pas non plus d'elle-même pendant qu'on lit une fiche, une fenêtre ou une page.
garden.camBusy = () => !$('#plant-card').hidden || !$('#modal').hidden || !$('#coach').hidden || !!document.querySelector('.panel.open');

/**
 * La nature d'abord, la ferme ensuite : la cabane (et avec elle le fermier, le potager, les poules et les ruches)
 * n'arrive qu'une fois le jardin peuplé : assez d'espèces, quelques arbustes et un premier arbre.
 */
// species : espèces arrivées depuis le début (celles du jardin de départ ne comptent pas).
const NATURE_FARM = { species: 8, bushes: 3, trees: 1 };
function natureProgress() {
	const plants = allPlants(state), mature = t => plants.filter(p => p.type === t && p.growth >= 1).length;
	const start = Object.keys(state.speciesStart ?? {}).length;
	return { species: Object.keys(state.species).length - start, bushes: mature('buisson'), trees: mature('arbre') };
}
function natureReady() {
	if (state.natureReady) return true;
	// Les parties déjà avancées (une cabane posée) gardent leur ferme.
	if (Object.values(state.places).some(p => (p.items ?? []).some(i => i.kind === 'cabane'))) return (state.natureReady = Date.now());
	const n = natureProgress();
	return n.species >= NATURE_FARM.species && n.bushes >= NATURE_FARM.bushes && n.trees >= NATURE_FARM.trees;
}
/** Ce qui manque encore à la nature, en clair. */
function natureMissing() {
	const n = natureProgress(), out = [];
	if (n.species < NATURE_FARM.species) out.push(`${n.species}/${NATURE_FARM.species} nouvelles espèces`);
	if (n.bushes < NATURE_FARM.bushes) out.push(`${n.bushes}/${NATURE_FARM.bushes} arbustes`);
	if (n.trees < NATURE_FARM.trees) out.push(`${n.trees}/${NATURE_FARM.trees} arbre`);
	return out.join(', ');
}
/** Une fois la nature installée, c'est la fête : un fermier peut venir vivre au jardin. */
function checkNature() {
	if (state.natureReady || !natureReady()) return;
	state.natureReady = Date.now();
	persist(true);
	sound.chime(3);
	whenFree(() => {
		showModal(`<h2>La nature s’est installée</h2>
		<p>Ton jardin vit tout seul : des espèces s’y sont installées, des arbustes ont poussé, un premier arbre aussi. Un fermier peut maintenant venir s’y installer avec sa cabane, puis cultiver un potager, élever des poules et poser des ruches.</p>
		<button class="btn primary" id="btn-farm">Voir la cabane</button>`);
		$('#btn-farm').onclick = () => { closeModal(); openDeco('recolte'); };
	});
}
setInterval(() => { if (!document.hidden) checkNature(); }, 5000);

/** La nature à attendre avant de construire cet objet, en clair, ou null. */
const natureLock = kind => (ITEMS[kind].nature && !natureReady() ? natureMissing() : null);

/** L'objet qu'il faut d'abord poser ici pour pouvoir construire celui-ci (le potager vient avec la cabane), ou null. */
function needsFirst(kind) {
	const need = ITEMS[kind].needs;
	return need && !garden.items.some(x => x.kind === need) ? need : null;
}

/** Combien d'exemplaires de cet objet sont posés, dans tous les lieux, et donc son prix du moment. */
const ownedCount = kind => Object.values(state.places).reduce((a, p) => a + (p.items ?? []).filter(i => i.kind === kind).length, 0);
const priceOf = kind => {
	const n = ownedCount(kind), base = itemCost(kind, n);
	if (!state.eco2) return base;
	if (isLadder(kind)) return ladderPrice(state, kind);
	if (kind === 'ruche') return n ? base * 2 : base;
	return Math.round((base * 3) / 5) * 5;
};

// ─── Le poulailler ───────────────────────────────────────────
const BIRD_COST = 40;
const coopSeats = it => ITEMS.poulailler.levels.seats[it.level ?? 1];
function coopTip(it, lv, nx) {
	const L = ITEMS.poulailler.levels, fl = it.flock ?? { hens: 3, roosters: 1 };
	const who = `${fl.hens} poule${fl.hens > 1 ? 's' : ''}${fl.roosters ? ` et ${fl.roosters} coq${fl.roosters > 1 ? 's' : ''}` : ''}`;
	return `<small class="item-tip">${L.name[lv][0].toUpperCase() + L.name[lv].slice(1)} · ${fl.hens + fl.roosters}/${coopSeats(it)} places · les poules pondent quand tu marches${fl.hens + fl.roosters < coopSeats(it) ? ` · une bête de plus : ${BIRD_COST} nectar` : ''}${nx && !nx.ok ? ` · ${L.seats[nx.level]} places dès ${nx.km} km` : ''}</small>`;
}
/** Poules et coqs sur une ligne : − nombre + (ajouter coûte un peu de nectar, tant qu'il reste de la place). */
function coopButtons(it) {
	const fl = it.flock ?? { hens: 3, roosters: 1 }, free = fl.hens + fl.roosters < coopSeats(it), poor = (state.nectar ?? 0) < BIRD_COST;
	const row = (key, label, min) => `<span class="coop-step"><b>${label}</b><button data-bird="${key}" data-add="0" ${fl[key] <= min ? 'disabled' : ''}>−</button><i>${fl[key]}</i><button data-bird="${key}" data-add="1" ${!free || poor ? 'disabled' : ''}>+</button></span>`;
	return `<div class="coop-row">${row('hens', 'Poules', 1)}${row('roosters', 'Coqs', 0)}</div>`;
}

/** Le prochain niveau d'un habitat posé : son prix, ou ce qui manque (kilomètres), ou null s'il est au plus haut. */
function nextLevel(it) {
	const lv = it.level ?? 1, own = ITEMS[it.kind].levels, km = state.totals.distance / 1000;
	// Le collecteur a ses trois niveaux de réserve.
	if (it.kind === 'collecteur') return lv >= 3 ? null : { level: lv + 1, cost: COLLECTOR_UPGRADE[lv + 1], km: 0, ok: true };
	// La cabane a ses propres niveaux (petite cabane, cabane à auvent, chalet).
	if (own) return lv >= own.max ? null : { level: lv + 1, cost: own.cost[lv + 1], km: own.km[lv + 1], ok: km >= own.km[lv + 1] };
	if (!canLevel(it.kind) || lv >= MAX_LEVEL) return null;
	// Nouvelle économie : chaque habitat de l'échelle grandit, de plus en plus cher, avec quelques kilomètres.
	if (state.eco2 && isLadder(it.kind)) return { level: lv + 1, cost: levelPrice(it.kind, lv + 1, state), km: LEVEL_KM2[lv + 1], ok: km >= LEVEL_KM2[lv + 1], gain: unitProd(state, it.kind) * (LEVEL_PROD[lv + 1] - LEVEL_PROD[lv]) * nearOf(state, it) * (1 + (it.syn ?? 0)) };
	// La ruche s'agrandit sans attendre de kilomètres : seulement de plus en plus cher.
	if (it.kind === 'ruche' && state.eco2) return { level: lv + 1, cost: levelCost(it.kind, lv + 1) * 2, km: 0, ok: true };
	return { level: lv + 1, cost: levelCost(it.kind, lv + 1), km: LEVEL_KM[lv + 1], ok: km >= LEVEL_KM[lv + 1] };
}

/** Améliore un habitat posé : il compte pour un abri de plus dans son équipe, et se garnit de fleurs. */
function levelUp(it) {
	const nx = nextLevel(it);
	if (!nx || !nx.ok || (state.nectar ?? 0) < nx.cost) return false;
	state.nectar -= nx.cost;
	it.level = nx.level;
	it.spent = (it.spent ?? 0) + nx.cost;
	garden.popItem(it, true);
	garden.nextPopulate = 0;
	if (it.kind === 'collecteur') {
		toast(`Collecteur niveau ${it.level} : il garde ${COLLECTOR_CAP[it.level]} nectar`, '#E3A33A');
		fillFromDew(it);
		sound.chime(2);
		renderHud();
		renderStatus();
		persist(true);
		return true;
	}
	const own = ITEMS[it.kind].levels;
	toast(it.kind === 'poulailler' ? `Ton poulailler s’agrandit : ${own.name[it.level]}, ${own.seats[it.level]} places !` : own ? `Ta cabane devient un${own.name[it.level] === 'chalet' ? '' : 'e'} ${own.name[it.level]} !` : `${ITEMS[it.kind].name} : niveau ${it.level}, ${LEVEL_NAME[it.level]}`, '#5F933E');
	sound.chime(3);
	renderHud();
	persist(true);
	return true;
}

let decoTab = 'habitat';

function renderDeco() {
	const km = state.totals.distance / 1000;
	const nectar = state.nectar ?? 0;
	const here_ = garden.items;
	const cat = CATS.find(c => c.id === decoTab), biome = garden.biomeOf(garden.active);
	// Pendant l'introduction, seulement la ruche, tout en haut ; le reste est grisé (il viendra plus tard).
	const first = !!state.intro;
	const order = first ? ['ruche', ...ITEM_ORDER.filter(k => k !== 'ruche' && ITEMS[k].cat === 'habitat')] : ITEM_ORDER.filter(k => ITEMS[k].cat === decoTab && fitsPlace(k, biome) && !(state.eco2 && k === 'collecteur'));
	$('#deco').innerHTML = `
		<div class="panel-head"><h2>Aménager</h2><button class="close" data-close-deco aria-label="Fermer">×</button></div>
		${first ? '' : `<div class="deco-tabs" role="tablist">${CATS.map(c => `<button role="tab" aria-selected="${c.id === decoTab}" data-tab="${c.id}">${c.name}</button>`).join('')}</div>`}
		<p class="sp-intro">${first ? 'Ta première ruche : tes abeilles y vivront et y feront leur miel. Le reste viendra plus tard.' : `${cat.intro} Tout se paie en nectar, et se range quand tu veux (le nectar t'est rendu).${biome !== 'prairie' ? ` Ici, seulement ce qui a sa place ${PLACE_IN[biome]}.` : ''}`}</p>
		<div class="deco-list">${order.map(k => {
			const later = first && k !== 'ruche';
			const ladder = state.eco2 && isLadder(k), lad = ladder ? ladderLock(state, k) : null;
			const it = ITEMS[k], cost = priceOf(k), need = needsFirst(k), wild = natureLock(k), locked = later || !!lad || (!ladder && km < it.km) || !!need || !!wild, poor = nectar < cost;
			const mine = here_.filter(x => x.kind === k), n = mine.length;
			// L'habitat le moins avancé d'ici, qu'on peut améliorer depuis la liste.
			const low = mine.filter(x => nextLevel(x)).sort((a, b) => (a.level ?? 1) - (b.level ?? 1))[0], nx = low && nextLevel(low);
			const up = nx ? nx.ok ? `<button class="btn primary small" data-level="${k}" ${nectar < nx.cost ? 'disabled' : ''}>${nx.gain ? `Faire grandir (niveau ${nx.level}) : +${fmtInt(nx.gain * KM_VALUE_H)} par km` : 'Améliorer'} · ${fmtInt(nx.cost)}</button>` : `<span class="deco-lock">niveau ${nx.level} dès ${nx.km} km</span>` : '';
			const action = later ? '<span class="deco-lock">plus tard</span>'
				: lad ? `<span class="deco-lock">${lad}</span>`
				: !ladder && km < it.km ? `<span class="deco-lock">dès ${it.km} km parcourus</span>`
				: wild ? `<span class="deco-lock">quand la nature sera installée : ${wild}</span>`
				: need ? `<span class="deco-lock">après avoir posé ${ITEMS[need].name.toLowerCase()}</span>`
				: `<button class="btn ${n && canLevel(k) ? 'ghost' : 'primary'} small" data-buy="${k}" ${poor ? 'disabled' : ''}>${poor ? `il manque ${fmtInt(cost - nectar)}` : n ? 'Un de plus' : 'Installer'}</button>`;
			const levels = ladder ? (n ? `<small>${n} ici</small>` : '') : n && (canLevel(k) || k === 'collecteur') ? `<small>${mine.map(x => `niv. ${x.level ?? 1}`).join(' · ')}</small>` : n ? `<small>${n} ici</small>` : '';
			// L'échelle des habitats : ce que chacun rapporte pendant l'élan, et son amélioration (production × 2).
			const up2 = ladder && !later ? nextUpgrade(state, k) : null;
			const prodLine = ladder && !later ? `<span class="deco-help">Chacun rapporte ${fmtNum(unitProd(state, k))} nectar par heure d’élan, environ ${fmtInt(unitProd(state, k) * KM_VALUE_H)} par km marché · ${PER_PARCEL[k]} par parcelle au plus${n ? ` · ${n} posé${n > 1 ? 's' : ''}` : ''}</span>` : '';
			const upgBtn = up2 ? (up2.ok ? `<button class="btn primary small" data-upg="${k}" ${nectar < up2.cost ? 'disabled' : ''}>Amélioration ${up2.level} : +${fmtInt(levelsOf(state, k) * unitProd(state, k) * KM_VALUE_H)} par km · ${fmtInt(up2.cost)}</button>` : `<span class="deco-lock">amélioration ${up2.level} (× 2) dès ${up2.need} posés${up2.need > PER_PARCEL[k] ? ` (${Math.round(up2.need / PER_PARCEL[k])} parcelles pleines)` : ''}</span>`) : '';
			return `<div class="deco-card${locked ? ' locked' : ''}"><div class="deco-art" data-art="${k}"></div>
				<div class="deco-body"><h3>${it.name}</h3><p>${it.text}</p>${!ladder && itemHelp(k, state.eco2) ? `<span class="deco-help">${itemHelp(k, state.eco2)}</span>` : ''}
				${ladder && birdHelp(k) ? `<span class="deco-help">${birdHelp(k)}</span>` : ''}${prodLine}<div class="deco-row"><span class="nectar">${fmtInt(cost)}</span>${levels}${action}</div>${up ? `<div class="deco-row deco-up">${up}</div>` : ''}${upgBtn && n ? `<div class="deco-row deco-up">${upgBtn}</div>` : ''}</div></div>`;
		}).join('')}</div>`;
	for (const el of $('#deco').querySelectorAll('[data-art]')) {
		const sp = garden.itemSprite(el.dataset.art, 315), c = document.createElement('canvas');
		c.width = sp.canvas.width; c.height = sp.canvas.height;
		c.getContext('2d').drawImage(sp.canvas, 0, 0);
		el.appendChild(c);
	}
}

function openDeco(tab) {
	if (typeof tab === 'string') decoTab = tab;
	renderDeco();
	$('#deco').classList.add('open');
	$('#deco').setAttribute('aria-hidden', 'false');
}
function closeDeco() {
	$('#deco').classList.remove('open');
	$('#deco').setAttribute('aria-hidden', 'true');
}

/**
 * Choisir la place d'un objet : on le fait glisser avec le doigt (la vue ne bouge pas, sauf près du bord),
 * ou on touche l'endroit voulu. Lâché sur une place prise, il file vers la place libre la plus proche.
 */
function startPlacing(kind, item = null) {
	closeDeco();
	placing = { kind, item };
	garden.lifted = item;
	const [cx, cy] = item ? [item.x, item.y] : garden.toWorld(garden.canvas.clientWidth / 2, garden.canvas.clientHeight * 0.45);
	garden.ghost = { kind, x: cx, y: cy, rot: item?.rot ?? 0, level: item?.level };
	$('#btn-place-turn').hidden = !ITEMS[kind].turn;
	snapPlacing();
	$('#placing-name').textContent = item ? `Déplacer : ${ITEMS[kind].name.toLowerCase()}` : ITEMS[kind].name;
	$('#app').classList.add('placing');
	$('#placing').hidden = false;
	renderPlacing();
}

/** Ramène l'objet sur la place libre la plus proche, s'il en existe une. */
function snapPlacing() {
	const g = garden.ghost;
	introLeash(g);
	const spot = garden.nearestPlace(g.kind, g.x, g.y, placing.item);
	if (spot) [g.x, g.y] = spot;
	introLeash(g);
}

/** Dans l'introduction, la ruche reste près du coquelicot : la fleur, l'abeille et la ruche tiennent dans le même cadre. */
const INTRO_LEASH = 110;
function introLeash(g) {
	if (!state.intro) return;
	const f = here().plants.find(p => p.intro);
	if (!f) return;
	const [ox, oy] = garden.cellOriginOf(f), fx = ox + f.x, fy = oy + f.y;
	const dx = g.x - fx, dy = g.y - fy, d = Math.hypot(dx, dy);
	if (d > INTRO_LEASH) { g.x = fx + dx / d * INTRO_LEASH; g.y = fy + dy / d * INTRO_LEASH; }
}

/** Combien d'exemplaires de cet habitat sont posés dans la parcelle `ci` (sans compter `except`). */
const inCell = (kind, ci, except = null) => garden.items.filter(it => it.kind === kind && it !== except && garden.cellAt(it.x, it.y) === ci).length;
/** Nouvelle économie : une parcelle accueille au plus PER_PARCEL exemplaires de chaque habitat de l'échelle. */
garden.placeLimit = (kind, ci, except) => !state.eco2 || !PER_PARCEL[kind] || ci < 0 || inCell(kind, ci, except) < PER_PARCEL[kind];

function renderPlacing() {
	const ok = garden.canPlace(placing.kind, garden.ghost.x, garden.ghost.y, placing.item);
	const ci = garden.cellAt(garden.ghost.x, garden.ghost.y), full = !garden.placeLimit(placing.kind, ci, placing.item);
	const ni = state.eco2 && isLadder(placing.kind) ? garden.nearInfo(placing.kind, garden.ghost.x, garden.ghost.y, placing.item) : null;
	$('#placing-hint').textContent = ok && ni ? `Ici : ${Math.round(nearOf(state, { near: ni.near }) * 100)} %${ni.syn ? ` +${Math.round(ni.syn * 100)} %` : ''} · ${nearWhat(placing.kind, ni.counts)}. Cherche le coin le plus fleuri.`
		: ok ? 'Fais-le glisser avec le doigt, puis pose-le.'
		: full ? `Cette parcelle a déjà ses ${PER_PARCEL[placing.kind]} ${ITEMS[placing.kind].name.replace(/^(Un|Une) /, '').toLowerCase()}${PER_PARCEL[placing.kind] > 1 ? 's' : ''} : pose-le dans une autre parcelle.`
		: 'Place prise : lâche-le, il trouvera une place libre à côté.';
	$('#btn-place').disabled = !ok;
}

function movePlacing(hit) {
	if (!hit) return;
	const [wx, wy] = garden.toWorld(hit.x, hit.y);
	Object.assign(garden.ghost, { x: wx, y: wy });
	snapPlacing();
	renderPlacing();
}

garden.onGhostMove = () => placing && renderPlacing();
garden.onGhostDrop = () => { if (!placing) return; snapPlacing(); renderPlacing(); };
garden.onLongPress = hit => {
	if (placing || !$('#modal').hidden) return false;
	clearTimeout(cardTimer);
	$('#plant-card').hidden = true;
	startPlacing(hit.item.kind, hit.item);
	return true;
};

/** Replanter un arbre ou un arbuste adulte : on le fait glisser comme un objet, puis on le pose. */
function startMovingPlant(p) {
	closeDeco();
	placing = { kind: 'plant', item: p };
	garden.lifted = p;
	const [ox, oy] = garden.cellOriginOf(p);
	garden.ghost = { kind: 'plant', plant: p, x: ox + p.x, y: oy + p.y, rot: 0 };
	$('#btn-place-turn').hidden = true;
	$('#placing-name').textContent = `Déplacer : ${plantName(p).toLowerCase()}`;
	$('#app').classList.add('placing');
	$('#placing').hidden = false;
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
	const { kind, item } = placing, { x, y, rot } = garden.ghost;
	if (!garden.canPlace(kind, x, y, item)) return;
	if (kind === 'plant') {
		garden.replant(item, x, y);
		toast(`${plantName(item)} : replanté ici`, '#5F933E');
		sound.chime(1);
		endPlacing();
		persist(true);
		return;
	}
	if (item) {
		item.x = Math.round(x); item.y = Math.round(y); item.rot = rot;
		garden.clearUnder(item);
		garden.popItem(item);
	} else {
		const cost = priceOf(kind);
		if ((state.nectar ?? 0) < cost) { toast('Pas assez de nectar', '#C0442F'); return endPlacing(); }
		state.nectar -= cost;
		const placed = garden.placeItem(kind, x, y, rot);
		placed.paid = cost;
		if (kind === 'collecteur') fillFromDew(placed);
		bringAttracted(kind);
		const help = state.eco2 && ITEMS[kind].birds ? `${ITEMS[kind].birds === 2 ? 'un couple de mésanges s’installe' : 'un oiseau vient s’y nourrir'} : ils sèmeront arbustes et arbres`
			: state.eco2 && isLadder(kind) ? `+${fmtInt(unitProd(state, kind) * KM_VALUE_H)} nectar par km marché` : itemHelp(kind, state.eco2);
		toast(`${ITEMS[kind].name} : installé${/^Une /.test(ITEMS[kind].name) ? 'e' : /^Des /.test(ITEMS[kind].name) ? 's' : ''}${help ? ` · ${help}` : ''}`, '#9A7448');
		if (kind === 'cabane' && garden.items.filter(x => x.kind === 'cabane').length === 1) {
			setTimeout(() => chooseFarmer(() => choosePet(() => toast(`${farmerName(true)} s’installe : construis-lui un potager`, '#5F933E', () => openDeco('recolte')))), 1400);
		} else if (kind === 'cabane') {
			// Toujours un seul jardinier : il ajoute cette cabane à sa tournée.
			setTimeout(() => toast(`${farmerName(true)} fera aussi la tournée de cette cabane et de ses potagers`, '#5F933E'), 1400);
		}
	}
	sound.chime(2);
	endPlacing();
	updateNear();
	renderHud();
	persist(true);
});
$('#btn-place-cancel').addEventListener('click', endPlacing);
$('#btn-place-turn').addEventListener('click', () => {
	if (!placing) return;
	// Trois vues : de face, de 3/4 droite, de 3/4 gauche (haies et murets : par pas de 45°, pour se raccorder).
	const r0 = garden.ghost.rot ?? 0, k = garden.ghost.kind;
	garden.ghost.rot = LINK_KINDS.has(k) ? (r0 + 45) % 360 : TURN_VIEWS[(TURN_VIEWS.indexOf(snapRot(k, r0)) + 1) % TURN_VIEWS.length];
	renderPlacing();
});

/**
 * L'effet miniature (flou du haut et du bas, vignettage) : coupé d'office si le téléphone ne sait pas flouter
 * derrière un calque, ou s'il peine avec (moins de 40 images par seconde quelques secondes après le lancement).
 * Un choix fait dans les options l'emporte toujours.
 */
const canBlur = typeof CSS !== 'undefined' && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'));
const fxOn = () => state.fx ?? (canBlur && !state.fxSlow);
function probeFx() {
	if (state.fx != null || state.fxSlow || !fxOn()) return;
	const samples = [];
	const look = () => {
		// Seulement appli au premier plan, jardin seul à l'écran, sans la limite à 30 images par seconde.
		if (document.hidden || garden.maxFps || document.querySelector('.panel.open')) return setTimeout(look, 3000);
		samples.push(garden.fps ?? 60);
		if (samples.length < 4) return setTimeout(look, 1500);
		const fps = samples.reduce((a, b) => a + b, 0) / samples.length;
		if (fps >= 40) return;
		state.fxSlow = true;
		$('#app').classList.add('no-fx');
		persist(true);
	};
	setTimeout(look, 12000);
}

/** Un collecteur a de la place : les gouttes qui attendaient sur les fleurs filent s'y ranger. */
function fillFromDew(it) {
	const before = groundOf(state), moved = drainGround(state, state.place);
	if (moved < 1) return;
	setTimeout(() => garden.dewToJar(it, moved / before), 700);
	renderHud();
}

/** Assis sur le banc : la vue se pose tout près, les boutons s'effacent, et les bêtes alentour chantent plus souvent. */
function sitOnBench(it) {
	garden.flyTo(it.x, it.y - 40, 1.6);
	if (!peekLock) $('#btn-peek').click();
	sound.listen(40);
	toast('Assis sur le banc : écoute ton jardin', '#5F933E');
}

function tapItem(hit, card) {
	const it = hit.item, def = ITEMS[it.kind];
	// Un collecteur vide avec des gouttes qui attendent sur les fleurs : elles viennent s'y ranger.
	if (it.kind === 'collecteur' && stockOf(state, it) < 1) fillFromDew(it);
	// Un collecteur plein (même un peu) se vide d'un seul geste.
	if (it.kind === 'collecteur' && stockOf(state, it) >= 1) {
		state.collectedJar = true;
		jackpot(collect(emptyJar(state, it), false, true), it.x, it.y - 40);
		fillFromDew(it);
		return;
	}
	const lv = it.level ?? 1, nx = nextLevel(it);
	const up = it.kind === 'collecteur' && lv < 3 ? COLLECTOR_UPGRADE[lv + 1] : nx?.ok ? nx.cost : 0;
	const info = it.kind === 'collecteur' ? `<small class="item-tip">Niveau ${lv} · garde ${COLLECTOR_CAP[lv]} nectar${up ? ` (niveau ${lv + 1} : ${COLLECTOR_CAP[lv + 1]})` : ''}. Réserve totale : ${fmtInt(nectarCapacity(state))}.</small>`
		: it.kind === 'poulailler' ? coopTip(it, lv, nx)
		: def.levels ? `<small class="item-tip">${def.levels.name[lv][0].toUpperCase() + def.levels.name[lv].slice(1)}, ${CABIN_STYLES[(it.style ?? 0) % CABIN_STYLES.length].name}. ${farmerName(true)} y vit.${nx ? nx.ok ? ` Agrandis-la en ${def.levels.name[nx.level]}.` : ` ${def.levels.name[nx.level][0].toUpperCase() + def.levels.name[nx.level].slice(1)} dès ${nx.km} km parcourus.` : ''}</small>`
		: state.eco2 && isLadder(it.kind) ? `<small class="item-tip">Niveau ${lv} sur ${MAX_LEVEL}, ${LEVEL_NAME[lv]} : il produit ${fmtInt(itemProd(state, it))} nectar par heure d’élan. ${nearLine(it)}${nx ? nx.ok ? ` Niveau ${nx.level} (${LEVEL_NAME[nx.level]}) : +${fmtInt(nx.gain * KM_VALUE_H)} par km marché.` : ` Niveau ${nx.level} dès ${nx.km} km parcourus.` : ' Il est au plus haut.'}</small>`
		: it.kind === 'ruche' && state.eco2 ? `<small class="item-tip">Niveau ${lv} : ${HIVE_SEATS * lv} abeilles.${nx ? ` Au niveau ${nx.level} : ${HIVE_SEATS * nx.level}.` : ''}</small>`
		: canLevel(it.kind) ? `<small class="item-tip">Niveau ${lv} sur ${MAX_LEVEL}, ${LEVEL_NAME[lv]} : il fait venir ${lv * def.power} ${def.power * lv > 1 ? 'membres' : 'membre'}.${nx ? nx.ok ? ` Au niveau ${nx.level}, un de plus${def.power > 1 ? ` (${def.power})` : ''}.` : ` Niveau ${nx.level} dès ${nx.km} km parcourus.` : ''}</small>` : '';
	// Une bulle courte : la première phrase de la description (le reste est dans Aménager), l'astuce de l'appui long
	// seulement les trois premières fois.
	// Le poulailler, la cabane et le collecteur montrent surtout leur état : pas besoin de les redécrire.
	const short = ['poulailler', 'cabane', 'collecteur'].includes(it.kind) ? '' : def.text.split(/(?<=[.!?…])\s/)[0];
	const tip = (state.longPressTips ?? 0) < 3 ? (state.longPressTips = (state.longPressTips ?? 0) + 1, '<small class="item-tip">Astuce : un appui long dessus le soulève directement.</small>') : '';
	// La ferme : le panier à la cabane, la part de miel prise aux ruches, le compost à épandre.
	const share = Math.round((state.honeyShare ?? 0.3) * 100), fill = it.kind === 'compost' ? compostFill(it) : 0;
	const farm = it.kind === 'cabane' && ITEMS.cabane ? `<div class="item-actions"><button class="btn primary" data-market>Le panier${basketCount() ? ` (${fmtInt(basketCount())})` : ''}</button></div>`
		: it.kind === 'ruche' ? `<small class="item-tip">${hiveBees()} abeille${hiveBees() > 1 ? 's' : ''} au travail · tes ruches en accueillent ${hiveCap()}. Elles travaillent surtout quand tu bouges. Les fleurs attirent les abeilles ; pour en accueillir plus, améliore la ruche ou poses-en une autre. Prochain pot de miel : ${Math.floor(((state.honeyAcc ?? 0) % 1) * 100)} %.</small><div class="item-actions"><button class="btn primary" data-market>Le panier${basketCount() ? ` (${fmtInt(basketCount())})` : ''}</button></div><div class="coop-row"><span>Miel récolté <small>le reste nourrit la colonie</small></span><span class="coop-step"><button class="btn ghost small" data-share="-1" ${share <= 0 ? 'disabled' : ''}>−</button><b>${share} %</b><button class="btn ghost small" data-share="1" ${share >= 60 ? 'disabled' : ''}>+</button></span></div>`
		: it.kind === 'compost' ? `<small class="item-tip">${fill >= 1 ? 'Plein : épands-le sur le potager, ses prochaines récoltes donneront plus.' : `Rempli à ${Math.round(fill * 100)} % (il se remplit quand tu marches).`}</small>${fill >= 1 ? '<div class="item-actions"><button class="btn primary" data-spread>Épandre sur le potager</button></div>' : ''}`
		: '';
	card.innerHTML = `<b>${def.name}</b>${short}${info}${tip}
		${it.kind === 'poulailler' ? coopButtons(it) : ''}${farm}<div class="item-actions">${up ? `<button class="btn primary" data-upgrade ${(state.nectar ?? 0) < up ? 'disabled' : ''}>${def.levels ? 'Agrandir' : state.eco2 && isLadder(it.kind) ? 'Faire grandir' : 'Améliorer'} (${fmtInt(up)})</button>` : ''}${it.kind === 'cabane' ? '<button class="btn ghost" data-style>Couleur</button><button class="btn ghost" data-farmer-swap>' + (state.gardener === 'fermiere' ? 'Un fermier' : 'Une fermière') + '</button><button class="btn ghost" data-pet-swap>' + (state.pet === 'chien' ? 'Un chat' : state.pet === 'chat' ? 'Sans animal' : 'Un chien') + '</button>' : ''}${it.kind === 'banc' ? '<button class="btn primary" data-sit>S’asseoir</button>' : ''}${def.turn ? '<button class="btn ghost" data-turn>Tourner</button>' : ''}<button class="btn ghost" data-move>Déplacer</button><button class="btn ghost" data-store>Ranger (+${fmtInt((it.paid ?? def.cost) + (it.spent ?? 0))})</button></div>`;
	card.classList.remove('link');
	card.classList.add('actions');
	card.onclick = e => {
		if (e.target.closest('[data-market]')) { card.hidden = true; openMarket(); return; }
		const sh = e.target.closest('[data-share]');
		if (sh) {
			state.honeyShare = Math.max(0, Math.min(0.6, Math.round(((state.honeyShare ?? 0.3) + Number(sh.dataset.share) * 0.1) * 10) / 10));
			persist(true);
			tapItem(hit, card);
			return;
		}
		if (e.target.closest('[data-spread]')) {
			if (!garden.items.some(x => x.kind === 'potager')) { toast('Pose d’abord un carré de potager, près de la cabane', '#9A7448'); return; }
			it.km0 = state.totals.distance / 1000;
			state.compostBoost = (state.compostBoost ?? 0) + 3;
			persist(true);
			sound.chime(2);
			card.hidden = true;
			toast('Compost épandu : les 3 prochaines récoltes du potager donneront 6 légumes au lieu de 4', '#5F933E');
			return;
		}
		if (e.target.closest('[data-turn]')) {
			it.rot = LINK_KINDS.has(it.kind) ? ((it.rot ?? 0) + 45) % 360 : TURN_VIEWS[(TURN_VIEWS.indexOf(snapRot(it.kind, it.rot ?? 0)) + 1) % TURN_VIEWS.length];
			garden.popItem(it);
			persist(true);
			clearTimeout(cardTimer);
			cardTimer = setTimeout(() => { card.hidden = true; }, 6000);
			return;
		}
		if (e.target.closest('[data-style]')) {
			it.style = ((it.style ?? 0) + 1) % CABIN_STYLES.length;
			garden.popItem(it);
			persist(true);
			tapItem(hit, card);
			return;
		}
		if (e.target.closest('[data-pet-swap]')) {
			state.pet = state.pet === 'chien' ? 'chat' : state.pet === 'chat' ? null : 'chien';
			persist(true);
			toast(state.pet ? `${PETS[state.pet]} s’installe à la cabane` : 'Plus d’animal à la cabane', '#5F933E');
			card.hidden = true;
			return;
		}
		if (e.target.closest('[data-farmer-swap]')) {
			state.gardener = state.gardener === 'fermiere' ? 'fermier' : 'fermiere';
			persist(true);
			toast(`${farmerName(true)} s’installe dans la cabane`, '#5F933E');
			card.hidden = true;
			return;
		}
		const bird = e.target.closest('[data-bird]');
		if (bird) {
			// Une poule ou un coq de plus (s'il reste une place), ou un de moins.
			const fl = (it.flock ??= { hens: 3, roosters: 1 }), key = bird.dataset.bird, add = bird.dataset.add === '1';
			if (add && (state.nectar ?? 0) >= BIRD_COST && fl.hens + fl.roosters < coopSeats(it)) { state.nectar -= BIRD_COST; it.spent = (it.spent ?? 0) + BIRD_COST; fl[key]++; }
			else if (!add && fl[key] > 0) fl[key]--;
			renderHud();
			persist(true);
			// La bulle reste ouverte, mise à jour : on peut ajouter plusieurs poules d'affilée.
			tapItem(hit, card);
			return;
		}
		if (e.target.closest('[data-upgrade]') && up && it.kind !== 'collecteur') { card.hidden = true; levelUp(it); return; }
		if (e.target.closest('[data-upgrade]') && up && (state.nectar ?? 0) >= up) {
			state.nectar -= up;
			it.level = lv + 1;
			garden.popItem(it);
			card.hidden = true;
			toast(`Collecteur niveau ${it.level} : il garde ${COLLECTOR_CAP[it.level]} nectar`, '#E3A33A');
			fillFromDew(it);
			sound.chime(2);
			renderHud();
			renderStatus();
			persist(true);
			return;
		}
		if (e.target.closest('[data-sit]')) { card.hidden = true; sitOnBench(it); return; }
		if (e.target.closest('[data-move]')) { card.hidden = true; startPlacing(it.kind, it); }
		if (e.target.closest('[data-store]')) {
			card.hidden = true;
			// Un collecteur rangé : ce qu'il gardait revient tout de suite à la bourse.
			if (it.kind === 'collecteur') state.nectar = (state.nectar ?? 0) + emptyJar(state, it);
			garden.items.splice(garden.items.indexOf(it), 1);
			const back = (it.paid ?? def.cost) + (it.spent ?? 0);
			state.nectar = (state.nectar ?? 0) + back;
			garden.nextPopulate = 0;
			toast(`${def.name} rangé${/^Une /.test(def.name) ? 'e' : /^Des /.test(def.name) ? 's' : ''} : +${fmtInt(back)} nectar`, '#9A7448');
			renderHud();
			persist(true);
		}
	};
	placeCard(card, hit, 6000);
}

$('#deco').addEventListener('click', e => {
	if (e.target.closest('[data-close-deco]')) return closeDeco();
	const t = e.target.closest('[data-tab]');
	if (t) { decoTab = t.dataset.tab; return renderDeco(); }
	const l = e.target.closest('[data-level]');
	if (l && !l.disabled) {
		const low = garden.items.filter(x => x.kind === l.dataset.level && nextLevel(x)).sort((a, b) => (a.level ?? 1) - (b.level ?? 1))[0];
		if (low && levelUp(low)) renderDeco();
		return;
	}
	const g = e.target.closest('[data-upg]');
	if (g && !g.disabled) {
		const kind = g.dataset.upg, up = nextUpgrade(state, kind);
		if (!up?.ok || (state.nectar ?? 0) < up.cost) return;
		state.nectar -= up.cost;
		(state.upg ??= {})[kind] = up.level;
		sound.chime(3);
		toast(`${ITEMS[kind].name} : production × 2 (+${fmtInt(levelsOf(state, kind) * unitProd(state, kind) / 2 * KM_VALUE_H)} nectar par km marché)`, '#5F933E');
		persist(true);
		renderHud();
		return renderDeco();
	}
	const b = e.target.closest('[data-buy]');
	if (b && !b.disabled) startPlacing(b.dataset.buy);
});
// Pendant la mission du collecteur, Aménager s'ouvre directement sur l'onglet Récolte.
$('#track-alert').addEventListener('click', async () => { sky.locate(true); await enableTracking(true); renderStatus(); });
$('#btn-deco').addEventListener('click', () => openDeco(state.intro ? 'habitat' : currentMission()?.id === 'collector' ? 'recolte' : undefined));

// ─── Le moment (soleil, pluie, nuit, hiver) : un bonus chacun, un badge dans le bandeau ───
/** Le réglage « Ciel du jardin » : réel, toujours de jour, ou toujours beau (sans bonus du temps). */
function applySkyMode() {
	if (state.intro) return;
	const m = state.skyMode ?? 'real';
	garden.hourOverride = m === 'real' ? (params.has('h') ? parseFloat(params.get('h')) : null) : 13;
	if (m === 'beau') { sky.override = 'clear'; sky.apply(false); }
	else if (sky.override === 'clear' && m === 'real' && !params.has('weather')) { sky.override = null; sky.apply(false); }
	garden.nextPopulate = 0;
	updateMoment();
}
const MOMENT_OF = { nuit: 'de nuit', pluie: 'sous la pluie', hiver: 'd’hiver', soleil: 'au soleil', jour: 'rare' };
/** Le moment du jardin, pour l'économie (state.moment) et le badge. Un ciel fixé (Options) n'a pas de bonus. */
function updateMoment() {
	const m = state.skyMode && state.skyMode !== 'real' ? 'jour' : garden.moment();
	state.moment = m;
	// Un moment se présente : son défi du jour apparaît (une fois par jour), et on le dit.
	if (state.eco2 && !state.intro && m !== 'jour' && addMomentChallenge(state, m)) {
		renderDaily(); persist();
		toast(`Défi ${MOMENT_OF[m]} : ${{ pluie: 'marche 1 km', soleil: 'marche 1,5 km', nuit: 'trouve un animal de nuit', hiver: 'marche 1 km' }[m]}`, '#F08A3C', () => showDaily());
	}
	const chip = $('#sky-chip');
	if (!chip) return;
	chip.hidden = !state.eco2 || !!state.intro;
	const M = MOMENTS[m];
	chip.dataset.m = m;
	chip.textContent = M.icon;
	chip.title = `${M.name} : ${M.what}`;
}
$('#sky-chip')?.addEventListener('click', e => { e.stopPropagation(); const M = MOMENTS[state.moment ?? 'jour']; toast(`${M.name} : ${M.what}`, '#5F933E'); });
setInterval(updateMoment, 15000);

// ─── L'agencement et les familles d'espèces : ce que le joueur voit ───
const PLANT_WORD = { herbe: ['herbe', 'herbes'], fleur: ['fleur', 'fleurs'], buisson: ['arbuste', 'arbustes'], arbre: ['arbre', 'arbres'] };
/** « 4 fleurs, 1 arbuste » : ce qui compte pour cet habitat, autour de lui. */
function nearWhat(kind, counts) {
	const parts = Object.keys(NEAR_USE[kind]).filter(t => NEAR_USE[kind][t] >= 1 || counts[t]).map(t => `${counts[t] ?? 0} ${PLANT_WORD[t][(counts[t] ?? 0) > 1 ? 1 : 0]}`);
	return parts.join(', ');
}
/** Ce qu'un habitat veut autour de lui, en clair. */
const NEAR_WANT = { massif: 'des fleurs et des arbustes', ruche: 'des fleurs et des arbustes, et des massifs', hotel: 'des fleurs et des arbustes, et des massifs', nichoir: 'des arbustes et des arbres', mare: 'des herbes, des fleurs et des arbustes', haie: 'des arbustes et des arbres' };
/** La ligne « voisinage » de la fiche d'un habitat posé. */
function nearLine(it) {
	const ni = garden.nearInfo(it.kind, it.x, it.y, it);
	if (!ni) return '';
	const pct = Math.round(nearOf(state, { near: ni.near }) * 100);
	return `Voisinage : ${pct} % (${nearWhat(it.kind, ni.counts)})${ni.massifs ? `, massifs +${Math.round(ni.syn * 100)} %` : ''}. ${pct < 100 ? `Il lui faut ${NEAR_WANT[it.kind]} autour. ` : ''}`;
}

/** Les quatre familles d'espèces, ce qu'elles font, et pour combien (nouvelle économie). */
const GUILD_TEXT = {
	pollinisateur: { name: 'Pollinisateur', plural: 'Pollinisateurs', what: n => `+${Math.round(GUILD_BONUS * 100 * n)} % aux ruches, massifs et hôtels`, one: 'ruches, massifs et hôtels +5 %' },
	semeur: { name: 'Semeur', plural: 'Semeurs', what: n => `les oiseaux sèment ${n >= 2 ? 'plus souvent ' : ''}arbustes et arbres`, one: 'sème arbustes et arbres' },
	sol: { name: 'Vie du sol', plural: 'Vie du sol', what: n => `+${Math.round(GUILD_BONUS * 100 * n)} % de plantes à chaque pas`, one: '+5 % de plantes à chaque pas' },
	regulateur: { name: 'Prédateur utile', plural: 'Prédateurs utiles', what: n => `+${Math.round(GUILD_BONUS * 100 * n)} % au voisinage des habitats`, one: 'protège tes plantes : voisinage +5 %' },
};
const guildOfSp = id => Object.keys(GUILD_TEXT).find(g => (GUILDS[g]?.members ?? []).includes(id));

/**
 * Un habitat qui attire une espèce (la mangeoire, le merle ; le nichoir, la mésange…) la fait venir dès sa pose : on
 * voit tout de suite ce que l'achat apporte, et sa fiche attend d'être lue.
 */
function bringAttracted(kind, quiet = false) {
	for (const id of [].concat(ITEMS[kind]?.attracts ?? [])) {
		const sp = SPECIES_BY_ID[id];
		if (!sp || state.species[id]) continue;
		state.species[id] = Date.now();
		updateSpeciesDot();
		if (!quiet) setTimeout(() => revealSpecies(sp, `Venu grâce à ${ITEMS[kind].name.toLowerCase()}`), 1200);
	}
	garden.nextPopulate = 0;
}

/** Des fleurs prêtes à donner un arbuste (ou des arbustes un arbre), mais aucun oiseau pour le semer : on le dit. */
function noBirdsNote(type) {
	if (state.sim || state.noBirdsDay === dayKey()) return;
	state.noBirdsDay = dayKey();
	toast(`Sans oiseaux, pas de nouvel ${type === 'arbre' ? 'arbre' : 'arbuste'} : pose une mangeoire ou un nichoir`, '#E3A33A', () => openDeco('habitat'));
}

// ─── Mode test : un joueur simulé, jour après jour ────────────
// Trois profils de sportif. Chaque jour simulé joue la sortie avec les vraies règles (effort, plantes qui poussent,
// nectar, valeur du km, élan), puis la production de la journée (élan, puis 5 % au repos), les espèces du jour (fiches
// lues), l'objectif du jour, et des achats faits comme un joueur : terrain, parcelles, habitats posés dans le jardin,
// améliorations. On voit ainsi le jardin tel qu'il serait à la fin du jour 1, 2, 3… Dans une partie à part.
const SIM_PROFILES = {
	sedentaire: { name: 'Sédentaire', text: 'moins d’1 km, un jour sur deux', km: [0.2, 1], kmh: 3.8, p: 0.45 },
	occasionnel: { name: 'Marcheur occasionnel', text: '1 à 2,5 km, 6 jours sur 10', km: [1, 2.5], kmh: 4.5, p: 0.6 },
	regulier: { name: 'Marcheur régulier', text: '2,5 à 4,5 km, presque tous les jours', km: [2.5, 4.5], kmh: 5, p: 0.85 },
	rapide: { name: 'Marcheur rapide', text: '3 à 6 km à 6 km/h, presque tous les jours', km: [3, 6], kmh: 6, p: 0.85 },
	coureur: { name: 'Coureur', text: '5 à 10 km de course, 6 jours sur 10', km: [5, 10], kmh: 10, p: 0.6, other: [0.5, 1.5] },
	grand: { name: 'Grand sportif', text: '10 à 20 km de course, presque tous les jours', km: [10, 20], kmh: 10, p: 0.9, other: [1, 3] },
};
const SIM_ORDER = ['off', ...Object.keys(SIM_PROFILES)];
// Les parties de test de la 0.7.55 avaient trois profils : ils prennent leur équivalent.
if (state.sim && !SIM_PROFILES[state.sim.profile]) state.sim.profile = { calme: 'occasionnel', marcheur: 'regulier', sportif: 'coureur' }[state.sim.profile] ?? 'regulier';
const simRnd = (a, b) => a + Math.random() * (b - a);
const simName = k => ITEMS[k].name.replace(/^(Un|Une|Des) /, '').toLowerCase();

/** Commence une partie de test pour un profil : elle démarre juste après l'introduction (coquelicot, abeille, ruche). */
function startSimGame(id, fresh = false) {
	save(state);
	const name = `Test · ${SIM_PROFILES[id].name}`, list = slots().list;
	// On retient la vraie partie, pour y revenir en choisissant « Désactivé ».
	if (!state.sim) try { localStorage.setItem('evolia.simReturn', slots().active); } catch (e) { /* idem */ }
	let slot = !fresh && list.find(x => x.name === name)?.id;
	if (fresh) for (const x of list.filter(x => x.name === name && x.id !== slots().active)) deleteSlot(x.id);
	if (!slot) {
		slot = createSlot(name);
		try { localStorage.setItem(`evolia.simNew.${slot}`, id); } catch (e) { /* stockage plein */ }
	}
	if (fresh && state.sim?.profile === id) { const old = slots().active; useSlot(slot); deleteSlot(old); clearTimeout(saveTimer); resetting = true; return location.reload(); }
	switchSlot(slot);
}

/** « Désactivé » : retour à la vraie partie. */
function stopSim() {
	let back = null;
	try { back = localStorage.getItem('evolia.simReturn'); } catch (e) { /* idem */ }
	const list = slots().list;
	const real = list.find(x => x.id === back) ?? list.find(x => !x.name.startsWith('Test · '));
	if (real) switchSlot(real.id);
}

/** La glissière des jours, dans le jeu : on la tire jusqu'au jour voulu, on lâche, la simulation avance. */
function renderSimBar() {
	let bar = $('#sim-bar');
	if (!DEV || !state.sim || state.intro) { bar?.remove(); return; }
	if (!bar) {
		bar = document.createElement('div');
		bar.id = 'sim-bar';
		bar.className = 'card';
		$('#app').append(bar);
		bar.addEventListener('input', e => { if (e.target.id === 'sim-days') $('#sim-days-v').textContent = `jour ${e.target.value}`; });
		bar.addEventListener('change', e => { if (e.target.id === 'sim-days') { const to = Number(e.target.value); if (to > state.sim.day) simAdvance(to - state.sim.day); } });
		bar.addEventListener('click', e => {
			if (e.target.closest('#sim-next')) simAdvance(1);
			if (e.target.closest('#sim-redo') && confirm('Recommencer ce scénario au jour 0 ?')) startSimGame(state.sim.profile, true);
		});
	}
	const d = state.sim.day;
	bar.innerHTML = `<div class="sim-top"><b>${SIM_PROFILES[state.sim.profile].name}</b><span>fin du jour ${d}</span><span id="sim-days-v">jour ${d}</span></div>
		<input type="range" id="sim-days" min="${d}" max="${Math.max(30, d + 30)}" step="1" value="${d}">
		<div class="sim-btns"><button id="sim-next">Jour suivant</button><button id="sim-redo">Recommencer</button></div>`;
}

/** Au chargement d'une partie de test neuve : on saute l'introduction, comme si on venait de la finir. */
function simSkipIntro() {
	const key = `evolia.simNew.${slots().active}`;
	let id = null;
	try { id = localStorage.getItem(key); localStorage.removeItem(key); } catch (e) { /* idem */ }
	if (!id || !SIM_PROFILES[id]) return;
	const pl = here(), b = garden.blob(0);
	delete state.intro;
	// repaired748 : le simulateur recule la date de création ; sans lui, la partie passerait pour une partie d’avant l’introduction.
	state.eco2 = true; state.seenIntro = true; state.introPaid = true; state.repaired748 = true;
	pl.seeded = true; (pl.renewed ??= {}).prairie = 1;
	(pl.cellSize ??= {})[0] = 0.4;
	const [ox, oy] = cellOrigin(0);
	const f = garden.spawn(state.place, 'fleur', 1, { x: b.cx - ox, y: b.cy - oy + 12 }, 0);
	f.intro = true; f.single = true; f.seed = FLOWER_SEED; f.variant = { species: FLOWER };
	for (const sp of [speciesOf(f), 'abeille']) { state.species[sp] = Date.now(); (state.speciesSeen ??= {})[sp] = true; }
	const spot = garden.nearestPlace('ruche', b.cx + 70, b.cy + 40);
	if (spot) garden.placeItem('ruche', spot[0], spot[1]);
	state.ui = {};
	for (const st of UI_STEPS) state.ui[st.sel] = 1;
	state.sim = { profile: id, day: 0, log: [] };
	state.createdAt = Date.now();
	state.prodAt = Date.now();
	persist(true);
}

/** Les achats d'un joueur : le terrain d'abord, puis une parcelle si possible, puis ce qui rapporte le plus pour son prix. */
// Combien d'exemplaires un joueur pose de chaque aménagement hors échelle (il aime voir son jardin varié).
const SIM_WANT = { potager: 3, cabane: 1, poulailler: 1, compost: 1, pas: 6, haie: 4, muret: 3 };
const simWant = k => SIM_WANT[k] ?? (ITEMS[k].cat === 'decoration' ? 2 : 2);

/** Pose un objet sur une place libre d'une parcelle où il a sa place ; faux s'il n'y en a pas. */
function simPlace(k) {
	const cells = garden.openCells().filter(ci => fitsPlace(k, garden.biomeOf(ci)) && garden.placeLimit(k, ci));
	// Un habitat de l'échelle : le joueur essaie quelques endroits et garde celui où il produira le plus.
	const tries = state.eco2 && isLadder(k) ? 8 : 1, cand = [];
	for (let t = 0; t < tries * 2 && cells.length && cand.length < tries; t++) {
		const ci = cells[Math.floor(Math.random() * cells.length)], [cx, cy] = garden.cellCenter(ci);
		const sp2 = garden.nearestPlace(k, cx + simRnd(-130, 130), cy + simRnd(-320, 320));
		if (sp2 && garden.cellAt(sp2[0], sp2[1]) >= 0) cand.push(sp2);
	}
	if (tries > 1) cand.sort((a, b) => { const na = garden.nearInfo(k, ...a), nb = garden.nearInfo(k, ...b); return (nb.near * (1 + nb.syn)) - (na.near * (1 + na.syn)); });
	for (let t = 0; t < 1 && cand.length; t++) {
		const spot = cand[0];
		const it = garden.placeItem(k, spot[0], spot[1], ITEMS[k].turn && Math.random() < 0.5 ? 1 : 0);
		it.paid = priceOf(k);
		bringAttracted(k, true);
		if (k === 'cabane' && !state.gardener) { state.gardener = Math.random() < 0.5 ? 'fermier' : 'fermiere'; state.pet = ['chien', 'chat', null][Math.floor(Math.random() * 3)]; }
		return true;
	}
	return false;
}

function simBuy() {
	const bought = [], full = new Set();
	for (let g = 0; g < 300; g++) {
		const nectar = state.nectar ?? 0, o = [], km = state.totals.distance / 1000;
		// Les aménagements hors échelle : dès qu'ils coûtent moins d'un quart de la bourse.
		for (const k of ITEM_ORDER) {
			const it = ITEMS[k];
			if (isLadder(k) || k === 'collecteur' || full.has(k) || ownedCount(k) >= simWant(k)) continue;
			if (km < it.km || needsFirst(k) || natureLock(k)) continue;
			const c = priceOf(k);
			// Prévenu qu'il manque des oiseaux, le joueur pose d'abord de quoi en faire venir.
			const needBirds = ITEMS[k].birds && (here().noBirds ?? 0) > 0 && !seedBirds(here());
			if (c > nectar * (needBirds ? 1 : 0.25)) continue;
			o.push({ label: simName(k), c, v: needBirds ? 2e9 : 1e7 - c, go: () => { if (!simPlace(k)) { full.add(k); return false; } state.nectar -= c; } });
		}
		const gi = growable();
		if (gi != null) o.push({ label: 'terrain', c: growPrice(), v: 1e9, go: () => { paid(growPrice(), true); garden.growCell(gi); } });
		else {
			// Comme un joueur : la première parcelle voisine dont le milieu est accessible.
			const i = garden.lockedCells().find(j => placeOpen(state, PLACE_BY_ID[garden.worldBiomeAt(j)])), biome = i != null ? garden.worldBiomeAt(i) : null;
			if (biome && kmFree() >= parcelKm())
				o.push({ label: 'parcelle', c: parcelPrice(), v: 1e8, go: () => { here().kmSpent = (here().kmSpent ?? 0) + parcelKm(); paid(parcelPrice()); openParcel(garden.openAt(i, biome), biome); } });
		}
		// Faire grandir l'habitat le moins avancé de chaque sorte.
		for (const k of Object.keys(LADDER)) {
			const it = garden.items.filter(x => x.kind === k && nextLevel(x)?.ok).sort((a, b) => (a.level ?? 1) - (b.level ?? 1))[0];
			const nx = it && nextLevel(it);
			if (nx) o.push({ label: `niveau ${nx.level} (${simName(k)})`, c: nx.cost, v: nx.gain / nx.cost, go: () => { state.nectar -= nx.cost; it.level = nx.level; it.spent = (it.spent ?? 0) + nx.cost; } });
		}
		for (const k of Object.keys(LADDER)) {
			// L'amélioration reste possible même quand on ne peut plus poser d'exemplaire (parcelles pleines).
			const u = nextUpgrade(state, k);
			if (u?.ok) o.push({ label: `amélioration (${simName(k)})`, c: u.cost, v: levelsOf(state, k) * unitProd(state, k) / u.cost, go: () => { state.nectar -= u.cost; (state.upg ??= {})[k] = u.level; } });
			if (ladderLock(state, k) || full.has(k)) continue;
			const c = ladderPrice(state, k);
			o.push({ label: simName(k), c, v: unitProd(state, k) / c, go: () => {
				if (!simPlace(k)) { full.add(k); return false; }
				state.nectar -= c;
			} });
		}
		o.sort((a, b) => b.v - a.v || a.c - b.c);
		const x = o.find(z => z.c <= nectar);
		if (!x) break;
		// Plus de place pour cet habitat : le joueur passe au suivant.
		if (x.go() === false) continue;
		bought.push(x.label);
	}
	return bought;
}

/** Joue une journée complète du profil, et note ce qui s'est passé. */
function simDay() {
	const P = SIM_PROFILES[state.sim?.profile];
	if (!P) return null;
	const day = ++state.sim.day;
	// La journée qui commence : le jardin a un jour de plus (le quota d'espèces en dépend), et les découvertes
	// d'avant vieillissent d'un jour (le quiz ne parle que des espèces découvertes avant aujourd'hui).
	state.createdAt = (state.createdAt ?? Date.now()) - 86400000;
	for (const id of Object.keys(state.species)) if (typeof state.species[id] === 'number') state.species[id] -= 86400000;
	let km = 0, kmh = P.kmh;
	if (day === 1 || Math.random() < P.p) km = simRnd(...P.km);
	else if (P.other) { km = simRnd(...P.other); kmh = 4.8; }
	let walkN = 0, prodN;
	if (km > 0) {
		// Une sortie a plusieurs allures : l'essentiel à son rythme, un bout plus vite, un bout plus lentement.
		const parts = [[0.65, kmh], [0.2, kmh + simRnd(1, 2.5)], [0.15, Math.max(3, kmh - simRnd(0.5, 1.5))]];
		const before = state.nectar ?? 0;
		let effort = 0, minutes = 0;
		for (const [share, v] of parts) {
			const mm = km * 1000 * share, act = activityFor(v), e = effortFor(mm, v, act);
			effort += e; minutes += mm / 1000 / v * 60;
			for (let i = 0; i < 4; i++) growMix(act.plant, e / 4);
		}
		const m = km * 1000;
		addDistance(state, m);
		here().km += km;
		state.totals.steps += Math.round(m / STEP_LENGTH_M);
		state.totals.effort += effort;
		addDayEffort(state, effort);
		addWaiting(state, effort * nectarPerEffort(), false, state.place);
		state.nectar += km * KM_HOURS * prodPerHour(state);
		addEffortXp(effort);
		if (km >= (state.goalKm ?? 2.5)) state.nectar += goalReward();
		walkN = state.nectar - before;
		// La production de la journée : l'élan de la sortie, puis 5 % au repos.
		const elanH = Math.min(8, minutes * 7 / 60);
		prodN = prodPerHour(state) * (elanH + (24 - elanH) * REST);
	} else prodN = prodPerHour(state) * 24 * REST;
	state.nectar += prodN;
	// Les espèces du jour arrivent, et le joueur lit leurs fiches.
	const found = checkSpecies(state, SPECIES_PER_DAY[day - 1] ?? SPECIES_LATER);
	const rr = readReward();
	for (const sp of found) { (state.speciesSeen ??= {})[sp.id] = true; state.nectar += rr; }
	for (const p of PLACES) if (!state.placesOpen[p.id] && placeOpen(state, p)) state.placesOpen[p.id] = Date.now();
	updateNear();
	const bought = simBuy();
	// Les espèces venues avec les habitats posés : le joueur lit aussi leur fiche.
	for (const id of Object.keys(state.species)) if (!state.speciesSeen?.[id] && SPECIES_BY_ID[id]) { (state.speciesSeen ??= {})[id] = true; state.nectar += rr; }
	updateNear();
	checkUnlocks();
	let quizN = 0;
	if (bought.length < 3 && Object.keys(state.speciesSeen ?? {}).length >= 8) {
		for (let q = 0; q < 3; q++) {
			if (Math.random() < 0.7) { const g = Math.round(quizBase() * streakMult(state.quizStreak ?? 0)); state.quizStreak = (state.quizStreak ?? 0) + 1; state.nectar += g; quizN += g; }
			else state.quizStreak = 0;
		}
	}
	state.prodAt = Date.now();
	state.boostUntil = Date.now();
	const row = { day, km: Math.round(km * 10) / 10, walk: Math.round(walkN), prod: Math.round(prodN), read: found.length * rr, bought, species: found.map(s => s.name), total: Object.keys(state.species).length, perH: Math.round(prodPerHour(state)) };
	row.quiz = quizN;
	row.gain = row.walk + row.prod + row.read + quizN;
	state.sim.log.push(row);
	if (state.sim.log.length > 120) state.sim.log.shift();
	return row;
}

/** Avance de `n` jours, puis montre le jardin et le bilan. */
function simAdvance(n) {
	if (!state.sim) return;
	closeOptions();
	closeModal();
	const rows = [];
	for (let i = 0; i < n; i++) rows.push(simDay());
	renderHud(); renderDaily(); renderStatus(); updateSpeciesDot(); renderSimBar();
	persist(true);
	const last = rows[rows.length - 1], P = SIM_PROFILES[state.sim.profile];
	const sum = k => rows.reduce((a, r) => a + r[k], 0);
	const buys = rows.flatMap(r => r.bought), count = {};
	for (const b of buys) count[b] = (count[b] ?? 0) + 1;
	showModal(`<div class="modal-body"><h2>Fin du jour ${last.day}</h2>
		<p>${P.name} · ${n > 1 ? `${n} jours simulés, ${fmt(sum('km'))} km` : last.km ? `${fmt(last.km)} km aujourd’hui` : 'pas de sortie aujourd’hui'}.</p>
		<ul class="sim-sum">
			<li><b>Nectar gagné</b> : ${fmtInt(sum('gain'))} (marche ${fmtInt(sum('walk'))}, habitats ${fmtInt(sum('prod'))}, fiches ${fmtInt(sum('read'))}, quiz ${fmtInt(rows.reduce((a, r) => a + (r.quiz ?? 0), 0))})</li>
			<li><b>Achats</b> : ${buys.length ? Object.entries(count).map(([k, v]) => `${k}${v > 1 ? ` × ${v}` : ''}`).join(', ') : 'aucun'}</li>
			<li><b>Espèces</b> : ${rows.reduce((a, r) => a + r.species.length, 0)} nouvelles, ${last.total} en tout${n === 1 && last.species.length ? ` (${last.species.join(', ')})` : ''}</li>
			<li><b>Production</b> : ${fmtInt(last.perH)} nectar par heure d’élan · bourse : ${fmtInt(state.nectar)}</li>
		</ul>
		<table class="sim-log"><tr><th>Jour</th><th>km</th><th>Gagné</th><th>Achats</th><th>Espèces</th><th>/ h</th></tr>
		${state.sim.log.slice(-14).reverse().map(r => `<tr><td>${r.day}</td><td>${fmt(r.km)}</td><td>${fmtInt(r.gain)}</td><td>${r.bought.length}</td><td>${r.total}</td><td>${fmtInt(r.perH)}</td></tr>`).join('')}</table></div>
		<div class="modal-foot"><button class="btn primary" data-close>Voir mon jardin</button></div>`);
}

// ─── Options : version, réglages, mode test ───────────────────

const isApp = () => !!window.Capacitor?.isNativePlatform?.();
/** Le nectar d'un kilomètre de marche à 5 km/h (en courant, bien plus), d'après les réglages. */
const nectarPerKm = () => Math.round(Tuning.num('effort.km_marche', 125) * nectarPerEffort() * (state.eco2 ? ECO2_WALK : 1));

// ─── Panneau de débogage ──────────────────────────────────────

/** Ce que le panneau affiche, section par section. */
function debugRead() {
	const g = tracking.gps, fix = g?.fix, m = tracking.motion, w = session, h = state.harvestInfo, now = Date.now();
	const ua = navigator.userAgent, os = window.Capacitor?.getPlatform?.() ?? (/iPhone|iPad/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'autre');
	let climb = 0, drop = 0, dist = 0;
	for (const e of tracking.hikeLog ?? []) if (now - e.t <= HIKE_WINDOW) { climb += e.climb; drop += e.drop ?? 0; dist += e.dist; }
	const src = state.harvestSource ? SOURCES[state.harvestSource]?.label ?? state.harvestSource : 'aucune';
	return [
		['Appareil', [
			['Version', `${VERSION} · ${isApp() ? 'appli' : 'site web'} · ${os}`],
			['Suivi des pas', state.tracking ? 'activé' : 'pas activé'],
			['Écran', document.hidden ? 'caché' : 'visible'],
			['Images/s', `${Math.round(garden.fps ?? 0)}`],
		]],
		['GPS', [
			['État', !g ? (GpsTracker.available() ? 'éteint' : 'indisponible') : { searching: 'recherche', ok: 'bon signal', weak: 'signal faible', error: 'erreur (position refusée ?)' }[tracking.gpsState] ?? 'en attente'],
			['Dernier point', fix ? `il y a ${ago(fix.at)} · ±${Math.round(fix.acc)} m` : '—'],
			['Vitesse', g ? `${(g.speed ?? 0).toFixed(1)} km/h${fix?.gpsSpeed != null ? ` (GPS ${(fix.gpsSpeed * 3.6).toFixed(1)})` : ''}` : '—'],
			['Altitude', fix?.alt != null ? `${Math.round(fix.alt)} m ±${Math.round(fix.altAcc ?? 0)}` : 'non fournie'],
			['10 dernières min', `${Math.round(dist)} m · +${Math.round(climb)} m / −${Math.round(drop)} m${tracking.hiking ? ' · rando/trail' : ''}`],
			['Dernier mouvement', ago(tracking.lastGpsMove)],
		]],
		['Pas (accéléromètre)', [
			['État', m ? 'actif' : 'éteint'],
			['Pas comptés', m ? `${m.steps}` : '—'],
			['Cadence', m ? `${Math.round(m.spm ?? 0)} pas/min` : '—'],
			['Dernier pas', ago(tracking.lastStep)],
		]],
		['Balade', w ? [
			['En cours depuis', dur(sessionSeconds(w))],
			['Distance', `${Math.round(w.distance)} m`],
			['Pas', `${w.steps}`],
			['Activité', w.act?.name ?? 'à l’arrêt'],
			['Vitesse', `${(w.speed ?? 0).toFixed(1)} km/h`],
			['Montée', `${Math.round(w.climb ?? 0)} m`],
			['Fin auto dans', `${Math.max(0, Math.round((STOP_AFTER - (now - w.lastMove)) / 1000))} s`],
		] : [['État', 'aucune balade en cours']]],
		['Relecture des pas (appli fermée)', [
			['Source', isApp() ? src : 'impossible sur le site'],
			['Dernière', h ? `${new Date(h.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${h.steps} pas${h.error ? ` · erreur : ${h.error}` : ''}` : new Date(state.lastHarvest).toLocaleString('fr-FR')],
		]],
		['Totaux', [
			['Aujourd’hui', `${fmt(todayMeters(state) / 1000, 2)} km`],
			['Depuis le début', `${fmt(state.totals.distance / 1000, 1)} km · ${fmtInt(state.totals.steps ?? 0)} pas`],
		]],
	];
}
const debugPanel = new DebugPanel(debugRead);
// Ce qu'on note en tête d'une trace : l'appareil et l'état du suivi au départ.
debugPanel.info = () => ({ Version: VERSION, Plateforme: `${isApp() ? 'appli' : 'site web'} · ${window.Capacitor?.getPlatform?.() ?? navigator.userAgent.slice(0, 90)}`, 'Suivi activé': state.tracking ? 'oui' : 'non', GPS: tracking.gps ? 'démarré' : 'éteint', Accéléromètre: tracking.motion ? 'actif' : 'éteint' });
debugPanel.show(debugOn());

/** Ce que la dernière relecture des pas a trouvé, et quoi faire si elle ne trouve rien. */
function harvestHtml(src) {
	const h = state.harvestInfo, when = t => new Date(t).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
	const last = h ? `Dernière relecture ${when(h.at)} : ${h.error ? `erreur (${h.error})` : `${fmtInt(h.steps)} pas trouvés depuis ${when(h.from)}`}.` : `Dernière relecture ${when(state.lastHarvest)}.`;
	const help = h && !h.error && h.steps < 30 && src.id === 'health'
		? '<br>Health Connect ne reçoit des pas que si une appli les y enregistre : ouvre Health Connect › Autorisations des applis et vérifie que Google Fit, Samsung Health ou ton appli de pas a le droit d\'écrire les pas.'
		: '';
	return `<div class="harvest-info"><b>Pas relus appli fermée avec ${src.label}.</b> ${last}${help}</div>
		<button class="btn ghost wide" id="opt-harvest-now">Relire mes pas maintenant</button>`;
}

// ─── Ma partie : une copie à garder, et la restaurer ───────────

async function showBackup() {
	const code = await exportCode(state);
	state.backupAt = Date.now();
	persist(true);
	showModal(`<h2>Ta copie de partie</h2>
		<p>Garde ce code en lieu sûr (tes notes, un message à toi-même). Pour retrouver ton jardin : Options › Restaurer une partie, puis colle-le.</p>
		<textarea class="backup-code" readonly>${code}</textarea>
		<button class="btn primary" id="btn-copy-code">Copier le code</button>
		${navigator.share ? '<button class="btn ghost wide" id="btn-share-code">Partager…</button>' : ''}
		<button class="btn ghost wide" id="btn-save-code">Enregistrer dans un fichier</button>
		<button class="btn ghost wide" data-close>Fermer</button>`);
	$('#btn-copy-code').onclick = async () => {
		try { await navigator.clipboard.writeText(code); } catch (e) { $('.backup-code').select(); document.execCommand('copy'); }
		toast('Code copié : colle-le dans tes notes', '#5F933E');
	};
	if ($('#btn-share-code')) $('#btn-share-code').onclick = () => navigator.share({ title: 'Ma partie Evolia', text: code }).catch(() => {});
	$('#btn-save-code').onclick = () => {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
		a.download = `evolia-${dayKey()}.txt`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 5000);
	};
}

function showRestore() {
	showModal(`<h2>Restaurer une partie</h2>
		<p>Colle ici le code de ta copie, ou choisis son fichier. Le jardin de ce téléphone sera remplacé.</p>
		<textarea class="backup-code" id="restore-code" placeholder="EVOLIA1:…"></textarea>
		<input type="file" id="restore-file" accept=".txt,text/plain" hidden>
		<button class="btn ghost wide" id="btn-restore-file">Choisir un fichier</button>
		<button class="btn primary" id="btn-restore-go">Restaurer</button>
		<button class="btn ghost wide" data-close>Annuler</button>`);
	$('#btn-restore-file').onclick = () => $('#restore-file').click();
	$('#restore-file').onchange = async e => { const f = e.target.files?.[0]; if (f) $('#restore-code').value = await f.text(); };
	$('#btn-restore-go').onclick = async () => {
		let saved;
		try { saved = await importCode($('#restore-code').value); } catch (e) { toast(e.message, '#C0442F'); return; }
		const km = fmt((saved.totals.distance ?? 0) / 1000, 0), n = Object.keys(saved.species).length;
		if (!confirm(`Restaurer ce jardin (${km} km, ${n} espèces) ? Celui de ce téléphone sera remplacé.`)) return;
		clearTimeout(saveTimer);
		resetting = true;
		save(saved);
		location.reload();
	};
}

// ─── Plusieurs sauvegardes ───────────────────────────────────

const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** La liste des parties dans Options : la partie en cours, et les autres à reprendre, renommer ou effacer. */
function slotsHtml() {
	const s = slots();
	return `<ul class="slots">${s.list.map(x => {
		const on = x.id === s.active, sum = on ? { km: state.totals.distance / 1000, species: Object.keys(state.species).length } : slotSummary(x.id);
		return `<li class="${on ? 'on' : ''}"><div><b>${esc(x.name)}</b>${on ? ' <span class="chip">en cours</span>' : ''}<small>${sum ? `${fmt(sum.km, 1)} km · ${sum.species} espèces` : 'jardin neuf'}</small></div>
			<div class="slot-actions">${on ? '' : `<button class="btn primary small" data-slot="${x.id}" data-do="play">Jouer</button>`}<button class="btn ghost small" data-slot="${x.id}" data-do="rename">Renommer</button>${on ? '' : `<button class="btn ghost small danger" data-slot="${x.id}" data-do="delete">Effacer</button>`}</div></li>`;
	}).join('')}</ul>`;
}

/** Passe à une autre partie : on garde celle en cours, puis on recharge le jeu sur l'autre. */
function switchSlot(id) {
	clearTimeout(saveTimer);
	save(state);
	resetting = true;
	useSlot(id);
	location.reload();
}

// ─── Rappels (appli Android) ───────────────────────────────────

/** Une fois les premières missions finies, on propose les rappels, une seule fois. */
function offerNotify() {
	if (!canNotify() || state.notifyAsked || !$('#modal').hidden) return;
	state.notifyAsked = true;
	persist(true);
	showModal(`<h2>Un petit rappel ?</h2>
		<p>Evolia peut te prévenir quand ton collecteur est plein, quand ton cadeau du jour t’attend, le soir si ta série risque de s’arrêter, et si tes pas appli fermée ne sont pas relus. Quelques rappels au plus, et tu peux les couper dans Options.</p>
		<button class="btn primary" id="btn-notify-yes">Oui, préviens-moi</button>
		<button class="btn ghost wide" data-close>Non merci</button>`);
	$('#btn-notify-yes').onclick = async () => {
		closeModal();
		state.notify = await askNotify();
		persist(true);
		toast(state.notify ? 'Rappels activés' : 'Sans autorisation, pas de rappel : tu peux changer d’avis dans Options', '#5F933E');
	};
}

/** En quittant l'appli : quand le collecteur sera plein, le cadeau de demain matin, la série à garder ce soir. */
function planReminders() {
	if (!state.notify) return;
	// Rien ne relit les pas appli fermée : un rappel une demi-heure après, une fois par jour au plus.
	let noSourceAt = null;
	if (!state.harvestSource && state.noSourceNote !== dayKey()) {
		state.noSourceNote = dayKey();
		noSourceAt = Date.now() + 30 * 60000;
		persist(true);
	}
	const perH = Object.keys(state.places).reduce((a, id) => a + rates(state, id).nectar, 0) * (boostLeft(state) ? boostMult() : 1);
	const space = jarCap(state) - jarOf(state), hours = perH > 0 ? space / perH : Infinity;
	const gift = new Date(); gift.setDate(gift.getDate() + 1); gift.setHours(9, 0, 0, 0);
	const evening = new Date(); evening.setHours(18, 30, 0, 0);
	const d = state.daily ?? {};
	scheduleReminders({
		jarFullAt: hasCollector(state) && space > 0 && hours <= 12 ? Date.now() + hours * 3600000 : null,
		giftAt: gift.getTime(),
		streak: d.lastActive === d.day ? 0 : d.streak ?? 0,
		streakAt: evening.getTime(),
		noSourceAt,
	});
}

// Which Options groups are unfolded; kept across re-renders of the panel.
const optOpen = { jardin: false, tech: false };
const optGroup = (key, title, sub) => `<details class="opt-group" data-group="${key}"${optOpen[key] ? ' open' : ''}><summary><b>${title}</b><span>${sub}</span></summary>`;

function renderOptions() {
	const src = SOURCES[state.harvestSource];
	$('#options').innerHTML = `
		<div class="panel-head"><h2>Options</h2><button class="close" data-close-options aria-label="Fermer">×</button></div>
		<div class="opt-version"><img src="assets/logo.png" alt=""><div><b>Evolia v${VERSION}</b><span>${isApp() ? 'Appli Android' : 'Version web'} · données gardées sur ce téléphone</span></div></div>
		${optGroup('jardin', 'Jardin', 'Objectif, suivi des pas, sons, rappels, sauvegardes')}
		<h3>Objectif du jour : ${fmt(state.goalKm, state.goalKm % 1 ? 1 : 0)} km</h3>
		<p class="empty">Le jeu le fixe chaque matin d'après ta semaine passée, un peu au-dessus de ta moyenne, pour avancer sans forcer. À vélo, un kilomètre compte pour 0,4 km.</p>
		<h3>Suivi de tes pas</h3>
		<p class="empty">${state.tracking ? "Actif : dès que tu bouges appli ouverte, une balade démarre toute seule et s'arrête après une minute d'immobilité." : 'En pause.'}
			${src ? '' : isApp() ? ' Les pas faits appli fermée ne sont pas relus : autorise-le ci-dessous.' : " Dans l'appli mobile, les pas faits appli fermée sont aussi relus."}</p>
		${src ? harvestHtml(src) : ''}
		${state.tracking ? '' : '<button class="btn ghost wide" id="btn-track-2">Activer le suivi</button>'}
		${state.tracking && !tracking.motion && 'DeviceMotionEvent' in window ? '<button class="btn ghost wide" id="btn-motion">Activer le compteur de pas du téléphone</button>' : ''}
		${isApp() && !src ? '<button class="btn ghost wide" id="opt-harvest">Relire les pas faits appli fermée</button>' : ''}
		<h3>Le ciel</h3>
		<p class="empty">${sky.label()} · lever ${fmtHour(garden.sun.rise)}, coucher ${fmtHour(garden.sun.set)}.
			${state.coords ? 'Météo réelle de ton coin (position arrondie à 10 km, envoyée à Open-Meteo).' : 'Active ta position approximative pour voir la vraie météo et le vrai coucher du soleil.'}</p>
		${state.coords ? '' : '<button class="btn ghost wide" id="btn-sky">Utiliser ma position approximative</button>'}
		<h3>Sons de la nature</h3>
		<label class="switch"><input type="checkbox" id="opt-sound" ${sound.settings.on ? 'checked' : ''}><i></i><span>Pluie, oiseaux et petites bêtes de ton jardin</span></label>
		${sound.settings.on ? `<input type="range" id="opt-volume" class="volume" min="0" max="1" step="0.05" value="${sound.settings.vol}" aria-label="Volume des sons">` : ''}
		<p class="empty">Cris d'animaux : vrais enregistrements de Joseph Sardin, <a href="https://bigsoundbank.com" target="_blank" rel="noopener">BigSoundBank.com</a> (domaine public).</p>
		<h3>Musique</h3>
		<label class="switch"><input type="checkbox" id="opt-music" ${sound.musicSettings.on ? 'checked' : ''}><i></i><span>Musique zen, jamais la même</span></label>
		${sound.musicSettings.on ? `<input type="range" id="opt-music-vol" class="volume" min="0" max="1" step="0.05" value="${sound.musicSettings.vol}" aria-label="Volume de la musique">
		<label class="switch"><input type="checkbox" id="opt-music-walk" ${sound.musicSettings.walk ? 'checked' : ''}><i></i><span>Aussi pendant mes sorties (sinon seuls les sons de la nature restent)</span></label>` : ''}
		<h3>Ma partie</h3>
		<p class="empty">Ton jardin est gardé sur ce téléphone. Garde-en une copie (un code à coller dans tes notes ou à t'envoyer) : elle le ramène après un changement de téléphone. ${backupAge(state)}</p>
		<button class="btn ghost wide" id="opt-backup">Garder une copie de ma partie</button>
		<button class="btn ghost wide" id="opt-restore">Restaurer une partie</button>
		<h3>Mes sauvegardes</h3>
		<p class="empty">Plusieurs jardins sur ce téléphone, pour comparer ou essayer : passe de l'un à l'autre quand tu veux. Tes pas vont dans la partie en cours.</p>
		${slotsHtml()}
		<button class="btn ghost wide" id="opt-slot-copy">Dupliquer la partie en cours</button>
		<button class="btn ghost wide" id="opt-slot-new">Commencer une nouvelle partie</button>
		${canNotify() ? `<h3>Rappels</h3>
		<label class="switch"><input type="checkbox" id="opt-notify" ${state.notify ? 'checked' : ''}><i></i><span>Collecteur plein, cadeau du jour, série à garder, pas non relus</span></label>` : ''}
		<h3>Aide</h3>
		<button class="btn ghost wide" id="opt-coach">Revoir le tutoriel</button>
		<a class="btn ghost wide opt-link" href="privacy.html" target="_blank" rel="noopener">Confidentialité</a>
		<h3>Recommencer</h3>
		<p class="empty">Efface ton jardin, tes espèces et tes balades sur ce téléphone, pour repartir d'une prairie neuve.</p>
		<button class="btn ghost wide danger" id="opt-reset">Recommencer à zéro</button>
		</details>
		${optGroup('tech', 'Technique', 'Affichage, batterie')}
		<h3>Effet miniature</h3>
		<label class="switch"><input type="checkbox" id="opt-fx" ${fxOn() ? 'checked' : ''}><i></i><span>Haut et bas de l'écran un peu flous, bords adoucis : le jardin comme une maquette</span></label>
		<h3>Ciel du jardin</h3>
		<div class="seg" id="opt-sky">${[['real', 'Réel'], ['jour', 'Toujours de jour'], ['beau', 'Toujours beau']].map(([k, l]) => `<button data-sky="${k}" class="${(state.skyMode ?? 'real') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
		<p class="opt-help">Réel : la vraie heure et la vraie météo, avec leurs animaux et leurs bonus. Fixé : toujours lumineux, sans bonus.</p>
		<h3>Économie d'énergie</h3>
		<label class="switch"><input type="checkbox" id="opt-eco" ${state.eco30 ? 'checked' : ''}><i></i><span>30 images par seconde : le téléphone chauffe moins, la batterie dure plus</span></label>
		</details>
		${optGroup('dev', 'Outils du développeur', 'Débogage, mode test')}
		<h3>Débogage</h3>
		<label class="switch"><input type="checkbox" id="opt-debug" ${debugOn() ? 'checked' : ''}><i></i><span>Afficher en jeu ce que voit le suivi (GPS, pas, balade, relecture) et le journal des événements</span></label>
		<h3>Mode test</h3>
		<label class="switch"><input type="checkbox" id="opt-dev" ${DEV ? 'checked' : ''}><i></i><span>Outils de test et raccourcis (pour essayer le jeu sans marcher)</span></label>
		${DEV ? `<div class="dev"><div class="dev-label">Joueur simulé <b id="sim-prof-v">${state.sim ? SIM_PROFILES[state.sim.profile].name : 'désactivé'}</b></div>
			<input type="range" id="sim-prof" min="0" max="${SIM_ORDER.length - 1}" step="1" value="${SIM_ORDER.indexOf(state.sim?.profile ?? 'off')}">
			<p class="dev-note" id="sim-prof-t">${state.sim ? `${SIM_PROFILES[state.sim.profile].text}. Une glissière dans le jeu fait avancer les jours.` : 'Choisis un sportif : une partie de test s’ouvre (ta partie reste intacte), avec une glissière pour avancer les jours.'}</p>
			Heure du jardin <b id="dev-h">${garden.hourOverride ?? 'réelle'}</b>
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
			<button id="dev-km10">+10 km (ouvrir des milieux)</button>
			<button id="dev-nectar">+500 nectar</button>
			<button id="dev-day">Nouveau jour (cadeau et défis)</button>
			<button id="dev-quiz">Lancer un quiz des fiches</button>
			<button id="dev-reset" class="danger">Effacer le jardin</button>
</div>` : ''}
		</details>`;
}

function openOptions() {
	// Si le contenu plante (vu une fois sur Android), la page s'ouvre quand même et dit pourquoi.
	try { renderOptions(); } catch (e) {
		const msg = String(e?.stack ?? e?.message ?? e).slice(0, 300);
		debugLog(`Options : ${msg}`);
		$('#options').innerHTML = `<div class="panel-head"><h2>Options</h2><button class="close" data-close-options aria-label="Fermer">×</button></div>
		<p class="empty">Une partie de cette page n'a pas pu s'afficher. Envoie ce message pour qu'on corrige :</p><pre class="opt-error"></pre>
		<label class="switch"><input type="checkbox" id="opt-debug" ${debugOn() ? 'checked' : ''}><i></i><span>Débogage</span></label>`;
		$('#options .opt-error').textContent = `Evolia ${VERSION} · ${msg}`;
	}
	$('#options').classList.add('open');
	$('#options').setAttribute('aria-hidden', 'false');
}
function closeOptions() {
	$('#options').classList.remove('open');
	$('#options').setAttribute('aria-hidden', 'true');
}

// 'toggle' does not bubble: listen in the capture phase to remember each group's state.
$('#options').addEventListener('toggle', e => {
	const g = e.target.closest?.('[data-group]');
	if (g) optOpen[g.dataset.group] = g.open;
}, true);
$('#options').addEventListener('click', async e => {
	if (e.target.closest('[data-close-options]')) return closeOptions();
	const w = e.target.closest('[data-w]');
	if (w) { sky.override = w.dataset.w === 'réelle' ? null : w.dataset.w; sky.apply(); renderOptions(); }
	const ts = e.target.closest('[data-ts]');
	if (ts && tracking.sim) { tracking.sim.timeScale = Number(ts.dataset.ts); renderOptions(); }
	const id = e.target.id;
	if (id === 'btn-sky') { await sky.locate(true); persist(true); renderOptions(); }
	if (id === 'btn-track-2') { enableTracking(true); sky.locate(true); renderOptions(); }
	if (id === 'btn-motion') { await enableTracking(true); toast(tracking.motion ? 'Compteur de pas activé' : 'Le téléphone a refusé le compteur de pas : Réglages › Safari › Mouvement et orientation', tracking.motion ? '#5F933E' : '#C0442F'); renderOptions(); }
	if (id === 'opt-harvest') { closeOptions(); offerHarvest(true); }
	if (id === 'opt-harvest-now') { closeOptions(); maybeHarvest(); }
	// Nouvelles parties : les bulles d'aide reviennent une à une, au bon moment (l'ancien tutoriel ne les concerne pas).
	if (id === 'opt-coach') { closeOptions(); if (state.eco2) { state.tips = {}; lastTipEnd = 0; persist(true); toast('Les bulles d’aide vont revenir une à une', '#5F933E'); } else coach(0); }
	if (id === 'opt-backup') showBackup();
	// Les sauvegardes : changer, dupliquer, commencer, renommer, effacer.
	const sl = e.target.closest('[data-slot]');
	if (sl) {
		const sid = sl.dataset.slot, what = sl.dataset.do, cur = slots().list.find(x => x.id === sid);
		if (what === 'play') return switchSlot(sid);
		if (what === 'rename') { const n = prompt('Nom de cette partie :', cur?.name ?? ''); if (n?.trim()) { renameSlot(sid, n.trim().slice(0, 40)); renderOptions(); } }
		if (what === 'delete' && confirm(`Effacer « ${cur?.name} » ? Ce jardin sera perdu.`)) { deleteSlot(sid); renderOptions(); }
		return;
	}
	if (id === 'opt-slot-copy') {
		const n = prompt('Nom de la copie :', `${slots().list.find(x => x.id === slots().active)?.name ?? 'Ma partie'} (copie)`);
		if (n?.trim()) { save(state); createSlot(n.trim().slice(0, 40), state); toast('Copie créée : choisis-la dans la liste pour y jouer', '#5F933E'); renderOptions(); }
	}
	if (id === 'opt-slot-new') {
		const n = prompt('Nom de la nouvelle partie :', `Partie ${slots().list.length + 1}`);
		if (n?.trim()) switchSlot(createSlot(n.trim().slice(0, 40)));
	}
	if (id === 'opt-restore') showRestore();
	if (id === 'dev-hour-real') { garden.hourOverride = null; renderOptions(); }
	if (id === 'dev-quiz') { closeOptions(); return offerQuiz(true); }
	const skyBtn = e.target.closest('[data-sky]');
	if (skyBtn) { state.skyMode = skyBtn.dataset.sky; applySkyMode(); persist(true); renderOptions(); return; }
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
	if ((id === 'dev-reset' || id === 'opt-reset') && confirm('Recommencer à zéro ? Ton jardin, tes espèces et tes balades seront effacés.')) {
		clearTimeout(saveTimer);
		resetting = true;
		reset();
		location.reload();
	}
});
$('#options').addEventListener('change', e => {
	if (e.target.id === 'opt-fx') {
		state.fx = e.target.checked;
		$('#app').classList.toggle('no-fx', !fxOn());
		persist(true);
		return;
	}
	if (e.target.id === 'opt-eco') {
		state.eco30 = e.target.checked;
		garden.maxFps = state.eco30 ? 30 : 0;
		persist(true);
		return;
	}
	if (e.target.id === 'opt-notify') {
		const on = e.target.checked;
		(on ? askNotify() : Promise.resolve(false)).then(ok => {
			state.notify = on && ok;
			if (on && !ok) toast('Autorise les notifications d’Evolia dans les réglages du téléphone', '#C0442F');
			persist(true);
			renderOptions();
		});
		return;
	}
	if (e.target.id === 'opt-sound') { sound.setOn(e.target.checked); persist(true); renderOptions(); return; }
	if (e.target.id === 'opt-music') { sound.setMusicOn(e.target.checked); persist(true); renderOptions(); return; }
	if (e.target.id === 'opt-music-walk') { sound.musicSettings.walk = e.target.checked; sound.applyLevels(); persist(true); return; }
	if (e.target.id === 'opt-volume' || e.target.id === 'opt-music-vol') { persist(true); return; }
	if (e.target.id === 'opt-debug') { setDebug(e.target.checked); debugPanel.show(e.target.checked); return; }
	if (e.target.id !== 'opt-dev') return;
	DEV = e.target.checked;
	try { localStorage.setItem(DEV_KEY, DEV ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
	if (DEV) window.evolia = { garden, state, sky, sound };
	renderOptions();
});
// La glissière du joueur simulé agit quand on la lâche : on change de partie.
$('#options').addEventListener('change', e => {
	if (e.target.id !== 'sim-prof') return;
	const k = SIM_ORDER[Number(e.target.value)];
	if (k === 'off') { if (state.sim) stopSim(); }
	else if (state.sim?.profile !== k) startSimGame(k);
});
$('#options').addEventListener('input', e => {
	if (e.target.id === 'opt-volume') sound.setVolume(parseFloat(e.target.value));
	if (e.target.id === 'opt-music-vol') sound.setMusicVolume(parseFloat(e.target.value));
	if (e.target.id === 'sim-prof') {
		const k = SIM_ORDER[Number(e.target.value)];
		$('#sim-prof-v').textContent = k === 'off' ? 'désactivé' : SIM_PROFILES[k].name;
		$('#sim-prof-t').textContent = k === 'off' ? 'Lâche ici pour revenir à ta partie.' : `${SIM_PROFILES[k].text}. Lâche pour ouvrir sa partie de test.`;
		return;
	}
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
// Nouvelle économie : la page Écosystème montre ce qui se passe vraiment (production, élan, habitats, plantes).
function openEco2() {
	const byKind = {}, perH = prodPerHour(state, byKind), left = boostLeft(state);
	const h = Math.floor(left / 3600000), m = Math.round((left % 3600000) / 60000);
	const cover = plantCover(state), sp = Object.keys(state.species).length;
	const plants = here().plants.filter(p => p.growth >= 1), count = t => plants.filter(p => p.type === t).length;
	updateNear();
	const nearAvg = k => { const its = garden.items.filter(it => it.kind === k); return its.length ? Math.round(its.reduce((a, it) => a + nearOf(state, it), 0) / its.length * 100) : null; };
	const rows = Object.keys(LADDER).filter(k => ownedOf(state, k)).map(k => `<tr><td>${ITEMS[k].name}</td><td class="num">${ownedOf(state, k)}</td><td class="num">${nearAvg(k) ?? '—'}${nearAvg(k) != null ? ' %' : ''}</td><td class="num">${state.upg?.[k] ? `× ${2 ** state.upg[k]}` : '—'}</td><td class="num">${byKind[k] >= 100 ? fmtInt(byKind[k]) : fmtNum(byKind[k])}</td></tr>`).join('');
	const ge = guildEffect(state);
	$('#eco').innerHTML = `
		<div class="panel-head"><h2>Écosystème</h2><button class="close" data-close-eco aria-label="Fermer">×</button></div>
		<div class="eco2-hero card">
			<b>${perH >= 100 ? fmtInt(perH) : fmtNum(perH)}</b><span>nectar par heure d’élan</span>
			<p>${left > 0 ? `Élan : encore <b>${h ? `${h} h ` : ''}${m} min</b>. Tes habitats travaillent à plein.` : `Au repos : tes habitats ne produisent que ${Math.round(REST * 100)} % (${fmtInt(perH * REST)} nectar par heure). Une sortie relance l’élan : environ 7 minutes par minute de marche.`}</p>
		</div>
		<p class="sp-intro">Un km te rapporte <b>${fmtInt(60 + KM_HOURS * perH)} nectar</b>.</p>
		${rows ? `<h3 class="sp-section">Tes habitats</h3><div class="eco2-table"><table><thead><tr><th>Habitat</th><th>Posés</th><th>Voisinage</th><th>Amélioré</th><th>Nectar / h</th></tr></thead><tbody>${rows}</tbody></table></div>`
			: '<p class="sp-intro">Pas encore d’habitat : ouvre Aménager › Habitats pour en poser un.</p>'}
		<h3 class="sp-section">Ce qui les fait produire</h3>
		<ul class="eco2-list">
			<li><b>Plantes</b> : ${count('fleur')} fleurs, ${count('buisson')} arbustes, ${count('arbre')} arbres. Chaque habitat produit selon celles qui l’entourent.</li>
			<li><b>Espèces</b> : ${sp}, soit +${sp} % de production.</li>
		</ul>
		<h3 class="sp-section">Ce que font tes espèces</h3>
		<ul class="eco2-list">
			${Object.keys(GUILD_TEXT).map(g => `<li><b>${GUILD_TEXT[g].plural}</b> (${ge.n[g]}) : ${ge.n[g] ? GUILD_TEXT[g].what(ge.n[g]) : `aucun encore : ${GUILD_TEXT[g].one}`}.</li>`).join('')}
			<li><b>Élan</b> : après une sortie, tout tourne à plein ; au repos, ${Math.round(REST * 100)} % seulement.</li>
		</ul>`;
	$('#eco').classList.add('open');
	$('#eco').setAttribute('aria-hidden', 'false');
}
const openEco = () => (state.eco2 ? openEco2() : eco.open());
$('#btn-eco').addEventListener('click', openEco);
$('#status').addEventListener('click', () => { if (!session) openEco(); });
$('#hud').addEventListener('click', e => {
	if (e.target.closest('#hud-act')) return showActivity();
	if (!e.target.closest('#hud-steps')) return;
	if ((state.pending ?? 0) < 1) { if (!session) openEco(); return; }
	if (jarOf(state) >= 1) { focusJar(); toast(`Ta récolte t’attend dans le collecteur${groundOf(state) >= 1 ? ', et en gouttes sur les fleurs' : ''} : touche-le pour le vider`, '#E3A33A'); }
	else { focusDew(); toast('Ta récolte perle sur les fleurs : touche les gouttes dorées', '#E3A33A'); }
});
setInterval(() => { if (!document.hidden) renderHud(); }, 2000);
$('#modal').addEventListener('click', e => {
	const sp = e.target.closest('[data-open-sp]');
	if (sp) species.open(sp.dataset.openSp);
	if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal();
});

// ─── Tutoriel express : trois étapes, presque sans texte ──────

const COACH = [
	{ title: 'Ton jardin est vivant', text: 'Glisse pour te promener, pince pour zoomer.', actions: [['Suivant', 'next']] },
	// Dans l'appli, rien à garder ouvert : les pas faits téléphone rangé sont relus au retour.
	{ title: 'Bouge, il pousse', text: isApp() ? 'Tes pas le font grandir, même le ménage. Range ton téléphone : tes pas seront relus à ton retour.' : 'Tes pas le font grandir. Même le ménage.', actions: [['Activer le suivi', 'track'], ['Plus tard', 'next']] },
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

// Au lancement : une nouvelle partie n'a pas de logo ici (l'introduction le présente). Sinon, le papier s'efface sur
// le jardin du joueur, le logo détouré et sa phrase apparaissent par-dessus, puis s'en vont ; l'interface n'arrive
// qu'après, jamais en même temps que le logo.
const splash = $('#splash');
if (state.intro) {
	splash.classList.add('out');
	setTimeout(() => splash.remove(), 1300);
} else {
	$('#app').classList.add('booting');
	const logo = document.createElement('div');
	logo.className = 'intro-logo';
	logo.innerHTML = '<img src="assets/logo-detoure.png" alt="Evolia"><p>À chacun de tes pas, la nature s’éveille.</p>';
	$('#app').append(logo);
	setTimeout(() => { splash.classList.add('out'); logo.classList.add('in'); sound.fanfare?.(); }, 300);
	setTimeout(() => splash.remove(), 1600);
	setTimeout(() => logo.classList.remove('in'), 3400);
	setTimeout(() => { logo.remove(); $('#app').classList.remove('booting'); }, 4900);
}

// Glisser dans le jardin efface l'interface pour le voir en entier ; relâcher la fait revenir.
// Le petit œil garde l'interface effacée tant qu'on ne le touche pas de nouveau : on explore le jardin seul.
let peekLock = false;
garden.onPeek = on => {
	$('#app').classList.toggle('peek', on || peekLock);
	if (on) $('#plant-card').hidden = true;
};
$('#btn-peek').addEventListener('click', () => {
	peekLock = !peekLock;
	$('#btn-peek').classList.toggle('on', peekLock);
	$('#btn-peek').setAttribute('aria-pressed', String(peekLock));
	garden.onPeek(peekLock);
	if (peekLock) toast('Touche l’œil pour retrouver tes boutons', '#5F933E');
});

// Les parties commencées avec la refonte (petit terrain) passent à la nouvelle économie : le nectar resté en
// gouttes sur les fleurs rejoint la bourse.
if (!state.eco2 && here().cellSize?.[0] != null && cellsOpen(here()) === 1) state.eco2 = true;
if (state.eco2 && (state.ground ?? 0) > 0) { state.nectar = (state.nectar ?? 0) + state.ground; state.pending = Math.max(0, (state.pending ?? 0) - state.ground); state.ground = 0; }
// Les habitats déjà posés font venir leur espèce (avant la 0.7.63, il fallait la découvrir autrement).
if (state.eco2 && !state.intro) for (const it of Object.values(state.places).flatMap(p => p.items ?? [])) bringAttracted(it.kind, true);
runHabitats();
renderHud();
renderStatus();
const firstRun = !state.seenIntro;
rollDay(state);
checkUnlocks();
delete here().pendingCell; // l'ancien choix du milieu par menu : le monde le donne désormais
garden.maxFps = state.eco30 ? 30 : 0;
// En paysage, le panneau du bas devient une colonne à droite : le jardin sait quelle part de l'écran il couvre.
const measureInset = () => {
	const app = $('#app').getBoundingClientRect(), r = $('#home').getBoundingClientRect();
	garden.insetRight = r.width && r.left > app.left + 40 && r.right > app.right - 60 ? Math.max(0, app.right - r.left) : 0;
};
new ResizeObserver(measureInset).observe($('#app'));
measureInset();
$('#app').classList.toggle('no-fx', !fxOn());
probeFx();
garden.onActive = () => { $('#hud-day').textContent = cellName(here(), garden.active); };
announceSpecies(firstRun);
updateSpeciesDot();
persist(true);
if (Tuning.preview) {
	// GDD preview: no tutorial, sensor, permission or harvest. The scene module drives a temporary garden.
	state.seenIntro = state.onboarded = state.harvestDeclined = state.notifyAsked = state.tracking = true;
	state.tips = Object.fromEntries(TIPS.map(t => [t.id, Date.now()]));
	import('./gdd-preview.js').then(m => m.startPreview({
		garden, state, sky, sound, eco, species, places, debugPanel,
		session: () => session, onSample, endSession, runIdle, showIdleRecap, announceSpecies,
		renderHud, renderStatus, renderDaily, showDaily, closeModal,
		openDeco, closeDeco, openJournal, closeJournal, openOptions, closeOptions, startPlacing, endPlacing, endQuest,
		setQuest: id => { quest = id; state.lastQuest = id; $('#quest-name').textContent = SPECIES_BY_ID[id].name; $('#quest').hidden = false; },
	})).catch(e => console.warn('GDD preview', e));
} else {
	if (!sky.override) sky.start();
	resumeTracking();
	// Une partie de test du joueur simulé commence juste après l'introduction.
	if (state.intro) simSkipIntro();
	renderSimBar();
	if (!state.intro) applySkyMode();
	if (state.intro) {
		// Le temps de l'introduction, il fait beau, quel que soit le vrai ciel.
		const realSky = sky.override;
		sky.override = 'clear';
		sky.apply(false);
		startIntro({
			garden, state, sound, DEV, persist, renderHud, updateSpeciesDot, countPurse, showModal, speciesOf, SPECIES_BY_ID,
			enableTracking: () => { sky.locate(true); return enableTracking(true); },
			trackingOk: () => !!state.tracking && !!(tracking.motion || tracking.gps),
			addMeters: m => { addMeters(m); renderHud(); },
			moving: () => !!session,
			simWalk: () => {
				if (tracking.sim) return;
				tracking.sim = new SimTracker(s => onSample({ ...s, sim: true }), () => {});
				tracking.sim.speedKmh = 5;
				tracking.sim.timeScale = 1;
				tracking.sim.start();
			},
			onDone: () => { sky.override = realSky; sky.apply(); renderDaily(); renderStatus(); setTimeout(offerHarvest, 600); },
		});
	} else if (firstRun && !state.sim) {
		// L'ancien tutoriel, pour une partie sans introduction (jamais pour une partie du joueur simulé).
		setTimeout(() => coach(0), 1600);
	} else {
		runIdle(true);
		maybeHarvest().then(() => (newDay() ? setTimeout(() => whenFree(() => showDaily(true)), 300) : whenFree(showIdleRecap)));
		// À chaque lancement, tant que rien ne relit les pas appli fermée.
		if (!state.harvestSource) setTimeout(() => whenFree(() => $('#modal').hidden && offerHarvest(true)), 2500);
	}
	// Hooks of the studio kit: the new version message waits until nothing is open or recording, the save is written first.
	window.GameKit = {
		lang: () => 'fr',
		isIdle: () => !session && !placing && !garden.camBusy() && !$('#deco').classList.contains('open'),
		save: () => persist(true),
	};
}
