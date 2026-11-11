/**
 * প্রোডাকশনের পরিবেশ-চলক (environment variables) যাচাই। সার্ভার চালুর সময় instrumentation.ts থেকে ডাকা হয়।
 * বাধ্যতামূলক কিছু না থাকলে সার্ভার চালুই হয় না — ভুল কনফিগারেশন নিয়ে চুপচাপ চলার চেয়ে এটি নিরাপদ।
 */
export type EnvReport = { errors: string[]; warnings: string[] };

/**
 * APP_URL স্বাভাবিক করা: শুধু ডোমেইন দিলে (যেমন "bcs52.com") https:// যোগ হয়; উদ্ধৃতিচিহ্ন ও শেষের / বাদ; অবৈধ হলে undefined।
 * Hostinger-এ প্রায়ই ডোমেইন protocol ছাড়া লেখা হয় — তাতে যেন বিল্ড বা সাইট না ভাঙে।
 */
export function normalizeAppUrl(raw: string | undefined): string | undefined {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!v) return undefined;
  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes(".") && u.hostname !== "localhost")) return undefined;
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export function appUrl(): string {
  return normalizeAppUrl(process.env.APP_URL) ?? "http://localhost:3000";
}

export function checkEnv(env = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = env.NODE_ENV === "production";

  if (!env.DATABASE_URL) errors.push("DATABASE_URL নেই (MariaDB/MySQL-এর সংযোগ-ঠিকানা)।");
  else if (prod && /bcs_local_dev|127.0.0.1:3307|localhost:3307/.test(env.DATABASE_URL) && env.ALLOW_LOCAL_DB !== "1")
    errors.push("প্রোডাকশনে স্থানীয় ডেভেলপমেন্ট ডেটাবেস ব্যবহার হচ্ছে। আসল ডেটাবেসের DATABASE_URL দিন (বা পরীক্ষার জন্য ALLOW_LOCAL_DB=1)।");

  if (prod) {
    const url = normalizeAppUrl(env.APP_URL);
    if (!env.APP_URL) errors.push("APP_URL নেই (যেমন https://bcs52.example.com) — ইমেইলের লিংক ও sitemap-এর জন্য লাগে।");
    else if (!url) errors.push(`APP_URL সঠিক ঠিকানা নয়: "${env.APP_URL}" (যেমন https://bcs52.example.com)।`);
    else {
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(env.APP_URL.trim())) warnings.push(`APP_URL-এ https:// নেই — "${url}" ধরে নেওয়া হলো। Hostinger-এ https:// সহ লিখে দেওয়া ভালো।`);
      if (!url.startsWith("https://") && env.ALLOW_LOCAL_DB !== "1") warnings.push("APP_URL https দিয়ে শুরু হয়নি।");
    }
    const smtp = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"].filter((k) => !env[k]);
    if (smtp.length) warnings.push(`ইমেইল-সেবা সম্পূর্ণ কনফিগার করা নেই (${smtp.join(", ")}) — পাসওয়ার্ড-রিসেটের ইমেইল যাবে না।`);
  }
  return { errors, warnings };
}
