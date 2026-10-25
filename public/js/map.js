// Carte du monde : tous les lieux réunis sur un même paysage peint à l'aquarelle. La montagne en haut,
// une rivière qui descend par la forêt et le marais jusqu'à la mer ; les lieux encore fermés restent dans la brume.
// On touche un lieu pour le voir en détail et y aller.

import { PLACES, PLACE_BY_ID, SPECIES, placeOpen } from './species.js';
import { rng, wash, ribbon, curve, rgba } from './watercolor.js';

const fmt = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// La carte se peint sur 1000 × 1500, puis s'adapte à la largeur de l'écran.
const W = 1000, H = 1500;
const NODE = {
	montagne: { x: 520, y: 270, rx: 420, ry: 200 },
	foret: { x: 700, y: 640, rx: 250, ry: 170 },
	marais: { x: 270, y: 900, rx: 220, ry: 150 },
	prairie: { x: 590, y: 1120, rx: 280, ry: 150 },
	littoral: { x: 330, y: 1380, rx: 330, ry: 110 },
};
const ROADS = [['prairie', 'marais'], ['marais', 'foret'], ['foret', 'montagne'], ['prairie', 'littoral']];
const RIVER = [[530, 420], [610, 520], [560, 640], [470, 760], [360, 860], [330, 980], [400, 1120], [430, 1260], [440, 1420]];

