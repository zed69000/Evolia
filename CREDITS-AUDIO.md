# Evolia — crédits audio

Les cris d'animaux du jeu sont de vrais enregistrements de **Joseph Sardin, [BigSoundBank.com](https://bigsoundbank.com)**,
sous licence **CC0 (domaine public)** : usage commercial permis, sans obligation de crédit (on le donne quand même, dans
Options › Sons de la nature). Licence vérifiée sur la page de chaque son (« License CC0 (public domain): Free and
royalty-free »), le 2 novembre 2026.

Le reste (pluie, ressac, tonnerre, musique, cloches, et les cris des espèces sans enregistrement : pic, mésange, rapaces,
goéland, héron, sanglier…) est fabriqué en code dans `public/js/audio.js`.

## Préparation

Les originaux (MP3 de BigSoundBank) vont dans `art/audio-sources/bsb/<n°>.mp3` (hors dépôt, trop lourds ; on les
retrouve par leur numéro). `python tools/sfx/prepare.py <dépôt>` les découpe, les passe en mono, ajoute des fondus de
15 à 40 ms, règle le volume à -16 LUFS (crête -2 dBTP, deux passes ; limiteur doux sur les cris très brefs) et les écrit
en MP3 44,1 kHz. `tools/sfx/bsb.py` cherche des sons et affiche leur licence ; `tools/sfx/segments.py` repère les cris
dans un enregistrement.

