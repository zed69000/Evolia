// Écosystème « idle » : les animaux découverts travaillent seuls, appli ouverte ou fermée.
// Ils font pousser le jardin et produisent du nectar ; le sport triple leur travail (élan).
// Chaque équipe grandit avec les objets posés dans le jardin (hôtel à insectes, nichoir…), achetés dans « Aménager ».

import { SPECIES, PLACE_BY_ID } from './species.js';
import { thumbCopy } from './encyclopedia.js';
import { PLANT_TYPES } from './plants.js';
import { ITEMS } from './deco.js';

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

/**
 * Espèces de l'équipe découvertes dans ce lieu, avec leur effectif, plus les membres attirés par les objets posés
 * (et par les anciennes améliorations, achetées avant que tout passe par « Aménager »).
 */
export function guildMembers(state, placeId, gid) {
	const g = GUILDS[gid], place = state.places[placeId];
	const list = SPECIES.filter(s => s.place === placeId && s.kind === 'animal' && g.members.includes(s.id) && state.species[s.id])
		.map(sp => ({ sp, n: Math.max(1, sp.critter.count?.(state) ?? 1) }));
	const items = (place?.items ?? []).reduce((a, it) => a + (ITEMS[it.kind]?.team === gid ? ITEMS[it.kind].power : 0), 0);
	const level = (place?.upgrades?.[g.upgrade.id] ?? 0) + items;
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


/**
 * Fait travailler l'écosystème depuis la dernière fois (12 h au plus), dans tous les lieux.
 * Renvoie un bilan par lieu : plantes arrivées à maturité, nectar produit.
 */
/**
 * Le nectar que produit l'écosystème ne tombe pas tout seul dans la bourse : il attend d'être récolté.
 * Les fleurs en gardent un peu (on le cueille goutte à goutte, à la main) ; chaque collecteur en stocke bien plus,
 * selon son niveau. Au-delà de la réserve, la production est perdue.
 */
export const HAND_CAP = 30;
export const COLLECTOR_CAP = [0, 150, 400, 1000];
export const COLLECTOR_UPGRADE = [0, 0, 200, 500];

/** Réserve totale : ce que gardent les fleurs, plus tous les collecteurs posés, dans tous les lieux. */
export function nectarCapacity(state) {
	let cap = HAND_CAP;
	for (const place of Object.values(state.places)) for (const it of place.items ?? []) if (it.kind === 'collecteur') cap += COLLECTOR_CAP[it.level ?? 1];
	return cap;
}

export const hasCollector = state => Object.values(state.places).some(p => (p.items ?? []).some(it => it.kind === 'collecteur'));

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
	// La récolte attend dans les fleurs et les collecteurs, jusqu'à la limite de la réserve.
	const room = Math.max(0, nectarCapacity(state) - (state.pending ?? 0));
	const kept = Math.min(room, summary.nectar);
	summary.lost = summary.nectar - kept;
	const k = summary.nectar > 0 ? kept / summary.nectar : 0;
	for (const out of Object.values(summary.places)) out.nectar *= k;
	summary.nectar = kept;
	state.pending = (state.pending ?? 0) + kept;
	// Le bilan de la dernière vraie absence reste lisible sur la page Écosystème.
	if (hours > 10 / 60) {
		const matured = {};
		for (const out of Object.values(summary.places)) for (const [t, n] of Object.entries(out.matured)) matured[t] = (matured[t] ?? 0) + n;
		state.idleLast = { at: now, hours, nectar: summary.nectar, lost: summary.lost, matured, boosted };
	}
	return summary;
}

