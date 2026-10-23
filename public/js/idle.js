// Écosystème « idle » : les animaux découverts travaillent seuls, appli ouverte ou fermée.
// Ils font pousser le jardin et produisent du nectar ; le sport double leur travail (élan).

import { SPECIES, PLACE_BY_ID } from './species.js';
import { thumbCopy } from './encyclopedia.js';

// Production par membre et par heure (effort par type de plante, nectar), et bonus sur toute la production.
export const GUILDS = {
	pollinisateur: {
		name: 'Pollinisateurs', does: 'font pousser les fleurs', grow: { fleur: 3 }, nectar: 4, bonus: 0,
		members: ['abeille', 'bourdon', 'syrphe', 'bombyle', 'petite-tortue', 'paon-du-jour', 'azure', 'citron', 'apollon'],
		upgrade: { id: 'hotel', name: 'Hôtel à insectes', cost: 40, real: 'Un fagot de tiges creuses ou des bûches percées, au soleil, accueillent les abeilles solitaires.' },
	},
	semeur: {
		name: 'Semeurs', does: 'sèment arbustes et arbres', grow: { buisson: 2, arbre: 1.5 }, nectar: 1, bonus: 0,
		members: ['merle', 'geai', 'cassenoix', 'colvert', 'ecureuil'],
		upgrade: { id: 'nichoir', name: 'Nichoir', cost: 60, real: "Un nichoir posé avant février, à l'abri du soleil de midi et hors de portée des chats." },
	},
	sol: {
		name: 'Vie du sol', does: 'font pousser les herbes et enrichissent le sol', grow: { herbe: 2.5 }, nectar: 0.5, bonus: 0.03,
		members: ['lombric', 'fourmi', 'escargot', 'gendarme', 'lucane', 'marmotte', 'crabe', 'goeland'],
		upgrade: { id: 'compost', name: 'Compost', cost: 50, real: 'Un tas de compost et de feuilles mortes nourrit vers de terre, cloportes et champignons.' },
	},
	regulateur: {
		name: 'Prédateurs utiles', does: 'protègent le jardin des ravageurs', grow: {}, nectar: 0.5, bonus: 0.05,
		members: ['coccinelle', 'epeire', 'sauterelle', 'mesange', 'herisson', 'lezard', 'ver-luisant', 'sympetrum', 'demoiselle', 'grenouille', 'triton', 'heron', 'martin-pecheur', 'pic', 'hulotte', 'salamandre', 'aigle', 'gravelot'],
		upgrade: { id: 'sauvage', name: 'Coin sauvage', cost: 80, real: "Un coin d'herbes hautes, de ronces et de pierres abrite hérissons, lézards et coccinelles." },
	},
};
export const GUILD_OF = Object.fromEntries(Object.entries(GUILDS).flatMap(([g, d]) => d.members.map(id => [id, g])));

const MAX_OFFLINE_H = 12;
// Le sport est le vrai moteur : l'élan triple la production, pendant 3 fois la durée de la sortie.
export const BOOST_MULT = 3;
export const BOOST_PER_MIN = 3;
const MAX_BOOST_MS = 6 * 3600000;
const TYPE_PLURAL = { herbe: 'herbes', fleur: 'fleurs', buisson: 'arbustes', arbre: 'arbres' };

/** Espèces de la guilde découvertes dans ce lieu, avec leur effectif, plus les membres attirés par l'aménagement. */
export function guildMembers(state, placeId, gid) {
	const g = GUILDS[gid];
	const list = SPECIES.filter(s => s.place === placeId && s.kind === 'animal' && g.members.includes(s.id) && state.species[s.id])
		.map(sp => ({ sp, n: Math.max(1, sp.critter.count?.(state) ?? 1) }));
	const level = state.places[placeId]?.upgrades?.[g.upgrade.id] ?? 0;
	const extra = list.length ? level : 0;
	return { list, level, extra, total: list.reduce((a, m) => a + m.n, 0) + extra };
}

const xpFor = level => 150 * (Math.pow(1.45, level - 1) - 1);

export function vitality(place) {
	const xp = place?.xp ?? 0;
	const level = 1 + Math.floor(Math.log(1 + xp / 150) / Math.log(1.45));
	const lo = xpFor(level), hi = xpFor(level + 1);
	return { level, progress: (xp - lo) / (hi - lo), bonus: 0.05 * (level - 1) };
}

export const boostLeft = state => Math.max(0, (state.boostUntil ?? 0) - Date.now());

