/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A separate build output so a stable "play" server can be built and served
  // without my dev server (or a `pnpm build`) clobbering it mid-session.
  ...(process.env.PLAYORA_STABLE ? { distDir: '.next-stable' } : {}),
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
