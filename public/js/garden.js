// Le jardin : fond peint, plantes, insectes, vent, heure du jour et caméra.
// Le monde fait WORLD_W unités de large ; il s'allonge vers le bas quand il n'y a plus de place.

import { rng, wash, leaf, rgba, mix, paperTexture, lerp, clamp01 } from './watercolor.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant, newVariant } from './plants.js';
import { drawCritter } from './critters.js';

const POND_PADS = [[40, -10], [58, 10], [-60, 14]];
// Hauteur de vol : l'ombre au sol est décalée d'autant.
const FLIGHT = { bee: 24, butterfly: 24, dragonfly: 24, frog: 6, hedgehog: 9 };
const CRITTER_SIZE = { hedgehog: 1.6, frog: 1.4, tit: 1.4, ladybug: 1.2 };

export const WORLD_W = 420;
const STAGES = 30;
const SWAY = { herbe: 0.09, fleur: 0.07, buisson: 0.02, arbre: 0.012 };
const MIN_Y = { herbe: 60, fleur: 100, buisson: 100, arbre: 220 };

// Couleur multipliée sur la scène selon l'heure : [heure, couleur, opacité].
const AMBIENT = [
	[0, '#1E2B4D', 0.55], [4.5, '#1E2B4D', 0.55], [6, '#F2B880', 0.25], [8, '#FFFFFF', 0],
	[17, '#FFFFFF', 0], [19, '#F4A85E', 0.25], [20.5, '#6E5A8E', 0.4], [21.5, '#1E2B4D', 0.55], [24, '#1E2B4D', 0.55],
];

function ambientAt(h) {
	for (let i = 0; i < AMBIENT.length - 1; i++) {
		const [h0, c0, a0] = AMBIENT[i], [h1, c1, a1] = AMBIENT[i + 1];
		if (h >= h0 && h <= h1) {
			const k = (h - h0) / (h1 - h0 || 1);
			return { color: mix(c0, c1, k), a: lerp(a0, a1, k) };
		}
	}
	return { color: '#FFFFFF', a: 0 };
}

