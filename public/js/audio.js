// Les sons de la nature, avec Web Audio (tout marche hors ligne) :
//   - un fond très discret qui suit le vrai ciel et le lieu : pluie et orage quand il pleut vraiment,
//     ressac du littoral, grillons la nuit ; aucun souffle ni bruit de fond continu ;
//   - les cris des animaux visibles à l'écran, placés à gauche ou à droite selon où ils sont : de vrais
//     enregistrements (public/sfx, BigSoundBank, domaine public) quand on en a, joués chaque fois un peu
//     différemment (variante, hauteur, volume) ; sinon une voix fabriquée sur place (pic, mésange, rapaces…) ;
//   - une petite cloche douce, en gamme pentatonique, quand quelque chose de beau arrive ;
//   - une musique générative très calme : notes et accords tirés au hasard dans une gamme pentatonique,
//     avec de longs silences ; elle ne boucle jamais, donc ne se répète jamais.
// Tout reste bas et lent : c'est un paysage sonore, pas une musique de jeu.

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // do ré mi sol la do : pentatonique, jamais de fausse note

export class Soundscape {
	constructor(garden, state) {
		this.garden = garden;
		this.state = state;
		this.ctx = null;
		this.next = {}; // prochain cri possible, par espèce
		this.lastFlash = 0;
		this.buf = {}; // les vrais cris, une fois chargés : nom → variantes
		this.lastVar = {};
		this.voices = 0;
	}

	get settings() { return (this.state.sound ??= { on: true, vol: 0.7 }); }
	get musicSettings() { return (this.state.music ??= { on: true, vol: 0.5 }); }
	get anyOn() { return this.settings.on || this.musicSettings.on; }

