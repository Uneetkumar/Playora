/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Where the build output goes.
   *
   * Two Next servers sharing one directory corrupt each other's chunks: the
   * second to compile wins, and the first then fails to resolve vendor modules
   * it wrote itself. So every server that runs alongside another gets its own.
   *
   * PLAYORA_STABLE is the "play" server, built once and served while the dev
   * server keeps recompiling. PLAYORA_DIST_DIR is for anything else — a second
   * dev server for visual checks, for instance.
   */
  distDir: process.env.PLAYORA_STABLE
    ? ".next-stable"
    : process.env.PLAYORA_DIST_DIR || ".next",
  reactStrictMode: true,
  // Every workspace package the app imports. Missing one means its changes are
  // silently not picked up in dev.
  transpilePackages: [
    '@playora/ui',
    '@playora/auth',
    '@playora/database',
    '@playora/game-types',
    '@playora/protocol',
    '@playora/game-engine',
    '@playora/progression',
    '@playora/bot-engine',
    '@playora/audio',
  ],
};

export default nextConfig;
