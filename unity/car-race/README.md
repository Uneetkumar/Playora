# Playora — Car Race (Unity 6)

The 3D racing game. Unity owns the world; the Playora web platform owns
everything around it (spec v2 §44).

**Nothing here has been compiled.** A Unity WebGL build cannot be produced from
a coding session — it needs the Unity Editor and a Photon App ID. What exists is
the project structure, the C# that implements the architecture, and the bridge
contract the platform already speaks. The steps below are what turns it into a
running game.

## What is here

| Path | What it is |
|---|---|
| `Assets/Scripts/Core/PlayoraBridge.cs` | The only boundary between Unity and the platform |
| `Assets/Scripts/Core/BridgeTypes.cs` | Wire shapes, mirroring `packages/protocol/src/unity-bridge.ts` |
| `Assets/Plugins/WebGL/PlayoraBridge.jslib` | Unity → browser, via one global dispatcher |
| `Assets/Scripts/Vehicles/VehicleController.cs` | Rigidbody + WheelCollider physics. Assigns no transforms (§47) |
| `Assets/Scripts/Vehicles/VehicleTuning.cs` | Per-vehicle data, mirroring the platform garage |
| `Assets/Scripts/Vehicles/VehicleInput.cs` | The one input shape used by players, AI and the network |
| `Assets/Scripts/AI/RacingAgent.cs` | A bot that drives through `SetInput` and nothing else (§56) |
| `Assets/Scripts/Race/RaceDirector.cs` | Countdown, laps, finish, and the result report |
| `Assets/Scripts/Race/Checkpoint.cs` | Ordered gates, so a lap cannot be farmed |
| `Assets/Scripts/Optimization/QualityTiers.cs` | LOW/MEDIUM/HIGH, auto-detected (§100) |

## What still has to be built in the Editor

These need a person with Unity open. They are marked `TODO` in the C# where
relevant.

1. **Scenes** — `Bootstrap`, `Race`, `Results` (§46).
2. **A track.** `RaceDirector` currently uses whatever circuit is authored in
   the scene and ignores `trackSeed`. To match the platform's own generator, the
   circuit should be generated from that seed.
3. **Vehicle prefabs** with `WheelCollider`s wired to `VehicleController`, and a
   `VehicleTuning` asset per entry in the platform garage
   (`packages/game-engine/src/racing/garage.ts`).
4. **Photon Fusion 2** — install the package, set the App ID, and implement
   `Assets/Scripts/Networking/`. Until then a race runs locally and reports
   `authority: "local"`.
5. **Audio, particles, camera** — `Assets/Scripts/{Audio,Camera}` are empty.

## Building

Requires **Unity 6** (see `ProjectSettings/ProjectVersion.txt`).

1. Open this folder in Unity Hub.
2. `File → Build Settings → Web`.
3. Player Settings:
   - Compression Format: **Brotli**
   - Managed Stripping Level: **High**
   - IL2CPP Code Generation: **Faster (smaller) builds**
   - Decompression Fallback: **off** (the server sets the encoding headers)
4. Build to `apps/web/public/unity/car-race/`.

The platform expects exactly this layout:

```
apps/web/public/unity/car-race/
  Build/
    car-race.loader.js
    car-race.data.br
    car-race.framework.js.br
    car-race.wasm.br
  StreamingAssets/
```

## How the platform picks an engine

`apps/web/src/games/racing/unity/use-racing-renderer.ts` sends a `HEAD` request
for `car-race.loader.js`. If it is there, Unity runs. If it is not, the existing
web build runs and the game stays playable.

So: **drop a build into that folder and the platform switches over on its own.**
No code change, no flag.

## Serving the build

Brotli-compressed Unity files need the right headers or the browser will not
decompress them:

```
Content-Encoding: br
Content-Type: application/javascript   # .framework.js.br
Content-Type: application/wasm         # .wasm.br
Content-Type: application/octet-stream # .data.br
```

Build output is git-ignored — it is tens of megabytes of generated artefact.
Ship it through your asset host or CI rather than the repository.

## The rule that matters most

Spec v2 §58: never trust position, speed, lap, finish or winner from the
browser. `RaceDirector` reports what it saw, and says whether that came from a
networked session (`authority: "photon"`) or from this client alone
(`authority: "local"`). **A rated online race must not write a rating from a
`local` report.** The platform side enforces this in `UnityRaceRun.tsx`.
