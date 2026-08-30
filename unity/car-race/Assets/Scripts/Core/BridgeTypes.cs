using System;

namespace Playora.Core
{
    /// <summary>
    /// The wire shapes, mirroring packages/protocol/src/unity-bridge.ts.
    /// </summary>
    /// <remarks>
    /// Plain serialisable classes with public fields, because Unity's
    /// JsonUtility cannot see properties and does not support dictionaries,
    /// nullables or polymorphism. The TypeScript side is a discriminated union;
    /// here that becomes one flat class per direction with a `type` tag and the
    /// unused fields left at their defaults. Ugly, and the only thing
    /// JsonUtility will actually round-trip without a third-party dependency.
    /// </remarks>
    [Serializable]
    public class UnityCommand
    {
        public string type;
        public UnitySessionConfig session;
        public bool paused;
        public string tier;
        public string scheme;
        public float sensitivity = 1f;
        public float master = 1f;
        public float sfx = 1f;
        public float music = 1f;
    }

    [Serializable]
    public class UnityPlayerConfig
    {
        public string playerId;
        public string displayName;
        public string vehicleId;
        public bool isBot;
        public int aiLevel = 3;
    }

    [Serializable]
    public class UnityPhotonConfig
    {
        public string appId;
        public string region;
        public string roomName;
        public string token;
    }

    [Serializable]
    public class UnitySessionConfig
    {
        public string sessionId;
        public string gameId;
        public int trackSeed;
        public float trackLength;
        public int laps;
        public string vehicleId;
        public string localPlayerId;
        public UnityPlayerConfig[] players;
        public UnityPhotonConfig photon;
        public string quality;
        public string controls;

        /// <summary>True when this race has a networked session to join.</summary>
        public bool IsNetworked => photon != null && !string.IsNullOrEmpty(photon.roomName);
    }

    [Serializable]
    public class UnityPlacing
    {
        public string playerId;
        public int place;
        public float raceTimeMs;
        public float bestLapMs;
        public int lapsCompleted;
        public bool finished;
    }

    /// <summary>
    /// What Unity says happened. Not what happened.
    /// </summary>
    /// <remarks>
    /// Spec v2 section 58: position, lap, finish and winner must never be
    /// trusted from the browser. A single-player race can be taken at face
    /// value because there is nobody to cheat; a networked race must be
    /// arbitrated by the Photon session, which is what `authority` records.
    /// </remarks>
    [Serializable]
    public class UnityRaceReport
    {
        public string sessionId;
        public UnityPlacing[] reportedPlacings;
        public string authority = "local";
    }

    [Serializable]
    public class UnityTelemetry
    {
        public int place;
        public int totalPlayers;
        public int lap;
        public int laps;
        public float speedKph;
        public float fps;
    }

    [Serializable]
    public class UnityEventPayload
    {
        public string type;
        public string buildVersion;
        public float progress;
        public string label;
        public int value;
        public UnityTelemetry telemetry;
        public UnityRaceReport report;
        public bool paused;
        public string code;
        public string message;
    }
}
