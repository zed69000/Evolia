// Encyclopédie de la biodiversité : les espèces découvertes, leur rôle et comment les aider.

import { SPECIES, FLOWERS, BUSHES, TREES } from './species.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant } from './plants.js';
import { drawCritter } from './critters.js';

const KINDS = { plante: 'Plante', animal: 'Animal', milieu: 'Milieu' };
const FILTERS = [['tout', 'Tout'], ['plante', 'Plantes'], ['animal', 'Animaux'], ['milieu', 'Milieux']];
const CRITTER_SCALE = { hedgehog: 0.75, frog: 1.2, tit: 1.3, worm: 1.4, ladybug: 2.2, firefly: 1.8 };
const cache = new Map();

function variantFor(v) {
	const list = { fleur: FLOWERS, buisson: BUSHES, arbre: TREES }[v.plant];
	const s = list?.find(x => x.id === v.species);
	if (!s) return { species: 'graminees' };
	return { species: s.id, color: s.color, shape: s.shape, berry: s.berry, fruit: s.fruit };
}

/** Vignette peinte d'une espèce ; en silhouette tant qu'elle n'est pas découverte. */
function thumb(sp, size, locked) {
	const key = `${sp.id}:${size}:${locked}`;
	if (cache.has(key)) return cache.get(key);
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const c = document.createElement('canvas');
	c.width = c.height = Math.round(size * dpr);
	c.style.width = c.style.height = `${size}px`;
	const g = c.getContext('2d');
	g.scale(dpr, dpr);
	const v = sp.visual;
	const fit = box => {
		const k = Math.min((size * 0.9) / box.w, (size * 0.9) / box.h);
		g.translate(size / 2 + (box.ax - box.w / 2) * k, (size - box.h * k) / 2 + box.ay * k);
		g.scale(k, k);
	};
	if (v.plant) {
		fit(PLANT_TYPES[v.plant].box);
		paintPlant(g, { type: v.plant, seed: 4242, variant: variantFor(v) }, 1);
	} else if (v.decor) {
		fit(DECOR[v.decor].box);
		DECOR_PAINTERS[v.decor](g);
	} else {
		const k = (size / 26) * (CRITTER_SCALE[v.critter] ?? 1);
		g.translate(size / 2, size / 2);
		g.scale(k, k);
		drawCritter(g, v.critter, 0.4, 'perch');
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

const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export class Encyclopedia {
	constructor(panel, state, onChange) {
		this.panel = panel;
		this.state = state;
		this.onChange = onChange;
		this.filter = 'tout';
		panel.addEventListener('click', e => {
			const card = e.target.closest('[data-sp]');
			if (card) return this.showDetail(card.dataset.sp);
			const f = e.target.closest('[data-filter]');
			if (f) { this.filter = f.dataset.filter; return this.showGrid(); }
			if (e.target.closest('[data-back]')) return this.showGrid();
			if (e.target.closest('[data-close-species]')) this.close();
		});
	}

	open(id) {
		if (id) this.showDetail(id); else this.showGrid();
		this.panel.classList.add('open');
		this.panel.setAttribute('aria-hidden', 'false');
	}

	close() {
		this.panel.classList.remove('open');
		this.panel.setAttribute('aria-hidden', 'true');
	}

	showGrid() {
		const st = this.state;
		const found = SPECIES.filter(s => st.species[s.id]).length;
		const list = SPECIES.filter(s => this.filter === 'tout' || s.kind === this.filter);
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Biodiversité</h2><button class="close" data-close-species aria-label="Fermer">×</button></div>
			<p class="sp-intro">Chaque espèce a un rôle dans le jardin. Découvre-les en bougeant, puis apprends comment les aider dans la vraie vie.</p>
			<div class="sp-progress"><div class="bar"><i style="width:${(found / SPECIES.length) * 100}%"></i></div><span><b>${found}</b> / ${SPECIES.length} espèces</span></div>
			<div class="seg sp-filters">${FILTERS.map(([k, l]) => `<button data-filter="${k}" class="${k === this.filter ? 'on' : ''}">${l}</button>`).join('')}</div>
			<div class="sp-grid">${list.map(s => {
				const known = !!st.species[s.id];
				const fresh = known && !st.speciesSeen?.[s.id];
				return `<button class="sp-card${known ? '' : ' locked'}" data-sp="${s.id}">
					${fresh ? '<span class="sp-new">Nouveau</span>' : ''}
					<span class="sp-thumb" data-thumb="${s.id}"></span>
					<span class="sp-name">${known ? esc(s.name) : '???'}</span>
				</button>`;
			}).join('')}</div>`;
		for (const el of this.panel.querySelectorAll('[data-thumb]')) {
			const s = SPECIES.find(x => x.id === el.dataset.thumb);
			el.appendChild(thumb(s, 76, !st.species[s.id]).cloneNode(false));
			el.firstChild.getContext('2d').drawImage(thumb(s, 76, !st.species[s.id]), 0, 0);
		}
		this.panel.scrollTop = 0;
	}

	showDetail(id) {
		const s = SPECIES.find(x => x.id === id);
		const known = !!this.state.species[id];
		if (known) {
			this.state.speciesSeen ??= {};
			if (!this.state.speciesSeen[id]) { this.state.speciesSeen[id] = true; this.onChange?.(); }
		}
		const date = known ? new Date(this.state.species[id]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
		this.panel.innerHTML = `
			<div class="panel-head"><button class="close" data-back aria-label="Retour">‹</button><button class="close" data-close-species aria-label="Fermer">×</button></div>
			<div class="sp-detail">
				<div class="sp-hero" id="sp-hero"></div>
				<span class="chip">${KINDS[s.kind]}</span>
				<h2>${known ? esc(s.name) : 'Espèce inconnue'}</h2>
				${known ? `<p class="latin">${esc(s.latin)}</p>
					<h3>Son rôle</h3><p>${esc(s.role)}</p>
					<div class="sp-help"><h3>Comment l'aider</h3><p>${esc(s.help)}</p></div>
					<h3>Le savais-tu ?</h3><p>${esc(s.fact)}</p>
					<p class="sp-date">Découverte le ${date}</p>`
				: `<p class="latin">Pas encore découverte</p><div class="sp-help"><h3>Pour la faire venir</h3><p>${esc(s.hint)}</p></div>`}
			</div>`;
		const big = thumb(s, 170, !known);
		const copy = big.cloneNode(false);
		copy.getContext('2d').drawImage(big, 0, 0);
		this.panel.querySelector('#sp-hero').appendChild(copy);
		this.panel.scrollTop = 0;
	}
}
