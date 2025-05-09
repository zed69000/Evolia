using UnityEngine;
using UnityEditor;
using System.IO;

[CustomEditor(typeof(SO_LSystemConfig))]
public class LSystemConfigEditor : Editor
{
	public override void OnInspectorGUI()
	{
		DrawDefaultInspector();
		SO_LSystemConfig config = (SO_LSystemConfig)target;

		GUILayout.Space(10);

		if (GUILayout.Button("📤 Exporter en JSON"))
		{
			string path = EditorUtility.SaveFilePanel("Exporter L-System Config", "", "LSystemConfig.json", "json");
			if (!string.IsNullOrEmpty(path))
			{
				var data = new LSystemConfigData
				{
					axiom = config.axiom,
					rules = config.rules,
					savedRules = config.savedRules,
					iterations = config.iterations,
					angle = config.angle,
					segmentLength = config.segmentLength,
					drawDelay = config.drawDelay,
					segmentPrefabPath = AssetDatabase.GetAssetPath(config.segmentPrefab),
					petalPrefabs = config.petalPrefabs,
					leafPrefabs = config.leafPrefabs
				};

				File.WriteAllText(path, JsonUtility.ToJson(data, true));
				Debug.Log($"✅ Exporté : {path}");
			}
		}

		if (GUILayout.Button("📥 Importer depuis JSON"))
		{
			string path = EditorUtility.OpenFilePanel("Importer L-System Config", "", "json");
			if (!string.IsNullOrEmpty(path))
			{
				var json = File.ReadAllText(path);
				var data = JsonUtility.FromJson<LSystemConfigData>(json);

				config.axiom = data.axiom;
				config.rules = data.rules;
				config.savedRules = data.savedRules;
				config.iterations = data.iterations;
				config.angle = data.angle;
				config.segmentLength = data.segmentLength;
				config.drawDelay = data.drawDelay;

				config.segmentPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(data.segmentPrefabPath);
				config.petalPrefabs = data.petalPrefabs;
				config.leafPrefabs = data.leafPrefabs;

				EditorUtility.SetDirty(config);
				Debug.Log($"✅ Importé depuis : {path}");
			}
		}
	}
}
