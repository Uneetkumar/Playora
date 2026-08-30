using UnityEngine;

namespace Playora.Vehicles
{
    /// <summary>
    /// A vehicle, driven by forces.
    /// </summary>
    /// <remarks>
    /// Spec v2 section 47: "Do not fake vehicle movement by directly assigning
    /// transforms." Nothing here writes to `transform.position` or
    /// `transform.rotation` — every movement comes from forces and torques on a
    /// Rigidbody, and the wheels are real WheelColliders. That is what makes
    /// collisions, suspension, kerbs and contact between cars behave like a
    /// game rather than like two sprites overlapping.
    ///
    /// It is also what lets AI and the network drive the same code path: both
    /// supply a <see cref="VehicleInput"/> and nothing else.
    /// </remarks>
    [RequireComponent(typeof(Rigidbody))]
    public class VehicleController : MonoBehaviour
    {
        [SerializeField] private VehicleTuning tuning;

        [Header("Wheels")]
        [SerializeField] private WheelCollider frontLeft;
        [SerializeField] private WheelCollider frontRight;
        [SerializeField] private WheelCollider rearLeft;
        [SerializeField] private WheelCollider rearRight;

        [Header("Visuals")]
        [SerializeField] private Transform frontLeftMesh;
        [SerializeField] private Transform frontRightMesh;
        [SerializeField] private Transform rearLeftMesh;
        [SerializeField] private Transform rearRightMesh;
        [SerializeField] private Transform bodyMesh;

        private Rigidbody _body;
        private VehicleInput _input;
        private int _nitroRemaining;
        private float _nitroUntil;

        /// <summary>Metres per second along the vehicle's forward axis.</summary>
        public float ForwardSpeed => _body == null ? 0f : Vector3.Dot(_body.linearVelocity, transform.forward);

        public float SpeedKph => Mathf.Abs(ForwardSpeed) * 3.6f;

        public int NitroRemaining => _nitroRemaining;

        public bool Boosting => Time.time < _nitroUntil;

        public VehicleTuning Tuning => tuning;

        private void Awake()
        {
            _body = GetComponent<Rigidbody>();

            if (tuning == null)
            {
                Debug.LogError($"[playora] {name} has no VehicleTuning assigned.");
                enabled = false;
                return;
            }

            _body.mass = tuning.mass;
            // Low and slightly back: a high centre of mass rolls the car over
            // on the first corner, which is the classic WheelCollider mistake.
            _body.centerOfMass = new Vector3(0f, -0.35f, -0.1f);
            _nitroRemaining = tuning.nitroCharges;

            ApplySuspension(frontLeft);
            ApplySuspension(frontRight);
            ApplySuspension(rearLeft);
            ApplySuspension(rearRight);
        }

        private void ApplySuspension(WheelCollider wheel)
        {
            if (wheel == null) return;

            wheel.suspensionDistance = tuning.suspensionDistance;
            var spring = wheel.suspensionSpring;
            spring.spring = tuning.suspensionSpring;
            spring.damper = tuning.suspensionDamper;
            wheel.suspensionSpring = spring;

            var sideways = wheel.sidewaysFriction;
            sideways.stiffness = tuning.lateralGrip / 10f;
            wheel.sidewaysFriction = sideways;
        }

        /// <summary>
        /// Sets the intent for the next physics step.
        /// </summary>
        /// <remarks>
        /// Called by the local input reader, by <c>RacingAgent</c> for a bot, or
        /// by the network layer for a remote car. All three go through here, so
        /// there is no path that moves a vehicle without asking the physics.
        /// </remarks>
        public void SetInput(VehicleInput input)
        {
            _input = input.Clamped();

            if (_input.Nitro && _nitroRemaining > 0 && !Boosting)
            {
                _nitroRemaining--;
                _nitroUntil = Time.time + tuning.nitroSeconds;
            }
        }

