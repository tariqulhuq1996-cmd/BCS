/**
 * Level 3 (Model Test) স্বয়ংক্রিয় পরীক্ষা: তৈরি, অনুমোদন, সময়সীমা, স্বয়ংক্রিয় জমা, নেগেটিভ মার্কিং,
 * পর্যালোচনা-শর্ত, স্তর-গেট, বিশ্লেষণ ও Readiness Report। ১–১২ নম্বর টেস্ট অস্থায়ীভাবে তৈরি হয়ে শেষে মুছে যায়।
 *   npm run test:level3
 */
import { PrismaClient } from "@prisma/client";
import { manualUnlock } from "../src/lib/progress/engine";
import { apportion, approveModelTests, generateModelTests } from "../src/lib/exam/model-tests";
import { getModelTestAnalysis, getReadiness } from "../src/lib/exam/analysis";
import { ExamError, acknowledgeModelTestReview, addTime, evaluateTierGates, getAttemptView, saveAnswer, startStep, submitAttempt, tierGateStatus } from "../src/lib/exam/service";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const code = async (fn: () => Promise<unknown>) => {
  try { await fn(); return "OK"; } catch (e) { return e instanceof ExamError ? e.code : String(e); }
};
const MT = (n: number) => `L3:MT:${String(n).padStart(3, "0")}`;

/** right টি সঠিক, wrong টি ভুল, বাকি অনুত্তরিত */
async function answer(userId: string, attemptId: string, right: number, wrong: number) {
  const a = await db.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const qs = new Map((await db.question.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, correctIndex: true } })).map((q) => [q.id, q.correctIndex!]));
  const perms = a.optionPerms as Record<string, number[]>;
  for (const [i, qid] of a.questionIds.entries()) {
    if (i >= right + wrong) break;
    const r = perms[qid].indexOf(qs.get(qid)!);
    await saveAnswer(db, userId, attemptId, qid, i < right ? r : (r + 1) % 4, false, false);
  }
}
const state = async (u: string, key: string) => (await db.studentTaskProgress.findFirst({ where: { userId: u, task: { key } } }))?.state ?? "LOCKED";

