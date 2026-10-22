# Evolia

Marche, cours : ton jardin aquarelle pousse à chaque pas.

Site statique (HTML, CSS, JavaScript sans étape de build) dans `public/`, servi par Cloudflare (`wrangler.jsonc`).
Plus tard : emballé avec Capacitor pour Android et iOS.

## Lancer en local

```
python -m http.server 8642 --directory public
```

Puis ouvrir http://localhost:8642/?dev=1

## Paramètres d'URL

- `?dev=1` : mode test (marche simulée avec vitesse et accélérateur de temps, réglage de l'heure et remise à zéro dans le carnet).
- `?h=22` : force l'heure du jardin (ici 22 h, pour voir la nuit et les lucioles).

## Fichiers

- `js/watercolor.js` : primitives de peinture (lavis, rubans, feuilles, grain de papier).
- `js/plants.js` : herbes, fleurs, buissons, arbres et décor (mare, champignons, tronc).
- `js/garden.js` : scène, caméra, vent, insectes, heure du jour.
- `js/tracker.js` : GPS et simulation.
- `js/state.js` : activités (reprises du prototype Unity), effort, sauvegarde locale.
- `js/main.js` : interface (bandeau, marche, récap, carnet).

- `js/harvest.js` : récolte des pas comptés appli fermée (Santé / Health Connect, podomètre), allure déduite de la cadence.
- `js/species.js` : les 29 espèces, leur rôle, comment les aider, et ce qui les débloque.
- `js/critters.js` : abeille, papillon, libellule, coccinelle, grenouille, hérisson, mésange…
- `js/encyclopedia.js` : l'écran Biodiversité.

## Sur téléphone (Capacitor, à venir)

- `@capgo/capacitor-health` : pas lus dans Santé (iOS) ou Health Connect (Android 14+ compte les pas du téléphone lui-même). Recherché sous le nom de plugin `Health`.
- `@capgo/capacitor-pedometer` : repli, recherché sous le nom `CapacitorPedometer`.
- Les noms de plugins et les permissions sont à confirmer sur un vrai appareil.

## Règles de jeu

| Allure | Plante | Coût |
|---|---|---|
| Marche lente (dès 1 km/h) | herbe folle | 15 |
| Marche (dès 3,5 km/h) | fleur | 60 |
| Marche rapide, jogging (dès 5 km/h) | buisson | 150 |
| Course (dès 9 km/h) | arbre | 400 |

Effort = distance (m) / 10 × multiplicateur de l'allure × (vitesse / vitesse de référence).
Au-delà de 25 km/h rien ne pousse (vélo, voiture). Décor débloqué à 3, 6 et 10 km cumulés.

Pas récoltés sans GPS : l'allure vient de la cadence (moins de 45 pas/min = ménage et petits pas → herbes folles,
45-90 marche lente, 90-110 marche, 110-135 marche rapide, 135-155 jogging, au-delà course).
