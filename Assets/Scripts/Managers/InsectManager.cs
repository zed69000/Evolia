using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Fait correspondre le nombre d’insectes visibles
/// au nombre de fleurs mûres (Plant.IsMature) du jardin.
/// Placez‑le sur un GameObject “InsectManager”.
/// </summary>
public class InsectManager : MonoBehaviour
{
	[Header("Références globales")]
	public PlantManager plantManager;              // singleton existant
	public Transform insectsParent;                // conteneur hiérarchique

	[Header("Profils & ratios")]
	public List<FlyingInsectProfile> profiles;     // abeille, papillon, mouche…
	[Tooltip("Nombre d’insectes par fleur mûre, dans le même ordre que ‘profiles’")]
	public List<float> insectsPerFlower = new() { 0.2f }; // 1 abeille pour 5 fleurs

	[Header("Dynamique")]
	public float checkInterval = 2f;               // fréquence de mise à jour (sec)

	// Stockage interne : profils → instances actives
	private readonly Dictionary<FlyingInsectProfile, List<GameObject>> _active = new();

	void Awake()
	{
		// Sécurité : si PlantManager non assigné, récupérer le singleton.
		if (plantManager == null) plantManager = PlantManager.Instance;

		// Dictionnaire initial
		foreach (var p in profiles) _active[p] = new List<GameObject>();
	}

	void Start() => InvokeRepeating(nameof(RefreshPopulation), 0f, checkInterval);

	/// <summary> Ajuste la population toutes les ‘checkInterval’ secondes. </summary>
	void RefreshPopulation()
	{
		// 1) Compter les fleurs mûres via la méthode ajoutée dans PlantManager
		int flowers = plantManager.GetMaturePlants().Count;  // :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}

		for (int i = 0; i < profiles.Count; i++)
		{
			FlyingInsectProfile prof = profiles[i];
			float ratio = i < insectsPerFlower.Count ? insectsPerFlower[i] : 0f;
			int target = Mathf.RoundToInt(flowers * ratio);

			List<GameObject> list = _active[prof];

			// Trop d’insectes → on détruit l’excédent
			while (list.Count > target)
			{
				GameObject g = list[^1];
				list.RemoveAt(list.Count - 1);
				Destroy(g);
			}

			// Pas assez → on instancie
			while (list.Count < target)
			{
				Vector3 pos = GetRandomSpawnPosition();
				GameObject go = Instantiate(prof.prefab, pos, Quaternion.identity, insectsParent);

				// Assure que le prefab a bien le même profil
				if (go.TryGetComponent(out FlyingInsectBehaviour fib))
					fib.profile = prof;

				list.Add(go);
			}
		}
	}

	/// <summary>Position aléatoire dans le rectangle visuel du jardin.</summary>
	Vector3 GetRandomSpawnPosition()
	{
		Rect r = new Rect(-8f, -3f, 16f, 6f); // même valeurs que FlyingInsectBehaviour
		float x = Random.Range(r.xMin, r.xMax);
		float y = Random.Range(r.yMin, r.yMax) + 3f; // un peu au‑dessus
		return new Vector3(x, y, 0f);
	}
}
