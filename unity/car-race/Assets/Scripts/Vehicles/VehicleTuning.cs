using UnityEngine;

namespace Playora.Vehicles
{
    /// <summary>
    /// How one vehicle behaves, as data rather than code.
    /// </summary>
    /// <remarks>
    /// A ScriptableObject so the roster can be balanced in the Editor without a
    /// rebuild, and so a designer can tune a car without touching C#. The
    /// fields deliberately mirror the garage modifiers the platform already
    /// ships in packages/game-engine/src/racing/garage.ts — the stat bars the
    /// player compares must describe the physics they are about to drive.
    /// </remarks>
    [CreateAssetMenu(fileName = "VehicleTuning", menuName = "Playora/Vehicle Tuning")]
    public class VehicleTuning : ScriptableObject
    {
        [Header("Identity")]
        public string vehicleId = "car-balanced";
        public string displayName = "Vanta GT";

        [Header("Engine")]
        [Tooltip("Metres per second at full throttle on tarmac.")]
        public float maxSpeed = 78f;

        public float acceleration = 26f;
        public float brakeForce = 46f;

        [Tooltip("Deceleration when the throttle is released.")]
        public float engineBraking = 9f;

        [Header("Chassis")]
        public float mass = 1200f;
        public float downforce = 45f;

        [Tooltip("Sideways grip. Lower slides more.")]
        public float lateralGrip = 12f;

        public float steerAngleDegrees = 32f;

        [Tooltip("Steering is reduced at speed, or the car darts at the limit.")]
        public AnimationCurve steerBySpeed = AnimationCurve.Linear(0f, 1f, 1f, 0.45f);

        [Header("Suspension")]
        public float suspensionDistance = 0.28f;
        public float suspensionSpring = 32000f;
        public float suspensionDamper = 4200f;

        [Header("Nitro")]
        public int nitroCharges = 2;
        public float nitroMultiplier = 1.35f;
        public float nitroSeconds = 2.5f;
    }
}
