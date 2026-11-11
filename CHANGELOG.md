# Evolia — journal des nouveautés

Chaque version, la plus récente en haut. Le site (evolia.sebastienalzamora.workers.dev) est toujours à jour ;
le Play Store (tests internes) reçoit les versions indiquées « Play ».

## 0.7.49 — 12 novembre 2026
L'économie façon jeu incrémental (nouvelles parties ; réglée avec le simulateur docs/equilibre-evolia.html) :
- **Six habitats en échelle** : massif mellifère, ruche, hôtel à insectes, nichoir, mare, haie. Chacun coûte environ cinq fois le précédent et produit environ cinq fois plus ; chaque exemplaire coûte 15 % de plus ; l'hôtel demande une ruche, le nichoir un hôtel, etc.
- **Améliorations** : à 1, 5, 25 et 50 exemplaires, une amélioration double la production de l'habitat (5, 25, 250, 2 500 fois son prix de base).
- **Les habitats travaillent pendant l'élan** d'une sortie (7 minutes d'élan par minute de marche, 8 h au plus), à 5 % au repos, appli fermée comprise. Il leur faut des plantes autour (deux par habitat), et chaque espèce découverte ajoute 1 % à la production. La part des ruches devient du miel.
- **Chaque km vaut 60 nectar plus 4 heures de la production du jardin** : le pas grandit avec le jardin. Cible : 60 % d'activité, 40 % d'idle pour un joueur moyen.
- Parcelles : 600 nectar, puis × 2,3.
- Fiches : bouton Fermer en bas (plus de petite croix) ; bulle du tutoriel qui le montre.

## 0.7.48 — 11 novembre 2026
La refonte de la progression, d'après le message vocal de Seb (détail : docs/refonte-progression.md).
- **Un nouveau départ** : une partie neuve s'ouvre sur une minuscule motte de terre. Un oiseau y laisse tomber une graine, quelques pas la font fleurir, une abeille vient la butiner, puis le logo apparaît : « À chacun de tes pas, la nature s’éveille. »
- **Un tutoriel qui se fait** : une consigne à la fois. On ouvre les espèces, on lit la fiche de l'abeille (100 nectar, la première monnaie), le nectar arrive dans la bourse, on pose sa première ruche, on voit l'icône d'activité passer à la marche. Un bouton permet de passer l'introduction.
- **Un bandeau discret** : en haut, seulement une icône d'activité (au repos, marche, course, vélo), cerclée de l'avancée du jour, et la bourse. Le détail (kilomètres, objectif, milieux) s'ouvre en touchant l'icône. L'interface se dévoile au fil du jeu (Aménager, carnet, défis du jour, écosystème).
- **La ruche dès le départ** (100 nectar) : 6 abeilles au plus, autant que les fleurs en attirent ; leur miel va au panier et se troque contre du nectar. La part de miel prise est réglable.
- **Des espèces au compte-gouttes** : 6 le premier jour, 4, 3, puis 2 par jour. La cabane et le fermier arrivent quand la nature est installée (8 nouvelles espèces, 3 arbustes, un arbre). L'objectif du jour rapporte du nectar.
- **Un terrain qu'on agrandit** : il commence petit et s'agrandit en nectar, un cran à la fois, de plus en plus cher. Une fois plein, on explore une parcelle voisine de son choix (« Terre inconnue ») en nectar et en kilomètres. Chaque partie a son propre monde (mare, forêts, montagne, côte), qu'on découvre en l'explorant.
- **La ferme produit** : œufs, légumes, fruits et miel vont dans le panier et se troquent contre du nectar. Le compost booste le potager, et on peut soigner un arbre fruitier pour qu'il donne plus.
- Les parties déjà commencées gardent leur jardin entier et toute leur interface.
- Introduction (retours de Seb) : une seule fleur sur sa tige (l'abeille se pose bien dessus), rien ne pousse d'autre pendant l'introduction, logo détouré, phrase « À chacun de tes pas, la nature s’éveille. » centrée.
- Plus de nectar déposé en gouttes sur les fleurs (nouvelles parties) : le nectar de la marche va droit dans la bourse ; les abeilles rapportent le leur à la ruche, en miel.
- Les abeilles : une seule au départ, une de plus par trois fleurs écloses. Une ruche en accueille 3 ; on l'améliore (3 de plus par niveau, de plus en plus cher) ou on en pose une autre.
- Quand une abeille se pose sur une fleur : une petite onde dorée et quelques grains de pollen, tout doux. Dans l'introduction, on la voit de près rentrer dans la ruche.
- Introduction : plus de bouton pour la passer (elle reprend où l'on s'était arrêté), toujours de jour, sans moucherons, vue plus rapprochée, passage en fondu du papier à la brume.
- La fleur de l’introduction est la même pour tous : un coquelicot, toujours dessiné pareil.
- Les feuilles des fleurs alternent toujours à gauche et à droite de la tige (elles se retrouvaient parfois toutes du même côté).
- **Les fiches des espèces ont une vraie photo**, passée au filtre aquarelle, dans le rond de la fiche ; le dessin du jeu reste en médaillon sur son bord. 311 espèces sur 319, photos d’iNaturalist sous CC0 ou CC BY, choisies une à une (un sujet net, pas un tas), crédit sous la photo et dans CREDITS-IMAGES.md. 3,2 Mo en tout, chargées seulement quand on ouvre une fiche.
- Correctif important : les parties commencées avant la 0.7.48 recevaient l’introduction au chargement (et la finir réduisait leur première parcelle) ; elles sont réparées.
- Au lancement, le logo passe sur le jardin, sans interface ; l’interface n’apparaît qu’après. Pas de logo au lancement d’une nouvelle partie (l’introduction le présente).
- Le suivi des pas est obligatoire dans l’introduction ; ensuite, une alerte reste affichée tant qu’il est coupé.
- Ruche en bois (trois hausses, toit, pieds) ; logo net ; plus de carte des milieux fixes (on voit son propre monde de loin).
- La page Espèces, au début : seulement ce qu'on a découvert, en plantes et insectes, avec une icône.
- Fonds et boutons à demi transparents ; la consigne du tutoriel passe en vert sombre sur les pages claires, et une page ouverte s’arrête au-dessus d’elle (elle ne cache plus le texte).
- Moins de moucherons, et jamais en nuée serrée.

## 0.7.48 (suite) — 11 novembre 2026
Les bêtes regardent enfin là où elles vont (retour de Seb : papillons et oiseaux qui volaient « en crabe ») :
- **Le corps suit la vitesse** : les bêtes vues de dessus (papillons, papillons de nuit, libellules, syrphes, bombyles, chauves-souris, hirondelles, rapaces, goélands, coléoptères, coccinelles, punaises, lézards, serpents, araignées) tournent vers leur trajectoire avec un léger retard, et leurs ailes se resserrent dans les virages. Le papillon avait la tête toujours tournée vers le haut de l'écran.
- **De profil** (abeilles, oiseaux, mésanges, sauterelles) : le nez monte ou pique selon qu'elles montent ou descendent, et un demi-tour prend quelques images au lieu de retourner le dessin d'un coup.
- **Du vol avec de l'élan** : les bêtes tournent en courbe au lieu de virages à angle droit, freinent en arrivant sur une fleur ou une branche, et chacune a sa propre allure (± 15 %).
- **Des intentions lisibles** : l'abeille chargée rentre droit et plus vite à la ruche ; un papillon posé s'envole vers le haut quand le jardinier, le chien ou le chat passe tout près ; les oiseaux au sol s'envolent vers un arbre, et leurs voisins suivent en cascade, chacun avec son temps de réaction.

## 0.7.47 — 8 novembre 2026 · Play
Bug remonté par les testeurs (catalogue, n° 11) :
- Le panneau de débogage recouvrait encore la page Options (il passait seulement sous les fenêtres) : il se masque maintenant tant qu'une page est ouverte, et revient au jardin.

## 0.7.46 — 8 novembre 2026 · Play
Bugs remontés par les testeurs (catalogue, n° 9 et 10) :
- **Options plantait sur Android** (« C.registerPlugin is not a function ») : le cœur de Capacitor n'était pas embarqué dans l'appli. Il l'est maintenant (`vendor/capacitor.js`, ajouté par `copy-web.mjs`).
- **Les pas appli fermée n'étaient jamais relus sur Android**, pour la même raison : Health Connect et le podomètre étaient injoignables depuis le jeu. La relecture devrait enfin marcher (à vérifier sur un téléphone).
- **Les rappels** (collecteur plein, cadeau, série, pas non relus) passent aussi par ce module.
- Si un module natif manque malgré tout, le jeu fait comme s'il n'existait pas, au lieu de planter.
- Le panneau de débogage ne recouvre plus les pages (Options, Espèces…).

## 0.7.45 — 8 novembre 2026
- La fenêtre « Signaler un bug ou une idée » et celle de nouvelle version viennent du kit commun du studio, avec le même aspect sombre dans tous les jeux.

## 0.7.44 — 8 novembre 2026 · Play
- **Signaler un bug ou une idée** : touche l'écran avec trois doigts, ou Options › « Signaler un bug ou une idée ». Une capture du jardin (tu peux dessiner dessus pour montrer l'endroit), ce que tu as vu ou ce que tu voudrais, et c'est envoyé à l'équipe.

## 0.7.43 — 8 novembre 2026 · Play
- **Options** : si son contenu n'arrive pas à s'afficher (signalé sur Android), la page s'ouvre quand même, avec le message d'erreur à nous envoyer et l'interrupteur de débogage.
- L'astuce « Ta bourse de nectar » et celle de l'écosystème affichaient `${…}` au lieu du chiffre : corrigé.

## 0.7.42 — 7 novembre 2026 · Play
Retours de deux testeurs :
- **Les espèces arrivent une à une.** Une nouvelle espèce au plus toutes les 30 secondes, et plus aucune tant que 4 fiches attendent d'être lues (les espèces du tout début ne comptent pas). L'objectif du bas dit alors « Lis 2 fiches d'espèces : de nouvelles espèces attendent (+10 nectar chacune) », et le toucher ouvre la première ; un message le rappelle au plus tous les quarts d'heure.
- **Les pas appli fermée : on redemande.** Tant que rien ne relit les pas, l'appli le repropose à chaque lancement (« Plus tard » ne vaut que quelques heures). Sans Health Connect ni podomètre, elle explique quoi installer, avec un bouton vers Health Connect. Sur le site, un message du jour rappelle que seuls les pas faits Evolia ouverte comptent.
- **Rappel** : en quittant l'appli sans rien de branché, une notification une demi-heure après (une fois par jour au plus, si les rappels sont activés).

## 0.7.41 — 7 novembre 2026
Idées du GDD du catalogue, partie Evolia :
- **Zoom à une main** : touche deux fois, et garde le doigt posé ; glisse vers le bas pour zoomer, vers le haut pour dézoomer.
- **Le banc sert enfin** : dans sa bulle, « S'asseoir » rapproche la vue, efface les boutons, et les bêtes alentour chantent plus souvent pendant 40 s.
- **Le jardinier parle** : une petite bulle au-dessus de sa tête quand il a ramassé les œufs (« Trois œufs de plus ! ») ou récolté le potager.
- **Musique et sorties** : la musique se tait pendant une sortie suivie en direct, les sons de la nature restent ; Options › Musique › « Aussi pendant mes sorties » pour la garder.
- **Textes justes** : le nectar des pas est annoncé « environ 200 par km en marchant, davantage en courant », et l'élan avec son vrai multiplicateur (il suit les réglages du GDD) ; « réserve pleine : un collecteur de plus gardera tout », sans reproche ; le rappel de série dit « pour la faire grandir » ; la fiche de la vipère dit « appelle vite les secours » (le 15 n'existe qu'en France).
- Dans l'appli, le tutoriel dit qu'on peut ranger son téléphone : les pas seront relus au retour.
- Fiche Play et README : 331 espèces, effort d'après l'énergie dépensée, rien ne pousse au-delà de 35 km/h, milieux dans un seul jardin.

## 0.7.40 — 7 novembre 2026
- Les messages d'une même sortie sont regroupés et restent le temps de les lire ; les Options sont rangées en deux groupes, Jardin et Technique ; un seul format pour les nombres.

## 0.7.39 — 2 novembre 2026
- **La carte a ses filtres.** Quand tu dézoomes, une barre apparaît pour choisir ce que tu veux voir ; le jeu garde ton choix :
  - **✨ Nouveautés** : les espèces dont tu n'as pas encore lu la fiche. Touche la pastille pour zoomer, puis le message pour ouvrir la fiche (+10 nectar).
  - **🍯 Récoltes** : collecteurs, gouttes, œufs et potager, comme avant.
  - **🌳 Croissance** : les arbres et arbustes qui poussent, avec leur pourcentage.
  - **📍 À venir** : ce qu'il reste à parcourir pour le prochain décor de chaque milieu.
- Les pastilles passent au-dessus des noms de parcelles, et celles qui se touchent se regroupent pour rester lisibles.

## 0.7.38 — 2 novembre 2026
- **La caméra ne part plus pendant que tu joues.** Chaque geste (toucher, glisser, zoomer, bouton) remet à zéro un minuteur : elle ne peut repartir d'elle-même qu'après 20 secondes sans rien faire, et jamais tant qu'une fiche, une fenêtre ou une page est ouverte, ni quand tu regardes la carte de loin.
- **Elle ne suit plus l'herbe ni les fleurs**, seulement les arbustes, les arbres et les jeunes pousses semées par les bêtes.
- **Un nouveau décor** n'emmène plus la vue si tu es occupé : touche son message pour aller le voir. Les astuces ne déplacent plus la caméra non plus pendant que tu agis.
- Quand tes pas sont relus à l'ouverture, la caméra montre toujours le jardin qui pousse, jusqu'à ton premier geste.

## 0.7.37 — 2 novembre 2026
- **De vrais cris d'animaux.** Les sons fabriqués sonnaient faux : merle, rouge-gorge, fauvette, rossignol, hirondelles, chouettes hulotte et effraie, corneille, grenouilles, crapauds, grillons, sauterelles, poules, coq, chien, chat, canard et bourdon sont maintenant de vrais enregistrements (42 cris, 750 Ko, de Joseph Sardin sur BigSoundBank, domaine public). Les cousins proches empruntent la voix d'un autre, plus aiguë ou plus grave (la chevêche et le grand-duc celle de la hulotte, la pie et le geai celle de la corneille, la rainette celle de la grenouille…), et les petits passereaux un vrai chant de cousin à leur hauteur. Chaque cri est joué un peu différemment à chaque fois (variante, hauteur, volume) pour ne pas se répéter, et six bêtes au plus chantent ensemble.
- Les oiseaux lointains du jour et les grillons de la nuit sont eux aussi de vrais enregistrements, très bas.
- Le pic, la mésange, les rapaces, le goéland, le héron et le sanglier gardent leur voix fabriquée en attendant un bon enregistrement libre.
- Crédit dans Options › Sons de la nature.

## 0.7.36 — 2 novembre 2026
- **Les animaux autour de toi se font entendre.** Jusqu'ici, seules 15 espèces avaient un cri ; maintenant chaque oiseau visible a son petit chant à lui (hauteur, notes et rythme propres à son espèce), les rapaces crient (la crécerelle fait « kli-kli-kli »), les hirondelles gazouillent, grenouilles et crapauds coassent, criquets et grillons stridulent, le sanglier grogne, les poules gloussent, le coq chante quand il chante, le chien aboie et le chat miaule (rarement). Les chauves-souris restent muettes : leurs cris sont trop aigus pour nos oreilles. Plus on zoome, plus on les entend souvent et fort.
- **La pastille 🥚 revient** en vue dézoomée, comme celle du potager ; la toucher amène sur le poulailler et rappelle que le jardinier viendra chercher les œufs. Ils ne sont plus détaillés dans la bulle du poulailler.

## 0.7.35 — 1er novembre 2026
- **Replanter un arbre ou un arbuste adulte.** Sa fiche (touche-le) propose « Déplacer » : on le fait glisser comme un aménagement, la place s'affiche en vert si elle est libre (dans une clairière, hors de l'eau et des chemins, loin des objets et des autres arbres), et on le pose. Il peut changer de parcelle.
- En le reposant, il s'écrase un peu puis se redresse en rebondissant, et perd quelques feuilles qui tombent en virevoltant.

