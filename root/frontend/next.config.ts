import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep tracing + Turbopack roots aligned (Vercel warns/fails when they differ).
  outputFileTracingRoot: configDir,
  turbopack: {
    root: configDir,
  },
};

export default nextConfig;
