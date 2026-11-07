// The one French number format for everything the player reads: decimal comma, narrow space for thousands.

/** Exactly `d` decimals (distances, nectar per hour). */
export const fmtFixed = (n, d = 2) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Rounded to a whole number. */
export const fmtInt = n => Math.round(Number(n)).toLocaleString('fr-FR');

/** Up to `max` decimals, none when the value is whole (multipliers such as « ×4,5 »). */
export const fmtNum = (n, max = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: max });
