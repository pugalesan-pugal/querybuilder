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
  // Enable SWC minification
  swcMinify: true,
  // Ensure CSS modules work correctly
  images: {
    domains: ['localhost']
  },
  // Optimize CSS handling
  optimizeFonts: true,
  experimental: {
    optimizeCss: true,
    // Prevent CSS hot reload issues
    webpackBuildWorker: false
  }
};

module.exports = nextConfig; 