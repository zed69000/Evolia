using UnityEngine;
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;

/// <summary>
/// Gestion centralisée de la persistance, du comptage, et du chargement des plantes,
/// incluant l'état de croissance courante.
/// Séparé du PlantManager pour plus de clarté.
/// </summary>
public static class PlantPersistenceManager
{
	// Chemin du fichier de sauvegarde
	private static readonly string SaveFileName = "plants.json";
	private static string SavePath => Path.Combine(Application.persistentDataPath, SaveFileName);

	/// <summary>
	/// Retourne un dictionnaire { activityName → count } des plantes en scène.
	/// </summary>
	public static Dictionary<string, int> GetPlantCounts()
	{
		return PlantManager.Instance.GetPlantCounts();
	}

	/// <summary>
	/// Sauvegarde l'état (type + transform + croissance) de toutes les plantes actives.
	/// </summary>
	public static void SaveAllPlants()
	{
		var all = UnityEngine.Object.FindObjectsByType<LSystem>(FindObjectsSortMode.None);
		var data = new List<PlantData>(all.Length);
		foreach (var p in all)
		{
			if (p.activityType == null) continue;
			data.Add(new PlantData
			{
				activityName = p.activityType.activityName,
				position = new SerializableVector3(p.transform.position),
				rotation = new SerializableQuaternion(p.transform.rotation),
				scale = new SerializableVector3(p.transform.localScale),
				growthProgress = p.CurrentGrowthProgress // propriété publique de LSystem
			});
		}

		var wrapper = new SerializationWrapper<PlantData>(data);
		string json = JsonUtility.ToJson(wrapper, prettyPrint: true);
		File.WriteAllText(SavePath, json);
		Debug.Log($"[PlantPersistenceManager] Saved {data.Count} plants to {SavePath}");
	}

	/// <summary>
	/// Charge automatiquement après le chargement de la scène.
	/// </summary>
	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
	private static void OnRuntimeLoad()
	{
		LoadAllPlants();
	}

	/// <summary>
	/// Charge et recrée toutes les plantes sauvegardées, en restaurant leur croissance.
	/// </summary>
	public static void LoadAllPlants()
	{
		if (!File.Exists(SavePath))
		{
			Debug.LogWarning($"[PlantPersistenceManager] No save file at {SavePath}");
			return;
		}

		string json = File.ReadAllText(SavePath);
		var wrapper = JsonUtility.FromJson<SerializationWrapper<PlantData>>(json);

		// Supprime d'abord les plantes existantes
		foreach (var p in UnityEngine.Object.FindObjectsByType<LSystem>(FindObjectsSortMode.None))
			UnityEngine.Object.DestroyImmediate(p.gameObject);

		// Recréation des plantes
		var allTypes = Resources.LoadAll<ActivityType>("");
		foreach (var d in wrapper.items)
		{
			var typeSO = allTypes.FirstOrDefault(t => t.activityName == d.activityName);
			if (typeSO == null)
			{
				Debug.LogError($"[PlantPersistenceManager] ActivityType '{d.activityName}' not found.");
				continue;
			}

			var go = UnityEngine.Object.Instantiate(
				typeSO.plantPrefab,
				d.position.ToVector3(),
				d.rotation.ToQuaternion()
			);
			go.transform.localScale = d.scale.ToVector3();
			var ls = go.GetComponent<LSystem>();
			ls.activityType = typeSO;
			ls.SetGrowthProgress(d.growthProgress); // méthode publique à implémenter pour restaurer l'état
		}

		Debug.Log($"[PlantPersistenceManager] Loaded {wrapper.items.Count} plants from {SavePath}");
	}

	#region Serialization Helpers
	[Serializable]
	private class SerializationWrapper<T>
	{
		public List<T> items;
		public SerializationWrapper(List<T> items) => this.items = items;
	}

	[Serializable]
	private class PlantData
	{
		public string activityName;
		public SerializableVector3 position;
		public SerializableQuaternion rotation;
		public SerializableVector3 scale;
		public float growthProgress;
	}

	[Serializable]
	private struct SerializableVector3
	{
		public float x, y, z;
		public SerializableVector3(Vector3 v) { x = v.x; y = v.y; z = v.z; }
		public Vector3 ToVector3() => new Vector3(x, y, z);
	}

	[Serializable]
	private struct SerializableQuaternion
	{
		public float x, y, z, w;
		public SerializableQuaternion(Quaternion q) { x = q.x; y = q.y; z = q.z; w = q.w; }
		public Quaternion ToQuaternion() => new Quaternion(x, y, z, w);
	}
	#endregion
}
