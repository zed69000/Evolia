using System;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

[ExecuteAlways]
public class ActivityEffortGraphUI : MonoBehaviour
{
	// ---------------------------------------------
	// STRUCTURES DE DONNÉES POUR L’INPUT DANS L’INSPECTOR
	// ---------------------------------------------
	[Serializable]
	public class ActivityEntry
	{
		[Tooltip("Référence au ScriptableObject définissant l'activité (vitesse, multiplicateur de l'effort, etc.)")]
		public ActivityData activityData;
		[Tooltip("Distance parcourue ce jour-là, en kilomètres.")]
		public float distanceKm;
	}

	[Serializable]
	public class DailyActivities
	{
		[Tooltip("Nom du jour, affiché dans l'inspecteur.")]
		public string dayName = "Jour 1";
		[Tooltip("Liste des activités et distances pour ce jour.")]
		public List<ActivityEntry> entries = new List<ActivityEntry>();
	}

	// ---------------------------------------------
	// CHAMPS PUBLICS POUR L'INSPECTOR
	// ---------------------------------------------
	[Header("Données d'activité (ScriptableObjects)")]
	[Tooltip("Glissez ici tous vos ScriptableObjects ActivityData.")]
	public ActivityData[] allActivitiesData;

	[Header("Saisie des activités par jour")]
	[Tooltip("Pour chaque jour, saisissez la distance parcourue pour chaque activité disponible.")]
	public List<DailyActivities> dailyActivities = new List<DailyActivities>();

	// ---------------------------------------------
	// VARIABLES INTERNES
	// ---------------------------------------------
	private List<DataPoint> totalEffortData = new List<DataPoint>();
	private Rect windowRect = new Rect(20, 20, 420, 200);

	// ---------------------------------------------
	// CYCLE DE VIE
	// ---------------------------------------------
	private void OnValidate()
	{
		SyncEntriesWithActivities();
		BuildTotalEffortData();
	}

	private void Start()
	{
		SyncEntriesWithActivities();
		BuildTotalEffortData();
	}

	private void OnGUI()
	{
		windowRect = GUI.Window(1, windowRect, DrawWindow, "📈 Effort Total / Jour");
	}

	// ---------------------------------------------
	// SYNCHRONISATION DES ENTRÉES AVEC allActivitiesData
	// ---------------------------------------------
	private void SyncEntriesWithActivities()
	{
		if (allActivitiesData == null || dailyActivities == null) return;

		foreach (var day in dailyActivities)
		{
			// Retire les entrées nulles ou obsolètes
			day.entries.RemoveAll(e => e.activityData == null || !allActivitiesData.Contains(e.activityData));

			// Assure une entrée par activité disponible
			foreach (var activity in allActivitiesData)
			{
				if (!day.entries.Any(e => e.activityData == activity))
				{
					day.entries.Add(new ActivityEntry { activityData = activity, distanceKm = 0f });
				}
			}

			// Trie selon l'ordre de allActivitiesData
			day.entries = day.entries
				.OrderBy(e => Array.IndexOf(allActivitiesData, e.activityData))
				.ToList();
		}
	}

	// ---------------------------------------------
	// CALCUL DE L'EFFORT TOTAL PAR JOUR
	// ---------------------------------------------
	private void BuildTotalEffortData()
	{
		totalEffortData.Clear();
		if (dailyActivities == null) return;

		for (int dayIndex = 0; dayIndex < dailyActivities.Count; dayIndex++)
		{
			float totalEffort = dailyActivities[dayIndex].entries
				.Where(e => e.activityData != null)
				.Sum(e =>
				{
					// 1) Convertir la distance en mètres
					float distanceMeters = e.distanceKm * 1000f;
					// 2) Points de base : 1 point tous les 10 mètres
					float basePoints = distanceMeters / 10f;
					// 3) Appliquer le multiplicateur d’effort
					return basePoints * e.activityData.effortMultiplier;
				});

			totalEffortData.Add(new DataPoint
			{
				activityName = dailyActivities[dayIndex].dayName,
				effort = totalEffort,
				timestamp = dayIndex
			});
		}
	}

	// ---------------------------------------------
	// MÉTHODES PUBLIQUES POUR RÉCUPÉRER LES DONNÉES
	// ---------------------------------------------
	/// <summary>
	/// Renvoie la liste des efforts totaux (toutes activités confondues) par jour.
	/// </summary>
	public List<float> GetEffortOverDays()
	{
		return totalEffortData.Select(dp => dp.effort).ToList();
	}

	/// <summary>
	/// Renvoie la liste des efforts pour une activité spécifique par jour.
	/// </summary>
	public List<float> GetEffortOverDays(ActivityData activity)
	{
		var list = new List<float>();
		if (activity == null || dailyActivities == null) return list;

		foreach (var day in dailyActivities)
		{
			float effort = day.entries
				.Where(e => e.activityData == activity)
				.Sum(e => e.distanceKm * activity.effortMultiplier);
			list.Add(effort);
		}
		return list;
	}

	/// <summary>
	/// Renvoie la liste des efforts pour une activité par son nom.
	/// </summary>
	public List<float> GetEffortOverDays(string activityName)
	{
		var activity = allActivitiesData?
			.FirstOrDefault(a => a.activityName.Equals(activityName, StringComparison.OrdinalIgnoreCase));
		return GetEffortOverDays(activity);
	}

	// ---------------------------------------------
	// AFFICHAGE DU GRAPHIQUE
	// ---------------------------------------------
	private void DrawWindow(int id)
	{
		if (totalEffortData == null || totalEffortData.Count < 2)
		{
			GUILayout.Label("Pas assez de données pour afficher le graphique.");
			GUI.DragWindow();
			return;
		}

		DrawEffortGraph(totalEffortData);
		GUI.DragWindow();
	}

	private void DrawEffortGraph(List<DataPoint> data)
	{
		Rect rect = GUILayoutUtility.GetRect(windowRect.width - 20, windowRect.height - 40);
#if UNITY_EDITOR
		Handles.BeginGUI();
		Handles.color = Color.green;

		float minX = data.First().timestamp;
		float maxX = data.Last().timestamp;
		float maxY = data.Max(dp => dp.effort);
		Vector2 prev = Vector2.zero;

		for (int i = 0; i < data.Count; i++)
		{
			float t = Mathf.InverseLerp(minX, maxX, data[i].timestamp);
			float e = maxY > 0f ? Mathf.InverseLerp(0, maxY, data[i].effort) : 0f;
			Vector2 p = new Vector2(rect.x + t * rect.width, rect.yMax - e * rect.height);
			if (i > 0) Handles.DrawLine(prev, p);
			prev = p;
			Handles.DrawSolidDisc(p, Vector3.forward, 3f);
		}

		Handles.EndGUI();
#endif
	}
}

[Serializable]
public class DataPoint
{
	public string activityName;
	public float effort;
	public float timestamp;
}
