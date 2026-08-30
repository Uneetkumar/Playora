// The Unity side of the Playora bridge.
//
// WebGL plugins can only reach globals, so everything is funnelled through one
// dispatcher the page installs (see UNITY_BRIDGE_GLOBAL in
// packages/protocol/src/unity-bridge.ts). Keeping it to a single entry point
// means the whole surface between Unity and the platform is one function.
mergeInto(LibraryManager.library, {
  PlayoraEmit: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    try {
      var bridge = window.__playoraUnityBridge;
      // Unity boots before React mounts on a cold load, so early events would
      // otherwise be dropped. The dispatcher buffers until a listener attaches.
      if (bridge && typeof bridge.receive === "function") {
        bridge.receive(json);
      } else {
        window.__playoraUnityPending = window.__playoraUnityPending || [];
        window.__playoraUnityPending.push(json);
      }
    } catch (e) {
      console.error("[playora] bridge emit failed", e);
    }
  },
});
