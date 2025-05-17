using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;

[RequireComponent(typeof(SortingGroup))]
public class LSystem : MonoBehaviour
{
	[Header("Croissance")]
	public ActivityType activityType;
	[Range(0f, 1f)] public float growth = 0f;               // Progrès de croissance de la graine

	[Header("L-System Config")]
	public SO_LSystemConfig config;                         // ScriptableObject de configuration
	public bool useLSystem = true;                          // Activer / désactiver la génération L-System

	[Header("Randomisation")]
	public Vector2 globalScaleRange = new Vector2(0.8f, 1.2f);
	public Vector2 petalScaleRange = new Vector2(0.5f, 1.5f);
	public Vector2 leafScaleRange = new Vector2(0.4f, 1.2f);
	public Vector2 leafSideOffsetRange = new Vector2(0.1f, 0.3f);
	public Vector2 leafRotationRange = new Vector2(0f, 360f);
	[Range(0f, 1f)] public float flipSymmetryProbability = 0.5f;
	public Vector2 segmentLengthVariation = new Vector2(0.8f, 1.2f);
	public Vector2 angleVariation = new Vector2(0.8f, 1.2f);

	[Header("Variation d'angle évoluée")]
	[Tooltip("Exclut les variations d'angle dont la magnitude est inférieure à cette valeur (zone morte)")]
	[Range(0f, 1f)] public float minAngleDeadZone = 0.5f;

	[Header("Largeurs des segments")]
	[Tooltip("Largeur initiale pour le tronc (profondeur 0)")]
	public float baseWidth = 0.5f;
	[Tooltip("Facteur de réduction de largeur par niveau de profondeur")]
	[Range(0f, 1f)] public float widthFalloff = 0.8f;
	[Tooltip("Largeur minimale pour les ramifications les plus fines")]
	public float minWidth = 0.05f;

	[Header("Trail Settings")]
	[Tooltip("Distance min entre deux points du TrailRenderer")]
	public float minVertexDistance = 0.1f;
	[Tooltip("Facteur pour adapter dynamiquement minVertexDistance en fonction de la longueur du segment (fraction)")]
	[Range(0f, 1f)] public float vertexDistanceFactor = 0.2f;
	[Tooltip("Distance de chevauchement entre segments (en unités)")]
	public float overlapDistance = 0.1f;

	[Header("Materials Settings")]
	public Material spriteMaterial;

	public bool IsMature => growth >= 1f;                  // Indique si la graine est pleinement développée
	
	/// <summary>Retourne la progression de croissance (0–1) pour la persistance.</summary>
	public float CurrentGrowthProgress => growth;

	// --- Internals ---
	private string sequence;                               // Chaîne de symboles générée par le L-System
	private int totalSegments;                             // Nombre total de segments à dessiner
	private System.Random rng;                             // Générateur de nombres aléatoires
	private float segmentLengthLocal;                      // Longueur locale d’un segment après variation aléatoire
	private SortingGroup _sortingGroup;                    // Pour gérer l’ordre de rendu

	private GameObject currentTrailSegment;                // Objet du segment en cours de dessin
	private TrailRenderer currentTrailRenderer;            // TrailRenderer associé au segment courant
	private int currentTrailDepth;                         // Profondeur de la branche du segment courant

	void Awake()
	{
		// Initialisation du RNG avec un seed basé sur l’instance
		rng = new System.Random(transform.GetInstanceID());

		// Application d’une échelle globale aléatoire + symétrie possible
		float globalScale = UnityEngine.Random.Range(globalScaleRange.x, globalScaleRange.y);
		bool flip = Random.value < flipSymmetryProbability;
		float sign = flip ? -1f : 1f;
		transform.localScale = new Vector3(sign * globalScale, globalScale, sign * globalScale);

		// Récupération du SortingGroup pour le rendu 2D
		_sortingGroup = GetComponent<SortingGroup>();
		UpdateSortingOrder();
	}

