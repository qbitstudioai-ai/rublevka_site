import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  basePath: "/meropriyatiya",
  // Минимальная сборка для Docker: .next/standalone/server.js с нужными node_modules.
  output: "standalone",
  experimental: {
    serverActions: {
      // Загрузка фотографий в админпанели: до 10 МБ на файл, до ~28 МБ за одно сохранение.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
