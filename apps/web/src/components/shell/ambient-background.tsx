/**
 * A faint wash of brand violet behind the top of every platform page.
 *
 * This replaces AnimatedBackground: three viewport-sized orbs blurred by
 * 120–140px, each pulsing forever, under a perspective grid. It looked like a
 * landing page rather than a library, it competed with the cover art that is
 * the actual content, and three huge blur filters repainting on every frame
 * are exactly what a low-end phone cannot afford. Steam, Epic and the Xbox
 * app all sit their art on flat surfaces for the same reasons.
 *
 * What is left is one static radial gradient from the primary token: depth
 * under the header in either theme, no animation (so nothing for reduced
 * motion to stop), no filter, nothing to repaint. Game routes do not render
 * it; the game owns the screen there.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_70%_60%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]"
    />
  );
}
