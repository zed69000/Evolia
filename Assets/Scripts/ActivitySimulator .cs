using UnityEngine;

public class ActivitySimulator : MonoBehaviour
{
	public ActivityManager activityManager;

	[Header("Simulation")]
	public float simulatedSpeedKmh = 5f;
	public bool isIndoor = false;

	private float simulationDuration = 0f;
	private float simulationTimer = 0f;
	private bool isSimulating = false;

	// Exposés pour l’UI
	public bool IsSimulating => isSimulating;
	public float CurrentTime => simulationTimer;
	public float SimulationDuration => simulationDuration;

	/// <summary>Démarre une simulation en temps réel pendant `duration` secondes</summary>
	public void StartLiveSimulation(float duration)
	{
		simulationDuration = duration;
		simulationTimer = 0f;
		isSimulating = true;

		//Debug.Log($"🚀 Simulation démarrée pour {duration:F1} s à {simulatedSpeedKmh} km/h");
	}

	/// <summary>Arrête manuellement la simulation</summary>
	public void StopSimulation()
	{
		isSimulating = false;
		Debug.Log("🛑 Simulation arrêtée manuellement.");
	}

	/// <summary>Réinitialise la simulation (minuteur + durée).</summary>
	public void ResetSimulation()
	{
		isSimulating = false;
		simulationTimer = 0f;
		simulationDuration = 0f;
	}


	/// <summary>Renvoie l’activité correspondant à la vitesse actuelle</summary>
	public ActivityData GetPredictedActivity()
	{
		return activityManager.GetActivityBySpeed(simulatedSpeedKmh, isIndoor);
	}

	private void Update()
	{
		if (!isSimulating) return;

		simulationTimer += Time.deltaTime;
		if (simulationTimer >= simulationDuration)
		{
			isSimulating = false;
			//Debug.Log("✅ Simulation terminée !");
			return;
		}

		float deltaDistance = (simulatedSpeedKmh / 3.6f) * Time.deltaTime; // m/s
		ApplyEffort(deltaDistance);
	}

	private void ApplyEffort(float distanceMeters)
	{
		ActivityData activity = GetPredictedActivity();
		if (activity == null || activity.activityType == null)
		{
			Debug.LogWarning("❌ Aucune activité correspondante ou ActivityType manquant.");
			return;
		}

		float basePoints = distanceMeters / 10f;
		float speedFactor = simulatedSpeedKmh / activity.baseSpeedKmh;
		float finalPoints = basePoints * activity.effortMultiplier * speedFactor;

		activityManager.tracker.AddEffort(activity.activityType, finalPoints);
	}
}
