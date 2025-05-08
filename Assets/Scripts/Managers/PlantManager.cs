using UnityEngine;
using System.Collections.Generic;

#region ──────────────────────────────── PLANT MANAGER ─────────────────────────
[ExecuteAlways]
public class PlantManager : MonoBehaviour
{
	public static PlantManager Instance;

	// ─────────────── PARAMÈTRES DYNAMIQUES ───────────────
	[Header("Taille dynamique de l’ellipse (min → max)")]
	[Tooltip("Rayon min au démarrage (X,Y)")] public Vector2 minRadius = new(1f, 0.5f);
	[Tooltip("Rayon max quand l’effort atteint effortForMaxSize")] public Vector2 maxRadius = new(10f, 4f);
	[Tooltip("Courbe de progression 0‑1 → échelle min→max")] public AnimationCurve progressToSize = AnimationCurve.Linear(0, 0, 1, 1);
	[Tooltip("Effort cumulé pour atteindre la taille max")] public float effortForMaxSize = 10_000f;

	// ─────────────── POSITION DE L’ELLIPSE ───────────────
	[Header("Ellipse – position dans le monde")]
	public Vector2 center = Vector2.zero;
	[Tooltip("Marge intérieure pour éviter le bord")] public float borderBuffer = .3f;

	// ─────────────── ZONES SOFT ───────────────
	[Header("Couronnes soft (facteurs relatifs)")]
	[Range(0f, 2f)] public float soft1Factor = 0.3f; [Range(0f, 1f)] public float soft1Prob = 0.5f;
	[Range(0f, 3f)] public float soft2Factor = 0.6f; [Range(0f, 1f)] public float soft2Prob = 0.2f;

	// ─────────────── SPACING / COLLISIONS ───────────────
	[Header("Espacement / détection")]
	public float minSpacing = 1f;
	public float detectionRadius = 0.6f;
	public LayerMask plantLayer;
	public int maxTries = 20;

	// ─────────────── DEBUG (lecture seule) ───────────────
	[Header("Debug – valeurs runtime (readonly)")]
	[SerializeField] float debugRadiusX; [SerializeField] float debugRadiusY;
	[SerializeField] float debugSoftZone1; [SerializeField] float debugSoftZone2;
	[SerializeField] float debugProgress;

	// ---------------- INTERNE ----------------
	float radiusX, radiusY, softZone1, softZone2;
	static readonly Collider2D[] _overlap = new Collider2D[1];
	readonly List<Plant> _matureBuffer = new();

	// ─────────────── UNITY ───────────────
	void Awake()
	{
		if (Instance == null) Instance = this; else if (Instance != this) { DestroyImmediate(gameObject); return; }
		UpdateDynamicRadii();
	}

	void Update()
	{
		if (Application.isPlaying) UpdateDynamicRadii();
	}

#if UNITY_EDITOR
	void OnValidate() { if (!Application.isPlaying) UpdateDynamicRadii(); }
#endif

	// ─────────────── LOGIQUE DYNAMIQUE ───────────────
	public void UpdateDynamicRadii()
	{
		float effort = ActivityTracker.Instance ? ActivityTracker.Instance.totalEffort : 0f;
		float t = effortForMaxSize <= 0f ? 0f : Mathf.Clamp01(effort / effortForMaxSize);
		float interp = progressToSize.Evaluate(t);

		radiusX = Mathf.Lerp(minRadius.x, maxRadius.x, interp);
		//radiusY = Mathf.Lerp(minRadius.y, maxRadius.y, interp);

		softZone1 = radiusX * soft1Factor;
		softZone2 = radiusX * soft2Factor;

		debugRadiusX = radiusX;
		//debugRadiusY = minRadius.y;
		debugSoftZone1 = softZone1;
		debugSoftZone2 = softZone2;
		debugProgress = interp;
	}

	// ─────────────── API PUBLIQUE ───────────────
	public void TryPlantNearby(Plant mature)
	{
		if (mature == null) return;
		Vector3 pos = GetFreePlantPositionNear(mature.transform.position);
		if (!IsFinite(pos)) return;
		Plant p = Instantiate(mature.activityType.plantPrefab, pos, Quaternion.identity).GetComponent<Plant>();
		p.activityType = mature.activityType;
	}

