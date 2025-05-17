using UnityEngine;
using UnityEngine.Rendering.Universal; // Namespace pour Light2D

/// <summary>
/// Met à jour chaque frame la couleur du Global Light 2D selon l'heure du jour,
/// à l'aide d'un Gradient de 8 clés. Permet d'overrider l'heure via l'Inspector
/// et de l'appliquer en mode Éditeur ou PlayMode.
/// </summary>
[ExecuteAlways] // Pour que Update() tourne même hors PlayMode si besoin
public class TimeOfDayController : MonoBehaviour
{
	[Header("Mode Éditeur")]
	[Tooltip("Active la mise à jour hors PlayMode si true")]
	public bool updateInEditor = false;

	[Range(0, 24)]
	[Tooltip("Heure fixe en mode Éditeur")]
	public float fixedHour = 12f;

	[Header("Override Heure")]
	[Tooltip("Override de l'heure système via Inspector")]
	public bool overrideTime = false;

	[Range(0, 24)]
	[Tooltip("Heure manuelle si overrideTime est true")]
	public float manualHour = 12f;

	[Header("Gradient Temps (8 clés max)")]
	[Tooltip("Créer automatiquement le gradient par défaut si true")]
	public bool useDefaultGradient = true;

	[Tooltip("Gradient personnalisé jour→nuit (8 clés max)")]
	public Gradient timeGradient;

	[Header("Référence Global Light 2D")]
	[Tooltip("Assigner ici votre Light2D global (Shadow Caster 2D)")]
	public Light2D globalLight2D;

	private void Awake()
	{
		ApplyLightColor();
	}

#if UNITY_EDITOR
	private void OnValidate()
	{
		ApplyLightColor();
	}
#endif

	private void Update()
	{
#if UNITY_EDITOR
		if (!updateInEditor && !Application.isPlaying) return;
#endif
		ApplyLightColor();
	}


	/// <summary>
	/// Calcule la fraction de la journée selon l'heure (0→24h), évalue le Gradient
	/// et l'applique à la couleur de la Light2D.
	/// </summary>
	private void ApplyLightColor()
	{
		float hour = overrideTime
			? manualHour
			: (Application.isPlaying
				? System.DateTime.Now.Hour + System.DateTime.Now.Minute / 60f
				: fixedHour);

		// On convertit en fraction normalisée [0,1]
		float t = Mathf.Clamp01(hour / 24f);

		// Evaluation du Gradient pour obtenir la couleur correspondante
		Color evaluatedColor = timeGradient.Evaluate(t);

		if (globalLight2D != null)
		{
			// Application de la couleur au Global Light 2D
			globalLight2D.color = evaluatedColor;
		}
		else
		{
			Debug.LogWarning("TimeOfDayController2D : globalLight2D non assigné !");
		}
	}
}
