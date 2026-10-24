// Les sons de la nature, fabriqués sur place avec Web Audio (aucun fichier, marche hors ligne) :
//   - un fond qui suit le vrai ciel et le lieu : vent, pluie, orage, ressac du littoral, grillons la nuit ;
//   - les cris des animaux visibles à l'écran (merle, mésange, pic, chouette, grenouille, abeilles…),
//     placés à gauche ou à droite selon où ils sont ;
//   - une petite cloche douce, en gamme pentatonique, quand quelque chose de beau arrive.
// Tout reste bas et lent : c'est un paysage sonore, pas une musique de jeu.

import { riverDistance } from './zones.js';

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // do ré mi sol la do : pentatonique, jamais de fausse note

export class Soundscape {
	constructor(garden, state) {
		this.garden = garden;
		this.state = state;
		this.ctx = null;
		this.next = {}; // prochain cri possible, par espèce
		this.lastFlash = 0;
	}

	get settings() { return (this.state.sound ??= { on: true, vol: 0.7 }); }

	/**
	 * Le téléphone n'autorise le son qu'après un vrai geste : le doigt qui se relève (pas celui qui se pose),
	 * un clic ou une touche. On démarre là, avec un court silence joué tout de suite (nécessaire sur iPhone).
	 */
	unlock() {
		if (!this.settings.on) return;
		if (!this.ctx) this.build();
		if (this.ctx.state !== 'running') this.ctx.resume();
		if (!this.primed) {
			this.primed = true;
			const src = this.ctx.createBufferSource();
			src.buffer = this.ctx.createBuffer(1, 1, 22050);
			src.connect(this.ctx.destination);
			src.start(0);
		}
	}

	setOn(on) {
		this.settings.on = on;
		if (on) this.unlock();
		else this.ctx?.suspend();
	}

	setVolume(v) {
		this.settings.vol = v;
		if (this.master) this.master.gain.setTargetAtTime(v * 1.3, this.ctx.currentTime, 0.2);
	}

	pause() { this.ctx?.suspend(); }
	resume() { if (this.settings.on && this.ctx) this.ctx.resume(); }

	build() {
		const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -20;
		comp.ratio.value = 3;
		comp.connect(ctx.destination);
		this.master = ctx.createGain();
		this.master.gain.value = this.settings.vol * 1.3;
		this.master.connect(comp);
		// Un peu d'écho de sous-bois pour les cris : ils semblent venir de plus loin, plus doux.
		this.verb = ctx.createConvolver();
		this.verb.buffer = this.impulse(2.2);
		const wet = ctx.createGain();
		wet.gain.value = 0.35;
		this.verb.connect(wet).connect(this.master);

		const len = ctx.sampleRate * 3;
		this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = this.noise.getChannelData(0);
		let b = 0;
		for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 3; }

