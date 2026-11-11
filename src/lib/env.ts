/**
 * প্রোডাকশনের পরিবেশ-চলক (environment variables) যাচাই। সার্ভার চালুর সময় instrumentation.ts থেকে ডাকা হয়।
 * বাধ্যতামূলক কিছু না থাকলে সার্ভার চালুই হয় না — ভুল কনফিগারেশন নিয়ে চুপচাপ চলার চেয়ে এটি নিরাপদ।
 */
export type EnvReport = { errors: string[]; warnings: string[] };

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function checkEnv(env = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = env.NODE_ENV === "production";

  if (!env.DATABASE_URL) errors.push("DATABASE_URL নেই (PostgreSQL-এর সংযোগ-ঠিকানা)।");
  else if (prod && /bcs_local_dev|127.0.0.1:3307|localhost:3307/.test(env.DATABASE_URL) && env.ALLOW_LOCAL_DB !== "1")
    errors.push("প্রোডাকশনে স্থানীয় ডেভেলপমেন্ট ডেটাবেস ব্যবহার হচ্ছে। আসল ডেটাবেসের DATABASE_URL দিন (বা পরীক্ষার জন্য ALLOW_LOCAL_DB=1)।");

  if (prod) {
    if (!env.APP_URL) errors.push("APP_URL নেই (যেমন https://bcs52.example.com) — ইমেইলের লিংক ও sitemap-এর জন্য লাগে।");
    else if (!/^https:\/\//.test(env.APP_URL) && env.ALLOW_LOCAL_DB !== "1") warnings.push("APP_URL https দিয়ে শুরু হয়নি।");
    const smtp = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"].filter((k) => !env[k]);
    if (smtp.length) warnings.push(`ইমেইল-সেবা সম্পূর্ণ কনফিগার করা নেই (${smtp.join(", ")}) — পাসওয়ার্ড-রিসেটের ইমেইল যাবে না।`);
  }
  return { errors, warnings };
}
