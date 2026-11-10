"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { Prisma, QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashToken, newToken } from "@/lib/auth/session";
import { DEFAULT_RULES } from "@/lib/rules/defaults";
import { questionHash } from "@/lib/questions/hash";
import { importQuestions, parseCsv, parseXlsx, type ImportReport } from "@/lib/questions/import";
import { approveModelTests, generateModelTests } from "@/lib/exam/model-tests";
import { manualUnlock, reconcileDeactivated } from "@/lib/progress/engine";
import { sendPasswordResetLink } from "@/lib/auth/mailer";
import { appUrl } from "@/lib/env";

/** প্রতিটি অ্যাডমিন-কাজের শুরুতে: সার্ভারে ভূমিকা যাচাই। */
async function admin() {
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN") throw new Error("অ্যাডমিন অনুমতি নেই");
  return u;
}
async function audit(actorId: string, action: string, entity: string, entityId: string | null, data?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, data } });
}
const back = (path: string, msg: string, kind: "ok" | "err" = "ok") => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

// ─────────────────────────────────────────── প্রশ্ন

const BULK: Record<string, { label: string; data: Prisma.QuestionUpdateManyMutationInput }> = {
  publish: { label: "প্রকাশিত", data: { status: "PUBLISHED" } },
  verify: { label: "যাচাইকৃত", data: { status: "VERIFIED" } },
  draft: { label: "খসড়া", data: { status: "DRAFT" } },
  retire: { label: "বাতিল", data: { status: "RETIRED" } },
  explVerify: { label: "ব্যাখ্যা যাচাইকৃত", data: { explanationStatus: "VERIFIED" } },
};

export async function bulkQuestionsAction(fd: FormData) {
  const a = await admin();
  const ids = fd.getAll("ids").map(String).filter(Boolean);
  const op = BULK[String(fd.get("op") ?? "")];
  const ret = String(fd.get("return") ?? "/admin/questions");
  if (!op || !ids.length) back(ret, "কোনো প্রশ্ন বা কাজ বাছাই করা হয়নি।", "err");
  // ব্যাখ্যা নেই এমন প্রশ্নের "ব্যাখ্যা যাচাইকৃত" হয় না; উত্তর নেই এমন প্রশ্ন প্রকাশিত হয় না
  const where: Prisma.QuestionWhereInput = { id: { in: ids } };
  if (op.data.explanationStatus) where.explanation = { not: null };
  if (op.data.status === "PUBLISHED") where.correctIndex = { not: null };
  const r = await prisma.question.updateMany({ where, data: op.data });
  await audit(a.id, `bulk_${String(fd.get("op"))}`, "Question", null, { ids, count: r.count });
  updateTag("research");
  back(ret, `${r.count}টি প্রশ্ন: ${op.label}${r.count < ids.length ? ` (${ids.length - r.count}টি শর্ত পূরণ না করায় বাদ)` : ""}।`);
}

export type QState = { ok?: boolean; message?: string } | undefined;

export async function updateQuestionAction(_: QState, fd: FormData): Promise<QState> {
  const a = await admin();
  const id = String(fd.get("id"));
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return { message: "প্রশ্নটি পাওয়া যায়নি।" };
  const text = String(fd.get("text") ?? "").trim();
  const options = [0, 1, 2, 3].map((i) => String(fd.get(`opt${i}`) ?? "").trim());
  const ans = fd.get("answer") === "" ? null : Number(fd.get("answer"));
  const code = String(fd.get("subtopic") ?? "").trim().toUpperCase();
  if (!text) return { message: "প্রশ্নের লেখা ফাঁকা।" };
  if (options.some((o) => !o) || new Set(options).size !== 4) return { message: "চারটি ভিন্ন, ফাঁকা নয় এমন অপশন লাগবে।" };
  if (ans != null && (ans < 0 || ans > 3)) return { message: "সঠিক উত্তর বাছাই করুন।" };
  const st = await prisma.subtopic.findUnique({ where: { code } });
  if (!st) return { message: `উপবিষয় কোড "${code}" নেই।` };
  const status = String(fd.get("status")) as QuestionStatus;
  if (status === "PUBLISHED" && ans == null) return { message: "সঠিক উত্তর ছাড়া প্রকাশ করা যায় না।" };
  const hash = questionHash(text, options);
  const dup = await prisma.question.findFirst({ where: { textHash: hash, NOT: { id } }, select: { uid: true, kind: true } });
  if (dup && q.kind === "TOPIC") return { message: `হুবহু একই প্রশ্ন আগে থেকে আছে: ${dup.uid}` };
  const explanation = String(fd.get("explanation") ?? "").trim() || null;
  const diff = String(fd.get("difficulty") ?? "");
  const data = {
    text, options, correctIndex: ans, subtopicId: st.id, status, textHash: hash, explanation,
    explanationStatus: (explanation ? String(fd.get("explanationStatus") ?? "DRAFT") : "NONE") as "NONE" | "DRAFT" | "VERIFIED",
    difficulty: diff ? (diff as "EASY" | "MEDIUM" | "HARD") : null,
    source: String(fd.get("source") ?? "").trim() || null,
    verifyNote: String(fd.get("verifyNote") ?? "").trim() || null,
  };
  await prisma.question.update({ where: { id }, data });
  await audit(a.id, "edit_question", "Question", q.uid, {
    before: { text: q.text, options: q.options, correctIndex: q.correctIndex, status: q.status, explanation: q.explanation },
    after: { text, options, correctIndex: ans, status, explanation },
  });
  updateTag("research");
  return { ok: true, message: "সংরক্ষিত হয়েছে।" };
}

