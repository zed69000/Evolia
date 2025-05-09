using UnityEditor;
using UnityEngine;

public class ActivitySimulatorUI : MonoBehaviour
{
	public ActivitySimulator simulator;
	public TimeOfDayController timeController;  // Référence au manager de temps

	// — états de la GUI —
	private bool showGUI = true;
	private Rect windowRect = new Rect(20, 20, 380, 700);
	private Vector2 scrollPos = Vector2.zero;

	// — paramètres simulés —
	private float simulatedSpeed = 16f;
	private float targetDistance = 5f;
	private bool useKilometers = true;
	private bool isIndoor = false;

	// — contrôle du temps —
	private bool overrideTime = false;
	private float manualHour = 12f;

	private bool isSimulating => simulator.IsSimulating;

	private void Update()
	{
		if (Input.GetKeyDown(KeyCode.H))
			showGUI = !showGUI;
	}

	private void OnGUI()
	{
		if (!showGUI) return;

		// Ajustements de style
		GUI.skin.window.normal.background = Texture2D.whiteTexture;
		GUI.skin.window.fontStyle = FontStyle.Bold;
		GUI.skin.window.fontSize = 14;
		GUI.skin.label.fontSize = 12;
		GUI.skin.button.fontSize = 12;
		GUI.skin.horizontalSlider.fixedHeight = 16;

		windowRect = GUI.Window(
			0,
			windowRect,
			WindowFunction,
			"🎾 Simulateur d'Activité & Temps"
		);
		GUI.FocusWindow(0);
	}

	private void WindowFunction(int id)
	{
		scrollPos = GUILayout.BeginScrollView(scrollPos,
			GUILayout.Width(windowRect.width - 10),
			GUILayout.Height(windowRect.height - 30)
		);

		// --- Simulation d'activité ---
		GUILayout.Label("<b>Paramètres de Simulation</b>", new GUIStyle(GUI.skin.label) { richText = true });
		GUILayout.Label("Vitesse (km/h)");
		simulatedSpeed = GUILayout.HorizontalSlider(simulatedSpeed, 0.1f, 20f);
		GUILayout.Label($"<b>{simulatedSpeed:F1} km/h</b>", new GUIStyle(GUI.skin.label) { richText = true });
		simulator.simulatedSpeedKmh = simulatedSpeed;

		GUILayout.Label($"Distance {(useKilometers ? "(km)" : "(mètres)")}");
		targetDistance = GUILayout.HorizontalSlider(targetDistance, 1f, useKilometers ? 5f : 1000f);
		GUILayout.Label($"<b>{targetDistance:F2}{(useKilometers ? " km" : " m")}</b>", new GUIStyle(GUI.skin.label) { richText = true });

		useKilometers = GUILayout.Toggle(useKilometers, "Utiliser les kilomètres");
		isIndoor = GUILayout.Toggle(isIndoor, "Activité en intérieur");
		simulator.isIndoor = isIndoor;

		float totalMeters = useKilometers ? targetDistance * 1000f : targetDistance;
		float speedMps = simulatedSpeed / 3.6f;
		float estimatedDuration = speedMps > 0f ? totalMeters / speedMps : 0f;
		GUILayout.Label($"⏱ Durée estimée : <b>{estimatedDuration:F1}s</b>", new GUIStyle(GUI.skin.label) { richText = true });

		GUILayout.Label($"🏋️ Total Effort : <b>{ActivityTracker.Instance.totalEffort:F1}</b>", new GUIStyle(GUI.skin.label) { richText = true });

		var activity = simulator.GetPredictedActivity();
		if (activity != null)
			GUILayout.Label($"🧠 Activité : <b>{activity.activityName}</b>", new GUIStyle(GUI.skin.label) { richText = true });
		else
			GUILayout.Label("⚠️ Aucune activité détectée.");

		GUILayout.Space(10);
		// --- Contrôle du temps ---
		GUILayout.Label("<b>Contrôle du Temps</b>", new GUIStyle(GUI.skin.label) { richText = true });
		overrideTime = GUILayout.Toggle(overrideTime, overrideTime ? "☑️ Override Temps" : "⬜ Temps Réel");

		EditorGUI.BeginDisabledGroup(!overrideTime);
		GUILayout.Label($"Heure simulée : <b>{manualHour:F2}h</b>");
		manualHour = GUILayout.HorizontalSlider(manualHour, 0f, 24f);
		EditorGUI.EndDisabledGroup();

		if (GUILayout.Button("⟳ Temps Actuel"))
		{
			overrideTime = false;
			manualHour = System.DateTime.Now.Hour + System.DateTime.Now.Minute / 60f;
		}

		// Mise à jour du TimeOfDayController
		timeController.overrideTime = overrideTime;
		timeController.manualHour = manualHour;

		GUILayout.Space(10);
		// --- Vitesse glob. & croissance ---
		GUILayout.Label("<b>Vitesse globale de simulation</b>", new GUIStyle(GUI.skin.label) { richText = true });
		Time.timeScale = GUILayout.HorizontalSlider(Time.timeScale, 1f, 100f);
		GUILayout.Label($"x{Time.timeScale:F2}");

		GUILayout.Space(5);
		GUILayout.Label("<b>Vitesse globale de croissance</b>", new GUIStyle(GUI.skin.label) { richText = true });
		ActivityTracker.GlobalGrowthMultiplier = GUILayout.HorizontalSlider(ActivityTracker.GlobalGrowthMultiplier, 0.1f, 300f);
		GUILayout.Label($"x{ActivityTracker.GlobalGrowthMultiplier:F2}");

		GUILayout.Space(10);
		if (!isSimulating)
		{
			if (GUILayout.Button("▶️ Démarrer"))
				simulator.StartLiveSimulation(estimatedDuration);
		}
		else
		{
			if (GUILayout.Button("⏹ Stop"))
				simulator.StopSimulation();
			GUILayout.Label($"⏳ {simulator.CurrentTime:F1} / {simulator.SimulationDuration:F1}s");
		}

		GUILayout.Space(10);
		if (GUILayout.Button("🔄 Réinitialiser"))
			ClearSimulation();

		GUILayout.EndScrollView();
		GUI.DragWindow(new Rect(0, 0, windowRect.width, 20));
	}

	private void ClearSimulation()
	{
		simulator.ResetSimulation();
		simulatedSpeed = 16f;
		targetDistance = 5f;
		useKilometers = true;
		isIndoor = false;
		overrideTime = false;
		manualHour = 12f;

		ActivityTracker.GlobalGrowthMultiplier = 1f;
		simulator.activityManager?.tracker?.ResetAllPlants();
		Time.timeScale = 1f;
		// Remettre temps réel
		timeController.overrideTime = false;
	}
}