function paintMap(g, open) {
	const d = rng(77);
	// Papier et grands lavis de fond.
	g.fillStyle = '#F3EBD3';
	g.fillRect(0, 0, W, H);
	for (let i = 0; i < 40; i++) wash(g, d.range(0, W), d.range(0, H), d.range(80, 200), d.range(60, 140), d.pick(['#E9E0C4', '#EFE6CC', '#E4DCC0']), d, { layers: 3, alpha: 0.12, edge: 0 });
	wash(g, 500, 760, 520, 560, '#C9D49A', d, { layers: 8, alpha: 0.12, edge: 0 });

	// La mer et les dunes, tout en bas.
	g.fillStyle = rgba('#86B6C2', 0.85);
	g.beginPath();
	g.moveTo(0, H);
	for (let x = 0; x <= W; x += 25) g.lineTo(x, 1415 + Math.sin(x / 70) * 14 + Math.sin(x / 23) * 5);
	g.lineTo(W, H);
	g.closePath();
	g.fill();
	for (let i = 0; i < 14; i++) wash(g, d.range(0, W), d.range(1440, H), d.range(60, 140), d.range(10, 20), '#A8D0D8', d, { layers: 4, alpha: 0.25, edge: 0 });
	g.strokeStyle = rgba('#FFFFFF', 0.7); g.lineWidth = 2;
	for (let i = 0; i < 10; i++) { const x = d.range(20, W - 80), y = d.range(1450, H - 10); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 15, y - 6, x + 30, y); g.stroke(); }
	for (let i = 0; i < 16; i++) wash(g, d.range(40, W - 40), d.range(1335, 1405), d.range(40, 90), d.range(14, 24), '#E8D49A', d, { layers: 5, alpha: 0.35, edge: 0.2 });
	for (let i = 0; i < 60; i++) { const x = d.range(60, W - 60), y = d.range(1330, 1400); ribbon(g, curve(x, y, -Math.PI / 2 + d.gauss() * 0.4, d.range(8, 16), d.gauss() * 0.3, 3), 1.2, 0.4, '#9AA85A', d, 0.7); }

	// La prairie : un grand vert tendre semé de fleurs.
	const pr = NODE.prairie;
	wash(g, pr.x, pr.y, pr.rx, pr.ry, '#B5CA66', d, { layers: 10, alpha: 0.2, edge: 0.3 });
	for (let i = 0; i < 160; i++) {
		const a = d() * 6.28, r = Math.sqrt(d());
		const x = pr.x + Math.cos(a) * pr.rx * r * 0.9, y = pr.y + Math.sin(a) * pr.ry * r * 0.9;
		wash(g, x, y, 3.5, 3, d.pick(['#E87A9A', '#F2D24A', '#FFFFFF', '#9A7AD0', '#E8503A']), d, { layers: 2, alpha: 0.6, edge: 0 });
	}

	// Le marais : des mares, des roseaux, un vert d'eau.
	const ma = NODE.marais;
	wash(g, ma.x, ma.y, ma.rx, ma.ry, '#8DB88A', d, { layers: 10, alpha: 0.2, edge: 0.3 });
	for (let i = 0; i < 9; i++) {
		const x = ma.x + d.range(-ma.rx * 0.7, ma.rx * 0.7), y = ma.y + d.range(-ma.ry * 0.6, ma.ry * 0.6);
		wash(g, x, y, d.range(22, 46), d.range(10, 20), '#6FAFB4', d, { layers: 7, alpha: 0.35, edge: 0.4 });
		for (let k = 0; k < 8; k++) ribbon(g, curve(x + d.range(-30, 30), y + d.range(-4, 14), -Math.PI / 2 + d.gauss() * 0.2, d.range(10, 22), d.gauss() * 0.2, 3), 1.4, 0.4, '#5E7E3A', d, 0.75);
	}

	// La forêt : une canopée de houppiers serrés.
	const fo = NODE.foret;
	wash(g, fo.x, fo.y, fo.rx, fo.ry, '#4E7A44', d, { layers: 8, alpha: 0.18, edge: 0.3 });
	const crowns = [];
	for (let i = 0; i < 110; i++) {
		const a = d() * 6.28, r = Math.sqrt(d());
		crowns.push([fo.x + Math.cos(a) * fo.rx * r * 0.95, fo.y + Math.sin(a) * fo.ry * r * 0.95, d.range(16, 28)]);
	}
	crowns.sort((a, b) => a[1] - b[1]);
	for (const [x, y, s] of crowns) {
		wash(g, x + 4, y + 6, s, s * 0.7, '#1E3A1E', d, { layers: 3, alpha: 0.12, edge: 0 });
		wash(g, x, y, s, s * 0.85, d.pick(['#3E7A3C', '#2F6232', '#4E8A3E', '#356E36']), d, { layers: 6, alpha: 0.35, edge: 0.3 });
		wash(g, x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.3, '#8ABA6A', d, { layers: 3, alpha: 0.25, edge: 0 });
	}

	// La montagne : des sommets, leurs faces à l'ombre, la neige, des sapins au pied.
	const peaks = [[150, 350, 150, 170], [330, 330, 170, 230], [520, 330, 210, 280], [720, 335, 180, 240], [890, 350, 140, 180], [430, 395, 140, 130], [640, 400, 150, 140]];
	peaks.sort((a, b) => a[1] - b[1]);
	for (const [x, base, w, h] of peaks) {
		const top = base - h, by = base + 70;
		g.fillStyle = rgba('#A2B4CC', 0.95);
		g.beginPath(); g.moveTo(x - w, by); g.lineTo(x - w * 0.15, top + 10); g.lineTo(x, top); g.lineTo(x + w, by); g.closePath(); g.fill();
		g.fillStyle = rgba('#7288A8', 0.9);
		g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, by); g.lineTo(x + w * 0.1, by); g.lineTo(x + w * 0.05, top + h * 0.5); g.closePath(); g.fill();
		g.fillStyle = rgba('#FBFCFF', 0.95);
		g.beginPath(); g.moveTo(x - w * 0.15, top + 10); g.lineTo(x, top); g.lineTo(x + w * 0.32, top + h * 0.32);
		g.lineTo(x + w * 0.16, top + h * 0.27); g.lineTo(x + w * 0.04, top + h * 0.36); g.lineTo(x - w * 0.12, top + h * 0.26); g.lineTo(x - w * 0.3, top + h * 0.33); g.closePath(); g.fill();
		wash(g, x - w * 0.4, by - h * 0.3, w * 0.3, h * 0.2, '#C8D4E4', d, { layers: 3, alpha: 0.15, edge: 0 });
	}
	for (let i = 0; i < 90; i++) {
		const x = d.range(40, W - 40), y = d.range(400, 470) + Math.sin(x / 90) * 10, s = d.range(8, 14);
		g.fillStyle = rgba(d.pick(['#2F5A36', '#24482C', '#3A6A40']), 0.9);
		g.beginPath(); g.moveTo(x, y - s * 1.8); g.lineTo(x + s * 0.7, y); g.lineTo(x - s * 0.7, y); g.closePath(); g.fill();
	}

	// La rivière, du glacier à la mer.
	const pts = [];
	for (let i = 0; i < RIVER.length - 1; i++) {
		const [x0, y0] = RIVER[i], [x1, y1] = RIVER[i + 1];
		for (let k = 0; k < 6; k++) { const t = k / 6; pts.push([x0 + (x1 - x0) * t + Math.sin((y0 + (y1 - y0) * t) / 40) * 6, y0 + (y1 - y0) * t]); }
	}
	pts.push(RIVER.at(-1));
	ribbon(g, pts, 5, 16, '#7FB2C0', d, 0.9);
	ribbon(g, pts, 2, 6, '#CFE6EA', d, 0.5);

	// Les chemins entre les lieux : des tirets de terre battue.
	g.setLineDash([10, 9]);
	g.lineCap = 'round';
	for (const [a, b] of ROADS) {
		const A = NODE[a], B = NODE[b], mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.15, my = (A.y + B.y) / 2 + (B.x - A.x) * 0.15;
		g.strokeStyle = rgba(open[a] && open[b] ? '#8A6238' : '#B8A88A', 0.85);
		g.lineWidth = 4;
		g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
	}
	g.setLineDash([]);

	// La brume sur les lieux encore fermés.
	for (const p of PLACES) {
		if (open[p.id]) continue;
		const n = NODE[p.id];
		for (let i = 0; i < 4; i++) wash(g, n.x + d.gauss() * 30, n.y + d.gauss() * 20, n.rx * 1.05, n.ry * 1.1, '#F8F5EC', d, { layers: 8, alpha: 0.22, edge: 0 });
	}
	// Un léger cadre usé, comme une vieille carte.
	const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
	v.addColorStop(0, 'rgba(120,90,50,0)');
	v.addColorStop(1, 'rgba(120,90,50,0.22)');
	g.fillStyle = v;
	g.fillRect(0, 0, W, H);
}

