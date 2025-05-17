using UnityEngine;
using System.Collections.Generic;

#region ───────────────────────────── ACTIVITY TRACKER ─────────────────────────
public class ActivityTracker : MonoBehaviour
{
	public static ActivityTracker Instance;

	[Header("Mode de plantation")]
	[Tooltip("Si true, on n’instancie jamais plus d’une seule plante.")]
	public bool onlyOnePlant = false;

	[Tooltip("Parent vide pour les plantes")] public Transform plantsParent;
	[Tooltip("Liste des plantes actives")] public List<LSystem> activePlants = new();

	[Header("Debug – effort cumulé")] public float totalEffort;

	public static float GlobalGrowthMultiplier = 1f;

	//------------------------------------------------------------------
	void Awake()
	{
		if (Instance == null) Instance = this; else if (Instance != this) { DestroyImmediate(gameObject); return; }
	}

	//------------------------------------------------------------------
	// PUBLIC API
	//------------------------------------------------------------------
	/// <summary>Supprime toutes les plantes et réinitialise l’effort.</summary>
	public void ResetAllPlants()
	{
		foreach (var p in activePlants)
			if (p != null) Destroy(p.gameObject);

		activePlants.Clear();
		totalEffort = 0f;

		Debug.Log("🗑 Reset des plantes & de l’effort.");
	}

	/// <summary>
	/// Ajoute de l’effort pour une activité ; gère la croissance ou l’instanciation
	/// d’une plante correspondante puis notifie PlantManager.
	/// </summary>
	// ActivityTracker.cs
	public void AddEffort(ActivityType activity, float amount)
	{
		if (amount <= 0f || activity == null || activity.plantPrefab == null) return;

		// 1) Effort cumulé
		totalEffort += amount;

		LSystem plant = null;
		if (onlyOnePlant)
		{
			// si on a déjà une plante, on l’utilise
			if (activePlants.Count > 0)
				plant = activePlants[0];
		}
		else
		{
			// sinon on trouve la plante en cours pour cette activité
			plant = activePlants.Find(p => p != null
									   && p.activityType == activity
									   && p.growth < 1f);
		}

		// 3) Sinon, instancie une nouvelle graine
		if (plant == null)
		{
			// — On utilise le centre de l’ellipse comme "origin" pour le spawn
			Vector3 origin = PlantManager.Instance
						   ? (Vector3)PlantManager.Instance.center
						   : transform.position;

			Vector3 spawnPos = PlantManager.Instance
							 ? PlantManager.Instance.GetFreePlantPositionNear(origin)
							 : origin;

			GameObject go = Instantiate(activity.plantPrefab,
										spawnPos,
										Quaternion.identity,
										plantsParent);
			plant = go.GetComponent<LSystem>();
			plant.activityType = activity;
			plant.growth = 0f;
			activePlants.Add(plant);
			Debug.Log($"🌱 Nouvelle graine pour '{activity.activityName}'.");
		}

		// 4) Applique la croissance
		float adjustedAmount = amount * GlobalGrowthMultiplier;
		plant.AddGrowth(adjustedAmount);

	}


	//------------------------------------------------------------------
	// UTILITAIRES OPTIONNELS
	//------------------------------------------------------------------
	public void SetGlobalMultiplier(float multiplier) => GlobalGrowthMultiplier = Mathf.Max(0f, multiplier);
}
#endregion
