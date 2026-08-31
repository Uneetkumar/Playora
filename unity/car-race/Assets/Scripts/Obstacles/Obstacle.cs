using System;
using UnityEngine;

namespace Playora.Racing.Obstacles
{
    public enum ObstacleType
    {
        Roadblock,
        SpikeStrip,
        ExplosiveBarrel,
        OilSpill,
        ElectricFence
    }

    /// <summary>
    /// Base class for all track hazards and dynamic obstacles in Playora Racing.
    /// </summary>
    public abstract class Obstacle : MonoBehaviour
    {
        [Header("Obstacle Settings")]
        public ObstacleType obstacleType;
        public float speedPenalty = 0.5f;
        public float stunDuration = 1.2f;
        public AudioClip collisionSound;
        public GameObject collisionVfxPrefab;

        protected virtual void OnCollisionEnter(Collision collision)
        {
            var vehicle = collision.collider.GetComponentInParent<Playora.Racing.Vehicles.VehicleController>();
            if (vehicle != null)
            {
                OnVehicleHit(vehicle);
                TriggerFeedback(collision.contacts[0].point);
            }
        }

        protected virtual void OnTriggerEnter(Collider other)
        {
            var vehicle = other.GetComponentInParent<Playora.Racing.Vehicles.VehicleController>();
            if (vehicle != null)
            {
                OnVehicleHit(vehicle);
                TriggerFeedback(other.transform.position);
            }
        }

        protected abstract void OnVehicleHit(Playora.Racing.Vehicles.VehicleController vehicle);

        protected virtual void TriggerFeedback(Vector3 hitPoint)
        {
            if (collisionSound != null)
                AudioSource.PlayClipAtPoint(collisionSound, hitPoint);

            if (collisionVfxPrefab != null)
                Instantiate(collisionVfxPrefab, hitPoint, Quaternion.identity);
        }
    }
}
