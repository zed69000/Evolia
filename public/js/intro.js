// L'introduction d'une nouvelle partie, jouée dans le jardin lui-même, sans HUD, d'après le story-board de Seb : une
// graine tombe du ciel et se plante (« poc »), une petite pousse sort, un rayon de soleil apparaît ; la caméra respire
// et se rapproche à mesure que les pas font grandir la fleur ; une abeille vient ; le logo apparaît au-dessus de la
// fleur pendant qu'un insecte passe ; puis la vue s'éloigne. Ensuite, un
// tutoriel qui se fait plutôt qu'il ne se raconte : une seule consigne à la fois, sur ce qu'on est en train de faire
// (ouvrir les espèces, lire la fiche de l'abeille, voir le nectar arriver dans la bourse, acheter sa première ruche,
// regarder l'icône d'activité passer à la marche).
//
// L'étape en cours est gardée dans state.intro : si l'appli est fermée en route, on reprend là où on en était.

import { cellOrigin } from './garden.js';

/** Les mètres de marche qui font fleurir la première graine (une vingtaine de secondes). */
const WALK_M = 20;
/** Le nectar que rapporte la toute première fiche lue : de quoi s'offrir la première ruche. */
export const INTRO_NECTAR = 100;
// La fleur de l'introduction, la même pour tous les joueurs : un coquelicot, toujours dessiné pareil.
export const FLOWER = 'coquelicot', FLOWER_SEED = 20261111;
const TAGLINE = 'À chacun de tes pas, la nature s’éveille.';

const wait = ms => new Promise(r => setTimeout(r, ms));
const until = (test, every = 250) => new Promise(r => {
	if (test()) return r();
	const id = setInterval(() => { if (test()) { clearInterval(id); r(); } }, every);
});
const ease = t => t * t * (3 - 2 * t);

class Skip extends Error {}

