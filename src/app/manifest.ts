import type { MetadataRoute } from "next";

/** মোবাইলে "হোম স্ক্রিনে যোগ করুন" — অ্যাপের মতো আলাদা জানালায় খোলে। */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BCS ৫২ প্রস্তুতি",
    short_name: "BCS ৫২",
    description: "১০ম–৫০তম BCS-এর প্রশ্নের বিশ্লেষণ থেকে তৈরি ধাপে ধাপে প্রস্তুতি।",
    lang: "bn",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f3",
    theme_color: "#006a4e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
