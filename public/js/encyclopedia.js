// Encyclopédie de la biodiversité, lieu par lieu : les espèces découvertes, leur rôle et comment les aider.

import { SPECIES, PLACES, PLACE_BY_ID, placeOpen } from './species.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant } from './plants.js';
import { drawCritter } from './critters.js';

const KINDS = { plante: 'Plante', animal: 'Animal', milieu: 'Milieu' };
const CRITTER_SCALE = { hoverfly: 1.8, beefly: 1.6, ants: 2.6, firebug: 2, snail: 1.6, grasshopper: 1.1, spider: 0.95, duck: 1, hedgehog: 0.75, frog: 1.2, tit: 1.3, bird: 1.25, worm: 1.4, ladybug: 2.2, firefly: 1.8, beetle: 1.5, squirrel: 0.9, marmot: 0.95, lizard: 0.95, heron: 0.62, owl: 1.2, eagle: 0.42, gull: 0.6, crab: 1.4 };
const CRITTER_SHIFT = { heron: 4, marmot: -2, owl: 1 };
const cache = new Map();

// Les petites bêtes (insectes, araignées, escargots, vers…) ; le reste des animaux a une colonne vertébrale.
const BUGS = new Set(['bee', 'butterfly', 'moth', 'dragonfly', 'hoverfly', 'beefly', 'ant', 'ants', 'firebug', 'ladybug', 'beetle', 'grasshopper', 'spider', 'snail', 'worm', 'firefly', 'crab']);
/** Sous-catégorie d'une espèce dans la page : plantes (et milieux), insectes et petites bêtes, ou animaux. */
const groupOf = s => (s.kind !== 'animal' ? 'plantes' : BUGS.has(s.critter.kind) ? 'insectes' : 'animaux');
const GROUPS = [['plantes', 'Plantes'], ['insectes', 'Insectes et petites bêtes'], ['animaux', 'Animaux']];
const GROUP_SHORT = { tout: 'Tout', plantes: 'Plantes', insectes: 'Insectes', animaux: 'Animaux' };

/** Vignette peinte d'une espèce ; en silhouette tant qu'elle n'est pas découverte. */
export function thumb(sp, size, locked) {
	const key = `${sp.id}:${size}:${locked}`;
	if (cache.has(key)) return cache.get(key);
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const c = document.createElement('canvas');
	c.width = c.height = Math.round(size * dpr);
	c.style.width = c.style.height = `${size}px`;
	const g = c.getContext('2d');
	g.scale(dpr, dpr);
	const fit = box => {
		const k = Math.min((size * 0.9) / box.w, (size * 0.9) / box.h);
		g.translate(size / 2 + (box.ax - box.w / 2) * k, (size - box.h * k) / 2 + box.ay * k);
		g.scale(k, k);
	};
	if (sp.kind === 'plante') {
		fit(PLANT_TYPES[sp.type].box);
		paintPlant(g, { type: sp.type, seed: 4242, variant: { species: sp.id } }, 1);
	} else if (sp.kind === 'milieu') {
		fit(DECOR[sp.decor].box);
		DECOR_PAINTERS[sp.decor](g);
	} else {
		// Peint d'abord sur une grande toile, puis mesuré : un animal plus grand que la vignette (chamois, bouquetin,
		// aigle…) est réduit et recentré, au lieu d'être coupé.
		const ck = sp.critter.kind;
		const k = (size / 26) * (CRITTER_SCALE[ck] ?? 1) * dpr, S = c.width * 3;
		const off = document.createElement('canvas');
		off.width = off.height = S;
		const o = off.getContext('2d');
		o.translate(S / 2, S / 2 + (CRITTER_SHIFT[ck] ?? 0) * k);
		o.scale(k, k);
		drawCritter(o, ck, 0.4, 'perch', sp.critter);
		const px = o.getImageData(0, 0, S, S).data;
		let x0 = S, y0 = S, x1 = -1, y1 = -1;
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
			if (px[(y * S + x) * 4 + 3] < 10) continue;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
		}
		g.setTransform(1, 0, 0, 1, 0, 0);
		if (x1 >= x0) {
			const bw = x1 - x0 + 1, bh = y1 - y0 + 1, f = Math.min(1, (c.width * 0.9) / bw, (c.height * 0.9) / bh);
			// Sans débordement, l'animal garde sa place habituelle ; sinon il est recentré sur ce qui se voit.
			const fits = f === 1 && x0 >= c.width && x1 < c.width * 2 && y0 >= c.height && y1 < c.height * 2;
			if (fits) g.drawImage(off, c.width, c.height, c.width, c.height, 0, 0, c.width, c.height);
			else g.drawImage(off, x0, y0, bw, bh, (c.width - bw * f) / 2, (c.height - bh * f) / 2, bw * f, bh * f);
		}
	}
	if (locked) {
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.globalCompositeOperation = 'source-in';
		g.fillStyle = '#D4CBAE';
		g.fillRect(0, 0, c.width, c.height);
	}
	cache.set(key, c);
	return c;
}

