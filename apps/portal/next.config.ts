import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: rootDir,
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["@realestategear/ui", "@realestategear/tokens"],
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  /**
   * Same-origin /api → Express so the browser never cross-origin fetches the API (CORS).
   * Uses `fallback` (not the default `afterFiles`) so this only catches requests that no
   * real Next.js route handled — a plain array here would run before dynamic/catch-all
   * routes (e.g. app/api/proxy/[[...path]]) get a chance, silently hijacking them.
   */
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const base = backend.replace(/\/$/, "");
    return {
      fallback: [{ source: "/api/:path*", destination: `${base}/api/:path*` }],
    };
  },
};

export default nextConfig;
