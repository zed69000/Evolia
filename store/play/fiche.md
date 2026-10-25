# Fiche Google Play : Evolia

Identifiant de l'appli : `com.zed69000.evolia` (définitif dès le premier envoi).

**État** : appli créée dans le compte Play Console « Musclor-Zed » ; version 0.6.14 (614) publiée en **tests internes**
le 24 octobre 2026, liste « Amis testeurs ». Lien pour les testeurs : https://play.google.com/apps/internaltest/4701100888817147702
Pour la production, Google exige d'abord un test fermé avec au moins 12 testeurs pendant 14 jours.

Visuels, dans ce dossier :
- icône 512 × 512 : `public/assets/icon-512.png` (à la racine du dépôt)
- bannière 1024 × 500 : `feature-graphic.png`
- captures téléphone 1080 × 1920 : `screenshot-1.png` à `screenshot-6.png`, dans cet ordre

Pour refaire les visuels : captures du jeu dans `raw/` (1080 × 2338), fonds légendés rendus depuis `shot.html`
(`raw/fond-N.png`), puis `python tools/store/compose.py` ; la bannière se rend depuis `feature.html`.

---

## Mise en ligne, pas à pas

### 1. L'App Bundle signé (sans aucun secret dans GitHub)

1. GitHub construit l'App Bundle **non signé** à chaque changement de `public/js/version.js` (workflow
   « Android · App Bundle ») et le dépose dans la version GitHub `android-latest`.
2. Sur l'ordinateur qui garde la clé (`%USERPROFILE%\.evolia`) :
   `powershell -ExecutionPolicy Bypass -File toolspp\sign-aab.ps1`
   télécharge ce fichier, le signe avec la clé d'envoi et le vérifie. Le fichier prêt arrive dans
   `%USERPROFILE%\Downloads\evolia-play\evolia-<version>.aab`.

Garder une copie de `%USERPROFILE%\.evolia` en lieu sûr : sans la clé d'envoi, il faut demander à Google de la réinitialiser.

### 2. (Plus tard, facultatif) Envoi automatique

Le workflow « Android · Google Play » (chaîne commune game-pipeline) signe et envoie tout seul, une fois les secrets
`PLAY_UPLOAD_KEYSTORE_BASE64`, `PLAY_UPLOAD_KEYSTORE_PASSWORD`, `PLAY_UPLOAD_KEY_ALIAS` (`upload`),
`PLAY_UPLOAD_KEY_PASSWORD` et `PLAY_SERVICE_ACCOUNT_JSON` ajoutés au dépôt.

### 3. Le premier envoi dans la Play Console (à la main, Google l'exige)

1. *Créer une application* : nom « Evolia », langue par défaut français, application, gratuite.
2. *Tests* › *Tests internes* › *Créer une version* : déposer `evolia-<version>.aab`. Notes de version : voir plus bas.
3. *Testeurs* : créer une liste avec les adresses e-mail des testeurs, copier le lien d'inscription et le leur envoyer.
4. Remplir les questionnaires (réponses ci-dessous), la fiche du store (textes et visuels ci-dessous).
5. *Examiner et déployer*.

Ensuite, à chaque nouvelle version : augmenter la version dans `public/js/version.js` et pousser, lancer
`toolspp\sign-aab.ps1`, puis déposer le nouveau fichier dans *Tests internes* › *Créer une version*.

---

## Français (langue par défaut, fr-FR)

**Nom** (30 car. max)
Evolia : marche et jardin

**Description courte** (80 car. max)
Marche, cours, fais le ménage : chaque pas fait pousser ton jardin aquarelle.

**Description complète**

Evolia transforme tes pas en jardin. Une marche fait éclore des fleurs, une marche rapide des arbustes, une course des arbres. Pas besoin d'être sportif : le ménage et les petits pas de la journée comptent aussi.

UN JARDIN VIVANT
Ton jardin est peint à l'aquarelle et vit au rythme de ton vrai ciel : l'heure, le soleil, la pluie, la neige et les saisons. Les abeilles butinent, les mésanges se posent, le hérisson sort à la nuit tombée.

126 ESPÈCES À DÉCOUVRIR
Prairie, marais, forêt, montagne, littoral : chaque lieu a ses plantes et ses animaux. Pour chaque espèce, son rôle dans la nature et un geste simple pour l'aider vraiment.

UN MONDE QUI S'AGRANDIT
À chaque kilomètre, la clôture recule et un nouveau coin s'ouvre : le champ de coquelicots, le verger, le ruisseau, la haie… Installe une cabane, un nichoir, un hôtel à insectes : ils attirent la vie.

UN ÉCOSYSTÈME QUI TRAVAILLE POUR TOI
Les animaux que tu découvres continuent de faire pousser ton jardin quand tu ne bouges pas. Et quand tu bouges, leur travail triple.

