using UnityEngine;

/// <summary>
/// Paramètres spécifiques à une espèce d’insecte volant.
/// Un même comportement (script) mais des profils différents dans l’éditeur.
/// </summary>
[CreateAssetMenu(menuName = "Garden/Insect Profile", fileName = "NewFlyingInsectProfile")]
public class FlyingInsectProfile : ScriptableObject
{
	[Header("Identité & visuel")]
	public string displayName = "Bee";
	public GameObject prefab;          // modèle 3D ou sprite
	public Sprite icon;                // (UI)

	[Header("Déplacement linéaire")]
	[Min(0f)] public float flightSpeed = 2f;         // vitesse moyenne
	[Min(0f)] public float arrivalThreshold = 0.15f; // tolérance d’arrivée

	[Header("Butinage / stationnaire")]
	public Vector2 gatherTime = new(2f, 4f);         // durée min‑max
	[Min(0f)] public float hoverRadius = 0.25f;       // rayon du cercle
	[Min(0f)] public float hoverAngularSpeed = 90f;   // °/sec autour de la fleur

	[Header("Comportement global")]
	[Range(0f, 1f)] public float chanceToLeave = 0.25f;   // quitter le jardin ?
	public Vector2 awayTime = new(3f, 6f);                // temps hors‑écran
}
