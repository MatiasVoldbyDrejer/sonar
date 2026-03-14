import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    // Ignore SQLite database files so writes don't trigger dev recompilation
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /sonar\.db/,
    };
    return config;
  },
  turbopack: {},
};

export default nextConfig;
