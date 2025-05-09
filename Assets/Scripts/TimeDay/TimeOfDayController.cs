using UnityEngine;

/// <summary>
/// Met à jour chaque frame le paramètre global _TimeOfDay pour vos shaders URP et
/// initialise une rampe de couleurs (_TimeOfDayRamp) via un Gradient limité à 8 clés.
/// Permet d'overrider l'heure via l'Inspector. Utilise Shader.SetGlobalFloat et SetGlobalTexture
/// pour respecter SRP et GPU Instancing.
/// </summary>
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
	public float manualHour = 12f;

	[Header("Gradient Temps (8 clés max)")]
	[Tooltip("Dégradé jour->nuit à créer automatiquement ou assigné manuellement")]
	public bool useDefaultGradient = true;
	public Gradient timeGradient;

	// Identifiants shader
	private int _timeOfDayID;
	private int _timeRampID;
	private Texture2D _rampTexture;

	// Initialisation des IDs et de la rampe
	private void Awake()
	{
		InitShaderIDs();
		InitGradientIfNeeded();
		UpdateRampTexture();
		PushTexture();
	}

#if UNITY_EDITOR
	// Met à jour immédiatement en Editor lors de la modif. de l'Inspector
	private void OnValidate()
	{
		InitShaderIDs();
		InitGradientIfNeeded();
		UpdateRampTexture();
		PushTexture();
	}
#endif

	private void Update()
	{
#if UNITY_EDITOR
		if (!updateInEditor && !Application.isPlaying) return;
#endif
		float h = overrideTime
			? manualHour
			: (Application.isPlaying ? System.DateTime.Now.Hour + System.DateTime.Now.Minute / 60f : fixedHour);

		Shader.SetGlobalFloat(_timeOfDayID, Mathf.Clamp01(h / 24f));
		// Réapplique la rampe à chaque frame pour garantir l'instancing
		PushTexture();
	}

	// Initialise les IDs shader
	private void InitShaderIDs()
	{
		_timeOfDayID = Shader.PropertyToID("_TimeOfDay");
		_timeRampID = Shader.PropertyToID("_TimeOfDayRamp");
	}

	// Crée ou conserve le gradient
	private void InitGradientIfNeeded()
	{
		if (useDefaultGradient || timeGradient == null)
			timeGradient = CreateDefaultGradient8();
	}

	// Met à jour la texture rampe 256×1 à partir du Gradient
	private void UpdateRampTexture()
	{
		if (_rampTexture == null || _rampTexture.width != 256)
		{
			_rampTexture = new Texture2D(256, 1, TextureFormat.RGBA32, false, true);
			_rampTexture.wrapMode = TextureWrapMode.Clamp;
			_rampTexture.filterMode = FilterMode.Bilinear;
		}
		for (int x = 0; x < 256; x++)
		{
			float t = x / 255f;
			Color c = timeGradient.Evaluate(t);
			_rampTexture.SetPixel(x, 0, c);
		}
		_rampTexture.Apply();
	}

	// Envoie la texture au shader
	private void PushTexture()
	{
		if (_rampTexture != null)
		{
			Shader.SetGlobalTexture(_timeRampID, _rampTexture);
		}
		else
		{
			Debug.Log("rampTexture est null");
		}
	}

	/// <summary>
	/// Crée un Gradient à 8 clés pour le spectre horaire :
	/// 0h, 4h, 8h, 12h, 16h, 18h, 20h, 24h
	/// </summary>
	private Gradient CreateDefaultGradient8()
	{
		Gradient g = new Gradient();
		g.mode = GradientMode.Blend;
		GradientColorKey[] keys = new GradientColorKey[8]
		{
			new GradientColorKey(new Color(0.043f,0.047f,0.063f), 0f),   // 0h
            new GradientColorKey(new Color(0.243f,0.290f,0.380f), 4f/24f),// 4h
            new GradientColorKey(new Color(0.631f,0.776f,0.918f), 8f/24f),// 8h
            new GradientColorKey(new Color(1.000f,0.957f,0.698f), 12f/24f),// 12h
            new GradientColorKey(new Color(1.000f,0.702f,0.278f), 16f/24f),// 16h
            new GradientColorKey(new Color(1.000f,0.498f,0.314f), 18f/24f),// 18h
            new GradientColorKey(new Color(0.420f,0.310f,0.310f), 20f/24f),// 20h
            new GradientColorKey(new Color(0.043f,0.047f,0.063f), 1f)    // 24h
        };
		GradientAlphaKey[] alpha = new GradientAlphaKey[2]
		{
			new GradientAlphaKey(1f, 0f),
			new GradientAlphaKey(1f, 1f)
		};
		g.colorKeys = keys;
		g.alphaKeys = alpha;
		return g;
	}
}
