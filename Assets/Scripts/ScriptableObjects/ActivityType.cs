using UnityEngine;

[CreateAssetMenu(fileName = "ActivityType", menuName = "Plante/ActivityType")]
public class ActivityType : ScriptableObject
{
	public string activityName;
	public GameObject plantPrefab;
	public float effortToGrow = 100f;
	public Sprite icon;
}