## 0.7.34 — 1er novembre 2026
- **Vu de très loin, les aménagements gardent leur vraie image** (cabane, poulailler, ruche, mare…) au lieu de simples rectangles : on reconnaît son jardin et on s'y repère.
- La pastille des œufs disparaît (elle prêtait à confusion) : le nombre d'œufs, leur valeur et le passage du jardinier sont dans la bulle du poulailler.

## 0.7.33 — 1er novembre 2026
- **Un œuf vaut 15 nectar** (au lieu de 8) : le poulailler rapporte enfin de quoi valoir son prix.
- **On sait qui ramasse les œufs.** Toucher la pastille 🥚 (vue dézoomée) l'explique : « 9 œufs : le fermier viendra les chercher (+135 nectar) ». La bulle du poulailler le dit aussi.

## 0.7.32 — 1er novembre 2026
- **Des bulles plus compactes** quand on touche un aménagement. Elles ne gardent que la première phrase de la description (le texte complet reste dans Aménager) ; le poulailler, la cabane et le collecteur montrent seulement leur état. L'astuce de l'appui long n'apparaît plus que les trois premières fois. Sur un iPhone, la bulle du poulailler passe de 308 à 165 px de haut, celle de la cabane de 224 à 153.
- **Le poulailler** se règle sur une seule ligne : « Poules − 3 + · Coqs − 1 + », et la bulle reste ouverte pour ajouter plusieurs bêtes d'affilée.