		this.wind = this.bed({ type: 'bandpass', freq: 380, q: 0.5 }, 0);
		this.rain = this.bed({ type: 'highpass', freq: 900, q: 0.3 }, 0, { type: 'lowpass', freq: 7000 });
		this.rainBody = this.bed({ type: 'lowpass', freq: 500, q: 0.4 }, 0);
		this.sea = this.bed({ type: 'lowpass', freq: 520, q: 0.5 }, 0, null, 0.11);
		// La rivière : un petit clapotis clair qui ondule (pas de grondement : ce n'est pas une cascade).
		this.riverHi = this.bed({ type: 'bandpass', freq: 2600, q: 1.2 }, 0, null, 1.7);
		// Les feuilles qui bruissent, plus fort avec le vent.
		this.leaves = this.bed({ type: 'highpass', freq: 3200, q: 0.3 }, 0, null, 0.07);
		this.loop = setInterval(() => this.tick(), 250);
	}

	/** Un bruit filtré qui tourne en boucle ; `swell` : houle lente du volume (vagues, clapotis), en Hz. */
	bed(f1, gain, f2 = null, swell = 0) {
		const ctx = this.ctx;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		src.loop = true;
		src.playbackRate.value = 0.8 + Math.random() * 0.4;
		const filt = ctx.createBiquadFilter();
		filt.type = f1.type; filt.frequency.value = f1.freq; filt.Q.value = f1.q;
		let node = src.connect(filt);
		if (f2) { const g2 = ctx.createBiquadFilter(); g2.type = f2.type; g2.frequency.value = f2.freq; node = node.connect(g2); }
		const g = ctx.createGain();
		g.gain.value = gain;
		node.connect(g);
		let out = g;
		if (swell) {
			const sw = ctx.createGain();
			sw.gain.value = 0.6;
			const lfo = ctx.createOscillator(), depth = ctx.createGain();
			lfo.frequency.value = swell; depth.gain.value = 0.4;
			lfo.connect(depth).connect(sw.gain);
			lfo.start();
			out = g.connect(sw);
		}
		out.connect(this.master);
		src.start();
		return { gain: g, filt };
	}

	impulse(sec) {
		const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
		const buf = ctx.createBuffer(2, n, ctx.sampleRate);
		for (let c = 0; c < 2; c++) {
			const d = buf.getChannelData(c);
			for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
		}
		return buf;
	}

	set(bed, v, t = 1.5) { bed.gain.gain.setTargetAtTime(v, this.ctx.currentTime, t); }

	/** Toutes les 250 ms : le fond suit le ciel, et parfois un animal visible chante. */
	tick() {
		const ctx = this.ctx, g = this.garden;
		if (!ctx || ctx.state !== 'running') return;
		const k = g.weather.kind, wind = Math.min(40, g.weather.wind ?? 10);
		const rain = { drizzle: 0.35, rain: 0.8, storm: 1, snow: 0 }[k] ?? 0;
		const night = g.night();
		const biome = g.biome;
		// Pas de souffle permanent : le vent n'arrive que par rafales, quand il y a vraiment du vent,
		// et les feuilles ne bruissent que pendant ces rafales.
		const now = ctx.currentTime;
		const windy = Math.max(0, (wind - 12) / 28) + (k === 'storm' ? 0.6 : 0);
		if (windy > 0 && now > (this.nextGust ?? 0)) {
			this.nextGust = now + 9 + Math.random() * 14 / (0.5 + windy);
			const peak = Math.min(0.09, 0.03 + windy * 0.05) * (biome === 'montagne' ? 1.3 : 1);
			for (const [bed, k2] of [[this.wind, 1], [this.leaves, biome === 'littoral' ? 0 : 0.35]]) {
				const gg = bed.gain.gain;
				gg.cancelScheduledValues(now);
				gg.setValueAtTime(gg.value, now);
				gg.linearRampToValueAtTime(peak * k2, now + 2.5 + Math.random() * 1.5);
				gg.linearRampToValueAtTime(0, now + 7 + Math.random() * 3);
			}
			this.wind.filt.frequency.setTargetAtTime(300 + wind * 8, now, 2);
		}
		if (!windy) { this.set(this.wind, 0, 2); this.set(this.leaves, 0, 2); }
		this.set(this.rain, rain * 0.12);
		this.set(this.rainBody, rain * 0.08);
		this.set(this.sea, biome === 'littoral' ? 0.16 : 0);
		// Un filet d'eau, seulement tout près de la rivière.
		const v0 = g.view(), d = riverDistance(biome, v0.x0 + v0.w / 2, v0.y0 + v0.h / 2);
		const byRiver = Math.max(0, 1 - d / 420) ** 2;
		this.set(this.riverHi, byRiver * 0.025, 0.8);

		// Orage : le tonnerre suit l'éclair, avec un peu de retard (il est loin).
		if (g.flash > 0.9 && performance.now() - this.lastFlash > 3000) {
			this.lastFlash = performance.now();
			setTimeout(() => this.thunder(), 600 + Math.random() * 1800);
		}

		// La nuit, des grillons au loin (sauf sous la pluie et en hiver).
		const winter = g.season?.winter ?? 0;
		if (night > 0.4 && !rain && winter < 0.6 && Math.random() < 0.35) this.cricket();
		// Le jour, des oiseaux au loin, très bas : le jardin n'est jamais silencieux, même au tout début.
		if (night < 0.2 && rain < 0.5 && winter < 0.8 && Math.random() < 0.08) this.distant();

		if (g.glyph) return; // en vue d'ensemble, on n'entend plus les animaux un par un
		const v = g.view();
		const seen = g.insects.filter(b => !b.leaving && b.x > v.x0 && b.x < v.x0 + v.w && b.y > v.y0 && b.y < v.y0 + v.h);
		const near = Math.min(1, g.cam.z / 1.2);
		// Bourdonnement continu, selon les abeilles et bourdons proches du centre.
		const buzzers = seen.filter(b => BUZZ[b.kind]);
		if (buzzers.length && !this.buzz) this.buzz = this.makeBuzz();
		if (this.buzz) {
			const cx = v.x0 + v.w / 2, cy = v.y0 + v.h / 2;
			let level = 0;
			for (const b of buzzers) level += BUZZ[b.kind] * Math.max(0, 1 - Math.hypot(b.x - cx, b.y - cy) / (v.w * 0.8));
			this.buzz.gain.gain.setTargetAtTime(Math.min(0.05, level * 0.02 * near * near), now, 0.4);
		}
		// Un animal visible, au hasard, chante s'il en a envie.
		const b = seen[Math.floor(Math.random() * seen.length)];
		if (!b) return;
		const call = CALLS[b.sp] ?? CALLS[b.kind];
		if (!call || (this.next[b.sp] ?? 0) > now) return;
		if (Math.random() > call.chance) return;
		this.next[b.sp] = now + call.every * (0.7 + Math.random() * 0.6);
		const pan = Math.max(-0.8, Math.min(0.8, ((b.x - v.x0) / v.w) * 2 - 1));
		this[call.voice](pan, call, 0.4 + 0.6 * near);
	}

	/** Une voix courte : oscillateur, enveloppe douce, panoramique, un peu d'écho. */
	voice(pan, level) {
		const ctx = this.ctx;
		const g = ctx.createGain();
		const p = ctx.createStereoPanner();
		p.pan.value = pan;
		g.connect(p);
		p.connect(this.master);
		p.connect(this.verb);
		return { g, level };
	}

	note(out, t, f0, f1, dur, vol, type = 'sine') {
		const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(f0, t);
		o.frequency.exponentialRampToValueAtTime(f1, t + dur);
		e.gain.setValueAtTime(0, t);
		e.gain.linearRampToValueAtTime(vol * out.level, t + Math.min(0.02, dur / 3));
		e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(e).connect(out.g);
		o.start(t);
		o.stop(t + dur + 0.05);
	}

	// ─── Les cris ──────────────────────────────────────────────────

	/** Merle : phrase flûtée, quelques notes graves qui montent et descendent. */
	blackbird(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		let f = 1700 + Math.random() * 500, at = t;
		for (let i = 0, n = 4 + Math.floor(Math.random() * 4); i < n; i++) {
			const nf = Math.max(1300, Math.min(2900, f * (0.8 + Math.random() * 0.5)));
			this.note(out, at, f, nf, 0.12 + Math.random() * 0.14, 0.05);
			f = nf;
			at += 0.16 + Math.random() * 0.12;
		}
	}

	/** Mésange : « ti-tu ti-tu ti-tu ». */
	tit(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
			this.note(out, t + i * 0.26, 5200, 5000, 0.08, 0.035);
			this.note(out, t + i * 0.26 + 0.11, 3700, 3500, 0.1, 0.035);
		}
	}

	/** Petits cris aigus et brefs (martin-pêcheur, gravelot). */
	peep(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < c.n; i++) this.note(out, t + i * c.gap, c.f0, c.f1, c.dur, 0.03);
	}

	/** Cri rauque (geai, casse-noix) : un bruit court et nasal. */
	harsh(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < c.n; i++) {
			this.note(out, t + i * 0.32, c.f, c.f * 0.8, 0.22, 0.012, 'sawtooth');
			this.note(out, t + i * 0.32, c.f * 2.01, c.f * 1.6, 0.2, 0.006, 'sawtooth');
		}
	}

	/** Pic : un tambourinage rapide qui ralentit, sur le tronc. */
	drum(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 16; i++) this.note(out, t + i * (0.045 + i * 0.002), 900, 300, 0.035, 0.05, 'triangle');
	}

	/** Chouette hulotte : « hou… hou-hou-hou ». */
	owl(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 420, 400, 0.55, 0.05);
		for (let i = 0; i < 3; i++) this.note(out, t + 1.3 + i * 0.28, 410, 380, 0.22, 0.04);
	}

	/** Canard : deux ou trois « coin » nasillards. */
	duck(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this.note(out, t + i * 0.24, 360, 280, 0.16, 0.012, 'sawtooth');
	}

	/** Goéland, aigle : un long cri qui glisse vers le bas. */
	cry(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < c.n; i++) {
			this.note(out, t + i * c.gap, c.f0, c.f1, c.dur, 0.03, 'triangle');
			this.note(out, t + i * c.gap, c.f0 * 2, c.f1 * 2, c.dur, 0.008);
		}
	}

	/** Grenouille : un coassement grave en trémolo. */
	frog(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
			for (let i = 0; i < 7; i++) this.note(out, t + k * 0.5 + i * 0.035, 330, 260, 0.03, 0.03, 'triangle');
		}
	}

	/** Marmotte : un sifflet d'alerte, aigu et net. */
	whistle(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 2600, 2900, 0.3, 0.035);
	}

	/** Sauterelle : une stridulation sèche, en petits paquets. */
	chirr(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let k = 0; k < 3; k++) for (let i = 0; i < 10; i++) this.note(out, t + k * 0.45 + i * 0.022, 7000, 6500, 0.012, 0.012, 'square');
	}

	/** Héron : un croassement grave, rare. */
	croak(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 220, 160, 0.4, 0.014, 'sawtooth');
	}

	/** Un oiseau lointain, à peine audible, noyé dans l'écho. */
	distant() {
		const out = this.voice(Math.random() * 1.4 - 0.7, 0.35), t = this.ctx.currentTime + 0.05;
		const f = 2400 + Math.random() * 2000, kind = Math.random();
		if (kind < 0.4) {
			// Quelques notes qui sautillent.
			for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) this.note(out, t + i * 0.14, f * (1 + (Math.random() - 0.5) * 0.2), f * 0.9, 0.09, 0.03);
		} else if (kind < 0.75) {
			// Un trille rapide.
			for (let i = 0; i < 9; i++) this.note(out, t + i * 0.055, f * (i % 2 ? 1.08 : 1), f, 0.045, 0.022);
		} else {
			// Un appel en deux notes, la seconde plus basse.
			this.note(out, t, f, f * 1.05, 0.18, 0.03);
			this.note(out, t + 0.28, f * 0.78, f * 0.74, 0.22, 0.03);
		}
	}

	cricket() {
		const out = this.voice(Math.random() * 1.6 - 0.8, 0.5), t = this.ctx.currentTime + 0.05;
		const f = 4200 + Math.random() * 800;
		for (let i = 0; i < 3; i++) this.note(out, t + i * 0.045, f, f, 0.03, 0.018);
	}

	makeBuzz() {
		const ctx = this.ctx;
		const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		o.type = 'sawtooth'; o.frequency.value = 190;
		o2.type = 'sawtooth'; o2.frequency.value = 223;
		f.type = 'lowpass'; f.frequency.value = 900;
		g.gain.value = 0;
		const lfo = ctx.createOscillator(), depth = ctx.createGain();
		lfo.frequency.value = 0.7; depth.gain.value = 12;
		lfo.connect(depth); depth.connect(o.frequency); depth.connect(o2.frequency);
		o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
		o.start(); o2.start(); lfo.start();
		return { gain: g };
	}

	thunder() {
		if (!this.ctx || this.ctx.state !== 'running') return;
		const ctx = this.ctx, t = ctx.currentTime;
		const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		src.buffer = this.noise;
		f.type = 'lowpass'; f.frequency.value = 160;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.5, t + 0.15);
		g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
		src.connect(f).connect(g).connect(this.master);
		src.start(t, Math.random() * 1.5);
		src.stop(t + 4.6);
	}

	/** Cloche douce pour un bon moment : `size` 1 (une plante a poussé) à 3 (nouveau lieu). */
	chime(size = 1) {
		if (!this.ctx || this.ctx.state !== 'running') return;
		const out = this.voice(0, 1), t = this.ctx.currentTime + 0.02;
		const start = Math.floor(Math.random() * 3);
		for (let i = 0; i < size; i++) {
			const f = NOTES[Math.min(NOTES.length - 1, start + i * 2)];
			this.note(out, t + i * 0.22, f, f, 2.4, 0.03);
			this.note(out, t + i * 0.22, f * 2.76, f * 2.76, 0.9, 0.006); // partiel de cloche
		}
	}
}