// ─────────────────────────────────────────── Import

export type ImportState = { report?: ImportReport; error?: string; confirmed?: boolean } | undefined;

async function recordsFromFile(file: File): Promise<{ records: Record<string, unknown>[]; format: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return { records: JSON.parse(await file.text()), format: "json" };
  if (name.endsWith(".csv")) return { records: parseCsv(await file.text()), format: "csv" };
  if (name.endsWith(".xlsx")) return { records: await parseXlsx(await file.arrayBuffer()), format: "xlsx" };
  throw new Error("শুধু .csv, .json বা .xlsx ফাইল দিন।");
}

export async function importAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const a = await admin();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "ফাইল বাছাই করুন।" };
  const confirm = fd.get("confirm") === "1";
  const status = (String(fd.get("status") ?? "DRAFT") as QuestionStatus);
  try {
    const { records, format } = await recordsFromFile(file);
    if (!Array.isArray(records) || !records.length) return { error: "ফাইলে কোনো সারি নেই।" };
    const report = await importQuestions(prisma, records, { source: file.name, format, status, dryRun: !confirm, createdBy: a.id });
    if (confirm) {
      await audit(a.id, "import_questions", "ImportBatch", String(report.batchId), { file: file.name, inserted: report.inserted, status });
      updateTag("research");
    }
    return { report, confirmed: confirm };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ফাইল পড়া যায়নি।" };
  }
}

// ─────────────────────────────────────────── নিয়ম

export async function updateRuleAction(fd: FormData) {
  const a = await admin();
  const key = String(fd.get("key"));
  const scope = String(fd.get("scope") ?? "global").trim() || "global";
  const raw = String(fd.get("value") ?? "").trim();
  const def = DEFAULT_RULES[key];
  if (!def) back("/admin/rules", `অজানা নিয়ম ${key}`, "err");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { back("/admin/rules", `${key}: মান সঠিক JSON নয় (যেমন 80, true, [1,3,7])`, "err"); }
  const want = Array.isArray(def.value) ? "array" : typeof def.value;
  const got = Array.isArray(value) ? "array" : typeof value;
  if (want !== got) back("/admin/rules", `${key}: মানের ধরন ভুল (লাগবে ${want})`, "err");
  if (typeof value === "number" && key.includes("threshold") && (value < 0 || value > 100)) back("/admin/rules", `${key}: ০–১০০-এর মধ্যে দিন`, "err");
  const prev = await prisma.ruleSetting.findUnique({ where: { key_scope: { key, scope } } });
  await prisma.ruleSetting.upsert({
    where: { key_scope: { key, scope } },
    update: { value: value as Prisma.InputJsonValue, updatedBy: a.id },
    create: { key, scope, value: value as Prisma.InputJsonValue, noteBn: def.noteBn, updatedBy: a.id },
  });
  await audit(a.id, "update_rule", "RuleSetting", `${scope}|${key}`, { before: (prev?.value ?? null) as Prisma.InputJsonValue, after: value as Prisma.InputJsonValue });
  back("/admin/rules", `${key} (${scope}) হালনাগাদ হয়েছে।`);
}

export async function deleteRuleOverrideAction(fd: FormData) {
  const a = await admin();
  const key = String(fd.get("key"));
  const scope = String(fd.get("scope"));
  if (scope === "global") back("/admin/rules", "সাধারণ (global) নিয়ম মোছা যায় না; মান বদলান।", "err");
  await prisma.ruleSetting.deleteMany({ where: { key, scope } });
  await audit(a.id, "delete_rule_override", "RuleSetting", `${scope}|${key}`);
  back("/admin/rules", `${key}-এর ${scope} ব্যতিক্রম মুছে ফেলা হয়েছে।`);
}