/** L'élan sportif triple la production ; il s'ajoute à l'élan en cours, sans dépasser 6 h. */
export function addBoost(state, minutes) {
	const now = Date.now();
	state.boostUntil = Math.min(now + MAX_BOOST_MS, Math.max(now, state.boostUntil ?? 0) + minutes * 60000);
}

/** Production par heure d'un lieu (sans l'élan, appliqué à part). */
export function rates(state, placeId) {
	const members = {}, grow = {};
	let nectar = 0, bonus = 0;
	for (const gid of Object.keys(GUILDS)) {
		members[gid] = guildMembers(state, placeId, gid).total;
		bonus += GUILDS[gid].bonus * members[gid];
	}
	const mult = (1 + bonus) * (1 + vitality(state.places[placeId]).bonus);
	for (const [gid, g] of Object.entries(GUILDS)) {
		for (const [type, v] of Object.entries(g.grow)) grow[type] = (grow[type] ?? 0) + v * members[gid] * mult;
		nectar += g.nectar * members[gid] * mult;
	}
	return { members, grow, nectar, mult };
}

export const upgradeCost = (gid, level) => Math.round(GUILDS[gid].upgrade.cost * Math.pow(1.6, level));

/**
 * Fait travailler l'écosystème depuis la dernière fois (12 h au plus), dans tous les lieux.
 * Renvoie un bilan par lieu : plantes arrivées à maturité, nectar produit.
 */
export function tick(state, garden, now = Date.now()) {
	const last = state.lastIdle ?? now;
	state.lastIdle = now;
	const hours = Math.min(MAX_OFFLINE_H, (now - last) / 3600000);
	if (hours <= 0) return null;
	// Part de la période couverte par l'élan (qui a pu s'épuiser pendant l'absence).
	const boosted = Math.min(hours, Math.max(0, (state.boostUntil ?? 0) - last) / 3600000);
	const eff = hours + boosted * (BOOST_MULT - 1);
	const summary = { hours, nectar: 0, places: {} };
	for (const placeId of Object.keys(state.places)) {
		const r = rates(state, placeId);
		const place = state.places[placeId];
		const out = { matured: {}, nectar: r.nectar * eff };
		for (const [type, perH] of Object.entries(r.grow)) {
			const amount = perH * eff;
			if (amount <= 0) continue;
			place.xp = (place.xp ?? 0) + amount;
			for (const ev of garden.growIn(placeId, type, amount)) if (ev.kind === 'mature') out.matured[type] = (out.matured[type] ?? 0) + 1;
		}
		summary.nectar += out.nectar;
		summary.places[placeId] = out;
	}
	state.nectar = (state.nectar ?? 0) + summary.nectar;
	return summary;
}

/** Bilan lisible d'une absence, ou chaîne vide s'il ne s'est rien passé de notable. */
export function summaryHtml(summary) {
	if (!summary) return '';
	const rows = Object.entries(summary.places).map(([id, out]) => {
		const chips = Object.entries(out.matured).map(([t, n]) => `<span class="chip">+${n} ${n > 1 ? TYPE_PLURAL[t] : TYPE_PLURAL[t].slice(0, -1)}</span>`).join('');
		if (!chips && out.nectar < 1) return '';
		return `<li><b>${PLACE_BY_ID[id].name}</b> · ${Math.round(out.nectar).toLocaleString('fr-FR')} nectar<br>${chips}</li>`;
	}).filter(Boolean);
	return rows.length ? `<ul class="harvest-rows">${rows.join('')}</ul>` : '';
}

/** Membres affichés en plus dans le jardin grâce aux aménagements (sur la première espèce de la guilde). */
export function visualExtra(state, placeId, sp) {
	const gid = GUILD_OF[sp.id];
	if (!gid) return 0;
	const m = guildMembers(state, placeId, gid);
	return m.list[0]?.sp.id === sp.id ? Math.min(6, m.extra) : 0;
}

const fmt = n => Math.round(n).toLocaleString('fr-FR');
const fmtDur = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };

export class EcoPanel {
	constructor(panel, state, onBuy) {
		this.panel = panel;
		this.state = state;
		panel.addEventListener('click', e => {
			if (e.target.closest('[data-close-eco]')) return this.close();
			const b = e.target.closest('[data-buy]');
			if (!b) return;
			const gid = b.dataset.buy;
			const place = state.places[state.place];
			place.upgrades ??= {};
			const id = GUILDS[gid].upgrade.id;
			const cost = upgradeCost(gid, place.upgrades[id] ?? 0);
			if ((state.nectar ?? 0) < cost) return;
			state.nectar -= cost;
			place.upgrades[id] = (place.upgrades[id] ?? 0) + 1;
			onBuy?.(gid);
			this.render();
		});
	}

