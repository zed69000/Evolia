using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;

[RequireComponent(typeof(SortingGroup))]
public class Plant : MonoBehaviour
{
	// --------------------------- Croissance -------------------------
	[Header("Croissance")]
	public ActivityType activityType;
	[Range(0f, 1f)] public float growth = 0f;

	// --------------------------- L-System ---------------------------
	[Header("L-System")]
	public LSystemConfig config;
	public bool useLSystem = true;

	// ------------------------- Randomisation ------------------------
	[Header("Randomisation")]
	[Tooltip("Échelle globale de la plante (min, max)")]
	public Vector2 globalScaleRange = new Vector2(0.8f, 1.2f);

	[Tooltip("Échelle des pétales (min, max)")]
	public Vector2 petalScaleRange = new Vector2(0.5f, 1.5f);

	[Tooltip("Échelle des feuilles (min, max)")]
	public Vector2 leafScaleRange = new Vector2(0.4f, 1.2f);

	[Tooltip("Décalage latéral des feuilles (en unités de segment) (min, max)")]
	public Vector2 leafSideOffsetRange = new Vector2(0.1f, 0.3f);

	[Range(0f, 1f), Tooltip("Chance de miroir horizontal")]
	public float flipSymmetryProbability = 0.5f;

	[Tooltip("Variation relative de la longueur de segment (min, max)")]
	public Vector2 segmentLengthVariation = new Vector2(0.8f, 1.2f);

	[Tooltip("Variation relative de l'angle (min, max)")]
	public Vector2 angleVariation = new Vector2(0.8f, 1.2f);

	/// <summary>Vrai quand la plante a atteint 100 % de croissance.</summary>
	public bool IsMature => growth >= 1f;

	// --------------------------- Internes ---------------------------
	private string sequence;
	private int totalSegments;
	private System.Random rng;

	private float segmentLengthLocal;
	private float angleLocal;

	private SortingGroup _sortingGroup;

	// ============================================================
	//  Lifecycle
	// ============================================================
	void Awake()
	{
		rng = new System.Random(transform.GetInstanceID());

		float globalScale = Random.Range(globalScaleRange.x, globalScaleRange.y);
		bool flip = Random.value < flipSymmetryProbability;
		float sign = flip ? -1f : 1f;
		transform.localScale = new Vector3(sign * globalScale,
										   globalScale,
										   sign * globalScale);

		_sortingGroup = GetComponent<SortingGroup>();
		if (_sortingGroup == null)
			_sortingGroup = gameObject.AddComponent<SortingGroup>();

		// Premier calcul
		UpdateSortingOrder();
	}

	private void Start()
	{
		if (!useLSystem || config == null || config.segmentPrefab == null)
			return;

		segmentLengthLocal = config.segmentLength * Random.Range(segmentLengthVariation.x, segmentLengthVariation.y);
		angleLocal = config.angle * Random.Range(angleVariation.x, angleVariation.y);

		sequence = config.axiom;
		for (int i = 0; i < config.iterations; i++)
		{
			string next = "";
			foreach (char c in sequence)
			{
				var rule = System.Array.Find(config.rules, r => r.symbol == c);
				if (rule != null && rule.replacements.Length > 0)
					next += PickReplacement(rule.replacements);
				else
					next += c;
			}
			sequence = next;
		}

		totalSegments = 0;
		foreach (char c in sequence)
			if (c == 'F') totalSegments++;

		StartCoroutine(DrawProgressively());
	}

	public void AddGrowth(float amount)
	{
		if (activityType == null) return;
		growth = Mathf.Clamp01(growth + amount / activityType.effortToGrow);
	}

