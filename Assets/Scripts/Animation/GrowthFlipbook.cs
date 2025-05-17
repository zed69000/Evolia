using UnityEngine;

/// <summary>
/// Met à jour chaque frame du flipbook en fonction de la valeur `growth` du LSystem parent.
/// </summary>
[RequireComponent(typeof(SpriteRenderer))]
public class GrowthFlipbook : MonoBehaviour
{
	[Tooltip("Référence au LSystem qui gouverne 'growth'")]
	public LSystem lSystem;
	[Tooltip("Les sprites à parcourir selon l’évolution de 'growth'")]
	public Sprite[] frames;

	private SpriteRenderer _sr;
	private int _lastIndex = -1;

	void Awake()
	{
		_sr = GetComponent<SpriteRenderer>();
	}

	void Update()
	{
		if (lSystem == null || frames == null || frames.Length == 0)
			return;

		// Indice de la frame correspondant à growth ∈ [0,1]
		int max = frames.Length - 1;
		int idx = Mathf.Clamp(Mathf.FloorToInt(lSystem.growth * max), 0, max);

		// On ne réaffecte que si l’index a changé (économise du Set)
		if (idx != _lastIndex)
		{
			_sr.sprite = frames[idx];
			_lastIndex = idx;
		}
	}
}
