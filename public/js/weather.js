// Le vrai ciel : lever et coucher du soleil calculés sur place, et météo du moment
// via Open-Meteo (gratuit, sans compte). Seule une position arrondie à ~10 km est envoyée.

const DEFAULT = { lat: 46.6, lon: 2.4 }; // centre de la France, faute de mieux
const REFRESH = 20 * 60000;

export const WEATHER_LABEL = {
	clear: 'Ciel dégagé', clouds: 'Nuageux', overcast: 'Couvert', fog: 'Brouillard',
	drizzle: 'Bruine', rain: 'Pluie', snow: 'Neige', storm: 'Orage',
};

/** Code météo WMO (Open-Meteo) → l'une de nos ambiances. */
function kindOf(code) {
	if (code === 0) return 'clear';
	if (code <= 2) return 'clouds';
	if (code === 3) return 'overcast';
	if (code === 45 || code === 48) return 'fog';
	if (code >= 51 && code <= 57) return 'drizzle';
	if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	if (code >= 95) return 'storm';
	return 'clouds';
}

/** Lever et coucher du soleil en heures locales décimales (formules de la NOAA). */
export function sunTimes(lat, lon, date = new Date()) {
	const rad = Math.PI / 180;
	const start = new Date(date.getFullYear(), 0, 0);
	const doy = Math.floor((date - start) / 86400000);
	const g = ((2 * Math.PI) / 365) * (doy - 1);
	const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
	const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
	const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
	const ha = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
	const tz = -date.getTimezoneOffset() / 60;
	const rise = (720 - 4 * (lon + ha) - eq) / 60 + tz;
	const set = (720 - 4 * (lon - ha) - eq) / 60 + tz;
	return { rise, set };
}

const hoursOf = iso => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return h + m / 60; };

export class Sky {
	constructor(state, garden, onChange) {
		this.state = state;
		this.garden = garden;
		this.onChange = onChange;
		this.override = null;
		this.apply(false);
	}

	coords() {
		return this.state.coords ?? DEFAULT;
	}

	/** Position approximative : seulement si déjà autorisée, ou quand on la demande explicitement. */
	async locate(ask = false) {
		if (!('geolocation' in navigator)) return false;
		if (!ask) {
			try {
				const p = await navigator.permissions?.query({ name: 'geolocation' });
				if (p?.state !== 'granted') return false;
			} catch (e) { return false; }
		}
		return new Promise(resolve => {
			navigator.geolocation.getCurrentPosition(
				pos => { this.setCoords(pos.coords.latitude, pos.coords.longitude); resolve(true); },
				() => resolve(false),
				{ enableHighAccuracy: false, maximumAge: 3600000, timeout: 15000 },
			);
		});
	}

	setCoords(lat, lon) {
		const round = v => Math.round(v * 10) / 10;
		const prev = this.state.coords;
		this.state.coords = { lat: round(lat), lon: round(lon) };
		if (!prev || prev.lat !== this.state.coords.lat || prev.lon !== this.state.coords.lon) this.refresh(true);
	}

	async refresh(force = false) {
		const c = this.state.coords;
		const w = this.state.weatherCache;
		if (!c || (!force && w && Date.now() - w.at < REFRESH)) { this.apply(); return; }
		try {
			const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=weather_code,temperature_2m,wind_speed_10m&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
			const d = await (await fetch(url)).json();
			this.state.weatherCache = {
				at: Date.now(),
				kind: kindOf(d.current.weather_code),
				temp: d.current.temperature_2m,
				wind: d.current.wind_speed_10m,
				rise: hoursOf(d.daily.sunrise[0]),
				set: hoursOf(d.daily.sunset[0]),
			};
		} catch (e) { /* hors ligne : on garde le ciel calculé */ }
		this.apply();
	}

	apply(notify = true) {
		const c = this.coords();
		const w = this.state.weatherCache;
		const fresh = w && Date.now() - w.at < 3 * 3600000;
		this.garden.sun = fresh && w.rise ? { rise: w.rise, set: w.set } : sunTimes(c.lat, c.lon);
		this.garden.weather = this.override ? { kind: this.override, wind: this.override === 'storm' ? 35 : 15, temp: this.override === 'snow' ? -1 : 12 }
			: fresh ? { kind: w.kind, wind: w.wind, temp: w.temp } : { kind: 'clear', wind: 10, temp: null };
		if (notify) this.onChange?.();
	}

	label() {
		const w = this.garden.weather;
		const t = w.temp != null ? ` ${Math.round(w.temp)}°` : '';
		return `${WEATHER_LABEL[w.kind]}${t}`;
	}

	start() {
		this.locate(false).then(ok => { if (!ok) this.refresh(); });
		setInterval(() => this.refresh(), REFRESH);
	}
}
