using System.Collections;
using System.Collections.Generic;
using Playora.Core;
using Playora.Optimization;
using Playora.Vehicles;
using UnityEngine;

namespace Playora.Race
{
    /// <summary>
    /// Runs a race from the grid to the result.
    /// </summary>
    /// <remarks>
    /// Owns the countdown, lap counting and the finish, and is the only thing
    /// that reports a result to the platform. It reports what it saw — spec v2
    /// section 58 means that report is evidence, not a verdict, and a networked
    /// race must have Photon arbitrate before any rating is written.
    /// </remarks>
    public class RaceDirector : MonoBehaviour
    {
        [SerializeField] private Transform[] gridSlots;
        [SerializeField] private Transform[] racingLine;
        [SerializeField] private Checkpoint[] checkpoints;

        private readonly Dictionary<string, RacerState> _racers = new Dictionary<string, RacerState>();
        private UnitySessionConfig _config;
        private float _startedAt;
        private bool _running;
        private int _finishedCount;

        private class RacerState
        {
            public string PlayerId;
            public VehicleController Vehicle;
            public int Lap;
            public int NextCheckpoint;
            public float LapStartedAt;
            public float BestLapMs = -1f;
            public float FinishedAtMs = -1f;
            public int Place;
        }

        private void OnEnable()
        {
            if (PlayoraBridge.Instance != null)
            {
                PlayoraBridge.Instance.CommandReceived += OnCommand;
            }
        }

        private void OnDisable()
        {
            if (PlayoraBridge.Instance != null)
            {
                PlayoraBridge.Instance.CommandReceived -= OnCommand;
            }
        }

        private void OnCommand(UnityCommand command)
        {
            switch (command.type)
            {
                case "INIT":
                    StartCoroutine(Build(command.session));
                    break;

                case "SET_PAUSED":
                    // Only meaningful offline. A networked race keeps running
                    // on the server's clock whatever this client does.
                    if (_config == null || !_config.IsNetworked)
                    {
                        Time.timeScale = command.paused ? 0f : 1f;
                    }
                    PlayoraBridge.Instance.Emit(new UnityEventPayload
                    {
                        type = "PAUSED",
                        paused = command.paused
                    });
                    break;

                case "SET_QUALITY":
                    QualityTiers.Apply(QualityTiers.Parse(command.tier));
                    break;

                case "LEAVE":
                    Time.timeScale = 1f;
                    PlayoraBridge.Instance.Emit(new UnityEventPayload { type = "LEFT" });
                    break;
            }
        }

        private IEnumerator Build(UnitySessionConfig config)
        {
            _config = config;
            _racers.Clear();
            _finishedCount = 0;
            _running = false;

            QualityTiers.Apply(QualityTiers.Parse(config.quality));

            PlayoraBridge.Instance.EmitProgress(0.1f, "Building the circuit");
            // TODO(track): generate the circuit from config.trackSeed so it
            // matches the platform's own generator exactly. Until then the
            // scene's authored track is used and the seed is ignored.
            yield return null;

            PlayoraBridge.Instance.EmitProgress(0.5f, "Placing the grid");
            SeatRacers(config);
            yield return null;

            PlayoraBridge.Instance.EmitProgress(0.9f, "Warming up");
            yield return new WaitForSeconds(0.2f);

            PlayoraBridge.Instance.Emit(new UnityEventPayload { type = "LOADED" });
            yield return StartCoroutine(Countdown());
        }

        private void SeatRacers(UnitySessionConfig config)
        {
            if (config.players == null) return;

            for (var i = 0; i < config.players.Length && i < gridSlots.Length; i++)
            {
                var player = config.players[i];
                var slot = gridSlots[i];
                // TODO(spawn): instantiate the prefab for player.vehicleId from
                // Addressables rather than reusing whatever is in the scene.
                var vehicle = slot.GetComponentInChildren<VehicleController>();
                if (vehicle == null) continue;

                vehicle.ResetTo(slot.position, slot.rotation);

                if (player.isBot)
                {
                    var agent = vehicle.GetComponent<AI.RacingAgent>();
                    if (agent != null)
                    {
                        agent.SetLevel(player.aiLevel);
                        agent.SetRacingLine(racingLine);
                        agent.enabled = true;
                    }
                }

                _racers[player.playerId] = new RacerState
                {
                    PlayerId = player.playerId,
                    Vehicle = vehicle,
                    NextCheckpoint = 0
                };
            }
        }

