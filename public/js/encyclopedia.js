// Encyclopédie de la biodiversité, lieu par lieu : les espèces découvertes, leur rôle et comment les aider.

import { SPECIES, PLACES, PLACE_BY_ID, placeOpen } from './species.js';
import { PLANT_TYPES, DECOR, DECOR_PAINTERS, paintPlant } from './plants.js';
import { drawCritter } from './critters.js';

const KINDS = { plante: 'Plante', animal: 'Animal', milieu: 'Milieu' };
const CRITTER_SCALE = { hoverfly: 1.8, beefly: 1.6, ants: 2.6, firebug: 2, snail: 1.6, grasshopper: 1.1, spider: 0.95, duck: 1, hedgehog: 0.75, frog: 1.2, tit: 1.3, bird: 1.25, worm: 1.4, ladybug: 2.2, firefly: 1.8, beetle: 1.5, squirrel: 0.9, marmot: 0.95, lizard: 0.95, heron: 0.62, owl: 1.2, eagle: 0.42, gull: 0.6, crab: 1.4 };
const CRITTER_SHIFT = { heron: 4, marmot: -2, owl: 1 };
const cache = new Map();

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
		const ck = sp.critter.kind;
		const k = (size / 26) * (CRITTER_SCALE[ck] ?? 1);
		g.translate(size / 2, size / 2 + (CRITTER_SHIFT[ck] ?? 0) * k);
		g.scale(k, k);
		drawCritter(g, ck, 0.4, 'perch', sp.critter);
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

const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export class Encyclopedia {
	constructor(panel, state, onChange) {
		this.panel = panel;
		this.state = state;
		this.onChange = onChange;
		this.filter = state.place;
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
		if (id) this.showDetail(id); else { this.filter = this.state.place; this.showGrid(); }
		this.panel.classList.add('open');
		this.panel.setAttribute('aria-hidden', 'false');
	}

	close() {
		this.panel.classList.remove('open');
		this.panel.setAttribute('aria-hidden', 'true');
	}

	showGrid() {
		const st = this.state;
		const place = PLACE_BY_ID[this.filter];
		const all = SPECIES.length, foundAll = SPECIES.filter(s => st.species[s.id]).length;
		const list = SPECIES.filter(s => s.place === this.filter);
		const found = list.filter(s => st.species[s.id]).length;
		const open = placeOpen(st, place);
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Espèces</h2><button class="close" data-close-species aria-label="Fermer">×</button></div>
			<div class="sp-progress"><div class="bar"><i style="width:${(foundAll / all) * 100}%"></i></div><span><b>${foundAll}</b> / ${all} espèces</span></div>
			<div class="seg sp-filters scroll">${PLACES.map(p => `<button data-filter="${p.id}" class="${p.id === this.filter ? 'on' : ''}">${p.short}</button>`).join('')}</div>
			<p class="sp-intro"><b>${place.name}</b> · ${found} / ${list.length} espèces. ${esc(place.intro)}${open ? '' : ` <i>Lieu à découvrir : ${place.km} km et ${place.found} espèces.</i>`}</p>
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
			const s = list.find(x => x.id === el.dataset.thumb);
			el.appendChild(thumbCopy(s, 76, !st.species[s.id]));
		}
		this.panel.scrollTop = 0;
	}

	showDetail(id) {
		const s = SPECIES.find(x => x.id === id);
		this.filter = s.place;
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
				<span class="chip">${KINDS[s.kind]}</span> <span class="chip">${PLACE_BY_ID[s.place].name}</span>
				<h2>${known ? esc(s.name) : 'Espèce inconnue'}</h2>
				${known ? `<p class="latin">${esc(s.latin)}</p>
					<h3>Son rôle</h3><p>${esc(s.role)}</p>
					<div class="sp-help"><h3>Comment l'aider</h3><p>${esc(s.help)}</p></div>
					<h3>Le savais-tu ?</h3><p>${esc(s.fact)}</p>
					<p class="sp-date">Découverte le ${date}</p>`
				: `<p class="latin">Pas encore découverte</p><div class="sp-help"><h3>Pour la faire venir</h3><p>${esc(s.hint)}</p></div>`}
			</div>`;
		this.panel.querySelector('#sp-hero').appendChild(thumbCopy(s, 170, !known));
		this.panel.scrollTop = 0;
	}
}
