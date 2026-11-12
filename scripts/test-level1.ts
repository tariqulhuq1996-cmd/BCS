/**
 * Level 1 পরীক্ষা-ইঞ্জিনের স্বয়ংক্রিয় পরীক্ষা: একজন অস্থায়ী পরীক্ষার্থী পুরো Learning Cycle পার হয় —
 * ব্যর্থতা, পুনরায় চেষ্টা, Unlock, এবং নিয়ম ভাঙার চেষ্টা। শেষে সব পরীক্ষার তথ্য মুছে ফেলা হয়।
 *   npm run test:level1
 */
import { PrismaClient } from "@prisma/client";
import { ensureStarted, manualUnlock } from "../src/lib/progress/engine";
import { optionPerm, splitParts } from "../src/lib/exam/select";
import { ExamError, acknowledgeReview, getAttemptView, getResultView, saveAnswer, startStep, submitAttempt } from "../src/lib/exam/service";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const code = async (fn: () => Promise<unknown>) => {
  try { await fn(); return "OK"; } catch (e) { return e instanceof ExamError ? e.code : String(e); }
};

/** প্রথম `rightShare` অংশ সঠিক, বাকি ভুল উত্তর; `unsure` হলে সব "নিশ্চিত নই"। */
async function answer(userId: string, attemptId: string, rightShare: number, unsure = false) {
  const a = await db.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const qs = new Map((await db.question.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, correctIndex: true } })).map((q) => [q.id, q.correctIndex!]));
  const perms = a.optionPerms as Record<string, number[]>;
  const nRight = Math.round(a.questionIds.length * rightShare);
  for (const [i, qid] of a.questionIds.entries()) {
    const right = perms[qid].indexOf(qs.get(qid)!);
    await saveAnswer(db, userId, attemptId, qid, i < nRight ? right : (right + 1) % 4, false, unsure);
  }
}
const state = async (u: string, key: string) =>
  db.studentTaskProgress.findFirst({ where: { userId: u, task: { key } } });

