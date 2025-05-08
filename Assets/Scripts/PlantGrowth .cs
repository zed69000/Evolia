using UnityEngine;

public class PlantGrowth : MonoBehaviour
{
	public Transform plantTransform;
	public float growthPerPoint = 0.01f;
	public float scaleFactor = 1f;
	private float growthScore = 0f;

	public void AddGrowth(float points)
	{
		growthScore += points * scaleFactor;
		float newScale = 1f + growthScore * growthPerPoint;
		plantTransform.localScale = new Vector3(1f, newScale, 1f);
	}
}
