// Garder sa partie : tout le jardin tient dans un code (le JSON de la sauvegarde, compressé), à copier, partager
// ou télécharger. Collé dans « Restaurer », il ramène la partie, sur ce téléphone ou sur un autre.

const PREFIX = 'EVOLIA1:';

const toB64 = bytes => {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
};
const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function pipe(bytes, stream) {
	return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Le code de sauvegarde d'une partie. */
export async function exportCode(state) {
	const json = new TextEncoder().encode(JSON.stringify(state));
	const zipped = typeof CompressionStream === 'function' ? await pipe(json, new CompressionStream('gzip')) : null;
	return zipped ? `${PREFIX}${toB64(zipped)}` : `${PREFIX}J${toB64(json)}`;
}

/** Relit un code (ou le contenu d'un fichier de sauvegarde) ; lève une erreur lisible s'il ne convient pas. */
export async function importCode(text) {
	const code = String(text ?? '').replace(/\s+/g, '');
	if (!code.startsWith(PREFIX)) throw new Error('Ce n’est pas un code de sauvegarde Evolia.');
	const body = code.slice(PREFIX.length);
	let json;
	try {
		const bytes = body.startsWith('J') ? fromB64(body.slice(1)) : await pipe(fromB64(body), new DecompressionStream('gzip'));
		json = JSON.parse(new TextDecoder().decode(bytes));
	} catch (e) {
		throw new Error('Le code est incomplet ou abîmé : recopie-le en entier.');
	}
	if (!json || typeof json !== 'object' || !json.places || !json.totals || !json.species) throw new Error('Ce code ne contient pas de jardin.');
	return json;
}

/** Une petite phrase sur la sauvegarde : jamais faite, ou il y a combien de temps. */
export function backupAge(state) {
	if (!state.backupAt) return 'Tu n’as encore jamais gardé de copie.';
	const days = Math.floor((Date.now() - state.backupAt) / 86400000);
	return days < 1 ? 'Dernière copie aujourd’hui.' : `Dernière copie il y a ${days} jour${days > 1 ? 's' : ''}.`;
}
