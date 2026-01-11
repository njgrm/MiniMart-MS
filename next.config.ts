import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow sharp to be used as an external package for image processing
  serverExternalPackages: ["sharp", "@imgly/background-removal-node"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1000mb",
      // Allow server actions from devtunnels and local network access
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "*.devtunnels.ms",
        "*.asse.devtunnels.ms",
      ],
    },
  },
  images: {
    // Disable image optimization when offline/no sharp - use unoptimized fallback
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === "true",
    // Reduce timeout for external image fetching (default is 15s, too slow when offline)
    minimumCacheTTL: 60 * 60 * 24, // Cache for 24 hours
    // Only allow local images and specific trusted domains
    remotePatterns: [
      {
        protocol: "https",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      // Local network for dev
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
    ],
    // Disable external domain image optimization by default
    // External URLs will use unoptimized prop
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128],
  },
  // Increase static generation timeout for slow connections
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
