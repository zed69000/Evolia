using System;
using System.Collections.Generic;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

[Serializable]
public class PlantDefinition
{
	public string name;
	public int effortCost;
	[Range(0f, 100f)] public float baseWeight;
	public bool unlocked = true;
	[Header("Visuel HUD")] public string iconChar;
	public Color color = Color.white;
}

public enum BonusType { EffortMultiplier, ProbabilityMultiplier, FlatEffort }

[Serializable]
public class InsectConfig
{
	public string name;
	[Tooltip("Seuil de fleurs pour progression triangulaire")]
	public int baseThreshold = 3;
	[Tooltip("Type de bonus apporté")]
	public BonusType bonusType;
	[Tooltip("Valeur du bonus multiplicateur")]
	public float bonusMultiplier = 0.25f;
	[Tooltip("Valeur du bonus plat")]
	public int bonusFlat = 50;
}

[Serializable]
public class DayResult
{
	public int day;
	public int plantsPushed;
	public string typesStr;
	public int effortUsed;
	public float recalculatedEffort;
	public float effortMultiplier;
	public float probabilityMultiplier;
	public int flatBonus;
	public int totalPlants;
	public Dictionary<string, int> insectCounts;
	[NonSerialized] public string[] cells;
}

public class SimulationContext
{
	public Dictionary<string, int> garden = new Dictionary<string, int>();
	public List<DayResult> dayResults = new List<DayResult>();
	public int totalPlants = 0;
}

[ExecuteAlways]
public class PrairieSimulator : MonoBehaviour
{
	[Header("Plantes (communes + rares)")]
	public List<PlantDefinition> allPlants;

	[Header("Effort par jour")]
	public int baseEffortPerDay = 333;
	public int daysToSimulate = 14;

	[Header("Insect Configurations")]
	public List<InsectConfig> insectConfigs = new List<InsectConfig>();

	[Header("HUD Font Sizes")]
	public int headerFontSize = 20;
	public int cellFontSize = 16;

	[Header("HUD Colors")]
	public Color headerTextColor = Color.white;
	public Color cellTextColor = Color.white;

	[Header("HUD Column Widths")]
	[Tooltip("0 = auto, >0 = fixed width (pixels)")]
	public List<int> columnWidths = new List<int>();

	private SimulationContext context = new SimulationContext();
	private Vector2 scrollPos;

	// Layout
	private string[] headers;
	private int[] colW;
	private int[] colX;
	private int rowHeight;
	private const int colSpacing = 5;
	private const int tableTop = 10;
	private const int tableLeft = 10;

	private void OnValidate()
	{
		Simulate();
	}

	[ContextMenu("Résimuler")]
	public void Simulate()
	{
		// Reset context
		context = new SimulationContext();
		context.garden.Clear();
		context.totalPlants = 0;
		context.dayResults.Clear();

		// Determine min cost
		int minCost = int.MaxValue;
		foreach (var p in allPlants)
			if (p.unlocked)
				minCost = Math.Min(minCost, p.effortCost);
		minCost = Math.Max(minCost, 1);

		// Simulate days
		for (int day = 1; day <= daysToSimulate; day++)
		{
			int prevTotal = context.totalPlants;

			// Insect counts & bonuses
			var counts = new Dictionary<string, int>();
			float multE = 1f, multP = 1f;
			int flat = 0;
			foreach (var ic in insectConfigs)
			{
				int n = 0;
				if (context.totalPlants >= ic.baseThreshold)
				{
					float d = 1f + 8f * context.totalPlants / ic.baseThreshold;
					n = Mathf.FloorToInt((Mathf.Sqrt(d) - 1f) / 2f);
				}
				counts[ic.name] = n;
				switch (ic.bonusType)
				{
					case BonusType.EffortMultiplier:
						multE += n * ic.bonusMultiplier;
						break;
					case BonusType.ProbabilityMultiplier:
						multP += n * ic.bonusMultiplier;
						break;
					case BonusType.FlatEffort:
						flat += n * ic.bonusFlat;
						break;
				}
			}
			float effortLeft = baseEffortPerDay * multE + flat;

			// Planting
			while (effortLeft >= minCost)
			{
				var pool = new List<PlantDefinition>();
				foreach (var p in allPlants)
					if (p.unlocked && p.effortCost <= effortLeft)
						pool.Add(p);
				if (pool.Count == 0) break;

				float totalW = 0f;
				foreach (var p in pool) totalW += p.baseWeight * multP;
				float r = UnityEngine.Random.Range(0f, totalW);
				float acc = 0f;
				PlantDefinition pick = pool[pool.Count - 1];
				foreach (var p in pool)
				{
					acc += p.baseWeight * multP;
					if (r <= acc)
					{
						pick = p;
						break;
					}
				}

				context.garden.TryGetValue(pick.name, out int c);
				context.garden[pick.name] = c + 1;
				context.totalPlants++;
				effortLeft -= pick.effortCost;
			}

			// typesStr
			string typesStr = "";
			foreach (var kv in context.garden)
			{
				var def = allPlants.Find(p => p.name == kv.Key);
				if (def != null && !string.IsNullOrEmpty(def.iconChar))
					typesStr += def.iconChar + kv.Value + " ";
			}

			// DayResult
			var dr = new DayResult
			{
				day = day,
				plantsPushed = context.totalPlants - prevTotal,
				typesStr = typesStr,
				effortUsed = baseEffortPerDay,
				recalculatedEffort = baseEffortPerDay * multE + flat,
				effortMultiplier = multE,
				probabilityMultiplier = multP,
				flatBonus = flat,
				totalPlants = context.totalPlants,
				insectCounts = counts
			};
			var cells = new List<string>
			{
				dr.day.ToString(),
				dr.plantsPushed.ToString(),
				dr.typesStr,
				dr.effortUsed.ToString(),
				dr.recalculatedEffort.ToString("F2"),
				dr.effortMultiplier.ToString("F2"),
				dr.probabilityMultiplier.ToString("F2"),
				dr.flatBonus.ToString(),
				dr.totalPlants.ToString()
			};
			foreach (var ic in insectConfigs) cells.Add(counts[ic.name].ToString());
			dr.cells = cells.ToArray();
			context.dayResults.Add(dr);
		}

		BuildLayout();
	}

