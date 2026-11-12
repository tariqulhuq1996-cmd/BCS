"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getPendingUser, hashToken, newToken } from "./session";
import { checkCode, createCode, RESEND_SECONDS } from "./verify";
import { clearHits, rateLimited, recordHit } from "./rate-limit";
import { sendPasswordResetLink, sendVerificationCode, verificationRequired } from "./mailer";
import { appUrl } from "@/lib/env";
import { ensureStarted } from "@/lib/progress/engine";
import { CodeSchema, LoginSchema, RegisterSchema, ResetRequestSchema, ResetSchema, type FormState } from "./schemas";

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

  const verify = verificationRequired();
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, BCRYPT_COST), emailVerifiedAt: verify ? null : new Date(), profile: { create: { name } } },
  });
  await ensureStarted(prisma, user.id); // যাত্রার প্রথম ধাপ খোলা
  await createSession(user.id, (await headers()).get("user-agent"));
  const next = safeNext(fd.get("next"));
  if (!verify) redirect(next);
  await sendVerificationCode(email, await createCode(prisma, user.id));
  redirect(`/verify-email?next=${encodeURIComponent(next)}`);
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
  const next = safeNext(fd.get("next"));
  if (!user.emailVerifiedAt && user.role !== "ADMIN") redirect(`/verify-email?next=${encodeURIComponent(next)}`);
  redirect(next);
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
    // রিসেট লিংক ইমেইলে গিয়েছিল — তাই ইমেইলও যাচাইকৃত ধরা হয়
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), emailVerifiedAt: (await prisma.user.findUnique({ where: { id: rec.userId }, select: { emailVerifiedAt: true } }))?.emailVerifiedAt ?? new Date() } }),
    prisma.emailCode.deleteMany({ where: { userId: rec.userId } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: rec.userId } }), // সব ডিভাইস থেকে লগআউট
  ]);
  await createSession(rec.userId, (await headers()).get("user-agent"));
  redirect("/dashboard");
}

export async function verifyEmail(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getPendingUser();
  const next = safeNext(fd.get("next"));
  if (!user) redirect(next); // আগেই যাচাই হয়ে গেছে বা লগইন নেই — সুরক্ষিত পাতা নিজেই লগইনে পাঠাবে
  const parsed = CodeSchema.safeParse({ code: String(fd.get("code") ?? "") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const res = await checkCode(prisma, user.id, parsed.data.code);
  if (res === "ok") {
    revalidatePath("/", "layout"); // হেডারের "ইমেইল যাচাই" বোতাম সঙ্গে সঙ্গে Dashboard-এ বদলায়
    redirect(next);
  }
  const msg = {
    wrong: "কোডটি মেলেনি। ইমেইলে পাঠানো ৬ সংখ্যার কোডটি আবার দেখে লিখুন।",
    expired: "কোডটির মেয়াদ শেষ। নিচের বোতাম থেকে নতুন কোড চান।",
    locked: "অনেকবার ভুল কোড দেওয়া হয়েছে। নিচের বোতাম থেকে নতুন কোড চান।",
    none: "কোনো সক্রিয় কোড নেই। নিচের বোতাম থেকে নতুন কোড চান।",
  }[res];
  return res === "wrong" ? { errors: { code: [msg] } } : { message: msg };
}

export async function resendCode(_: FormState): Promise<FormState> {
  const user = await getPendingUser();
  if (!user) redirect("/dashboard");
  const last = await prisma.emailCode.findUnique({ where: { userId: user.id }, select: { sentAt: true } });
  const wait = last ? Math.ceil(RESEND_SECONDS - (Date.now() - last.sentAt.getTime()) / 1000) : 0;
  if (wait > 0) return { message: `নতুন কোড চাইতে আরও ${wait} সেকেন্ড অপেক্ষা করুন।` };
  if (await rateLimited(`verify-send:${user.id}`, 5, 60 * 60e3))
    return { message: "এক ঘণ্টায় অনেকবার কোড চাওয়া হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" };
  await recordHit(`verify-send:${user.id}`);
  const sent = await sendVerificationCode(user.email, await createCode(prisma, user.id));
  return sent ? { ok: true, message: `নতুন কোড ${user.email} ঠিকানায় পাঠানো হয়েছে।` } : { message: "এই মুহূর্তে ইমেইল পাঠানো যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।" };
}
