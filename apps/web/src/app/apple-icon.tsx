import { ImageResponse } from "next/og";
import { BrandTile } from "./_brand/brand-art";

/*
 * The home-screen icon iOS uses. Full-bleed and square: iOS rounds the
 * corners itself and fills any transparency with black, so the tile here has
 * no radius of its own.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandTile size={180} radius={0} />, size);
}
