import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "../lib/seo";
import { BRAND, GemSvg } from "./_brand/brand-art";

/*
 * The default share card, for every page that does not bring its own (game
 * pages do, with their cover art). The wordmark, the tagline and a line about
 * what the site is, on the dark theme's colours, in next/og's built-in font so
 * rendering it needs no network.
 */

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        backgroundColor: BRAND.page,
        backgroundImage: `radial-gradient(circle at 85% 15%, ${BRAND.tileTo}66, transparent 55%), radial-gradient(circle at 10% 110%, ${BRAND.secondary}33, transparent 50%)`,
        color: BRAND.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundImage: `linear-gradient(135deg, ${BRAND.tileFrom}, ${BRAND.tileTo})`,
          }}
        >
          <GemSvg size={80} />
        </div>
        {/* next/og's built-in face has one weight; a stroke in the text colour stands in for bold. */}
        <div style={{ fontSize: 96, letterSpacing: -2, WebkitTextStroke: `3px ${BRAND.text}` }}>
          {SITE_NAME}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 72,
            letterSpacing: -1,
            color: BRAND.text,
            WebkitTextStroke: `2px ${BRAND.text}`,
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div style={{ fontSize: 34, color: BRAND.muted }}>
          Chess, UNO, racing and more, free in your browser.
        </div>
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {["No download", "Play with friends", "Same Wi-Fi", "Ranked per game"].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              fontSize: 26,
              padding: "10px 22px",
              borderRadius: 999,
              border: `2px solid ${BRAND.border}`,
              backgroundColor: BRAND.card,
              color: BRAND.accent,
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    size
  );
}
