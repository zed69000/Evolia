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
	[Serializable]
	public class ActivityEntry
	{
		[Tooltip("Activity SO defining speed and effort multiplier")] public ActivityData activityData;
		[Tooltip("Distance covered that day, in kilometers")][Min(0)] public float distanceKm;
	}

	[Serializable]
	public class DailyActivities
	{
		[Tooltip("Label of the day in the inspector")] public string dayName = "Jour 1";
		[Tooltip("List of activity entries for this day")] public List<ActivityEntry> entries = new List<ActivityEntry>();
	}

	[Header("Available Activities (SO)")]
	public ActivityData[] allActivitiesData;

	[Header("Activities Per Day")]
	public List<DailyActivities> dailyActivities = new List<DailyActivities>();

	[Header("Plant Simulator Source")]
	[Tooltip("Reference to PrairieSimulator for daily plant counts")] public PrairieSimulator plantSimulatorSource;

	private List<DataPoint> totalEffortData = new List<DataPoint>();
	private List<DataPoint> totalPlantData = new List<DataPoint>();

	private Rect windowRect = new Rect(20, 20, 1900, 400);
	private bool isResizing = false;
	private Vector2 resizeStart;
	private Rect resizeRectStart;
	private const float minWidth = 200f;
	private const float minHeight = 120f;
	private const float handleSize = 12f;

#if UNITY_EDITOR
	private static GUIStyle labelStyle;
	private static GUIStyle xAxisLabelStyle;
#endif

	private void OnValidate() => UpdateAllData();
	private void Start() => UpdateAllData();
	private void OnGUI() => windowRect = GUI.Window(1, windowRect, DrawWindow, "📈 Effort & Plants / Day");

	// Public accessors
	public List<float> GetEffortOverDays()
	{
		return totalEffortData.Select(dp => dp.effort).ToList();
	}
	public List<int> GetPlantCountsOverDays()
	{
		return totalPlantData.Select(dp => (int)dp.effort).ToList();
	}

	private void UpdateAllData()
	{
		SyncEntries();
		BuildEffortData();
		BuildPlantData();
	}

	private void SyncEntries()
	{
		if (allActivitiesData == null || dailyActivities == null) return;

		for (int i = 0; i < dailyActivities.Count; i++)
		{
			var day = dailyActivities[i];
			day.dayName = $"Jour {i + 1}";
			day.entries.RemoveAll(e => e.activityData == null || !allActivitiesData.Contains(e.activityData));
			foreach (var act in allActivitiesData)
				if (!day.entries.Any(e => e.activityData == act))
					day.entries.Add(new ActivityEntry { activityData = act, distanceKm = 0f });
			day.entries = day.entries.OrderBy(e => Array.IndexOf(allActivitiesData, e.activityData)).ToList();
		}
	}

	private void BuildEffortData()
	{
		totalEffortData.Clear();
		for (int i = 0; i < dailyActivities.Count; i++)
		{
			var day = dailyActivities[i];
			float sum = day.entries.Where(e => e.activityData != null)
				.Sum(e => ((e.distanceKm * 1000f) / 10f) * e.activityData.effortMultiplier);
			totalEffortData.Add(new DataPoint { activityName = day.dayName, effort = sum, timestamp = i });
		}
	}

	private void BuildPlantData()
	{
		totalPlantData.Clear();
		if (plantSimulatorSource == null) return;
		// Use correct method name from PrairieSimulator
		var counts = plantSimulatorSource.GetPlantsTotalPlantsByDay();
		for (int i = 0; i < counts.Count; i++)
			totalPlantData.Add(new DataPoint { activityName = $"Jour {i + 1}", effort = counts[i], timestamp = i });
	}

	private void DrawWindow(int id)
	{
		// Resize handle
		Rect handle = new Rect(windowRect.width - handleSize, windowRect.height - handleSize, handleSize, handleSize);
#if UNITY_EDITOR
		EditorGUIUtility.AddCursorRect(handle, MouseCursor.ResizeUpLeft);
#endif
		var ev = Event.current;
		if (ev.type == EventType.MouseDown && handle.Contains(ev.mousePosition))
		{
			isResizing = true;
			resizeStart = GUIUtility.GUIToScreenPoint(ev.mousePosition);
			resizeRectStart = windowRect;
			ev.Use();
		}
		if (isResizing)
		{
			var cur = GUIUtility.GUIToScreenPoint(ev.mousePosition);
			var delta = cur - resizeStart;
			windowRect.width = Mathf.Max(minWidth, resizeRectStart.width + delta.x);
			windowRect.height = Mathf.Max(minHeight, resizeRectStart.height + delta.y);
			if (ev.rawType == EventType.MouseUp) isResizing = false;
			ev.Use();
		}

		if ((totalEffortData.Count < 2) && (totalPlantData.Count < 2))
		{
			GUILayout.Label("Pas assez de données.");
			GUI.DragWindow();
			return;
		}

		Rect graphRect = GUILayoutUtility.GetRect(windowRect.width - 20, windowRect.height - 60);
#if UNITY_EDITOR
		if (labelStyle == null)
		{
			labelStyle = new GUIStyle(EditorStyles.label) { wordWrap = false, clipping = TextClipping.Overflow };
			xAxisLabelStyle = new GUIStyle(EditorStyles.label)
			{
				alignment = TextAnchor.UpperCenter,
				fontSize = 11,
				normal = { textColor = Color.white }
			};
		}
		Handles.BeginGUI();

		// Draw effort curve (blue) with labels
		Handles.color = Color.blue;
		DrawCurve(totalEffortData, graphRect, ownScale: true, labels: true);

		// Draw plant curve (green) with labels
		Handles.color = Color.green;
		DrawCurve(totalPlantData, graphRect, ownScale: true, labels: true);

		// Draw X-axis day numbers
		int count = Math.Max(totalEffortData.Count, totalPlantData.Count);
		for (int i = 0; i < count; i++)
		{
			float t = Mathf.InverseLerp(0, count - 1, i);
			Vector2 pos = new Vector2(graphRect.x + t * graphRect.width, graphRect.yMax + 2);
			Handles.Label(pos, $"{i + 1} day", xAxisLabelStyle);
		}

		Handles.EndGUI();
#endif
		GUI.DragWindow();
	}

#if UNITY_EDITOR
	private void DrawCurve(List<DataPoint> data, Rect rect, bool ownScale, bool labels)
	{
		if (data == null || data.Count < 2) return;
		float minX = data.First().timestamp;
		float maxX = data.Last().timestamp;
		float maxY = ownScale ? data.Max(dp => dp.effort) : data.Max(dp => dp.effort);

		Vector2 prev = Vector2.zero;
		for (int i = 0; i < data.Count; i++)
		{
			var dp = data[i];
			float t = Mathf.InverseLerp(minX, maxX, dp.timestamp);
			float yNorm = maxY > 0f ? Mathf.InverseLerp(0f, maxY, dp.effort) : 0f;
			Vector2 pt = new Vector2(rect.x + t * rect.width, rect.yMax - yNorm * rect.height);
			if (i > 0) Handles.DrawLine(prev, pt);
			Handles.DrawSolidDisc(pt, Vector3.forward, 3f);
			if (labels) Handles.Label(pt + Vector2.up * 6f, dp.effort.ToString(), labelStyle);
			prev = pt;
		}
	}
#endif
}

[Serializable]
public class DataPoint
{
	public string activityName;
	public float effort;
	public float timestamp;
}
