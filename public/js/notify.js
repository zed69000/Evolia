// Rappels (appli Android seulement) : le collecteur plein, le cadeau du jour, la série à garder.
// Ils sont programmés quand on quitte l'appli, d'après l'état du jardin, et annulés dès qu'on y revient.
// Notifications locales : rien ne part sur Internet.

const IDS = [1, 2, 3];

function plugin() {
	const C = window.Capacitor;
	if (!C?.isNativePlatform?.() || !C.isPluginAvailable?.('LocalNotifications')) return null;
	return C.registerPlugin('LocalNotifications');
}

export const canNotify = () => !!plugin();

/** Demande l'autorisation d'afficher des notifications ; vrai si elle est accordée. */
export async function askNotify() {
	const p = plugin();
	if (!p) return false;
	try { return (await p.requestPermissions()).display === 'granted'; } catch (e) { return false; }
}

/** Retire les rappels prévus : on est dans l'appli, ils n'ont plus lieu d'être. */
export async function clearReminders() {
	const p = plugin();
	if (!p) return;
	try { await p.cancel({ notifications: IDS.map(id => ({ id })) }); } catch (e) { /* rien de prévu */ }
}

/**
 * Programme les rappels : `plan` = { jarFullAt, giftAt, streak, streakAt } (dates en ms, ou null).
 * Un rappel passé ou trop lointain est ignoré.
 */
export async function scheduleReminders(plan) {
	const p = plugin();
	if (!p) return;
	await clearReminders();
	const now = Date.now(), list = [];
	const add = (id, at, title, body) => { if (at && at > now + 5 * 60000 && at < now + 2 * 86400000) list.push({ id, title, body, schedule: { at: new Date(at), allowWhileIdle: true } }); };
	add(1, plan.jarFullAt, 'Ton collecteur est plein', 'Viens récolter ton nectar : plein, il ne garde plus rien.');
	add(2, plan.giftAt, 'Ton cadeau du jour t’attend', 'Et trois nouveaux défis. Une petite marche pour lancer la journée ?');
	if (plan.streak >= 2) add(3, plan.streakAt, `Ta série de ${plan.streak} jours`, 'Encore 500 m aujourd’hui pour la garder.');
	if (!list.length) return;
	try { await p.schedule({ notifications: list }); } catch (e) { console.warn(e); }
}