	private void Start()
	{
		// Si pas de config ou pas de prefab, on sort
		if (!useLSystem || config == null /*|| config.segmentPrefab == null*/)
			return;

		// Calcul de la longueur de segment avec variation
		segmentLengthLocal = config.segmentLength /** Random.Range(segmentLengthVariation.x, segmentLengthVariation.y)*/;

		// Génération de la séquence L-System (axiome + itérations)
		sequence = config.axiom;
		for (int i = 0; i < config.iterations; i++)
		{
			string next = "";
			foreach (char c in sequence)
			{
				var rule = System.Array.Find(config.rules, r => r.symbol == c);
				next += (rule != null && rule.replacements.Length > 0)
					? PickReplacement(rule.replacements)
					: c.ToString();
			}
			sequence = next;
		}

		// Comptage des symboles de déplacement pour animer progressivement
		totalSegments = 0;
		foreach (char c in sequence)
			if (c == 'F' || c == 'R' || c == 'r') totalSegments++;

		// Lancement du dessin progressif selon la croissance
		StartCoroutine(DrawProgressively());
	}

	private void SendParamPropBlock(GameObject go)
	{
		// Prépare le block de propriétés
		var propertyBlock = new MaterialPropertyBlock();

		// 1) Si c'est un TrailRenderer, on l'utilise
		if (go.TryGetComponent<TrailRenderer>(out var trail))
		{
			propertyBlock.SetVector("_rootPosition", transform.position);
			trail.SetPropertyBlock(propertyBlock);
		}
		// 2) Sinon, si c'est n'importe quel Renderer, on l'utilise
		else if (go.TryGetComponent<Renderer>(out var rend))
		{
			propertyBlock.SetVector("_rootPosition", transform.position);
			rend.SetPropertyBlock(propertyBlock);
		}
		// 3) Ici, ni TrailRenderer ni Renderer n'existe sur 'go'
		else
		{
			Debug.LogWarning($"SendParamPropBlock : aucun Renderer trouvé sur {go.name}");
		}
	}

	public void AddGrowth(float amount)
	{
		// Ajoute de la croissance proportionnelle à l’effort
		if (activityType == null) return;
		growth = Mathf.Clamp01(growth + amount / activityType.effortToGrow);
	}

	/// <summary>
	/// Calcule la largeur d’un segment en fonction de la profondeur.
	/// </summary>
	private float GetWidthForDepth(int depth)
	{
		float w = baseWidth * Mathf.Pow(widthFalloff, depth);
		return Mathf.Max(minWidth, w);
	}

	/// <summary>
	/// Échantillonne un multiplicateur d’angle en excluant la zone morte.
	/// </summary>
	private float SampleAngleMultiplier()
	{
		float v;
		do
		{
			v = (float)(rng.NextDouble() * 2.0 - 1.0);
		} while (Mathf.Abs(v) < minAngleDeadZone);
		return v;
	}

