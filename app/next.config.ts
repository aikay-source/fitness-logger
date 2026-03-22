import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Turbopack is the default in Next 16 — declare it so the Serwist webpack
  // plugin only runs during `next build`, not during `next dev`.
  turbopack: {},
};

export default withSerwist(nextConfig);
