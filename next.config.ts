import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow sharp to be used as an external package for image processing
  serverExternalPackages: ["sharp", "@imgly/background-removal-node"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
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
