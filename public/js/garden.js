// Le jardin d'un lieu : fond peint, plantes, animaux, vent, ciel (heure, soleil, météo) et caméra.
// Le monde fait WORLD_W unités de large ; il s'allonge vers le bas quand il n'y a plus de place.

import { rng, wash, leaf, rgba, mix, paperTexture, lerp, ribbon, curve } from './watercolor.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant, newVariant } from './plants.js';
import { drawCritter, CRITTER_SIZE, FLIGHT } from './critters.js';
import { SPECIES } from './species.js';

export const WORLD_W = 420;
const STAGES = 30;
const SWAY = { herbe: 0.09, fleur: 0.07, buisson: 0.02, arbre: 0.012 };
const MIN_Y = { herbe: 60, fleur: 100, buisson: 100, arbre: 220 };
const POND_PADS = [[40, -10], [58, 10], [-60, 14], [-20, 24], [10, -26]];
const FLYERS = new Set(['bee', 'butterfly', 'dragonfly', 'hoverfly', 'beefly']);

// Sol de chaque lieu : couleur de fond, grandes nappes, bords, petites pousses.
const GROUND = {
	prairie: { base: '#B5C565', washes: ['#9AB450', '#A3BD57', '#CDC88D', '#B9C668', '#7FAA48', '#B9C668'], edge: ['#5F933E', '#488641'], sprigs: ['#5F933E', '#7FAA48', '#488641'], stones: '#C9B48A' },
	marais: { base: '#A6C27A', washes: ['#8FB98A', '#9AC08A', '#B9CC8A', '#7FAA6A', '#C8D0A0'], edge: ['#4E7A5A', '#5F8A62'], sprigs: ['#4E7A4A', '#6E9A5A'], stones: '#A8B898' },
	foret: { base: '#7E9A55', washes: ['#6E8A4A', '#5F7F45', '#8AA060', '#9A9A60', '#7A7A48'], edge: ['#3E5A32', '#2E4A2A'], sprigs: ['#3E6A35', '#4E7A3E'], stones: '#9A8A6A', leaves: ['#A8783A', '#C8903A', '#8A5A2A', '#B8A050'], sun: '#E8E0A0' },
	montagne: { base: '#B9C98E', washes: ['#A8BC80', '#C8D3A0', '#9FB878', '#D0D8B0'], edge: ['#7A9A6A', '#8AA07A'], sprigs: ['#6E8F6A', '#7FA08A'], stones: '#A8A8A0', rocks: true },
	littoral: { base: '#E9DAB4', washes: ['#DCCB9E', '#F0E4C4', '#E4D2A8', '#D2C090'], edge: ['#C8B88A', '#D8C8A0'], sprigs: ['#9DB08A', '#A8B488'], stones: '#C8C0B0', sea: true },
};

/** Lever et coucher du soleil (heures décimales) par défaut, pour la France. */
const DEFAULT_SUN = { rise: 7.5, set: 19 };

function ambientAt(h, sun) {
	const N = ['#1E2B4D', 0.55], DAWN = ['#F2B880', 0.25], DAY = ['#FFFFFF', 0], GOLD = ['#F4A85E', 0.25], DUSK = ['#6E5A8E', 0.4];
	const keys = [[0, N], [sun.rise - 1, N], [sun.rise, DAWN], [sun.rise + 1.5, DAY], [sun.set - 1.5, DAY], [sun.set - 0.2, GOLD], [sun.set + 0.5, DUSK], [sun.set + 1.25, N], [24, N]];
	for (let i = 0; i < keys.length - 1; i++) {
		const [h0, [c0, a0]] = keys[i], [h1, [c1, a1]] = keys[i + 1];
		if (h >= h0 && h <= h1) {
			const k = (h - h0) / (h1 - h0 || 1);
			return { color: mix(c0, c1, k), a: lerp(a0, a1, k) };
		}
	}
	return { color: '#FFFFFF', a: 0 };
}

// Lumière selon la hauteur du soleil (degrés) : un matin d'octobre, bas sur l'horizon, reste doré
// bien plus longtemps qu'un matin d'été. [hauteur, couleur multipliée, opacité]
const ALT_LIGHT = [
	[-90, '#1E2B4D', 0.58], [-12, '#1E2B4D', 0.58], [-6, '#3E4A7E', 0.5], [-2, '#8A6A9E', 0.42],
	[1, '#F09A5E', 0.32], [5, '#F4B470', 0.2], [12, '#F8D8A8', 0.09], [25, '#FFF4E4', 0.03], [40, '#FFFFFF', 0], [90, '#FFFFFF', 0],
];

function lightFromAltitude(alt) {
	for (let i = 0; i < ALT_LIGHT.length - 1; i++) {
		const [a0, c0, o0] = ALT_LIGHT[i], [a1, c1, o1] = ALT_LIGHT[i + 1];
		if (alt >= a0 && alt <= a1) {
			const k = (alt - a0) / (a1 - a0);
			return { color: mix(c0, c1, k), a: lerp(o0, o1, k) };
		}
	}
	return { color: '#FFFFFF', a: 0 };
}

export function nightAt(h, sun = DEFAULT_SUN) {
	if (h >= sun.set + 1.25 || h < sun.rise - 1) return 1;
	if (h > sun.set) return (h - sun.set) / 1.25;
	if (h < sun.rise) return (sun.rise - h);
	return 0;
}

