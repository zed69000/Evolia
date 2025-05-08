#if UNITY_EDITOR
using UnityEditor;
using Unity.EditorCoroutines.Editor;
#endif
using UnityEngine;
using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;

public class LSystemVisualizerWindow : EditorWindow
{
	// — Prefabs pour le preview —
	GameObject segmentPrefab;
	List<GameObject> petalPrefabs = new List<GameObject>();
	List<GameObject> leafPrefabs = new List<GameObject>();

	// — Grammar —
	string axiom = "F";
	int iterations = 3;
	float angle = 25f;
	float segmentLength = 1f;
	float drawDelay = 0.1f; // tempo entre chaque segment

	// — Rules —
	List<string> ruleSyms = new List<string> { "F" };
	List<List<string>> ruleReps = new List<List<string>> { new List<string> { "F[+F]F[-F]F" } };
	List<List<float>> ruleProbs = new List<List<float>> { new List<float> { 1f } };

	// — Randomization —
	Vector2 globalScaleRange = new Vector2(0.8f, 1.2f);
	Vector2 segLenVariation = new Vector2(0.8f, 1.2f);
	Vector2 angleVariation = new Vector2(0.8f, 1.2f);

	// — Presets —
	string presetsFolder;
	List<string> presetNames = new List<string>();
	string newPresetName = "NewPreset";

	// — Preview root & coroutine —
	static GameObject previewRoot;
#if UNITY_EDITOR
	EditorCoroutine previewCoroutine;
#endif

	Vector2 scroll;

	[MenuItem("Tools/L-System Visualizer")]
	public static void ShowWindow() => GetWindow<LSystemVisualizerWindow>("L-System Visualizer");

	void OnEnable()
	{
		presetsFolder = Path.Combine(Application.dataPath, "LSystemVisualizerPresets");
		if (!Directory.Exists(presetsFolder))
			Directory.CreateDirectory(presetsFolder);
		RefreshPresets();
	}

