"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimited, recordHit } from "@/lib/auth/rate-limit";
import { answeredBy } from "./access";
import { resetProgress } from "@/lib/progress/engine";
import { REPORT_REASONS, type ReportReason } from "./reasons";

/** পরিচিতি একবার দেখানো হলো (শেষ বা বন্ধ)। */
export async function markTourSeen() {
  const u = await getCurrentUser();
  if (!u) return;
  await prisma.studentProfile.updateMany({ where: { userId: u.id, tourSeenAt: null }, data: { tourSeenAt: new Date() } });
}

export type SaveState = { saved: boolean; note: string; error?: string; ok?: string };

/**
 * প্রশ্ন সংরক্ষণ/বাদ (☆)। শুধু যে প্রশ্নের উত্তর নিজে জমা দিয়েছেন সেটি — নইলে সংরক্ষিত-পাতা দিয়ে
 * না-দেখা প্রশ্নের উত্তর জেনে ফেলা যেত।
 */
export async function toggleSaved(questionId: string, save: boolean): Promise<SaveState> {
  const u = await getCurrentUser();
  if (!u) return { saved: false, note: "", error: "আবার লগইন করুন।" };
  if (!(await answeredBy(prisma, u.id, questionId))) return { saved: false, note: "", error: "এই প্রশ্নটি সংরক্ষণ করা যাচ্ছে না।" };
  if (save) await prisma.bookmark.upsert({ where: { userId_questionId: { userId: u.id, questionId } }, update: {}, create: { userId: u.id, questionId } });
  else await prisma.bookmark.deleteMany({ where: { userId: u.id, questionId } });
  revalidatePath("/saved");
  const b = save ? await prisma.bookmark.findUnique({ where: { userId_questionId: { userId: u.id, questionId } }, select: { note: true } }) : null;
  return { saved: save, note: b?.note ?? "" };
}

const NoteSchema = z.string().trim().max(2000, { error: "নোট ২,০০০ অক্ষরের মধ্যে রাখুন।" });

/** নিজের নোট (সংরক্ষিত প্রশ্নে; নোট লিখলে প্রশ্নটি নিজে থেকেই সংরক্ষিত হয়)। */
export async function saveNote(questionId: string, raw: string): Promise<SaveState> {
  const u = await getCurrentUser();
  if (!u) return { saved: false, note: raw, error: "আবার লগইন করুন।" };
  const parsed = NoteSchema.safeParse(raw);
  if (!parsed.success) return { saved: true, note: raw, error: parsed.error.issues[0].message };
  if (!(await answeredBy(prisma, u.id, questionId))) return { saved: false, note: raw, error: "এই প্রশ্নে নোট রাখা যাচ্ছে না।" };
  const note = parsed.data || null;
  await prisma.bookmark.upsert({ where: { userId_questionId: { userId: u.id, questionId } }, update: { note }, create: { userId: u.id, questionId, note } });
  revalidatePath("/saved");
  return { saved: true, note: note ?? "", ok: "নোট সংরক্ষিত হয়েছে।" };
}


const ReportSchema = z.object({
  questionId: z.string().min(1).max(64),
  reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]], { error: "কী ধরনের ভুল, বেছে নিন।" }),
  note: z.string().trim().max(1000, { error: "বিবরণ ১,০০০ অক্ষরের মধ্যে রাখুন।" }),
});

export type ReportState = { ok?: boolean; message?: string } | undefined;

/** "এই প্রশ্নে ভুল আছে" — অ্যাডমিনের তালিকায় যায়। একই প্রশ্নে খোলা অভিযোগ থাকলে নতুন করে নয়। */
export async function reportQuestion(_: ReportState, fd: FormData): Promise<ReportState> {
  const u = await getCurrentUser();
  if (!u) return { message: "আবার লগইন করুন।" };
  const parsed = ReportSchema.safeParse({ questionId: fd.get("questionId"), reason: fd.get("reason"), note: String(fd.get("note") ?? "") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const { questionId, reason, note } = parsed.data;
  if (!(await answeredBy(prisma, u.id, questionId))) return { message: "এই প্রশ্নে অভিযোগ জানানো যাচ্ছে না।" };
  if (await prisma.questionReport.findFirst({ where: { userId: u.id, questionId, status: "OPEN" }, select: { id: true } }))
    return { ok: true, message: "এই প্রশ্নে আপনার অভিযোগ আগেই জমা আছে; যাচাই চলছে।" };
  if (await rateLimited(`report:${u.id}`, 30, 24 * 3600e3)) return { message: "আজ অনেক অভিযোগ জমা হয়েছে। আগামীকাল আবার চেষ্টা করুন।" };
  await recordHit(`report:${u.id}`);
  await prisma.questionReport.create({ data: { userId: u.id, questionId, reason, note: note || null } });
  return { ok: true, message: "ধন্যবাদ! অভিযোগটি জমা হয়েছে; যাচাই করে ঠিক করা হবে।" };
}

export type ResetState = { ok?: boolean; message?: string } | undefined;
const RESET_WORD = "রিসেট";

/** নিজের Dashboard/অগ্রগতি রিসেট — নিশ্চিত করতে "রিসেট" লিখতে হয়। বিস্তারিত: resetProgress (lib/progress/engine)। */
export async function resetMyProgress(_: ResetState, fd: FormData): Promise<ResetState> {
  const u = await getCurrentUser();
  if (!u) return { message: "আবার লগইন করুন।" };
  if (String(fd.get("confirm") ?? "").trim() !== RESET_WORD) return { message: `নিশ্চিত করতে ঘরে "${RESET_WORD}" লিখুন।` };
  await resetProgress(prisma, u.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "আপনার অগ্রগতি রিসেট হয়েছে। এখন শুরু থেকে প্রস্তুতি নিতে পারবেন।" };
}
