// Le monde autour du jardin, propre à chaque partie : tiré au hasard à la création (une graine), il dit quel milieu
// attend sur chaque parcelle voisine. Un joueur commence près d'une mare, un autre au pied d'une montagne, un autre
// non loin de la côte : on agrandit son jardin là où l'on veut, et le milieu suit le terrain.
//
// Coordonnées : celles de la grille des parcelles (gx, gy) ; la parcelle de départ (0, 0) est toujours une prairie.

import { rng } from './watercolor.js';

/**
 * Tire un monde. `legacy` : une partie d'avant ce monde, dont les parcelles sont déjà posées en ligne en partant de
 * (0, 0) : pas de côte au nord (elle passerait sur leur jardin), le littoral reste un coin un peu plus loin.
 */
export function makeWorld(seed, legacy = false) {
	const r = rng(seed);
	// Pour une nouvelle partie, la côte court tout le long du nord, à trois ou quatre parcelles du départ.
	const seaRow = legacy ? null : -(3 + Math.floor(r() * 2));
	const spots = [];
	const add = (biome, dmin, dmax, rad) => {
		for (let t = 0; t < 40; t++) {
			const a = r() * Math.PI * 2, d = r.range(dmin, dmax);
			const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d * 0.7);
			if ((x === 0 && y === 0) || (seaRow != null && y <= seaRow) || spots.some(s => s.x === x && s.y === y)) continue;
			spots.push({ biome, x, y, rad });
			return;
		}
	};
	// Toujours une mare tout près, une forêt et une montagne un peu plus loin ; le reste au hasard.
	add('marais', 1, 2.2, 1.2);
	add('foret', 2, 3.5, 1.6);
	add('montagne', 3, 5, 1.6);
	add(r() < 0.5 ? 'marais' : 'foret', 3, 5.5, 1.2);
	add('foret', 4, 6.5, 1.5);
	if (legacy) add('littoral', 4, 6, 1.6);
	return { seed, seaRow, legacy, spots };
}

/** Le milieu d'une parcelle du monde : prairie par défaut, 'sea' au-delà de la côte (on n'y construit pas). */
export function worldBiome(world, gx, gy) {
	if (gx === 0 && gy === 0) return 'prairie';
	if (world?.seaRow != null) {
		if (gy < world.seaRow) return 'sea';
		if (gy === world.seaRow) return 'littoral';
	}
	let best = null, bd = Infinity;
	for (const s of world?.spots ?? []) {
		const d = Math.hypot(s.x - gx, (s.y - gy) * 1.3);
		if (d <= s.rad && d < bd) { bd = d; best = s.biome; }
	}
	return best ?? 'prairie';
}
