using UnityEngine;

/// <summary>
/// Contient toute la configuration nécessaire à la génération d’une plante
/// via un L‑System : grammaire, paramètres de dessin et prefabs utilisés.
/// </summary>
[CreateAssetMenu(menuName = "Plant/L-System Config", fileName = "NewLSystemConfig")]
public class SO_LSystemConfig : ScriptableObject
{
	// ──────────────── Grammaire L‑System ────────────────
	[Header("Grammaire")]
	[Tooltip("Axiome de départ (chaîne initiale)")]
	public string axiom;

	[Tooltip("Ensemble de règles de production actives")]
	public Rule[] rules;

	[Tooltip("Règles sauvegardées, non utilisées à la génération")]
	public Rule[] savedRules;

	// ──────────────── Paramètres de dessin ────────────────
	[Header("Paramètres de dessin")]
	[Min(0)]
	[Tooltip("Nombre d’itérations de la grammaire")]
	public int iterations = 0;

	[Tooltip("Angle de rotation de base (en degrés)")]
	public float angle = 25f;

	[Tooltip("Longueur d’un segment F (en unités monde)")]
	public float segmentLength = 1f;

	[Tooltip("Délai en secondes entre chaque segment dessiné")]
	public float drawDelay = 0.02f;

	// ──────────────── Prefabs utilisés ────────────────
	[Header("Prefabs utilisés")]
	[Tooltip("Prefab utilisé pour chaque segment ‘F’ (branche/tronc)")]
	public GameObject segmentPrefab;

	[Tooltip("Prefabs utilisés pour symboliser des fleurs ou fruits ‘X’")]
	public PrefabWeight[] petalPrefabs;

	[Tooltip("Prefabs utilisés pour symboliser les feuilles ‘L’")]
	public PrefabWeight[] leafPrefabs;
}

/// <summary>
/// Structure utilisée pour associer un prefab avec une probabilité
/// </summary>
[System.Serializable]
public struct PrefabWeight
{
	public GameObject prefab;

	[Range(0f, 1f)]
	[Tooltip("Probabilité d’apparition de ce prefab")]
	public float probability;
}

/// <summary>
/// Une règle de production L-System : symbol à remplacer et ses remplacements possibles
/// </summary>
[System.Serializable]
public class Rule
{
	[Tooltip("Symbole à remplacer (gauche de la règle)")]
	public char symbol;

	[Tooltip("Liste de remplacements possibles pour ce symbole")]
	public Replacement[] replacements;
}

/// <summary>
/// Un remplacement de règle avec une chaîne et une probabilité
/// </summary>
[System.Serializable]
public class Replacement
{
	[TextArea]
	[Tooltip("Chaîne qui remplace le symbole si ce remplacement est choisi")]
	public string replacement;

	[Range(0f, 1f)]
	[Tooltip("Poids relatif pour la sélection aléatoire du remplacement")]
	public float probability = 1f;
}

/// <summary>
/// Structure exportable/importable pour sérialisation JSON
/// (représente la totalité de SO_LSystemConfig sous forme de données simples)
/// </summary>
[System.Serializable]
public class LSystemConfigData
{
	// Grammaire
	public string axiom;
	public Rule[] rules;
	public Rule[] savedRules;

	// Dessin
	public int iterations;
	public float angle;
	public float segmentLength;
	public float drawDelay;

	// Prefabs
	public string segmentPrefabPath;
	public PrefabWeight[] petalPrefabs;
	public PrefabWeight[] leafPrefabs;
}