async function main() {
  if (await db.modelTest.count({ where: { no: { lte: 12 }, status: "PUBLISHED" } })) throw new Error("১–১২ নম্বর প্রকাশিত Model Test আছে; পরীক্ষা চালানো নিরাপদ নয়।");
  const tag = `l3t${Date.now()}`;
  const u = await db.user.create({ data: { email: `${tag}@exam.test`, passwordHash: "x" } });
  const admin = await db.user.create({ data: { email: `${tag}-a@exam.test`, passwordHash: "x", role: "ADMIN" } });
  const marks = { BN: 30, EN: 30, BD: 25, IA: 25, GE: 10, SC: 15, IT: 15, MA: 20, MN: 15, ET: 15 };
  try {
    // ── সহায়ক ফাংশন
    const ap = apportion({ a: 1, b: 1, c: 2 }, 10);
    check("ভাগ-বণ্টন: মোট ঠিক থাকে (১০ → ৩+২+৫ বা কাছাকাছি)", ap.a + ap.b + ap.c === 10 && ap.c === 5, ap);

    // ── পুনরুৎপাদনযোগ্যতা
    await generateModelTests(db, { from: 1, to: 2, seed: 7 });
    const s1 = (await db.modelTestQuestion.findMany({ where: { modelTest: { no: 2 } }, orderBy: { position: "asc" } })).map((q) => q.questionId).join();
    await generateModelTests(db, { from: 1, to: 2, seed: 7 });
    const s2 = (await db.modelTestQuestion.findMany({ where: { modelTest: { no: 2 } }, orderBy: { position: "asc" } })).map((q) => q.questionId).join();
    check("একই বীজে একই টেস্ট (খসড়া নতুন করে তৈরি হয়)", s1 === s2 && s1.length > 0);

    // ── ১–১২ তৈরি
    const gen = await generateModelTests(db, { from: 1, to: 12, seed: 52 });
    check("১২টি খসড়া টেস্ট তৈরি", gen.generated.length === 12, gen.generated);
    const tests = await db.modelTest.findMany({ where: { no: { lte: 12 } }, orderBy: { no: "asc" }, include: { questions: { include: { question: { select: { subtopic: { select: { topic: { select: { subject: { select: { code: true } } } } } } } } } } } });
    const okSize = tests.every((t) => t.questions.length === 200 && new Set(t.questions.map((q) => q.questionId)).size === 200);
    check("প্রতিটি টেস্টে ২০০টি ভিন্ন প্রশ্ন", okSize);
    const subjOk = tests.every((t) => Object.entries(marks).every(([c, m]) => t.questions.filter((q) => q.question.subtopic.topic.subject.code === c).length === m));
    check("প্রতিটি টেস্টে বিষয়ভিত্তিক প্রশ্ন = নতুন মানবণ্টন", subjOk);
    // পুনরাবৃত্তি: পরপর ১০টির মধ্যে একই প্রশ্ন নয় — যেসব বিষয়ে প্রশ্ন কম পড়েছে (সতর্কতা আছে) সেগুলো বাদে
    const warnSubj = new Map<number, Set<string>>();
    for (const w of gen.warnings) (warnSubj.get(w.no) ?? warnSubj.set(w.no, new Set()).get(w.no)!).add(w.message.split(":")[0]);
    let repeats = 0;
    for (const t of tests) for (const q of t.questions) {
      const subj = q.question.subtopic.topic.subject.code;
      if (warnSubj.get(t.no)?.has(subj)) continue;
      if (tests.some((o) => o.no < t.no && t.no - o.no <= 10 && o.questions.some((x) => x.questionId === q.questionId))) repeats++;
    }
    check("পরপর ১০টি টেস্টে পুনরাবৃত্তি নেই (প্রশ্ন-ঘাটতির সতর্কতা থাকা বিষয় বাদে)", repeats === 0, { repeats });
    const shortSubjects = [...new Set(gen.warnings.map((w) => w.message.split(":")[0]))];
    console.log(`      তথ্য: শুধু বিগত প্রশ্নে যেসব বিষয়ে ঘাটতি — ${shortSubjects.join(", ") || "নেই"}`);
    check("ব্লুপ্রিন্টে কঠিনতার হিসাব রেকর্ড", tests.every((t) => typeof (t.blueprint as { difficulty?: object }).difficulty === "object"));

    // ── খসড়া অবস্থায় শিক্ষার্থী শুরু করতে পারে না
    await manualUnlock(db, u.id, (await db.learningTask.findUniqueOrThrow({ where: { key: MT(1) } })).id, admin.id);
    check("খসড়া টেস্ট শুরু করা যায় না", (await code(() => startStep(db, u.id, MT(1)))) === "EMPTY");
    check("Model Test 02 তালাবন্ধ", (await code(() => startStep(db, u.id, MT(2)))) === "LOCKED");
    await approveModelTests(db, 1, 12, admin.id);
    const before = (await db.modelTestQuestion.findMany({ where: { modelTest: { no: 3 } } })).map((q) => q.questionId).sort().join();
    await generateModelTests(db, { from: 1, to: 12, seed: 99 });
    const after = (await db.modelTestQuestion.findMany({ where: { modelTest: { no: 3 } } })).map((q) => q.questionId).sort().join();
    check("প্রকাশিত টেস্ট আবার তৈরি করলেও বদলায় না", before === after);

    // ── প্রথম টেস্ট
    const a1 = await startStep(db, u.id, MT(1));
    const at1 = await db.testAttempt.findUniqueOrThrow({ where: { id: a1 } });
    const mt1 = await db.modelTest.findUniqueOrThrow({ where: { no: 1 }, include: { questions: { orderBy: { position: "asc" } } } });
    check("প্রশ্ন টেস্টের নির্ধারিত ক্রমে", at1.questionIds.join() === mt1.questions.map((q) => q.questionId).join());
    const mins = (at1.deadlineAt!.getTime() - at1.startedAt.getTime()) / 60e3;
    check("সময়সীমা ১২০ মিনিট", Math.abs(mins - 120) < 0.1, mins);
    check("আবার শুরু করলে একই চলমান পরীক্ষা", (await startStep(db, u.id, MT(1))) === a1);
    await answer(u.id, a1, 150, 30);
    await addTime(db, u.id, a1, at1.questionIds[0], 40_000);
    await addTime(db, u.id, a1, at1.questionIds[0], 20_000);
    check("প্রশ্নে কাটানো সময় যোগ হয়", (await db.attemptAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: a1, questionId: at1.questionIds[0] } } })).timeMs === 60_000);
    await submitAttempt(db, u.id, a1);
    const s1a = await db.testAttempt.findUniqueOrThrow({ where: { id: a1 } });
    check("নেট নম্বর = ১৫০ − ০.৫×৩০ = ১৩৫", s1a.netScore === 135 && s1a.correct === 150 && s1a.wrong === 30 && s1a.unanswered === 20, s1a);
    check("পর্যালোচনার আগে Model Test 02 তালাবন্ধ", (await state(u.id, MT(2))) === "LOCKED");
    check("পর্যালোচনার আগে একই টেস্ট আবার নয়", (await code(() => startStep(db, u.id, MT(1)))) === "NEED_REVIEW");
    const an = await getModelTestAnalysis(db, u.id, a1);
    check("বিশ্লেষণ: নেট, কাটা নম্বর, ১০টি বিষয়", an.net === 135 && an.deduction === 15 && an.subjects.length === 10 && an.subjects.reduce((s, x) => s + x.total, 0) === 200, { net: an.net, d: an.deduction, n: an.subjects.length });
    await acknowledgeModelTestReview(db, u.id, a1);
    check("পর্যালোচনার পর টেস্ট সম্পন্ন, Model Test 02 খোলে", (await state(u.id, MT(1))) === "COMPLETED" && (await state(u.id, MT(2))) === "AVAILABLE");

    // ── আবার দেওয়া (সম্পন্ন টেস্ট)
    check("সম্পন্ন টেস্ট সাধারণভাবে শুরু হয় না", (await code(() => startStep(db, u.id, MT(1)))) === "SUBMITTED");
    const re = await startStep(db, u.id, MT(1), "practice");
    check("চাইলে আবার দেওয়া যায় (নতুন চেষ্টা)", re !== a1 && (await db.testAttempt.findUniqueOrThrow({ where: { id: re } })).kind === "MODEL_TEST");
    await answer(u.id, re, 165, 0);
    await submitAttempt(db, u.id, re);
    check("নেট ১৬০+ হলে অর্জন", !!(await db.userAchievement.findFirst({ where: { userId: u.id, achievementKey: "mt_160" } })));
    const an2 = await getModelTestAnalysis(db, u.id, re);
    check("আগের টেস্টের সঙ্গে তুলনা", an2.prev?.net === 135 && an2.subjects.every((s) => s.prevNet != null));

    // ── সময় পেরোলে স্বয়ংক্রিয় জমা
    const a2 = await startStep(db, u.id, MT(2));
    await answer(u.id, a2, 10, 0);
    await db.testAttempt.update({ where: { id: a2 }, data: { deadlineAt: new Date(Date.now() - 5 * 60e3) } });
    const q50 = (await db.testAttempt.findUniqueOrThrow({ where: { id: a2 } })).questionIds[50];
    check("সময় শেষে উত্তর দেওয়া যায় না", (await code(() => saveAnswer(db, u.id, a2, q50, 0, false, false))) === "SUBMITTED");
    const v = await getAttemptView(db, u.id, a2);
    const s2a = await db.testAttempt.findUniqueOrThrow({ where: { id: a2 } });
    check("পাতা খুললেই স্বয়ংক্রিয় জমা, সংরক্ষিত উত্তরসহ", v.submitted && s2a.correct === 10 && s2a.netScore === 10, { sub: v.submitted, c: s2a.correct });

    // ── স্তর-গেট (শেষ ৫টির গড় নেট ≥ ১২০)
    await manualUnlock(db, u.id, (await db.learningTask.findUniqueOrThrow({ where: { key: "L3:GATE:1" } })).id, admin.id);
    const t3 = await db.learningTask.findUniqueOrThrow({ where: { key: MT(3) } });
    const fake = (net: number, i: number) => ({ userId: u.id, taskId: t3.id, kind: "MODEL_TEST" as const, questionIds: [], optionPerms: {}, startedAt: new Date(Date.now() + i * 1000), submittedAt: new Date(Date.now() + i * 1000 + 500), netScore: net, reviewedAt: new Date() });
    await db.testAttempt.createMany({ data: [100, 110, 115, 112, 108].map((n, i) => fake(n, i + 1)) });
    await evaluateTierGates(db, u.id);
    const g1 = (await tierGateStatus(db, u.id))[0];
    check("গড় ১০৯ → গেট খোলে না", g1.state === "AVAILABLE" && Math.round(g1.avg!) === 109, g1);
    await db.testAttempt.createMany({ data: [125, 130, 118, 140, 122].map((n, i) => fake(n, i + 10)) });
    await evaluateTierGates(db, u.id);
    const g2 = (await tierGateStatus(db, u.id))[0];
    check("শেষ ৫টির গড় ১২৭ → স্তর ১ → ২ গেট পার", g2.state === "COMPLETED" && Math.round(g2.avg!) === 127, g2);
    check("গেট পার হলেও Model Test 51 খোলে না যতক্ষণ 50 বাকি", (await state(u.id, MT(51))) === "LOCKED");

    // ── Readiness
    const r = await getReadiness(db, u.id);
    check("Readiness: সব চেষ্টা, সর্বোচ্চ ১৬৫, বিষয়ভিত্তিক শক্তি/দুর্বলতা", r.count === 13 && r.highest?.net === 165 && (r.subjects?.length ?? 0) === 10 && (r.weak?.length ?? 0) === 3, { c: r.count, hi: r.highest });
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: admin.id } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.modelTest.deleteMany({ where: { no: { lte: 12 } } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