async function main() {
  const tag = `l1t${Date.now()}`;
  const u = await db.user.create({ data: { email: `${tag}@exam.test`, passwordHash: "x", profile: { create: { name: "পরীক্ষা" } } } });
  const other = await db.user.create({ data: { email: `${tag}-o@exam.test`, passwordHash: "x" } });
  const admin = await db.user.create({ data: { email: `${tag}-a@exam.test`, passwordHash: "x", role: "ADMIN" } });
  try {
    await ensureStarted(db, u.id);
    await ensureStarted(db, other.id);

    // ── তালাবন্ধ ধাপ
    check("তালাবন্ধ ১১তম BCS শুরু করা যায় না", (await code(() => startStep(db, u.id, "L1:EXAM:11"))) === "LOCKED");

    // ── ১০ম: প্রথম সমাধান, ভাগ ১
    const p1 = await startStep(db, u.id, "L1:EXAM:10");
    const v1 = await getAttemptView(db, u.id, p1);
    check("প্রথম ভাগে প্রশ্ন আছে ও ভাগের শিরোনাম (বাংলা অঙ্কে)", v1.questions.length > 0 && v1.title.includes("ভাগ ১/২"), v1.title);
    check("পরীক্ষা চলাকালীন সঠিক উত্তর/ব্যাখ্যা পাঠানো হয় না", !JSON.stringify(v1).match(/correctIndex|explanation/));
    check("আবার শুরু করলে একই অসমাপ্ত পরীক্ষা ফেরে", (await startStep(db, u.id, "L1:EXAM:10")) === p1);
    check("অন্যের পরীক্ষায় উত্তর দেওয়া যায় না", (await code(() => saveAnswer(db, other.id, p1, v1.questions[0].qid, 0, false, false))) === "FORBIDDEN");
    check("অন্যের পরীক্ষার পাতা দেখা যায় না", (await code(() => getAttemptView(db, other.id, p1))) === "FORBIDDEN");
    const foreignQ = await db.question.findFirstOrThrow({ where: { exam: { bcsNo: 30 } } });
    check("পরীক্ষার বাইরের প্রশ্নে উত্তর দেওয়া যায় না", (await code(() => saveAnswer(db, u.id, p1, foreignQ.id, 0, false, false))) === "BAD_INPUT");
    check("জমার আগে ফলাফল দেখা যায় না", (await code(() => getResultView(db, u.id, [p1]))) === "NOT_READY");

    await answer(u.id, p1, 0.6);
    // উত্তর বদলানো: প্রথম প্রশ্নের উত্তর দুবার বদলালেও একটিই সারি
    await saveAnswer(db, u.id, p1, v1.questions[0].qid, 2, true, false);
    await saveAnswer(db, u.id, p1, v1.questions[0].qid, 3, true, false);
    check("উত্তর বদলালে একটিই সারি থাকে", (await db.attemptAnswer.count({ where: { attemptId: p1, questionId: v1.questions[0].qid } })) === 1);
    const r1 = await submitAttempt(db, u.id, p1);
    check("দুবার জমা দেওয়া যায় না", (await code(() => submitAttempt(db, u.id, p1))) === "SUBMITTED");
    check("জমার পর উত্তর বদলানো যায় না", (await code(() => saveAnswer(db, u.id, p1, v1.questions[1].qid, 0, false, false))) === "SUBMITTED");
    check("প্রথম ভাগের পর এখনও সমাধান-ধাপে", (await state(u.id, "L1:EXAM:10"))?.step === "SOLVE" && r1.passed === null);

    // ── ভাগ ২
    const p2 = await startStep(db, u.id, "L1:EXAM:10");
    check("দ্বিতীয় ভাগ আলাদা পরীক্ষা", p2 !== p1);
    await answer(u.id, p2, 0.6);
    await submitAttempt(db, u.id, p2);
    check("সব ভাগ শেষে পর্যালোচনা-ধাপ", (await state(u.id, "L1:EXAM:10"))?.step === "REVIEW");
    check("পর্যালোচনার আগে Revision শুরু করা যায় না", (await code(() => startStep(db, u.id, "L1:EXAM:10"))) === "NEED_REVIEW");
    const rv = await getResultView(db, u.id, [p1, p2]);
    const pathN10 = await db.question.count({ where: { status: "PUBLISHED", verifyClass: { in: ["V", "C"] }, exam: { bcsNo: 10 } } });
    check(`সম্মিলিত ফলাফলে বাধ্যতামূলক পথের সব ${pathN10}টি প্রশ্ন ও বিষয়ভিত্তিক হিসাব`, rv.total === pathN10 && rv.subjects.reduce((s, x) => s + x.total, 0) === pathN10, { total: rv.total, pathN10 });
    check("ফলাফলে ব্যাখ্যা ও সঠিক উত্তর আছে", rv.items.every((i) => i.correct != null));

    await acknowledgeReview(db, u.id, "L1:EXAM:10");
    check("পর্যালোচনা শেষে Revision-ধাপ", (await state(u.id, "L1:EXAM:10"))?.step === "REVISION");

    // ── Revision: প্রথম স্কোর ~৬০% → ৩৫টি প্রশ্ন, ভুলগুলো আগে
    const rev = await startStep(db, u.id, "L1:EXAM:10");
    const revA = await db.testAttempt.findUniqueOrThrow({ where: { id: rev } });
    check("Revision-এর আকার স্কোর-ব্যান্ড অনুযায়ী (৫০–৬৯% → ৩৫)", revA.questionIds.length === 35, revA.questionIds.length);
    const wrongIds = new Set((await db.questionStat.findMany({ where: { userId: u.id, lastCorrect: false } })).map((s) => s.questionId));
    const wrongInRev = revA.questionIds.filter((q) => wrongIds.has(q)).length;
    check("Revision-এ ভুল প্রশ্ন অগ্রাধিকার পায়", wrongInRev >= Math.min(35, wrongIds.size) - 2, { wrongInRev, wrong: wrongIds.size });
    await answer(u.id, rev, 0.5);
    await submitAttempt(db, u.id, rev);
    check("Revision শেষে Mastery-ধাপ", (await state(u.id, "L1:EXAM:10"))?.step === "MASTERY");

    // ── Mastery: ৭০% → ব্যর্থ
    const m1 = await startStep(db, u.id, "L1:EXAM:10");
    check("Mastery Test-এ ৪০টি প্রশ্ন ও Threshold ৮০", (await db.testAttempt.findUniqueOrThrow({ where: { id: m1 } })).questionIds.length === 40);
    await answer(u.id, m1, 0.7);
    const mr1 = await submitAttempt(db, u.id, m1);
    const s1 = await state(u.id, "L1:EXAM:10");
    check("৭০% → ব্যর্থ, Mastery-ধাপেই থাকে, স্কোর সংরক্ষিত", mr1.passed === false && s1?.step === "MASTERY" && Math.round(s1.lastScore ?? 0) === 70, s1);
    check("ব্যর্থ হলে ১১তম খোলে না", (await state(u.id, "L1:EXAM:11")) === null);

    // ── অনুশীলন (ধাপ বদলায় না)
    const pr = await startStep(db, u.id, "L1:EXAM:10", "practice");
    await answer(u.id, pr, 1);
    await submitAttempt(db, u.id, pr);
    check("অনুশীলনে ধাপ বদলায় না", (await state(u.id, "L1:EXAM:10"))?.step === "MASTERY");

    // ── Mastery আবার: ১০০% → ১০ম সম্পন্ন (১০ম-এ Cumulative নেই), ১১তম খোলে
    const m2 = await startStep(db, u.id, "L1:EXAM:10");
    await answer(u.id, m2, 1);
    const mr2 = await submitAttempt(db, u.id, m2);
    check("১০০% → ১০ম BCS সম্পন্ন", mr2.passed === true && mr2.completed && (await state(u.id, "L1:EXAM:10"))?.state === "COMPLETED");
    check("১১তম BCS খুলেছে", (await state(u.id, "L1:EXAM:11"))?.state === "AVAILABLE");
    check("সম্পন্ন ধাপ আবার শুরু করা যায় না (অনুশীলন ছাড়া)", (await code(() => startStep(db, u.id, "L1:EXAM:10"))) === "SUBMITTED");
    check("অর্জন: প্রথম পদক্ষেপ", !!(await db.userAchievement.findFirst({ where: { userId: u.id, achievementKey: "first_exam" } })));

    // ── ১১তম: সব সঠিক, Mastery পাসের পর Cumulative
    let id = await startStep(db, u.id, "L1:EXAM:11");
    while ((await state(u.id, "L1:EXAM:11"))?.step === "SOLVE") {
      await answer(u.id, id, 1);
      await submitAttempt(db, u.id, id);
      if ((await state(u.id, "L1:EXAM:11"))?.step === "SOLVE") id = await startStep(db, u.id, "L1:EXAM:11");
    }
    await acknowledgeReview(db, u.id, "L1:EXAM:11");
    id = await startStep(db, u.id, "L1:EXAM:11");
    check("প্রথমবার ১০০% হলে Revision-এ ১৫টি প্রশ্ন", (await db.testAttempt.findUniqueOrThrow({ where: { id } })).questionIds.length === 15);
    await answer(u.id, id, 1); await submitAttempt(db, u.id, id);
    id = await startStep(db, u.id, "L1:EXAM:11");
    await answer(u.id, id, 1); await submitAttempt(db, u.id, id);
    check("১১তম-এ Mastery পাসের পর Cumulative-ধাপ (সম্পন্ন নয়)", (await state(u.id, "L1:EXAM:11"))?.step === "CUMULATIVE" && (await state(u.id, "L1:EXAM:12")) === null);

    const c1 = await startStep(db, u.id, "L1:EXAM:11");
    const cA = await db.testAttempt.findUniqueOrThrow({ where: { id: c1 } });
    const cEx = await db.question.findMany({ where: { id: { in: cA.questionIds } }, select: { exam: { select: { bcsNo: true } } } });
    const n10 = cEx.filter((q) => q.exam?.bcsNo === 10).length;
    check("Cumulative: ২০+৫ = ২৫টি প্রশ্ন, ১০ম ও ১১তম দুটো থেকেই অন্তত ২টি", cA.questionIds.length === 25 && n10 >= 2 && cEx.length - n10 >= 2, { len: cA.questionIds.length, n10 });
    await answer(u.id, c1, 0.5);
    check("Cumulative ৫০% → ব্যর্থ", (await submitAttempt(db, u.id, c1)).passed === false && (await state(u.id, "L1:EXAM:12")) === null);
    const c2 = await startStep(db, u.id, "L1:EXAM:11");
    await answer(u.id, c2, 0.8);
    const cr2 = await submitAttempt(db, u.id, c2);
    check("Cumulative ঠিক ৮০% → পাস, ১২তম খোলে", cr2.passed === true && (await state(u.id, "L1:EXAM:12"))?.state === "AVAILABLE");

    // ── Spaced Repetition-এর বাক্স
    const wrongStat = await db.questionStat.findFirst({ where: { userId: u.id, lastCorrect: false } });
    check("ভুল প্রশ্ন বাক্স ১-এ, আগামীকাল আবার", wrongStat?.leitnerBox === 1 && !!wrongStat.dueAt && wrongStat.dueAt.getTime() > Date.now() + 20 * 3600e3);
    const unsureAtt = await startStep(db, u.id, "L1:EXAM:10", "practice");
    await answer(u.id, unsureAtt, 1, true);
    await submitAttempt(db, u.id, unsureAtt);
    const uq = (await db.testAttempt.findUniqueOrThrow({ where: { id: unsureAtt } })).questionIds[0];
    const us = await db.questionStat.findUniqueOrThrow({ where: { userId_questionId: { userId: u.id, questionId: uq } } });
    check("কম আত্মবিশ্বাসে সঠিক → Revision-সারিতে থাকে", us.leitnerBox >= 1 && us.lowConfCorrect >= 1);

    // ── অপশনের ক্রম: "সবগুলো" ধরনের অপশন থাকলে বদলায় না
    const rndAlways = () => 0.01; // সবসময় অদলবদল করতে চায় এমন এলোমেলো-উৎস
    check("ফাংশন: \"উপরের সবগুলো\" থাকলে ক্রম অপরিবর্তিত", optionPerm(["ক", "খ", "গ", "উপরের সবগুলো"], true, rndAlways).join() === "0,1,2,3");
    check("ফাংশন: সাধারণ অপশনে ক্রম বদলায়", optionPerm(["ঢাকা", "খুলনা", "রাজশাহী", "সিলেট"], true, rndAlways).join() !== "0,1,2,3");
    check("ফাংশন: ১০০টি প্রশ্ন ৫০+৫০, ১০২টি ৩৪+৩৪+৩৪", splitParts([...Array(100).keys()], 50).map((p) => p.length).join() === "50,50" && splitParts([...Array(102).keys()], 50).map((p) => p.length).join() === "34,34,34");
    const fixedQ = (await db.question.findMany({ where: { status: "PUBLISHED", exam: { bcsNo: { in: [10, 11] } } } })).find((q) => q.options.some((o) => ["উপরের সবগুলো", "সবগুলো", "কোনটিই নয়"].includes(o)));
    if (fixedQ) {
      const perms = (await db.testAttempt.findMany({ where: { userId: u.id } })).filter((a) => a.questionIds.includes(fixedQ.id)).map((a) => (a.optionPerms as Record<string, number[]>)[fixedQ.id]);
      check("\"সবগুলো/কোনটিই নয়\" অপশনের ক্রম অপরিবর্তিত", perms.length > 0 && perms.every((p) => p.join() === "0,1,2,3"), perms);
    } else console.log("SKIP  (১০ম–১১তম-এ \"সবগুলো\" অপশনের প্রশ্ন নেই)");

    // ── Level 1 Final (অ্যাডমিনের হাতে খুলে পরীক্ষা)
    await manualUnlock(db, u.id, (await db.learningTask.findUniqueOrThrow({ where: { key: "L1:FINAL" } })).id, admin.id);
    const f = await startStep(db, u.id, "L1:FINAL");
    const fA = await db.testAttempt.findUniqueOrThrow({ where: { id: f } });
    const fEx = new Set((await db.question.findMany({ where: { id: { in: fA.questionIds } }, select: { exam: { select: { bcsNo: true } } } })).map((q) => q.exam?.bcsNo));
    check("Final: ১০০টি প্রশ্ন, প্রায় সব BCS থেকে", fA.questionIds.length === 100 && fEx.size >= 35, { n: fA.questionIds.length, exams: fEx.size });
    await answer(u.id, f, 0.9);
    const fr = await submitAttempt(db, u.id, f);
    const phaseA = await db.studentTaskProgress.count({ where: { userId: u.id, state: "AVAILABLE", task: { kind: "L2_SUBTOPIC", phase: 1 } } });
    check("Final ৯০% → Level 1 সম্পন্ন, Priority A খোলে", fr.passed === true && phaseA === 36, { phaseA });
    check("Mastery রেকর্ড সংরক্ষিত", (await db.masteryRecord.count({ where: { userId: u.id } })) >= 5);
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: admin.id } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
