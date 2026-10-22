// Catalogue de la biodiversité : chaque espèce du jardin, son rôle dans l'écosystème,
// un geste concret pour l'aider, et ce qui la fait apparaître.

// Fleurs, buissons et arbres : la variante d'une plante désigne son espèce.
export const FLOWERS = [
	{ id: 'bourrache', color: '#5B9BD5', shape: 'marguerite' },
	{ id: 'mauve', color: '#EE8FA4', shape: 'marguerite' },
	{ id: 'coquelicot', color: '#EE6A55', shape: 'marguerite' },
	{ id: 'bouton-or', color: '#F4C23E', shape: 'marguerite' },
	{ id: 'geranium', color: '#B48FD8', shape: 'marguerite' },
	{ id: 'campanule', color: '#7F8FE0', shape: 'tulipe' },
	{ id: 'digitale', color: '#D9739A', shape: 'tulipe' },
	{ id: 'tulipe-sauvage', color: '#F4C23E', shape: 'tulipe' },
];
export const BUSHES = [
	{ id: 'eglantier', berry: '#E0603F', legacy: '#EE8FA4' },
	{ id: 'aubepine', berry: '#9E2B25', legacy: '#C0442F' },
	{ id: 'argousier', berry: '#F08A3C', legacy: '#F4C23E' },
	{ id: 'prunellier', berry: '#4A5A8A', legacy: '#5B9BD5' },
	{ id: 'sureau', berry: '#3A2A40' },
];
export const TREES = [
	{ id: 'chene', fruit: '#B07A3A' },
	{ id: 'merisier', fruit: '#B0283A' },
	{ id: 'tilleul', fruit: '#E8DC7A' },
];

/** Espèce d'une plante, y compris pour les jardins sauvegardés avant l'arrivée des espèces. */
export function speciesOf(p) {
	const v = p.variant ?? {};
	if (v.species) return v.species;
	if (p.type === 'herbe') return 'graminees';
	if (p.type === 'arbre') return 'chene';
	if (p.type === 'buisson') return (BUSHES.find(b => b.berry === v.berry || b.legacy === v.berry) ?? BUSHES[0]).id;
	return (FLOWERS.find(f => f.color === v.color && f.shape === v.shape) ?? FLOWERS.find(f => f.color === v.color) ?? FLOWERS[0]).id;
}

const mature = (s, type, id) => s.plants.filter(p => p.type === type && p.growth >= 1 && (!id || speciesOf(p) === id)).length;
const perches = s => mature(s, 'buisson') + mature(s, 'arbre');

const plant = (id, type) => s => mature(s, type, id) >= 1;