	/**
	 * Le téléphone n'autorise le son qu'après un vrai geste : le doigt qui se relève (pas celui qui se pose),
	 * un clic ou une touche. On démarre là, avec un court silence joué tout de suite (nécessaire sur iPhone).
	 */
	unlock() {
		if (!this.anyOn) return;
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

	/** Sons de la nature et musique se règlent chacun de leur côté ; tout s'arrête si les deux sont coupés. */
	setOn(on) {
		this.settings.on = on;
		this.applyLevels();
	}

	setVolume(v) {
		this.settings.vol = v;
		this.applyLevels();
	}

	setMusicOn(on) {
		this.musicSettings.on = on;
		this.applyLevels();
	}

	setMusicVolume(v) {
		this.musicSettings.vol = v;
		this.applyLevels();
	}

	applyLevels() {
		if (this.anyOn) this.unlock();
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.master.gain.setTargetAtTime(this.settings.on ? this.settings.vol * 1.3 : 0, t, 0.3);
		this.musicBus.gain.setTargetAtTime(this.musicSettings.on ? this.musicSettings.vol * 0.7 : 0, t, 0.8);
		if (!this.anyOn) this.ctx.suspend();
	}

	pause() { this.ctx?.suspend(); }
	resume() { if (this.anyOn && this.ctx) this.ctx.resume(); }

	build() {
		const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -20;
		comp.ratio.value = 3;
		comp.connect(ctx.destination);
		this.master = ctx.createGain();
		this.master.gain.value = this.settings.on ? this.settings.vol * 1.3 : 0;
		this.master.connect(comp);
		// La musique a son propre volume et son propre écho, plus long et plus doux.
		this.musicBus = ctx.createGain();
		this.musicBus.gain.value = this.musicSettings.on ? this.musicSettings.vol * 0.7 : 0;
		this.musicBus.connect(comp);
		this.musicVerb = ctx.createConvolver();
		this.musicVerb.buffer = this.impulse(4.5);
		const mwet = ctx.createGain();
		mwet.gain.value = 0.55;
		this.musicVerb.connect(mwet).connect(this.musicBus);
		this.nextNote = ctx.currentTime + 4;
		this.nextPad = ctx.currentTime + 1.5;
		this.deg = 7;
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

		this.rain = this.bed({ type: 'highpass', freq: 900, q: 0.3 }, 0, { type: 'lowpass', freq: 7000 });
		this.rainBody = this.bed({ type: 'lowpass', freq: 500, q: 0.4 }, 0);
		this.sea = this.bed({ type: 'lowpass', freq: 520, q: 0.5 }, 0, null, 0.11);
		this.loop = setInterval(() => this.tick(), 250);
		this.loadSamples();
	}

	/** Charge les vrais cris une seule fois, au premier geste ; en attendant (ou sans réseau), les voix fabriquées. */
	loadSamples() {
		for (const [name, n] of Object.entries(SAMPLES)) {
			for (let i = 1; i <= n; i++) {
				fetch(`sfx/${name}-${i}.mp3`)
					.then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
					// La forme à rappels marche aussi sur les vieux Safari.
					.then(ab => new Promise((ok, ko) => this.ctx.decodeAudioData(ab, ok, ko)))
					.then(b => (this.buf[name] ??= []).push(b))
					.catch(() => {});
			}
		}
	}

	/**
	 * Joue un vrai cri : une variante tirée au hasard (jamais deux fois la même de suite), un peu plus haute ou plus
	 * basse et plus ou moins forte à chaque fois, pour que la répétition ne s'entende pas. Faux s'il n'est pas chargé
	 * ou si trop de bêtes chantent déjà (le téléphone et l'oreille saturent).
	 */
	sample(name, pan, level, rate = 1, opt = {}) {
		const list = this.buf[name];
		if (!list?.length || this.voices >= MAX_VOICES) return false;
		let i = Math.floor(Math.random() * list.length);
		if (list.length > 1 && i === this.lastVar[name]) i = (i + 1) % list.length;
		this.lastVar[name] = i;
		const ctx = this.ctx, src = ctx.createBufferSource(), t = ctx.currentTime + 0.03;
		src.buffer = list[i];
		src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
		const out = this.voice(pan, level), vol = Tuning.num('son.niveau_cris', SAMPLE_LEVEL) * (SAMPLE_GAIN[name] ?? 1) * (opt.vol ?? 1) * level * 10 ** ((Math.random() - 0.5) * 0.25);
		const dur = list[i].duration / src.playbackRate.value;
		if (opt.swell) {
			// Un insecte qui passe : le son monte, puis s'éloigne d'un côté à l'autre.
			out.g.gain.setValueAtTime(0, t);
			out.g.gain.linearRampToValueAtTime(vol, t + dur * 0.45);
			out.g.gain.linearRampToValueAtTime(0, t + dur);
			out.p.pan.setValueAtTime(pan - 0.3, t);
			out.p.pan.linearRampToValueAtTime(pan + 0.3, t + dur);
		} else out.g.gain.value = vol;
		src.connect(out.g);
		this.voices++;
		src.onended = () => { this.voices = Math.max(0, this.voices - 1); out.p.disconnect(); };
		src.start(t);
		return true;
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
		const k = g.weather.kind;
		const rain = { drizzle: 0.35, rain: 0.8, storm: 1, snow: 0 }[k] ?? 0;
		const night = g.night();
		const biome = g.biome;
		// Pas de vent ni de bruissement : un souffle, même par rafales, finit par sonner comme un bruit de fond.
		const now = ctx.currentTime;
		this.music(now, night);
		this.set(this.rain, rain * 0.12);
		this.set(this.rainBody, rain * 0.08);
		this.set(this.sea, biome === 'littoral' ? 0.16 : 0);

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
		// Les bêtes à l'écran, plus la basse-cour et le compagnon de la cabane.
		const seen = [...g.insects, ...(g.hens ?? []), ...(g.pet ? [g.pet] : [])].filter(b => b && !b.leaving && !b.hidden && b.x > v.x0 && b.x < v.x0 + v.w && b.y > v.y0 && b.y < v.y0 + v.h);
		const near = Math.min(1, g.cam.z / 1.2);
		// Une abeille qui passe tout près : un bref bourdonnement, de temps en temps, seulement quand on regarde de près.
		if (g.cam.z >= 1.2 && now > (this.nextBuzz ?? 0)) {
			const cx = v.x0 + v.w / 2, cy = v.y0 + v.h / 2;
			const close = seen.filter(b => BUZZ[b.kind] && Math.hypot(b.x - cx, b.y - cy) < v.w * 0.3);
			if (close.length && Math.random() < 0.3) {
				const b = close[Math.floor(Math.random() * close.length)];
				this.nextBuzz = now + 8 + Math.random() * 10;
				this.flyby(Math.max(-0.7, Math.min(0.7, ((b.x - v.x0) / v.w) * 2 - 1)), BUZZ[b.kind]);
			}
		}
		// Un animal visible, au hasard, chante s'il en a envie.
		const b = seen[Math.floor(Math.random() * seen.length)];
		if (!b) return;
		const call = CALLS[b.sp] ?? kindCall(b), key = b.sp ?? `${b.kind}${b.p?.rooster ? '-coq' : ''}`;
		if (!call || (this.next[key] ?? 0) > now) return;
		// De près, on entend les bêtes plus souvent (et plus fort, voir plus bas).
		if (Math.random() > call.chance * (0.45 + 0.55 * near)) return;
		this.next[key] = now + call.every * (0.7 + Math.random() * 0.6);
		const pan = Math.max(-0.8, Math.min(0.8, ((b.x - v.x0) / v.w) * 2 - 1));
		const s = sampleFor(b);
		// Un vrai cri dès qu'il est chargé (s'il y a déjà trop de voix, la bête se tait cette fois).
		if (s && this.buf[s.name]) { this.sample(s.name, pan, 0.4 + 0.6 * near, s.rate); return; }
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
		return { g, p, level };
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

	/** Un chant d'oiseau générique, propre à chaque espèce : hauteur, nombre de notes et rythme tirés de son nom. */
	warble(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		let f = c.f, at = t;
		for (let i = 0; i < c.n; i++) {
			const nf = f * (c.up ? 1.08 : 0.94) * (0.92 + Math.random() * 0.16);
			this.note(out, at, f, nf, c.dur, 0.03);
			f = i % 3 === 2 ? c.f : nf;
			at += c.gap;
		}
	}

	/** Poule : quelques « cot » secs. */
	cluck(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.note(out, t + i * 0.2, 520, 380, 0.09, 0.02, 'sawtooth');
	}

	/** Coq : « co-co-ri-coooo ». */
	crow(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		[[620, 600, 0.12], [680, 660, 0.12], [760, 740, 0.14], [880, 640, 0.7]].reduce((at, [a, b, d]) => { this.note(out, at, a, b, d, 0.03, 'sawtooth'); return at + d + 0.04; }, t);
	}

	/** Chien : un ou deux aboiements. */
	bark(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) { this.note(out, t + i * 0.3, 420, 250, 0.13, 0.04, 'sawtooth'); this.note(out, t + i * 0.3, 840, 500, 0.1, 0.01); }
	}

	/** Chat : un miaulement qui monte puis retombe. */
	meow(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 600, 900, 0.25, 0.025, 'triangle');
		this.note(out, t + 0.25, 900, 550, 0.35, 0.025, 'triangle');
	}

