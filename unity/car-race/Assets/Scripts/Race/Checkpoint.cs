using Playora.Vehicles;
using UnityEngine;

namespace Playora.Race
{
    /// <summary>
    /// A gate across the circuit, passed in order.
    /// </summary>
    /// <remarks>
    /// Ordered checkpoints are what make a lap mean something: without them a
    /// car could reverse back and forth over the finish line, or cut half the
    /// circuit, and still be credited with a lap.
    /// </remarks>
    [RequireComponent(typeof(Collider))]
    public class Checkpoint : MonoBehaviour
    {
        [SerializeField] private int index;
        [SerializeField] private RaceDirector director;

        public int Index => index;

        private void Reset()
        {
            var collider = GetComponent<Collider>();
            collider.isTrigger = true;
        }

        private void OnTriggerEnter(Collider other)
        {
            var vehicle = other.GetComponentInParent<VehicleController>();
            if (vehicle == null) return;

            var identity = vehicle.GetComponent<RacerIdentity>();
            if (identity == null || director == null) return;

            director.OnCheckpointPassed(identity.PlayerId, index);
        }
    }

    /// <summary>Ties a vehicle in the scene to a player id from the platform.</summary>
    public class RacerIdentity : MonoBehaviour
    {
        [SerializeField] private string playerId;

        public string PlayerId => playerId;

        public void Assign(string id) => playerId = id;
    }
}