/** Copie d'une vignette (une même toile ne peut pas être affichée à deux endroits). */
export function thumbCopy(sp, size, locked) {
	const src = thumb(sp, size, locked);
	const copy = src.cloneNode(false);
	copy.getContext('2d').drawImage(src, 0, 0);
	return copy;
}

// Lire la fiche d'une espèce qu'on vient de découvrir rapporte un peu de nectar : on apprend à la connaître.
export const READ_REWARD = 10;

// Les vraies photos des espèces, passées au filtre aquarelle (public/species/<id>.webp), et leurs crédits.
// Le dessin du jeu est symbolique ; la photo apprend à reconnaître l'espèce en vrai.
let PHOTO_CREDITS = null;
const loadCredits = () => (PHOTO_CREDITS ??= fetch('species/credits.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})));

const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export class Encyclopedia {
	constructor(panel, state, onChange) {
		this.panel = panel;
		this.state = state;
		this.onChange = onChange;
		this.filter = 'prairie';
		this.group = 'tout';
		panel.addEventListener('click', e => {
			const card = e.target.closest('[data-sp]');
			if (card) return this.showDetail(card.dataset.sp);
			const f = e.target.closest('[data-filter]');
			if (f) { this.filter = f.dataset.filter; return this.showGrid(); }
			const gr = e.target.closest('[data-group]');
			if (gr) { this.group = gr.dataset.group; return this.showGrid(); }
			if (e.target.closest('[data-back]')) return this.showGrid();
			if (e.target.closest('[data-close-species]')) this.close();
		});
	}

	open(id) {
		if (id) this.showDetail(id); else { this.filter = 'prairie'; this.showGrid(); }
		this.panel.classList.add('open');
		this.panel.setAttribute('aria-hidden', 'false');
	}

	close() {
		this.panel.classList.remove('open');
		this.panel.setAttribute('aria-hidden', 'true');
	}

	/**
	 * Au début du jeu, une page simple : seulement les espèces déjà venues au jardin, rangées en plantes et insectes
	 * (et animaux, s'il y en a), chacune avec son icône. Les milieux et le reste viennent plus tard.
	 */
	showSimple() {
		const st = this.state;
		const known = SPECIES.filter(s => st.species[s.id]);
		const ICON = { plantes: '🌿', insectes: '🐝', animaux: '🐦' };
		const sections = GROUPS.map(([g, title]) => {
			const items = known.filter(s => groupOf(s) === g);
			if (!items.length) return '';
			return `<h3 class="sp-section"><span class="sp-ico">${ICON[g]}</span> ${g === 'insectes' ? 'Insectes' : title} <small>${items.length}</small></h3><div class="sp-grid">${items.map(s => this.cardHtml(s)).join('')}</div>`;
		}).join('');
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Espèces</h2><button class="close" data-close-species aria-label="Fermer">×</button></div>
			<p class="sp-intro">Les espèces venues dans ton jardin. Touche-en une pour lire sa fiche.</p>
			${sections}`;
		this.paintThumbs(known);
		this.panel.scrollTop = 0;
	}

	cardHtml(s) {
		const st = this.state, known = !!st.species[s.id], fresh = known && !st.speciesSeen?.[s.id];
		return `<button class="sp-card${known ? '' : ' locked'}" data-sp="${s.id}">
				${fresh ? `<span class="sp-new">Nouveau</span>` : ''}
				<span class="sp-thumb" data-thumb="${s.id}"></span>
				<span class="sp-name">${known ? esc(s.name) : '???'}</span>
			</button>`;
	}

	showGrid() {
		if (this.simple?.()) return this.showSimple();
		const st = this.state;
		const place = PLACE_BY_ID[this.filter];
		const all = SPECIES.length, foundAll = SPECIES.filter(s => st.species[s.id]).length;
		const list = SPECIES.filter(s => s.place === this.filter);
		const found = list.filter(s => st.species[s.id]).length;
		const open = placeOpen(st, place);
		const card = s => {
			const known = !!st.species[s.id];
			const fresh = known && !st.speciesSeen?.[s.id];
			return `<button class="sp-card${known ? '' : ' locked'}" data-sp="${s.id}">
					${fresh ? `<span class="sp-new">Nouveau · +${this.rewardPreview?.() ?? READ_REWARD}</span>` : ''}
					<span class="sp-thumb" data-thumb="${s.id}"></span>
					<span class="sp-name">${known ? esc(s.name) : '???'}</span>
				</button>`;
		};
		// En vue « Tout », une section par sous-catégorie ; sinon, seulement la sous-catégorie choisie.
		const sections = GROUPS.filter(([g]) => this.group === 'tout' || this.group === g).map(([g, title]) => {
			const items = list.filter(s => groupOf(s) === g);
			if (!items.length) return '';
			const got = items.filter(s => st.species[s.id]).length;
			return `${this.group === 'tout' ? `<h3 class="sp-section">${title} <small>${got} / ${items.length}</small></h3>` : ''}<div class="sp-grid">${items.map(card).join('')}</div>`;
		}).join('');
		const count = g => (g === 'tout' ? list.length : list.filter(s => groupOf(s) === g).length);
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Espèces</h2><button class="close" data-close-species aria-label="Fermer">×</button></div>
			<div class="sp-progress"><div class="bar"><i style="width:${(foundAll / all) * 100}%"></i></div><span><b>${foundAll}</b> / ${all} espèces</span></div>
			<div class="seg sp-filters scroll">${PLACES.map(p => `<button data-filter="${p.id}" class="${p.id === this.filter ? 'on' : ''}">${p.short}</button>`).join('')}</div>
			<div class="sp-groups">${['tout', ...GROUPS.map(([g]) => g)].filter(g => count(g)).map(g => `<button data-group="${g}" class="${g === this.group ? 'on' : ''}">${GROUP_SHORT[g]} <small>${count(g)}</small></button>`).join('')}</div>
			<p class="sp-intro"><b>${place.name}</b> · ${found} / ${list.length} espèces. ${esc(place.intro)}${open ? '' : ` <i>Lieu à découvrir : ${place.km} km et ${place.found} espèces.</i>`}</p>
			${sections}`;
		this.paintThumbs(list);
		this.panel.scrollTop = 0;
	}

	/**
	 * Les vignettes se peignent au fil du défilement : seulement celles qui approchent de l'écran, quelques-unes
	 * par image, pour que la page s'ouvre tout de suite au lieu de tout peindre d'un coup.
	 */
	paintThumbs(list) {
		this.thumbObs?.disconnect();
		const st = this.state, queue = [];
		let busy = false;
		const pump = () => {
			const t0 = performance.now();
			while (queue.length && performance.now() - t0 < 8) {
				const el = queue.shift();
				if (!el.isConnected || el.firstChild) continue;
				const s = list.find(x => x.id === el.dataset.thumb);
				if (s) el.appendChild(thumbCopy(s, 76, !st.species[s.id]));
			}
			busy = queue.length > 0;
			if (busy) requestAnimationFrame(pump);
		};
		const obs = (this.thumbObs = new IntersectionObserver(entries => {
			for (const e of entries) if (e.isIntersecting) { queue.push(e.target); obs.unobserve(e.target); }
			if (!busy && queue.length) { busy = true; requestAnimationFrame(pump); }
		}, { root: this.panel, rootMargin: '300px 0px' }));
		for (const el of this.panel.querySelectorAll('[data-thumb]')) obs.observe(el);
	}

	showDetail(id) {
		this.thumbObs?.disconnect();
		const s = SPECIES.find(x => x.id === id);
		this.filter = s.place;
		const known = !!this.state.species[id];
		let reward = 0;
		if (known) {
			this.state.speciesSeen ??= {};
			if (!this.state.speciesSeen[id]) { this.state.speciesSeen[id] = true; reward = this.rewardFor?.(id) ?? READ_REWARD; this.onChange?.({ reward }); }
		}
		const date = known ? new Date(this.state.species[id]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
		this.panel.innerHTML = `
			<div class="panel-head"><button class="close" data-back aria-label="Retour">‹</button></div>
			<div class="sp-detail">
				<div class="sp-hero" id="sp-hero"></div>
				${known ? '<p class="sp-credit" id="sp-credit" hidden></p>' : ''}
				<span class="chip">${KINDS[s.kind]}</span> <span class="chip">${PLACE_BY_ID[s.place].name}</span>
				<h2>${known ? esc(s.name) : 'Espèce inconnue'}</h2>
				${reward ? `<p class="sp-reward">+${reward} nectar pour avoir lu sa fiche</p>` : ''}
				${known ? `<p class="latin">${esc(s.latin)}</p>
					<h3>Son rôle</h3><p>${esc(s.role)}</p>
					<div class="sp-help"><h3>Comment l'aider</h3><p>${esc(s.help)}</p></div>
					<h3>Le savais-tu ?</h3><p>${esc(s.fact)}</p>
					<p class="sp-date">Découverte le ${date}</p>
					<button class="btn primary sp-close-bottom" data-close-species>Fermer</button>`
				: `<p class="latin">Pas encore découverte</p><div class="sp-help"><h3>Pour la faire venir</h3><p>${esc(s.hint)}</p></div>
					<button class="btn primary sp-close-bottom" data-close-species>Fermer</button>`}
			</div>`;
		const hero = this.panel.querySelector('#sp-hero');
		hero.appendChild(thumbCopy(s, 170, !known));
		// La vraie photo dans le rond (masque rond) ; le dessin du jeu devient un petit médaillon sur son bord.
		const credit = this.panel.querySelector('#sp-credit');
		if (credit) loadCredits().then(credits => {
			const cr = credits[id];
			if (!cr || !hero.isConnected) return;
			const img = new Image();
			img.className = 'sp-photo';
			img.alt = s.name;
			img.onload = () => {
				hero.classList.add('photo');
				hero.prepend(img);
				credit.textContent = `Photo : ${cr.author}${cr.license === 'cc0' ? ' (domaine public)' : ' (CC BY)'} · iNaturalist`;
				credit.hidden = false;
			};
			img.src = `species/${id}.webp`;
		});
		this.panel.scrollTop = 0;
	}
}
