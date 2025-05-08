using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Cadre automatiquement la cible (et ses enfants) dans le viewport caméra.
/// Cette version réduit la charge CPU :
///   • Recalcule les bounds seulement toutes les <see cref="recalculationInterval"/>
///   • Utilise une List réutilisable avec capacité pré‑allouée (pas de GC)
///   • Lissage identique de la position / taille via <see cref="damping"/>
/// </summary>
[RequireComponent(typeof(Camera))]
public class AutoCameraFramer : MonoBehaviour
{
	// -------------------------------------------------------------------------
	//  Réglages de cadrage
	// -------------------------------------------------------------------------
	[Header("Cible à cadrer")]
	public Transform targetRoot;

	[Header("Marge et réglages")]
	[Tooltip("Espace ajouté autour de la cible (unités monde)")]
	public float screenEdgeBuffer = 1f;
	[Tooltip("Taille orthographique minimale (zoom max)")]
	public float minSize = 5f;
	[Tooltip("Damping pour Lerp position+zoom")]
	public float damping = 5f;

	// -------------------------------------------------------------------------
	//  Optimisations
	// -------------------------------------------------------------------------
	[Header("Performance")]
	[Tooltip("Temps (s) entre deux recalculs complets des bounds. \nBaissez la valeur pour plus de précision, augmentez‑la pour soulager le CPU.")]
	public float recalculationInterval = 0.1f;   // 10× par seconde ≈ fluide

	[Tooltip("Capacité initiale du buffer renderers — ajustez si vos plantes ont > 256 meshes.")]
	public int rendererBufferCapacity = 256;

	// -------------------------------------------------------------------------
	private Camera cam;
	private readonly List<Renderer> renderersCache = new();

	private Bounds cachedBounds;
	private float nextRecalcTime;

	// -------------------------------------------------------------------------
	private void Awake()
	{
		cam = GetComponent<Camera>();
		cam.orthographic = true;

		// Évite les reallocs quand la liste grandit
		renderersCache.Capacity = rendererBufferCapacity;
	}

	private void LateUpdate()
	{
		if (targetRoot == null) return;

		// ————————————————— Recalcul espacé —————————————————
		if (Time.unscaledTime >= nextRecalcTime)
		{
			cachedBounds = CalculateBounds(targetRoot);
			nextRecalcTime = Time.unscaledTime + recalculationInterval;
		}

		// Position & zoom lissés chaque frame (peu coûteux)
		AdjustPosition(cachedBounds);
		AdjustSize(cachedBounds);
	}

	// -------------------------------------------------------------------------
	//  Bounds helpers
	// -------------------------------------------------------------------------
	private Bounds CalculateBounds(Transform root)
	{
		renderersCache.Clear();                       // ne change pas la capacité
		root.GetComponentsInChildren(renderersCache); // remplissage sans alloc sup.

		if (renderersCache.Count == 0)
			return new Bounds(root.position, Vector3.zero);

		Bounds b = renderersCache[0].bounds;
		for (int i = 1; i < renderersCache.Count; i++)
			b.Encapsulate(renderersCache[i].bounds);

		return b;
	}

	// -------------------------------------------------------------------------
	//  Camera positioning
	// -------------------------------------------------------------------------
	private void AdjustPosition(Bounds bounds)
	{
		Vector3 desiredPos = bounds.center;
		desiredPos.z = transform.position.z; // conserve la profondeur existante

		transform.position = Vector3.Lerp(transform.position, desiredPos, Time.deltaTime * damping);
	}

	private void AdjustSize(Bounds bounds)
	{
		float verticalSize = bounds.extents.y + screenEdgeBuffer;
		float horizontalSize = (bounds.extents.x + screenEdgeBuffer) / cam.aspect;
		float requiredSize = Mathf.Max(verticalSize, horizontalSize, minSize);

		cam.orthographicSize = Mathf.Lerp(cam.orthographicSize, requiredSize, Time.deltaTime * damping);
	}
}