        private void FixedUpdate()
        {
            if (tuning == null) return;

            var speedFraction = Mathf.Clamp01(Mathf.Abs(ForwardSpeed) / tuning.maxSpeed);
            var ceiling = tuning.maxSpeed * (Boosting ? tuning.nitroMultiplier : 1f);

            // Drive torque tails off near the ceiling rather than stopping
            // dead, so top speed feels like effort instead of a wall.
            var headroom = Mathf.Clamp01(1f - Mathf.Abs(ForwardSpeed) / Mathf.Max(1f, ceiling));
            var drive = _input.Throttle * tuning.acceleration * (0.35f + 0.65f * headroom);
            if (Boosting) drive *= 1.6f;

            var brake = _input.Brake * tuning.brakeForce;
            if (_input.Throttle <= 0.01f && _input.Brake <= 0.01f)
            {
                brake += tuning.engineBraking;
            }

            // Rear wheel drive: torque on the rears, braking on all four.
            ApplyTorque(rearLeft, drive);
            ApplyTorque(rearRight, drive);
            ApplyBrake(frontLeft, brake);
            ApplyBrake(frontRight, brake);
            ApplyBrake(rearLeft, brake + (_input.Handbrake ? tuning.brakeForce * 2f : 0f));
            ApplyBrake(rearRight, brake + (_input.Handbrake ? tuning.brakeForce * 2f : 0f));

            var steerAngle = _input.Steer * tuning.steerAngleDegrees * tuning.steerBySpeed.Evaluate(speedFraction);
            if (frontLeft != null) frontLeft.steerAngle = steerAngle;
            if (frontRight != null) frontRight.steerAngle = steerAngle;

            // Downforce grows with speed, which is what keeps the car planted
            // through fast corners without making it undriveable when slow.
            _body.AddForce(-transform.up * tuning.downforce * speedFraction * speedFraction, ForceMode.Force);

            UpdateWheelMeshes();
        }

        private static void ApplyTorque(WheelCollider wheel, float torque)
        {
            if (wheel != null) wheel.motorTorque = torque;
        }

        private static void ApplyBrake(WheelCollider wheel, float torque)
        {
            if (wheel != null) wheel.brakeTorque = torque;
        }

        /// <summary>
        /// Moves the visible wheels to where the colliders actually are.
        /// </summary>
        /// <remarks>
        /// This is the one place a transform is assigned, and it is cosmetic:
        /// the mesh follows the simulation, never the other way round.
        /// </remarks>
        private void UpdateWheelMeshes()
        {
            Match(frontLeft, frontLeftMesh);
            Match(frontRight, frontRightMesh);
            Match(rearLeft, rearLeftMesh);
            Match(rearRight, rearRightMesh);

            if (bodyMesh != null)
            {
                // Body roll, read from lateral acceleration rather than animated.
                var lateral = Vector3.Dot(_body.linearVelocity, transform.right);
                var roll = Mathf.Clamp(-lateral * 0.35f, -6f, 6f);
                bodyMesh.localRotation = Quaternion.Slerp(
                    bodyMesh.localRotation,
                    Quaternion.Euler(0f, 0f, roll),
                    Time.fixedDeltaTime * 6f);
            }
        }

        private static void Match(WheelCollider wheel, Transform mesh)
        {
            if (wheel == null || mesh == null) return;
            wheel.GetWorldPose(out var position, out var rotation);
            mesh.SetPositionAndRotation(position, rotation);
        }

        /// <summary>Puts the car back on the grid. Used by the race director only.</summary>
        public void ResetTo(Vector3 position, Quaternion rotation)
        {
            _body.linearVelocity = Vector3.zero;
            _body.angularVelocity = Vector3.zero;
            _body.position = position;
            _body.rotation = rotation;
            _nitroRemaining = tuning.nitroCharges;
            _nitroUntil = 0f;
            _input = VehicleInput.Neutral;
        }
    }
}
