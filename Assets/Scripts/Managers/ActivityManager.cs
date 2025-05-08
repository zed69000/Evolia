using UnityEngine;

public class ActivityManager : MonoBehaviour
{
	public ActivityData[] activities;
	public ActivityTracker tracker; // 🔗 Lien vers le système de plantes

	public ActivityData GetActivityBySpeed(float speedKmh, bool isIndoor)
	{
		ActivityData selected = null;
		float bestMinSpeed = float.MinValue;

		foreach (var activity in activities)
		{
			if (activity.isIndoor == isIndoor && speedKmh >= activity.minSpeedKmh && activity.minSpeedKmh > bestMinSpeed)
			{
				selected = activity;
				bestMinSpeed = activity.minSpeedKmh;
			}
		}

		return selected;
	}
}