        private IEnumerator Countdown()
        {
            for (var n = 3; n >= 1; n--)
            {
                PlayoraBridge.Instance.Emit(new UnityEventPayload { type = "COUNTDOWN", value = n });
                yield return new WaitForSeconds(1f);
            }

            PlayoraBridge.Instance.Emit(new UnityEventPayload { type = "COUNTDOWN", value = 0 });
            PlayoraBridge.Instance.Emit(new UnityEventPayload { type = "RACE_STARTED" });

            _startedAt = Time.time;
            _running = true;

            foreach (var racer in _racers.Values)
            {
                racer.LapStartedAt = _startedAt;
            }
        }

        /// <summary>Called by a <see cref="Checkpoint"/> when a car passes it.</summary>
        public void OnCheckpointPassed(string playerId, int checkpointIndex)
        {
            if (!_running || !_racers.TryGetValue(playerId, out var racer)) return;

            // Checkpoints must be taken in order, which is what stops a car
            // reversing over the line to farm laps or cutting the circuit.
            if (checkpointIndex != racer.NextCheckpoint) return;

            racer.NextCheckpoint++;

            if (racer.NextCheckpoint < checkpoints.Length) return;

            racer.NextCheckpoint = 0;
            racer.Lap++;

            var lapMs = (Time.time - racer.LapStartedAt) * 1000f;
            racer.LapStartedAt = Time.time;
            if (racer.BestLapMs < 0f || lapMs < racer.BestLapMs) racer.BestLapMs = lapMs;

            if (racer.Lap >= _config.laps && racer.FinishedAtMs < 0f)
            {
                racer.FinishedAtMs = (Time.time - _startedAt) * 1000f;
                racer.Place = ++_finishedCount;

                if (_finishedCount >= _racers.Count) Finish();
            }
        }

        private void Finish()
        {
            _running = false;

            var placings = new List<UnityPlacing>();
            foreach (var racer in _racers.Values)
            {
                placings.Add(new UnityPlacing
                {
                    playerId = racer.PlayerId,
                    place = racer.Place > 0 ? racer.Place : _racers.Count,
                    raceTimeMs = racer.FinishedAtMs > 0f ? racer.FinishedAtMs : (Time.time - _startedAt) * 1000f,
                    bestLapMs = racer.BestLapMs,
                    lapsCompleted = racer.Lap,
                    finished = racer.FinishedAtMs > 0f
                });
            }

            PlayoraBridge.Instance.Emit(new UnityEventPayload
            {
                type = "RACE_FINISHED",
                report = new UnityRaceReport
                {
                    sessionId = _config.sessionId,
                    reportedPlacings = placings.ToArray(),
                    // Honest about where this came from. The platform must not
                    // write a rating from a "local" report in a networked race.
                    authority = _config.IsNetworked ? "photon" : "local"
                }
            });
        }

        private float _telemetryAt;

        private void Update()
        {
            if (!_running || _config == null) return;

            // Low rate on purpose: the HUD lives inside Unity, and this exists
            // only for platform surfaces outside the canvas.
            if (Time.time - _telemetryAt < 0.25f) return;
            _telemetryAt = Time.time;

            if (!_racers.TryGetValue(_config.localPlayerId, out var me)) return;

            PlayoraBridge.Instance.Emit(new UnityEventPayload
            {
                type = "TELEMETRY",
                telemetry = new UnityTelemetry
                {
                    place = me.Place > 0 ? me.Place : PlaceOf(me),
                    totalPlayers = _racers.Count,
                    lap = Mathf.Min(me.Lap + 1, _config.laps),
                    laps = _config.laps,
                    speedKph = me.Vehicle != null ? me.Vehicle.SpeedKph : 0f,
                    fps = 1f / Mathf.Max(0.0001f, Time.smoothDeltaTime)
                }
            });
        }

        /// <summary>Live position, by laps then checkpoints reached.</summary>
        private int PlaceOf(RacerState racer)
        {
            var ahead = 1;
            foreach (var other in _racers.Values)
            {
                if (other == racer) continue;
                if (other.Lap > racer.Lap ||
                    (other.Lap == racer.Lap && other.NextCheckpoint > racer.NextCheckpoint))
                {
                    ahead++;
                }
            }
            return ahead;
        }
    }
}