	void OnGUI()
	{
		scroll = EditorGUILayout.BeginScrollView(scroll);

		// --- Prefabs ---
		EditorGUILayout.LabelField("Prefabs for Preview", EditorStyles.boldLabel);
		segmentPrefab = (GameObject)EditorGUILayout.ObjectField("Segment Prefab", segmentPrefab, typeof(GameObject), false);

		EditorGUILayout.LabelField("Petal Prefabs");
		for (int i = 0; i < petalPrefabs.Count; i++)
		{
			EditorGUILayout.BeginHorizontal();
			petalPrefabs[i] = (GameObject)EditorGUILayout.ObjectField(petalPrefabs[i], typeof(GameObject), false);
			if (GUILayout.Button("x", GUILayout.Width(20))) { petalPrefabs.RemoveAt(i); i--; }
			EditorGUILayout.EndHorizontal();
		}
		if (GUILayout.Button("+ Add Petal Prefab")) petalPrefabs.Add(null);

		EditorGUILayout.LabelField("Leaf Prefabs");
		for (int i = 0; i < leafPrefabs.Count; i++)
		{
			EditorGUILayout.BeginHorizontal();
			leafPrefabs[i] = (GameObject)EditorGUILayout.ObjectField(leafPrefabs[i], typeof(GameObject), false);
			if (GUILayout.Button("x", GUILayout.Width(20))) { leafPrefabs.RemoveAt(i); i--; }
			EditorGUILayout.EndHorizontal();
		}
		if (GUILayout.Button("+ Add Leaf Prefab")) leafPrefabs.Add(null);

		EditorGUILayout.Space();

		// --- Grammar ---
		EditorGUILayout.LabelField("Grammar", EditorStyles.boldLabel);
		axiom = EditorGUILayout.TextField("Axiom", axiom);
		iterations = EditorGUILayout.IntSlider("Iterations", iterations, 0, 7);
		angle = EditorGUILayout.FloatField("Angle", angle);
		segmentLength = EditorGUILayout.FloatField("Segment Length", segmentLength);
		drawDelay = EditorGUILayout.FloatField("Draw Delay", drawDelay);

		EditorGUILayout.Space();

		// --- Rules ---
		EditorGUILayout.LabelField("Rules", EditorStyles.boldLabel);
		for (int i = 0; i < ruleSyms.Count; i++)
		{
			EditorGUILayout.BeginHorizontal();
			ruleSyms[i] = EditorGUILayout.TextField(ruleSyms[i], GUILayout.Width(30));
			for (int j = 0; j < ruleReps[i].Count; j++)
			{
				ruleReps[i][j] = EditorGUILayout.TextField(ruleReps[i][j], GUILayout.Width(80));
				ruleProbs[i][j] = EditorGUILayout.FloatField(ruleProbs[i][j], GUILayout.Width(40));
			}
			if (GUILayout.Button("+", GUILayout.Width(20)))
			{
				ruleReps[i].Add("");
				ruleProbs[i].Add(1f);
			}
			if (GUILayout.Button("-", GUILayout.Width(20)) && ruleReps[i].Count > 0)
			{
				ruleReps[i].RemoveAt(ruleReps[i].Count - 1);
				ruleProbs[i].RemoveAt(ruleProbs[i].Count - 1);
			}
			EditorGUILayout.EndHorizontal();
		}
		if (GUILayout.Button("Add Rule"))
		{
			ruleSyms.Add("X");
			ruleReps.Add(new List<string> { "" });
			ruleProbs.Add(new List<float> { 1f });
		}

		EditorGUILayout.Space();

		// --- Randomization ---
		EditorGUILayout.LabelField("Randomization", EditorStyles.boldLabel);
		globalScaleRange = EditorGUILayout.Vector2Field("Global Scale Range", globalScaleRange);
		segLenVariation = EditorGUILayout.Vector2Field("Segment Length Variation", segLenVariation);
		angleVariation = EditorGUILayout.Vector2Field("Angle Variation", angleVariation);

		EditorGUILayout.Space();

		// --- Actions ---
		EditorGUILayout.BeginHorizontal();
		if (GUILayout.Button("Preview"))
		{
			ClearPreview();
			StartPreview();
		}
		if (GUILayout.Button("Clear"))
		{
			ClearPreview();
		}
		EditorGUILayout.EndHorizontal();

		EditorGUILayout.Space();

		// --- Presets ---
		EditorGUILayout.LabelField("Presets", EditorStyles.boldLabel);
		newPresetName = EditorGUILayout.TextField("Preset Name", newPresetName);
		EditorGUILayout.BeginHorizontal();
		if (GUILayout.Button("Save")) SavePreset();
		if (GUILayout.Button("Refresh")) RefreshPresets();
		EditorGUILayout.EndHorizontal();

		foreach (var name in presetNames.ToArray())
		{
			EditorGUILayout.BeginHorizontal();
			if (GUILayout.Button(name, GUILayout.Width(200)))
				LoadPreset(name);
			if (GUILayout.Button("Del", GUILayout.Width(40)))
				DeletePreset(name);
			EditorGUILayout.EndHorizontal();
		}

		EditorGUILayout.EndScrollView();
	}

	void StartPreview()
	{
#if UNITY_EDITOR
		if (previewCoroutine != null)
			EditorCoroutineUtility.StopCoroutine(previewCoroutine);

		previewCoroutine = EditorCoroutineUtility.StartCoroutineOwnerless(PreviewRoutine());
#endif
	}

