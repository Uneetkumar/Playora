using UnityEngine;
using UnityEngine.Rendering;

namespace Playora.Optimization
{
    /// <summary>
    /// The three quality tiers from spec v2 section 100.
    /// </summary>
    /// <remarks>
    /// HIGH is deliberately not the default. WebGL runs on whatever the browser
    /// is given — Chromebooks, integrated graphics, phones — and a build that
    /// assumes a desktop GPU simply does not run for a large share of players.
    /// The opening tier is chosen from what the device reports, and the player
    /// can override it.
    /// </remarks>
    public static class QualityTiers
    {
        public enum Tier
        {
            Low,
            Medium,
            High
        }

        public static Tier Parse(string value)
        {
            switch ((value ?? string.Empty).ToLowerInvariant())
            {
                case "high": return Tier.High;
                case "medium": return Tier.Medium;
                case "low": return Tier.Low;
                default: return Detect();
            }
        }

        /// <summary>
        /// A defensible opening guess from what the browser reports.
        /// </summary>
        /// <remarks>
        /// Graphics memory and core count are crude, and they are what WebGL
        /// exposes. Better to start conservative and let a capable machine be
        /// turned up than to open at HIGH and stutter on the first race.
        /// </remarks>
        public static Tier Detect()
        {
            if (SystemInfo.graphicsMemorySize >= 2048 && SystemInfo.processorCount >= 8)
            {
                return Tier.High;
            }

            if (SystemInfo.graphicsMemorySize >= 1024 && SystemInfo.processorCount >= 4)
            {
                return Tier.Medium;
            }

            return Tier.Low;
        }

        public static void Apply(Tier tier)
        {
            switch (tier)
            {
                case Tier.Low:
                    QualitySettings.SetQualityLevel(0, true);
                    QualitySettings.shadows = ShadowQuality.Disable;
                    QualitySettings.antiAliasing = 0;
                    QualitySettings.lodBias = 0.6f;
                    QualitySettings.globalTextureMipmapLimit = 1;
                    // Half resolution on a low tier buys more than any single
                    // effect being switched off.
                    Screen.SetResolution(Screen.width / 2, Screen.height / 2, false);
                    Application.targetFrameRate = 60;
                    break;

                case Tier.Medium:
                    QualitySettings.SetQualityLevel(2, true);
                    QualitySettings.shadows = ShadowQuality.HardOnly;
                    QualitySettings.antiAliasing = 2;
                    QualitySettings.lodBias = 1.0f;
                    QualitySettings.globalTextureMipmapLimit = 0;
                    Application.targetFrameRate = 60;
                    break;

                case Tier.High:
                    QualitySettings.SetQualityLevel(4, true);
                    QualitySettings.shadows = ShadowQuality.All;
                    QualitySettings.antiAliasing = 4;
                    QualitySettings.lodBias = 1.6f;
                    QualitySettings.globalTextureMipmapLimit = 0;
                    Application.targetFrameRate = 60;
                    break;
            }
        }
    }
}