## 0.7.31 — 1er novembre 2026
- **Lire une fiche rapporte du nectar.** La première fois qu'on ouvre la fiche d'une espèce découverte, on gagne +10 nectar, tout de suite dans la bourse. L'étiquette des espèces pas encore lues l'annonce (« Nouveau · +10 »), et la fiche le confirme.

## 0.7.30 — 1er novembre 2026
- **Le nectar d'une sortie suit l'effort.** Un kilomètre de marche à 5 km/h rapporte toujours 200 nectar ; un kilomètre de course à 10 km/h en rapporte maintenant environ 420 (une heure de course ≈ 4 200, contre 1 000 pour une heure de marche), et la montée compte aussi. Les pas relus à la réouverture suivent la même règle. Le vélo garde sa part réduite (comme pour la progression).
- **Le plafond de l'écosystème suit l'effort** des 7 derniers jours, compté en kilomètres de marche équivalents : une semaine sportive laisse l'écosystème produire bien plus qu'une semaine de petites marches. Le sport reste le moteur du jeu, même quand l'écosystème tourne à plein.

## 0.7.29 — 1er novembre 2026
- **Un effort juste, d'après l'énergie dépensée.** Chaque allure a son intensité en METs, tirée du Compendium des activités physiques (marche, course, vélo) ; l'effort compté est l'énergie dépensée au-delà du repos, et les sports intenses gagnent un bonus de 5 % par MET au-delà de 4. Un kilomètre de marche à 5 km/h vaut toujours autant.
- Ce que ça change, par heure : marche lente +40 % (elle était sous-payée), marche et marche rapide presque pareil, jogging +24 %, course +10 %, course rapide −10 %, sprint −29 % (il était surpayé), vélo −9 %, petits pas à la maison ×2 (ils étaient très sous-payés). La montée garde sa règle (1 m gravi ≈ 8 à 10 m de plat, comme l'équivalence de Scarf).

## 0.7.28 — 1er novembre 2026
- **Vu de loin, ce qui t'attend.** Quand tu dézoomes, des pastilles flottent au-dessus de ce qui mérite qu'on y aille : collecteur avec du nectar (orange quand il est plein), poulailler avec des œufs, potager mûr, gouttes de nectar à cueillir (par parcelle). Touche une pastille : la vue zoome dessus. Quand plusieurs se chevauchent, elles se regroupent (« 3 à voir ») et la vue se rapproche.

## 0.7.27 — 1er novembre 2026 · Play
D'après une trace de course sur iPhone :
- **Plus de « vélo » fantôme.** Quand la précision du GPS change d'un coup, la position saute de plusieurs mètres en une seconde ; ce saut n'est plus pris pour un déplacement à 24 km/h. Et tant que le téléphone sent des pas, on est à pied : jamais classé vélo.
- La trace note aussi les pas comptés par le téléphone quand le GPS a la priorité.

## 0.7.26 — 1er novembre 2026
- La trace indique l'état du suivi au départ **et à l'arrêt** (par exemple « Accéléromètre : éteint → actif à l'arrêt ») : il change souvent entre les deux.
- Vérifié sur iPhone avec une trace : le compteur de pas du téléphone est actif et compte la marche ; un petit écart de GPS à l'arrêt n'est plus pris pour de la marche.

## 0.7.25 — 1er novembre 2026
Corrections trouvées grâce à une trace prise sur iPhone (site web).
- **Le compteur de pas du téléphone s'active enfin sur iPhone.** Safari n'accepte la demande d'accès au capteur de mouvement qu'au moment où le doigt se relève ; le jeu la faisait quand il touchait l'écran, et elle était refusée sans rien dire : aucun pas n'était compté par le capteur. Elle se fait maintenant au bon moment, et Options propose « Activer le compteur de pas du téléphone » s'il est encore éteint.
- **Plus de fausse marche au retour de l'écran.** Après une pause du GPS (écran éteint), le jeu reprenait l'ancienne vitesse et comptait un petit écart de position comme de la marche (et lançait une balade). La vitesse repart maintenant de la mesure, et quand le signal est imprécis, un écart doit être plus grand pour compter.

## 0.7.24 — 1er novembre 2026
- **Trace à la demande** (panneau de débogage) : « ● Trace » démarre un enregistrement détaillé, « ■ Arrêter la trace » le termine, « Copier la trace » met tout en texte à coller dans un message. Chaque ligne a l'heure (en secondes depuis le début) : chaque point GPS (position, précision, altitude, vitesse, âge), chaque paquet de pas de l'accéléromètre (cadence, retenu ou non), chaque mesure et la décision du jeu (activité, mètres comptés), l'écran caché ou visible, le début et la fin des balades. La trace est gardée sur le téléphone même si l'appli se ferme, jusqu'à 4 000 lignes.

## 0.7.23 — 1er novembre 2026
- **Panneau de débogage** (Options › Débogage) : en jeu, ce que voit le suivi en direct. Appareil (site ou appli, iPhone ou Android, suivi activé, écran visible, images par seconde) ; GPS (état, âge et précision du dernier point, vitesse, altitude, montée et descente des 10 dernières minutes) ; pas de l'accéléromètre (pas comptés, cadence) ; balade en cours (durée, distance, pas, activité reconnue, fin automatique) ; relecture des pas appli fermée ; totaux du jour.
- **Un journal des événements**, gardé d'une ouverture à l'autre : écran éteint ou autre appli (et combien de temps), GPS perdu ou faible, trous de GPS, balades commencées et finies, relectures et leurs erreurs.
- **« Copier »** met tout le panneau et le journal en texte dans le presse-papiers, à coller dans un message ; si le téléphone refuse, le texte s'ouvre tout sélectionné.

## 0.7.22 — 1er novembre 2026
- **Plusieurs sauvegardes** (Options › Mes sauvegardes) : plusieurs jardins sur le même téléphone, pour comparer ou essayer. Chaque partie montre ses kilomètres et ses espèces ; on passe de l'une à l'autre d'un geste (« Jouer »), on duplique la partie en cours, on commence une nouvelle partie, on renomme ou on efface les autres. Ta partie actuelle devient « Ma partie », sans rien perdre. Les pas vont dans la partie en cours.

## 0.7.21 — 1er novembre 2026
- **Randonnée et trail**, reconnus grâce au dénivelé pendant une sortie suivie au GPS. À allure de marche, dès qu'on a monté 25 m en dix minutes (ou sur une pente moyenne de 6 %), c'est une **randonnée** ; à allure de course, un **trail**. Ils continuent dans les descentes et les courts replats, tant que ça monte ou que ça descend encore. La randonnée compte plus d'effort que la marche, le trail plus que la course, et tous deux font pousser des arbres.
- Le bilan s'appelle « Belle randonnée ! » ou « Quel trail ! » quand la sortie s'est faite surtout en montée et en descente, avec les mètres de montée.
- Avant, une montée faisait passer une marche pour du jogging : la pente était comptée comme de la vitesse.

## 0.7.20 — 1er novembre 2026 · Play
- **Un seul jardinier, qui fait sa tournée.** Avec plusieurs cabanes, ton fermier ou ta fermière va de l'une à l'autre : après chaque pause, il part parfois vers une autre cabane et s'occupe d'abord des potagers et du poulailler qui l'entourent ; le soir, il dort dans la plus proche. Le chien ou le chat le suit, et la fumée sort de la cabane où il se trouve.
- **Les personnages de face et de dos.** Quand le jardinier, la jardinière, le chien, le chat, les poules ou le coq marchent vers le bas ou le haut de l'écran, on les voit de face (visage, tablier ou salopette, museau) ou de dos (natte, bretelles croisées, queue qui remue) au lieu de profil.
- **Spritesheets** : une page `sprites.html` génère pour chaque personnage une feuille de 4 directions × 9 images (repos et 8 images de marche), à télécharger et repeindre. Posée dans `img/sprites/` et déclarée dans `index.json`, une feuille repeinte remplace le dessin du jeu pour la marche et le repos.
- Le collecteur s'améliore aussi depuis Aménager, comme les autres aménagements.

## 0.7.19 — 1er novembre 2026
- **La page Espèces s'ouvre tout de suite.** Elle peignait d'un coup toutes les vignettes du milieu (près de 190 pour la prairie) avant de s'afficher ; maintenant, seules celles qui arrivent à l'écran se peignent, quelques-unes par image, au fil du défilement.
- **Des sous-catégories** dans chaque milieu : Tout, Plantes, Insectes (et petites bêtes : araignées, escargots, vers…) et Animaux, avec leur nombre. La vue Tout est rangée en sections, chacune avec ses découvertes.

## 0.7.18 — 1er novembre 2026 · Play
- **Le jardinier et la jardinière marchent pour de vrai.** Le pas fait la longueur d'une vraie enjambée ; le talon attaque le sol, la pointe pousse à la fin de l'appui, le genou plie au passage de la jambe ; le bassin descend quand les deux pieds touchent terre et remonte au milieu du pas ; les bras balancent à l'opposé des jambes. Avant, ils piétinaient à petits pas raides.
- **L'allure change l'amplitude** : en promenade ou chargés, les pas et le balancement des bras raccourcissent ; pressés de rentrer le soir, ils s'allongent et le buste se penche. Le changement se fait en douceur, et la cadence suit toujours la longueur du pas (les pieds ne glissent plus).
- Ils marchent aussi un peu plus vite.

## 0.7.17 — 1er novembre 2026
- **Un poulailler** (Aménager › Récolte, dès 7 km, une fois la cabane posée) : un coq et trois poules picorent autour, grattent la terre, courent gober un criquet ou un carabe, et rentrent dormir à la nuit tombée ou sous la pluie. Le coq chante le matin.
- **Agrandis-le** : petit poulailler (4 places), poulailler (6, dès 12 km), grand poulailler (8, dès 25 km, avec un pondoir accolé). Il s'élargit à chaque niveau.
- **Choisis tes bêtes** : touche le poulailler pour ajouter une poule ou un coq (40 nectar) tant qu'il reste de la place, ou en retirer un.
- **Des œufs à récolter** : chaque poule pond en marchant (un et demi par kilomètre). Quand il y en a assez, ton jardinier va les ramasser et les rapporte dans son panier : 8 nectar l'œuf.
- **Le chat chasse** : quand un papillon, un criquet ou un carabe passe près de lui, il le traque à pas lents, s'arrête, repart… puis bondit. La proie s'échappe presque toujours (le papillon remonte, le criquet saute), et il reste à la regarder filer.

## 0.7.16 — 1er novembre 2026
- **Les oiseaux qui planent ne suivent plus le zoom.** Leur cercle était calé sur l'écran : en zoomant, ils se déplaçaient avec la vue, et tous tournaient autour du même point, à la même vitesse, comme liés. Chacun a maintenant son propre cercle, fixé dans le jardin et qui dérive lentement avec le vent, son rayon, sa vitesse et son sens.
- Zoomer ou dézoomer ne fait plus apparaître ou partir les grands animaux, les rapaces et les hirondelles.

## 0.7.15 — 1er novembre 2026
- **Le jardinier et la jardinière marchent enfin bien :** le genou plie vers l'avant (il pliait à l'envers).
- **Le râteau :** la traverse et ses dents sont fixées au bout du manche, posées au sol, et les deux mains serrent vraiment le manche en ratissant.
- **Les pattes des quadrupèdes** (chien, chat, renard, chevreuil, cerf, sanglier, blaireau…) : le poignet de devant et le jarret de derrière sont bas, comme chez les vrais animaux, au lieu d'un « genou » à mi-hauteur.
- **Hirondelles et martinets :** un vrai dessin (ailes en faux, queue fourchue, gorge rousse), plus petits, tournés dans le sens du vol, et un vol vif et brisé à la poursuite des moucherons au lieu de tourner en rond.
- **Les rapaces** (aigle, buse, milan, busard, crécerelle) : une vraie silhouette vue de dessous, avec les plumes écartées comme des doigts au bout des ailes, la queue fourchue du milan, longue du busard, et les ailes pointues du faucon ; ils se tournent dans le sens où ils planent.

## 0.7.14 — 1er novembre 2026
**179 nouvelles espèces d'animaux**, choisies dans un guide naturaliste des prairies d'Europe (Europe de l'Ouest et du centre), chacune vérifiée absente du jeu avant d'être ajoutée. 331 espèces en tout.
- **Prairie :** 21 papillons de jour (machaon, vulcain, belle-dame, demi-deuil, myrtil, tabac d'Espagne…), 13 papillons de nuit et zygènes (moro-sphinx, sphinx tête-de-mort, écaille martre…), grillons, criquets et sauterelles, 13 abeilles sauvages, bourdons et guêpes (xylocope, osmies, frelon…), coléoptères (cétoine dorée, carabe doré, hanneton…), punaises, araignées (épeire fasciée, thomise…), escargots et limace, campagnol, mulot, musaraigne, belette, fouine, cinq chauves-souris, 25 oiseaux (alouette, chardonneret, rougegorge, huppe, hirondelle, crécerelle, buse, effraie, chevêche…), orvet, coronelle, vipère aspic et lézard des souches.
- **Marais :** demoiselles et libellules (agrions, anax, aeschne…), papillons des zones humides, criquets, araignées d'eau, putois et loutre, vanneau, bécassine, busard, aigrette, cigogne, hibou des marais, couleuvre à collier, rainette, crapauds, alyte, sonneur et triton crêté.
- **Forêt et montagne :** cerf, daim, martre ; hermine, lézard vivipare, vipère péliade, dectique et criquet des genévriers.
- **Nouveaux dessins :** petits rongeurs, mustélidés, serpents, cerf et daim ; bourdons, guêpes, punaises, araignées, coléoptères, grenouilles, chouettes, rapaces et échassiers prennent les couleurs de chaque espèce.
- **Un jardin qui vit comme la nature** (règles du guide, pour toutes les espèces) : chaque groupe (butineurs, papillons, criquets, oiseaux, chauves-souris…) a une place limitée à l'écran, et ses espèces se relaient toutes les deux à trois minutes ; un seul grand mammifère à la fois ; la nuit, moins de petites bêtes à la fois. L'hiver, insectes, reptiles, amphibiens et chauves-souris hibernent et les migrateurs sont partis ; papillons et criquets se font rares en fin d'automne ; les insectes ne volent pas par grand vent ni par froid. Les criquets restent posés et ne sautent que de temps en temps, ou quand le jardinier passe.

## 0.7.13 — 1er novembre 2026
Le bestiaire a été relu avec un guide naturaliste des prairies d'Europe.
- **De vrais vers luisants.** La femelle, sans ailes, brille posée au pied des herbes de la prairie : une lueur vert-jaune qui respire lentement ; un mâle plus discret vole parfois autour. Ils ne brillent qu'à la belle saison (plus en automne ni en hiver), et ne flottent plus partout sur l'écran.
- **La nuit, on croise les grands mammifères un par un :** deux espèces au plus à la fois (chevreuil, renard, sanglier, blaireau), qui se relaient au fil de la nuit.
- **Des horaires plus justes :** les chauves-souris, le sphinx et le sanglier sortent dès le crépuscule ; le renard est un animal du soir et de la nuit ; le lapin se montre aussi la nuit ; la grande sauterelle, qui chante le soir, reste visible la nuit.

## 0.7.12 — 1er novembre 2026
- **Les mammifères de la nuit.** Le lièvre, le chevreuil et le renard ne se cachent plus le soir : on les voit de jour comme de nuit.
- **Deux nouveaux venus nocturnes :** le blaireau, qui fouille la prairie (avec le vieux tronc et dix herbes folles), et le sanglier, qui retourne la terre de la forêt. Ils ne sortent que la nuit. 152 espèces en tout.

## 0.7.11 — 1er novembre 2026
- **La nuit, le jardin vit.** Avant, seuls quatre animaux sortaient la nuit, et seulement une fois découverts : un jardin neuf restait désert. Maintenant, des petits papillons de nuit tournent autour des lanternes et de la fenêtre de la cabane, et volettent au-dessus des fleurs, dès la première nuit.
- **Quatre nouvelles espèces de nuit :** la pipistrelle commune (une chauve-souris qui file d'une nuée d'insectes à l'autre et en attrape au passage) et le sphinx du liseron (un grand papillon de nuit qui butine en vol stationnaire) dans la prairie ; le murin de Daubenton, qui chasse au ras des mares, dans le marais ; le hibou grand-duc, avec ses aigrettes et ses yeux orange, en montagne. 150 espèces en tout.

## 0.7.10 — 1er novembre 2026
- **Correctif important :** le jardin pouvait se figer sur un aplat vert. Il suffisait d'avoir une mare (celle du marais, ou une petite mare posée) sur la gauche du jardin : l'animation de ses ronds dans l'eau plantait. C'est corrigé, et une image ratée ne peut plus jamais figer le jeu.
- **Après une vraie balade** (300 m ou plus), son bilan s'ouvre de lui-même : kilomètres, ce qui a poussé, le nectar gagné et l'élan. Avant, ce n'était qu'un petit message.
- **Un objet ne peut plus en cacher un autre** (la cabane posée juste devant le collecteur le rendait invisible).
- Pendant qu'on pose un objet, le panneau du bas s'efface.
- Un collecteur vide n'affiche plus « +0 ».
- L'écosystème affiche le même total à récolter que le bandeau, et la réserve à côté (il affichait « 180,0 / 180 » quand 1 251 attendaient).
- La nuit est un peu moins sombre : on voit encore son jardin.

## 0.7.9 — 1er novembre 2026 · Play
- **La brume est belle aussi sur iPhone.** Safari (avant iOS 18) ne savait pas flouter le dessin : la lisière y gardait des bords nets. Le flou passe maintenant par une technique qu'il comprend, et la terre des potagers en profite aussi.
- **Un vent léger dans la végétation.** La couronne des arbres balance doucement, le tronc reste planté. Les arbustes frémissent, l'herbe et les fleurs ondulent un peu plus.
- **Le bandeau en paysage :** une carte compacte en haut à gauche, et le cadeau du jour et l'œil réunis en haut à droite, au-dessus du panneau.

## 0.7.8 — 1er novembre 2026
- **Des touffes d'herbe à l'aquarelle :** denses, en éventail, plusieurs verts (brins sombres derrière, clairs devant), une flaque de vert tendre au pied, et des épillets discrets une fois montées en graines.
- **Une cabane comme dessinée à la main.** Les planches sont usées et d'une teinte chaque fois différente, avec leur fil et leurs nœuds, et les contours sont tracés à l'encre. Elle a maintenant une porte à écharpe en Z, du lierre qui grimpe à l'angle, de la mousse et de l'herbe sur le toit, une pierre devant la porte, des pots de fleurs, de l'herbe au pied des murs et une tache de terre autour.
- Tous les objets en volume (banc, mangeoire, nichoir, hôtel à insectes…) ont le même lavis nuancé et le même trait d'encre.

## 0.7.7 — 1er novembre 2026
- **Des arbres repeints à l'aquarelle.**
    - Un tronc qui ondule, avec des racines, une écorce tachetée claire et sombre.
    - Il se divise en branches maîtresses qui portent des bouquets de feuillage.
    - Chaque bouquet est fait de touches qui se chevauchent : un bord déchiqueté, de la lumière en haut à gauche, des masses sombres dessous, et des branches qui se devinent entre les bouquets.
    - Les conifères (épicéa, pin cembro, mélèze) ont des étages en éventail aux pointes d'aiguilles.
- **Un jardin nourricier.**
    - Les arbres fruitiers et les petits fruits poussent bien plus souvent.
    - Les fruits se voient mieux : plus nombreux, plus gros, avec un reflet.
    - Nouvelles espèces : le prunier, le framboisier, le groseillier et le fraisier des bois. Le jardinier cueille aussi les prunes.
- **Le mode paysage.**
    - Le jardin prend toute la largeur, et le panneau du bas devient une colonne à droite.
    - Le bandeau, les boutons et les bulles l'évitent, et la caméra centre ce qu'elle montre dans la partie visible.
    - La carte des milieux et sa fiche s'affichent côte à côte.
    - Les panneaux restent lisibles sur tablette et sur ordinateur, et l'appli tourne avec le téléphone.
- **Petits défauts corrigés :** les bulles ne sautent plus de côté en apparaissant, leurs boutons tiennent sur moins de lignes, et le bouton « Un de plus » ne dépasse plus de la fiche d'un aménagement.

## 0.7.6 — 31 octobre 2026
- **Des rivières peintes comme les mares.** Plus de tuyau régulier : l'eau est faite de lavis qui se chevauchent, avec la même couleur, le même bord sombre et irrégulier que les mares, une largeur qui varie, de l'herbe mouillée sur les berges et quelques reflets. Les ruisseaux du marais sont plus larges, font de vrais méandres et s'évasent en arrivant dans les mares.
- **Des sentiers vivants :** largeur irrégulière, bords flous, terre plus ou moins usée.

## 0.7.5 — 31 octobre 2026
- **Sentiers et ruisseaux qui se fondent dans le terrain.** Leurs bouts ne finissent plus en pointe ni par un bord net : ils pâlissent et s'effacent doucement, avec quelques trous d'usure, et l'herbe pousse par-dessus les sentiers. La source du marais naît de la même façon.

## 0.7.4 — 31 octobre 2026
- **Plus aucun raccord dans le paysage.**
    - Les bas-fonds humides du marais, la mousse de la forêt et la couleur des ombres se fondent d'un milieu à l'autre : ils s'arrêtaient net sur la frontière, ce qui dessinait un trait droit, surtout sous la brume.
    - Toutes les cases du sol à l'écran sont dans la même version (détaillée ou légère) : une case nette à côté d'une floue faisait une ligne.
    - Les ombres des nuages qui passent ne tachent plus le brouillard.
    - Plus de nuage isolé qui flotte sur la prochaine parcelle.

## 0.7.3 — 31 octobre 2026
- **La brume, encore plus douce.** Plus aucun trait net dans le brouillard (ni droit au loin, ni autour de la prochaine parcelle). Les nuages du bord ont des tailles et des écarts variés, se posent sur une bande de brume continue au lieu de flotter seuls, et forment une seule masse. Le brouillard s'épaissit plus vite : on ne voit plus de taches sombres au loin.
- **Plus de vol d'oiseaux** qui traversait l'écran.
- **Plus de pointillés** derrière les abeilles et les syrphes.

## 0.7.2 — 31 octobre 2026
- **Une brume plus belle.** Les nuages de la lisière sont repeints : des volutes blanches, douces, sans contour, avec un dessous bleuté comme de vrais nuages. Elles débordent un peu sur le bord des clairières pour les encadrer, et la brume blanchit en s'éloignant.

## 0.7.1 — 31 octobre 2026
- **Plus de clôture : une lisière de brume.** Le jardin se perd dans un brouillard peint à l'aquarelle : léger au bord des clairières (on devine la campagne dessous), de plus en plus blanc en s'éloignant, avec de gros nuages aux bords doux tout autour. Il recule à chaque nouvelle parcelle.
- **L'effet miniature se règle tout seul :** il est coupé d'office sur un téléphone qui ne sait pas faire le flou, ou qui devient moins fluide avec (moins de 40 images par seconde). Un choix fait dans les options l'emporte toujours.

## 0.7.0 — 31 octobre 2026
- **Tous les milieux dans un seul jardin.**
    - Plus de voyage entre les lieux : à chaque nouvelle parcelle, tu choisis son milieu (prairie, marais, forêt, montagne, littoral) parmi ceux que tu as découverts.
    - La première parcelle d'un milieu est son cœur : les trois mares du marais, les vieux arbres de la forêt… Les suivantes prennent ses coins (roselière, hêtraie, alpage fleuri…).
    - D'une parcelle à l'autre, le sol et le relief se fondent doucement : pas de frontière nette entre le sable et la prairie.
    - Le jardin compte maintenant jusqu'à 24 parcelles.
    - Les animaux vivent dans les parcelles de leur milieu ; tes équipes travaillent pour tout le jardin.
    - Les parties en cours sont converties : chaque lieu devient une suite de parcelles, avec ses plantes et ses objets.
    - En haut de l'écran, le nom de la parcelle que tu regardes ; touche-le pour la carte des milieux.
- **Aménagements par milieu :** un objet ne se pose que dans une parcelle où il a sa place, et plus jamais dans une mare.
- **De l'eau vivante.** Les ruisseaux du marais relient vraiment les mares, le courant y glisse, et des reflets et des ronds dans l'eau animent les mares.
- **Le collecteur range les gouttes :** dès qu'il a de la place (vidé, amélioré ou tout juste posé), les gouttes qui attendaient sur les fleurs y coulent.
- **Effet miniature :** le haut et le bas de l'écran légèrement flous (tilt shift), et un léger vignettage. Désactivable dans les options.
- **Économie d'énergie :** une option limite le jeu à 30 images par seconde, pour un téléphone qui chauffe moins.
- **Fiches d'espèces :** les grands animaux (chamois, bouquetin, aigle…) ne sont plus coupés.

## 0.6.39 — 31 octobre 2026
- **Chaque collecteur a sa propre réserve.** Il se remplit du nectar des fleurs qui l'entourent : posé au milieu des fleurs, il se remplit plus vite qu'un autre à l'écart. En toucher un ne vide que celui-là.
- **Des bulles toujours entières.** Celle d'un objet (la cabane, avec tous ses boutons) reste entre le bandeau du haut et le panneau du bas, et se décale près des bords au lieu d'être coupée. Les fenêtres évitent l'encoche et la barre du téléphone.
- **Des aménagements propres à chaque milieu.** « Aménager » ne propose que ce qui a sa place dans le lieu où l'on est : pas de ruche dans le marais, pas d'épouvantail sur la dune. La prairie garde tout.

## 0.6.38 — 31 octobre 2026
- **Un fermier, une fermière plus vrais.**
    - Des proportions humaines, des bottes, une chemise aux manches retroussées, des mains, un vrai profil (nez, oreille, barbe ou natte) et un tablier pour la fermière.
    - Une marche plus naturelle : les genoux plient vers l'avant, le corps balance, les pieds ne glissent plus.
- **Des moments pour soi**, entre deux travaux :
    - s'asseoir sur un banc (les jambes se balancent) ;
    - cueillir des fruits dans les pommiers, poiriers et merisiers, sur la pointe des pieds, et rapporter le panier plein à la cabane ;
    - souffler un peu en contemplant le jardin, les mains dans le dos ;
    - se promener avec son animal : le chien en laisse, le chat sur les talons.

## 0.6.37 — 31 octobre 2026 · Play
- **On construit pour de vrai.** Un objet posé ou amélioré se monte sous nos yeux. La poussière se soulève, la silhouette de l'objet apparaît en transparence, puis il monte du sol au rythme de trois coups de marteau. Un petit rebond, des étincelles et des feuilles, et une cloche terminent le chantier.
- **Des gouttes de nectar bien séparées.** Elles ne se posent plus les unes sur les autres, et chacune affiche ce qu'elle rapporte (« +52 »).

## 0.6.36 — 31 octobre 2026
- **Le guide commence par la bourse de nectar**, dès l'arrivée, puis présente les espèces.
- **Une bulle quand le collecteur déborde :** elle propose de l'améliorer (400, puis 1 000 nectar) ou d'en poser un deuxième.
- **Les coins ne se répètent plus :** quand la liste recommence, la parcelle s'appelle par exemple « Le champ de coquelicots, plus loin ».

## 0.6.35 — 31 octobre 2026 · Play
- **Des biomes qui ressemblent à leur nom.**
    - **Forêt :** on y arrive sous de vieux arbres, sur un sol d'humus couvert de feuilles, de fougères et de mousse.
    - **Montagne :** c'est un alpage vert semé de vrais rochers.
    - **Littoral :** un sable blond, avec des touffes d'oyat et des coquillages.
    - **Marais :** trois mares, reliées par une rivière qui descend du nord.
- **Pensé pour ceux qui marchent peu.**
    - Les lieux sont plus proches : marais à 8 km, forêt à 20, montagne à 45, littoral à 80.
    - Les niveaux d'habitats s'ouvrent plus tôt (6, 18, 40 et 80 km), comme la cabane à auvent (10 km) et le chalet (30 km).
    - Même en marchant peu, l'écosystème produit au moins l'équivalent de 1,5 km par jour.
- **Les habitats rapportent enfin.** Chaque niveau d'abri relève de 3 % ce que l'écosystème peut produire, jusqu'à +150 %. La page Écosystème l'affiche.
- **8 nouvelles espèces.**
    - Montagne : lagopède alpin, chocard à bec jaune, bouquetin des Alpes, moiré des Alpes.
    - Littoral : sterne pierregarin, huîtrier pie, lézard vert, souci.
- **Herbier complet :** trouver toutes les espèces d'un lieu rapporte 500 nectar.
- **Garder sa partie :** dans Options, une copie de la partie à garder et à restaurer, même sur un autre téléphone.
- **Rappels** (appli Android, à activer) : collecteur plein, cadeau du jour, série à garder.
- **Petites corrections :**
    - le guide explique la bourse avant l'écosystème, et se cache pendant qu'on pose un objet ;
    - pendant la mission du collecteur, Aménager s'ouvre sur l'onglet Récolte ;
    - les messages et l'étiquette de distance ne passent plus sous le bouton œil ;
    - l'écran ne peut plus remonter d'un coup.

## 0.6.34 — 31 octobre 2026 · Play
- **La récolte devient une cagnotte.** Vider le collecteur fait jaillir un grand « +N » doré. Un flot de gouttes file vers la bourse, chacune tinte un peu plus aigu en arrivant, et le compteur grimpe chiffre après chiffre (jusqu'à 3 s pour une grosse récolte). Une gerbe d'étincelles et un carillon terminent.

## 0.6.33 — 31 octobre 2026
- **La vue reste fixe pendant qu'on aménage.** Tant que la liste Aménager est ouverte ou qu'un objet est en train d'être posé, la caméra ne bouge plus toute seule (suivi d'une plante, guide, découvertes).

## 0.6.32 — 31 octobre 2026 · Play
- **Le collecteur a une capacité.** Le nectar le remplit jusqu'à sa limite ; ce qui n'y tient plus reste au sol, en gouttes dorées sur les fleurs.
- **Haies, murets et allées de pas japonais** se tournent par 45° et se raccordent bout à bout : longues haies, murs, allées.

## 0.6.31 — 31 octobre 2026 · Play
- **Tout le nectar se récolte, même celui des pas.** Il ne tombe plus tout seul dans la bourse : on le cueille sur les fleurs ou dans le collecteur, et rien de ce qu'on gagne en marchant ne se perd.
- **Moins de merles et de lièvres à l'écran** (4 au plus par espèce), et les animaux se touchent plus facilement.
- Le guide se cache derrière les fenêtres ouvertes.

## 0.6.30 — 31 octobre 2026
- **Un guide pas à pas.** Chaque nouveauté s'explique au bon moment, dans une bulle près du bouton concerné, qui s'illumine : bourse, gouttes, collecteur, écosystème, espèces, habitats, cabane, potager, carnet, lieux, défis du jour.
- **Premières missions :** marcher 300 m, cueillir les gouttes, poser un collecteur, le vider.
- Toucher la bourse montre où attend la récolte.

## 0.6.29 — 31 octobre 2026 · Play
- **Un chien ou un chat** à la cabane : le chien suit son maître, le chat flâne et fait la sieste roulé en boule.
- **La cheminée fume** quand le fermier est chez lui ; la cabane n'a plus de trou sous le toit.
- **Chemins, mer et lumière redessinés :** chemins de terre blonde aux pierres plates, mer du bleu profond au turquoise avec écume, lueur chaude du soleil, rayons, heure dorée, brume du matin.

## 0.6.28 — 31 octobre 2026
- **Aménager en trois onglets :** Habitats, Récolte, Décoration.
- **Habitats améliorables** du niveau 1 au niveau 5 : chaque niveau compte comme un abri de plus et se couvre de fleurs sauvages.
- **Nouveaux habitats :** sandarium, haie de bois mort, muret de pierres sèches. **Nouvelles décorations :** pas japonais, épouvantail.
- **Cabane en trois tailles** (petite cabane, cabane à auvent, chalet) et **cinq couleurs** ; **fermier ou fermière** au choix.
- **Bourse de nectar en grand** dans le bandeau, et étiquette « +N » au-dessus du collecteur.

## 0.6.27 — 31 octobre 2026 · Play
- **L'écosystème suit ton activité :** ce que les animaux produisent seuls dépend de ce que tu as marché ces 7 derniers jours. Bouger reste le moteur du jardin.
- **Prix croissants :** chaque exemplaire d'un même objet coûte 1,4 fois le précédent.
- **Lieux plus espacés :** marais à 12 km, forêt à 35 km, montagne à 80 km, littoral à 140 km.

## 0.6.26 — 31 octobre 2026
- **Plantes variées à chaque sortie :** courir ou pédaler fait aussi pousser herbes et fleurs, pas seulement des arbres.
- **Les pas comptés appli fermée** donnent autant d'élan qu'une marche suivie en direct.
- **Missions de départ** et **pistes pour trouver les espèces manquantes.**
- Collecteur redessiné, textes relus et corrigés.

## 0.6.25 — 30 octobre 2026
- **Récolte du nectar à la main,** puis **collecteurs** à poser et à améliorer.
- **Bouton œil** pour admirer le jardin sans l'interface.

## 0.6.24 — 30 octobre 2026 · Play
- La nuit, les lanternes et la fenêtre de la cabane s'allument de nouveau.

## 0.6.23 — 30 octobre 2026 · Play
- **Potager en pleine terre** qui pousse quand on marche ; les carrés se soudent pour l'agrandir.
- Le jardinier rentre se reposer ; **arbres fruitiers** (pommier, poirier) ; oiseaux bien posés sur les arbres ; jardin plus fluide.

## 0.6.22 — 30 octobre 2026 · Play
- **Arbres, arbustes et fleurs repeints à l'aquarelle,** ombres douces, plus de traits au sol ; objectif du jour écrit en toutes lettres.

## 0.6.21 — 30 octobre 2026
- La fenêtre « Pendant ton absence » se ferme toujours ; brume peinte ; sol sans raccords.

## 0.6.20 — 30 octobre 2026 · Play
- **Pelouse continue** et **succession naturelle** (oiseaux et insectes sèment).
- **Le dénivelé compte** dans l'effort.
- **Mammifères animés :** lapin, lièvre, écureuil, chevreuil, chamois, renard.
- **Un jardinier et son potager** à côté de la cabane.

## 0.6.19 — 29 octobre 2026
- Les pas faits appli fermée sont bien comptés au retour.

## 0.6.14 à 0.6.18 — 25 octobre 2026
- Les objets se font glisser au doigt et tournent ; six nouveaux abris.
- Écosystème lisible d'un coup d'œil ; barre du bas légendée.
- **Vélo** reconnu, objectif du jour automatique, **carte du monde,** relief des lieux.
- Ombres des nuages posées sur le monde.

## 0.6.13 et avant — 22 au 24 octobre 2026
- **Evolia devient une appli :** un jardin à l'aquarelle qui pousse quand on bouge.
- **Cinq lieux, 134 espèces,** le vrai ciel (soleil et météo), les saisons.
- **Écosystème :** les animaux découverts travaillent seuls, le sport triple leur travail.
- Clôture qui s'agrandit, retour quotidien (cadeau et défis), suivi automatique des pas, jeu « Trouve… ».
- **Aménager** son jardin : cabane, banc, abris, ruisseaux et sentiers.
- **Sons de la nature** et **musique zen** générative.
- Version Android pour Google Play.
