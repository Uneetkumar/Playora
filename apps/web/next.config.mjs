/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@playden/ui',
    '@playden/auth',
    '@playden/database',
    '@playden/game-types',
    '@playden/protocol',
    '@playden/game-engine'
  ]
};

export default nextConfig;
