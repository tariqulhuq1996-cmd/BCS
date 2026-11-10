"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashToken, newToken } from "./session";
import { clearHits, rateLimited, recordHit } from "./rate-limit";
import { sendPasswordResetLink } from "./mailer";
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
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const fieldErrors = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[]>;

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "email", "password", "confirm"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = RegisterSchema.safeParse(raw);
  const values = { name: raw.name, email: raw.email };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (rateLimited(`reg:${ip}`, 10, 60 * 60e3)) return { message: "এই ডিভাইস থেকে অনেকবার অ্যাকাউন্ট খোলার চেষ্টা হয়েছে। এক ঘণ্টা পরে আবার চেষ্টা করুন।", values };
  recordHit(`reg:${ip}`);

  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } }))
    return { errors: { email: ["এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন অথবা পাসওয়ার্ড রিসেট করুন।"] }, values };

  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, BCRYPT_COST), profile: { create: { name } } },
  });
  await ensureStarted(prisma, user.id); // Level 1-এর প্রথম ধাপ (১০ম বিসিএস) খোলা
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
  if (rateLimited(key, 5, 15 * 60e3) || rateLimited(`login-ip:${ip}`, 30, 15 * 60e3))
    return { message: "অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন, অথবা পাসওয়ার্ড রিসেট করুন।", values };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.disabled) {
    recordHit(key);
    recordHit(`login-ip:${ip}`);
    return { message: "ইমেইল বা পাসওয়ার্ড মেলেনি।", values };
  }
  clearHits(key);
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
  if (rateLimited(`reset:${email}`, 3, 60 * 60e3) || rateLimited(`reset-ip:${ip}`, 10, 60 * 60e3)) return sameAnswer;
  recordHit(`reset:${email}`);
  recordHit(`reset-ip:${ip}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.disabled) {
    const token = newToken();
    await prisma.passwordResetToken.create({ data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60e3) } });
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    await sendPasswordResetLink(email, `${origin}/reset-password/${token}`);
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
