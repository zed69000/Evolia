// L'introduction d'une nouvelle partie, jouée dans le jardin lui-même, sans HUD : une minuscule motte de terre, un
// oiseau qui laisse tomber une graine, quelques pas qui la font fleurir, une abeille qui passe. Puis le logo, et un
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
		if (over || !(e.target instanceof Element)) return;
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

	// ─── 1. La motte de terre, l'oiseau, la graine ───
	async function scene() {
		step('scene');
		const p = center();
		garden.cam.cx = p.x; garden.cam.cy = p.y; garden.cam.z = 2.4;
		garden.flyTo(p.x, p.y, 2.4);
		if (flowerOf()) return;
		await wait(1800);
		await birdPass(p);
		const [ox, oy] = cellOrigin(0);
		const f = garden.spawn(state.place, 'fleur', 0.03, { x: p.x - ox, y: p.y - oy + 12 }, 0);
		f.intro = true;
		f.single = true;
		f.seed = FLOWER_SEED; f.variant = { species: FLOWER };
		garden.burst(p.x, p.y + 12, 8, '#9A7448');
		c.persist(true);
		await wait(900);
	}

	/** Un oiseau traverse la vue ; à mi-chemin, une graine tombe sur la motte. */
	function birdPass(p) {
		return new Promise(res => {
			const t0 = performance.now(), D = 3600, drop = 0.42, fall = 900;
			setTimeout(() => c.sound.birdCall?.(-0.4), D * 0.2);
			setTimeout(() => c.sound.seedFall?.(), D * drop);
			const from = { x: p.x - 420, y: p.y - 230 }, to = { x: p.x + 420, y: p.y - 170 };
			let landed = false;
			garden.introFx = ctx => {
				const t = (performance.now() - t0) / D;
				if (t <= 1) {
					const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 30;
					drawBird(ctx, x, y, performance.now() / 1000);
					// Son ombre, très pâle, glisse sur le sol.
					ctx.fillStyle = 'rgba(60,50,40,0.10)';
					ctx.beginPath(); ctx.ellipse(x, p.y + 30, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
				}
				// La graine : lâchée par l'oiseau, elle tombe sur la motte.
				const ts = (performance.now() - t0 - drop * D) / fall;
				if (ts > 0 && ts < 1) {
					const sx = from.x + (to.x - from.x) * drop, sy = from.y + (to.y - from.y) * drop - Math.sin(drop * Math.PI) * 30;
					const k = ease(ts), gx = sx + (p.x - sx) * k, gy = sy + (p.y + 12 - sy) * ts * ts;
					ctx.fillStyle = '#6B4A2E';
					ctx.beginPath(); ctx.ellipse(gx, gy, 2.6, 1.8, ts * 6, 0, Math.PI * 2); ctx.fill();
				} else if (ts >= 1 && !landed) { landed = true; c.sound.seedLand?.(); res(); }
				if (t > 1 && landed) garden.introFx = null;
			};
		});
	}

	function drawBird(ctx, x, y, t) {
		const flap = Math.sin(t * 16) * 0.9;
		ctx.save();
		ctx.translate(x, y);
		ctx.strokeStyle = 'rgba(70,52,40,0.9)';
		ctx.fillStyle = 'rgba(92,70,52,0.92)';
		ctx.lineCap = 'round';
		ctx.lineWidth = 3.2;
		// Les ailes, qui battent.
		ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-10, -10 * flap, -20, -4 - 12 * flap); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(10, -10 * flap, 20, -4 - 12 * flap); ctx.stroke();
		// Le corps, la tête et le bec.
		ctx.beginPath(); ctx.ellipse(0, 1, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
		ctx.beginPath(); ctx.arc(9, -1, 3.6, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#E3A33A';
		ctx.beginPath(); ctx.moveTo(12, -2); ctx.lineTo(16, -0.5); ctx.lineTo(12, 0.5); ctx.fill();
		ctx.restore();
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
		say('Un oiseau a laissé tomber une graine.<br><b>Marche quelques pas</b> pour la faire pousser.', buttons, 'center');
		let heard = Math.floor(f.growth * 8);
		await until(() => {
			if (over) return true;
			f.growth = Math.max(f.growth, Math.min(1, 0.03 + (state.totals.distance - d0) / WALK_M));
			// Une petite note à chaque huitième de croissance : on entend la fleur se déplier.
			const k = Math.floor(f.growth * 8);
			if (k > heard && f.growth < 1) { heard = k; c.sound.sprout?.(f.growth); }
			return f.growth >= 1;
		});
		if (over) throw new Skip();
		delete state.introD0;
		const p = center();
		garden.burst(p.x, p.y - 20, 18, '#F4C23E');
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

	// ─── 4. La vue s'éloigne, le terrain s'étend un peu, le logo apparaît ───
	async function logo() {
		cap.hidden = true;
		const p = center(), z0 = garden.cam.z, z1 = 1.3;
		for (let k = 1; k <= 45; k++) {
			const e = ease(k / 45);
			garden.flyTo(p.x, p.y, z0 + (z1 - z0) * e);
			if (k === 18) (place.cellSize ??= {})[0] = 0.25;
			if (k === 32) place.cellSize[0] = 0.4;
			await wait(110);
		}
		const el = document.createElement('div');
		el.className = 'intro-logo';
		el.innerHTML = `<img src="assets/logo-detoure.png" alt="Evolia"><p>${TAGLINE}</p>`;
		app.append(el);
		void el.offsetWidth;
		el.classList.add('in');
		// L'ouverture musicale : la musique de l'introduction s'efface un instant pour la laisser sonner.
		c.sound.setMood?.('hush');
		c.sound.fanfare?.();
		await wait(4200);
		c.sound.setMood?.('joy');
		el.classList.remove('in');
		await wait(1500);
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
			<p>Pour attirer des abeilles, il faut des <b>fleurs</b> : plus il y en a, plus il en vient. Et les fleurs poussent quand tu bouges.</p>
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
