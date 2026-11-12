import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * সার্ভার-সাইড সেশন।
 * কুকিতে থাকে শুধু ২৫৬-বিটের র‍্যান্ডম টোকেন (HttpOnly, SameSite=Lax, প্রোডাকশনে Secure);
 * ডেটাবেসে থাকে তার SHA-256 হ্যাশ — ডেটাবেস ফাঁস হলেও সক্রিয় সেশন চুরি করা যায় না।
 */
export const SESSION_COOKIE = "bcs_session";
const SESSION_DAYS = 30;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function createSession(userId: string, userAgent?: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; name: string; email: string; role: "STUDENT" | "ADMIN" };

/** সেশনের ব্যবহারকারী (ইমেইল যাচাই হোক বা না হোক)। একই রিকোয়েস্টে একবারই ডেটাবেসে যায়। */
const sessionUser = cache(async (): Promise<(CurrentUser & { verified: boolean }) | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { profile: true } } },
  });
  if (!s || s.expiresAt < new Date() || s.user.disabled) return null;
  return { id: s.user.id, name: s.user.profile?.name ?? s.user.email, email: s.user.email, role: s.user.role, verified: !!s.user.emailVerifiedAt || s.user.role === "ADMIN" };
});

/**
 * বর্তমান ব্যবহারকারী, না থাকলে null। ইমেইল যাচাই না হওয়া অ্যাকাউন্টও null —
 * তাই কোনো পাতা বা Server Action যাচাইয়ের আগে শিক্ষার্থীর কাজ করতে দেয় না।
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const u = await sessionUser();
  if (!u || !u.verified) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
});

/** লগইন আছে কিন্তু ইমেইল যাচাই বাকি — যাচাই-পাতার জন্য। */
export async function getPendingUser(): Promise<CurrentUser | null> {
  const u = await sessionUser();
  return u && !u.verified ? { id: u.id, name: u.name, email: u.email, role: u.role } : null;
}

/** অ্যাডমিন-পাতা ও অ্যাডমিন-কাজের জন্য: লগইন না থাকলে লগইনে, অ্যাডমিন না হলে ৪০৪ (অ্যাডমিন অংশের অস্তিত্বও প্রকাশ নয়)। */
export async function requireAdmin(next = "/admin"): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (u.role !== "ADMIN") notFound();
  return u;
}

/** লগইন বাধ্যতামূলক এমন পাতার জন্য। */
export async function requireUser(next = "/dashboard"): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u && (await getPendingUser())) redirect(`/verify-email?next=${encodeURIComponent(next)}`);
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/**
 * অপেক্ষমাণ নিবন্ধনের কুকি — ফর্ম জমা দেওয়া ব্রাউজারকে চেনায় (অ্যাকাউন্ট তখনো খোলা হয়নি, তাই সেশন নয়)।
 * কুকিতে র‍্যান্ডম টোকেন, ডেটাবেসে তার হ্যাশ (PendingSignup.id)।
 */
export const SIGNUP_COOKIE = "bcs_signup";

export async function setSignupCookie(token: string) {
  (await cookies()).set(SIGNUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 3600,
  });
}

export async function clearSignupCookie() {
  (await cookies()).delete(SIGNUP_COOKIE);
}

export type PendingSignupInfo = { id: string; email: string; name: string; sentAt: Date };

/** এই ব্রাউজারের অপেক্ষমাণ নিবন্ধন (২৪ ঘণ্টার মধ্যে), না থাকলে null। */
export const getPendingSignup = cache(async (): Promise<PendingSignupInfo | null> => {
  const token = (await cookies()).get(SIGNUP_COOKIE)?.value;
  if (!token) return null;
  const p = await prisma.pendingSignup.findUnique({ where: { id: hashToken(token) }, select: { id: true, email: true, name: true, sentAt: true, createdAt: true } });
  if (!p || p.createdAt.getTime() < Date.now() - 24 * 3600e3) return null;
  return { id: p.id, email: p.email, name: p.name, sentAt: p.sentAt };
});
