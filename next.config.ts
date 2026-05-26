import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "playwright",
    "sharp",
    // Remotion + its deps are Node-only — never bundle through Turbopack/webpack
    "remotion",
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
    "@esbuild/darwin-arm64",
    "@esbuild/linux-x64",
    "@esbuild/linux-arm64",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
};

export default nextConfig;
