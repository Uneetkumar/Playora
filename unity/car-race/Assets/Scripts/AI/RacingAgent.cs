using Playora.Vehicles;
using UnityEngine;

namespace Playora.AI
{
    /// <summary>
    /// A bot driver.
    /// </summary>
    /// <remarks>
    /// Spec v2 section 56: an AI must use the same vehicle and input pathway a
    /// human does, and must never teleport or write authoritative transforms.
    /// This class therefore produces a <see cref="VehicleInput"/> and hands it
    /// to <see cref="VehicleController.SetInput"/> — exactly what the keyboard
    /// reader does. It has no other way to affect the world.
    ///
    /// Difficulty changes how far ahead it looks and how precisely it corrects,
    /// never how fast the car is allowed to go. A bot that is simply faster
    /// than physics permits is a cheat, and players can always tell.
    /// </remarks>
    [RequireComponent(typeof(VehicleController))]
    public class RacingAgent : MonoBehaviour
    {
        [Range(1, 7)]
        [SerializeField] private int level = 3;

        [Tooltip("Waypoints around the racing line, in order.")]
        [SerializeField] private Transform[] racingLine;

        private VehicleController _vehicle;
        private int _target;

        private struct Profile
        {
            public float Lookahead;
            public float Correction;
            public float CornerSpeed;
            public float LapseChance;
            public bool UsesNitroWell;
        }

        private void Awake()
        {
            _vehicle = GetComponent<VehicleController>();
        }

        public void SetLevel(int value) => level = Mathf.Clamp(value, 1, 7);

        public void SetRacingLine(Transform[] line) => racingLine = line;

        private Profile ProfileFor(int lvl)
        {
            // Spread so the ladder is felt rather than nominal. Measured
            // against itself once the track exists, the way the Three.js bot's
            // ladder was — an unmeasured difficulty curve is a guess.
            switch (lvl)
            {
                case 1: return new Profile { Lookahead = 18f, Correction = 1.1f, CornerSpeed = 0.55f, LapseChance = 0.40f, UsesNitroWell = false };
                case 2: return new Profile { Lookahead = 26f, Correction = 1.5f, CornerSpeed = 0.65f, LapseChance = 0.28f, UsesNitroWell = false };
                case 3: return new Profile { Lookahead = 34f, Correction = 1.9f, CornerSpeed = 0.74f, LapseChance = 0.18f, UsesNitroWell = false };
                case 4: return new Profile { Lookahead = 42f, Correction = 2.3f, CornerSpeed = 0.82f, LapseChance = 0.11f, UsesNitroWell = true };
                case 5: return new Profile { Lookahead = 52f, Correction = 2.7f, CornerSpeed = 0.88f, LapseChance = 0.06f, UsesNitroWell = true };
                case 6: return new Profile { Lookahead = 62f, Correction = 3.1f, CornerSpeed = 0.94f, LapseChance = 0.02f, UsesNitroWell = true };
                default: return new Profile { Lookahead = 74f, Correction = 3.5f, CornerSpeed = 1.00f, LapseChance = 0.00f, UsesNitroWell = true };
            }
        }

        private void FixedUpdate()
        {
            if (_vehicle == null || racingLine == null || racingLine.Length == 0) return;

            var profile = ProfileFor(level);
            AdvanceTarget();

            var aim = racingLine[_target];
            if (aim == null) return;

            // A lapse is a moment of inattention: foot still in, correction
            // stops. That drifts the car wide, which is what a weak driver does.
            if (Random.value < profile.LapseChance * Time.fixedDeltaTime * 10f)
            {
                _vehicle.SetInput(new VehicleInput { Throttle = 1f, Steer = 0f });
                return;
            }

            var local = transform.InverseTransformPoint(aim.position);
            var steer = Mathf.Clamp(local.x / Mathf.Max(1f, local.magnitude) * profile.Correction, -1f, 1f);

            // How sharply the line turns within sight decides whether it should
            // already be braking. Lookahead is therefore the skill dial.
            var ahead = LookaheadTurn(profile.Lookahead);
            var ceiling = _vehicle.Tuning.maxSpeed * profile.CornerSpeed * (1f - Mathf.Min(0.55f, ahead));
            var tooFast = _vehicle.ForwardSpeed > ceiling;

            _vehicle.SetInput(new VehicleInput
            {
                Steer = steer,
                Throttle = tooFast ? 0f : 1f,
                Brake = tooFast && _vehicle.ForwardSpeed > ceiling * 1.15f ? 1f : 0f,
                // Nitro belongs on a straight. Spending it into a corner wastes
                // it: the car cannot use the speed and gets thrown off the road.
                Nitro = profile.UsesNitroWell && ahead < 0.08f && _vehicle.ForwardSpeed > _vehicle.Tuning.maxSpeed * 0.7f
            });
        }

        private void AdvanceTarget()
        {
            var aim = racingLine[_target];
            if (aim == null) return;

            // Waypoints are consumed by proximity, and the index wraps: the
            // circuit is a loop and a lap must not run off the end of an array.
            if (Vector3.Distance(transform.position, aim.position) < 12f)
            {
                _target = (_target + 1) % racingLine.Length;
            }
        }

        /// <summary>How much the racing line bends within the lookahead, 0..1.</summary>
        private float LookaheadTurn(float distance)
        {
            var steps = Mathf.Max(2, Mathf.RoundToInt(distance / 12f));
            var total = 0f;

            for (var i = 0; i < steps; i++)
            {
                var a = racingLine[(_target + i) % racingLine.Length];
                var b = racingLine[(_target + i + 1) % racingLine.Length];
                var c = racingLine[(_target + i + 2) % racingLine.Length];
                if (a == null || b == null || c == null) continue;

                var first = (b.position - a.position).normalized;
                var second = (c.position - b.position).normalized;
                total += Vector3.Angle(first, second);
            }

            return Mathf.Clamp01(total / (steps * 45f));
        }
    }
}