	open() {
		this.render();
		this.panel.classList.add('open');
		this.panel.setAttribute('aria-hidden', 'false');
		this.timer = setInterval(() => this.renderLive(), 2000);
	}

	close() {
		clearInterval(this.timer);
		this.panel.classList.remove('open');
		this.panel.setAttribute('aria-hidden', 'true');
	}

	renderLive() {
		const n = this.panel.querySelector('#eco-nectar');
		if (n) n.textContent = fmt(this.state.nectar ?? 0);
		for (const b of this.panel.querySelectorAll('[data-buy]')) b.disabled = b.dataset.cost > (this.state.nectar ?? 0) || b.dataset.empty === '1';
	}

	render() {
		const st = this.state, placeId = st.place, place = st.places[placeId];
		const r = rates(st, placeId);
		const vit = vitality(place);
		const boost = boostLeft(st);
		const x = boost ? BOOST_MULT : 1;
		const cards = Object.entries(GUILDS).map(([gid, g]) => {
			const m = guildMembers(st, placeId, gid);
			const level = place.upgrades?.[g.upgrade.id] ?? 0;
			const cost = upgradeCost(gid, level);
			const effects = [
				...Object.entries(g.grow).map(([t, v]) => `${TYPE_PLURAL[t]} +${fmt(v * m.total * r.mult * x)}/h`),
				g.bonus ? `+${Math.round(g.bonus * m.total * 100)} % de production` : '',
			].filter(Boolean).join(' · ');
			const names = m.list.map(({ sp, n }) => `${sp.name}${n > 1 ? ` ×${n}` : ''}`).join(', ');
			return `<div class="eco-card${m.list.length ? '' : ' locked'}">
				<div class="eco-head"><span class="eco-thumb" data-eco-thumb="${m.list[0]?.sp.id ?? SPECIES.find(s => s.id === g.members[0]).id}" data-locked="${m.list.length ? 0 : 1}"></span>
					<div><h3>${g.name} <small>${m.total} membre${m.total > 1 ? 's' : ''}</small></h3>
					<p>${m.list.length ? `${names}${m.extra ? ` + ${m.extra} attiré${m.extra > 1 ? 's' : ''}` : ''}` : 'Aucune espèce de cette guilde ici pour l\'instant.'}</p></div></div>
				<p class="eco-effect">${m.list.length ? `${g.does} : ${effects}` : g.does}</p>
				<div class="eco-up"><div><b>${g.upgrade.name}</b> · niveau ${level}<br><span>${g.upgrade.real}</span></div>
					<button class="btn primary small" data-buy="${gid}" data-cost="${cost}" data-empty="${m.list.length ? 0 : 1}" ${cost > (st.nectar ?? 0) || !m.list.length ? 'disabled' : ''}>+1 · ${fmt(cost)}</button></div>
			</div>`;
		}).join('');
		this.panel.innerHTML = `
			<div class="panel-head"><h2>Écosystème</h2><button class="close" data-close-eco aria-label="Fermer">×</button></div>
			<p class="sp-intro">${PLACE_BY_ID[placeId].name} · tes animaux travaillent même quand l'appli est fermée.</p>
			<div class="tiles">
				<div class="tile"><b id="eco-nectar">${fmt(st.nectar ?? 0)}</b><span>nectar</span></div>
				<div class="tile"><b>+${fmt(r.nectar * x)}</b><span>nectar / h</span></div>
				<div class="tile"><b>${vit.level}</b><span>vitalité</span></div>
			</div>
			<div class="eco-vit"><div class="bar"><i style="width:${Math.round(vit.progress * 100)}%"></i></div><span>Niveau ${vit.level} · +${Math.round(vit.bonus * 100)} % de production dans ce lieu</span></div>
			<div class="eco-boost${boost ? ' on' : ''}">${boost ? `<b>Élan sportif ×${BOOST_MULT}</b> · encore ${fmtDur(boost)}. Ton activité nourrit ton écosystème.` : `Bouge pour aider ton écosystème : sa production sera <b>triplée</b> pendant ${BOOST_PER_MIN} fois la durée de ta sortie.`}</div>
			${cards}`;
		for (const el of this.panel.querySelectorAll('[data-eco-thumb]')) {
			const sp = SPECIES.find(s => s.id === el.dataset.ecoThumb);
			el.appendChild(thumbCopy(sp, 48, el.dataset.locked === '1'));
		}
	}
}
