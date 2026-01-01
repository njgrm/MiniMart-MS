import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow sharp to be used as an external package for image processing
  serverExternalPackages: ["sharp", "@imgly/background-removal-node"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
