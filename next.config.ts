import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // অ্যাডমিন প্যানেল থেকে প্রশ্নভান্ডারের বড় CSV/Excel ফাইল আপলোডের জন্য (১০,৪০০ প্রশ্ন ≈ ৫–১০ MB)
    serverActions: { bodySizeLimit: "25mb" },
  },
  partialPrefetching: true,
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