export function startIntro(c) {
	const { garden, state } = c;
	const $ = s => document.querySelector(s);
	const app = $('#app');
	const place = garden.place;
	app.classList.add('intro');
	// L'interface ne reste jamais effacée par un geste d'avant (glisser, pincer) : la consigne doit se voir.
	app.classList.remove('peek');
	let over = false;
	// Une musique pleine d'élan pour l'introduction ; la musique calme du jardin revient à la fin.
	c.sound.setMood?.('joy');
	// La nuit, les abeilles dorment : le temps de l'introduction, on la joue en plein jour.
	const dayForced = garden.hourOverride == null && garden.night() > 0.2;
	if (dayForced) garden.hourOverride = 11;

	// La consigne : une petite carte, une phrase, parfois un bouton.
	const cap = document.createElement('div');
	cap.className = 'intro-cap card';
	cap.hidden = true;
	app.append(cap);
	// Pas de bouton pour passer : l'introduction ne s'efface qu'une fois faite en entier. Si l'appli se ferme en
	// route, elle reprend à l'étape où l'on s'était arrêté.

	/** Affiche une consigne. Avec des boutons, la promesse attend celui qui termine l'étape. */
	// La pointe de la bulle montre où regarder : un bouton, la bourse, ou le jardin au milieu de l'écran.
	let aim = null;
	const updateTail = () => {
		const free = () => {
			cap.classList.remove('placed');
			cap.style.left = cap.style.top = '';
		};
		if (cap.hidden || !aim) { free(); cap.classList.add('no-tail'); return; }
		const A = app.getBoundingClientRect();
		if (aim === 'center') {
			// Regarder le jardin : la bulle reste en bas, sa pointe vers le milieu de l'écran.
			free();
			const r = cap.getBoundingClientRect();
			cap.classList.remove('no-tail');
			cap.classList.add('tail-up');
			cap.style.setProperty('--tail-x', `${Math.max(26, Math.min(r.width - 26, A.left + A.width / 2 - r.left))}px`);
			return;
		}
		const el = $(aim);
		if (!el || el.offsetParent === null) { free(); cap.classList.add('no-tail'); return; }
		// Un bouton, une carte d'un menu : la bulle se pose juste à côté (dessous, ou dessus s'il n'y a pas la place),
		// sa pointe sur lui.
		const e = el.getBoundingClientRect(), w = cap.offsetWidth, h = cap.offsetHeight;
		let top = e.bottom - A.top + 14, below = true;
		if (top + h > A.height - 8) { top = e.top - A.top - h - 14; below = false; }
		const left = Math.max(10, Math.min(A.width - w - 10, e.left - A.left + e.width / 2 - w / 2));
		cap.classList.add('placed');
		cap.style.left = `${left}px`;
		// Jamais hors de l'écran : si le bouton est encore plus bas (page pas défilée), la bulle attend en bas, pointe vers lui.
		cap.style.top = `${Math.max(8, Math.min(A.height - h - 8, top))}px`;
		cap.classList.remove('no-tail');
		cap.classList.toggle('tail-up', below);
		cap.style.setProperty('--tail-x', `${Math.max(26, Math.min(w - 26, e.left - A.left + e.width / 2 - left))}px`);
	};
	const tailTimer = setInterval(updateTail, 200);
	// Pas à pas : pendant l'introduction, on ne peut toucher que ce que la bulle montre (et ses boutons) ; tout le
	// reste est bloqué jusqu'à son tour, pour qu'aucun geste ne casse le tutoriel.
	let allow = null;
	const guard = e => {
		// Seul le jeu est guidé : ce qui est posé hors de #app (rapport de bug du kit, mise à jour) reste cliquable.
		if (over || !(e.target instanceof Element) || !app.contains(e.target)) return;
		const ok = ['.intro-cap'];
		if (allow) ok.push(allow);
		if (app.classList.contains('placing')) ok.push('#placing', '#garden');
		if (!$('#modal').hidden) ok.push('#modal');
		if (e.target.closest(ok.join(','))) return;
		e.preventDefault();
		e.stopImmediatePropagation();
	};
	// Seuls les « touchers » sont bloqués (clic) : glisser pour faire défiler une fiche ou une page reste libre, sinon
	// la page paraît figée. Le relâcher du doigt passe toujours : bloqué, le jardin croyait le doigt encore posé (deux
	// doigts : l'interface restait effacée). C'est le jardin qui ignore les touchers pendant l'introduction.
	const GUARDED = ['click', 'dblclick', 'contextmenu'];
	for (const ev of GUARDED) document.addEventListener(ev, guard, { capture: true, passive: false });
	const say = (html, buttons = [], target = null, allowed) => new Promise(res => {
		aim = target;
		allow = allowed !== undefined ? allowed : target && target !== 'center' ? target : null;
		cap.innerHTML = `<p>${html}</p>${buttons.length ? `<div class="intro-actions">${buttons.map((b, i) => `<button class="btn ${i ? 'ghost' : 'primary'} small" data-i="${i}">${b.label}</button>`).join('')}</div>` : ''}`;
		cap.hidden = false;
		cap.classList.remove('in');
		void cap.offsetWidth;
		cap.classList.add('in');
		// Une page ouverte (fiche, espèces…) s'arrête au-dessus de la consigne : elle ne cache jamais le texte.
		app.style.setProperty('--cap-h', `${cap.offsetHeight + 24}px`);
		updateTail();
		cap.onclick = e => {
			const el = e.target.closest('[data-i]');
			if (!el) return;
			const b = buttons[Number(el.dataset.i)];
			b.run?.();
			if (b.once) el.remove();
			if (b.stay) return;
			res(b);
		};
		if (!buttons.some(b => !b.stay)) res();
	});
	const step = s => {
		if (over) throw new Skip();
		state.intro = s;
		c.persist(true);
	};
	const center = () => { const b = garden.blob(0); return { x: b.cx, y: b.cy }; };
	const flowerOf = () => place.plants.find(p => p.intro);

	// ─── La mise en scène de l'ouverture : caméra, rayons de soleil, petits effets dessinés par-dessus le jardin ───
	const Z_FAR = 1.7, Z_NEAR = 3.2;
	// La caméra vise la fleur : `z` son zoom, `lift` la hauteur visée au-dessus du pied, `rays` les rayons (0 à 1).
	const cine = { on: false, z: Z_FAR, lift: 0, down: 0, rays: 0, raysTo: 0, kick: 0 };
	const fx = new Set();
	const now = () => performance.now() / 1000;
	garden.introFx = ctx => { drawRays(ctx); for (const f of fx) f(ctx); };
	/** La caméra respire : un souffle lent sur le zoom, une dérive à peine visible. Elle suit `cine` en douceur. */
	function cineLoop() {
		if (over || !cine.on) return;
		const t = now(), p = center();
		cine.kick *= 0.9;
		cine.rays += (cine.raysTo - cine.rays) * 0.025;
		const z = cine.z * (1 + 0.014 * Math.sin(t * 0.85)) * (1 + cine.kick);
		garden.flyTo(p.x + Math.sin(t * 0.37) * 2.4 / z, p.y + 12 - cine.lift + cine.down + Math.cos(t * 0.29) * 1.8 / z, z);
		requestAnimationFrame(cineLoop);
	}
	const cineOn = () => { if (!cine.on) { cine.on = true; requestAnimationFrame(cineLoop); } };
	/** La fleur grandit : la caméra se rapproche et monte avec sa tête. */
	const cineFollow = f => {
		const g = Math.max(0, Math.min(1, f.growth));
		cine.z = Z_FAR + (Z_NEAR - Z_FAR) * ease(g);
		cine.lift = -(garden.meta.get(f.id)?.top ?? -70 * g) * 0.5;
	};

	/** Des rayons de soleil en biais, depuis le haut à droite, qui ondulent doucement (dessinés en pixels d'écran). */
	function drawRays(ctx) {
		if (cine.rays < 0.01) return;
		const cw = ctx.canvas.width, ch = ctx.canvas.height, t = now();
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		for (let i = 0; i < 6; i++) {
			const a = cine.rays * (0.24 + 0.12 * Math.sin(t * 0.7 + i * 1.9));
			if (a <= 0) continue;
			const x0 = cw * (0.22 + 0.19 * i) + Math.sin(t * 0.23 + i * 2.1) * cw * 0.025, w = cw * (0.05 + 0.035 * ((i * 7) % 3)), slant = ch * 0.62;
			const g = ctx.createLinearGradient(x0, 0, x0 - slant, ch);
			g.addColorStop(0, `rgba(255,206,92,${a})`);
			g.addColorStop(0.55, `rgba(255,222,130,${a * 0.6})`);
			g.addColorStop(1, 'rgba(255,240,190,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(x0, -10); ctx.lineTo(x0 + w, -10); ctx.lineTo(x0 + w * 1.7 - slant, ch); ctx.lineTo(x0 - w * 0.7 - slant, ch);
			ctx.fill();
		}
		// Des poussières dorées flottent dans la lumière.
		for (let i = 0; i < 16; i++) {
			const u = (i * 0.618 + t * (0.012 + 0.004 * (i % 4))) % 1, v = (i * 0.371 + t * 0.008 * (1 + (i % 3))) % 1;
			const x = cw * (1.05 - u * 1.1) + Math.sin(t * 0.8 + i) * cw * 0.02, y = ch * (v * 0.9) + u * ch * 0.25;
			const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.7);
			ctx.fillStyle = `rgba(255,236,170,${cine.rays * 0.55 * tw})`;
			ctx.beginPath(); ctx.arc(x, y, cw * (0.0022 + 0.0016 * (i % 3)), 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}

	// ─── 1. Une graine tombe du ciel et se plante ───
	async function scene() {
		step('scene');
		const p = center();
		garden.cam.cx = p.x; garden.cam.cy = p.y + 12; garden.cam.z = Z_FAR;
		cineOn();
		if (flowerOf()) { cine.raysTo = 1; cineFollow(flowerOf()); return; }
		await wait(1500);
		await seedDrop(p);
		const [ox, oy] = cellOrigin(0);
		const f = garden.spawn(state.place, 'fleur', 0.03, { x: p.x - ox, y: p.y - oy + 12 }, 0);
		f.intro = true;
		f.single = true;
		f.seed = FLOWER_SEED; f.variant = { species: FLOWER };
		c.persist(true);
		await wait(700);
		// Une petite pousse sort de terre, et le premier rayon de soleil arrive sur elle.
		cine.raysTo = 1;
		c.sound.sprout?.(0.1);
		for (let k = 1; k <= 20; k++) { f.growth = Math.max(f.growth, 0.03 + 0.07 * ease(k / 20)); cineFollow(f); await wait(60); }
		await wait(900);
	}

	/** La graine tombe tout droit, en brillant ; elle se plante avec un petit choc (« poc »). */
	function seedDrop(p) {
		return new Promise(res => {
			const t0 = performance.now(), FALL = 1250, gy = p.y + 12, top = gy - 300;
			c.sound.seedFall?.();
			let hit = 0;
			const draw = ctx => {
				const ms = performance.now() - t0, t = ms / FALL;
				if (t < 1) {
					const y = top + (gy - top) * t * t;
					// Sa traînée, pâle, et la graine qui tourne.
					const g = ctx.createLinearGradient(0, y - 70, 0, y);
					g.addColorStop(0, 'rgba(244,194,62,0)'); g.addColorStop(1, 'rgba(244,194,62,0.55)');
					ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
					ctx.beginPath(); ctx.moveTo(p.x, y - 70 * Math.min(1, t * 3)); ctx.lineTo(p.x, y); ctx.stroke();
					ctx.fillStyle = '#6B4A2E';
					ctx.beginPath(); ctx.ellipse(p.x, y, 3, 2.1, ms / 90, 0, Math.PI * 2); ctx.fill();
					// Son éclat : une petite étoile qui scintille autour d'elle.
					const k = 5 + 2.5 * Math.sin(ms / 70);
					ctx.strokeStyle = `rgba(255,236,170,${0.75 + 0.25 * Math.sin(ms / 50)})`; ctx.lineWidth = 1.1;
					ctx.beginPath();
					for (let i = 0; i < 4; i++) { const a = ms / 400 + i * Math.PI / 4; ctx.moveTo(p.x - Math.cos(a) * k, y - Math.sin(a) * k); ctx.lineTo(p.x + Math.cos(a) * k, y + Math.sin(a) * k); }
					ctx.stroke();
					return;
				}
				if (!hit) {
					// Le choc : la terre saute, la caméra sursaute un peu.
					hit = performance.now();
					c.sound.seedLand?.();
					garden.burst(p.x, gy, 14, '#9A7448');
					garden.burst(p.x, gy - 4, 6, '#F4C23E');
					cine.kick = 0.07;
					try { navigator.vibrate?.(18); } catch (e) { /* pas de vibreur */ }
					res();
				}
				// Deux ondes de poussière qui s'écartent au sol.
				const h = (performance.now() - hit) / 650;
				if (h >= 1) { fx.delete(draw); return; }
				for (const [d, w] of [[0, 2.2], [0.18, 1.3]]) {
					const u = h - d;
					if (u <= 0) continue;
					const r = 6 + 34 * ease(Math.min(1, u));
					ctx.strokeStyle = `rgba(122,92,58,${0.5 * (1 - u)})`; ctx.lineWidth = w;
					ctx.beginPath(); ctx.ellipse(p.x, gy, r, r * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
				}
			};
			fx.add(draw);
		});
	}

	/** Un insecte traverse le bas de l'image pendant que le logo est là : une coccinelle qui trottine. */
	function bugPass(p, ms = 5200) {
		const t0 = performance.now(), y = p.y + 46;
		const draw = ctx => {
			const t = (performance.now() - t0) / ms;
			if (t >= 1 || over) { fx.delete(draw); return; }
			const x = p.x - 150 + 300 * t, step = Math.sin(t * 90);
			ctx.save();
			ctx.translate(x, y + Math.abs(step) * 0.5);
			ctx.strokeStyle = 'rgba(40,30,24,0.85)'; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
			for (const [lx, ph] of [[-2, 0], [0, 2], [2, 4]]) {
				const k = Math.sin(t * 90 + ph) * 1.2;
				ctx.beginPath(); ctx.moveTo(lx, 0.5); ctx.lineTo(lx + k, 3); ctx.stroke();
			}
			ctx.fillStyle = '#C8342B';
			ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 2.7, 0, Math.PI, 0); ctx.fill();
			ctx.fillStyle = '#2A211C';
			ctx.beginPath(); ctx.arc(3.3, -0.9, 1.35, 0, Math.PI * 2); ctx.fill();
			for (const [dx, dy] of [[-1.6, -1.5], [0.5, -1.9], [-0.4, -0.7], [1.7, -0.9]]) { ctx.beginPath(); ctx.arc(dx, dy, 0.45, 0, Math.PI * 2); ctx.fill(); }
			ctx.restore();
		};
		fx.add(draw);
	}

	// ─── 2. Quelques pas : la fleur pousse ───
	async function walk() {
		step('walk');
		const f = flowerOf();
		const d0 = (state.introD0 ??= state.totals.distance);
		// Le suivi des pas est indispensable : on ne va pas plus loin tant qu'il n'est pas activé (et qu'il marche).
		if (!c.trackingOk()) {
			let devPass = false, tried = false;
			const ask = () => say(tried
				? 'Le suivi n’a pas pu démarrer.<br>Autorise le <b>mouvement</b> et la <b>position</b> pour Evolia, puis réessaie.'
				: 'Pour que tes pas fassent pousser la graine, Evolia doit les suivre.<br><b>Active le suivi de tes pas</b> pour continuer.', [
				{ label: tried ? 'Réessayer' : 'Activer le suivi de mes pas', stay: true, run: async () => { await c.enableTracking(); if (!c.trackingOk()) { tried = true; ask(); } } },
				...(c.DEV ? [{ label: 'Passer (test)', stay: true, run: () => { devPass = true; } }] : []),
			], 'center');
			ask();
			await until(() => over || devPass || c.trackingOk());
			if (over) throw new Skip();
		}
		const buttons = [];
		if (c.DEV) buttons.push({ label: 'Simuler 5 m', stay: true, run: () => c.addMeters(5) });
		say('Une graine vient de se planter.<br><b>Marche quelques pas</b> pour la faire pousser.', buttons, 'center');
		let heard = Math.floor(f.growth * 8);
		await until(() => {
			if (over) return true;
			f.growth = Math.max(f.growth, Math.min(1, 0.1 + 0.9 * (state.totals.distance - d0) / WALK_M));
			// Plus elle pousse, plus on s'approche.
			cineFollow(f);
			// Une petite note à chaque huitième de croissance : on entend la fleur se déplier.
			const k = Math.floor(f.growth * 8);
			if (k > heard && f.growth < 1) { heard = k; c.sound.sprout?.(f.growth); }
			return f.growth >= 1;
		});
		if (over) throw new Skip();
		delete state.introD0;
		const p = center();
		cineFollow(f);
		cine.kick = 0.04;
		garden.burst(p.x, p.y + 12 - cine.lift * 1.7, 22, '#F4C23E');
		c.sound.chime(3);
		state.species[c.speciesOf(f)] ??= Date.now();
		say('Elle a fleuri !', [], 'center');
		await wait(2400);
	}

	// ─── 3. Une abeille passe ───
	async function bee() {
		step('bee');
		const P = garden.pdata?.[0];
		const b = P ? garden.newCritter(c.SPECIES_BY_ID.abeille, P) : null;
		if (b) { b.intro = true; garden.insects.push(b); }
		say('Une abeille vient la butiner…', [], 'center');
		for (const t of [600, 3200, 6200]) setTimeout(() => !over && c.sound.beeBuzz?.(t === 3200 ? 0.2 : -0.2), t);
		await wait(9000);
		if (b) b.leaving = true;
		c.sound.beeBuzz?.(0.5);
		say('… puis elle repart, chargée de pollen.', [], 'center');
		state.species.abeille ??= Date.now();
		c.persist(true);
		await wait(3500);
	}

	// ─── 4. Le logo apparaît au-dessus de la fleur, un insecte passe ; puis la vue s'éloigne et le terrain s'étend ───
	async function logo() {
		cap.hidden = true;
		const p = center();
		// La fleur descend un peu dans l'image pour laisser sa place au logo, au-dessus d'elle.
		cineOn();
		cine.raysTo = 1;
		for (let k = 1; k <= 20; k++) { cine.z = Z_NEAR - 0.75 * ease(k / 20); cine.down = -62 * ease(k / 20); await wait(40); }
		const el = document.createElement('div');
		el.className = 'intro-logo over off';
		el.innerHTML = `<img src="assets/logo-detoure.png" srcset="assets/logo-detoure.png 1x, assets/logo-detoure@2x.webp 2x" alt="Evolia"><p>${TAGLINE}</p>`;
		app.append(el);
		void el.offsetWidth;
		el.classList.add('in');
		el.classList.remove('off');
		// L'ouverture musicale : la musique de l'introduction s'efface un instant pour la laisser sonner.
		c.sound.setMood?.('hush');
		c.sound.fanfare?.();
		setTimeout(() => !over && bugPass(p), 500);
		await wait(4600);
		c.sound.setMood?.('joy');
		el.classList.remove('in');
		el.classList.add('off');
		// Le mouvement inverse : la vue s'éloigne, les rayons s'en vont, le terrain s'étend.
		cine.on = false;
		cine.raysTo = 0;
		const z0 = garden.cam.z, y0 = garden.cam.cy, z1 = 1.3;
		for (let k = 1; k <= 45; k++) {
			const e = ease(k / 45);
			cine.rays *= 0.93;
			garden.flyTo(p.x, y0 + (p.y - y0) * e, z0 + (z1 - z0) * e);
			if (k === 18) (place.cellSize ??= {})[0] = 0.25;
			if (k === 32) place.cellSize[0] = 0.4;
			await wait(110);
		}
		cine.rays = 0;
		el.remove();
	}

	// ─── 5. Les espèces : ouvrir, lire la fiche de l'abeille ───
	async function species() {
		step('species');
		const f = flowerOf();
		if (f) state.species[c.speciesOf(f)] ??= Date.now();
		state.species.abeille ??= Date.now();
		c.updateSpeciesDot();
		app.classList.add('i-sheet');
		const btn = $('#btn-species');
		btn.classList.add('i-on', 'ui-new', 'tip-glow');
		if (!state.speciesSeen?.abeille) {
			say('Deux espèces sont venues dans ton jardin.<br>Touche <b>Espèces</b> pour les découvrir.', [], '#btn-species');
			await until(() => over || $('#species').classList.contains('open'));
			btn.classList.remove('tip-glow');
			say('Touche l’<b>abeille</b> pour lire sa fiche :<br>lire une fiche te rapporte du <b>nectar</b>, ta première monnaie.', [], '#species [data-sp="abeille"]');
			await until(() => {
				$('#species [data-sp="abeille"]')?.classList.add('tip-glow');
				return over || state.speciesSeen?.abeille;
			});
			if (over) throw new Skip();
			say('Voilà ton premier nectar !<br>Lis sa fiche, puis ferme-la en bas pour le ramasser.', [], '#species .sp-close-bottom');
		}
		btn.classList.remove('tip-glow');
		await until(() => over || !$('#species').classList.contains('open'));
	}

	// ─── 6. La bourse apparaît, le nectar y arrive ───
	async function purse() {
		step('purse');
		cap.hidden = true;
		// La bourse apparaît vide ; une volée de gouttes de nectar la rejoint, et le compteur monte avec elles
		// jusqu'à 100, assez lentement pour qu'on le voie défiler.
		const N = 12, GAP = 140, FLY = 950;
		c.countPurse(0, FLY, (N - 1) * GAP + 500);
		app.classList.add('i-hud');
		c.renderHud();
		await flyCoins(N, GAP, FLY);
		$('#hud-steps').classList.add('ui-new');
		c.sound.chime(2);
		await wait(700);
		await say('Voici ta <b>bourse</b> : le nectar que tu gagnes s’y range.', [{ label: 'Compris' }], '#hud-steps', null);
	}

	/**
	 * Une volée de gouttes de nectar part du milieu de l'écran et rejoint la bourse, l'une après l'autre, en courbe,
	 * avec une traînée légère.
	 */
	function flyCoins(n, gap, fly) {
		const to = $('#hud-steps').getBoundingClientRect(), box = app.getBoundingClientRect();
		const tx = to.left - box.left + to.width / 2, ty = to.top - box.top + to.height / 2;
		const coins = Array.from({ length: n }, (_, i) => {
			const el = document.createElement('i');
			el.className = 'intro-coin';
			app.append(el);
			const sx = box.width / 2 + (Math.random() - 0.5) * 70, sy = box.height * 0.46 + (Math.random() - 0.5) * 40;
			return { el, sx, sy, cx: (sx + tx) / 2 + (Math.random() - 0.5) * 120, cy: Math.min(sy, ty) - 60 - Math.random() * 80, t0: i * gap, trail: 0 };
		});
		const start = performance.now();
		return new Promise(res => {
			const frame = () => {
				const now = performance.now() - start;
				let alive = false;
				for (const k of coins) {
					const t = (now - k.t0) / fly;
					if (t < 0) { k.el.style.opacity = '0'; alive = true; continue; }
					if (t >= 1) { if (k.el.isConnected) k.el.remove(); continue; }
					alive = true;
					const e = t * t * (3 - 2 * t), u = 1 - e;
					const x = u * u * k.sx + 2 * u * e * k.cx + e * e * tx, y = u * u * k.sy + 2 * u * e * k.cy + e * e * ty;
					k.el.style.opacity = '1';
					k.el.style.left = `${x}px`;
					k.el.style.top = `${y}px`;
					k.el.style.transform = `scale(${1 - 0.4 * e})`;
					// La traînée : de petits points dorés qui s'effacent derrière la goutte.
					if (now - k.trail > 45) {
						k.trail = now;
						const dot = document.createElement('i');
						dot.className = 'intro-trail';
						dot.style.left = `${x}px`;
						dot.style.top = `${y}px`;
						app.append(dot);
						setTimeout(() => dot.remove(), 500);
					}
				}
				if (alive) requestAnimationFrame(frame); else res();
			};
			requestAnimationFrame(frame);
		});
	}

	// ─── 7. La première ruche ───
	const hasHive = () => garden.items.some(it => it.kind === 'ruche');
	async function hive() {
		step('hive');
		(state.ui ??= {})['#btn-deco'] = Date.now();
		const deco = $('#btn-deco');
		deco.classList.remove('ui-locked');
		deco.classList.add('i-on', 'ui-new');
		if (!hasHive()) {
			deco.classList.add('tip-glow');
			say('Avec ce nectar, offre une <b>ruche</b> à tes abeilles.<br>Touche <b>Aménager</b>.', [], '#btn-deco');
			await until(() => over || hasHive() || $('#deco').classList.contains('open'));
			deco.classList.remove('tip-glow');
			say('Choisis la <b>ruche</b>, puis pose-la dans ton jardin.', [], '#deco [data-buy="ruche"]');
			await until(() => {
				$('#deco [data-buy="ruche"]')?.classList.add('tip-glow');
				return over || hasHive();
			});
			if (over) throw new Skip();
			cap.hidden = true;
			await wait(1400);
		}
		deco.classList.remove('tip-glow');
		await beeHome();
		c.showModal(`<h2>Ta ruche</h2>
			<p>Elle accueille <b>3 abeilles</b> pour commencer. Elles font du <b>miel</b>, surtout quand tu bouges, et tu pourras le troquer contre du nectar. Pour en accueillir plus, tu l’amélioreras ou tu poseras une autre ruche.</p>
			<p>Le <b>cercle doré</b> autour d’elle, c’est là que tes abeilles vont butiner : chaque fleur qui pousse dedans lui fait produire plus. Et les fleurs poussent quand tu bouges.</p>
			<p>Touche ta ruche à tout moment pour revoir son cercle.</p>
			<button class="btn primary" data-close>Compris</button>`);
		await until(() => over || $('#modal').hidden);
	}

	/** On regarde de près une abeille butiner, puis rentrer dans la ruche : c'est là qu'elle fait le miel. */
	async function beeHome() {
		const h = garden.items.find(it => it.kind === 'ruche');
		const P = garden.pdata?.[0];
		if (!h || !P) return;
		garden.flyTo(h.x, h.y - 40, 2.2);
		const b = garden.newCritter(c.SPECIES_BY_ID.abeille, P);
		if (!b) return;
		for (const o of garden.insects) if (o.intro) o.gone = true;
		b.intro = true;
		b.visits = 8; // chargée après une fleur : elle rentre tout de suite
		garden.insects.push(b);
		say('Ton abeille butine, puis rapporte son nectar à la ruche.<br>C’est là qu’elle fait le <b>miel</b>.', [], 'center');
		const t0 = Date.now();
		const buzz = setInterval(() => { if (over || b.hidden) clearInterval(buzz); else c.sound.beeBuzz?.(Math.random() * 0.6 - 0.3); }, 3500);
		c.sound.beeBuzz?.(0);
		await until(() => over || b.hidden || Date.now() - t0 > 25000);
		clearInterval(buzz);
		await wait(1800);
		b.gone = true;
	}

	// ─── 8. L'icône d'activité ───
	async function activity() {
		step('activity');
		const act = $('#hud-act');
		act.classList.add('tip-glow');
		say('Ici, ton <b>activité</b> : au repos.<br>Fais quelques pas : l’icône passe à la marche.',
			c.DEV ? [{ label: 'Simuler une marche', once: true, stay: true, run: () => c.simWalk() }] : [], '#hud-act', null);
		await until(() => over || c.moving());
		if (over) throw new Skip();
		act.classList.remove('tip-glow');
		await wait(1500);
		await say('Tu marches : ton jardin pousse.<br>D’autres fleurs viendront, et d’autres abeilles avec elles.', [{ label: 'C’est parti' }]);
	}

	function finish(skipped = false) {
		if (over) return;
		over = true;
		garden.introFx = null;
		cine.on = false;
		c.sound.setMood?.(null);
		clearInterval(tailTimer);
		for (const ev of GUARDED) document.removeEventListener(ev, guard, { capture: true });
		(place.cellSize ??= {})[0] = Math.max(place.cellSize[0] ?? 0.4, 0.4);
		// Passée trop tôt : on donne quand même la fleur, l'abeille et de quoi s'offrir la ruche.
		if (skipped) {
			if (!flowerOf()) {
				const p = center(), [ox, oy] = cellOrigin(0);
				const f = garden.spawn(state.place, 'fleur', 1, { x: p.x - ox, y: p.y - oy + 12 }, 0);
				f.intro = true;
		f.single = true;
		f.seed = FLOWER_SEED; f.variant = { species: FLOWER };
			}
			state.species[c.speciesOf(flowerOf())] ??= Date.now();
			state.species.abeille ??= Date.now();
			if (!state.introPaid && !hasHive()) { state.introPaid = true; state.nectar = (state.nectar ?? 0) + INTRO_NECTAR; }
			(state.ui ??= {})['#btn-deco'] = Date.now();
		}
		delete state.intro;
		delete state.introD0;
		if (dayForced) garden.hourOverride = null;
		state.eco2 = true;
		state.seenIntro = true;
		place.seeded = true;
		(place.renewed ??= {}).prairie = 1;
		app.classList.remove('intro', 'i-sheet', 'i-hud');
		for (const el of document.querySelectorAll('.i-on, .tip-glow, .ui-new')) el.classList.remove('i-on', 'tip-glow', 'ui-new');
		cap.remove();
		document.querySelector('.intro-logo')?.remove();
		c.persist(true);
		c.renderHud();
		c.updateSpeciesDot();
		c.onDone();
	}

	// L'enchaînement, avec reprise à l'étape gardée.
	(async () => {
		const at = state.intro;
		const order = ['scene', 'walk', 'bee', 'species', 'purse', 'hive', 'activity'];
		const from = Math.max(0, order.indexOf(at === 'logo' ? 'species' : at));
		if (from >= 1) { (place.cellSize ??= {})[0] = Math.max(place.cellSize[0] ?? 0.15, from >= 3 ? 0.4 : 0.15); }
		if (from <= 1) { await scene(); await walk(); }
		// Reprise à l'abeille : la vue est déjà tout près de la fleur, rayons allumés.
		if (from === 2) { const f = flowerOf(), q = center(); if (f) cineFollow(f); cine.rays = cine.raysTo = 1; garden.cam.cx = q.x; garden.cam.cy = q.y + 12 - cine.lift; garden.cam.z = cine.z; cineOn(); }
		if (from <= 2) { await bee(); await logo(); }
		if (from >= 3) { const p = center(); garden.flyTo(p.x, p.y, 1.3); }
		if (from >= 4) app.classList.add('i-sheet'), $('#btn-species').classList.add('i-on');
		if (from >= 5) app.classList.add('i-hud');
		if (from <= 3) await species();
		if (from <= 4) await purse();
		if (from <= 5) await hive();
		await activity();
		finish();
	})().catch(e => { if (!(e instanceof Skip)) { console.warn('intro', e); finish(true); } });
}
