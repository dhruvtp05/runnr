import type { NextConfig } from "next";
import path from "path";

const tailwindPath = path.dirname(require.resolve("tailwindcss/package.json"));
// Turbopack resolves from project root - use cwd (frontend when running npm run dev from here)
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: tailwindPath,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: tailwindPath,
    };
    return config;
  },
};

export default nextConfig;
