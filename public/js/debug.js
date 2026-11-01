// Panneau de débogage : ce que le jeu voit en direct (GPS, pas, balade, relecture des pas, images par seconde),
// et un journal des événements gardé d'une ouverture à l'autre (écran éteint, GPS perdu, balades, relectures),
// pour comprendre après coup pourquoi une sortie n'a pas été comptée. S'active dans Options ; réglage du téléphone,
// pas de la partie.

const ON_KEY = 'evolia.debug', LOG_KEY = 'evolia.debuglog', MAX_LOG = 60;

let log = [];
try { log = JSON.parse(localStorage.getItem(LOG_KEY)) ?? []; } catch (e) { log = []; }

// ─── Trace : un enregistrement détaillé qu'on démarre et qu'on arrête soi-même ───────────────
// Chaque point GPS, chaque paquet de pas, chaque décision du jeu, avec l'heure. Gardée sur le téléphone
// (même si l'appli se ferme), jusqu'à 4 000 lignes, puis copiée d'un geste pour être envoyée.
const TRACE_KEY = 'evolia.trace', MAX_TRACE = 4000;
let tr = null;
try { tr = JSON.parse(localStorage.getItem(TRACE_KEY)); } catch (e) { tr = null; }
let dirty = 0;
const flush = () => { dirty = 0; try { localStorage.setItem(TRACE_KEY, JSON.stringify(tr)); } catch (e) { /* plein : on garde en mémoire */ } };

export const tracing = () => !!tr?.on;
export const traceSize = () => tr?.lines.length ?? 0;
export function startTrace(info) {
	tr = { on: true, start: Date.now(), end: null, info, lines: [] };
	flush();
	debugLog('Trace démarrée');
}
export function stopTrace() {
	if (!tr) return;
	tr.on = false;
	tr.end = Date.now();
	flush();
	debugLog(`Trace arrêtée : ${tr.lines.length} lignes`);
}
/** Ajoute une ligne à la trace en cours : `kind` (gps, pas, décision…) et ses valeurs. */
export function trace(kind, data) {
	if (!tr?.on) return;
	tr.lines.push([Date.now(), kind, data]);
	if (tr.lines.length > MAX_TRACE) tr.lines.splice(0, tr.lines.length - MAX_TRACE);
	if (++dirty >= 10) flush();
}
export const traceFlush = () => { if (tr && dirty) flush(); };
/** La trace en texte, une ligne par événement : secondes depuis le début, type, valeurs. */
export function traceText() {
	if (!tr) return 'Aucune trace enregistrée.';
	const t0 = tr.start, fmtv = v => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v);
	const head = [`Evolia · trace du ${new Date(t0).toLocaleString('fr-FR')} au ${tr.end ? new Date(tr.end).toLocaleString('fr-FR') : '(en cours)'}`, ...Object.entries(tr.info ?? {}).map(([k, v]) => `${k} : ${v}`), `${tr.lines.length} lignes · temps en secondes depuis le début`];
	return [...head, ...tr.lines.map(([t, kind, d]) => `${((t - t0) / 1000).toFixed(1)}\t${kind}\t${Object.entries(d ?? {}).map(([k, v]) => `${k}=${fmtv(v)}`).join(' ')}`)].join('\n');
}

export const debugOn = () => { try { return localStorage.getItem(ON_KEY) === '1'; } catch (e) { return false; } };
export function setDebug(on) {
	try { localStorage.setItem(ON_KEY, on ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
}

const hhmm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const ago = t => (t ? `${Math.max(0, Math.round((Date.now() - t) / 1000))} s` : '—');
const dur = s => (s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

/** Note un événement dans le journal (toujours, même panneau fermé : on le relit après une sortie). */
export function debugLog(msg) {
	log.push({ t: Date.now(), msg });
	if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
	try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) { /* idem */ }
}

/**
 * Le panneau en jeu. `read()` renvoie les sections à afficher : [[titre, [[libellé, valeur], …]], …].
 * Mis à jour deux fois par seconde tant qu'il est ouvert.
 */
export class DebugPanel {
	constructor(read) {
		this.read = read;
		this.el = document.createElement('div');
		this.el.id = 'debug';
		this.el.hidden = true;
		document.getElementById('app').appendChild(this.el);
		this.el.addEventListener('click', e => {
			if (e.target.closest('[data-dbg-copy]')) this.copy();
			if (e.target.closest('[data-dbg-trace]')) { if (tracing()) stopTrace(); else startTrace(this.info?.() ?? {}); this.render(); }
			if (e.target.closest('[data-dbg-trace-copy]')) this.copy(traceText());
			if (e.target.closest('[data-dbg-fold]')) { this.folded = !this.folded; this.render(); }
			if (e.target.closest('[data-dbg-clear]')) { log = []; debugLog('Journal effacé'); this.render(); }
		});
		this.timer = null;
	}

	show(on) {
		this.el.hidden = !on;
		clearInterval(this.timer);
		if (on) { this.render(); this.timer = setInterval(() => this.render(), 500); }
	}

	text() {
		const lines = [];
		for (const [title, rows] of this.read()) {
			lines.push(`— ${title}`);
			for (const [k, v] of rows) lines.push(`${k} : ${v}`);
		}
		lines.push('— Journal');
		for (const e of log.slice().reverse()) lines.push(`${hhmm(e.t)}  ${e.msg}`);
		return lines.join('\n');
	}

	/** Copie tout le panneau et le journal ; si le téléphone refuse, le texte s'ouvre tout sélectionné, à copier à la main. */
	async copy(text = `Evolia · débogage · ${new Date().toLocaleString('fr-FR')}\n${this.text()}`) {
		try { await navigator.clipboard.writeText(text); this.flash = 'Copié !'; }
		catch (e) {
			const box = document.createElement('div');
			box.className = 'dbg-copy';
			box.innerHTML = '<p>Copie automatique refusée : le texte est sélectionné, fais « Copier ».</p><textarea readonly></textarea><button>Fermer</button>';
			const ta = box.querySelector('textarea');
			ta.value = text;
			box.querySelector('button').onclick = () => box.remove();
			document.body.appendChild(box);
			ta.focus();
			ta.setSelectionRange(0, text.length);
		}
		this.render();
		setTimeout(() => { this.flash = null; this.render(); }, 1500);
	}

	render() {
		if (this.el.hidden) return;
		const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
		const rec = tracing() ? `<button data-dbg-trace class="rec">■ Arrêter la trace (${traceSize()})</button>` : `<button data-dbg-trace>● Trace</button>${traceSize() ? '<button data-dbg-trace-copy>Copier la trace</button>' : ''}`;
		const head = `<div class="dbg-head"><b>Débogage</b><button data-dbg-copy>${this.flash ?? 'Copier'}</button><button data-dbg-fold>${this.folded ? 'Ouvrir' : 'Réduire'}</button></div><div class="dbg-head">${rec}</div>`;
		if (this.folded) { this.el.innerHTML = head; return; }
		const body = this.read().map(([title, rows]) => `<div class="dbg-sec"><i>${esc(title)}</i>${rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`).join('');
		const journal = log.slice(-14).reverse().map(e => `<div><span>${hhmm(e.t)}</span>${esc(e.msg)}</div>`).join('');
		this.el.innerHTML = `${head}${body}<div class="dbg-sec dbg-log"><i>Journal <button data-dbg-clear>effacer</button></i>${journal || '<div>rien pour l’instant</div>'}</div>`;
	}
}

export { ago, dur, hhmm };
