import { createHash, randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * ইমেইল যাচাই — ৬ সংখ্যার কোড।
 *  - কোড ১৫ মিনিট বৈধ; ভুল দেওয়া যায় সর্বোচ্চ ৫ বার, তারপর নতুন কোড চাইতে হয়
 *  - ডেটাবেসে কোডের হ্যাশ থাকে (ব্যবহারকারীর id মিশিয়ে), কোড নিজে নয়
 *  - নতুন নিবন্ধনে কোড মেলার আগে User তৈরি হয় না (PendingSignup; নিচে startSignup/completeSignup)
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

// ─────────────────────────────────────────── নিবন্ধন: কোড মিললে তবেই অ্যাকাউন্ট

/** অপেক্ষমাণ নিবন্ধন কতক্ষণ থাকে (এর মধ্যে নতুন কোড চাওয়া যায়)। */
export const SIGNUP_HOURS = 24;

const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const signupHash = (id: string, code: string) => hashCode(`signup:${id}`, code);
const codeFields = (id: string, code: string) => ({ codeHash: signupHash(id, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60e3), attempts: 0, sentAt: new Date() });

/**
 * নিবন্ধন শুরু: তথ্য অপেক্ষমাণ রাখা (User নয়) ও কোড বানানো। id = ব্রাউজার-কুকির টোকেনের হ্যাশ।
 * একই ইমেইলের আগের অপেক্ষমাণ নিবন্ধন বাতিল হয়; ২৪ ঘণ্টার পুরোনোগুলোও মুছে যায়।
 */
export async function startSignup(db: PrismaClient, id: string, d: { email: string; name: string; passwordHash: string }): Promise<string> {
  const code = newCode();
  await db.$transaction([
    db.pendingSignup.deleteMany({ where: { OR: [{ email: d.email }, { createdAt: { lt: new Date(Date.now() - SIGNUP_HOURS * 3600e3) } }] } }),
    db.pendingSignup.create({ data: { id, ...d, ...codeFields(id, code) } }),
  ]);
  return code;
}

/** অপেক্ষমাণ নিবন্ধনে নতুন কোড (আগেরটি অচল)। */
export async function newSignupCode(db: PrismaClient, id: string): Promise<string> {
  const code = newCode();
  await db.pendingSignup.update({ where: { id }, data: codeFields(id, code) });
  return code;
}

export type SignupResult = { result: CheckResult | "taken"; userId?: string };

/**
 * কোড মেলানো; মিললে এখনই User (যাচাইকৃত, নামসহ) তৈরি হয় এবং অপেক্ষমাণ নিবন্ধন মুছে যায়।
 * এর মধ্যে ঐ ইমেইলে যাচাইকৃত অ্যাকাউন্ট খোলা হয়ে গেলে: "taken"। পুরোনো যাচাই-বাকি অ্যাকাউন্ট থাকলে সেটি সরিয়ে নতুনটি বসে।
 */
export async function completeSignup(db: PrismaClient, id: string, code: string): Promise<SignupResult> {
  const rec = await db.pendingSignup.findUnique({ where: { id } });
  if (!rec || rec.createdAt.getTime() < Date.now() - SIGNUP_HOURS * 3600e3) return { result: "none" };
  if (rec.attempts >= MAX_ATTEMPTS) return { result: "locked" };
  if (rec.expiresAt < new Date()) return { result: "expired" };
  if (rec.codeHash !== signupHash(id, code)) {
    const { attempts } = await db.pendingSignup.update({ where: { id }, data: { attempts: { increment: 1 } } });
    return { result: attempts >= MAX_ATTEMPTS ? "locked" : "wrong" };
  }
  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: rec.email }, select: { id: true, emailVerifiedAt: true, role: true } });
    if (existing && (existing.emailVerifiedAt || existing.role === "ADMIN")) {
      await tx.pendingSignup.delete({ where: { id } });
      return { result: "taken" as const };
    }
    if (existing) await tx.user.delete({ where: { id: existing.id } });
    const user = await tx.user.create({
      data: { email: rec.email, passwordHash: rec.passwordHash, emailVerifiedAt: new Date(), profile: { create: { name: rec.name } } },
    });
    await tx.pendingSignup.delete({ where: { id } });
    return { result: "ok" as const, userId: user.id };
  });
}
