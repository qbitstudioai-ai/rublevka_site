import type { NextConfig } from "next";

const eventsOrigin = process.env.EVENTS_ORIGINAL_ORIGIN ?? "http://127.0.0.1:3271";

const nextConfig: NextConfig = {
  distDir: process.env.EVENTS_MOUNT_LOCAL === "1" ? ".next/mounted" : ".next",
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/meropriyatiya/:path*", destination: eventsOrigin + "/meropriyatiya/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [{ source: "/admin/meropriyatiya", destination: "/meropriyatiya/admin", permanent: false }];
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