// ─────────────────────────────────────────── Roadmap

export async function updateTaskAction(fd: FormData) {
  const a = await admin();
  const key = String(fd.get("key"));
  const titleBn = String(fd.get("title") ?? "").trim();
  const active = fd.get("active") === "on";
  const t = await prisma.learningTask.findUnique({ where: { key } });
  if (!t) back("/admin/roadmap", "কাজটি পাওয়া যায়নি।", "err");
  await prisma.learningTask.update({ where: { key }, data: { ...(titleBn ? { titleBn } : {}), active } });
  const moved = t!.active && !active ? await reconcileDeactivated(prisma, t!.id) : 0;
  await audit(a.id, "update_task", "LearningTask", key, { titleBn, active, before: { titleBn: t!.titleBn, active: t!.active }, studentsMoved: moved });
  back(`/admin/roadmap?level=${String(fd.get("level") ?? "1")}`, `${key} হালনাগাদ হয়েছে।${moved ? ` ${moved} জন শিক্ষার্থীর পরের ধাপ খুলে দেওয়া হয়েছে।` : ""}`);
}

// ─────────────────────────────────────────── Model Test

export async function generateModelTestsAction(fd: FormData) {
  const a = await admin();
  const from = Number(fd.get("from")), to = Number(fd.get("to")), seed = Number(fd.get("seed") || 52);
  if (!(from >= 1 && to <= 150 && from <= to)) back("/admin/model-tests", "পরিসর ১–১৫০-এর মধ্যে দিন।", "err");
  const s = await generateModelTests(prisma, { from, to, seed });
  await audit(a.id, "generate_model_tests", "ModelTest", `${from}-${to}`, { seed, generated: s.generated.length, warnings: s.warnings.length });
  back("/admin/model-tests", `খসড়া তৈরি ${s.generated.length}টি; প্রকাশিত বলে অপরিবর্তিত ${s.skippedPublished.length}টি; সতর্কতা ${s.warnings.length}টি।`);
}

export async function approveModelTestsAction(fd: FormData) {
  const a = await admin();
  const from = Number(fd.get("from")), to = Number(fd.get("to"));
  if (!(from >= 1 && to <= 150 && from <= to)) back("/admin/model-tests", "পরিসর ১–১৫০-এর মধ্যে দিন।", "err");
  const n = await approveModelTests(prisma, from, to, a.id);
  back("/admin/model-tests", `${n}টি Model Test প্রকাশিত হয়েছে। প্রকাশিত টেস্ট আর বদলানো যায় না।`);
}

// ─────────────────────────────────────────── শিক্ষার্থী

export async function manualUnlockAction(fd: FormData) {
  const a = await admin();
  const userId = String(fd.get("userId"));
  const key = String(fd.get("taskKey") ?? "").trim().toUpperCase();
  const t = await prisma.learningTask.findUnique({ where: { key } });
  if (!t) back(`/admin/students/${userId}`, `কাজের key "${key}" পাওয়া যায়নি (যেমন L1:EXAM:15)।`, "err");
  await manualUnlock(prisma, userId, t!.id, a.id);
  back(`/admin/students/${userId}`, `${t!.titleBn} হাতে Unlock করা হয়েছে।`);
}

export async function setDisabledAction(fd: FormData) {
  const a = await admin();
  const userId = String(fd.get("userId"));
  const disabled = fd.get("disabled") === "1";
  if (userId === a.id) back(`/admin/students/${userId}`, "নিজের অ্যাকাউন্ট বন্ধ করা যায় না।", "err");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { disabled } }),
    ...(disabled ? [prisma.session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit(a.id, disabled ? "disable_user" : "enable_user", "User", userId);
  back(`/admin/students/${userId}`, disabled ? "অ্যাকাউন্ট বন্ধ করা হয়েছে; সব ডিভাইস থেকে লগআউট।" : "অ্যাকাউন্ট আবার চালু হয়েছে।");
}

export async function sendResetAction(fd: FormData) {
  const a = await admin();
  const userId = String(fd.get("userId"));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = newToken();
  await prisma.passwordResetToken.create({ data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + 60 * 60e3) } });
  await sendPasswordResetLink(u.email, `${appUrl()}/reset-password/${token}`);
  await audit(a.id, "send_reset", "User", userId);
  back(`/admin/students/${userId}`, "পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে।");
}
