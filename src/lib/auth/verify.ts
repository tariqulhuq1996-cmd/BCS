import { createHash, randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * ইমেইল যাচাই — ৬ সংখ্যার কোড।
 *  - কোড ১৫ মিনিট বৈধ; ভুল দেওয়া যায় সর্বোচ্চ ৫ বার, তারপর নতুন কোড চাইতে হয়
 *  - ডেটাবেসে কোডের হ্যাশ থাকে (ব্যবহারকারীর id মিশিয়ে), কোড নিজে নয়
 *  - কোড পাঠানো: mailer.ts (sendVerificationCode); কখন যাচাই লাগে: mailer.ts (verificationRequired)
 */
export const CODE_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;

const hashCode = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

/** নতুন কোড বানানো (আগেরটি বাতিল); কোডটি ফেরত দেয়, ইমেইলে পাঠানো ডাকার দায়িত্ব। */
export async function createCode(db: PrismaClient, userId: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = { codeHash: hashCode(userId, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60e3), attempts: 0, sentAt: new Date() };
  await db.emailCode.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  return code;
}

export type CheckResult = "ok" | "wrong" | "expired" | "locked" | "none";

/** কোড মেলানো; মিললে অ্যাকাউন্ট যাচাইকৃত হয় ও কোড মুছে যায়। */
export async function checkCode(db: PrismaClient, userId: string, code: string): Promise<CheckResult> {
  const rec = await db.emailCode.findUnique({ where: { userId } });
  if (!rec) return "none";
  if (rec.attempts >= MAX_ATTEMPTS) return "locked";
  if (rec.expiresAt < new Date()) return "expired";
  if (rec.codeHash !== hashCode(userId, code)) {
    const { attempts } = await db.emailCode.update({ where: { userId }, data: { attempts: { increment: 1 } } });
    return attempts >= MAX_ATTEMPTS ? "locked" : "wrong";
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailCode.delete({ where: { userId } }),
  ]);
  return "ok";
}