	/** Sanglier : un grognement grave. */
	grunt(pan, c, lvl) {
		const out = this.voice(pan, lvl), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 2; i++) this.note(out, t + i * 0.28, 120, 90, 0.2, 0.03, 'sawtooth');
	}

	/** Un oiseau lointain, à peine audible, noyé dans l'écho. */
	distant() {
		// De préférence un vrai chanteur, très bas et noyé dans l'écho.
		const sing = SONGBIRDS[Math.floor(Math.random() * SONGBIRDS.length)];
		if (this.sample(sing, Math.random() * 1.4 - 0.7, 0.35, 0.9 + Math.random() * 0.3, { vol: 0.35 })) return;
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
		// Un vrai grillon, de temps en temps (un enregistrement dure quelques secondes) ; sinon trois petits « cri ».
		if (this.buf.grillon) {
			const now = this.ctx.currentTime;
			if (now < (this.nextCricket ?? 0)) return;
			this.nextCricket = now + 3 + Math.random() * 5;
			if (this.sample('grillon', Math.random() * 1.6 - 0.8, 0.5, 0.9 + Math.random() * 0.2, { vol: 0.3 })) return;
		}
		const out = this.voice(Math.random() * 1.6 - 0.8, 0.5), t = this.ctx.currentTime + 0.05;
		const f = 4200 + Math.random() * 800;
		for (let i = 0; i < 3; i++) this.note(out, t + i * 0.045, f, f, 0.03, 0.018);
	}

	/** Un insecte qui passe : un bourdonnement doux qui monte, change de hauteur en passant, et s'éloigne. */
	flyby(pan, kind) {
		// Le vrai bourdon ; plus aigu pour les petites mouches.
		if (this.sample('bourdon', pan, 1, kind === 1 ? 1 : 1.7, { swell: true, vol: kind === 1 ? 0.6 : 0.35 })) return;
		const ctx = this.ctx, t = ctx.currentTime + 0.05, dur = 1.1 + Math.random() * 0.8;
		const base = kind === 1 ? 165 + Math.random() * 40 : 260 + Math.random() * 60;
		const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
		o.type = 'triangle';
		o.frequency.setValueAtTime(base * 1.06, t);
		o.frequency.linearRampToValueAtTime(base * 0.94, t + dur);
		const lfo = ctx.createOscillator(), depth = ctx.createGain();
		lfo.frequency.value = 9; depth.gain.value = base * 0.02;
		lfo.connect(depth).connect(o.frequency);
		f.type = 'lowpass'; f.frequency.value = 700;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.025 * (kind === 1 ? 1 : 0.6), t + dur * 0.45);
		g.gain.linearRampToValueAtTime(0, t + dur);
		p.pan.setValueAtTime(pan - 0.3, t);
		p.pan.linearRampToValueAtTime(pan + 0.3, t + dur);
		o.connect(f).connect(g).connect(p).connect(this.master);
		o.start(t); lfo.start(t);
		o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
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

	// ─── La musique ───────────────────────────────────────────────

	/**
	 * Musique générative : un accord tenu de temps en temps, et de courtes phrases de quelques notes
	 * qui se promènent dans la gamme, séparées par de longs silences. Rien n'est écrit à l'avance.
	 * La nuit, tout descend d'une octave et ralentit.
	 */
	music(now, night) {
		if (!this.musicSettings.on) return;
		const slow = night > 0.5 ? 1.5 : 1;
		if (now >= this.nextPad) {
			this.pad(night > 0.5);
			this.nextPad = now + (22 + Math.random() * 20) * slow;
		}
		if (now >= this.nextNote) {
			if (!this.phrase) this.phrase = 3 + Math.floor(Math.random() * 4);
			// La mélodie avance par petits pas, parfois un saut, et reste dans un registre doux.
			const step = [-2, -1, -1, 1, 1, 2, 3, -3][Math.floor(Math.random() * 8)];
			const lo = night > 0.5 ? 2 : 5, hi = night > 0.5 ? 9 : 12;
			this.deg = Math.max(lo, Math.min(hi, this.deg + step));
			this.bell(SCALE[this.deg], 0.5 + Math.random() * 0.5);
			this.phrase--;
			this.nextNote = now + (this.phrase > 0 ? 0.9 + Math.random() * 1.6 : 9 + Math.random() * 14) * slow;
		}
	}

	/** Une note de musique : douce, longue, un peu d'écho. */
	bell(f, vel) {
		const ctx = this.ctx, t = ctx.currentTime + 0.05, dur = 3.5 + Math.random() * 2;
		const pan = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
		pan.pan.value = (Math.random() - 0.5) * 0.8;
		lp.type = 'lowpass'; lp.frequency.value = 2400;
		lp.connect(pan);
		pan.connect(this.musicBus);
		pan.connect(this.musicVerb);
		for (const [mult, amp, type] of [[1, 0.06, 'sine'], [2, 0.012, 'sine'], [3, 0.004, 'triangle']]) {
			const o = ctx.createOscillator(), e = ctx.createGain();
			o.type = type;
			o.frequency.value = f * mult;
			e.gain.setValueAtTime(0, t);
			e.gain.linearRampToValueAtTime(amp * vel, t + 0.04);
			e.gain.exponentialRampToValueAtTime(0.0001, t + dur / mult);
			o.connect(e).connect(lp);
			o.start(t);
			o.stop(t + dur + 0.1);
		}
	}

	/** Un accord tenu qui monte et redescend très lentement. */
	pad(low) {
		const ctx = this.ctx, t = ctx.currentTime + 0.05;
		const root = PAD_ROOTS[Math.floor(Math.random() * PAD_ROOTS.length)] / (low ? 2 : 1);
		const voicing = PAD_VOICINGS[Math.floor(Math.random() * PAD_VOICINGS.length)];
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass'; lp.frequency.value = low ? 650 : 900;
		lp.connect(this.musicBus);
		lp.connect(this.musicVerb);
		const up = 5 + Math.random() * 3, hold = 6 + Math.random() * 6, down = 9 + Math.random() * 5;
		for (const semi of voicing) {
			for (const cents of [-4, 4]) {
				const o = ctx.createOscillator(), e = ctx.createGain();
				o.type = 'sine';
				o.frequency.value = root * Math.pow(2, semi / 12) * Math.pow(2, cents / 1200);
				e.gain.setValueAtTime(0, t);
				e.gain.linearRampToValueAtTime(0.018, t + up);
				e.gain.setValueAtTime(0.018, t + up + hold);
				e.gain.linearRampToValueAtTime(0, t + up + hold + down);
				o.connect(e).connect(lp);
				o.start(t);
				o.stop(t + up + hold + down + 0.1);
			}
		}
	}

	/** Cloche douce pour un bon moment : `size` 1 (une plante a poussé) à 3 (nouveau lieu). */
	/** Une goutte qui tombe dans la bourse : une note claire, de plus en plus aiguë à mesure que la cagnotte monte (k : 0 → 1). */
	drip(k = 0) {
		if (!this.ctx || this.ctx.state !== 'running') return;
		const out = this.voice((Math.random() - 0.5) * 0.4, 1), t = this.ctx.currentTime + 0.01;
		const f = NOTES[Math.min(NOTES.length - 1, Math.floor(k * NOTES.length))] * 2;
		this.note(out, t, f, f * 1.01, 0.35, 0.018);
		this.note(out, t, f * 2.76, f * 2.76, 0.12, 0.004);
	}

	/** Un coup de marteau sur du bois : un « toc » sec et court, un peu différent à chaque fois. */
	knock(k = 0) {
		if (!this.ctx || this.ctx.state !== 'running') return;
		const out = this.voice((Math.random() - 0.5) * 0.5, 1), t = this.ctx.currentTime + 0.01, f = 420 + k * 40 + Math.random() * 30;
		this.note(out, t, f, f * 0.6, 0.09, 0.05, 'triangle');
		this.note(out, t, f * 3.1, f * 2.2, 0.035, 0.008, 'square');
	}

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

