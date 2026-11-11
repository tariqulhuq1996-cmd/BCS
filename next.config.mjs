
const isDev = process.env.NODE_ENV === "development";
// https-এ চালু থাকলেই HSTS ও upgrade-insecure-requests (স্থানীয় http-পরীক্ষা যেন না ভাঙে)
const httpsSite = (process.env.APP_URL ?? "").startsWith("https://");

/**
 * Content-Security-Policy: শুধু নিজের সাইটের স্ক্রিপ্ট, স্টাইল, ছবি ও ফন্ট; অন্য কোনো সাইট থেকে কিছু লোড বা ফ্রেম নয়।
 * Partial Prerendering-এর সঙ্গে nonce চলে না, তাই Next.js-এর "Without Nonces" পদ্ধতি (inline স্ক্রিপ্ট অনুমোদিত, বাইরের নয়)।
 * ফন্ট next/font নিজের সার্ভার থেকে দেয়, তাই font-src 'self' যথেষ্ট।
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(httpsSite ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import("next").NextConfig} */
const nextConfig = {
  // স্বাভাবিক বিল্ড চলে "next start" দিয়ে (Hostinger-এর Node.js অ্যাপ এভাবেই চালায়)।
  // নিজস্ব VPS/Docker-এ স্বয়ংসম্পূর্ণ বিল্ড (.next/standalone) চাইলে: BUILD_STANDALONE=1 npm run build
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  cacheComponents: true,
  experimental: {
    // অ্যাডমিন প্যানেল থেকে প্রশ্নভান্ডারের বড় CSV/Excel ফাইল আপলোডের জন্য (১০,৪০০ প্রশ্ন ≈ ৫–১০ MB)
    serverActions: { bodySizeLimit: "25mb" },
  },
  partialPrefetching: true,
  poweredByHeader: false,
  // নিরাপত্তা-হেডার
  async headers() {
    const h = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ...(httpsSite && !isDev ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    return [{ source: "/:path*", headers: h }];
  },
  // Tailwind: postcss.config.mjs (Turbopack ও webpack দুটোই এটি পড়ে)
};

export default nextConfig;