/** Bilan lisible d'une absence, ou chaîne vide s'il ne s'est rien passé de notable. */
export function summaryHtml(summary) {
	if (!summary) return '';
	const rows = Object.entries(summary.places).map(([id, out]) => {
		const chips = Object.entries(out.matured).map(([t, n]) => `<span class="chip">+${n} ${n > 1 ? TYPE_PLURAL[t] : TYPE_PLURAL[t].slice(0, -1)}</span>`).join('');
		if (!chips && out.nectar < 1) return '';
		return `<li><b>${PLACE_BY_ID[id].name}</b> · ${Math.round(out.nectar).toLocaleString('fr-FR')} nectar à récolter<br>${chips}</li>`;
	}).filter(Boolean);
	const lost = summary.lost >= 1 ? `<p class="eco-lost">Réserve pleine : ${Math.round(summary.lost).toLocaleString('fr-FR')} nectar perdus. Récolte plus souvent, ou installe un collecteur de plus.</p>` : '';
	return rows.length || lost ? `<ul class="harvest-rows">${rows.join('')}</ul>${lost}` : '';
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

const TYPE_ICON = { fleur: '🌼', herbe: '🌿', buisson: '🌳', arbre: '🌲' };
const perHour = (v, type) => {
	const n = v / PLANT_TYPES[type].cost;
	if (n >= 1) return `${n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${n >= 2 ? TYPE_PLURAL[type] : TYPE_PLURAL[type].slice(0, -1)} par heure`;
	return `1 ${TYPE_PLURAL[type].slice(0, -1)} toutes les ${fmtDur(3600000 / Math.max(n, 1e-6))}`;
};
const ago = ms => { const m = Math.round(ms / 60000); return m < 2 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };

/** La page Écosystème : ce qui se passe quand on ne bouge pas, lisible d'un coup d'œil, du plus important au détail. */
export class EcoPanel {
	constructor(panel, state, onPlace) {
		this.panel = panel;
		this.state = state;
		this.openGuild = null;
		panel.addEventListener('click', e => {
			if (e.target.closest('[data-close-eco]')) return this.close();
			const add = e.target.closest('[data-place]');
			if (add) { this.close(); return onPlace?.(add.dataset.place); }
			const head = e.target.closest('[data-guild]');
			if (head) {
				this.openGuild = this.openGuild === head.dataset.guild ? null : head.dataset.guild;
				this.render();
			}
		});
	}

	open() {
		this.render();
		this.panel.classList.add('open');
		this.panel.setAttribute('aria-hidden', 'false');
		clearInterval(this.timer);
		this.timer = setInterval(() => this.renderLive(), 250);
	}

	close() {
		clearInterval(this.timer);
		this.panel.classList.remove('open');
		this.panel.setAttribute('aria-hidden', 'true');
	}

	/** Production par heure, tous lieux confondus (l'écosystème travaille partout à la fois). */
	totalPerHour() {
		return Object.keys(this.state.places).reduce((a, id) => a + rates(this.state, id).nectar, 0) * (boostLeft(this.state) ? BOOST_MULT : 1);
	}

	/** Le compteur avance en direct entre deux passages de l'écosystème (toutes les 5 s). */
	renderLive() {
		const n = this.panel.querySelector('#eco-nectar');
		if (!n) return;
		const st = this.state;
		const cap = nectarCapacity(st);
		const live = Math.min(cap, (st.pending ?? 0) + this.totalPerHour() * (Date.now() - (st.lastIdle ?? Date.now())) / 3600000);
		n.textContent = `${live.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${fmt(cap)}`;
		const b = this.panel.querySelector('#eco-boost-left');
		if (b) b.textContent = fmtDur(boostLeft(st));
	}

	render() {
		const st = this.state, placeId = st.place, place = st.places[placeId], placeName = PLACE_BY_ID[placeId].name;
		const r = rates(st, placeId);
		const vit = vitality(place);
		const boost = boostLeft(st);
		const x = boost ? BOOST_MULT : 1;
		const working = Object.values(r.members).some(n => n > 0);

		// 1. Le nectar, en direct, et ce qu'il rapporte.
		const hero = `<div class="eco-hero">
			<span class="eco-label">À récolter</span>
			<b class="nectar" id="eco-nectar">${fmt(st.pending ?? 0)} / ${fmt(nectarCapacity(st))}</b>
			<span class="eco-rate">${working ? `+${fmt(this.totalPerHour())} par heure, même appli fermée · ${hasCollector(st) ? 'touche ton collecteur pour tout récupérer' : 'cueille les gouttes sur les fleurs, ou installe un collecteur'}` : 'Découvre des animaux : ils récolteront pour toi'}</span>
			<span class="eco-rate">Dans ta bourse : <b>${fmt(st.nectar ?? 0)}</b> nectar</span>
		</div>`;

		// 2. L'élan : le lien entre le sport et l'idle, dit simplement.
		const elan = boost
			? `<div class="eco-elan on"><b>Élan ×${BOOST_MULT}</b><span>Grâce à ta dernière sortie, tout pousse 3 fois plus vite encore <b id="eco-boost-left">${fmtDur(boost)}</b>.</span></div>`
			: `<div class="eco-elan"><b>Élan</b><span>Après une marche, tout pousse <b>3 fois plus vite</b> pendant 3 fois sa durée : 20 min de marche, 1 h d'élan.</span></div>`;

		// 3. Ce qui pousse tout seul, en plantes (pas en points).
		const grow = Object.entries(r.grow).filter(([, v]) => v > 0).sort((a, b) => PLANT_TYPES[a[0]].cost - PLANT_TYPES[b[0]].cost)
			.map(([t, v]) => `<li><i>${TYPE_ICON[t]}</i><span>${perHour(v * x, t)}</span></li>`).join('');

		// 4. Depuis la dernière visite.
		const last = st.idleLast;
		const lastHtml = last ? (() => {
			const chips = Object.entries(last.matured).map(([t, n]) => `<span class="chip">+${n} ${n > 1 ? TYPE_PLURAL[t] : TYPE_PLURAL[t].slice(0, -1)}</span>`).join('');
			return `<h3 class="eco-h">Pendant ton absence <small>${ago(Date.now() - last.at)}, ${fmtDur(last.hours * 3600000)} sans toi</small></h3>
				<div class="eco-last"><span class="nectar">+${fmt(last.nectar)}</span>${chips || '<span class="chip">les plantes ont avancé</span>'}</div>`;
		})() : '';

		// 5. Les équipes : une ligne chacune ; on touche pour le détail et pour l'aider.
		const teams = Object.entries(GUILDS).map(([gid, g]) => {
			const m = guildMembers(st, placeId, gid);
			const on = !!m.list.length, opened = this.openGuild === gid;
			const sample = m.list[0]?.sp.id ?? g.members[0];
			const effect = on ? [
				...Object.keys(g.grow).map(t => TYPE_PLURAL[t]),
				g.bonus ? `+${Math.round(g.bonus * m.total * 100)} % à tout` : '',
			].filter(Boolean).join(' · ') : 'personne pour l\'instant';
			// L'objet proposé : le plus utile qu'on peut déjà construire pour cette équipe.
			const kinds = Object.keys(ITEMS).filter(k => ITEMS[k].team === gid);
			const km = (st.totals?.distance ?? 0) / 1000;
			const kind = kinds.filter(k => ITEMS[k].km <= km && (!ITEMS[k].needs || (place.items ?? []).some(it => it.kind === ITEMS[k].needs))).sort((a, b) => ITEMS[b].power - ITEMS[a].power || ITEMS[a].cost - ITEMS[b].cost)[0] ?? kinds[0];
			const item = ITEMS[kind];
			const placed = (place.items ?? []).filter(it => ITEMS[it.kind]?.team === gid).length;
			const names = m.list.map(({ sp, n }) => `${sp.name}${n > 1 ? ` ×${n}` : ''}`).join(', ');
			const detail = opened ? `<div class="eco-team-more">
				<p>${on ? `<b>${g.does[0].toUpperCase() + g.does.slice(1)}.</b> ${names}${m.extra ? `, et ${m.extra} de plus grâce à tes aménagements` : ''}.` : `Découvre une de ces espèces dans ${placeName.toLowerCase()} pour lancer l'équipe : ${g.members.map(id => SPECIES.find(sp => sp.id === id)).filter(sp => sp?.place === placeId).slice(0, 3).map(sp => sp.name.toLowerCase()).join(', ') || 'elle vit dans un autre lieu'}.`}</p>
				${on ? `<button class="btn primary small" data-place="${kind}">${placed ? 'En ajouter' : 'Aider'} : ${item.name.toLowerCase()}</button><small>${item.power > 1 ? `Il fait venir ${item.power} membres de plus` : 'Chaque objet posé fait venir un membre de plus'}${placed ? ` (déjà ${placed} ici)` : ''}. Tous les abris sont dans Aménager.</small>` : ''}
				<p class="eco-real"><b>Dans la vraie vie :</b> ${g.upgrade.real}</p>
			</div>` : '';
			return `<li class="eco-team${on ? '' : ' off'}${opened ? ' open' : ''}">
				<button class="eco-team-head" data-guild="${gid}" aria-expanded="${opened}">
					<span class="eco-thumb" data-eco-thumb="${sample}" data-locked="${on ? 0 : 1}"></span>
					<span class="eco-team-txt"><b>${g.name}</b><small>${effect}</small></span>
					<span class="eco-count">${on ? `×${m.total}` : '—'}</span>
				</button>${detail}</li>`;
		}).join('');

		this.panel.innerHTML = `
			<div class="panel-head"><h2>Écosystème</h2><button class="close" data-close-eco aria-label="Fermer">×</button></div>
			${hero}
			${elan}
			${grow ? `<h3 class="eco-h">Pousse tout seul ${boost ? `<small>avec l'élan</small>` : ''}</h3><ul class="eco-grow">${grow}</ul>` : ''}
			${lastHtml}
			<h3 class="eco-h">Tes équipes dans ${placeName.toLowerCase()} <small>touche pour le détail</small></h3>
			<ul class="eco-teams">${teams}</ul>
			<h3 class="eco-h">Vitalité du lieu</h3>
			<div class="eco-vit"><div class="bar"><i style="width:${Math.round(vit.progress * 100)}%"></i></div><span>Niveau ${vit.level}${vit.bonus ? ` : tout pousse ${Math.round(vit.bonus * 100)} % plus vite ici` : ''}. Elle monte avec chaque plante qui pousse.</span></div>
			<p class="eco-note">Ton écosystème travaille jusqu'à 12 h d'affilée sans toi : ouvre l'appli matin et soir pour ne rien perdre.</p>`;
		for (const el of this.panel.querySelectorAll('[data-eco-thumb]')) {
			const sp = SPECIES.find(s => s.id === el.dataset.ecoThumb);
			el.appendChild(thumbCopy(sp, 44, el.dataset.locked === '1'));
		}
		this.renderLive();
	}
}