// Insectes qui bourdonnent : 1 pour abeilles et bourdons (plus grave), moins pour les petites mouches.
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

// Les vrais cris (public/sfx, enregistrements de Joseph Sardin, BigSoundBank, domaine public) : nombre de variantes.
const SAMPLES = { merle: 3, rougegorge: 3, fauvette: 1, rossignol: 1, hirondelle: 3, hulotte: 3, effraie: 2, corneille: 2, grenouille: 3, crapaud: 1, grillon: 2, sauterelle: 2, poule: 4, coq: 2, chien: 3, chat: 3, canard: 3, bourdon: 1 };
// Fichiers ramenés à -16 LUFS ; quelques cris très brefs restent plus bas, on les remonte un peu.
const SAMPLE_GAIN = { canard: 1.6, poule: 1.35 };
const SAMPLE_LEVEL = 0.12; // un cri proche, à côté des notes fabriquées et de la musique
const MAX_VOICES = 6;
const SONGBIRDS = ['rougegorge', 'fauvette', 'rossignol', 'merle'];

// Quel enregistrement pour quelle espèce, et à quelle hauteur (les cousins proches empruntent la voix d'un autre,
// plus haute ou plus grave selon leur taille).
const SAMPLE_OF = {
	merle: ['merle'], 'rouge-gorge': ['rougegorge'], fauvette: ['fauvette'], rossignol: ['rossignol'],
	hirondelle: ['hirondelle'], martinet: ['hirondelle', 1.25],
	hulotte: ['hulotte'], effraie: ['effraie'], cheveche: ['hulotte', 1.35], 'moyen-duc': ['hulotte', 0.85], 'hibou-marais': ['hulotte', 0.9], 'grand-duc': ['hulotte', 0.7],
	corneille: ['corneille'], pie: ['corneille', 1.3], geai: ['corneille', 1.2], cassenoix: ['corneille', 1.1], chocard: ['corneille', 1.45],
	colvert: ['canard'],
	grenouille: ['grenouille'], 'grenouille-agile': ['grenouille', 1.15], rainette: ['grenouille', 1.35],
	crapaud: ['crapaud', 0.8], calamite: ['crapaud', 0.9], alyte: ['crapaud'], sonneur: ['crapaud', 0.75],
	courtiliere: ['grillon', 0.6],
};
// Petits passereaux sans enregistrement à eux : un vrai chant de cousin, à une hauteur propre à chaque espèce.
const SONG_POOL = new Set(['alouette', 'bergeronnette', 'tarier', 'bruant-jaune', 'linotte', 'chardonneret', 'verdier', 'pinson', 'grive', 'troglodyte', 'phragmite', 'etourneau', 'pie-grieche']);

