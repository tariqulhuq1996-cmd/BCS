import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // অ্যাডমিন প্যানেল থেকে প্রশ্নভান্ডারের বড় CSV/Excel ফাইল আপলোডের জন্য (১০,৪০০ প্রশ্ন ≈ ৫–১০ MB)
    serverActions: { bodySizeLimit: "25mb" },
  },
  partialPrefetching: true,
  // নিরাপত্তা-হেডার: অন্য সাইটে ফ্রেমে বসানো নিষেধ, MIME-অনুমান বন্ধ, রেফারার সীমিত, ক্যামেরা/মাইক/অবস্থান বন্ধ
  async headers() {
    const h = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    return [{ source: "/:path*", headers: h }];
  },
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