| Fichier du jeu | Son d'origine (n° BigSoundBank) | Extrait |
|---|---|---|
| `public/sfx/merle-1.mp3` | [3483](https://bigsoundbank.com/UPLOAD/mp3/3483.mp3) | 0.30–2.10 s |
| `public/sfx/merle-2.mp3` | [3484](https://bigsoundbank.com/UPLOAD/mp3/3484.mp3) | 0.80–2.90 s |
| `public/sfx/merle-3.mp3` | [3485](https://bigsoundbank.com/UPLOAD/mp3/3485.mp3) | 0.50–1.50 s |
| `public/sfx/rougegorge-1.mp3` | [1667](https://bigsoundbank.com/UPLOAD/mp3/1667.mp3) | 0.25–2.00 s |
| `public/sfx/rougegorge-2.mp3` | [1668](https://bigsoundbank.com/UPLOAD/mp3/1668.mp3) | 0.65–2.45 s |
| `public/sfx/rougegorge-3.mp3` | [1670](https://bigsoundbank.com/UPLOAD/mp3/1670.mp3) | 0.20–2.90 s |
| `public/sfx/fauvette-1.mp3` | [3466](https://bigsoundbank.com/UPLOAD/mp3/3466.mp3) | 1.85–6.30 s |
| `public/sfx/rossignol-1.mp3` | [3087](https://bigsoundbank.com/UPLOAD/mp3/3087.mp3) | 0.25–2.90 s |
| `public/sfx/hirondelle-1.mp3` | [1016](https://bigsoundbank.com/UPLOAD/mp3/1016.mp3) | 0.00–3.35 s |
| `public/sfx/hirondelle-2.mp3` | [1015](https://bigsoundbank.com/UPLOAD/mp3/1015.mp3) | 16.80–19.60 s |
| `public/sfx/hirondelle-3.mp3` | [1015](https://bigsoundbank.com/UPLOAD/mp3/1015.mp3) | 10.80–14.40 s |
| `public/sfx/hulotte-1.mp3` | [1763](https://bigsoundbank.com/UPLOAD/mp3/1763.mp3) | 0.10–1.00 s |
| `public/sfx/hulotte-2.mp3` | [1764](https://bigsoundbank.com/UPLOAD/mp3/1764.mp3) | 0.10–1.00 s |
| `public/sfx/hulotte-3.mp3` | [1763](https://bigsoundbank.com/UPLOAD/mp3/1763.mp3) | 5.15–6.45 s |
| `public/sfx/effraie-1.mp3` | [1400](https://bigsoundbank.com/UPLOAD/mp3/1400.mp3) | 0.25–1.75 s |
| `public/sfx/effraie-2.mp3` | [1400](https://bigsoundbank.com/UPLOAD/mp3/1400.mp3) | 4.85–6.70 s |
| `public/sfx/corneille-1.mp3` | [3462](https://bigsoundbank.com/UPLOAD/mp3/3462.mp3) | 0.00–1.95 s |
| `public/sfx/corneille-2.mp3` | [3461](https://bigsoundbank.com/UPLOAD/mp3/3461.mp3) | 0.00–0.60 s |
| `public/sfx/grenouille-1.mp3` | [0997](https://bigsoundbank.com/UPLOAD/mp3/0997.mp3) | 1.05–3.30 s |
| `public/sfx/grenouille-2.mp3` | [0997](https://bigsoundbank.com/UPLOAD/mp3/0997.mp3) | 15.65–17.05 s |
| `public/sfx/grenouille-3.mp3` | [0819](https://bigsoundbank.com/UPLOAD/mp3/0819.mp3) | 5.35–9.75 s |
| `public/sfx/crapaud-1.mp3` | [1053](https://bigsoundbank.com/UPLOAD/mp3/1053.mp3) | 8.00–13.00 s |
| `public/sfx/grillon-1.mp3` | [1020](https://bigsoundbank.com/UPLOAD/mp3/1020.mp3) | 0.20–3.00 s |
| `public/sfx/grillon-2.mp3` | [1020](https://bigsoundbank.com/UPLOAD/mp3/1020.mp3) | 15.00–17.50 s |
| `public/sfx/sauterelle-1.mp3` | [3089](https://bigsoundbank.com/UPLOAD/mp3/3089.mp3) | 5.00–8.00 s |
| `public/sfx/sauterelle-2.mp3` | [3089](https://bigsoundbank.com/UPLOAD/mp3/3089.mp3) | 16.00–19.00 s |
| `public/sfx/poule-1.mp3` | [0282](https://bigsoundbank.com/UPLOAD/mp3/0282.mp3) | 0.40–2.55 s |
| `public/sfx/poule-2.mp3` | [0282](https://bigsoundbank.com/UPLOAD/mp3/0282.mp3) | 4.00–5.25 s |
| `public/sfx/poule-3.mp3` | [1039](https://bigsoundbank.com/UPLOAD/mp3/1039.mp3) | 2.75–4.65 s |
| `public/sfx/poule-4.mp3` | [0975](https://bigsoundbank.com/UPLOAD/mp3/0975.mp3) | 16.10–17.50 s |
| `public/sfx/coq-1.mp3` | [0440](https://bigsoundbank.com/UPLOAD/mp3/0440.mp3) | 0.10–2.20 s |
| `public/sfx/coq-2.mp3` | [0283](https://bigsoundbank.com/UPLOAD/mp3/0283.mp3) | 0.00–2.40 s |
| `public/sfx/chien-1.mp3` | [2954](https://bigsoundbank.com/UPLOAD/mp3/2954.mp3) | 0.00–0.70 s |
| `public/sfx/chien-2.mp3` | [2954](https://bigsoundbank.com/UPLOAD/mp3/2954.mp3) | 2.40–3.10 s |
| `public/sfx/chien-3.mp3` | [0916](https://bigsoundbank.com/UPLOAD/mp3/0916.mp3) | 3.75–4.55 s |
| `public/sfx/chat-1.mp3` | [1889](https://bigsoundbank.com/UPLOAD/mp3/1889.mp3) | 1.20–2.65 s |
| `public/sfx/chat-2.mp3` | [1890](https://bigsoundbank.com/UPLOAD/mp3/1890.mp3) | 0.75–2.05 s |
| `public/sfx/chat-3.mp3` | [0494](https://bigsoundbank.com/UPLOAD/mp3/0494.mp3) | 0.00–0.50 s |
| `public/sfx/canard-1.mp3` | [0276](https://bigsoundbank.com/UPLOAD/mp3/0276.mp3) | 0.25–2.20 s |
| `public/sfx/canard-2.mp3` | [0276](https://bigsoundbank.com/UPLOAD/mp3/0276.mp3) | 5.30–6.35 s |
| `public/sfx/canard-3.mp3` | [0276](https://bigsoundbank.com/UPLOAD/mp3/0276.mp3) | 17.80–20.80 s |
| `public/sfx/bourdon-1.mp3` | [1000](https://bigsoundbank.com/UPLOAD/mp3/1000.mp3) | 1.50–4.50 s |