/** L'enregistrement d'une bête, s'il y en a un : { name, rate }. */
function sampleFor(b) {
	const m = SAMPLE_OF[b.sp];
	if (m) return { name: m[0], rate: m[1] ?? 1 };
	if (b.kind === 'hen') return { name: b.p?.rooster ? 'coq' : 'poule', rate: 1 };
	if (b.kind === 'dog') return { name: 'chien', rate: 1 };
	if (b.kind === 'cat') return { name: 'chat', rate: 1 };
	const h = hashOf(b.sp ?? b.kind);
	if (SONG_POOL.has(b.sp)) return { name: SONGBIRDS[h % SONGBIRDS.length], rate: 0.95 + ((h >> 4) % 100) / 100 * 0.4 };
	if (b.kind === 'grasshopper') return { name: b.p?.cricket ? 'grillon' : 'sauterelle', rate: 0.85 + ((h >> 4) % 100) / 100 * 0.45 };
	return null;
}

/** Un petit nombre stable tiré d'un nom (pour que chaque espèce garde sa voix). */
const hashOf = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const callCache = {};

/**
 * La voix d'une bête qui n'a pas de cri à elle (CALLS), d'après sa famille : chaque espèce d'oiseau a son petit
 * chant (hauteur, notes, rythme), les rapaces crient, grenouilles et crapauds coassent, criquets et grillons
 * stridulent, la basse-cour glousse. Les chauves-souris restent muettes : leurs cris sont trop aigus pour nous.
 */
