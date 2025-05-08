using UnityEngine;

[CreateAssetMenu(fileName = "NewActivity", menuName = "Growth/Activity Data")]
public class ActivityData : ScriptableObject
{
	public string activityName;
	public float minSpeedKmh;           // Seuil à partir duquel l’activité est valable
	public float effortMultiplier;      // Base d’effort (ex: 1.5 pour marche, 2 pour course)
	public float baseSpeedKmh = 5f;     // Vitesse moyenne de référence pour pondération
	public bool isIndoor;

	[Header("Lien avec le système de plante")]
	public ActivityType activityType;
}