export const SPECIES = [
	// ─── Plantes ───
	{
		id: 'graminees', kind: 'plante', name: 'Herbes folles', latin: 'Poacées (graminées)',
		visual: { plant: 'herbe' }, unlock: plant('graminees', 'herbe'), hint: 'Fais pousser une herbe folle (marche lente ou ménage)',
		role: "Leurs racines en touffes tiennent la terre et l'empêchent d'être emportée par la pluie. Elles nourrissent les criquets, les chenilles de nombreux papillons, et leurs graines nourrissent les oiseaux en hiver.",
		help: "Laisse une bande de pelouse sans la tondre jusqu'à la fin de l'été : c'est la « tonte différenciée ».",
		fact: "Le blé, le riz et le maïs sont des graminées : cette famille nourrit l'humanité.",
	},
	{
		id: 'bourrache', kind: 'plante', name: 'Bourrache', latin: 'Borago officinalis',
		visual: { plant: 'fleur', species: 'bourrache' }, unlock: plant('bourrache', 'fleur'), hint: 'Une fleur bleue étoilée, née en marchant',
		role: "Une des fleurs préférées des abeilles : son nectar se renouvelle très vite après chaque visite. Au potager, elle attire les pollinisateurs vers les tomates et les fraisiers.",
		help: 'Sème-la au jardin ou dans une jardinière : elle se ressème toute seule les années suivantes.',
		fact: 'Ses fleurs se mangent et ont un goût de concombre.',
	},
	{
		id: 'mauve', kind: 'plante', name: 'Mauve musquée', latin: 'Malva moschata',
		visual: { plant: 'fleur', species: 'mauve' }, unlock: plant('mauve', 'fleur'), hint: 'Une fleur rose à cinq pétales',
		role: 'Elle nourrit les abeilles sauvages tout l\'été, et ses feuilles accueillent les chenilles de la Belle-Dame, un papillon migrateur.',
		help: "Accepte les « mauvaises herbes » au bord des chemins et des murs : beaucoup sont précieuses.",
		fact: 'La Belle-Dame peut migrer de l\'Afrique du Nord jusqu\'au nord de l\'Europe.',
	},
	{
		id: 'coquelicot', kind: 'plante', name: 'Coquelicot', latin: 'Papaver rhoeas',
		visual: { plant: 'fleur', species: 'coquelicot' }, unlock: plant('coquelicot', 'fleur'), hint: 'Une fleur rouge des champs',
		role: "Il n'offre pas de nectar mais beaucoup de pollen, très recherché par les bourdons. Il signale des sols peu traités : il recule partout où l'on désherbe chimiquement.",
		help: 'Évite les désherbants : un sol sans produit laisse revenir les fleurs des champs.',
		fact: 'Ses graines peuvent attendre des dizaines d\'années dans le sol avant de germer.',
	},
	{
		id: 'bouton-or', kind: 'plante', name: "Bouton d'or", latin: 'Ranunculus acris',
		visual: { plant: 'fleur', species: 'bouton-or' }, unlock: plant('bouton-or', 'fleur'), hint: 'Une fleur jaune vif des prairies',
		role: 'Une des premières fleurs des prairies au printemps : elle nourrit les pollinisateurs qui sortent juste de l\'hiver.',
		help: 'Garde un coin de prairie naturelle, sans engrais : les fleurs sauvages y sont bien plus nombreuses.',
		fact: 'Toxique fraîche, elle est évitée par les vaches, qui la laissent fleurir.',
	},
	{
		id: 'geranium', kind: 'plante', name: 'Géranium des prés', latin: 'Geranium pratense',
		visual: { plant: 'fleur', species: 'geranium' }, unlock: plant('geranium', 'fleur'), hint: 'Une fleur mauve des prés fauchés tard',
		role: "Il vit dans les prairies fauchées tard dans l'été et nourrit abeilles et syrphes pendant de longues semaines.",
		help: 'Si tu as une prairie, fauche-la après la floraison, en juillet, et pas avant.',
		fact: 'Ses fruits en forme de bec projettent les graines loin de la plante en séchant.',
	},
	{
		id: 'campanule', kind: 'plante', name: 'Campanule', latin: 'Campanula rotundifolia',
		visual: { plant: 'fleur', species: 'campanule' }, unlock: plant('campanule', 'fleur'), hint: 'Une clochette bleue',
		role: "Certaines petites abeilles sauvages ne récoltent presque que son pollen. Sans campanules, elles disparaissent.",
		help: 'Plante des fleurs sauvages locales plutôt que des fleurs horticoles doubles, souvent sans pollen.',
		fact: 'Les mâles de ces petites abeilles dorment la nuit à l\'abri dans les clochettes.',
	},
	{
		id: 'digitale', kind: 'plante', name: 'Digitale pourpre', latin: 'Digitalis purpurea',
		visual: { plant: 'fleur', species: 'digitale' }, unlock: plant('digitale', 'fleur'), hint: 'Des cloches roses en lisière',
		role: 'Ses grandes cloches sont faites pour les bourdons, qui y entrent entièrement pour atteindre le nectar.',
		help: 'Admire-la sans la cueillir : elle est très toxique, mais précieuse en lisière de bois.',
		fact: 'Elle a donné la digitaline, un médicament du cœur encore utilisé.',
	},
	{
		id: 'tulipe-sauvage', kind: 'plante', name: 'Tulipe sauvage', latin: 'Tulipa sylvestris',
		visual: { plant: 'fleur', species: 'tulipe-sauvage' }, unlock: plant('tulipe-sauvage', 'fleur'), hint: 'Une tulipe jaune, rare',
		role: 'Elle fleurit tôt dans les vignes et les vergers et nourrit les premiers insectes du printemps. Elle a beaucoup reculé avec les labours et les désherbants.',
		help: 'Ne cueille jamais une plante sauvage rare : regarde, photographie, laisse-la en place.',
		fact: 'Elle est protégée en France.',
	},
	{
		id: 'eglantier', kind: 'plante', name: 'Églantier', latin: 'Rosa canina',
		visual: { plant: 'buisson', species: 'eglantier' }, unlock: plant('eglantier', 'buisson'), hint: 'Un buisson à baies orange (marche rapide)',
		role: "Ses fleurs nourrissent les insectes, ses fruits (les cynorhodons) nourrissent les oiseaux tout l'hiver, et ses épines protègent leurs nids.",
		help: "Plante une haie de plusieurs arbustes locaux plutôt qu'une haie d'une seule espèce.",
		fact: 'Ses fruits contiennent bien plus de vitamine C qu\'une orange.',
	},
	{
		id: 'aubepine', kind: 'plante', name: 'Aubépine', latin: 'Crataegus monogyna',
		visual: { plant: 'buisson', species: 'aubepine' }, unlock: plant('aubepine', 'buisson'), hint: 'Un buisson à baies rouge sombre',
		role: "C'est l'un des arbustes d'Europe qui accueille le plus d'espèces d'insectes. Ses baies, les cenelles, nourrissent grives et merles en hiver.",
		help: "Ne taille pas les haies entre mars et août : c'est la saison des nids.",
		fact: 'Une haie d\'aubépine bien fournie est presque infranchissable pour un prédateur.',
	},
	{
		id: 'argousier', kind: 'plante', name: 'Argousier', latin: 'Hippophae rhamnoides',
		visual: { plant: 'buisson', species: 'argousier' }, unlock: plant('argousier', 'buisson'), hint: 'Un buisson à baies orange vif',
		role: "Ses racines abritent des bactéries qui fixent l'azote de l'air : il enrichit les sols pauvres. On l'utilise pour retenir le sable des dunes.",
		help: 'Sur un sol pauvre, préfère des plantes adaptées plutôt que des engrais.',
		fact: 'Ses baies sont parmi les plus riches en vitamine C.',
	},
	{
		id: 'prunellier', kind: 'plante', name: 'Prunellier', latin: 'Prunus spinosa',
		visual: { plant: 'buisson', species: 'prunellier' }, unlock: plant('prunellier', 'buisson'), hint: 'Un buisson à baies bleu-noir',
		role: "Il fleurit dès mars, avant ses feuilles : une ressource vitale pour les premières abeilles. Ses épines abritent les petits oiseaux.",
		help: 'Dans une haie, mélange des arbustes qui fleurissent à des moments différents.',
		fact: 'La pie-grièche écorcheur y accroche ses proies sur les épines, comme un garde-manger.',
	},
	{
		id: 'sureau', kind: 'plante', name: 'Sureau noir', latin: 'Sambucus nigra',
		visual: { plant: 'buisson', species: 'sureau' }, unlock: plant('sureau', 'buisson'), hint: 'Un buisson à baies noires',
		role: "Ses fleurs blanches nourrissent les insectes au début de l'été, ses baies noires les fauvettes et les merles à la fin de l'été.",
		help: 'Laisse les baies sur les arbustes : elles sont le repas des oiseaux avant la migration.',
		fact: 'Ses fleurs parfument sirops et beignets, mais ses feuilles et baies crues sont toxiques.',
	},
	{
		id: 'chene', kind: 'plante', name: 'Chêne pédonculé', latin: 'Quercus robur',
		visual: { plant: 'arbre', species: 'chene' }, unlock: plant('chene', 'arbre'), hint: 'Fais grandir un arbre en courant',
		role: "C'est l'arbre d'Europe qui abrite le plus d'espèces : insectes, oiseaux, champignons, mousses. Les geais enterrent ses glands et replantent ainsi la forêt.",
		help: 'Protège les vieux arbres : un chêne met des siècles à devenir un refuge.',
		fact: 'Un chêne peut vivre plus de mille ans.',
	},
	{
		id: 'merisier', kind: 'plante', name: 'Merisier', latin: 'Prunus avium',
		visual: { plant: 'arbre', species: 'merisier' }, unlock: plant('merisier', 'arbre'), hint: 'Un arbre à petites cerises',
		role: 'Ses fleurs blanches précoces nourrissent les abeilles, et les oiseaux qui mangent ses cerises sèment ses noyaux plus loin.',
		help: 'Plante des arbres fruitiers locaux : ils nourrissent à la fois les humains et la faune.',
		fact: "C'est l'ancêtre sauvage de nos cerisiers.",
	},
	{
		id: 'tilleul', kind: 'plante', name: 'Tilleul', latin: 'Tilia cordata',
		visual: { plant: 'arbre', species: 'tilleul' }, unlock: plant('tilleul', 'arbre'), hint: 'Un arbre aux fleurs parfumées',
		role: 'En juin et juillet, ses fleurs produisent énormément de nectar : un tilleul en fleur bourdonne de milliers d\'abeilles.',
		help: 'En ville, défends les arbres d\'alignement : ils rafraîchissent les rues et nourrissent les pollinisateurs.',
		fact: 'Ses fleurs séchées font la tisane de tilleul.',
	},

	// ─── Animaux ───
	{
		id: 'abeille', kind: 'animal', name: 'Abeille', latin: 'Apis mellifera',
		visual: { critter: 'bee' }, unlock: s => mature(s, 'fleur') >= 1, hint: 'Fais fleurir une première fleur',
		role: "En butinant, les abeilles transportent le pollen de fleur en fleur : sans elles, beaucoup de fruits et légumes ne se formeraient pas. Une grande part de notre alimentation dépend des pollinisateurs.",
		help: "Plante des fleurs variées qui fleurissent du printemps à l'automne, et bannis les insecticides.",
		fact: "Il existe près de 1 000 espèces d'abeilles en France, la plupart sauvages et solitaires.",
	},
	{
		id: 'petite-tortue', kind: 'animal', name: 'Petite tortue', latin: 'Aglais urticae',
		visual: { critter: 'butterfly' }, unlock: s => perches(s) >= 2, hint: 'Fais grandir deux buissons ou arbres',
		role: 'Ce papillon pollinise en se nourrissant de nectar. Ses chenilles ne mangent que des orties.',
		help: "Garde un coin d'orties au fond du jardin : c'est la nurserie de plusieurs papillons.",
		fact: 'Les adultes passent l\'hiver endormis, cachés dans un abri ou un grenier.',
	},
	{
		id: 'coccinelle', kind: 'animal', name: 'Coccinelle à sept points', latin: 'Coccinella septempunctata',
		visual: { critter: 'ladybug' }, unlock: s => mature(s, 'buisson') >= 2, hint: 'Fais grandir deux buissons',
		role: 'Adultes comme larves dévorent les pucerons : une coccinelle peut en manger des dizaines par jour. Elle protège les plantes sans produit chimique.',
		help: "N'utilise pas d'insecticide contre les pucerons : laisse les coccinelles et les mésanges travailler.",
		fact: 'Sa couleur vive prévient les oiseaux : elle a un goût amer.',
	},
	{
		id: 'sympetrum', kind: 'animal', name: 'Sympétrum sanguin', latin: 'Sympetrum sanguineum',
		visual: { critter: 'dragonfly' }, unlock: s => !!s.unlocked.pond, hint: 'Fais apparaître la mare (3 km)',
		role: "Cette libellule chasse les moustiques en vol. Sa larve vit sous l'eau et y chasse aussi. Sa présence indique une eau de bonne qualité.",
		help: "Une petite mare sans produit ni poisson suffit à accueillir des libellules en quelques mois.",
		fact: 'Les libellules existaient déjà avant les dinosaures.',
	},
	{
		id: 'grenouille', kind: 'animal', name: 'Grenouille rousse', latin: 'Rana temporaria',
		visual: { critter: 'frog' }, unlock: s => !!s.unlocked.pond && mature(s, 'fleur') >= 6, hint: 'Une mare et six fleurs',
		role: 'Elle mange limaces, vers et insectes, et sert elle-même de repas aux hérons, aux couleuvres et aux hérissons.',
		help: "Ne mets pas de poissons rouges dans une mare : ils dévorent les œufs et les têtards.",
		fact: 'Tous les amphibiens sont protégés en France.',
	},
	{
		id: 'herisson', kind: 'animal', name: "Hérisson d'Europe", latin: 'Erinaceus europaeus',
		visual: { critter: 'hedgehog' }, unlock: s => !!s.unlocked.log && mature(s, 'buisson') >= 2, hint: 'Le vieux tronc et deux buissons',
		role: "Il mange chaque nuit limaces, escargots et insectes. Il a besoin de circuler de jardin en jardin pour trouver assez de nourriture.",
		help: 'Ouvre un passage de 13 cm sous ta clôture et ne laisse pas tourner de robot tondeuse la nuit.',
		fact: 'Il sort la nuit : ouvre ton jardin après le coucher du soleil pour le voir.',
	},
	{
		id: 'mesange', kind: 'animal', name: 'Mésange bleue', latin: 'Cyanistes caeruleus',
		visual: { critter: 'tit' }, unlock: s => mature(s, 'arbre') >= 2, hint: 'Fais grandir deux arbres',
		role: "Pour nourrir sa nichée au printemps, un couple de mésanges attrape des milliers de chenilles. Elle protège les arbres et les potagers.",
		help: 'Installe un nichoir avec un trou de 25 à 28 mm, à l\'abri du soleil de midi.',
		fact: 'Une mésange bleue pèse à peine plus qu\'une pièce de 2 euros.',
	},
	{
		id: 'ver-luisant', kind: 'animal', name: 'Ver luisant', latin: 'Lampyris noctiluca',
		visual: { critter: 'firefly' }, unlock: s => !!s.seenNight && mature(s, 'herbe') >= 5, hint: 'Ouvre ton jardin la nuit, avec cinq herbes folles',
		role: "Sa larve se nourrit d'escargots et de limaces. La femelle brille la nuit pour attirer les mâles.",
		help: "Éteins les lumières extérieures la nuit : l'éclairage empêche les vers luisants de se trouver.",
		fact: "Ce n'est pas un ver mais un coléoptère.",
	},
	{
		id: 'lombric', kind: 'animal', name: 'Ver de terre', latin: 'Lumbricus terrestris',
		visual: { critter: 'worm' }, unlock: s => mature(s, 'herbe') >= 20, hint: 'Fais pousser vingt herbes folles',
		role: "Il creuse des galeries qui aèrent le sol et laissent entrer l'eau, et transforme les feuilles mortes en terre fertile.",
		help: 'Couvre la terre de feuilles mortes ou de paillage plutôt que de la laisser nue.',
		fact: "Un hectare de prairie peut abriter plus d'une tonne de vers de terre.",
	},

	// ─── Milieux ───
	{
		id: 'mare', kind: 'milieu', name: 'La mare', latin: 'Zone humide',
		visual: { decor: 'pond' }, unlock: s => !!s.unlocked.pond, hint: 'Parcours 3 km au total',
		role: "Un point d'eau fait venir en quelques mois libellules, grenouilles, tritons et oiseaux qui viennent boire.",
		help: 'Même une bassine enterrée avec quelques plantes aquatiques devient un refuge.',
		fact: 'En France, la moitié des zones humides a disparu entre 1960 et 1990.',
	},
	{
		id: 'amanite', kind: 'milieu', name: 'Amanite tue-mouches', latin: 'Amanita muscaria',
		visual: { decor: 'mushrooms' }, unlock: s => !!s.unlocked.mushrooms, hint: 'Parcours 6 km au total',
		role: "Sous terre, ses filaments s'unissent aux racines des arbres : elle leur apporte de l'eau et des minéraux en échange de sucres.",
		help: 'Ne cueille jamais un champignon que tu ne connais pas : celui-ci est très toxique.',
		fact: 'Ce que l\'on voit n\'est que le fruit : le champignon vit sous terre, parfois sur des hectares.',
	},
	{
		id: 'bois-mort', kind: 'milieu', name: 'Le bois mort', latin: 'Tronc au sol',
		visual: { decor: 'log' }, unlock: s => !!s.unlocked.log, hint: 'Parcours 10 km au total',
		role: "Un tronc qui pourrit nourrit champignons, insectes et larves, et abrite hérissons, crapauds et oiseaux. Environ un quart des espèces des forêts en dépendent.",
		help: 'Laisse un tas de branches ou une vieille souche dans un coin du jardin.',
		fact: 'Le bois mort est souvent plus vivant que l\'arbre debout.',
	},
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));

/** Espèces nouvellement débloquées (et enregistrées dans state.species). */
export function checkSpecies(state) {
	const found = [];
	for (const sp of SPECIES) {
		if (state.species[sp.id] || !sp.unlock(state)) continue;
		state.species[sp.id] = Date.now();
		found.push(sp);
	}
	return found;
}
