import type { NextConfig } from "next";

const nextConfig: any = {
  // 'standalone' builds a self-contained server for Electron packaging
  output: "standalone",
  // Fix for Turbopack error when using custom webpack config:

  typescript: {

    ignoreBuildErrors: true,
  },
};

export default nextConfig;
