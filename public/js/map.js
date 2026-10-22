// Carte des lieux : on ouvre de nouveaux milieux en bougeant et en découvrant des espèces.

import { PLACES, SPECIES, placeOpen } from './species.js';
import { thumbCopy } from './encyclopedia.js';

const fmt = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export class PlacesMap {
	constructor(panel, state, onTravel) {
		this.panel = panel;
		this.state = state;
		panel.addEventListener('click', e => {
			const t = e.target.closest('[data-travel]');
			if (t) { this.close(); onTravel(t.dataset.travel); }
			if (e.target.closest('[data-close-map]')) this.close();
		});
	}

	open() {
		this.render();
		this.panel.classList.add('open');
		this.panel.setAttribute('aria-hidden', 'false');
	}

	close() {
		this.panel.classList.remove('open');
		this.panel.setAttribute('aria-hidden', 'true');
	}

	render() {
		const st = this.state;
		const km = st.totals.distance / 1000;
		const found = Object.keys(st.species).length;
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Les lieux</h2><button class="close" data-close-map aria-label="Fermer">×</button></div>
			<p class="sp-intro">Chaque lieu a sa propre nature. Bouge et découvre des espèces pour ouvrir le suivant.</p>
			<div class="pl-list">${PLACES.map(p => {
				const open = placeOpen(st, p);
				const here = st.place === p.id;
				const list = SPECIES.filter(s => s.place === p.id);
				const n = list.filter(s => st.species[s.id]).length;
				const action = here ? '<span class="chip gold">Tu es ici</span>'
					: open ? `<button class="btn primary small" data-travel="${p.id}">Y aller</button>`
					: `<div class="pl-need">
						<div><span>${fmt(Math.min(km, p.km))} / ${p.km} km</span><div class="bar"><i style="width:${Math.min(100, (km / p.km) * 100)}%"></i></div></div>
						<div><span>${Math.min(found, p.found)} / ${p.found} espèces</span><div class="bar"><i style="width:${Math.min(100, (found / p.found) * 100)}%"></i></div></div>
					</div>`;
				return `<div class="pl-card${open ? '' : ' locked'}${here ? ' here' : ''}" style="--pc:${p.color}">
					<div class="pl-art" data-art="${p.id}"></div>
					<div class="pl-body"><h3>${p.name}</h3><p>${open ? `${n} / ${list.length} espèces découvertes` : 'À découvrir'}</p>${action}</div>
				</div>`;
			}).join('<div class="pl-path"></div>')}</div>`;
		for (const el of this.panel.querySelectorAll('[data-art]')) {
			const p = PLACES.find(x => x.id === el.dataset.art);
			const open = placeOpen(st, p);
			const picks = ['herbe', 'fleur', 'arbre'].map(t => SPECIES.find(s => s.place === p.id && s.type === t));
			for (const s of picks) el.appendChild(thumbCopy(s, 52, !open));
		}
		this.panel.scrollTop = 0;
	}
}
