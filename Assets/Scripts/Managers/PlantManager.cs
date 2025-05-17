using UnityEngine;
using System.Collections.Generic;
using System.Linq;

[ExecuteAlways]
public class PlantManager : MonoBehaviour
{
	public static PlantManager Instance;

	[Header("Ellipse – taille manuelle (X, Y)")]
	[Tooltip("Rayon horizontal (X) de l'ellipse")] public float radiusX = 5f;
	[Tooltip("Rayon vertical (Y) de l'ellipse")] public float radiusY = 2f;

	[Header("Ellipse – position dans le monde")]
	public Vector2 center = Vector2.zero;
	[Tooltip("Marge intérieure pour éviter le bord")] public float borderBuffer = 0.3f;

	[Header("Espacement / détection")]
	[Tooltip("Distance minimale entre plantes")] public float minSpacing = 1f;
	[Tooltip("Rayon de détection de collisions")] public float detectionRadius = 0.6f;
	public LayerMask plantLayer;
	[Tooltip("Nombre max de tentatives avant fallback")] public int maxTries = 20;

	// Buffer interne pour GetMaturePlants()
	readonly List<LSystem> _matureBuffer = new();

	void Awake()
	{
		if (Instance == null) Instance = this;
		else if (Instance != this) { DestroyImmediate(gameObject); return; }
	}

#if UNITY_EDITOR
	void OnDrawGizmos()
	{
		DrawEllipse(radiusX, radiusY, Color.yellow);
	}

	void DrawEllipse(float a, float b, Color col, int steps = 64)
	{
		Gizmos.color = col;
		Vector3 prev = center + new Vector2(a, 0);
		float dt = 2 * Mathf.PI / steps;
		for (int i = 1; i <= steps; ++i)
		{
			float t = i * dt;
			Vector3 cur = center + new Vector2(a * Mathf.Cos(t), b * Mathf.Sin(t));
			Gizmos.DrawLine(prev, cur);
			prev = cur;
		}
	}
#endif

	// Appel public : essaie de planter un clone « mature » près d’une origine
	public void TryPlantNearby(LSystem mature)
	{
		if (mature == null) return;

		Vector3 pos = GetFreePlantPositionNear(mature.transform.position);
		if (!IsFinite(pos)) return;

		var clone = Instantiate(
			mature.activityType.plantPrefab,
			pos,
			Quaternion.identity
		).GetComponent<LSystem>();

		clone.activityType = mature.activityType;
	}

	// Renvoie une position libre dans l’ellipse principale
	public Vector3 GetFreePlantPositionNear(Vector3 origin)
	{
		Ellipse main = new Ellipse(center, radiusX, radiusY);

		// Sécurise origin
		if (!IsFinite(origin)) origin = center;

		for (int i = 0; i < maxTries; i++)
		{
			Vector3 cand = RandomInsideEllipse(main, borderBuffer);

			// trop proche de l'origine ?
			if ((cand - origin).sqrMagnitude < minSpacing * minSpacing)
				continue;

			// collision avec une autre plante ?
			if (IsOccupied(cand))
				continue;

			// OK
			return cand;
		}

		// Fallback : random dans l'ellipse
		return RandomInsideEllipse(main, borderBuffer);
	}

	// Récupère toutes les plantes matures de la scène
	public IList<LSystem> GetMaturePlants()
	{
		_matureBuffer.Clear();
		var all = FindObjectsByType<LSystem>(FindObjectsSortMode.None);
		foreach (var p in all)
			if (p.IsMature)
				_matureBuffer.Add(p);
		return _matureBuffer;
	}

	public Dictionary<string, int> GetPlantCounts()
	{
		// Récupère toutes les plantes actives
		LSystem[] all = FindObjectsByType<LSystem>(FindObjectsSortMode.None);

		// Groupe par nom d’activité et compte
		return all
			.Where(p => p.activityType != null && !string.IsNullOrEmpty(p.activityType.activityName))
			.GroupBy(p => p.activityType.activityName)
			.ToDictionary(g => g.Key, g => g.Count());
	}

	// UTILITAIRES

	struct Ellipse
	{
		public Vector2 c;
		public float a, b;
		public Ellipse(Vector2 c, float a, float b) { this.c = c; this.a = a; this.b = b; }
		public bool Contains(Vector3 p)
		{
			float dx = (p.x - c.x) / a;
			float dy = (p.y - c.y) / b;
			return dx * dx + dy * dy <= 1f;
		}
	}

	Vector3 RandomInsideEllipse(Ellipse e, float buffer)
	{
		float a = Mathf.Max(e.a - buffer, 0.01f);
		float b = Mathf.Max(e.b - buffer, 0.01f);
		float angle = Random.Range(0f, Mathf.PI * 2f);
		float r = Mathf.Sqrt(Random.value);
		return new Vector3(
			e.c.x + a * r * Mathf.Cos(angle),
			e.c.y + b * r * Mathf.Sin(angle),
			0f
		);
	}

	bool IsOccupied(Vector3 pos)
	{
		var filter = new ContactFilter2D();
		filter.SetLayerMask(plantLayer);
		filter.useTriggers = true;
		return Physics2D.OverlapCircle(pos, detectionRadius, filter, new Collider2D[1]) > 0;
	}

	static bool IsFinite(Vector3 v)
	{
		return !(float.IsNaN(v.x) || float.IsInfinity(v.x)
			  || float.IsNaN(v.y) || float.IsInfinity(v.y)
			  || float.IsNaN(v.z) || float.IsInfinity(v.z));
	}
}
