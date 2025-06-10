/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add polyfills for node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "undici": false,
        "http": false,
        "https": false,
        "url": false,
        "util": false,
        "zlib": false,
        "stream": false,
        "crypto": false,
        "fs": false,
        "path": false,
        "os": false,
      };
    }
    return config;
  },
  transpilePackages: ['firebase', '@firebase/auth'],
};

module.exports = nextConfig; 