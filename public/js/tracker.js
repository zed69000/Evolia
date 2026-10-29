// Sources de mouvement. Chacune appelle onSample({ dist, dt, speedKmh }) :
// dist en mètres parcourus depuis l'échantillon précédent, dt en secondes.

const R_EARTH = 6371000;

function haversine(a, b) {
	const toRad = x => (x * Math.PI) / 180;
	const dLat = toRad(b.latitude - a.latitude), dLon = toRad(b.longitude - a.longitude);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
	return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

export class GpsTracker {
	constructor(onSample, onStatus) {
		this.onSample = onSample;
		this.onStatus = onStatus;
		this.watch = null;
		this.last = null;
		this.speed = 0;
	}

	static available() {
		return 'geolocation' in navigator;
	}

	start() {
		this.onStatus({ kind: 'searching' });
		this.watch = navigator.geolocation.watchPosition(
			pos => this.handle(pos),
			err => this.onStatus({ kind: 'error', code: err.code, message: err.message }),
			{ enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
		);
	}

	handle(pos) {
		const c = pos.coords;
		if (c.accuracy > 35) { this.onStatus({ kind: 'weak', accuracy: c.accuracy }); return; }
		this.onStatus({ kind: 'ok', accuracy: c.accuracy });
		if (!this.last) { this.last = { coords: c, t: pos.timestamp }; return; }
		const dist = haversine(this.last.coords, c);
		const dt = (pos.timestamp - this.last.t) / 1000;
		// Après une longue pause (appli en arrière-plan, téléphone en poche), le saut de position ne dit rien de
		// l'allure : on repart de là, et ce sont les pas comptés par le téléphone qui rattrapent la sortie.
		if (dt > 90) { this.last = { coords: c, t: pos.timestamp }; this.speed = 0; return; }
		// En dessous de quelques mètres, c'est le bruit du GPS, pas un déplacement.
		if (dist < Math.max(3, c.accuracy * 0.25) || dt <= 0) return;
		const measured = c.speed != null && c.speed >= 0 ? c.speed * 3.6 : (dist / dt) * 3.6;
		this.speed = this.speed ? this.speed * 0.6 + measured * 0.4 : measured;
		this.last = { coords: c, t: pos.timestamp };
		this.onSample({ dist, dt, speedKmh: this.speed });
	}

	stop() {
		if (this.watch != null) navigator.geolocation.clearWatch(this.watch);
		this.watch = null;
	}
}

/**
 * Pas comptés par l'accéléromètre, appli ouverte. Prend le relais du GPS en intérieur
 * (ménage, tapis de course) : l'allure vient alors de la cadence.
 */
export class MotionTracker {
	constructor(onSample, classify) {
		this.onSample = onSample;
		this.classify = classify;
		this.steps = 0;
		this.pending = 0;
		this.avg = 0;
		this.f = 0;
		this.up = false;
		this.lastStep = 0;
	}

	/** iOS demande l'accord explicitement, et seulement pendant un geste de l'utilisateur. */
	static async permit() {
		if (!('DeviceMotionEvent' in window)) return false;
		if (typeof DeviceMotionEvent.requestPermission === 'function') {
			try { return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (e) { return false; }
		}
		return true;
	}

	start() {
		this.handler = e => this.handle(e);
		window.addEventListener('devicemotion', this.handler);
		this.lastEmit = performance.now();
		this.timer = setInterval(() => this.emit(), 5000);
	}

	handle(e) {
		const a = e.accelerationIncludingGravity;
		if (!a || a.x == null) return;
		const m = Math.hypot(a.x, a.y, a.z);
		this.avg = this.avg ? this.avg * 0.95 + m * 0.05 : m;
		this.f = this.f * 0.6 + (m - this.avg) * 0.4;
		const now = performance.now();
		// Un pas = un pic d'accélération au-dessus de la moyenne, au plus un toutes les 250 ms.
		if (!this.up && this.f > 1.2 && now - this.lastStep > 250) {
			this.up = true;
			this.lastStep = now;
			this.steps += 1;
			this.pending += 1;
		} else if (this.up && this.f < 0.3) {
			this.up = false;
		}
	}

	emit() {
		const now = performance.now();
		const dt = (now - this.lastEmit) / 1000;
		this.lastEmit = now;
		const n = this.pending;
		this.pending = 0;
		const spm = (n / dt) * 60;
		const band = this.classify(spm);
		this.onSample({ dist: n * band.stride, dt, speedKmh: spm * band.stride * 0.06, steps: n, act: n >= 4 ? band.act : null, motion: true });
	}

	stop() {
		window.removeEventListener('devicemotion', this.handler);
		clearInterval(this.timer);
	}
}

/** Simulation pour tester au bureau : une vitesse réglable et un accélérateur de temps. */
export class SimTracker {
	constructor(onSample, onStatus) {
		this.onSample = onSample;
		this.onStatus = onStatus;
		this.speedKmh = 5;
		this.timeScale = 1;
		this.timer = null;
	}

	start() {
		this.onStatus({ kind: 'sim' });
		this.timer = setInterval(() => {
			const dt = 0.5 * this.timeScale;
			this.onSample({ dist: (this.speedKmh / 3.6) * dt, dt, speedKmh: this.speedKmh });
		}, 500);
	}

	stop() {
		clearInterval(this.timer);
		this.timer = null;
	}
}
