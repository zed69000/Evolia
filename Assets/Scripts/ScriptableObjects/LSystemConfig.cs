using UnityEngine;

/// <summary>
/// Contient toute la configuration nécessaire à la génération d’une plante
/// via un L‑System : grammaire, paramètres de dessin et prefabs utilisés.
/// </summary>
/// 
[System.Serializable]
public struct PrefabWeight
{
	public GameObject prefab;
	[Range(0f, 1f)] public float probability;
}


[CreateAssetMenu(menuName = "Plant/L-System Config", fileName = "NewLSystemConfig")]
public class LSystemConfig : ScriptableObject
{
	// ---------------------
	//  Grammaire L‑System
	// ---------------------
	[Header("Grammar")]
	[Tooltip("Axiome de départ (chaîne initiale)")]
	public string axiom;

	[Tooltip("Ensemble de règles de production")]
	public Rule[] rules;

	// ---------------------
	//  Paramètres de dessin
	// ---------------------
	[Header("Drawing")]
	[Min(0)] public int iterations;            // Nombre d’itérations de la grammaire
	[Tooltip("Angle de rotation de base (°)")]
	public float angle = 25f;
	[Tooltip("Longueur d’un segment F (unités monde)")]
	public float segmentLength = 1f;
	[Tooltip("Délai (s) pour dessiner chaque segment")]
	public float drawDelay = 0.02f;

	// ---------------------
	//  Prefabs utilisés
	// ---------------------
	[Header("Prefabs")]
	[Tooltip("Prefab utilisé pour chaque segment ‘F’ (branche/tronc)")]
	public GameObject segmentPrefab;

	[Tooltip("Prefab utilisé pour symboliser une fleur/fruit ‘X’")]
	public PrefabWeight[] petalPrefabs;

	[Tooltip("Prefab utilisé pour symboliser une feuille ‘L’")]
	public PrefabWeight[] leafPrefabs;
}

// ------------------------------------------------------------
//  Définition d’une règle de production
// ------------------------------------------------------------
[System.Serializable]
public class Rule
{
	[Tooltip("Symbole à remplacer (gauche de la règle)")]
	public char symbol;

	[Tooltip("Liste de remplacements possibles pour ce symbole")]
	public Replacement[] replacements;
}

// ------------------------------------------------------------
//  Définition d’un remplacement avec poids (probabilité)
// ------------------------------------------------------------
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