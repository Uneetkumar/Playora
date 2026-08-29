/** @type {import('next').NextConfig} */
const nextConfig = {
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
  ],
};

export default nextConfig;