CHAQUE JOUR
Un cadeau à l'ouverture, trois défis doux, ta série de jours actifs, et un album de tout ce que tu as découvert. Aucune punition si tu rates un jour.

ZEN
Des sons de la nature discrets, une musique douce qui ne se répète jamais, aucune publicité, aucun achat, aucun compte. Tes données restent sur ton téléphone.

**Notes de version (première version)**
Première version de test : jardin, lieux, espèces, aménagements, défis du jour et lecture des pas avec Health Connect. Merci de nous dire ce qui vous plaît et ce qui coince !

---

## English (en-US)

**Name**
Evolia: walk & grow a garden

**Short description**
Walk, run, do the chores: every step grows your watercolor garden.

**Full description**

Evolia turns your steps into a garden. A walk opens flowers, a brisk walk grows shrubs, a run grows trees. No need to be sporty: chores and the little steps of your day count too.

A LIVING GARDEN
Your garden is painted in watercolor and follows your real sky: the time of day, the sun, rain, snow and seasons. Bees forage, tits land on branches, the hedgehog comes out at dusk.

126 SPECIES TO DISCOVER
Meadow, marsh, forest, mountain, coast: every place has its own plants and animals. For each one, its role in nature and one simple thing you can do to help it.

A WORLD THAT GROWS
Every kilometer, the fence moves back and a new corner opens: the poppy field, the orchard, the brook, the hedgerow… Build a cabin, a nest box, an insect hotel: they bring life in.

AN ECOSYSTEM THAT WORKS FOR YOU
The animals you discover keep your garden growing while you rest. When you move, their work triples.

EVERY DAY
A gift when you open the app, three gentle challenges, your streak of active days, and an album of everything you found. No punishment if you miss a day.

CALM
Soft nature sounds, gentle music that never repeats, no ads, no purchases, no account. Your data stays on your phone.

---

## Réponses aux questionnaires de la Play Console

**Catégorie** : Application › Santé et remise en forme (ou Jeu › Simulation, au choix). Tags : marche, nature, jardin.

**Coordonnées** : e-mail musclorzed@gmail.com.

**Politique de confidentialité** : `https://evolia.sebastienalzamora.workers.dev/privacy.html`

**Annonces** : Non, l'application ne contient pas d'annonces.

**Accès à l'application** : Tout est accessible sans compte ni identifiant.

**Classification du contenu** (questionnaire IARC) : pas de violence, pas de sexe ni de nudité, pas de langage
grossier, pas de drogue, pas de jeux d'argent, pas d'échanges entre utilisateurs, pas d'achats, partage de position
avec d'autres utilisateurs : non. Résultat attendu : tous publics / 3+.

**Public cible** : 13 ans et plus pour commencer (13-15, 16-17, 18+). Les enfants peuvent l'utiliser en famille,
mais cocher « moins de 13 ans » ferait entrer l'appli dans le programme « Familles », avec des exigences
supplémentaires sur la position et les données de santé : à voir plus tard.

**Health Connect** (*Contenu de l'application* › *Autorisations Santé*) : une seule autorisation, **lecture des pas**
(`READ_STEPS`). Justification : « Evolia lit le nombre de pas et leurs horaires pour faire pousser le jardin selon
l'allure de la personne, y compris pour les pas faits appli fermée. Rien n'est écrit dans Health Connect, aucune autre
donnée de santé n'est lue, et les pas ne quittent jamais le téléphone. »

**Position** : position approximative et précise, uniquement appli ouverte (pas en arrière-plan), pour mesurer la
distance et la vitesse des balades et afficher le vrai ciel. Pas de position en arrière-plan.

**Reconnaissance de l'activité** (`ACTIVITY_RECOGNITION`) : pour compter les pas avec le podomètre du téléphone.

**Sécurité des données**
- Données collectées : **Position approximative** — envoyée à Open-Meteo, arrondie à environ 10 km, pour la météo ;
  non partagée à des fins publicitaires ; facultative (seulement si la personne l'autorise).
- **Santé et forme physique** (pas) : lues sur l'appareil, jamais envoyées : à déclarer comme « non collectées »
  (les données traitées uniquement sur l'appareil ne sont pas considérées comme collectées par Google).
- Données chiffrées en transit : oui (HTTPS vers Open-Meteo).
- Suppression : tout est stocké sur le téléphone ; « Recommencer à zéro » dans les Options, ou désinstaller l'appli,
  efface tout.
- Pas de compte, pas d'identifiant publicitaire, pas d'analyse ni de suivi.

**Identifiant publicitaire** : non.

**Application gouvernementale / financière / d'actualités** : non. **Santé** : application de bien-être (pas un
dispositif médical).
