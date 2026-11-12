// The one French number format for everything the player reads: decimal comma, narrow space for thousands.

/** Exactly `d` decimals (distances, nectar per hour). */
export const fmtFixed = (n, d = 2) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Rounded to a whole number. */
// Les grands nombres en mots, comme dans les jeux incrémentaux : « 3,2 millions », « 1,02 milliard ».
const BIG = [[1e18, 'trillion'], [1e15, 'billiard'], [1e12, 'billion'], [1e9, 'milliard'], [1e6, 'million']];
export function fmtInt(n) {
	const v = Math.round(Number(n));
	const big = BIG.find(([k]) => Math.abs(v) >= k);
	if (!big) return v.toLocaleString('fr-FR');
	const x = v / big[0], txt = x.toLocaleString('fr-FR', { maximumFractionDigits: x < 10 ? 2 : x < 100 ? 1 : 0 });
	return `${txt} ${big[1]}${x >= 2 ? 's' : ''}`;
}

/** Up to `max` decimals, none when the value is whole (multipliers such as « ×4,5 »). */
export const fmtNum = (n, max = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: max });