	// PlantManager.cs
public Vector3 GetFreePlantPositionNear(Vector3 origin)
{
    Ellipse main = new(center, radiusX, radiusY);
    Ellipse s1   = new(center, radiusX + softZone1, radiusY + softZone1);
    Ellipse s2   = new(center, radiusX + softZone1 + softZone2,
                       radiusY + softZone1 + softZone2);

    // Sécurise origin
    if (!IsFinite(origin)) origin = center;
    origin = ClampToEllipse(origin, s2);

    // Tentatives pour trouver un emplacement libre
    for (int i = 0; i < maxTries; ++i)
    {
        Vector3 cand = RandomInsideEllipse(s2, borderBuffer);
        if ((cand - origin).sqrMagnitude < minSpacing * minSpacing) continue;
        if (IsOccupied(cand)) continue;

        float accept = main.Contains(cand)
                        ? 1f
                        : (s1.Contains(cand) ? soft1Prob : soft2Prob);

        if (Random.value <= accept)
            return cand;
    }

    // — Fallback aléatoire au lieu du centre
    Vector3 fallbackRandom = RandomInsideEllipse(main, borderBuffer);
    Debug.LogWarning($"PlantManager: fallback aléatoire après {maxTries} essais → {fallbackRandom}");
    return fallbackRandom;
}


	public IList<Plant> GetMaturePlants()
	{
		_matureBuffer.Clear();
		foreach (Plant p in FindObjectsOfType<Plant>()) if (p.IsMature) _matureBuffer.Add(p);
		return _matureBuffer;
	}

	// ─────────────── UTILITAIRES ───────────────
	struct Ellipse { public Vector2 c; public float a, b; public Ellipse(Vector2 c, float a, float b) { this.c = c; this.a = a; this.b = b; } public bool Contains(Vector3 p) { float dx = (p.x - c.x) / a; float dy = (p.y - c.y) / b; return dx * dx + dy * dy <= 1f; } }

	static Vector3 ClampToEllipse(Vector3 p, Ellipse e)
	{
		Vector2 dir = new(p.x - e.c.x, p.y - e.c.y);
		if (dir == Vector2.zero || !IsFinite(dir)) return new Vector3(e.c.x, e.c.y, 0f);
		float k = (dir.x * dir.x) / (e.a * e.a) + (dir.y * dir.y) / (e.b * e.b);
		if (k <= 1f) return new Vector3(p.x, p.y, 0f);
		float root = Mathf.Sqrt(k);
		return new Vector3(e.c.x + dir.x / root, e.c.y + dir.y / root, 0f);
	}

	Vector3 RandomInsideEllipse(Ellipse e, float buffer)
	{
		float a = Mathf.Max(e.a - buffer, 0.01f);
		float b = Mathf.Max(e.b - buffer, 0.01f);
		float angle = Random.Range(0f, Mathf.PI * 2f);
		float r = Mathf.Sqrt(Random.value);
		return new Vector3(e.c.x + a * r * Mathf.Cos(angle), e.c.y + b * r * Mathf.Sin(angle), 0f);
	}

	bool IsOccupied(Vector3 pos)
		=> Physics2D.OverlapCircleNonAlloc(pos, detectionRadius, _overlap, plantLayer) > 0;

	static bool IsFinite(Vector3 v)
		=> !(float.IsNaN(v.x) || float.IsNaN(v.y) || float.IsNaN(v.z) || float.IsInfinity(v.x) || float.IsInfinity(v.y) || float.IsInfinity(v.z));

#if UNITY_EDITOR
	void OnDrawGizmos()
	{
		// IMPORTANT : recalcul systématique pour que la taille suive l’effort même
		// en mode Édition quand on force totalEffort dans l’Inspector.
		UpdateDynamicRadii();

		DrawEllipse(radiusX, radiusY, Color.yellow);
		DrawEllipse(radiusX + softZone1, radiusY + softZone1, new Color(1f, 0.5f, 0f, 0.25f));
		DrawEllipse(radiusX + softZone1 + softZone2, radiusY + softZone1 + softZone2, new Color(0.4f, 0.4f, 0.4f, 0.15f));
	}

	void DrawEllipse(float a, float b, Color col, int steps = 64)
	{
		Gizmos.color = col;
		Vector3 prev = center + new Vector2(a, 0);
		float dt = 2 * Mathf.PI / steps;
		for (int i = 1; i <= steps; ++i) { float t = i * dt; Vector3 cur = center + new Vector2(a * Mathf.Cos(t), b * Mathf.Sin(t)); Gizmos.DrawLine(prev, cur); prev = cur; }
	}
#endif
}
#endregion