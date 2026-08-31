using System;
using UnityEngine;

namespace Playora.Racing.PowerUps
{
    public enum PowerUpType
    {
        Nitro,
        Shield,
        Repair,
        Magnet,
        BoostPad
    }

    /// <summary>
    /// Core data-driven PowerUp base class for Playora Racing.
    /// </summary>
    public abstract class PowerUp : MonoBehaviour
    {
        [Header("Config")]
        public PowerUpType type;
        public float duration = 4.0f;
        public float cooldown = 0.5f;
        public AudioClip pickupSound;
        public GameObject pickupVfxPrefab;

        [Header("Animation")]
        public float rotationSpeed = 90f;
        public float bobHeight = 0.25f;
        public float bobSpeed = 3f;

        private Vector3 _initialPosition;

        protected virtual void Start()
        {
            _initialPosition = transform.position;
        }

        protected virtual void Update()
        {
            // Idle floating animation
            transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime, Space.World);
            float yOffset = Mathf.Sin(Time.time * bobSpeed) * bobHeight;
            transform.position = _initialPosition + new Vector3(0, yOffset, 0);
        }

        private void OnTriggerEnter(Collider other)
        {
            var vehicle = other.GetComponentInParent<Playora.Racing.Vehicles.VehicleController>();
            if (vehicle != null)
            {
                ApplyEffect(vehicle);
                PlayEffects();
                gameObject.SetActive(false);
            }
        }

        protected abstract void ApplyEffect(Playora.Racing.Vehicles.VehicleController vehicle);

        protected virtual void PlayEffects()
        {
            if (pickupSound != null)
                AudioSource.PlayClipAtPoint(pickupSound, transform.position);

            if (pickupVfxPrefab != null)
                Instantiate(pickupVfxPrefab, transform.position, Quaternion.identity);
        }
    }
}
