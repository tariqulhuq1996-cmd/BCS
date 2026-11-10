import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

/** সার্চ ইঞ্জিন: জনসাধারণের গবেষণা-পাতা দেখুক; শিক্ষার্থী ও অ্যাডমিন অংশ নয়। */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/research", "/repeated-questions"], disallow: ["/admin", "/dashboard", "/level-1", "/level-2", "/level-3", "/test", "/result", "/revision", "/mistakes", "/profile", "/readiness-report", "/reset-password", "/api"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