/** Animaux au sol : triés avec les plantes, pour passer devant ou derrière elles. */
const onGround = b => (b.behavior === 'walk' || b.behavior === 'trail' || (b.behavior === 'hop' && b.mode !== 'hop') || b.kind === 'heron' || b.kind === 'frog') && !b.p.swim;

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
		this.followPausedUntil = 0;
		this.insects = [];
		this.particles = [];
		this.drops = [];
		this.fireflies = Array.from({ length: 26 }, () => ({ x: Math.random() * WORLD_W, y: Math.random(), ph: Math.random() * 6.28, a: Math.random() * 6.28 }));
		this.paper = paperTexture(256);
		this.hourOverride = null;
		this.sun = DEFAULT_SUN;
		this.weather = { kind: 'clear', wind: 10, temp: 15 };
		this.padTop = 0;
		this.padBottom = 0;
		this.t = 0;
		this.flash = 0;
		this.popAt = {};
		this.nextPopulate = 0;
		this.onTap = null;

		this.setPlace(state.place);
		this.resize();
		new ResizeObserver(() => this.resize()).observe(canvas);
		this.bindInput();
		this.last = performance.now();
		requestAnimationFrame(this.frame);
	}

	/** Change de lieu : chaque lieu a son propre jardin. */
	setPlace(id) {
		this.placeId = id;
		this.place = this.state.places[id];
		this.sprites.clear();
		this.insects = [];
		this.particles = [];
		this.current = null;
		this.bgDirty = true;
		if (!this.place.plants.length) this.seedStarterGarden();
		this.camY = Math.max(this.camMin(), (this.place.worldH - this.viewH()) * 0.35);
		this.camTarget = null;
		this.nextPopulate = 0;
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
	camMax() { return Math.max(this.camMin(), this.place.worldH - this.viewH() + this.padBottom); }

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
		const S = this.S, H = this.place.worldH, G = GROUND[this.placeId];
		const c = document.createElement('canvas');
		c.width = Math.ceil(WORLD_W * S);
		c.height = Math.ceil(H * S);
		const g = c.getContext('2d');
		g.scale(S, S);
		const r = rng(99);
		g.fillStyle = G.base;
		g.fillRect(0, 0, WORLD_W, H);
		const n = Math.round((H / 1000) * 50);
		for (let i = 0; i < n; i++) {
			wash(g, r.range(-50, WORLD_W + 50), r.range(-50, H + 50), r.range(70, 200), r.range(50, 150), r.pick(G.washes), r, { layers: 8, alpha: 0.06, edge: 0, variance: 0.25 });
		}
		for (let y = 0; y < H; y += 120) {
			for (const x of [-30, WORLD_W + 30]) wash(g, x, y + r.gauss() * 40, r.range(60, 110), r.range(70, 120), r.pick(G.edge), r, { layers: 8, alpha: 0.06, edge: 0 });
		}
		if (G.sun) for (let i = 0; i < Math.round(H / 140); i++) wash(g, r.range(20, WORLD_W - 20), r.range(20, H), r.range(30, 60), r.range(18, 34), G.sun, r, { layers: 5, alpha: 0.035, edge: 0 });
		if (G.rocks) for (let i = 0; i < Math.round(H / 90); i++) { const s = r.range(6, 16); wash(g, r.range(10, WORLD_W - 10), r.range(20, H), s, s * 0.6, r.pick(['#A8A498', '#BCB8AC', '#9A968A']), r, { layers: 7, alpha: 0.16, edge: 0.4 }); }
		const sprigs = Math.round((H / 1000) * (G.sea ? 90 : 260));
		for (let i = 0; i < sprigs; i++) {
			const x = r.range(10, WORLD_W - 10), y = r.range(G.sea ? 260 : 10, H - 10), s = r.range(0.6, 1.25);
			const col = r.pick(G.sprigs);
			leaf(g, x, y, 6 * s, 2.4 * s, -Math.PI / 2 - 0.6, col, r, 0.55);
			leaf(g, x, y, 6 * s, 2.4 * s, -Math.PI / 2 + 0.6, col, r, 0.55);
			if (r() < 0.3) leaf(g, x, y, 7 * s, 2 * s, -Math.PI / 2, col, r, 0.55);
		}
		if (G.leaves) for (let i = 0; i < Math.round(H / 6); i++) leaf(g, r.range(5, WORLD_W - 5), r.range(5, H), r.range(4, 7), r.range(1.6, 2.6), r() * 6.28, r.pick(G.leaves), r, 0.5);
		for (let i = 0; i < Math.round((H / 1000) * 18); i++) {
			wash(g, r.range(20, WORLD_W - 20), r.range(20, H - 20), r.range(3, 6), r.range(2, 4), G.stones, r, { layers: 5, alpha: 0.25, edge: 0.3 });
		}
		if (G.sea) {
			// La mer en haut du monde, puis le sable mouillé et l'écume.
			for (let i = 0; i < 14; i++) wash(g, r.range(-40, WORLD_W + 40), r.range(-30, 110), r.range(90, 160), r.range(40, 70), r.pick(['#6FAEC0', '#8FC4CC', '#5FA0B8']), r, { layers: 8, alpha: 0.1, edge: 0 });
			g.fillStyle = 'rgba(111,174,192,0.55)';
			g.fillRect(0, -10, WORLD_W, 120);
			for (let i = 0; i < 10; i++) wash(g, r.range(0, WORLD_W), r.range(150, 190), r.range(60, 110), r.range(10, 18), '#CFC09A', r, { layers: 6, alpha: 0.1, edge: 0 });
			for (const y of [120, 138, 156]) ribbon(g, curve(-10, y + r.gauss() * 4, r.gauss() * 0.04, WORLD_W + 20, r.gauss() * 0.08, 20), 2.4, 1.6, '#FDFBF3', r, 0.6);
		}
		this.bg = c;
		this.bgDirty = false;
	}

	// ─── Plantes ───────────────────────────────────────────────────

	/** Un premier jardin composé à la main pour chaque lieu, pour ne pas arriver sur un terrain vide. */
	seedStarterGarden() {
		const starters = {
			prairie: { herbe: [[70, 470], [115, 520], [300, 420], [345, 560], [210, 640], [80, 690], [265, 740], [190, 500]], fleur: [[140, 440, 1], [172, 470, 1], [120, 480, 0.3]], arbre: [[310, 330, 0.08]] },
			marais: { herbe: [[50, 330], [370, 340], [40, 770], [380, 700], [300, 820], [140, 820]], fleur: [[330, 370, 1], [80, 740, 1], [360, 760, 0.3]] },
			foret: { herbe: [[70, 420], [340, 460], [200, 620], [90, 700], [330, 700]], fleur: [[120, 470, 1], [150, 500, 1], [300, 520, 0.3]], arbre: [[260, 300, 0.08]] },
			montagne: { herbe: [[80, 480], [140, 540], [300, 470], [360, 600], [220, 660]], fleur: [[200, 520, 1], [230, 545, 1]], arbre: [[90, 330, 0.08]] },
			littoral: { herbe: [[60, 420], [120, 470], [300, 450], [360, 520], [200, 560], [80, 640]], fleur: [[240, 480, 1], [150, 600, 0.3]], arbre: [[330, 760, 0.08]] },
		}[this.placeId];
		for (const [type, list] of Object.entries(starters)) for (const [x, y, g = 1] of list) this.spawn(type, g, { x, y });
	}

	minY(type) {
		return MIN_Y[type] + (this.placeId === 'littoral' ? 240 : 0);
	}

	place_(type) {
		const sp = PLANT_TYPES[type].spacing;
		const obstacles = [
			...this.place.plants.map(p => ({ x: p.x, y: p.y, rad: PLANT_TYPES[p.type].spacing })),
			...Object.values(DECOR).filter(d => d.place === this.placeId && d.rad).map(d => ({ x: d.x, y: d.y, rad: d.rad })),
		];
		const same = this.place.plants.filter(p => p.type === type);
		let best = null;
		for (let attempt = 0; attempt < 6; attempt++) {
			const H = this.place.worldH, y0 = this.minY(type);
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
					y = y0 + Math.random() * (H - y0 - 40);
				}
				if (x < 30 || x > WORLD_W - 30 || y < y0 || y > H - 30) continue;
				let gap = Infinity;
				for (const o of obstacles) gap = Math.min(gap, Math.hypot(o.x - x, (o.y - y) * 1.25) - o.rad - sp);
				// Les petites plantes se regroupent en touffes ; les arbres cherchent de l'espace.
				const score = (gap >= 0 ? 1000 : gap) + (near ? 30 : 0) + (type === 'arbre' || type === 'buisson' ? Math.min(gap, 40) : 0) + Math.random() * 20;
				if (score > bestScore) { bestScore = score; best = { x, y }; }
			}
			if (bestScore >= 1000) return best;
			// Plus de place : le jardin s'agrandit vers le bas.
			this.place.worldH += 300;
			this.bgDirty = true;
		}
		return best;
	}

	spawn(type, growth = 0, pos = this.place_(type)) {
		const p = {
			id: uid(), type, x: Math.round(pos.x), y: Math.round(pos.y), growth,
			seed: Math.floor(Math.random() * 2147483647), variant: newVariant(type, this.placeId, this.state.species), born: Date.now(),
		};
		this.place.plants.push(p);
		return p;
	}

	/** Ajoute de l'effort à la plante en cours de ce type ; plante une graine si besoin. Renvoie les évènements. */
	addEffort(type, amount) {
		const events = [];
		const cost = PLANT_TYPES[type].cost;
		let p = this.place.plants.find(q => q.type === type && q.growth < 1);
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

	/** Fait pousser un lieu, affiché ou non, sans toucher à la plante suivie à l'écran. */
	growIn(placeId, type, amount) {
		const keep = { place: this.place, placeId: this.placeId, current: this.current, bgDirty: this.bgDirty };
		this.place = this.state.places[placeId];
		this.placeId = placeId;
		const events = this.addEffort(type, amount);
		Object.assign(this, keep, { bgDirty: keep.bgDirty || (placeId === keep.placeId && this.bgDirty) });
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
			if (grew) this.burst(p.x, p.y + meta.top, stage === STAGES ? 18 : 5);
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
			const meta = DECOR_PAINTERS[key](g);
			s = { canvas: c, top: meta.top };
			this.decorSprites.set(key, s);
		}
		return s;
	}

	decorVisible(key) {
		const d = DECOR[key];
		return d.place === this.placeId && (d.always || !!this.place.unlocked[key]);
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

	/** Point d'eau du lieu (mare, grande mare, mer), s'il y en a un. */
	water() {
		if (this.placeId === 'littoral') return { x: WORLD_W / 2, y: 70, rx: 200, ry: 50, scale: 3 };
		for (const [k, d] of Object.entries(DECOR)) if (d.water && this.decorVisible(k)) return { x: d.x, y: d.y, rx: 95 * (d.scale ?? 1), ry: 48 * (d.scale ?? 1), scale: d.scale ?? 1 };
		return null;
	}

	hour() {
		if (this.hourOverride != null) return this.hourOverride;
		const d = new Date();
		return d.getHours() + d.getMinutes() / 60;
	}

	/** Lumière ambiante et part de nuit, d'après la vraie hauteur du soleil quand on la connaît. */
	light(hour = this.hour()) {
		if (this.altitude) {
			const alt = this.altitude(hour);
			return { amb: lightFromAltitude(alt), night: Math.max(0, Math.min(1, (-3 - alt) / 6)) };
		}
		return { amb: ambientAt(hour, this.sun), night: nightAt(hour, this.sun) };
	}

	night() { return this.light().night; }

	precip() {
		const k = this.weather.kind;
		return k === 'rain' ? 1 : k === 'storm' ? 1.5 : k === 'drizzle' ? 0.45 : k === 'snow' ? 1 : 0;
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
		const critter = this.critterAt(wx, wy);
		if (critter) return { critter, x: e.clientX - rect.left, y: e.clientY - rect.top };
		const sorted = [...this.place.plants].sort((a, b) => b.y - a.y);
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
		this.updateWeather(dt);
	}

	/** Animaux présents : ceux du lieu déjà découverts, chacun à son heure et selon la météo. */
	populate() {
		const n = this.night();
		if (n > 0.5) this.state.seenNight = true;
		const night = n > 0.5, dusk = n > 0.2;
		const wet = this.precip() > 0;
		if (wet && this.weather.kind !== 'snow') this.state.seenRain = true;
		const mature = this.place.plants.filter(p => p.growth >= 1);
		this.flowers = mature.filter(p => p.type === 'fleur');
		this.bushes = mature.filter(p => p.type === 'buisson');
		this.trees = mature.filter(p => p.type === 'arbre');
		this.perches = [...this.bushes, ...this.trees];
		const ok = when => when === 'always' || (when === 'day' && !night) || (when === 'night' && night) || (when === 'dusk' && dusk) || (when === 'wet' && (wet || night));
		for (const sp of SPECIES) {
			if (sp.kind !== 'animal' || sp.place !== this.placeId || !sp.critter.behavior) continue;
			const c = sp.critter;
			let want = this.state.species[sp.id] && ok(c.when) ? c.count(this.state) + (this.idleBonus?.(sp) ?? 0) : 0;
			// Sous la pluie ou la neige, les insectes volants se mettent à l'abri.
			if (wet && FLYERS.has(c.kind)) want = 0;
			const active = this.insects.filter(i => i.sp === sp.id && !i.leaving);
			for (let k = active.length; k < want; k++) {
				const b = this.newCritter(sp);
				if (b) this.insects.push(b);
			}
			for (let k = active.length; k > want; k--) active[k - 1].leaving = true;
		}
	}

	newCritter(sp) {
		const c = sp.critter;
		const side = Math.random() < 0.5 ? -30 : WORLD_W + 30;
		const y = this.camY + this.viewH() * (0.2 + Math.random() * 0.6);
		const base = { sp: sp.id, kind: c.kind, p: c, behavior: c.behavior, t: Math.random() * 10, dir: 1, timer: 2 + Math.random() * 4 };
		const w = this.water();
		switch (c.behavior) {
			case 'water':
				return w && { ...base, x: w.x, y: w.y - 40, mode: 'hover', timer: 1 };
			case 'pond': {
				if (!w) return null;
				if (c.kind === 'heron') return { ...base, x: w.x - w.rx * 0.8, y: w.y + w.ry * 0.2, mode: 'perch', timer: 8 };
				const [px, py] = pick(POND_PADS);
				return { ...base, x: w.x + px * w.scale, y: w.y + py * w.scale - 3, mode: 'perch', timer: 6 + Math.random() * 6 };
			}
			case 'pinned': {
				if (c.on === 'buisson') {
					const target = pick(this.bushes ?? []);
					// Les bêtes volantes arrivent de l'extérieur du jardin avant de se poser ; l'araignée est déjà là.
					const fly = c.kind !== 'spider';
					return target && { ...base, target, ox: (Math.random() - 0.5) * 50, oy: 14 + Math.random() * 30, x: fly ? side : target.x, y: fly ? y - 60 : target.y, mode: fly ? 'arrive' : 'perch' };
				}
				const d = DECOR[c.on];
				return this.decorVisible(c.on) && { ...base, decor: c.on, x: d.x + (Math.random() - 0.5) * 20, y: d.y + this.decorSprite(c.on).top * 0.8, mode: 'perch' };
			}
			case 'perch': {
				const target = pick((c.on === 'buisson' ? this.bushes : this.trees) ?? []);
				return target && { ...base, x: side, y: y - 100, target, ox: c.trunk ? 6 : (Math.random() - 0.5) * (c.on === 'buisson' ? 30 : 60), oy: c.trunk ? 0 : 4, mode: 'seek' };
			}
			case 'walk':
			case 'hop': {
				const home = this.homeFor(c.home);
				if (!home) return null;
				return { ...base, x: home.x + (Math.random() - 0.5) * 60, y: home.y + 10, mode: 'walk', ang: Math.random() * 6.28, home };
			}
			case 'trail': {
				// Une file de fourmis entre leur nid (le muret, ou une touffe d'herbe) et un arbuste ou une fleur.
				const a = this.homeFor('murger') ?? this.homeFor('herbe');
				const b = this.homeFor('buisson') ?? this.homeFor('fleur');
				if (!a || !b) return null;
				const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 80, my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 40;
				return { ...base, x: a.x, y: a.y, mode: 'walk', path: [[a.x, a.y + 6], [mx, my], [b.x, b.y + 4]], n: 11 };
			}
			case 'soar':
				return { ...base, x: WORLD_W / 2, y, mode: 'soar', ang: Math.random() * 6.28, r: 90 + Math.random() * 60 };
			case 'flower':
			case 'flutter':
			default:
				return { ...base, x: side, y, mode: c.behavior === 'flutter' ? 'wander' : 'seek', target: null, ang: Math.random() * 6.28 };
		}
	}

	/** Point d'attache d'un animal : un décor, ou un type de plante mûre du lieu. */
	homeFor(key) {
		const pool = { tree: this.trees, arbre: this.trees, buisson: this.bushes, fleur: this.flowers }[key]
			?? (key === 'herbe' ? this.place.plants.filter(p => p.type === 'herbe' && p.growth >= 1) : null);
		if (pool) { const p = pick(pool); return p && { x: p.x, y: p.y }; }
		return DECOR[key] && this.decorVisible(key) ? { x: DECOR[key].x, y: DECOR[key].y } : null;
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
		const flyAway = () => {
			if (b.exitX == null) b.exitX = b.x < WORLD_W / 2 ? -60 : WORLD_W + 60;
			if (flyTo(b.exitX, b.y - 80, 90, 10) < 5) b.gone = true;
		};
		const has = p => this.place.plants.includes(p);

		switch (b.behavior) {
			case 'flower': {
				if (b.leaving) return flyAway();
				if (b.mode === 'hover' && b.target && has(b.target)) {
					b.timer -= dt;
					const [hx, hy] = this.headOf(b.target);
					b.x = hx + Math.cos(b.t * 3) * 5;
					b.y = hy - 4 + Math.sin(b.t * 5) * 2;
					if (b.timer <= 0) { b.mode = 'seek'; b.target = null; }
					return;
				}
				if (!b.target || !has(b.target)) b.target = this.flowers?.length ? pick(this.flowers) : null;
				if (!b.target) { b.leaving = true; return; }
				const [hx, hy] = this.headOf(b.target);
				if (flyTo(hx, hy - 4, 70, 25) < 4) { b.mode = 'hover'; b.timer = 1.5 + Math.random() * 2; }
				return;
			}
			case 'flutter': {
				if (b.leaving) return flyAway();
				if (b.mode === 'perch' && b.target && has(b.target)) {
					b.timer -= dt;
					const [hx, hy] = this.headOf(b.target);
					b.x = hx + b.ox; b.y = hy + b.oy;
					if (b.timer <= 0) { b.mode = 'wander'; b.target = null; b.timer = 3 + Math.random() * 4; }
					return;
				}
				if (b.mode === 'seek' && b.target && has(b.target)) {
					const [hx, hy] = this.headOf(b.target);
					if (flyTo(hx + b.ox, hy + b.oy, 40, 30) < 3) { b.mode = 'perch'; b.timer = 2 + Math.random() * 3; }
					return;
				}
				b.timer -= dt;
				const spots = [...(this.perches ?? []), ...(this.flowers ?? [])];
				if (b.timer <= 0 && spots.length) {
					b.target = pick(spots);
					b.ox = (Math.random() - 0.5) * (b.target.type === 'fleur' ? 4 : 30);
					b.oy = b.target.type === 'fleur' ? -2 : 6 + Math.random() * 14;
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
			case 'water': {
				if (b.leaving) return flyAway();
				const w = this.water();
				if (!w) { b.leaving = true; return; }
				if (b.mode === 'hover') {
					b.timer -= dt;
					b.x += Math.sin(b.t * 13) * 3 * dt;
					b.y += Math.cos(b.t * 11) * 3 * dt;
					if (b.timer <= 0) { b.mode = 'dart'; b.tx = w.x + (Math.random() - 0.5) * w.rx * 2.6; b.ty = w.y - 30 + (Math.random() - 0.5) * w.ry * 2.4; }
					return;
				}
				if (flyTo(b.tx, b.ty, 220, 0) < 3) { b.mode = 'hover'; b.timer = 0.6 + Math.random(); }
				return;
			}
			case 'pond': {
				if (b.leaving) { b.gone = true; return; }
				const w = this.water();
				if (!w) { b.gone = true; return; }
				if (b.kind === 'heron') {
					b.timer -= dt;
					if (b.timer <= 0) { b.timer = 10 + Math.random() * 10; b.tx = w.x + (Math.random() < 0.5 ? -1 : 1) * w.rx * 0.85; b.ty = w.y + (Math.random() - 0.3) * w.ry; }
					if (b.tx != null && flyTo(b.tx, b.ty, 8, 0) < 2) b.tx = null;
					return;
				}
				if (b.p.swim) {
					b.ang = (b.ang ?? Math.random() * 6) + (Math.random() - 0.5) * dt;
					b.x += Math.cos(b.ang) * 6 * dt;
					b.y += Math.sin(b.ang) * 3 * dt;
					if (Math.hypot((b.x - w.x) / w.rx, (b.y - w.y) / w.ry) > 0.7) b.ang = Math.atan2(w.y - b.y, w.x - b.x);
					b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
					return;
				}
				if (b.mode === 'hop') {
					b.k = Math.min(1, b.k + dt * 2.2);
					b.x = lerp(b.fx, b.tx, b.k);
					b.y = lerp(b.fy, b.ty, b.k) - Math.sin(b.k * Math.PI) * 16;
					if (b.k >= 1) { b.mode = 'perch'; b.timer = 6 + Math.random() * 8; }
					return;
				}
				b.timer -= dt;
				if (b.timer <= 0) {
					const [px, py] = pick(POND_PADS);
					Object.assign(b, { mode: 'hop', k: 0, fx: b.x, fy: b.y, tx: w.x + px * w.scale, ty: w.y + py * w.scale - 3 });
					b.dir = b.tx >= b.x ? 1 : -1;
				}
				return;
			}
			case 'pinned': {
				if (b.leaving) { if (b.p.kind === 'spider') b.gone = true; else flyAway(); return; }
				if (b.target) {
					if (!has(b.target)) { b.gone = true; return; }
					const [hx, hy] = this.headOf(b.target);
					if (b.mode === 'arrive') {
						if (flyTo(hx + b.ox, hy + b.oy, 45, 20) < 2) b.mode = 'perch';
						return;
					}
					b.ox += Math.cos(b.t * 0.7) * 2 * dt;
					b.oy += Math.sin(b.t * 0.5) * 1.5 * dt;
					b.x = hx + b.ox;
					b.y = hy + b.oy;
				} else {
					b.x += Math.cos(b.t * 0.4) * 1.5 * dt;
				}
				b.dir = Math.cos(b.t * 0.7) >= 0 ? 1 : -1;
				return;
			}
			case 'perch': {
				if (b.leaving) b.target = null;
				if (!b.target || !has(b.target)) {
					if (flyTo(b.x < WORLD_W / 2 ? -60 : WORLD_W + 60, b.y - 60, 120, 0) < 5) b.gone = true;
					return;
				}
				const [hx, hy] = this.headOf(b.target);
				// Le pic se pose sur le tronc, les autres oiseaux dans le feuillage.
				const ty = b.p.trunk ? b.target.y - 45 : hy + b.oy;
				if (b.mode === 'perch') {
					b.x = hx + b.ox;
					b.y = ty + (b.p.trunk ? Math.sin(b.t * 0.6) * 6 : 0);
					b.timer -= dt;
					if (b.timer <= 0) {
						b.mode = 'seek';
						b.target = pick(b.p.on === 'buisson' ? this.bushes : this.trees) ?? b.target;
						b.ox = b.p.trunk ? 6 : (Math.random() - 0.5) * (b.p.on === 'buisson' ? 30 : 60);
					}
					return;
				}
				if (flyTo(hx + b.ox, ty, 110, 15) < 3) { b.mode = 'perch'; b.timer = 4 + Math.random() * 6; b.dir = b.p.trunk ? -1 : b.dir; }
				return;
			}
			case 'walk': {
				const home = b.home;
				if (b.leaving) {
					if (flyTo(home.x - 30, home.y - 10, (b.p.speed ?? 14) * 1.3, 0) < 3) b.gone = true;
					return;
				}
				b.ang += (Math.random() - 0.5) * dt * 1.5;
				if (Math.hypot(b.x - home.x, b.y - home.y) > 150) b.ang = Math.atan2(home.y - b.y, home.x - b.x);
				b.timer -= dt;
				if (b.timer < 0) {
					b.mode = 'perch';
					if (b.timer < -2) { b.timer = 3 + Math.random() * 5; b.mode = 'walk'; }
					return;
				}
				const sp = b.p.speed ?? 14;
				b.x += Math.cos(b.ang) * sp * dt;
				b.y += Math.sin(b.ang) * sp * 0.65 * dt;
				b.x = Math.max(10, Math.min(WORLD_W - 10, b.x));
				b.dir = Math.cos(b.ang) >= 0 ? 1 : -1;
				return;
			}
			case 'hop': {
				if (b.leaving) { b.gone = true; return; }
				if (b.mode === 'hop') {
					b.k = Math.min(1, b.k + dt * 1.8);
					b.x = lerp(b.fx, b.tx, b.k);
					b.y = lerp(b.fy, b.ty, b.k) - Math.sin(b.k * Math.PI) * 22;
					if (b.k >= 1) { b.mode = 'walk'; b.timer = 2 + Math.random() * 4; }
					return;
				}
				b.timer -= dt;
				b.x += Math.cos(b.t * 0.5) * 2 * dt;
				if (b.timer <= 0) {
					const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 35;
					let tx = b.x + Math.cos(a) * d, ty = b.y + Math.sin(a) * d * 0.6;
					if (Math.hypot(tx - b.home.x, ty - b.home.y) > 140) { tx = b.home.x; ty = b.home.y + 8; }
					Object.assign(b, { mode: 'hop', k: 0, fx: b.x, fy: b.y, tx: Math.max(10, Math.min(WORLD_W - 10, tx)), ty });
					b.dir = b.tx >= b.x ? 1 : -1;
				}
				return;
			}
			case 'trail': {
				if (b.leaving) b.gone = true;
				return;
			}
			case 'soar': {
				if (b.leaving) return flyAway();
				b.ang += dt * 0.25;
				const cx = WORLD_W / 2, cy = this.camY + this.viewH() * 0.4;
				b.x = cx + Math.cos(b.ang) * b.r * 1.3;
				b.y = cy + Math.sin(b.ang) * b.r * 0.7;
				b.dir = Math.sin(b.ang) > 0 ? -1 : 1;
			}
		}
	}

	// ─── Météo ─────────────────────────────────────────────────────

	updateWeather(dt) {
		const k = this.weather.kind;
		const vh = this.viewH();
		const amount = this.precip();
		if (amount > 0) {
			const snow = k === 'snow';
			const rate = (snow ? 40 : 160) * amount;
			for (let i = 0; i < rate * dt; i++) {
				this.drops.push({ x: Math.random() * (WORLD_W + 80) - 40, y: this.camY - 20 - Math.random() * 40, z: 0.6 + Math.random() * 0.6, snow, ground: this.camY + Math.random() * vh, ph: Math.random() * 6.28 });
			}
		}
		const wind = Math.min(40, this.weather.wind ?? 10);
		for (const d of this.drops) {
			if (d.splash != null) { d.splash += dt * 3; continue; }
			if (d.snow) { d.y += 40 * d.z * dt; d.x += (Math.sin(this.t * 1.5 + d.ph) * 12 + wind * 0.6) * dt; }
			else { d.y += 520 * d.z * dt; d.x += wind * 3 * dt; }
			if (d.y >= d.ground) { if (d.snow) d.gone = true; else d.splash = 0; }
		}
		this.drops = this.drops.filter(d => !d.gone && !(d.splash > 1) && d.y < this.camY + vh + 40);
		if (k === 'storm' && Math.random() < dt * 0.12) this.flash = 1;
		this.flash = Math.max(0, this.flash - dt * 3);
	}

	drawWeather(ctx, S) {
		const k = this.weather.kind;
		if (!this.drops.length) return;
		ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
		const wind = Math.min(40, this.weather.wind ?? 10);
		ctx.lineCap = 'round';
		for (const d of this.drops) {
			if (d.snow) {
				ctx.fillStyle = 'rgba(253,253,250,0.9)';
				ctx.beginPath();
				ctx.arc(d.x, d.y, 1.2 * d.z, 0, Math.PI * 2);
				ctx.fill();
			} else if (d.splash != null) {
				ctx.strokeStyle = `rgba(230,240,245,${0.5 * (1 - d.splash)})`;
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.ellipse(d.x, d.ground, 1 + d.splash * 3, 0.4 + d.splash, 0, 0, Math.PI * 2);
				ctx.stroke();
			} else {
				ctx.strokeStyle = 'rgba(220,232,240,0.45)';
				ctx.lineWidth = 0.6 * d.z;
				ctx.beginPath();
				ctx.moveTo(d.x, d.y);
				ctx.lineTo(d.x - wind * 0.08, d.y - 9 * d.z);
				ctx.stroke();
			}
		}
		if (k === 'storm' && this.flash > 0) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = `rgba(255,255,250,${this.flash * 0.35})`;
			ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}

	// ─── Rendu ─────────────────────────────────────────────────────

	wind(x) {
		const t = this.t;
		const strength = 0.6 + Math.min(2.4, (this.weather.wind ?? 10) / 18);
		const gust = 0.6 * Math.pow(Math.max(0, Math.sin(t * 0.21 - x * 0.004)), 4);
		return strength * (0.45 * Math.sin(t * 0.9 + x * 0.012) + 0.25 * Math.sin(t * 2.3 + x * 0.03) + gust);
	}

	render() {
		const ctx = this.ctx, S = this.S, cw = this.canvas.width, ch = this.canvas.height;
		const hour = this.hour(), { amb, night } = this.light(hour), day = 1 - night;
		const wk = this.weather.kind;
		if (this.bgDirty) this.paintBg();

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.fillStyle = GROUND[this.placeId].base;
		ctx.fillRect(0, 0, cw, ch);
		ctx.drawImage(this.bg, 0, Math.round(-this.camY * S));

		// Ombres de nuages : plus nombreuses et plus sombres par temps couvert.
		const cloudy = { clouds: 1.5, overcast: 2.2, rain: 2, drizzle: 2, storm: 2.6, snow: 1.6, fog: 0.4 }[wk] ?? 1;
		if (day > 0) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.globalAlpha = Math.min(0.85, 0.32 * day * cloudy);
			for (const cl of this.clouds) {
				const span = WORLD_W + cl.w * 2;
				const x = ((cl.x + this.t * cl.speed * (0.5 + (this.weather.wind ?? 10) / 20)) % span + span) % span - cl.w;
				const y = (cl.y % Math.max(600, this.place.worldH)) - this.camY;
				ctx.drawImage(cl.canvas, x * S, y * S);
			}
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1;
		}

		// Ombres des animaux au sol
		ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
		ctx.fillStyle = 'rgba(30,50,20,0.13)';
		for (const b of this.insects) {
			const h = FLIGHT[b.kind] ?? (b.mode === 'perch' ? null : 24);
			if (h == null || b.p.swim || b.behavior === 'trail') continue;
			const big = { hedgehog: 2.6, frog: 1.8, marmot: 2.6, squirrel: 2, heron: 2.4, eagle: 5, gull: 3, crab: 1.8 }[b.kind] ?? 1;
			ctx.beginPath();
			ctx.ellipse(b.x + h * 0.25, b.y + h, 4 * big, 1.8 * big, 0, 0, Math.PI * 2);
			ctx.fill();
		}

		// Décor et plantes, triés par profondeur ; les nageurs juste au-dessus de l'eau
		const entities = [];
		for (const key of Object.keys(DECOR)) if (this.decorVisible(key)) entities.push({ decor: key, y: DECOR[key].y });
		for (const p of this.place.plants) entities.push({ plant: p, y: p.y });
		for (const b of this.insects) if (onGround(b)) entities.push({ critter: b, y: b.behavior === 'trail' ? -1e9 : b.y + 2 });
		entities.sort((a, b) => a.y - b.y);
		for (const e of entities) {
			if (e.critter) {
				ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
				this.drawInsect(ctx, e.critter);
				continue;
			}
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
				if (d.water || e.decor === 'nenuphars') {
					ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
					// Le triton nage sous les nénuphars, le canard flotte par-dessus.
					const lilies = this.decorVisible('nenuphars');
					for (const b of this.insects) {
						if (!b.p.swim) continue;
						const duck = b.kind === 'duck';
						if (duck ? e.decor === 'nenuphars' || !lilies : e.decor !== 'nenuphars') this.drawInsect(ctx, b);
					}
				}
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

		// Animaux en l'air et particules
		ctx.setTransform(S, 0, 0, S, 0, -this.camY * S);
		for (const b of this.insects) if (!onGround(b) && !b.p.swim) this.drawInsect(ctx, b);
		for (const p of this.particles) {
			ctx.globalAlpha = Math.max(0, p.life);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;

		// Lumière de l'heure, de la saison et du temps
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (amb.a > 0.001) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.fillStyle = rgba(amb.color, amb.a);
			ctx.fillRect(0, 0, cw, ch);
		}
		const grey = { overcast: 0.22, rain: 0.28, drizzle: 0.18, storm: 0.38, snow: 0.12, clouds: 0.08 }[wk] ?? 0;
		if (grey) {
			ctx.globalCompositeOperation = 'multiply';
			ctx.fillStyle = `rgba(130,140,152,${grey})`;
			ctx.fillRect(0, 0, cw, ch);
		}
		ctx.globalCompositeOperation = 'source-over';
		if (wk === 'snow') {
			ctx.fillStyle = 'rgba(250,252,255,0.22)';
			ctx.fillRect(0, 0, cw, ch);
		}
		if (wk === 'fog') {
			const g = ctx.createLinearGradient(0, 0, 0, ch);
			g.addColorStop(0, 'rgba(236,238,236,0.55)');
			g.addColorStop(1, 'rgba(236,238,236,0.3)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, cw, ch);
		}

		if (night > 0 && this.state.species['ver-luisant'] && !this.precip()) {
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

		this.drawWeather(ctx, S);

		// Grain de papier (attaché au monde) et vignette
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.paperPattern.setTransform(new DOMMatrix().translateSelf(0, Math.round(-this.camY * S)));
		ctx.fillStyle = this.paperPattern;
		ctx.fillRect(0, 0, cw, ch);
		ctx.drawImage(this.vignette, 0, 0);
	}

	drawInsect(ctx, b) {
		if (b.behavior === 'trail') return this.drawTrail(ctx, b);
		ctx.save();
		ctx.translate(b.x, b.y);
		const k = CRITTER_SIZE[b.kind] ?? 1;
		ctx.scale((b.dir || 1) * k, k);
		drawCritter(ctx, b.kind, b.t, b.mode, b.p);
		ctx.restore();
	}

	/** File de fourmis : la moitié va vers la nourriture, l'autre revient au nid. */
	drawTrail(ctx, b) {
		const [p0, p1, p2] = b.path;
		const at = s => {
			const u = 1 - s;
			return [u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]];
		};
		b.pos = [];
		for (let i = 0; i < b.n; i++) {
			const back = i % 2 === 1;
			let s = ((b.t * 0.035 + i / b.n) % 1 + 1) % 1;
			if (back) s = 1 - s;
			const [x, y] = at(s), [x2, y2] = at(Math.min(1, s + 0.01));
			const ang = Math.atan2(y2 - y, x2 - x) + (back ? Math.PI : 0);
			b.pos.push([x, y]);
			ctx.save();
			ctx.translate(x + Math.sin(b.t * 6 + i) * 0.6, y);
			ctx.rotate(ang);
			ctx.scale(CRITTER_SIZE.ant, CRITTER_SIZE.ant);
			drawCritter(ctx, 'ant', b.t + i);
			ctx.restore();
		}
	}

	/** Animal le plus proche d'un point du monde (pour le toucher du doigt). */
	critterAt(wx, wy) {
		let best = null, bestD = 16;
		for (const b of this.insects) {
			const pts = b.behavior === 'trail' ? (b.pos ?? []) : [[b.x, b.y]];
			for (const [x, y] of pts) {
				const d = Math.hypot(x - wx, y - wy);
				if (d < bestD) { bestD = d; best = b; }
			}
		}
		return best;
	}
}
