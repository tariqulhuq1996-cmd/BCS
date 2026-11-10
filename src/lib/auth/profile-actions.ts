"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import * as z from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashToken, SESSION_COOKIE } from "./session";
import type { FormState } from "./schemas";

const ProfileSchema = z.object({
  name: z.string().trim().min(2, { error: "পুরো নাম লিখুন (অন্তত ২ অক্ষর)।" }).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?88)?01[3-9]\d{8}$|^$/, { error: "সঠিক মোবাইল নম্বর লিখুন (যেমন 01712345678), অথবা ফাঁকা রাখুন।" }),
  dailyGoalMin: z.coerce.number().int().min(15, { error: "অন্তত ১৫ মিনিট।" }).max(720, { error: "সর্বোচ্চ ১২ ঘণ্টা (৭২০ মিনিট)।" }),
});

const PasswordSchema = z
  .object({
    current: z.string().min(1, { error: "বর্তমান পাসওয়ার্ড লিখুন।" }),
    password: z.string().min(8, { error: "পাসওয়ার্ডে অন্তত ৮টি অক্ষর লাগবে।" }).regex(/[A-Za-z]/, { error: "অন্তত একটি ইংরেজি বর্ণ দিন।" }).regex(/[0-9]/, { error: "অন্তত একটি সংখ্যা দিন।" }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { error: "দুটি পাসওয়ার্ড মেলেনি।", path: ["confirm"] });

const errs = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[]>;

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "আবার লগইন করুন।" };
  const raw = { name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? ""), dailyGoalMin: String(fd.get("dailyGoalMin") ?? "") };
  const p = ProfileSchema.safeParse(raw);
  if (!p.success) return { errors: errs(p.error), values: raw };
  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: { name: p.data.name, phone: p.data.phone || null, dailyGoalMin: p.data.dailyGoalMin },
    create: { userId: user.id, name: p.data.name, phone: p.data.phone || null, dailyGoalMin: p.data.dailyGoalMin },
  });
  return { ok: true, message: "প্রোফাইল সংরক্ষিত হয়েছে।", values: raw };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "আবার লগইন করুন।" };
  const p = PasswordSchema.safeParse({ current: String(fd.get("current") ?? ""), password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
  if (!p.success) return { errors: errs(p.error) };
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(p.data.current, u.passwordHash))) return { errors: { current: ["বর্তমান পাসওয়ার্ড মেলেনি।"] } };
  const keep = hashToken((await cookies()).get(SESSION_COOKIE)?.value ?? "");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(p.data.password, 12) } }),
    prisma.session.deleteMany({ where: { userId: user.id, NOT: { id: keep } } }), // অন্য ডিভাইস থেকে লগআউট
  ]);
  return { ok: true, message: "পাসওয়ার্ড বদলানো হয়েছে। অন্য সব ডিভাইস থেকে লগআউট করা হয়েছে।" };
}
