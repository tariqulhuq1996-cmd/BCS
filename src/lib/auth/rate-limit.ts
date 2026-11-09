import "server-only";

/**
 * লগইন ও পাসওয়ার্ড-রিসেটে বারবার চেষ্টা সীমিত করা (প্রতি key-তে নির্দিষ্ট সময়ে সর্বোচ্চ n বার)।
 * এটি একটি সার্ভার-প্রসেসের মেমোরিতে থাকে। একাধিক সার্ভারে Deploy করলে (Phase 10)
 * ডেটাবেস বা Redis-ভিত্তিক সংস্করণে বদলাতে হবে।
 */
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, arr);
  return arr.length >= max;
}

export function recordHit(key: string) {
  const arr = hits.get(key) ?? [];
  arr.push(Date.now());
  hits.set(key, arr);
  if (hits.size > 50_000) hits.clear(); // মেমোরি-সুরক্ষা
}

export function clearHits(key: string) {
  hits.delete(key);
}
