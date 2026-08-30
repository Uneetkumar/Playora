using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Playora.Core
{
    /// <summary>
    /// The only place Unity and the Playora platform talk to each other.
    /// </summary>
    /// <remarks>
    /// Spec v2 section 44 splits ownership: Unity owns the 3D world, its
    /// physics, camera, effects and in-race HUD; the platform owns navigation,
    /// the lobby, social, settings, results and progression. Every message
    /// across that line goes through here, and the shapes mirror
    /// packages/protocol/src/unity-bridge.ts exactly.
    ///
    /// This GameObject must be named "PlayoraBridge" in the scene, because the
    /// platform addresses it by name through SendMessage.
    /// </remarks>
    public class PlayoraBridge : MonoBehaviour
    {
        public static PlayoraBridge Instance { get; private set; }

        [DllImport("__Internal")]
        private static extern void PlayoraEmit(string json);

        /// <summary>Raised on the main thread when the platform sends a command.</summary>
        public event Action<UnityCommand> CommandReceived;

        private readonly Queue<UnityCommand> _pending = new Queue<UnityCommand>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            Emit(new UnityEventPayload
            {
                type = "READY",
                buildVersion = Application.version
            });
        }

        private void Update()
        {
            // Commands arrive from SendMessage, which Unity already delivers on
            // the main thread — but draining through a queue keeps the handler
            // out of the middle of whatever the caller was doing.
            while (_pending.Count > 0)
            {
                var command = _pending.Dequeue();
                try
                {
                    CommandReceived?.Invoke(command);
                }
                catch (Exception e)
                {
                    Debug.LogError($"[playora] command handler failed: {e}");
                    EmitError("COMMAND_FAILED", "Something went wrong starting the race.");
                }
            }
        }

        /// <summary>Called by the platform via SendMessage. Do not rename.</summary>
        public void ReceiveCommand(string json)
        {
            try
            {
                var command = JsonUtility.FromJson<UnityCommand>(json);
                if (command == null || string.IsNullOrEmpty(command.type))
                {
                    Debug.LogWarning($"[playora] ignoring malformed command: {json}");
                    return;
                }

                _pending.Enqueue(command);
            }
            catch (Exception e)
            {
                Debug.LogError($"[playora] could not parse command: {e}");
            }
        }

        public void Emit(UnityEventPayload payload)
        {
            var json = JsonUtility.ToJson(payload);
#if UNITY_WEBGL && !UNITY_EDITOR
            PlayoraEmit(json);
#else
            // In the Editor there is no browser to talk to, so events are
            // logged instead. This is what makes the scene runnable without a
            // WebGL build during development.
            Debug.Log($"[playora] -> {json}");
#endif
        }

        public void EmitError(string code, string message)
        {
            Emit(new UnityEventPayload { type = "ERROR", code = code, message = message });
        }

        public void EmitProgress(float progress, string label)
        {
            Emit(new UnityEventPayload
            {
                type = "LOAD_PROGRESS",
                progress = Mathf.Clamp01(progress),
                label = label
            });
        }
    }
}
