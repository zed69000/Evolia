using UnityEngine;

public class ActivitySimulatorUI : MonoBehaviour
{
	public ActivitySimulator simulator;

	// — états de la GUI —
	private bool showGUI = true;
	private Rect windowRect = new Rect(20, 20, 360, 600);
	private Vector2 scrollPos = Vector2.zero;

	// — paramètres simulés —
	private float simulatedSpeed = 16f;
	private float targetDistance = 5f;
	private bool useKilometers = true;
	private bool isIndoor = false;

	private bool isSimulating => simulator.IsSimulating;

	private void Update()
	{
		if (Input.GetKeyDown(KeyCode.H))
			showGUI = !showGUI;
	}

	private void OnGUI()
	{
		if (!showGUI) return;

		// — Styles corrigés —
		GUI.skin.window.normal.background = Texture2D.whiteTexture;
		GUI.skin.window.fontStyle = FontStyle.Bold;      // ← remplace titleFontStyle
		GUI.skin.window.fontSize = 14;
		GUI.skin.label.fontSize = 12;
		GUI.skin.button.fontSize = 12;
		GUI.skin.horizontalSlider.fixedHeight = 16;

		// — Fenêtre déplaçable corrigée —
		windowRect = GUI.Window(
			0,                        // id
			windowRect,               // position (pas "screenRect")
			WindowFunction,           // fonction de dessin
			"🎾 Simulateur d'Activité"// titre
		);
	}

	private void WindowFunction(int windowID)
	{
		scrollPos = GUILayout.BeginScrollView(scrollPos,
			GUILayout.Width(windowRect.width - 10),
			GUILayout.Height(windowRect.height - 30)
		);

		// --- Contenu de la fenêtre ---
		GUILayout.Label("<b>Paramètres de Simulation</b>",
			new GUIStyle(GUI.skin.label) { richText = true });

		// Vitesse
		GUILayout.Label("Vitesse (km/h)");
		simulatedSpeed = GUILayout.HorizontalSlider(simulatedSpeed, 0.1f, 20f);
		GUILayout.Label($"<b>{simulatedSpeed:F1} km/h</b>",
			new GUIStyle(GUI.skin.label) { richText = true });
		simulator.simulatedSpeedKmh = simulatedSpeed;

		// Distance
		GUILayout.Label($"Distance {(useKilometers ? "(km)" : "(mètres)")}");
		targetDistance = GUILayout.HorizontalSlider(
			targetDistance, 1f, useKilometers ? 5f : 1000f);
		GUILayout.Label($"<b>{targetDistance:F2}{(useKilometers ? " km" : " m")}</b>",
			new GUIStyle(GUI.skin.label) { richText = true });

		// Toggle km/m
		useKilometers = GUILayout.Toggle(useKilometers, "Utiliser les kilomètres");

		// Toggle indoor
		isIndoor = GUILayout.Toggle(isIndoor, "Activité en intérieur");
		simulator.isIndoor = isIndoor;

		// Durée estimée
		float totalMeters = useKilometers ? targetDistance * 1000f : targetDistance;
		float speedMps = simulatedSpeed / 3.6f;
		float estimatedDuration = speedMps > 0f ? totalMeters / speedMps : 0f;
		GUILayout.Label($"⏱ Durée estimée : <b>{estimatedDuration:F1}s</b>",
			new GUIStyle(GUI.skin.label) { richText = true });

		// Total Effort
		GUILayout.Label($"🏋️ Total Effort : <b>{ActivityTracker.Instance.totalEffort:F1}</b>",
			new GUIStyle(GUI.skin.label) { richText = true });

		// Activité détectée
		var activity = simulator.GetPredictedActivity();
		if (activity != null)
			GUILayout.Label($"🧠 Activité : <b>{activity.activityName}</b>",
				new GUIStyle(GUI.skin.label) { richText = true });
		else
			GUILayout.Label("⚠️ Aucune activité détectée.");

		GUILayout.Space(10);

		// Start / Stop
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

		// Vitesse globale
		GUILayout.Label("<b>Vitesse globale de simulation</b>",
			new GUIStyle(GUI.skin.label) { richText = true });
		Time.timeScale = GUILayout.HorizontalSlider(Time.timeScale, 1f, 100f);
		GUILayout.Label($"x{Time.timeScale:F2}");

		GUILayout.Space(5);

		// Croissance globale
		GUILayout.Label("<b>Vitesse globale de croissance</b>",
			new GUIStyle(GUI.skin.label) { richText = true });
		ActivityTracker.GlobalGrowthMultiplier =
			GUILayout.HorizontalSlider(ActivityTracker.GlobalGrowthMultiplier, 0.1f, 300f);
		GUILayout.Label($"x{ActivityTracker.GlobalGrowthMultiplier:F2}");

		GUILayout.Space(10);

		// Réinitialiser
		if (GUILayout.Button("🔄 Réinitialiser"))
			ClearSimulation();

		GUILayout.EndScrollView();

		GUI.DragWindow(new Rect(0, 0, windowRect.width, 20));
	}

	private void ClearSimulation()
	{
		simulator.ResetSimulation();
		simulatedSpeed = 5f;
		targetDistance = 100f;
		useKilometers = false;
		isIndoor = false;

		ActivityTracker.GlobalGrowthMultiplier = 1f;
		simulator.activityManager?.tracker?.ResetAllPlants();
		Time.timeScale = 1f;
	}
}
