/**
 * নিরাপত্তা ও একযোগে অনুরোধের পরীক্ষা (সার্ভিস-স্তরে):
 * একই পরীক্ষা একসঙ্গে বহুবার জমা, একই ধাপ একসঙ্গে বহুবার শুরু, একই কাজ একসঙ্গে বহুবার সম্পন্ন,
 * অবৈধ ইনপুট, অন্যের পরীক্ষায় হস্তক্ষেপ, পাসওয়ার্ড সংরক্ষণ। অস্থায়ী তথ্য শেষে মুছে যায়।
 *   npx tsx scripts/test-security.ts
 */
import { startAtLevel1 } from "./_journey";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { completeTask } from "../src/lib/progress/engine";
import { ExamError, acknowledgeModelTestReview, getAttemptView, getResultView, saveAnswer, startStep, submitAttempt } from "../src/lib/exam/service";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const code = async (fn: () => Promise<unknown>) => {
  try { await fn(); return "OK"; } catch (e) { return e instanceof ExamError ? e.code : (e as Error).message?.slice(0, 60) ?? String(e); }
};

async function main() {
  const tag = `sec${Date.now()}`;
  const mk = (n: string, extra = {}) => db.user.create({ data: { email: `${tag}-${n}@sec.test`, passwordHash: bcrypt.hashSync("Secret12345", 4), ...extra } });
  const a = await mk("a"), b = await mk("b");
  try {
    await startAtLevel1(db, a.id);
    await startAtLevel1(db, b.id);

    // ── একই ধাপ একসঙ্গে ৫ বার শুরু
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => startStep(db, a.id, "L1:EXAM:10")));
    const open = await db.testAttempt.count({ where: { userId: a.id, submittedAt: null } });
    check("একই ধাপ একসঙ্গে ৫ বার শুরু → একটিই পরীক্ষা", new Set(ids).size === 1 && open === 1, { distinct: new Set(ids).size, open });
    const att = ids[0];
    const v = await getAttemptView(db, a.id, att);

    // ── অবৈধ ইনপুট
    const q0 = v.questions[0].qid;
    check("অপশন ৪ → প্রত্যাখ্যান", (await code(() => saveAnswer(db, a.id, att, q0, 4, false, false))) === "BAD_INPUT");
    check("অপশন −১ → প্রত্যাখ্যান", (await code(() => saveAnswer(db, a.id, att, q0, -1, false, false))) === "BAD_INPUT");
    check("অপশন ১.৫ → প্রত্যাখ্যান", (await code(() => saveAnswer(db, a.id, att, q0, 1.5, false, false))) === "BAD_INPUT");
    check("অস্তিত্বহীন পরীক্ষা → পাওয়া যায়নি", (await code(() => saveAnswer(db, a.id, "nonexistent-id", q0, 0, false, false))) === "NOT_FOUND");
    check("অস্তিত্বহীন কাজ → পাওয়া যায়নি", (await code(() => startStep(db, a.id, "L9:NOPE:1"))) === "NOT_FOUND");

    // ── অন্যের পরীক্ষা
    check("অন্যের পরীক্ষায় উত্তর → নিষিদ্ধ", (await code(() => saveAnswer(db, b.id, att, q0, 0, false, false))) === "FORBIDDEN");
    check("অন্যের পরীক্ষা জমা → নিষিদ্ধ", (await code(() => submitAttempt(db, b.id, att))) === "FORBIDDEN");
    check("অন্যের পরীক্ষা দেখা → নিষিদ্ধ", (await code(() => getAttemptView(db, b.id, att))) === "FORBIDDEN");
    check("Model Test নয় এমন পরীক্ষার পর্যালোচনা-নিশ্চিতকরণ → প্রত্যাখ্যান", (await code(() => acknowledgeModelTestReview(db, a.id, att))) === "BAD_INPUT");

    // ── একই প্রশ্নে একসঙ্গে ১০টি উত্তর
    await Promise.all([0, 1, 2, 3, 0, 1, 2, 3, 2, 1].map((d) => saveAnswer(db, a.id, att, q0, d, false, false)));
    check("একই প্রশ্নে একসঙ্গে ১০টি উত্তর → একটিই সারি", (await db.attemptAnswer.count({ where: { attemptId: att, questionId: q0 } })) === 1);

    // ── একসঙ্গে ৫ বার জমা
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => code(() => submitAttempt(db, a.id, att))));
    const st = await db.questionStat.findUnique({ where: { userId_questionId: { userId: a.id, questionId: q0 } } });
    check("একসঙ্গে ৫ বার জমা → ঠিক একবার গৃহীত", results.filter((r) => r === "OK").length === 1 && results.filter((r) => r === "SUBMITTED").length === 4, results);
    check("…এবং প্রশ্নের পরিসংখ্যান একবারই গোনা", st?.seen === 1, st?.seen);
    check("জমার পর ফলাফল মালিক দেখতে পায়, অন্য কেউ নয়", (await code(() => getResultView(db, a.id, [att]))) === "OK" && (await code(() => getResultView(db, b.id, [att]))) === "FORBIDDEN");

    // ── একই কাজ একসঙ্গে ৫ বার সম্পন্ন
    const t10 = await db.learningTask.findUniqueOrThrow({ where: { key: "L1:EXAM:10" } });
    const cr = await Promise.all([1, 2, 3, 4, 5].map(() => code(() => completeTask(db, b.id, t10.id))));
    const s11 = await db.studentTaskProgress.findMany({ where: { userId: b.id, task: { key: "L1:EXAM:11" } } });
    check("একই কাজ একসঙ্গে ৫ বার সম্পন্ন → ভাঙে না, ১১তম একবারই খোলে", s11.length === 1 && s11[0].state === "AVAILABLE" && cr.every((r) => r === "OK" || r.includes("Unique") || r.includes("deadlock") || r.includes("conflict")), cr);
    const t12 = await db.learningTask.findUniqueOrThrow({ where: { key: "L1:EXAM:12" } });
    const b12 = await code(() => completeTask(db, b.id, t12.id));
    check("তালাবন্ধ কাজ সম্পন্ন করা যায় না", b12 === "LOCKED_TASK", b12);

    // ── পাসওয়ার্ড ও বন্ধ অ্যাকাউন্ট
    const anyUser = await db.user.findFirstOrThrow({ where: { email: { endsWith: "@bcs52.test" } } });
    check("পাসওয়ার্ড শুধু bcrypt-হ্যাশ হিসেবে সংরক্ষিত", /^\$2[aby]\$\d{2}\$/.test(anyUser.passwordHash) && !anyUser.passwordHash.includes("Practice"));
    const sessionsWithPlainToken = await db.session.count({ where: { id: { not: { startsWith: "" } } } });
    const sess = await db.session.findFirst();
    check("সেশন-টোকেন ডেটাবেসে শুধু হ্যাশ (৬৪ অক্ষরের hex)", !sess || (/^[0-9a-f]{64}$/.test(sess.id) && sessionsWithPlainToken === 0));
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
