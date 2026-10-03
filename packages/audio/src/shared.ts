import { AudioEngine } from "./engine.js";

/**
 * The one AudioEngine every game, menu and settings control plays through.
 *
 * One, because each engine owns an AudioContext and its own copy of the mixer:
 * a second engine would ignore the mute button the first one honours, and
 * browsers cap the contexts a page may hold. Constructing it is inert — no Web
 * Audio until something plays, and a guarded storage read — so reaching it
 * during server rendering is safe.
 */
const KEY = Symbol.for("playora.audio.engine");
const holder = globalThis as { [KEY]?: AudioEngine };

// A dev server's hot reload re-evaluates this module whenever the engine or a
// sound spec is edited. Close the previous engine instead of leaking its
// context, and let the next call build one that runs the code just saved —
// keeping the old instance would keep playing the old sounds until a reload.
// The previous instance is found through `globalThis` because a module
// variable does not survive the re-evaluation. In production this never runs.
const previous = holder[KEY];
if (previous) {
  delete holder[KEY];
  void previous.dispose();
}

export function getAudioEngine(): AudioEngine {
  holder[KEY] ??= new AudioEngine();
  return holder[KEY];
}