function kindCall(b) {
	const id = b.sp ?? b.kind;
	if (b.kind === 'hen') return b.p?.rooster ? (b.mode === 'crow' ? { voice: 'crow', every: 25, chance: 0.9 } : null) : { voice: 'cluck', every: 9, chance: 0.35 };
	if (callCache[id] !== undefined) return callCache[id];
	const h = hashOf(id), pick = (a, b) => a + ((h % 1000) / 1000) * (b - a);
	const c = {
		bird: { voice: 'warble', every: 10 + (h % 7), chance: 0.45, f: pick(2200, 4800), n: 3 + (h % 5), gap: pick(0.1, 0.24), dur: pick(0.07, 0.16), up: h % 2 === 0 },
		tit: { voice: 'tit', every: 9, chance: 0.45 },
		swallow: { voice: 'peep', every: 6, chance: 0.5, n: 5, gap: 0.09, f0: 4200, f1: 3600, dur: 0.06 },
		owl: { voice: 'owl', every: 20, chance: 0.4 },
		eagle: b.p?.falcon ? { voice: 'peep', every: 14, chance: 0.4, n: 4, gap: 0.14, f0: 3400, f1: 3000, dur: 0.1 } : { voice: 'cry', every: 20, chance: 0.4, n: 1, gap: 0, f0: pick(1800, 2600), f1: pick(1200, 1700), dur: 0.6 },
		gull: { voice: 'cry', every: 12, chance: 0.4, n: 3, gap: 0.45, f0: 1500, f1: 1050, dur: 0.38 },
		heron: { voice: 'croak', every: 28, chance: 0.3 },
		duck: { voice: 'duck', every: 14, chance: 0.4 },
		frog: { voice: 'frog', every: 8, chance: 0.45 },
		grasshopper: b.p?.cricket ? { voice: 'chirr', every: 5, chance: 0.5 } : { voice: 'chirr', every: 7, chance: 0.4 },
		dog: { voice: 'bark', every: 30, chance: 0.25 },
		cat: { voice: 'meow', every: 40, chance: 0.2 },
		boar: { voice: 'grunt', every: 15, chance: 0.4 },
	}[b.kind] ?? null;
	return (callCache[id] = c);
}

// Gamme pentatonique de ré (ré mi fa# la si) sur trois octaves : aucune note ne peut sonner faux avec une autre.
const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0, 987.77];
// Accords tenus : fondamentales graves et dispositions ouvertes (quinte, neuvième, sixte), toujours consonantes.
const PAD_ROOTS = [146.83, 110.0, 123.47, 164.81];
const PAD_VOICINGS = [[0, 7, 14], [0, 7, 16], [0, 4, 9], [0, 7, 12, 16]];
