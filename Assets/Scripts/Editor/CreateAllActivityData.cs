using UnityEngine;
using UnityEditor;
using System.IO;

public class ActivityDataCreator
{
	[MenuItem("Tools/Create Default Activity Data")]
	public static void CreateAllActivityData()
	{
		string folderPath = "Assets/Data/Activities";
		if (!Directory.Exists(folderPath))
			Directory.CreateDirectory(folderPath);

		CreateActivity("Menage", 0f, 0.5f, 1f, true, folderPath);
		CreateActivity("MarcheLente", 2f, 0.8f, 2.5f, false, folderPath);
		CreateActivity("MarcheNormale", 3.5f, 1f, 4f, false, folderPath);
		CreateActivity("MarcheRapide", 5f, 1.3f, 5.5f, false, folderPath);
		CreateActivity("MarcheTresRapide", 6.5f, 1.6f, 7f, false, folderPath);
		CreateActivity("Jogging", 7.5f, 2f, 8f, false, folderPath);
		CreateActivity("CourseModeree", 9f, 2.5f, 10.5f, false, folderPath);
		CreateActivity("CourseRapide", 12f, 3f, 13.5f, false, folderPath);
		CreateActivity("Sprint", 15f, 4f, 16f, false, folderPath);

		AssetDatabase.SaveAssets();
		AssetDatabase.Refresh();

		Debug.Log("Tous les ActivityData ont été créés !");
	}

	private static void CreateActivity(string name, float minSpeed, float multiplier, float baseSpeed, bool indoor, string path)
	{
		ActivityData asset = ScriptableObject.CreateInstance<ActivityData>();
		asset.activityName = name;
		asset.minSpeedKmh = minSpeed;
		asset.effortMultiplier = multiplier;
		asset.baseSpeedKmh = baseSpeed;
		asset.isIndoor = indoor;

		string fullPath = Path.Combine(path, name + ".asset");
		AssetDatabase.CreateAsset(asset, fullPath);
	}
}