function nightAt(h) {
	if (h >= 21.5 || h < 4.5) return 1;
	if (h > 20.5) return h - 20.5;
	if (h < 6) return (6 - h) / 1.5;
	return 0;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export class Garden {
	constructor(canvas, state) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.state = state;
		this.sprites = new Map();
		this.decorSprites = new Map();
		this.camY = 0;
		this.vel = 0;
		this.follow = null;
		this.followPausedUntil = 0;
		this.insects = [];
		this.particles = [];
		this.fireflies = Array.from({ length: 26 }, () => ({ x: Math.random() * WORLD_W, y: Math.random(), ph: Math.random() * 6.28, a: Math.random() * 6.28 }));
		this.paper = paperTexture(256);
		this.hourOverride = null;
		this.padTop = 0;
		this.padBottom = 0;
		this.t = 0;
		this.popAt = {};
		this.nextPopulate = 0;
		this.bgDirty = true;
		this.onTap = null;

		if (!state.plants.length) this.seedStarterGarden();
		this.resize();
		new ResizeObserver(() => this.resize()).observe(canvas);
		this.bindInput();
		this.last = performance.now();
		this.camY = Math.max(this.camMin(), (this.state.worldH - this.viewH()) * 0.35);
		requestAnimationFrame(this.frame);
	}

	// ─── Mise en page ──────────────────────────────────────────────

	resize() {
		const cssW = this.canvas.clientWidth, cssH = this.canvas.clientHeight;
		if (!cssW || !cssH) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		this.canvas.width = Math.round(cssW * dpr);
		this.canvas.height = Math.round(cssH * dpr);
		this.dpr = dpr;
		this.cs = cssW / WORLD_W;
		const S = this.cs * dpr;
		if (S !== this.S) {
			this.S = S;
			this.sprites.clear();
			this.decorSprites.clear();
			this.bgDirty = true;
			this.makeClouds();
			this.makeGlow();
		}
		this.makeVignette();
		this.paperPattern = this.ctx.createPattern(this.paper, 'repeat');
	}

	/** Hauteurs (px CSS) masquées par le bandeau du haut et la feuille du bas. */
	setPads(topCss, bottomCss) {
		this.padTop = topCss / (this.cs || 1);
		this.padBottom = bottomCss / (this.cs || 1);
	}

	viewH() { return this.canvas.clientHeight / (this.cs || 1); }
	camMin() { return -this.padTop; }
	camMax() { return Math.max(this.camMin(), this.state.worldH - this.viewH() + this.padBottom); }

	makeVignette() {
		const c = document.createElement('canvas');
		c.width = this.canvas.width; c.height = this.canvas.height;
		const g = c.getContext('2d');
		const grd = g.createRadialGradient(c.width / 2, c.height * 0.45, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height * 0.45, Math.max(c.width, c.height) * 0.75);
		grd.addColorStop(0, 'rgba(28,60,30,0)');
		grd.addColorStop(1, 'rgba(28,60,30,0.32)');
		g.fillStyle = grd;
		g.fillRect(0, 0, c.width, c.height);
		this.vignette = c;
	}

	makeClouds() {
		this.clouds = [0, 1, 2].map(i => {
			// Toile large et taches bien au centre : un bord coupé se verrait comme un rectangle.
			const w = 480, h = 340;
			const c = document.createElement('canvas');
			c.width = Math.ceil(w * this.S); c.height = Math.ceil(h * this.S);
			const g = c.getContext('2d');
			g.scale(this.S, this.S);
			const r = rng(50 + i);
			const off = () => Math.max(-1.5, Math.min(1.5, r.gauss()));
			for (let k = 0; k < 4; k++) wash(g, w / 2 + off() * 40, h / 2 + off() * 20, r.range(60, 90), r.range(40, 60), '#2E4A22', r, { layers: 8, alpha: 0.05, edge: 0, variance: 0.25 });
			return { canvas: c, w, h, x: i * 420 - 200, y: 150 + i * 380, speed: 6 + i * 2 };
		});
	}

	makeGlow() {
		const c = document.createElement('canvas');
		const n = Math.ceil(28 * this.S);
		c.width = c.height = n;
		const g = c.getContext('2d');
		const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
		grd.addColorStop(0, 'rgba(255,240,150,0.9)');
		grd.addColorStop(0.25, 'rgba(250,226,110,0.45)');
		grd.addColorStop(1, 'rgba(250,226,110,0)');
		g.fillStyle = grd;
		g.fillRect(0, 0, n, n);
		this.glow = c;
	}

	paintBg() {
		const S = this.S, H = this.state.worldH;
		const c = document.createElement('canvas');
		c.width = Math.ceil(WORLD_W * S);
		c.height = Math.ceil(H * S);
		const g = c.getContext('2d');
		g.scale(S, S);
		const r = rng(99);
		g.fillStyle = '#B5C565';
		g.fillRect(0, 0, WORLD_W, H);
		const n = Math.round((H / 1000) * 50);
		for (let i = 0; i < n; i++) {
			wash(g, r.range(-50, WORLD_W + 50), r.range(-50, H + 50), r.range(70, 200), r.range(50, 150),
				r.pick(['#9AB450', '#A3BD57', '#CDC88D', '#B9C668', '#7FAA48', '#B9C668']), r, { layers: 8, alpha: 0.06, edge: 0, variance: 0.25 });
		}
		for (let y = 0; y < H; y += 120) {
			for (const x of [-30, WORLD_W + 30]) wash(g, x, y + r.gauss() * 40, r.range(60, 110), r.range(70, 120), r.pick(['#5F933E', '#488641']), r, { layers: 8, alpha: 0.06, edge: 0 });
		}
		const sprigs = Math.round((H / 1000) * 260);
		for (let i = 0; i < sprigs; i++) {
			const x = r.range(10, WORLD_W - 10), y = r.range(10, H - 10), s = r.range(0.6, 1.25);
			const col = r.pick(['#5F933E', '#7FAA48', '#488641']);
			leaf(g, x, y, 6 * s, 2.4 * s, -Math.PI / 2 - 0.6, col, r, 0.55);
			leaf(g, x, y, 6 * s, 2.4 * s, -Math.PI / 2 + 0.6, col, r, 0.55);
			if (r() < 0.3) leaf(g, x, y, 7 * s, 2 * s, -Math.PI / 2, col, r, 0.55);
		}
		for (let i = 0; i < Math.round((H / 1000) * 18); i++) {
			wash(g, r.range(20, WORLD_W - 20), r.range(20, H - 20), r.range(3, 6), r.range(2, 4), '#C9B48A', r, { layers: 5, alpha: 0.25, edge: 0.3 });
		}
		this.bg = c;
		this.bgDirty = false;
	}

	// ─── Plantes ───────────────────────────────────────────────────

	/** Un premier jardin composé à la main, pour ne pas arriver sur une prairie vide. */
	seedStarterGarden() {
		const herbes = [[70, 470], [115, 520], [300, 420], [345, 560], [210, 640], [80, 690], [265, 740], [190, 500]];
		for (const [x, y] of herbes) this.spawn('herbe', 1, { x, y });
		this.spawn('fleur', 1, { x: 140, y: 440 });
		this.spawn('fleur', 1, { x: 172, y: 470 });
		this.spawn('fleur', 0.3, { x: 120, y: 480 });
		this.spawn('arbre', 0.08, { x: 310, y: 330 });
	}

	place(type) {
		const sp = PLANT_TYPES[type].spacing;
		const obstacles = [
			...this.state.plants.map(p => ({ x: p.x, y: p.y, rad: PLANT_TYPES[p.type].spacing })),
			...Object.values(DECOR).map(d => ({ x: d.x, y: d.y, rad: d.rad })),
		];
		const same = this.state.plants.filter(p => p.type === type);
		let best = null;
		for (let attempt = 0; attempt < 6; attempt++) {
			const H = this.state.worldH;
			let bestScore = -Infinity;
			for (let i = 0; i < 60; i++) {
				let x, y, near = false;
				if (same.length && (type === 'herbe' || type === 'fleur') && Math.random() < 0.6) {
					const o = pick(same);
					const a = Math.random() * Math.PI * 2, d = sp * 2 + Math.random() * sp * 2.5;
					x = o.x + Math.cos(a) * d;
					y = o.y + Math.sin(a) * d;
					near = true;
				} else {
					x = 40 + Math.random() * (WORLD_W - 80);
					y = MIN_Y[type] + Math.random() * (H - MIN_Y[type] - 40);
				}
				if (x < 30 || x > WORLD_W - 30 || y < MIN_Y[type] || y > H - 30) continue;
				let gap = Infinity;
				for (const o of obstacles) gap = Math.min(gap, Math.hypot(o.x - x, (o.y - y) * 1.25) - o.rad - sp);
				// Les petites plantes se regroupent en touffes ; les arbres cherchent de l'espace.
				const score = (gap >= 0 ? 1000 : gap) + (near ? 30 : 0) + (type === 'arbre' || type === 'buisson' ? Math.min(gap, 40) : 0) + Math.random() * 20;
				if (score > bestScore) { bestScore = score; best = { x, y }; }
			}
			if (bestScore >= 1000) return best;
			// Plus de place : le jardin s'agrandit vers le bas.
			this.state.worldH += 300;
			this.bgDirty = true;
		}
		return best;
	}

	spawn(type, growth = 0, pos = this.place(type)) {
		const p = {
			id: uid(), type, x: Math.round(pos.x), y: Math.round(pos.y), growth,
			seed: Math.floor(Math.random() * 2147483647), variant: newVariant(type, this.state.species), born: Date.now(),
		};
		this.state.plants.push(p);
		return p;
	}

	/** Ajoute de l'effort à la plante en cours de ce type ; plante une graine si besoin. Renvoie les évènements. */
	addEffort(type, amount) {
		const events = [];
		const cost = PLANT_TYPES[type].cost;
		let p = this.state.plants.find(q => q.type === type && q.growth < 1);
		while (amount > 1e-6) {
			if (!p) { p = this.spawn(type); events.push({ kind: 'seed', plant: p }); }
			const used = Math.min((1 - p.growth) * cost, amount);
			p.growth = Math.min(1, p.growth + used / cost);
			amount -= used;
			if (p.growth >= 1) { events.push({ kind: 'mature', plant: p }); this.current = p; p = null; }
			else this.current = p;
		}
		return events;
	}

	spriteFor(p) {
		const stage = p.growth >= 1 ? STAGES : Math.floor(p.growth * STAGES);
		let s = this.sprites.get(p.id);
		if (!s || s.stage !== stage) {
			const box = PLANT_TYPES[p.type].box;
			const c = s?.canvas ?? document.createElement('canvas');
			c.width = Math.ceil(box.w * this.S);
			c.height = Math.ceil(box.h * this.S);
			const g = c.getContext('2d');
			g.setTransform(this.S, 0, 0, this.S, box.ax * this.S, box.ay * this.S);
			const meta = paintPlant(g, p, stage / STAGES);
			const grew = s && s.stage < stage;
			s = { stage, canvas: c, top: meta.top, pop: grew ? this.t : (s?.pop ?? -9) };
			this.sprites.set(p.id, s);
			if (grew) this.burst(p.x, p.y + meta.top, stage === STAGES ? 18 : 5, p.variant.color);
		}
		return s;
	}

	decorSprite(key) {
		let s = this.decorSprites.get(key);
		if (!s) {
			const box = DECOR[key].box;
			const c = document.createElement('canvas');
			c.width = Math.ceil(box.w * this.S);
			c.height = Math.ceil(box.h * this.S);
			const g = c.getContext('2d');
			g.setTransform(this.S, 0, 0, this.S, box.ax * this.S, box.ay * this.S);
			DECOR_PAINTERS[key](g);
			s = { canvas: c };
			this.decorSprites.set(key, s);
		}
		return s;
	}

	/** Montre un décor qui vient d'apparaître. */
	reveal(key) {
		const d = DECOR[key];
		this.popAt[key] = this.t;
		this.burst(d.x, d.y - 20, 24, '#F4C23E');
		this.focusOn(d.y);
	}

	focusOn(worldY) {
		this.camTarget = worldY - this.viewH() * 0.5;
	}

	setFollow(on) {
		this.following = on;
		if (!on) this.camTarget = null;
	}

	burst(x, y, n, color) {
		for (let i = 0; i < n; i++) {
			this.particles.push({
				x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 6,
				vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40,
				life: 1, decay: 0.5 + Math.random() * 0.5, size: 1.2 + Math.random() * 2,
				color: pick([color || '#F4C23E', '#F4C23E', '#FDF7E7']),
			});
		}
	}

	headOf(p) {
		const s = this.sprites.get(p.id);
		return s ? [p.x, p.y + s.top] : [p.x, p.y - 20];
	}

	hour() {
		if (this.hourOverride != null) return this.hourOverride;
		const d = new Date();
		return d.getHours() + d.getMinutes() / 60;
	}

	// ─── Entrées (glisser pour parcourir, toucher une plante) ───────

	bindInput() {
		const c = this.canvas;
		let start = null;
		c.addEventListener('pointerdown', e => {
			c.setPointerCapture(e.pointerId);
			const now = performance.now();
			start = { x: e.clientX, y: e.clientY, cam: this.camY, lastY: e.clientY, lastT: now, moved: false };
			this.vel = 0;
			this.dragging = true;
			this.camTarget = null;
			this.followPausedUntil = now + 5000;
		});
		c.addEventListener('pointermove', e => {
			if (!start) return;
			const now = performance.now();
			if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) start.moved = true;
			this.camY = start.cam - (e.clientY - start.y) / this.cs;
			const dt = Math.max(1, now - start.lastT) / 1000;
			this.vel = (-(e.clientY - start.lastY) / this.cs) / dt;
			start.lastY = e.clientY;
			start.lastT = now;
		});
		const end = e => {
			if (!start) return;
			if (!start.moved) { this.vel = 0; this.onTap?.(this.pick(e)); }
			if (performance.now() - start.lastT > 80) this.vel = 0;
			start = null;
			this.dragging = false;
			this.followPausedUntil = performance.now() + 5000;
		};
		c.addEventListener('pointerup', end);
		c.addEventListener('pointercancel', end);
		c.addEventListener('wheel', e => {
			e.preventDefault();
			this.camTarget = null;
			this.camY += e.deltaY / this.cs * 0.6;
			this.followPausedUntil = performance.now() + 5000;
		}, { passive: false });
	}

	pick(e) {
		const rect = this.canvas.getBoundingClientRect();
		const wx = (e.clientX - rect.left) / this.cs;
		const wy = (e.clientY - rect.top) / this.cs + this.camY;
		const sorted = [...this.state.plants].sort((a, b) => b.y - a.y);
		for (const p of sorted) {
			const box = PLANT_TYPES[p.type].box;
			const s = this.sprites.get(p.id);
			const top = s ? s.top : -20;
			const half = Math.max(14, (box.w / 2) * (p.type === 'arbre' || p.type === 'buisson' ? 0.6 : 0.4));
			if (wx > p.x - half && wx < p.x + half && wy > p.y + top - 6 && wy < p.y + 10) {
				return { plant: p, x: e.clientX - rect.left, y: e.clientY - rect.top };
			}
		}
		return null;
	}

	// ─── Boucle ────────────────────────────────────────────────────

	frame = now => {
		const dt = Math.min(0.05, (now - this.last) / 1000);
		this.last = now;
		this.t += dt;
		if (this.S) {
			this.update(dt, now);
			this.render();
		}
		requestAnimationFrame(this.frame);
	};

	update(dt, now) {
		if (this.following && this.current && now > this.followPausedUntil && !this.dragging) {
			this.camTarget = this.current.y - this.viewH() * 0.55;
		}
		if (!this.dragging) {
			if (this.camTarget != null) {
				const target = Math.max(this.camMin(), Math.min(this.camMax(), this.camTarget));
				this.camY += (target - this.camY) * Math.min(1, dt * 2.5);
				if (Math.abs(target - this.camY) < 0.5 && !this.following) this.camTarget = null;
			} else {
				this.camY += this.vel * dt;
				this.vel *= Math.pow(0.03, dt);
			}
			const lo = this.camMin(), hi = this.camMax();
			if (this.camY < lo) { this.camY += (lo - this.camY) * Math.min(1, dt * 10); this.vel = 0; }
			if (this.camY > hi) { this.camY += (hi - this.camY) * Math.min(1, dt * 10); this.vel = 0; }
		}

		if (this.t > this.nextPopulate) { this.populate(); this.nextPopulate = this.t + 1; }
		for (const i of this.insects) this.updateInsect(i, dt);
		this.insects = this.insects.filter(i => !i.gone);
		for (const p of this.particles) {
			p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 10 * dt; p.vx *= 0.98; p.life -= p.decay * dt;
		}
		this.particles = this.particles.filter(p => p.life > 0);
		for (const f of this.fireflies) {
			f.a += (Math.random() - 0.5) * dt * 3;
			f.x += Math.cos(f.a) * 12 * dt;
			f.y += (Math.sin(f.a) * 12 * dt) / Math.max(1, this.viewH());
			if (f.x < 0 || f.x > WORLD_W) f.a = Math.PI - f.a;
			if (f.y < 0 || f.y > 1) f.y = Math.random();
		}
	}

	populate() {
		const n = nightAt(this.hour());
		if (n > 0.5) this.state.seenNight = true;
		const night = n > 0.5, dusk = n > 0.2;
		const sp = this.state.species;
		const mature = this.state.plants.filter(p => p.growth >= 1);
		this.flowers = mature.filter(p => p.type === 'fleur');
		this.bushes = mature.filter(p => p.type === 'buisson');
		this.trees = mature.filter(p => p.type === 'arbre');
		this.perches = [...this.bushes, ...this.trees];
		// Le jour les pollinisateurs, la nuit le hérisson : chacun à son heure.
		const want = {
			bee: night ? 0 : this.flowers.length ? Math.min(8, 1 + Math.floor(this.flowers.length / 3)) : 0,
			butterfly: night ? 0 : Math.min(5, Math.floor(this.perches.length / 2) + (this.flowers.length >= 6 ? 1 : 0)),
			dragonfly: !night && this.state.unlocked.pond ? 1 : 0,
			ladybug: sp.coccinelle && !night ? Math.min(3, this.bushes.length) : 0,
			frog: sp.grenouille && this.state.unlocked.pond ? 1 : 0,
			hedgehog: sp.herisson && dusk ? 1 : 0,
			tit: sp.mesange && !night && this.trees.length ? Math.min(2, this.trees.length - 1 || 1) : 0,
		};
		for (const kind of Object.keys(want)) {
			const active = this.insects.filter(i => i.kind === kind && !i.leaving);
			for (let k = active.length; k < want[kind]; k++) {
				const c = this.newInsect(kind);
				if (c) this.insects.push(c);
			}
			for (let k = active.length; k > want[kind]; k--) active[k - 1].leaving = true;
		}
	}

	newInsect(kind) {
		const side = Math.random() < 0.5 ? -30 : WORLD_W + 30;
		const y = this.camY + this.viewH() * (0.2 + Math.random() * 0.6);
		const base = { kind, t: Math.random() * 10, dir: 1, timer: 2 + Math.random() * 4 };
		const pond = DECOR.pond, log = DECOR.log;
		if (kind === 'dragonfly') return { ...base, x: pond.x, y: pond.y - 40, mode: 'hover', timer: 1 };
		if (kind === 'ladybug') {
			const target = pick(this.bushes);
			return target && { ...base, target, ox: (Math.random() - 0.5) * 50, oy: 14 + Math.random() * 30, x: target.x, y: target.y, mode: 'perch' };
		}
		if (kind === 'frog') {
			const [px, py] = pick(POND_PADS);
			return { ...base, x: pond.x + px, y: pond.y + py - 3, mode: 'perch', timer: 6 + Math.random() * 6 };
		}
		if (kind === 'hedgehog') return { ...base, x: log.x - 60, y: log.y + 10, mode: 'walk', ang: Math.PI, home: log };
		if (kind === 'tit') {
			const target = pick(this.trees);
			return target && { ...base, x: side, y: y - 100, target, ox: (Math.random() - 0.5) * 60, oy: 4, mode: 'seek' };
		}
		return { ...base, x: side, y, mode: 'seek', target: null, ang: Math.random() * 6.28 };
	}

	updateInsect(b, dt) {
		b.t += dt;
		const flyTo = (tx, ty, speed, wobble) => {
			const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy) || 1;
			const step = Math.min(dist, speed * dt);
			b.x += (dx / dist) * step + (-dy / dist) * Math.sin(b.t * 7) * wobble * dt;
			b.y += (dy / dist) * step + (dx / dist) * Math.sin(b.t * 7) * wobble * dt;
			if (Math.abs(dx) > 1) b.dir = Math.sign(dx);
			return dist;
		};

		if (b.kind === 'ladybug') {
			if (b.leaving || !this.state.plants.includes(b.target)) { b.gone = true; return; }
			const [hx, hy] = this.headOf(b.target);
			b.ox += Math.cos(b.t * 0.7) * 2 * dt;
			b.oy += Math.sin(b.t * 0.5) * 1.5 * dt;
			b.x = hx + b.ox;
			b.y = hy + b.oy;
			b.dir = Math.cos(b.t * 0.7) >= 0 ? 1 : -1;
			return;
		}

		if (b.kind === 'frog') {
			if (b.leaving) { b.gone = true; return; }
			if (b.mode === 'hop') {
				b.k = Math.min(1, b.k + dt * 2.2);
				b.x = lerp(b.fx, b.tx, b.k);
				b.y = lerp(b.fy, b.ty, b.k) - Math.sin(b.k * Math.PI) * 16;
				if (b.k >= 1) { b.mode = 'perch'; b.timer = 6 + Math.random() * 8; }
				return;
			}
			b.timer -= dt;
			if (b.timer <= 0) {
				const pond = DECOR.pond, [px, py] = pick(POND_PADS);
				Object.assign(b, { mode: 'hop', k: 0, fx: b.x, fy: b.y, tx: pond.x + px, ty: pond.y + py - 3 });
				b.dir = b.tx >= b.x ? 1 : -1;
			}
			return;
		}

		if (b.kind === 'hedgehog') {
			const home = b.home;
			if (b.leaving) {
				if (flyTo(home.x - 50, home.y - 12, 16, 0) < 3) b.gone = true;
				return;
			}
			b.ang += (Math.random() - 0.5) * dt * 1.5;
			if (Math.hypot(b.x - home.x, b.y - home.y) > 150) b.ang = Math.atan2(home.y - b.y, home.x - b.x);
			b.timer -= dt;
			if (b.timer < 0) { b.timer = b.timer < -2 ? 3 + Math.random() * 5 : b.timer; return; } // il s'arrête renifler
			b.x += Math.cos(b.ang) * 14 * dt;
			b.y += Math.sin(b.ang) * 9 * dt;
			b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
			return;
		}

		if (b.kind === 'tit') {
			if (b.leaving) b.target = null;
			if (!b.target || !this.state.plants.includes(b.target)) {
				if (flyTo(b.x < WORLD_W / 2 ? -60 : WORLD_W + 60, b.y - 60, 120, 0) < 5) b.gone = true;
				return;
			}
			const [hx, hy] = this.headOf(b.target);
			if (b.mode === 'perch') {
				b.x = hx + b.ox;
				b.y = hy + b.oy;
				b.timer -= dt;
				if (b.timer <= 0) {
					b.mode = 'seek';
					b.target = pick(this.trees) ?? b.target;
					b.ox = (Math.random() - 0.5) * 60;
				}
				return;
			}
			if (flyTo(hx + b.ox, hy + b.oy, 110, 15) < 3) { b.mode = 'perch'; b.timer = 4 + Math.random() * 6; }
			return;
		}

		if (b.leaving) {
			if (b.exitX == null) b.exitX = b.x < WORLD_W / 2 ? -60 : WORLD_W + 60;
			if (flyTo(b.exitX, b.y - 80, 90, 10) < 5) b.gone = true;
			return;
		}

		if (b.kind === 'bee') {
			if (b.mode === 'hover' && b.target && this.state.plants.includes(b.target)) {
				b.timer -= dt;
				const [hx, hy] = this.headOf(b.target);
				b.x = hx + Math.cos(b.t * 3) * 5;
				b.y = hy - 4 + Math.sin(b.t * 5) * 2;
				if (b.timer <= 0) { b.mode = 'seek'; b.target = null; }
				return;
			}
			if (!b.target || !this.state.plants.includes(b.target)) b.target = this.flowers?.length ? pick(this.flowers) : null;
			if (!b.target) { b.leaving = true; return; }
			const [hx, hy] = this.headOf(b.target);
			if (flyTo(hx, hy - 4, 70, 25) < 4) { b.mode = 'hover'; b.timer = 1.5 + Math.random() * 2; }
			return;
		}

		if (b.kind === 'butterfly') {
			if (b.mode === 'perch' && b.target) {
				b.timer -= dt;
				const [hx, hy] = this.headOf(b.target);
				b.x = hx + b.ox; b.y = hy + b.oy;
				if (b.timer <= 0) { b.mode = 'wander'; b.target = null; b.timer = 3 + Math.random() * 4; }
				return;
			}
			if (b.mode === 'seek' && b.target) {
				const [hx, hy] = this.headOf(b.target);
				if (flyTo(hx + b.ox, hy + b.oy, 40, 30) < 3) { b.mode = 'perch'; b.timer = 2 + Math.random() * 3; }
				return;
			}
			b.timer = (b.timer ?? 3) - dt;
			if (b.timer <= 0 && this.perches?.length) {
				b.target = pick(this.perches);
				b.ox = (Math.random() - 0.5) * 30;
				b.oy = 6 + Math.random() * 14;
				b.mode = 'seek';
				return;
			}
			const top = this.camY + 40, bottom = this.camY + this.viewH() - 60;
			if (b.y < top || b.y > bottom || b.x < 20 || b.x > WORLD_W - 20) {
				const back = Math.atan2(this.camY + this.viewH() / 2 - b.y, WORLD_W / 2 - b.x);
				b.ang += Math.sign(Math.sin(back - b.ang)) * dt * 2;
			}
			b.ang += (Math.random() - 0.5) * dt * 4;
			b.x += Math.cos(b.ang) * 35 * dt;
			b.y += Math.sin(b.ang) * 35 * dt + Math.sin(b.t * 5) * 8 * dt;
			b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
			return;
		}

		if (b.kind === 'dragonfly') {
			const d = DECOR.pond;
			if (b.mode === 'hover') {
				b.timer -= dt;
				b.x += Math.sin(b.t * 13) * 3 * dt;
				b.y += Math.cos(b.t * 11) * 3 * dt;
				if (b.timer <= 0) { b.mode = 'dart'; b.tx = d.x + (Math.random() - 0.5) * 260; b.ty = d.y - 60 + (Math.random() - 0.5) * 120; }
				return;
			}
			if (flyTo(b.tx, b.ty, 220, 0) < 3) { b.mode = 'hover'; b.timer = 0.6 + Math.random(); }
		}
	}

	// ─── Rendu ─────────────────────────────────────────────────────

	wind(x) {
		const t = this.t;
		const gust = 0.6 * Math.pow(Math.max(0, Math.sin(t * 0.21 - x * 0.004)), 4);
		return 0.45 * Math.sin(t * 0.9 + x * 0.012) + 0.25 * Math.sin(t * 2.3 + x * 0.03) + gust;
	}

	render() {
		const ctx = this.ctx, S = this.S, cw = this.canvas.width, ch = this.canvas.height;
		const hour = this.hour(), night = nightAt(hour), day = 1 - night;
		if (this.bgDirty) this.paintBg();

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#C9CC8A';
		ctx.fillRect(0, 0, cw, ch);
		ctx.drawImage(this.bg, 0, Math.round(-this.camY * S));

		if (day > 0) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.globalAlpha = 0.32 * day;
			for (const cl of this.clouds) {
				const span = WORLD_W + cl.w * 2;
				const x = ((cl.x + this.t * cl.speed) % span + span) % span - cl.w;
				const y = (cl.y % Math.max(600, this.state.worldH)) - this.camY;
				ctx.drawImage(cl.canvas, x * S, y * S);
			}
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1;
		}

		// Ombres des insectes au sol
		ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
		ctx.fillStyle = 'rgba(30,50,20,0.13)';
		for (const b of this.insects) {
			const h = FLIGHT[b.kind] ?? (b.mode === 'perch' ? null : 24);
			if (h == null) continue;
			const big = b.kind === 'hedgehog' ? 2.6 : b.kind === 'frog' ? 1.8 : 1;
			ctx.beginPath();
			ctx.ellipse(b.x + h * 0.25, b.y + h, 4 * big, 1.8 * big, 0, 0, Math.PI * 2);
			ctx.fill();
		}

		// Décor et plantes, triés par profondeur
		const entities = [];
		for (const key of Object.keys(DECOR)) if (this.state.unlocked[key]) entities.push({ decor: key, y: DECOR[key].y });
		for (const p of this.state.plants) entities.push({ plant: p, y: p.y });
		entities.sort((a, b) => a.y - b.y);
		for (const e of entities) {
			if (e.decor) {
				const d = DECOR[e.decor], box = d.box;
				const sx = d.x * S, sy = (d.y - this.camY) * S;
				if (sy - box.ay * S > ch + 20 || sy + (box.h - box.ay) * S < -20) continue;
				const age = this.t - (this.popAt[e.decor] ?? -9);
				const k = age < 0.8 ? 0.6 + 0.4 * Math.min(1, age / 0.5) + 0.06 * Math.sin(Math.min(1, age / 0.8) * Math.PI) : 1;
				ctx.setTransform(k, 0, 0, k, sx, sy);
				ctx.globalAlpha = age < 0.5 ? age / 0.5 : 1;
				ctx.drawImage(this.decorSprite(e.decor).canvas, -box.ax * S, -box.ay * S);
				ctx.globalAlpha = 1;
				continue;
			}
			const p = e.plant, box = PLANT_TYPES[p.type].box;
			const sx = p.x * S, sy = (p.y - this.camY) * S;
			if (sy - box.ay * S > ch + 20 || sy + (box.h - box.ay) * S < -20) continue;
			const s = this.spriteFor(p);
			const shear = this.wind(p.x) * SWAY[p.type] * (0.4 + 0.6 * (s.stage / STAGES));
			const age = this.t - s.pop;
			const k = age < 0.45 ? 1 + 0.14 * Math.sin((age / 0.45) * Math.PI) : 1;
			ctx.setTransform(k, 0, shear * k, k, sx, sy);
			ctx.drawImage(s.canvas, -box.ax * S, -box.ay * S);
		}

		// Insectes et particules
		ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
		for (const b of this.insects) this.drawInsect(ctx, b);
		for (const p of this.particles) {
			ctx.globalAlpha = Math.max(0, p.life);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;

		// Lumière de l'heure
		const amb = ambientAt(hour);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (amb.a > 0.001) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.fillStyle = rgba(amb.color, amb.a);
			ctx.fillRect(0, 0, cw, ch);
			ctx.globalCompositeOperation = 'source-over';
		}

		if (night > 0) {
			ctx.globalCompositeOperation = 'lighter';
			const n = this.glow.width, vh = this.viewH();
			for (const f of this.fireflies) {
				const a = night * Math.pow(0.5 + 0.5 * Math.sin(this.t * 2 + f.ph), 2);
				ctx.globalAlpha = a;
				ctx.drawImage(this.glow, f.x * S - n / 2, f.y * vh * S - n / 2);
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}

		// Grain de papier (attaché au monde) et vignette
		this.paperPattern.setTransform(new DOMMatrix().translateSelf(0, Math.round(-this.camY * S)));
		ctx.fillStyle = this.paperPattern;
		ctx.fillRect(0, 0, cw, ch);
		ctx.drawImage(this.vignette, 0, 0);
	}

	drawInsect(ctx, b) {
		ctx.save();
		ctx.translate(b.x, b.y);
		const k = CRITTER_SIZE[b.kind] ?? 1;
		ctx.scale((b.dir || 1) * k, k);
		drawCritter(ctx, b.kind, b.t, b.mode);
		ctx.restore();
	}
}
