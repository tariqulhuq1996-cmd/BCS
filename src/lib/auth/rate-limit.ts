import "server-only";
import { prisma } from "@/lib/db";

/**
 * লগইন ও পাসওয়ার্ড-রিসেটে বারবার চেষ্টা সীমিত করা (প্রতি key-তে নির্দিষ্ট সময়ে সর্বোচ্চ n বার)।
 * হিসাব ডেটাবেসে থাকে — একাধিক সার্ভার বা পুনরায় চালু করার পরও সীমা ঠিক থাকে।
 */
export async function rateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const n = await prisma.rateHit.count({ where: { key, at: { gt: new Date(Date.now() - windowMs) } } });
  return n >= max;
}

export async function recordHit(key: string) {
  await prisma.rateHit.create({ data: { key } });
  // মাঝে মাঝে (প্রায় ২% অনুরোধে) ২৪ ঘণ্টার পুরোনো সারি পরিষ্কার
  if (Math.random() < 0.02) await prisma.rateHit.deleteMany({ where: { at: { lt: new Date(Date.now() - 864e5) } } });
}

export async function clearHits(key: string) {
  await prisma.rateHit.deleteMany({ where: { key } });
}