	private IEnumerator DrawProgressively()
	{
		GameObject head;
		if (config.segmentPrefab != null)
		{
			head = Instantiate(
				config.segmentPrefab,
				transform.position,
				Quaternion.identity,
				transform
			);
			if (head.TryGetComponent(out TrailRenderer trail))
				trail.time = Mathf.Max(trail.time, config.iterations * config.drawDelay * 1.5f);
		}
		else
		{
			head = new GameObject("PlantHead_Dummy");
			head.transform.SetParent(transform);
			head.transform.position = transform.position;
		}

		var stack = new Stack<(Vector3 pos, Quaternion rot)>();
		Vector3 pos = transform.position;
		Quaternion rot = Quaternion.identity;
		int drawn = 0;

		foreach (char c in sequence)
		{
			if (c == 'F')
			{
				drawn++;
				float needed = (float)drawn / totalSegments;
				while (growth < needed)
					yield return null;

				Vector3 target = pos + rot * Vector3.up * segmentLengthLocal;
				float t = 0f;
				while (t < config.drawDelay)
				{
					head.transform.position = Vector3.Lerp(pos, target, t / config.drawDelay);
					t += Time.deltaTime;
					yield return null;
				}
				head.transform.position = target;
				pos = target;
			}
			else if (c == '+')
			{
				float jitter = (float)(rng.NextDouble() * (angleLocal * 0.4f) - (angleLocal * 0.2f));
				rot *= Quaternion.Euler(0, 0, angleLocal + jitter);
			}
			else if (c == '-')
			{
				float jitter = (float)(rng.NextDouble() * (angleLocal * 0.4f) - (angleLocal * 0.2f));
				rot *= Quaternion.Euler(0, 0, -angleLocal + jitter);
			}
			else if (c == '[')
			{
				stack.Push((pos, rot));
			}
			else if (c == ']')
			{
				var st = stack.Pop();
				pos = st.pos;
				rot = st.rot;
				head.transform.position = pos;
			}
			else if (c == 'X' && config.petalPrefabs != null && config.petalPrefabs.Length > 0)
			{
				var prefab = PickWeightedPrefab(config.petalPrefabs);
				if (prefab == null) continue;
				var petal = Instantiate(
					prefab,
					pos,
					Quaternion.LookRotation(Vector3.forward, rot * Vector3.up),
					transform
				);
				float ps = Random.Range(petalScaleRange.x, petalScaleRange.y);
				petal.transform.localScale = Vector3.one * ps;
				petal.transform.rotation *= Quaternion.Euler(0, 0, Random.Range(0f, 360f));
			}
			else if (c == 'L' && config.leafPrefabs != null && config.leafPrefabs.Length > 0)
			{
				var prefab = PickWeightedPrefab(config.leafPrefabs);
				if (prefab == null) continue;
				var leaf = Instantiate(
					prefab,
					pos,
					Quaternion.LookRotation(Vector3.forward, rot * Vector3.up),
					transform
				);
				float ls = Random.Range(leafScaleRange.x, leafScaleRange.y);
				leaf.transform.localScale = Vector3.one * ls;
				leaf.transform.rotation *= Quaternion.Euler(0, 0, Random.Range(0f, 360f));

				float off = Random.Range(leafSideOffsetRange.x, leafSideOffsetRange.y);
				off *= (Random.value < 0.5f) ? 1f : -1f;
				Vector3 side = rot * Vector3.right;
				leaf.transform.position += side * off;
			}

			yield return null;
		}
	}

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

	/// <summary>
	/// Sélectionne un prefab dans la liste selon son poids.
	/// </summary>
	private GameObject PickWeightedPrefab(PrefabWeight[] list)
	{
		float total = 0f;
		foreach (var pw in list)
			total += pw.probability;
		float rnd = Random.value * total;
		foreach (var pw in list)
		{
			if (rnd < pw.probability)
				return pw.prefab;
			rnd -= pw.probability;
		}
		return list[list.Length - 1].prefab;
	}

	private void UpdateSortingOrder()
	{
		// 1. On lit la position Y de l’arbre
		float posY = transform.position.y;

		// 2. On convertit en entier (arrondi ou plancher, selon le rendu désiré)
		int yInt = Mathf.RoundToInt(posY);
		// → si vous préférez toujours "descendre" : int yInt = Mathf.FloorToInt(posY);

		// 3. On inverse le signe pour que Y = 0 → order = 0, Y = 1 → order = -1, Y = 2 → order = -2…
		_sortingGroup.sortingOrder = -yInt;
	}

}

/// <summary>
/// Stocke position et rotation pour les crochets du L-System.
/// </summary>
public struct TransformInfo
{
	public Vector3 pos;
	public Quaternion rot;
}