	/// <summary>
	/// Coroutine qui dessine chaque segment progressivement selon la valeur `growth`.
	/// </summary>
	private IEnumerator DrawProgressively()
	{
		var stack = new Stack<(Vector3 pos, Quaternion rot, int depth)>();
		Vector3 pos = transform.position;
		Quaternion rot = Quaternion.identity;
		int depth = 0;
		int drawn = 0;

		foreach (char c in sequence)
		{
			// --- Avancer / dessiner un segment 'F' ou 'r' ---
			if (c == 'F' || c == 'r')
			{
				if(!config.segmentPrefab) continue;
				drawn++;
				float needed = (float)drawn / totalSegments;
				// Attente tant que la croissance n'a pas atteint le pourcentage requis
				while (growth < needed) yield return null;

				// Longueur du segment (moitié pour 'r')
				float length = segmentLengthLocal * Random.Range(segmentLengthVariation.x, segmentLengthVariation.y) * (c == 'r' ? 0.5f : 1f);

				// Si pas de trail actif ou profondeur changée, on crée un nouveau segment
				if (currentTrailRenderer == null || currentTrailDepth != depth)
				{
					var newSegment = Instantiate(config.segmentPrefab, pos, rot, transform);

					if (newSegment.TryGetComponent(out TrailRenderer newTrail))
					{
						float w = GetWidthForDepth(depth);
						newTrail.startWidth = w;
						newTrail.endWidth = w;
						newTrail.time = Mathf.Infinity;
						newTrail.Clear();

						// Calcul dynamique de minVertexDistance
						float vdist = Mathf.Max(minVertexDistance, length * vertexDistanceFactor);
						newTrail.minVertexDistance = vdist;
						newTrail.emitting = true;

						yield return null;
						// Désactivation de l'ancien trail
						if (currentTrailRenderer != null)
							currentTrailRenderer.emitting = false;

						currentTrailSegment = newSegment;
						currentTrailRenderer = newTrail;
						currentTrailDepth = depth;
						SendParamPropBlock(newSegment.gameObject);
					}
					else
					{
						Destroy(newSegment);
					}
				}

				// Animation de l’objet depuis pos → cible
				Vector3 target = pos + rot * Vector3.up * length;
				float t = 0f;
				while (t < config.drawDelay)
				{
					currentTrailSegment.transform.position = Vector3.Lerp(pos, target, t / config.drawDelay);
					t += Time.deltaTime;
					yield return null;
				}
				currentTrailSegment.transform.position = target;
				pos = target;
				currentTrailSegment.GetComponent<TrailRenderer>().emitting = true;
			}
			// --- Saut sans dessiner ('R') ---
			else if (c == 'R')
			{
				drawn++;
				float needed = (float)drawn / totalSegments;
				while (growth < needed) yield return null;
				pos += rot * Vector3.up * segmentLengthLocal * 10f;
			}
			// --- Rotation + / - ---
			else if (c == '+')
			{
				float m = SampleAngleMultiplier();
				rot *= Quaternion.Euler(0, 0, config.angle * m);
			}
			else if (c == '-')
			{
				float m = SampleAngleMultiplier();
				rot *= Quaternion.Euler(0, 0, -config.angle * m);
			}
			// --- Sauvegarde d’état ('[') pour bifurcation ---
			else if (c == '[')
			{
				stack.Push((pos, rot, depth));
				depth++;
			}
			// --- Retour d’état (']') : on restaure et on STOPPE le Trail courant ---
			else if (c == ']')
			{
				if (stack.Count > 0)
				{
					// 1) Restauration de la position, de la rotation et de la profondeur
					var s = stack.Pop();
					pos = s.pos;
					rot = s.rot;
					depth = s.depth; // Profondeur restaurée du parent

					// 2) Arrêt de l'émission pour le TrailRenderer de la branche que l'on quitte.
					//    La branche dessinée restera visible si son TrailRenderer.time est infini
					//    et qu'on ne fait pas Clear().
					if (currentTrailRenderer != null)
					{
						currentTrailRenderer.emitting = false; // Arrêter l'émission de nouveaux points pour cette branche.
					}

					// 3) Forcer la création d'un nouveau trail au prochain segment 'F'
					//    en "oubliant" le trail et le segment courants.
					//    Ceci est crucial pour que le prochain segment dessiné depuis le point
					//    de jonction restauré ne soit pas une continuation erronée de la branche quittée.
					currentTrailRenderer = null;
					currentTrailSegment = null;
				}
				else
				{
					// Optionnel : Gérer le cas d'une pile vide si la grammaire est incorrecte.
					// Debug.LogWarning("LSystem: Tentative de Pop sur une pile vide pour le symbole ']'.", this);
				}
			}
			// Au symbole 'X' (pétales)
			else if (c == 'X'
					 && config.petal != null
					 && config.petal.Length > 0)
			{
				var prefab = PickWeightedPrefab(config.petal);
				if (prefab != null)
				{
					CreatePrefab(prefab, pos, rot);
				}
				else
				{
					drawn++;
					float needed = (float)drawn / totalSegments;
					while (growth < needed)
						yield return null;

					Sprite[] growthSprites = PickWeightedSprites(config.petal);

					if (growthSprites != null && growthSprites.Length > 0)
						CreateFlipbook(growthSprites, pos, rot);
				}
			}
			// Au symbole 'L' (feuilles)
			else if (c == 'L'
					 && config.leaf != null
					 && config.leaf.Length > 0)
			{
				var prefab = PickWeightedPrefab(config.leaf);
				if (prefab != null)
				{
					CreatePrefab(prefab, pos, rot);
				}
				else
				{
					drawn++;
					float needed = (float)drawn / totalSegments;
					while (growth < needed)
						yield return null;

					Sprite[] growthSprites = PickWeightedSprites(config.leaf);

					if (growthSprites != null && growthSprites.Length > 0)
						CreateFlipbook(growthSprites, pos, rot);
				}
			}

			yield return null;
		}

		// À la fin, on s’assure de stopper tout trail encore actif
		if (currentTrailRenderer != null)
			currentTrailRenderer.emitting = false;
	}


