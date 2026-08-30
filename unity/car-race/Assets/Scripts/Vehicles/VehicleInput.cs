using UnityEngine;

namespace Playora.Vehicles
{
    /// <summary>
    /// One frame of intent: what the driver is asking for, not where they are.
    /// </summary>
    /// <remarks>
    /// The single input type for humans, AI and the network. Spec v2 section 56
    /// requires bots to drive through the same pathway a player does, and
    /// section 58 requires the network to carry input rather than position — so
    /// having exactly one shape for "what the driver wants" is what makes both
    /// rules enforceable rather than aspirational.
    /// </remarks>
    public struct VehicleInput
    {
        /// <summary>-1 full left, +1 full right.</summary>
        public float Steer;

        /// <summary>0..1.</summary>
        public float Throttle;

        /// <summary>0..1.</summary>
        public float Brake;

        /// <summary>Rising edge only; holding does not drain a second charge.</summary>
        public bool Nitro;

        public bool Handbrake;

        public static VehicleInput Neutral => new VehicleInput();

        public VehicleInput Clamped()
        {
            return new VehicleInput
            {
                Steer = Mathf.Clamp(Steer, -1f, 1f),
                Throttle = Mathf.Clamp01(Throttle),
                Brake = Mathf.Clamp01(Brake),
                Nitro = Nitro,
                Handbrake = Handbrake
            };
        }
    }
}
