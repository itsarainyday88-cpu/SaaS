import type { NextConfig } from "next";

const nextConfig: any = {
  // 'standalone' builds a self-contained server for Electron packaging
  output: "standalone",
  // Fix for Turbopack error when using custom webpack config:

  typescript: {

    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