	private void BuildLayout()
	{
		var hdrs = new List<string> { "Jour", "Push", "Types", "EffortUsed", "EffortRecalc", "EffortMult", "ProbMult", "FlatBonus", "TotalPlants" };
		hdrs.AddRange(insectConfigs.ConvertAll(ic => ic.name));
		headers = hdrs.ToArray();
		int cols = headers.Length;

		if (columnWidths == null || columnWidths.Count != cols)
			columnWidths = new List<int>(new int[cols]);

		colW = new int[cols];
		colX = new int[cols];
		rowHeight = cellFontSize + 4;

		for (int i = 0; i < cols; i++)
		{
			int wAuto = Mathf.Max((headers[i].Length + 1) * cellFontSize, 80);
			colW[i] = columnWidths[i] > 0 ? columnWidths[i] : wAuto;
		}

		int px = 0;
		for (int i = 0; i < cols; i++)
		{
			colX[i] = px;
			px += colW[i] + colSpacing;
		}
	}

	void OnGUI()
	{
		if (headers == null) return;

		int cols = headers.Length;
		int[] drawW = new int[cols];
		int[] drawX = new int[cols];
		Array.Copy(colW, drawW, cols);

		int px = 0;
		for (int i = 0; i < cols; i++)
		{
			drawX[i] = px;
			px += drawW[i] + colSpacing;
		}

		var hs = new GUIStyle(GUI.skin.label)
		{
			alignment = TextAnchor.MiddleCenter,
			fontSize = headerFontSize,
			fontStyle = FontStyle.Bold,
			normal = { textColor = headerTextColor },
			wordWrap = false
		};
		var csR = new GUIStyle(GUI.skin.label)
		{
			alignment = TextAnchor.MiddleRight,
			fontSize = cellFontSize,
			normal = { textColor = cellTextColor },
			wordWrap = false
		};

		int rows = context.dayResults.Count;
		int tableHgt = rowHeight * (rows + 1);
		int viewHgt = Mathf.Min(tableHgt, Screen.height - tableTop - 20);
		Rect vr = new Rect(tableLeft, tableTop,
			Mathf.Min(drawX[cols - 1] + drawW[cols - 1] + colSpacing,
					  Screen.width - tableLeft - 20),
			viewHgt);
		Rect cr = new Rect(0, 0,
			drawX[cols - 1] + drawW[cols - 1] + colSpacing,
			tableHgt);
		scrollPos = GUI.BeginScrollView(vr, scrollPos, cr);

		// headers
		for (int i = 0; i < cols; i++)
			GUI.Label(new Rect(drawX[i], 0, drawW[i], rowHeight), headers[i], hs);

		int first = Mathf.FloorToInt(scrollPos.y / rowHeight);
		int last = Mathf.Min(rows, first + Mathf.CeilToInt(vr.height / rowHeight));
		for (int r = first; r < last; r++)
		{
			int y = (r + 1) * rowHeight;
			var dr = context.dayResults[r];
			for (int i = 0; i < dr.cells.Length; i++)
				GUI.Label(new Rect(drawX[i], y, drawW[i], rowHeight), dr.cells[i], csR);
		}

		GUI.EndScrollView();
	}
}
