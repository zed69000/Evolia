using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

[Serializable]
public enum PlantCategory { Flower, Grass, Herb, Tree, Other }

[Serializable]
public class PlantDefinition
{
	public string name;
	public PlantCategory category;
	public int effortCost;
	[Range(0f, 100f)] public float baseWeight;
	public bool unlocked = true;
	public bool isRare = false;
	[Header("Visuel HUD")] public string iconChar;
	public Color color = Color.white;
}

public enum BonusType { EffortMultiplier, ProbabilityMultiplier, FlatEffort, UnlockRare }

[Serializable]
public class InsectConfig
{
	public string name;
	[Tooltip("Types de plantes qui attirent cet insecte")] public List<PlantCategory> affectedCategories = new List<PlantCategory>();
	[Tooltip("Seuil de fleurs pour progression triangulaire")] public int baseThreshold = 3;
	[Tooltip("Type de bonus apporté")] public BonusType bonusType;
	[Tooltip("Valeur du bonus multiplicateur")] public float bonusMultiplier = 0.25f;
	[Tooltip("Valeur du bonus plat")] public int bonusFlat = 50;
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

	[Header("Effort fixe (si pas externe)")]
	public int baseEffortPerDay = 333;
	[Tooltip("Nombre de jours à simuler")]
	public int daysToSimulate = 14;

	[Header("Effort depuis activité externe (facultatif)")]
	public ActivityEffortGraphUI effortSource;
	public string effortActivity = "Course";

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
	private List<float> externalEfforts;

	// GUI layout
	private string[] headers;
	private int[] colW;
	private int[] colX;
	private int rowHeight;
	private const int colSpacing = 5;
	private const int tableTop = 10;
	private const int tableLeft = 10;

	private void Awake()
	{
		GenerateExternalEffort();
		Simulate();
		if(effortSource != null)
		prevGetEffortOverDaysCout = effortSource.GetEffortOverDays().Count;
	}

	private void OnValidate()
	{
		GenerateExternalEffort();
		Simulate();
	}

	private int prevGetEffortOverDaysCout;
	private void Update()
	{
		if(effortSource.GetEffortOverDays().Count > prevGetEffortOverDaysCout || effortSource.GetEffortOverDays().Count < prevGetEffortOverDaysCout)
		{
			Simulate();
		}
	}

	[ContextMenu("Résimuler")]
	public void Simulate()
	{
		if (context == null)
			context = new SimulationContext();

		// Prepare external effort data
		GenerateExternalEffort();

		// Reset context
		context.garden.Clear();
		context.totalPlants = 0;
		context.dayResults.Clear();

		// Lock rare plants
		foreach (var pd in allPlants)
			pd.unlocked = !pd.isRare;

		// Determine minimum planting cost
		int minCost = allPlants.Where(p => p.unlocked).Select(p => p.effortCost).DefaultIfEmpty(1).Min();

		// Simulate days
		for (int day = 1; day <= daysToSimulate; day++)
		{
			int prevTotal = context.totalPlants;

			// Insect bonuses
			var counts = new Dictionary<string, int>();
			float multE = 1f, multP = 1f;
			int flat = 0;

			foreach (var ic in insectConfigs)
			{
				// Count relevant plants
				int relevantCount = context.garden.Where(kv =>
				{
					var pd = allPlants.Find(p => p.name == kv.Key);
					return pd != null && ic.affectedCategories.Contains(pd.category);
				}).Sum(kv => kv.Value);

				// Triangular formula
				int n = 0;
				if (relevantCount >= ic.baseThreshold)
				{
					float d = 1f + 8f * relevantCount / ic.baseThreshold;
					n = Mathf.FloorToInt((Mathf.Sqrt(d) - 1f) / 2f);
				}
				counts[ic.name] = n;

				// Apply bonuses
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
					case BonusType.UnlockRare:
						var rares = allPlants.Where(p => p.isRare).ToList();
						for (int i = 0; i < Mathf.Min(n, rares.Count); i++)
							rares[i].unlocked = true;
						break;
				}
			}

			// Base effort
			float baseEffort = baseEffortPerDay;
			if (externalEfforts != null && day - 1 < externalEfforts.Count)
				baseEffort = externalEfforts[day - 1];
			float effortLeft = baseEffort * multE + flat;

			// Planting
			while (effortLeft >= minCost)
			{
				var pool = allPlants.Where(p => p.unlocked && p.effortCost <= effortLeft).ToList();
				if (pool.Count == 0) break;

				float totalW = pool.Sum(p => p.baseWeight * multP);
				float r = UnityEngine.Random.Range(0f, totalW);
				float acc = 0f;
				var pick = pool.Last();
				foreach (var p in pool)
				{
					acc += p.baseWeight * multP;
					if (r <= acc)
					{
						pick = p;
						break;
					}
				}

				context.garden[pick.name] = context.garden.GetValueOrDefault(pick.name) + 1;
				context.totalPlants++;
				effortLeft -= pick.effortCost;
			}

			// Build types string
			string typesStr = string.Join(" ", context.garden.Select(kv =>
			{
				var def = allPlants.Find(p => p.name == kv.Key);
				return def != null ? def.iconChar + kv.Value : string.Empty;
			}).Where(s => !string.IsNullOrEmpty(s)));

			// Record DayResult
			var dr = new DayResult
			{
				day = day,
				plantsPushed = context.totalPlants - prevTotal,
				typesStr = typesStr,
				effortUsed = Mathf.RoundToInt(baseEffort),
				recalculatedEffort = baseEffort * multE + flat,
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
			cells.AddRange(insectConfigs.Select(ic => counts[ic.name].ToString()));
			dr.cells = cells.ToArray();
			context.dayResults.Add(dr);
		}

		BuildLayout();
	}

