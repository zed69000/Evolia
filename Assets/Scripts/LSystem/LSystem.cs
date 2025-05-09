using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;

[RequireComponent(typeof(SortingGroup))]
public class LSystem : MonoBehaviour
{
	[Header("Croissance")]
	public ActivityType activityType;
	[Range(0f, 1f)] public float growth = 0f;

	[Header("L-System Config")]
	public SO_LSystemConfig config;
	public bool useLSystem = true;

	[Header("Randomisation")]
	public Vector2 globalScaleRange = new Vector2(0.8f, 1.2f);
	public Vector2 petalScaleRange = new Vector2(0.5f, 1.5f);
	public Vector2 leafScaleRange = new Vector2(0.4f, 1.2f);
	public Vector2 leafSideOffsetRange = new Vector2(0.1f, 0.3f);
	[Range(0f, 1f)] public float flipSymmetryProbability = 0.5f;
	public Vector2 segmentLengthVariation = new Vector2(0.8f, 1.2f);
	public Vector2 angleVariation = new Vector2(0.8f, 1.2f);

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

	public bool IsMature => growth >= 1f;

	// Internals
	private string sequence;
	private int totalSegments;
	private System.Random rng;
	private float segmentLengthLocal;
	private float angleLocal;
	private SortingGroup _sortingGroup;

	private GameObject currentTrailSegment;
	private TrailRenderer currentTrailRenderer;
	private int currentTrailDepth;

	void Awake()
	{
		rng = new System.Random(transform.GetInstanceID());
		float globalScale = Random.Range(globalScaleRange.x, globalScaleRange.y);
		bool flip = Random.value < flipSymmetryProbability;
		float sign = flip ? -1f : 1f;
		transform.localScale = new Vector3(sign * globalScale, globalScale, sign * globalScale);
		_sortingGroup = GetComponent<SortingGroup>();
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
				next += (rule != null && rule.replacements.Length > 0)
					? PickReplacement(rule.replacements)
					: c.ToString();
			}
			sequence = next;
		}

		totalSegments = 0;
		foreach (char c in sequence)
			if (c == 'F' || c == 'R' || c == 'r') totalSegments++;

		StartCoroutine(DrawProgressively());
	}

	public void AddGrowth(float amount)
	{
		if (activityType == null) return;
		growth = Mathf.Clamp01(growth + amount / activityType.effortToGrow);
	}

	/// <summary>
	/// Calcule la largeur du segment selon la profondeur.
	/// </summary>
	private float GetWidthForDepth(int depth)
	{
		float w = baseWidth * Mathf.Pow(widthFalloff, depth);
		return Mathf.Max(minWidth, w);
	}

	private IEnumerator DrawProgressively()
	{
		var stack = new Stack<(Vector3 pos, Quaternion rot, int depth)>();
		Vector3 pos = transform.position;
		Quaternion rot = Quaternion.identity;
		int depth = 0;
		int drawn = 0;

		foreach (char c in sequence)
		{
			if (c == 'F' || c == 'r')
			{
				drawn++;
				float needed = (float)drawn / totalSegments;
				while (growth < needed) yield return null;

				float length = segmentLengthLocal * (c == 'r' ? 0.5f : 1f);

				// Swap trail: instantiate new BEFORE stopping old to avoid gaps
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
						// Adapte dynamiquement la distance entre vertices en fonction de la longueur du segment
						float vdist = Mathf.Max(minVertexDistance, length * vertexDistanceFactor);
						newTrail.minVertexDistance = vdist;

						// Start emitting to record the first point at 'pos'
						newTrail.emitting = true; // start emitting immediately at the same pos, no extra frame wait // wait one frame so the initial position is captured

						if (currentTrailRenderer != null)
							currentTrailRenderer.emitting = false;

						currentTrailSegment = newSegment;
						currentTrailRenderer = newTrail;
						currentTrailDepth = depth;
					}
					else
					{
						Destroy(newSegment);
					}
				}

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
			}
			else if (c == 'R')
			{
				drawn++;
				float needed = (float)drawn / totalSegments;
				while (growth < needed) yield return null;
				pos += rot * Vector3.up * segmentLengthLocal * 10f;
			}
			else if (c == '+') rot *= Quaternion.Euler(0, 0, angleLocal);
			else if (c == '-') rot *= Quaternion.Euler(0, 0, -angleLocal);
			else if (c == '[') stack.Push((pos, rot, depth++));
			else if (c == ']')
			{
				var s = stack.Pop();
				pos = s.pos;
				rot = s.rot;
				depth = s.depth;
			}
			else if (c == 'X' && config.petalPrefabs != null)
			{
				var prefab = PickWeightedPrefab(config.petalPrefabs);
				if (prefab != null)
				{
					var petal = Instantiate(prefab, pos, Quaternion.LookRotation(Vector3.forward, rot * Vector3.up), transform);
					float ps = Random.Range(petalScaleRange.x, petalScaleRange.y);
					petal.transform.localScale = Vector3.one * ps;
					petal.transform.rotation *= Quaternion.Euler(0, 0, Random.Range(0f, 360f));
				}
			}
			else if (c == 'L' && config.leafPrefabs != null)
			{
				var prefab = PickWeightedPrefab(config.leafPrefabs);
				if (prefab != null)
				{
					var leaf = Instantiate(prefab, pos, Quaternion.LookRotation(Vector3.forward, rot * Vector3.up), transform);
					float ls = Random.Range(leafScaleRange.x, leafScaleRange.y);
					leaf.transform.localScale = Vector3.one * ls;
					float off = Random.Range(leafSideOffsetRange.x, leafSideOffsetRange.y) * (Random.value < 0.5f ? 1f : -1f);
					leaf.transform.position += rot * Vector3.right * off;
				}
			}
			yield return null;
		}

		if (currentTrailRenderer != null)
			currentTrailRenderer.emitting = false;
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

	private GameObject PickWeightedPrefab(PrefabWeight[] list)
	{
		float total = 0f;
		foreach (var pw in list) total += pw.probability;
		float rnd = Random.value * total;
		foreach (var pw in list)
		{
			if (rnd < pw.probability) return pw.prefab;
			rnd -= pw.probability;
		}
		return list[^1].prefab;
	}

	private void UpdateSortingOrder()
	{
		int y = Mathf.RoundToInt(transform.position.y);
		_sortingGroup.sortingOrder = -y;
	}
}

public struct TransformInfo { public Vector3 pos; public Quaternion rot; }
