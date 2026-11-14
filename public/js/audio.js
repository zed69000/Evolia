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
//
// Une seule chaîne de sortie, par où passe tout (nature, cris, cloche, musique, échos) :
//   bus nature + bus musique → mix commun → passe-haut 100 Hz (le haut-parleur du téléphone distord sur les graves)
//   → compresseur doux (cohésion) → limiteur (−3 dB, ratio 20, 2 ms) → gain de sortie 0,9 → haut-parleur.
// Le compresseur de Chrome remonte tout seul le niveau (gain de compensation) : sans le limiteur derrière, les
// attaques passaient au-dessus de 0 dB et le son saturait (Galaxy A54).
// Chaque son ponctuel est placé : à gauche ou à droite selon où est sa source à l'écran (au plus ±0,7), plus sourd
// et plus réverbéré quand on regarde de loin ; la cloche et l'interface là où l'événement a lieu ou là où le doigt
// a touché (±0,3).

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
		this.active = []; // les voix en cours : { end } (temps de l'audio), pour la limite de voix
		this.lastAt = {}; // dernier départ de chaque son : jamais deux fois le même à moins de 50 ms
		// Là où le doigt a touché en dernier : les sons d'interface partent de là.
		if (typeof document !== 'undefined') document.addEventListener('pointerdown', e => { this.tapX = e.clientX / (window.innerWidth || 1); this.tapAt = performance.now(); }, { passive: true, capture: true });
	}

	/** Nombre de voix qui sonnent encore (cris, bruitages ; la musique a sa propre mesure). */
	get voices() {
		const now = this.ctx?.currentTime ?? 0;
		this.active = this.active.filter(v => v.end > now);
		return this.active.length;
	}

	/**
	 * Faux s'il y a déjà `cap` voix (6 pour l'ambiance, 8 pour les sons d'événement, prioritaires) ou si le même son
	 * vient de partir (< 50 ms : deux copies en phase, c'est +6 dB d'un coup). Sinon, note le départ.
	 */
	free(key, cap = MAX_VOICES) {
		const now = this.ctx.currentTime;
		if (this.voices >= cap || now - (this.lastAt[key] ?? -1) < 0.05) return false;
		this.lastAt[key] = now;
		return true;
	}

	/** Position horizontale à l'écran (0 = bord gauche, 1 = bord droit) d'un point du monde. */
	screenX(wx) {
		const v = this.garden.view?.();
		return v && v.w ? Math.max(0, Math.min(1, (wx - v.x0) / v.w)) : 0.5;
	}

	/** Panoramique d'un son d'interface : là où l'événement a lieu (`at`, de 0 à 1), sinon là où le doigt vient de toucher, en discret (±0,3). */
	uiPan(at) {
		const x = at ?? (performance.now() - (this.tapAt ?? -1e9) < 2500 ? this.tapX : 0.5);
		return Math.max(-0.3, Math.min(0.3, ((x ?? 0.5) * 2 - 1) * 0.3));
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
		// Le curseur du joueur ne dépasse jamais 1 : rien ne multiplie le niveau au-delà.
		this.nature.gain.setTargetAtTime(this.settings.on ? unit(this.settings.vol) : 0, t, 0.3);
		// Pendant une sortie suivie en direct, la musique se tait (sauf si on la veut aussi), la nature reste.
		const music = this.musicSettings.on && (!this.walking || this.musicSettings.walk || this.mood === 'joy');
		this.musicBus.gain.setTargetAtTime(music ? unit(this.musicSettings.vol) * MUSIC_LEVEL : 0, t, 0.8);
		if (!this.anyOn) this.ctx.suspend();
	}

	setWalking(on) {
		this.walking = on;
		this.applyLevels();
	}

	/** Un moment d'écoute (assis sur le banc) : les bêtes visibles chantent bien plus souvent pendant `sec` secondes. */
	listen(sec) {
		this.unlock();
		this.listenUntil = (this.ctx?.currentTime ?? 0) + sec;
	}

	pause() { this.ctx?.suspend(); }
	resume() { if (this.anyOn && this.ctx) this.ctx.resume(); }

	build() {
		// « playback » : plus de marge pour le processeur, donc pas de son qui hache quand le jardin est chargé.
		const AC = window.AudioContext || window.webkitAudioContext;
		let ctx;
		try { ctx = new AC({ latencyHint: 'playback' }); } catch { ctx = new AC(); }
		this.ctx = ctx;
		// La chaîne de sortie, unique (voir en tête du fichier).
		this.mix = ctx.createGain();
		this.mix.gain.value = MIX_LEVEL;
		const hp = ctx.createBiquadFilter();
		hp.type = 'highpass'; hp.frequency.value = 100; hp.Q.value = 0.7;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -20; comp.knee.value = 30; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
		const lim = ctx.createDynamicsCompressor();
		lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
		const out = ctx.createGain();
		out.gain.value = 0.9;
		this.mix.connect(hp).connect(comp).connect(lim).connect(out).connect(ctx.destination);
		this.limiter = lim; // pour mesurer la sortie dans une version de test
		// Le bus de la nature (fonds, cris, bruitages, cloche), réglé par le curseur « sons ».
		this.nature = ctx.createGain();
		this.nature.gain.value = this.settings.on ? unit(this.settings.vol) : 0;
		this.nature.connect(this.mix);
		// La musique a son propre volume et son propre écho, plus long et plus doux, et passe par le même mix.
		this.musicBus = ctx.createGain();
		this.musicBus.gain.value = this.musicSettings.on ? unit(this.musicSettings.vol) * MUSIC_LEVEL : 0;
		this.musicBus.connect(this.mix);
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
		this.verb.connect(wet).connect(this.nature);

		const len = ctx.sampleRate * 3;
		this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = this.noise.getChannelData(0);
		let b = 0;
		for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 3; }

		// Chaque fond est fait de deux sources, l'une à gauche, l'autre à droite (pas une boucle au centre).
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
		// `opt.cap` : 8 voix pour les sons d'événement (prioritaires), 6 pour l'ambiance ; `opt.dist` : 0 (près) à 1 (loin).
		if (!list?.length || !this.free(name, opt.cap)) return false;
		let i = Math.floor(Math.random() * list.length);
		if (list.length > 1 && i === this.lastVar[name]) i = (i + 1) % list.length;
		this.lastVar[name] = i;
		const ctx = this.ctx, src = ctx.createBufferSource(), t = ctx.currentTime + 0.03;
		src.buffer = list[i];
		src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
		const out = this.voice(pan, level, opt.dist ?? 0), vol = Tuning.num('son.niveau_cris', SAMPLE_LEVEL) * (SAMPLE_GAIN[name] ?? 1) * (opt.vol ?? 1) * level * 10 ** ((Math.random() - 0.5) * 0.25);
		const dur = list[i].duration / src.playbackRate.value;
		if (opt.swell) {
			// Un insecte qui passe : le son monte, puis s'éloigne d'un côté à l'autre.
			out.g.gain.setValueAtTime(0, t);
			out.g.gain.linearRampToValueAtTime(vol, t + dur * 0.45);
			out.g.gain.linearRampToValueAtTime(0, t + dur);
			this.glide(out.p, pan - 0.3, pan + 0.3, t, dur);
		} else out.g.gain.value = vol;
		src.connect(out.g);
		out.busy.end = t + dur;
		src.onended = () => out.p.disconnect();
		src.start(t);
		return true;
	}

	/**
	 * Un bruit filtré qui tourne en boucle ; `swell` : houle lente du volume (vagues, clapotis), en Hz.
	 * Deux sources décalées, une à gauche et une à droite, chacune avec sa houle : le fond s'ouvre au lieu de
	 * sortir d'un seul point au milieu.
	 */
	bed(f1, gain, f2 = null, swell = 0) {
		const ctx = this.ctx;
		const g = ctx.createGain();
		g.gain.value = gain;
		g.connect(this.nature);
		for (const side of [-0.55, 0.55]) {
			const src = ctx.createBufferSource();
			src.buffer = this.noise;
			src.loop = true;
			src.playbackRate.value = 0.8 + Math.random() * 0.4;
			const filt = ctx.createBiquadFilter();
			filt.type = f1.type; filt.frequency.value = f1.freq; filt.Q.value = f1.q;
			let node = src.connect(filt);
			if (f2) { const g2 = ctx.createBiquadFilter(); g2.type = f2.type; g2.frequency.value = f2.freq; node = node.connect(g2); }
			// Deux sources non corrélées s'additionnent en puissance (+3 dB) : chacune à 0,7 garde le niveau d'avant.
			const half = ctx.createGain();
			half.gain.value = swell ? 0.6 * 0.7 : 0.7;
			node.connect(half);
			if (swell) {
				const lfo = ctx.createOscillator(), depth = ctx.createGain();
				lfo.frequency.value = swell * (0.85 + Math.random() * 0.3); depth.gain.value = 0.4 * 0.7;
				lfo.connect(depth).connect(half.gain);
				lfo.start();
			}
			half.connect(this.panner(side)).connect(g);
			src.start(0, Math.random() * 2.5);
		}
		return { gain: g };
	}

	/**
	 * Un panoramique (−0,7 à +0,7) : StereoPanner, ou, sur les vieux Safari qui ne l'ont pas, un PannerNode
	 * « equalpower » posé sur un demi-cercle devant l'auditeur, sans atténuation avec la distance.
	 */
	panner(pan = 0) {
		const ctx = this.ctx;
		if (ctx.createStereoPanner) {
			const p = ctx.createStereoPanner();
			p.pan.value = clampPan(pan);
			return p;
		}
		const p = ctx.createPanner();
		p.panningModel = 'equalpower';
		p.distanceModel = 'linear';
		p.rolloffFactor = 0;
		const a = clampPan(pan) * Math.PI / 2;
		p.setPosition(Math.sin(a), 0, -Math.cos(a));
		return p;
	}

	/** Déplace un son en douceur de `from` vers `to`, à partir de `t`, en à peu près `dur` secondes (jamais d'un coup). */
	glide(p, from, to, t, dur) {
		const tc = Math.max(0.03, dur / 3);
		if (p.pan) {
			p.pan.setValueAtTime(clampPan(from), t);
			p.pan.setTargetAtTime(clampPan(to), t, tc);
		} else if (p.positionX) {
			const a0 = clampPan(from) * Math.PI / 2, a1 = clampPan(to) * Math.PI / 2;
			p.positionX.setValueAtTime(Math.sin(a0), t); p.positionX.setTargetAtTime(Math.sin(a1), t, tc);
			p.positionZ.setValueAtTime(-Math.cos(a0), t); p.positionZ.setTargetAtTime(-Math.cos(a1), t, tc);
		}
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
		// Le passe-haut de la sortie retire le grave sous 100 Hz (le téléphone le distordait) : le corps de la pluie
		// et le ressac sont un peu remontés pour garder leur présence.
		this.set(this.rain, rain * 0.12);
		this.set(this.rainBody, rain * RAIN_BODY);
		this.set(this.sea, biome === 'littoral' ? SEA_LEVEL : 0);

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
				this.flyby(((b.x - v.x0) / v.w * 2 - 1) * 0.7, BUZZ[b.kind]);
			}
		}
		// Un animal visible, au hasard, chante s'il en a envie.
		const b = seen[Math.floor(Math.random() * seen.length)];
		if (!b) return;
		const call = CALLS[b.sp] ?? kindCall(b), key = b.sp ?? `${b.kind}${b.p?.rooster ? '-coq' : ''}`;
		if (!call || (this.next[key] ?? 0) > now) return;
		// De près, on entend les bêtes plus souvent (et plus fort, voir plus bas).
		const listening = now < (this.listenUntil ?? 0);
		if (Math.random() > call.chance * (0.45 + 0.55 * near) * (listening ? 2 : 1)) return;
		this.next[key] = now + call.every * (0.7 + Math.random() * 0.6) * (listening ? 0.5 : 1);
		// Placée là où elle est à l'écran (bord gauche −0,7, bord droit +0,7) ; vue de loin (dézoomé), plus faible,
		// plus sourde et plus réverbérée.
		const pan = (Math.max(0, Math.min(1, (b.x - v.x0) / v.w)) * 2 - 1) * 0.7, dist = 1 - near;
		const s = sampleFor(b);
		// Un vrai cri dès qu'il est chargé (s'il y a déjà trop de voix, la bête se tait cette fois).
		if (s && this.buf[s.name]) { this.sample(s.name, pan, 0.4 + 0.6 * near, s.rate, { dist }); return; }
		if (!this.free(key)) return;
		this[call.voice](pan, call, 0.4 + 0.6 * near, dist);
	}

	/**
	 * Une voix courte : oscillateur, enveloppe douce, panoramique, un peu d'écho. `dist` (0 près, 1 loin) : le
	 * passe-bas descend de 12 kHz à 2 kHz et l'envoi vers l'écho augmente (le volume, lui, est déjà dans `level`).
	 * Chaque voix compte pour la limite de voix jusqu'à la fin de sa dernière note.
	 */
	voice(pan, level, dist = 0) {
		const ctx = this.ctx, d = Math.max(0, Math.min(1, dist));
		const g = ctx.createGain();
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass'; lp.frequency.value = 12000 * Math.pow(2000 / 12000, d);
		const p = this.panner(pan);
		const send = ctx.createGain();
		send.gain.value = 0.7 + 0.6 * d;
		g.connect(lp).connect(p);
		p.connect(this.nature);
		p.connect(send).connect(this.verb);
		const busy = { end: ctx.currentTime + 0.3 };
		this.active.push(busy);
		return { g, p, level, busy };
	}

	note(out, t, f0, f1, dur, vol, type = 'sine') {
		out.busy.end = Math.max(out.busy.end, t + dur + 0.05);
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
	blackbird(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		let f = 1700 + Math.random() * 500, at = t;
		for (let i = 0, n = 4 + Math.floor(Math.random() * 4); i < n; i++) {
			const nf = Math.max(1300, Math.min(2900, f * (0.8 + Math.random() * 0.5)));
			this.note(out, at, f, nf, 0.12 + Math.random() * 0.14, 0.05);
			f = nf;
			at += 0.16 + Math.random() * 0.12;
		}
	}

	/** Mésange : « ti-tu ti-tu ti-tu ». */
	tit(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
			this.note(out, t + i * 0.26, 5200, 5000, 0.08, 0.035);
			this.note(out, t + i * 0.26 + 0.11, 3700, 3500, 0.1, 0.035);
		}
	}

	/** Petits cris aigus et brefs (martin-pêcheur, gravelot). */
	peep(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < c.n; i++) this.note(out, t + i * c.gap, c.f0, c.f1, c.dur, 0.03);
	}

	/** Cri rauque (geai, casse-noix) : un bruit court et nasal. */
	harsh(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < c.n; i++) {
			this.note(out, t + i * 0.32, c.f, c.f * 0.8, 0.22, 0.012, 'sawtooth');
			this.note(out, t + i * 0.32, c.f * 2.01, c.f * 1.6, 0.2, 0.006, 'sawtooth');
		}
	}

	/** Pic : un tambourinage rapide qui ralentit, sur le tronc. */
	drum(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 16; i++) this.note(out, t + i * (0.045 + i * 0.002), 900, 300, 0.035, 0.05, 'triangle');
	}

	/** Chouette hulotte : « hou… hou-hou-hou ». */
	owl(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 420, 400, 0.55, 0.05);
		for (let i = 0; i < 3; i++) this.note(out, t + 1.3 + i * 0.28, 410, 380, 0.22, 0.04);
	}

	/** Canard : deux ou trois « coin » nasillards. */
	duck(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this.note(out, t + i * 0.24, 360, 280, 0.16, 0.012, 'sawtooth');
	}

	/** Goéland, aigle : un long cri qui glisse vers le bas. */
	cry(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < c.n; i++) {
			this.note(out, t + i * c.gap, c.f0, c.f1, c.dur, 0.03, 'triangle');
			this.note(out, t + i * c.gap, c.f0 * 2, c.f1 * 2, c.dur, 0.008);
		}
	}

	/** Grenouille : un coassement grave en trémolo. */
	frog(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
			for (let i = 0; i < 7; i++) this.note(out, t + k * 0.5 + i * 0.035, 330, 260, 0.03, 0.03, 'triangle');
		}
	}

	/** Marmotte : un sifflet d'alerte, aigu et net. */
	whistle(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 2600, 2900, 0.3, 0.035);
	}

	/** Sauterelle : une stridulation sèche, en petits paquets. */
	chirr(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let k = 0; k < 3; k++) for (let i = 0; i < 10; i++) this.note(out, t + k * 0.45 + i * 0.022, 7000, 6500, 0.012, 0.012, 'square');
	}

	/** Héron : un croassement grave, rare. */
	croak(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 220, 160, 0.4, 0.014, 'sawtooth');
	}

	/** Un chant d'oiseau générique, propre à chaque espèce : hauteur, nombre de notes et rythme tirés de son nom. */
	warble(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		let f = c.f, at = t;
		for (let i = 0; i < c.n; i++) {
			const nf = f * (c.up ? 1.08 : 0.94) * (0.92 + Math.random() * 0.16);
			this.note(out, at, f, nf, c.dur, 0.03);
			f = i % 3 === 2 ? c.f : nf;
			at += c.gap;
		}
	}

	/** Poule : quelques « cot » secs. */
	cluck(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.note(out, t + i * 0.2, 520, 380, 0.09, 0.02, 'sawtooth');
	}

	/** Coq : « co-co-ri-coooo ». */
	crow(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		[[620, 600, 0.12], [680, 660, 0.12], [760, 740, 0.14], [880, 640, 0.7]].reduce((at, [a, b, d]) => { this.note(out, at, a, b, d, 0.03, 'sawtooth'); return at + d + 0.04; }, t);
	}

	/** Chien : un ou deux aboiements. */
	bark(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) { this.note(out, t + i * 0.3, 420, 250, 0.13, 0.04, 'sawtooth'); this.note(out, t + i * 0.3, 840, 500, 0.1, 0.01); }
	}

	/** Chat : un miaulement qui monte puis retombe. */
	meow(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		this.note(out, t, 600, 900, 0.25, 0.025, 'triangle');
		this.note(out, t + 0.25, 900, 550, 0.35, 0.025, 'triangle');
	}

	/** Sanglier : un grognement grave. */
	grunt(pan, c, lvl, d = 0) {
		const out = this.voice(pan, lvl, d), t = this.ctx.currentTime + 0.05;
		for (let i = 0; i < 2; i++) this.note(out, t + i * 0.28, 120, 90, 0.2, 0.03, 'sawtooth');
	}

	/** Un oiseau lointain, à peine audible, noyé dans l'écho. */
	distant() {
		// De préférence un vrai chanteur, très bas et noyé dans l'écho.
		const sing = SONGBIRDS[Math.floor(Math.random() * SONGBIRDS.length)];
		// Loin : n'importe où entre les deux bords, sourd et réverbéré.
		if (this.sample(sing, Math.random() * 1.4 - 0.7, 0.35, 0.9 + Math.random() * 0.3, { vol: 0.35, dist: 0.85 })) return;
		if (!this.free('distant')) return;
		const out = this.voice(Math.random() * 1.4 - 0.7, 0.35, 0.85), t = this.ctx.currentTime + 0.05;
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
			if (this.sample('grillon', Math.random() * 1.4 - 0.7, 0.5, 0.9 + Math.random() * 0.2, { vol: 0.3, dist: 0.6 })) return;
		}
		if (!this.free('cricket')) return;
		const out = this.voice(Math.random() * 1.4 - 0.7, 0.5, 0.6), t = this.ctx.currentTime + 0.05;
		const f = 4200 + Math.random() * 800;
		for (let i = 0; i < 3; i++) this.note(out, t + i * 0.045, f, f, 0.03, 0.018);
	}

	/** Un insecte qui passe : un bourdonnement doux qui monte, change de hauteur en passant, et s'éloigne. */
	flyby(pan, kind, cap = MAX_VOICES) {
		// Le vrai bourdon ; plus aigu pour les petites mouches.
		if (this.sample('bourdon', pan, 1, kind === 1 ? 1 : 1.7, { swell: true, vol: kind === 1 ? 0.6 : 0.35, cap })) return;
		if (!this.free('flyby', cap)) return;
		const ctx = this.ctx, t = ctx.currentTime + 0.05, dur = 1.1 + Math.random() * 0.8;
		const base = kind === 1 ? 165 + Math.random() * 40 : 260 + Math.random() * 60;
		const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), out = this.voice(pan, 1, 0.1);
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
		// Il passe d'un côté à l'autre, en douceur.
		this.glide(out.p, pan - 0.3, pan + 0.3, t, dur);
		out.busy.end = t + dur + 0.05;
		o.connect(f).connect(g).connect(out.g);
		o.start(t); lfo.start(t);
		o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
	}

	/**
	 * Le tonnerre, loin, d'un côté du ciel ou de l'autre. Le grave sous 100 Hz est coupé à la sortie (le haut-parleur
	 * du téléphone le distordait) : le grondement monte donc jusqu'à 300 Hz pour rester présent.
	 */
	thunder() {
		if (!this.ctx || this.ctx.state !== 'running' || !this.free('thunder', UI_VOICES)) return;
		const ctx = this.ctx, t = ctx.currentTime;
		const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		const out = this.voice((Math.random() * 2 - 1) * 0.6, 1, 0.8);
		src.buffer = this.noise;
		f.type = 'lowpass'; f.frequency.value = 300;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(THUNDER_LEVEL, t + 0.15);
		g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
		out.busy.end = t + 4.6;
		src.connect(f).connect(g).connect(out.g);
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
		if (this.mood === 'joy') return this.joy(now);
		if (this.mood === 'hush') return; // le temps d'une ouverture, rien d'autre ne joue
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

	/**
	 * Le thème de l'introduction, plein d'élan : une suite d'accords lumineuse (ré, la, si mineur, sol), un arpège
	 * pincé en croches à 96 battements par minute, une basse à chaque mesure et, de temps en temps, une note de mélodie
	 * qui monte dans la gamme. Les notes sont posées un peu à l'avance, à l'heure exacte du son.
	 */
	setMood(mood) {
		if (this.mood === mood) return;
		this.mood = mood;
		this.nextBeat = 0;
	}

	joy(now) {
		const EIGHTH = 60 / 96 / 2, ROOT = 146.83, CHORDS = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
		if (!this.nextBeat || this.nextBeat < now) { this.nextBeat = now + 0.15; this.beatN = 0; }
		while (this.nextBeat < now + 0.7) {
			const n = this.beatN++, t = this.nextBeat, step = n % 8, chord = CHORDS[Math.floor(n / 8) % 4];
			const notes = [...chord, chord[0] + 12], semi = notes[[0, 1, 2, 3, 2, 1, 2, 3][step]];
			this.pluck(ROOT * 2 * Math.pow(2, semi / 12), t, step % 2 ? 0.55 : 0.85, 0.045);
			if (step === 0) {
				this.pluck(ROOT / 2 * Math.pow(2, chord[0] / 12), t, 1, 0.09, 1.8, 'sine');
				this.chordPad(chord, ROOT * 2, t, EIGHTH * 8);
			}
			// Une note de mélodie sur les temps forts, dans l'accord, une octave au-dessus.
			if ((step === 0 || step === 3 || step === 6) && Math.random() < 0.5) {
				this.pluck(ROOT * 4 * Math.pow(2, notes[Math.floor(Math.random() * notes.length)] / 12), t, 0.7, 0.03, 1.2, 'sine');
			}
			this.nextBeat += EIGHTH;
		}
	}

	/**
	 * L'ouverture d'Evolia, quand le logo apparaît : un arpège qui monte et s'épanouit en un grand accord lumineux,
	 * avec quelques notes qui scintillent au-dessus. Seulement si la musique est active.
	 */
	fanfare() {
		const ctx = this.ctx;
		if (!ctx || ctx.state !== 'running' || !this.musicSettings.on) return;
		const t0 = ctx.currentTime + 0.05, D4 = 293.66, f = s => D4 * Math.pow(2, s / 12);
		// L'arpège qui monte (ré, fa dièse, la, ré, fa dièse, la).
		[0, 4, 7, 12, 16, 19].forEach((s, i) => {
			this.pluck(f(s), t0 + i * 0.11, 0.9, 0.06, 1.4, 'triangle');
			this.pluck(f(s), t0 + i * 0.11, 0.6, 0.03, 1.8, 'sine');
		});
		// Le grand accord qui s'ouvre, de la basse aux aigus.
		const t1 = t0 + 0.7, lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.setValueAtTime(500, t1);
		lp.frequency.linearRampToValueAtTime(2600, t1 + 1.6);
		lp.connect(this.musicBus);
		lp.connect(this.musicVerb);
		for (const s of [-12, -5, 0, 4, 7, 12, 16]) {
			for (const cents of [-5, 5]) {
				const o = ctx.createOscillator(), e = ctx.createGain();
				o.type = s < 0 ? 'sine' : 'triangle';
				o.frequency.value = f(s) * Math.pow(2, cents / 1200);
				e.gain.setValueAtTime(0, t1);
				e.gain.linearRampToValueAtTime(s < 0 ? 0.03 : 0.016, t1 + 1.2);
				e.gain.setValueAtTime(s < 0 ? 0.03 : 0.016, t1 + 2.6);
				e.gain.linearRampToValueAtTime(0, t1 + 5.5);
				o.connect(e).connect(lp);
				o.start(t1);
				o.stop(t1 + 5.6);
			}
		}
		// Les étincelles : quelques notes aiguës, au hasard, pendant que l'accord s'ouvre.
		for (let k = 0; k < 7; k++) this.pluck(f([24, 28, 31, 36][Math.floor(Math.random() * 4)]), t1 + 0.3 + Math.random() * 2.2, 0.5 + Math.random() * 0.4, 0.022, 1.6, 'sine');
	}

	/** Une note pincée, posée à l'instant `t` (temps de l'audio). */
	pluck(f, t, vel, amp, dur = 0.5, type = 'triangle') {
		const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(), lp = ctx.createBiquadFilter();
		o.type = type;
		o.frequency.value = f;
		lp.type = 'lowpass'; lp.frequency.value = 2600;
		e.gain.setValueAtTime(0, t);
		e.gain.linearRampToValueAtTime(amp * vel, t + 0.006);
		e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(e).connect(lp);
		lp.connect(this.musicBus);
		lp.connect(this.musicVerb);
		o.start(t);
		o.stop(t + dur + 0.05);
	}

	/** L'accord de la mesure, tenu doucement derrière l'arpège. */
	chordPad(chord, base, t, dur) {
		const ctx = this.ctx, lp = ctx.createBiquadFilter();
		lp.type = 'lowpass'; lp.frequency.value = 1100;
		lp.connect(this.musicBus);
		lp.connect(this.musicVerb);
		for (const semi of chord) {
			const o = ctx.createOscillator(), e = ctx.createGain();
			o.type = 'sine';
			o.frequency.value = base * Math.pow(2, semi / 12);
			e.gain.setValueAtTime(0, t);
			e.gain.linearRampToValueAtTime(0.014, t + 0.3);
			e.gain.setValueAtTime(0.014, t + dur - 0.4);
			e.gain.linearRampToValueAtTime(0, t + dur);
			o.connect(e).connect(lp);
			o.start(t);
			o.stop(t + dur + 0.05);
		}
	}

	/** Une note de musique : douce, longue, un peu d'écho. */
	bell(f, vel) {
		const ctx = this.ctx, t = ctx.currentTime + 0.05, dur = 3.5 + Math.random() * 2;
		const pan = this.panner((Math.random() - 0.5) * 0.8), lp = ctx.createBiquadFilter();
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

	// Les sons d'événement acceptent tous une position facultative `at` : la place horizontale à l'écran de ce qui
	// les déclenche (0 = bord gauche, 1 = bord droit ; `screenX(x)` pour un point du jardin). Sans elle, ils partent
	// de là où le doigt vient de toucher, sinon du milieu. Toujours discrets sur les côtés (±0,3).

	/** Une goutte qui tombe dans la bourse : une note claire, de plus en plus aiguë à mesure que la cagnotte monte (k : 0 → 1). */
	drip(k = 0, at) {
		if (!this.live || !this.free('drip', UI_VOICES)) return;
		const out = this.voice(jitter(this.uiPan(at), 0.08), 1), t = this.ctx.currentTime + 0.01;
		const f = NOTES[Math.min(NOTES.length - 1, Math.floor(k * NOTES.length))] * 2;
		this.note(out, t, f, f * 1.01, 0.35, 0.018);
		this.note(out, t, f * 2.76, f * 2.76, 0.12, 0.004);
	}

	/** Un coup de marteau sur du bois : un « toc » sec et court, un peu différent à chaque fois. */
	knock(k = 0, at) {
		if (!this.live || !this.free('knock', UI_VOICES)) return;
		const out = this.voice(jitter(this.uiPan(at), 0.08), 1), t = this.ctx.currentTime + 0.01, f = 420 + k * 40 + Math.random() * 30;
		this.note(out, t, f, f * 0.6, 0.09, 0.05, 'triangle');
		this.note(out, t, f * 3.1, f * 2.2, 0.035, 0.008, 'square');
	}

	// ─── Les bruitages de l'introduction ───
	get live() { return this.ctx && this.ctx.state === 'running'; }

	/** L'oiseau qui passe : un vrai chant s'il est chargé, sinon un petit sifflement. */
	birdCall(pan = 0) {
		if (!this.live) return;
		if (this.sample('rougegorge', pan, 1, 1, { vol: 0.7, cap: UI_VOICES }) || this.sample('merle', pan, 1, 1, { vol: 0.6, cap: UI_VOICES })) return;
		if (this.free('birdCall', UI_VOICES)) this.peep(pan, {}, 1);
	}

	/** La graine qui tombe : un sifflement très doux qui descend. */
	seedFall(at) {
		if (!this.live || !this.free('seedFall', UI_VOICES)) return;
		const out = this.voice(this.uiPan(at ?? 0.5), 1), t = this.ctx.currentTime + 0.02;
		this.note(out, t, 1500, 620, 0.85, 0.012);
		this.note(out, t, 3000, 1240, 0.5, 0.003);
	}

	/** La graine touche la terre : un petit « pof » sourd (bruit filtré, très court). */
	seedLand(at) {
		if (!this.live || !this.free('seedLand', UI_VOICES)) return;
		const ctx = this.ctx, t = ctx.currentTime + 0.01, n = Math.floor(ctx.sampleRate * 0.12);
		const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
		for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
		const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		const out = this.voice(this.uiPan(at ?? 0.5), 1);
		src.buffer = buf; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0.5;
		src.connect(f).connect(g).connect(out.g);
		src.start(t);
		this.note(out, t, 190, 120, 0.14, 0.03, 'sine');
	}

	/** La plante grandit : une petite note qui monte avec elle (k : 0 → 1), comme une pousse qui se déplie. */
	sprout(k = 0, at) {
		if (!this.live || !this.free('sprout', UI_VOICES)) return;
		const out = this.voice(jitter(this.uiPan(at ?? 0.5), 0.1), 1), t = this.ctx.currentTime + 0.01;
		const f = NOTES[Math.min(NOTES.length - 1, 2 + Math.floor(k * (NOTES.length - 3)))];
		this.note(out, t, f * 0.98, f * 1.02, 0.6, 0.016, 'sine');
		this.note(out, t + 0.06, f * 2, f * 2.03, 0.35, 0.005, 'sine');
	}

	/** Une abeille tout près : le vrai bourdonnement, qui passe d'un côté à l'autre. */
	beeBuzz(pan = 0) {
		if (!this.live) return;
		if (!this.sample('bourdon', pan, 1, 1.15, { swell: true, vol: 0.75, cap: UI_VOICES })) this.flyby(pan, 1, UI_VOICES);
	}

	/** Cloche douce pour un bon moment : `size` 1 (une plante a poussé) à 3 (nouveau lieu), là où ça se passe (`at`). */
	chime(size = 1, at) {
		if (!this.live || !this.free('chime', UI_VOICES)) return;
		const out = this.voice(this.uiPan(at), 1), t = this.ctx.currentTime + 0.02;
		const start = Math.floor(Math.random() * 3);
		for (let i = 0; i < size; i++) {
			const f = NOTES[Math.min(NOTES.length - 1, start + i * 2)];
			this.note(out, t + i * 0.22, f, f, 2.4, 0.03);
			this.note(out, t + i * 0.22, f * 2.76, f * 2.76, 0.9, 0.006); // partiel de cloche
		}
	}
}

/** Un panoramique ne va jamais au-delà de ±0,7 : un son ne disparaît pas d'un côté (téléphone à un seul haut-parleur). */
const clampPan = p => Math.max(-0.7, Math.min(0.7, p || 0));
/** Un peu de hasard autour d'une position, sans sortir de ±0,3 (sons d'interface). */
const jitter = (p, w) => Math.max(-0.3, Math.min(0.3, p + (Math.random() - 0.5) * w));
/** Un réglage de volume reste entre 0 et 1. */
const unit = v => Math.max(0, Math.min(1, Number(v) || 0));

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
const MAX_VOICES = 6; // voix d'ambiance (cris, insectes, oiseaux lointains) en même temps, au plus
const UI_VOICES = 8; // les sons d'événement (cloche, gouttes, introduction, tonnerre) passent jusqu'à 8
// Niveaux de la chaîne de sortie. Avant : nature × curseur × 1,3 et musique × curseur × 0,7, sans limiteur.
// Le mix commun compense la baisse (plus de × 1,3, passe-haut) ; la musique garde le même rapport à la nature.
// Mesuré hors ligne (Chrome) : cris et cloche environ 2,3 dB plus bas qu'avant, musique 2 dB, fonds 0,7 dB ; une
// rafale de 8 attaques au volume maximal, qui montait avant à +4 dB (écrêtée), plafonne maintenant à −0,6 dB.
// Les sons sont fabriqués très bas à la source : le mix reste donc plus haut que les 0,6 habituels, sans dépasser 1.
const MIX_LEVEL = 0.9;
const MUSIC_LEVEL = 0.5;
// Fonds : corps de la pluie et ressac un peu remontés (le passe-haut leur retire le grave sous 100 Hz).
const RAIN_BODY = 0.1;
const SEA_LEVEL = 0.2;
const THUNDER_LEVEL = 0.5;
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