	IEnumerator PreviewRoutine()
	{
		if (segmentPrefab == null)
		{
			Debug.LogError("Assign a segment prefab first!");
			yield break;
		}

		previewRoot = new GameObject("LSystemPreviewRoot");

		// 1) build sequence
		var rngDet = new System.Random(12345);
		string seq = axiom;
		for (int it = 0; it < iterations; it++)
		{
			var next = "";
			foreach (char c in seq)
			{
				int ri = ruleSyms.FindIndex(s => s.Length > 0 && s[0] == c);
				if (ri >= 0 && ruleReps[ri].Count > 0)
				{
					float total = 0;
					foreach (var p in ruleProbs[ri]) total += p;
					float r = (float)(rngDet.NextDouble() * total);
					int sel = 0;
					while (sel < ruleProbs[ri].Count - 1 && r > ruleProbs[ri][sel])
					{
						r -= ruleProbs[ri][sel];
						sel++;
					}
					next += ruleReps[ri][sel];
				}
				else next += c;
			}
			seq = next;
		}

		// 2) randomization values
		float gscale = UnityEngine.Random.Range(globalScaleRange.x, globalScaleRange.y);
		float slen = segmentLength * UnityEngine.Random.Range(segLenVariation.x, segLenVariation.y);
		float a = angle * UnityEngine.Random.Range(angleVariation.x, angleVariation.y);

		previewRoot.transform.localScale = Vector3.one * gscale;

		// 3) instantiate head + TrailRenderer
		var head = Instantiate(segmentPrefab, previewRoot.transform);
		head.transform.localPosition = Vector3.zero;
		var trail = head.GetComponent<TrailRenderer>();
		if (trail != null)
			trail.time = Mathf.Max(trail.time, iterations * drawDelay * 1.5f);

		Vector3 pos = Vector3.zero;
		Quaternion rot = Quaternion.identity;
		var stack = new Stack<(Vector3, Quaternion)>();

		// 4) move head step-by-step
		foreach (char c in seq)
		{
			switch (c)
			{
				case 'F':
					pos += rot * Vector3.up * slen;
					head.transform.localPosition = pos;
					break;
				case '+':
					rot *= Quaternion.Euler(0, 0, a);
					break;
				case '-':
					rot *= Quaternion.Euler(0, 0, -a);
					break;
				case '[':
					stack.Push((pos, rot));
					break;
				case ']':
					var st = stack.Pop();
					pos = st.Item1; rot = st.Item2;
					head.transform.localPosition = pos;
					break;
				case 'X':
					if (petalPrefabs.Count > 0)
					{
						var pf = petalPrefabs[UnityEngine.Random.Range(0, petalPrefabs.Count)];
						var go = Instantiate(pf, previewRoot.transform);
						go.transform.localPosition = pos;
					}
					break;
				case 'L':
					if (leafPrefabs.Count > 0)
					{
						var lf = leafPrefabs[UnityEngine.Random.Range(0, leafPrefabs.Count)];
						var go = Instantiate(lf, previewRoot.transform);
						go.transform.localPosition = pos;
					}
					break;
			}
			yield return new EditorWaitForSeconds(drawDelay);
		}
	}

	void ClearPreview()
	{
		if (previewRoot != null)
		{
			DestroyImmediate(previewRoot);
			previewRoot = null;
		}
	}

	[Serializable]
	class PresetData
	{
		public string axiom;
		public int iterations;
		public float angle, segmentLength, drawDelay;
		public List<string> ruleSyms;
		public List<List<string>> ruleReps;
		public List<List<float>> ruleProbs;
		public Vector2 globalScaleRange, segLenVariation, angleVariation;
	}

	void SavePreset()
	{
		var data = new PresetData
		{
			axiom = axiom,
			iterations = iterations,
			angle = angle,
			segmentLength = segmentLength,
			drawDelay = drawDelay,
			ruleSyms = new List<string>(ruleSyms),
			ruleReps = new List<List<string>>(ruleReps),
			ruleProbs = new List<List<float>>(ruleProbs),
			globalScaleRange = globalScaleRange,
			segLenVariation = segLenVariation,
			angleVariation = angleVariation
		};
		var path = Path.Combine(presetsFolder, newPresetName + ".json");
		File.WriteAllText(path, JsonUtility.ToJson(data, true));
		RefreshPresets();
	}

	void RefreshPresets()
	{
		presetNames.Clear();
		foreach (var f in Directory.GetFiles(presetsFolder, "*.json"))
			presetNames.Add(Path.GetFileNameWithoutExtension(f));
	}

	void LoadPreset(string name)
	{
		var path = Path.Combine(presetsFolder, name + ".json");
		if (!File.Exists(path)) return;
		var data = JsonUtility.FromJson<PresetData>(File.ReadAllText(path));
		axiom = data.axiom;
		iterations = data.iterations;
		angle = data.angle;
		segmentLength = data.segmentLength;
		drawDelay = data.drawDelay;
		ruleSyms = new List<string>(data.ruleSyms);
		ruleReps = new List<List<string>>(data.ruleReps);
		ruleProbs = new List<List<float>>(data.ruleProbs);
		globalScaleRange = data.globalScaleRange;
		segLenVariation = data.segLenVariation;
		angleVariation = data.angleVariation;
	}

	void DeletePreset(string name)
	{
		var path = Path.Combine(presetsFolder, name + ".json");
		if (File.Exists(path)) File.Delete(path);
		RefreshPresets();
	}
}