	private void GenerateExternalEffort()
	{
		if (effortSource != null)
		{
			externalEfforts = effortSource.GetEffortOverDays();
			daysToSimulate = externalEfforts.Count;
		}
		else
			externalEfforts = null;
	}

	private void BuildLayout()
	{
		var hdrs = new List<string> { "Jour", "Push", "Types", "EffortUsed", "EffortRecalc", "EffortMult", "ProbMult", "FlatBonus", "TotalPlants" };
		hdrs.AddRange(insectConfigs.Select(ic => ic.name));
		headers = hdrs.ToArray();

		int cols = headers.Length;
		if (columnWidths == null || columnWidths.Count != cols)
			columnWidths = Enumerable.Repeat(0, cols).ToList();

		colW = new int[cols]; colX = new int[cols];
		rowHeight = cellFontSize + 4;
		int px = 0;
		for (int i = 0; i < cols; i++)
		{
			int wAuto = Mathf.Max((headers[i].Length + 1) * cellFontSize, 80);
			colW[i] = columnWidths[i] > 0 ? columnWidths[i] : wAuto;
			colX[i] = px;
			px += colW[i] + colSpacing;
		}
	}

	private void OnGUI()
	{
		if (context == null || headers == null || context.dayResults == null)
			return;

		int cols = headers.Length;
		int rows = context.dayResults.Count;
		int tableHgt = rowHeight * (rows + 1);
		int viewHgt = Math.Min(tableHgt, Screen.height - tableTop - 20);

		Rect vr = new Rect(tableLeft, tableTop,
			Mathf.Min(colX[cols - 1] + colW[cols - 1] + colSpacing,
					  Screen.width - tableLeft - 20),
			viewHgt);
		Rect cr = new Rect(0, 0,
			colX[cols - 1] + colW[cols - 1] + colSpacing,
			tableHgt);
		scrollPos = GUI.BeginScrollView(vr, scrollPos, cr);

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

		// Draw headers
		for (int i = 0; i < cols; i++)
			GUI.Label(new Rect(colX[i], 0, colW[i], rowHeight), headers[i], hs);

		// Draw rows
		int first = Mathf.FloorToInt(scrollPos.y / rowHeight);
		int last = Mathf.Min(rows, first + Mathf.CeilToInt(vr.height / rowHeight));
		for (int r = first; r < last; r++)
		{
			int y = (r + 1) * rowHeight;
			var dr = context.dayResults[r];
			for (int i = 0; i < dr.cells.Length; i++)
				GUI.Label(new Rect(colX[i], y, colW[i], rowHeight), dr.cells[i], csR);
		}

		GUI.EndScrollView();
	}
}
