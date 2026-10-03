import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REDUCE_MOTION_CLASS } from "@playora/animation";
// By path, as tailwind.config.ts does: the @playora/ui entry pulls in every
// component, and this only needs the dependency-free tokens.
import { motion } from "../../../../../packages/ui/src/tokens";

/**
 * The in-app "Reduce motion" class is named in four places that cannot share
 * an import: @playora/animation (which Settings writes through), @playora/ui's
 * tokens (which the carousel reads), and the class selectors in globals.css
 * and button.tsx, which Tailwind needs as literal text. Neither package may
 * depend on the other, so this is what keeps them one name.
 */
describe("reduce-motion class", () => {
  it("is the same in @playora/animation and @playora/ui", () => {
    expect(motion.reduceMotionClass).toBe(REDUCE_MOTION_CLASS);
  });

  it("is the class globals.css and the shared Button select on", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    expect(css).toContain(`.${REDUCE_MOTION_CLASS} *`);
    const button = readFileSync(
      join(process.cwd(), "..", "..", "packages", "ui", "src", "components", "button.tsx"),
      "utf8",
    );
    expect(button).toContain(`[.${REDUCE_MOTION_CLASS}_&]`);
  });
});