// Volume relatif du bourdonnement de chaque insecte.
const BUZZ = { bee: 1, hoverfly: 0.4, beefly: 0.5 };

// Qui chante comment, et à quelle fréquence au plus (secondes).
const CALLS = {
	merle: { voice: 'blackbird', every: 9, chance: 0.5 },
	mesange: { voice: 'tit', every: 8, chance: 0.5 },
	'martin-pecheur': { voice: 'peep', every: 12, chance: 0.4, n: 2, gap: 0.18, f0: 4600, f1: 4100, dur: 0.12 },
	gravelot: { voice: 'peep', every: 10, chance: 0.4, n: 2, gap: 0.35, f0: 2400, f1: 2000, dur: 0.2 },
	pic: { voice: 'drum', every: 14, chance: 0.4 },
	geai: { voice: 'harsh', every: 16, chance: 0.35, n: 2, f: 900 },
	cassenoix: { voice: 'harsh', every: 15, chance: 0.35, n: 3, f: 750 },
	hulotte: { voice: 'owl', every: 18, chance: 0.4 },
	colvert: { voice: 'duck', every: 14, chance: 0.4 },
	goeland: { voice: 'cry', every: 12, chance: 0.4, n: 3, gap: 0.45, f0: 1500, f1: 1050, dur: 0.38 },
	aigle: { voice: 'cry', every: 22, chance: 0.4, n: 1, gap: 0, f0: 2300, f1: 1700, dur: 0.7 },
	grenouille: { voice: 'frog', every: 7, chance: 0.5 },
	marmotte: { voice: 'whistle', every: 20, chance: 0.35 },
	sauterelle: { voice: 'chirr', every: 6, chance: 0.5 },
	heron: { voice: 'croak', every: 30, chance: 0.3 },
};