	private void CreatePrefab(GameObject prefab, Vector3 pos, Quaternion rot) {

		var prefabI = Instantiate(
						prefab,
						pos,
						Quaternion.LookRotation(Vector3.forward, rot * Vector3.up),
						transform
					);
		SendParamPropBlock(prefabI.gameObject);
		float ps = Random.Range(petalScaleRange.x, petalScaleRange.y);
		prefabI.transform.localScale = Vector3.one * ps;
		prefabI.transform.rotation *= Quaternion.Euler(0, 0, Random.Range(0f, 360f));
	}

	private void CreateFlipbook(Sprite[] growthSprites, Vector3 pos, Quaternion rot)
	{
		if (growthSprites == null || growthSprites.Length == 0)
			return;

		var go = new GameObject("GrowthFlipbook");
		go.transform.SetParent(transform);
		go.transform.position = pos;
		go.transform.rotation = Quaternion.LookRotation(Vector3.forward, rot * Vector3.up);

		var sr = go.AddComponent<SpriteRenderer>();
		if (spriteMaterial != null) sr.material = spriteMaterial;
		sr.sortingLayerName = "Default";

		// Attache et configure le composant qui fera tourner l’animation
		var gf = go.AddComponent<GrowthFlipbook>();
		gf.lSystem = this;
		gf.frames = growthSprites;
	}


	// Choix d’une chaîne de remplacement selon probabilités
	private string PickReplacement(Replacement[] reps)
	{
		float total = 0f;
		foreach (var r in reps) total += r.probability;
		double rnd = rng.NextDouble() * total;
		foreach (var r in reps)
		{
			if (rnd < r.probability) return r.replacement;
			rnd -= r.probability;
		}
		return reps[^1].replacement;
	}


	private GameObject PickWeightedPrefab(PrefabWeight[] list)
	{
		var entry = PickWeightedEntry(list);
		return entry.HasValue ? entry.Value.prefab : null;
	}

	/// <summary>Renvoie le tableau de sprites sélectionné, ou null si pas de liste.</summary>
	private Sprite[] PickWeightedSprites(PrefabWeight[] list)
	{
		var entry = PickWeightedEntry(list);
		return entry.HasValue ? entry.Value.sprite : null;
	}
	// Choix d’un prefab (pétale ou feuille) pondéré
	// Retourne null si la liste est nulle ou vide,
	// évite tout IndexOutOfRangeException
	private PrefabWeight? PickWeightedEntry(PrefabWeight[] list)
	{
		if (list == null || list.Length == 0)
			return null;

		// 1) Somme des poids
		float totalWeight = 0f;
		foreach (var pw in list)
			totalWeight += pw.probability;

		// 2) Tirage aléatoire entre 0 et totalWeight
		float randomPoint = Random.value * (totalWeight > 0 ? totalWeight : 1f);

		// 3) On soustrait les poids un à un jusqu'à passer sous zéro
		foreach (var pw in list)
		{
			if (randomPoint < pw.probability)
				return pw;          // ici, on a trouvé notre entrée
			randomPoint -= pw.probability;
		}

		// Cas extrême : on renvoie la dernière entrée si on n'a rien retourné
		return list[list.Length - 1];
	}

	// Met à jour l’ordre de tri basé sur la position y (pour rendu 2D)
	private void UpdateSortingOrder()
	{
		int y = Mathf.RoundToInt(transform.position.y);
		_sortingGroup.sortingOrder = -y;
	}

	/// <summary>Permet de restaurer la croissance depuis la persistance.</summary>
	public void SetGrowthProgress(float progress)
	{
		growth = Mathf.Clamp01(progress);
		// (Optionnel) relancer ici la coroutine de dessin si nécessaire
	}


}
