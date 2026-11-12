"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashToken, newToken } from "./session";
import { clearHits, rateLimited, recordHit } from "./rate-limit";
import { sendPasswordResetLink } from "./mailer";
import { appUrl } from "@/lib/env";
import { ensureStarted } from "@/lib/progress/engine";
import { LoginSchema, RegisterSchema, ResetRequestSchema, ResetSchema, type FormState } from "./schemas";

const BCRYPT_COST = 12;
// ব্যবহারকারী না থাকলেও একই সময় লাগুক — ইমেইল আছে কি না সময় দেখে বোঝা না যায়
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_COST);

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

async function clientIp() {
  const h = await headers();
  // X-Real-IP প্রক্সি (nginx/Vercel) নিজে বসায়, তাই বিশ্বাসযোগ্য; না থাকলে X-Forwarded-For-এর শেষ ঠিকানা (প্রক্সির যোগ করা)।
  // প্রথম ঠিকানাটি ব্যবহারকারী নিজে জাল করতে পারে, তাই নেওয়া হয় না।
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}

const fieldErrors = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[]>;

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "email", "password", "confirm"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = RegisterSchema.safeParse(raw);
  const values = { name: raw.name, email: raw.email };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (await rateLimited(`reg:${ip}`, 10, 60 * 60e3)) return { message: "এই ডিভাইস থেকে অনেকবার অ্যাকাউন্ট খোলার চেষ্টা হয়েছে। এক ঘণ্টা পরে আবার চেষ্টা করুন।", values };
  await recordHit(`reg:${ip}`);

  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } }))
    return { errors: { email: ["এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন অথবা পাসওয়ার্ড রিসেট করুন।"] }, values };

  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, BCRYPT_COST), profile: { create: { name } } },
  });
  await ensureStarted(prisma, user.id); // Level 1-এর প্রথম ধাপ (১০ম BCS) খোলা
  await createSession(user.id, (await headers()).get("user-agent"));
  redirect(safeNext(fd.get("next")));
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const raw = { email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") };
  const values = { email: raw.email };
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { email, password } = parsed.data;
  const ip = await clientIp();
  const key = `login:${email}:${ip}`;
  if (await rateLimited(key, 5, 15 * 60e3) || await rateLimited(`login-ip:${ip}`, 30, 15 * 60e3))
    return { message: "অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন, অথবা পাসওয়ার্ড রিসেট করুন।", values };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.disabled) {
    await recordHit(key);
    await recordHit(`login-ip:${ip}`);
    return { message: "ইমেইল বা পাসওয়ার্ড মেলেনি।", values };
  }
  await clearHits(key);
  await createSession(user.id, (await headers()).get("user-agent"));
  redirect(safeNext(fd.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = ResetRequestSchema.safeParse({ email: String(fd.get("email") ?? "") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: String(fd.get("email") ?? "") } };
  const { email } = parsed.data;
  const ip = await clientIp();
  const sameAnswer: FormState = { ok: true, message: "এই ইমেইলে অ্যাকাউন্ট থাকলে পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে। লিংকটি এক ঘণ্টা কাজ করবে।" };
  if (await rateLimited(`reset:${email}`, 3, 60 * 60e3) || await rateLimited(`reset-ip:${ip}`, 10, 60 * 60e3)) return sameAnswer;
  await recordHit(`reset:${email}`);
  await recordHit(`reset-ip:${ip}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.disabled) {
    const token = newToken();
    await prisma.passwordResetToken.create({ data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60e3) } });
    await sendPasswordResetLink(email, `${appUrl()}/reset-password/${token}`); // Host-হেডার নয়: জাল হেডারে লিংক অন্য সাইটে যেতে পারত
  }
  return sameAnswer;
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = ResetSchema.safeParse({ token: String(fd.get("token") ?? ""), password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { token, password } = parsed.data;
  const rec = await prisma.passwordResetToken.findUnique({ where: { id: hashToken(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date())
    return { message: "লিংকটির মেয়াদ শেষ বা আগেই ব্যবহার হয়েছে। নতুন রিসেট লিংক চান।" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST) } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: rec.userId } }), // সব ডিভাইস থেকে লগআউট
  ]);
  await createSession(rec.userId, (await headers()).get("user-agent"));
  redirect("/dashboard");
}