export class PlacesMap {
	constructor(panel, state, onTravel) {
		this.panel = panel;
		this.state = state;
		this.sel = null;
		panel.addEventListener('click', e => {
			const t = e.target.closest('[data-travel]');
			if (t) { this.close(); onTravel(t.dataset.travel); return; }
			if (e.target.closest('[data-close-map]')) return this.close();
			const n = e.target.closest('[data-node]');
			if (n) { this.sel = n.dataset.node; this.renderCard(); this.renderNodes(); }
		});
	}

	open() {
		this.sel = this.state.place;
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
		const open = Object.fromEntries(PLACES.map(p => [p.id, placeOpen(st, p)]));
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Le monde</h2><button class="close" data-close-map aria-label="Fermer">×</button></div>
			<div class="wm" style="aspect-ratio:${W} / ${H}"><canvas></canvas><div class="wm-nodes"></div></div>
			<div class="wm-card card"></div>`;
		// La carte n'est repeinte que si un lieu s'est ouvert depuis la dernière fois.
		const key = PLACES.map(p => (open[p.id] ? 1 : 0)).join('');
		if (this.key !== key || !this.art) {
			this.key = key;
			const D = Math.min(2, window.devicePixelRatio || 1) * 0.5;
			this.art = document.createElement('canvas');
			this.art.width = W * D; this.art.height = H * D;
			const g = this.art.getContext('2d');
			g.scale(D, D);
			paintMap(g, open);
		}
		const c = this.panel.querySelector('.wm canvas');
		c.width = this.art.width; c.height = this.art.height;
		c.getContext('2d').drawImage(this.art, 0, 0);
		this.renderNodes();
		this.renderCard();
		this.panel.scrollTop = 0;
	}

	renderNodes() {
		const st = this.state;
		this.panel.querySelector('.wm-nodes').innerHTML = PLACES.map(p => {
			const n = NODE[p.id], open = placeOpen(st, p), here = st.place === p.id;
			return `<button class="wm-node${open ? '' : ' locked'}${here ? ' here' : ''}${this.sel === p.id ? ' sel' : ''}" data-node="${p.id}" style="left:${(n.x / W) * 100}%;top:${(n.y / H) * 100}%;--pc:${p.color}">
				${here ? '<i class="wm-pin" aria-hidden="true"></i>' : ''}<b>${p.short}</b>${open ? '' : `<small>${p.km} km</small>`}</button>`;
		}).join('');
	}

	renderCard() {
		const st = this.state, p = PLACE_BY_ID[this.sel];
		const open = placeOpen(st, p), here = st.place === p.id;
		const km = st.totals.distance / 1000, found = Object.keys(st.species).length;
		const list = SPECIES.filter(s => s.place === p.id), n = list.filter(s => st.species[s.id]).length;
		const action = here ? '<span class="chip gold">Tu es ici</span>'
			: open ? `<button class="btn primary small" data-travel="${p.id}">Y aller</button>`
			: `<div class="pl-need">
				<div><span>${fmt(Math.min(km, p.km))} / ${p.km} km parcourus</span><div class="bar"><i style="width:${Math.min(100, (km / p.km) * 100)}%"></i></div></div>
				<div><span>${Math.min(found, p.found)} / ${p.found} espèces découvertes</span><div class="bar"><i style="width:${Math.min(100, (found / p.found) * 100)}%"></i></div></div>
			</div>`;
		this.panel.querySelector('.wm-card').innerHTML = `<div class="wm-card-head" style="--pc:${p.color}"><i></i><h3>${p.name}</h3>${open ? `<small>${n} / ${list.length} espèces</small>` : '<small>dans la brume</small>'}</div>
			<p>${p.intro}</p>${action}`;
	}
}
