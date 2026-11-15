import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

/**
 * In development, Next.js only answers requests from localhost unless other hostnames are listed.
 * To test on a phone we take them from the same WEB_ORIGIN line in the project's .env file that the
 * game server uses, so the address only has to be written in one place. Only the hostname is kept
 * (no http:// and no port), as Next.js expects.
 */
function devHostnamesFromEnv(): string[] {
  const names = new Set<string>();
  try {
    let value = process.env.WEB_ORIGIN ?? "";
    const envFile = resolve(process.cwd(), "../.env");
    if (!value && existsSync(envFile)) {
      const match = /^WEB_ORIGIN=(.*)$/m.exec(readFileSync(envFile, "utf8"));
      value = (match?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
    }
    for (const origin of value.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) names.add(new URL(trimmed).hostname);
    }
  } catch {
    /* an unreadable .env just means no extra hostnames are allowed */
  }
  names.delete("localhost");
  return [...names];
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: devHostnamesFromEnv(),
  // The shared package ships TypeScript source files, so Next.js must compile it.
  transpilePackages: ["@chaos/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
