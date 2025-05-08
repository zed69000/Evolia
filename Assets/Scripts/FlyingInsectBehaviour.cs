using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Comportement réutilisable pour TOUT insecte volant.
/// Les paramètres sont lus dans un ScriptableObject « FlyingInsectProfile ».
///
/// Cycle : cherche fleur mature → vole → butine → (change / quitte / revient)
/// </summary>
public class FlyingInsectBehaviour : MonoBehaviour
{
	[Header("Réglage via profil")]
	public FlyingInsectProfile profile;

	[Header("Références globales")]
	public PlantManager plantManager;         // Singleton ; assignez-le dans l’inspecteur
	public Rect gardenBounds = new(-8f, -3f, 16f, 6f);

	// RNG privé pour désynchroniser les individus
	private readonly System.Random _rng = new();

	private void Start()
	{
		if (plantManager == null) plantManager = PlantManager.Instance;
		StartCoroutine(MainLoop());
	}

	/// <summary>Boucle infinie : recherche cible → vol → butinage → décision.</summary>
	private IEnumerator MainLoop()
	{
		while (true)
		{
			// 1) Choisit une fleur mûre
			Plant target = PickRandomMaturePlant();
			if (target == null)
			{
				yield return new WaitForSeconds(0.5f);
				continue;
			}

			// 2) Vol direct
			yield return FlyStraightTo(target.transform.position);

			// 3) Butinage
			float gatherDuration = RandomRange(profile.gatherTime);
			yield return HoverAround(target.transform, gatherDuration);

			// 4) Décide : partir ou enchaîner
			if (Random.value < profile.chanceToLeave)
			{
				Vector3 off = GetRandomOffScreenPosition();
				yield return FlyStraightTo(off);                         // s’en va
				yield return new WaitForSeconds(RandomRange(profile.awayTime)); // pause hors‑écran
			}
			else
			{
				yield return null; // enchaîne
			}
		}
	}

	// ───────────────────────────────────────────────────────── sous‑routines ───

	private IEnumerator FlyStraightTo(Vector3 dst)
	{
		while (Vector3.Distance(transform.position, dst) > profile.arrivalThreshold)
		{
			Vector3 dir = (dst - transform.position).normalized;
			transform.position += dir * profile.flightSpeed * Time.deltaTime;

			// Face le sprite dans la direction du déplacement (option 2D)
			if (dir.x != 0) transform.localScale = new(Mathf.Sign(dir.x), 1, 1);

			yield return null;
		}
	}

	private IEnumerator HoverAround(Transform center, float dur)
	{
		float angle = (float)_rng.NextDouble() * 360f;
		float t = 0f;
		while (t < dur)
		{
			angle += profile.hoverAngularSpeed * Time.deltaTime;
			Vector3 off = new Vector3(
				Mathf.Cos(angle * Mathf.Deg2Rad),
				Mathf.Sin(angle * Mathf.Deg2Rad),
				0f
			) * profile.hoverRadius;
			transform.position = center.position + off;
			t += Time.deltaTime;
			yield return null;
		}
	}

	private Plant PickRandomMaturePlant()
	{
		IList<Plant> list = plantManager.GetMaturePlants();
		if (list.Count == 0) return null;
		return list[_rng.Next(list.Count)];
	}

	private Vector3 GetRandomOffScreenPosition()
	{
		bool left = Random.value < 0.5f;
		float x = left ? gardenBounds.xMin - 1.5f : gardenBounds.xMax + 1.5f;
		float y = Random.Range(gardenBounds.yMin, gardenBounds.yMax) + 4f;
		return new Vector3(x, y, 0f);
	}

	private float RandomRange(Vector2 v) => Random.Range(v.x, v.y);
}
