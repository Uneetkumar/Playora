/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Where the build output goes.
   *
   * Two Next servers sharing one directory corrupt each other's chunks: the
   * second to compile wins, and the first then fails to resolve vendor modules
   * it wrote itself. So anything running alongside the dev server sets
   * PLAYORA_DIST_DIR and gets its own.
   *
   * There is one app server, on :8000. The second one that used to run on
   * :3000 has been removed — two copies of the same app is a way to look at
   * stale code and think it is current.
   */
  distDir: process.env.PLAYORA_DIST_DIR || ".next",
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
    '@playora/animation',
    '@playora/analytics',
  ],
};

export default nextConfig;
