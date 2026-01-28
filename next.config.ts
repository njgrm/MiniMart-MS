import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker optimization
  output: "standalone",
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
    // Allow local and trusted external domains for product images
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
      // Product image sources from CSV
      {
        protocol: "https",
        hostname: "marilenminimart.com",
      },
      {
        protocol: "https",
        hostname: "imartgrocersph.com",
      },
      {
        protocol: "https",
        hostname: "shopmetro.ph",
      },
      {
        protocol: "https",
        hostname: "shopsuki.ph",
      },
      {
        protocol: "https",
        hostname: "zbga.shopsuki.ph",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
      {
        protocol: "https",
        hostname: "store.iloilosupermart.com",
      },
      {
        protocol: "https",
        hostname: "www.watsons.com.ph",
      },
      {
        protocol: "https",
        hostname: "admin.merrymartwholesale.com",
      },
      {
        protocol: "https",
        hostname: "ddmmw-assets.s3.ap-southeast-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "sigemart.com",
      },
      {
        protocol: "https",
        hostname: "boholonlinestore.com",
      },
      {
        protocol: "https",
        hostname: "media.pickaroo.com",
      },
      {
        protocol: "https",
        hostname: "www.srssulit.com",
      },
      {
        protocol: "https",
        hostname: "d2j6dbq0eux0bg.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "scontent.filo3-1.fna.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "ph-test-11.slatic.net",
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
