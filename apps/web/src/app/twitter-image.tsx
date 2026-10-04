/*
 * X/Twitter reads its own image tag; the card is the Open Graph one. The
 * config is restated rather than re-exported because Next reads these
 * exports statically.
 */
import OpenGraphImage from "./opengraph-image";
import { SITE_NAME, SITE_TAGLINE } from "../lib/seo";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OpenGraphImage;
