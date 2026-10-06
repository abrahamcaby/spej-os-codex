import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build a second local preview without disturbing a running default build.
  distDir: process.env.SPEJ_PREVIEW_BUILD === "1" ? ".next-preview" : ".next",
};

export default nextConfig;
