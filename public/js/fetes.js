// Les fêtes du monde au jardin : à chaque fête, le jardin se décore tout seul (guirlandes, sapin, bonnet…), sans rien
// à acheter et sans toucher à l'économie. Une fête a sa période, calculée pour l'année ; les fêtes lunaires auront une
// table de dates par année.
//
// En test : ?fete=noel force une fête, ?fete=aucune les coupe.

/** Les fêtes, avec leur période : [mois, jour] de début et de fin (la fin peut tomber l'année suivante). */
export const FETES = {
	noel: {
		name: 'Noël',
		from: [12, 1], to: [1, 6],
		hello: 'Noël s’installe au jardin : des guirlandes sur la cabane et les haies, un sapin décoré, et un bonnet pour l’épouvantail.',
	},
};

const md = d => (d.getMonth() + 1) * 100 + d.getDate();

/** La fête du jour (son identifiant), ou null. */
export function feteAt(date = new Date()) {
	const v = md(date);
	for (const [id, f] of Object.entries(FETES)) {
		const a = f.from[0] * 100 + f.from[1], b = f.to[0] * 100 + f.to[1];
		if (a <= b ? v >= a && v <= b : v >= a || v <= b) return id;
	}
	return null;
}

/** L'année d'une fête en cours (celle où elle a commencé), pour ne l'annoncer qu'une fois par an. */
export function feteYear(id, date = new Date()) {
	const f = FETES[id];
	return f && md(date) < f.from[0] * 100 + f.from[1] ? date.getFullYear() - 1 : date.getFullYear();
}
