using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Cadre automatiquement la cible (et ses enfants) dans le viewport caméra.
/// Ne bouge pas la caméra si la cible n’a aucun Renderer.
/// </summary>
[RequireComponent(typeof(Camera))]
public class AutoCameraFramer : MonoBehaviour
{
	[Header("Cible à cadrer")]
	public Transform targetRoot;

	[Header("Marge et réglages")]
	[Tooltip("Espace ajouté autour de la cible (unités monde)")]
	public float screenEdgeBuffer = 1f;
	[Tooltip("Taille orthographique minimale (zoom max)")]
	public float minSize = 5f;
	[Tooltip("Damping pour Lerp position+zoom")]
	public float damping = 5f;

	[Header("Performance")]
	[Tooltip("Temps (s) entre deux recalculs complets des bounds.")]
	public float recalculationInterval = 0.1f;
	[Tooltip("Capacité initiale du buffer renderers")]
	public int rendererBufferCapacity = 256;

	private Camera cam;
	private readonly List<Renderer> renderersCache = new();
	private Bounds cachedBounds;
	private float nextRecalcTime;

	private void Awake()
	{
		cam = GetComponent<Camera>();
		cam.orthographic = true;

		// Pré-alloue la capacité pour éviter les reallocations
		renderersCache.Capacity = rendererBufferCapacity;
	}

	private void LateUpdate()
	{
		// 1) Si pas de cible assignée, on ne fait rien
		if (targetRoot == null)
			return;

		// 2) Recalcul des bounds à intervalles espacés
		if (Time.unscaledTime >= nextRecalcTime)
		{
			// Remise à zéro du cache (sans libérer la mémoire)
			renderersCache.Clear();
			// Récupère tous les Renderers sous targetRoot
			targetRoot.GetComponentsInChildren(renderersCache);

			// 3) Si aucun Renderer trouvé, on ne cadre pas et on quitte
			if (renderersCache.Count == 0)
				return;

			// 4) Calcule les bounds englobants
			Bounds b = renderersCache[0].bounds;
			for (int i = 1; i < renderersCache.Count; i++)
				b.Encapsulate(renderersCache[i].bounds);

			cachedBounds = b;
			nextRecalcTime = Time.unscaledTime + recalculationInterval;
		}

		// 5) Ajuste la position et le zoom chaque frame
		AdjustPosition(cachedBounds);
		AdjustSize(cachedBounds);
	}

	/// <summary>
	/// Centre la caméra sur le centre des bounds (avec damping).
	/// </summary>
	private void AdjustPosition(Bounds bounds)
	{
		Vector3 desiredPos = bounds.center;
		desiredPos.z = transform.position.z; // conserve la profondeur
		transform.position = Vector3.Lerp(
			transform.position,
			desiredPos,
			Time.deltaTime * damping
		);
	}

	/// <summary>
	/// Adapte l’orthographicSize pour englober les bounds + marge.
	/// </summary>
	private void AdjustSize(Bounds bounds)
	{
		// Taille verticale + buffer
		float verticalSize = bounds.extents.y + screenEdgeBuffer;
		// Taille horizontale ajustée à l’aspect ratio
		float horizontalSize = (bounds.extents.x + screenEdgeBuffer) / cam.aspect;
		// Choix de la plus grande ou de la taille minimum
		float requiredSize = Mathf.Max(verticalSize, horizontalSize, minSize);

		cam.orthographicSize = Mathf.Lerp(
			cam.orthographicSize,
			requiredSize,
			Time.deltaTime * damping
		);
	}
}
