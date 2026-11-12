/**
 * পূর্ণ যাত্রার স্বয়ংক্রিয় পরীক্ষা: ধাপ ০ (প্রশ্ন-বিশ্লেষণের "পড়েছি", শুরুর মূল্যায়ন), বারবার আসা প্রশ্নের ধাপে ধাপে খোলা,
 * Repeat Mastery, সাম্প্রতিক বিষয়াবলির শর্ত (Level 3-এর আগে), পুরোনো শিক্ষার্থীর অগ্রগতি অক্ষত থাকা।
 * অস্থায়ী পরীক্ষার্থী দিয়ে; শেষে মুছে ফেলা হয়।   npm run test:journey
 */
import { PrismaClient } from "@prisma/client";
import { completeTask, ensureStarted } from "../src/lib/progress/engine";
import { ExamError, poolRepeat, saveAnswer, startStep, submitAttempt } from "../src/lib/exam/service";
import { ORIENT_ITEMS, caGateStatus, evaluateCaGate, openRepeatFamilies, orientationStatus, setOrientItem } from "../src/lib/progress/journey";
import { answerQuestion } from "../src/lib/current-affairs/service";
import { loadRules } from "../src/lib/rules";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const code = async (fn: () => Promise<unknown>) => {
  try { await fn(); return "OK"; } catch (e) { return e instanceof ExamError ? e.code : String(e); }
};

/** প্রথম `rightShare` অংশ সঠিক, বাকি ভুল। */
async function answer(userId: string, attemptId: string, rightShare: number) {
  const a = await db.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const qs = new Map((await db.question.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, correctIndex: true } })).map((q) => [q.id, q.correctIndex!]));
  const perms = a.optionPerms as Record<string, number[]>;
  const nRight = Math.round(a.questionIds.length * rightShare);
  for (const [i, qid] of a.questionIds.entries()) {
    const right = perms[qid].indexOf(qs.get(qid)!);
    await saveAnswer(db, userId, attemptId, qid, i < nRight ? right : (right + 1) % 4, false, false);
  }
}

async function main() {
  const tag = `jt${Date.now()}`;
  const mk = (n: string) => db.user.create({ data: { email: `${tag}-${n}@journey.test`, passwordHash: "x", profile: { create: { name: n } } } });
  const u = await mk("u");
  const legacy = await mk("legacy");
  const late = await mk("late");
  const T = async (key: string) => (await db.learningTask.findUniqueOrThrow({ where: { key } })).id;
  const state = async (uid: string, key: string) =>
    (await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId: uid, taskId: await T(key) } } }))?.state ?? "LOCKED";
  const rules = await loadRules(db);

  try {
    // ── ধাপ ০: প্রশ্ন-বিশ্লেষণ
    await ensureStarted(db, u.id);
    check("নতুন শিক্ষার্থী: শুধু প্রশ্ন-বিশ্লেষণ খোলা", (await state(u.id, "L0:ORIENT")) === "AVAILABLE" && (await state(u.id, "L1:EXAM:10")) === "LOCKED" && (await state(u.id, "CA:GATE")) === "LOCKED");
    check("ধাপ ০ শেষ না হলে মূল্যায়ন শুরু করা যায় না", (await code(() => startStep(db, u.id, "L0:DIAGNOSTIC"))) === "LOCKED");
    let threw = false;
    try { await setOrientItem(db, u.id, "nonsense", true); } catch { threw = true; }
    check("অজানা অংশে চিহ্ন দেওয়া যায় না", threw);
    for (const it of ORIENT_ITEMS.slice(0, -1)) await setOrientItem(db, u.id, it.id, true);
    await setOrientItem(db, u.id, ORIENT_ITEMS[0].id, true); // দুবার দিলেও একটিই
    check("৪টি অংশ পড়া হলে ধাপ ০ অসম্পূর্ণ", (await orientationStatus(db, u.id)).checked.length === 4 && (await state(u.id, "L0:ORIENT")) === "AVAILABLE");
    await setOrientItem(db, u.id, ORIENT_ITEMS[1].id, false);
    check("চিহ্ন তুলে নেওয়া যায়", (await orientationStatus(db, u.id)).checked.length === 3);
    await setOrientItem(db, u.id, ORIENT_ITEMS[1].id, true);
    const doneNow = await setOrientItem(db, u.id, ORIENT_ITEMS.at(-1)!.id, true);
    check("৫টি অংশ পড়া → প্রশ্ন-বিশ্লেষণ সম্পন্ন", doneNow && (await state(u.id, "L0:ORIENT")) === "COMPLETED");
    check("→ শুরুর মূল্যায়ন ও সাম্প্রতিক বিষয়াবলি খোলে, ১০ম BCS এখনও তালাবন্ধ", (await state(u.id, "L0:DIAGNOSTIC")) === "AVAILABLE" && (await state(u.id, "CA:GATE")) === "AVAILABLE" && (await state(u.id, "L1:EXAM:10")) === "LOCKED");

    // ── শুরুর মূল্যায়ন
    const d1 = await startStep(db, u.id, "L0:DIAGNOSTIC");
    const da = await db.testAttempt.findUniqueOrThrow({ where: { id: d1 } });
    const size = rules.get<number>("l0.diagnostic.size");
    const dq = await db.question.findMany({ where: { id: { in: da.questionIds } }, select: { exam: { select: { bcsNo: true, type: true } }, subtopic: { select: { topic: { select: { subject: { select: { code: true } } } } } } } });
    check(`মূল্যায়ন: ${size}টি প্রশ্ন, সময়সীমাসহ`, da.questionIds.length === size && da.kind === "DIAGNOSTIC" && !!da.deadlineAt && da.threshold == null, { n: da.questionIds.length });
    check("মূল্যায়নের প্রশ্ন ৩৫তম থেকে, বিশেষ BCS বাদ", dq.every((q) => (q.exam?.bcsNo ?? 0) >= 35 && q.exam?.type !== "SPECIAL"));
    check("মূল্যায়নে একাধিক বিষয় (মানবণ্টন অনুযায়ী)", new Set(dq.map((q) => q.subtopic.topic.subject.code)).size >= 6);
    check("আবার শুরু করলে একই অসমাপ্ত মূল্যায়ন", (await startStep(db, u.id, "L0:DIAGNOSTIC")) === d1);
    await answer(u.id, d1, 0.3);
    const dr = await submitAttempt(db, u.id, d1);
    check("কম নম্বরেও (৩০%) মূল্যায়ন সম্পন্ন → ১০ম BCS খোলে", dr.completed && dr.passed === null && (await state(u.id, "L1:EXAM:10")) === "AVAILABLE");
    check("মূল্যায়ন দ্বিতীয়বার দেওয়া যায় না", (await code(() => startStep(db, u.id, "L0:DIAGNOSTIC"))) === "SUBMITTED");
    check("অনুশীলন-মোডেও মূল্যায়ন আবার নয়", (await code(() => startStep(db, u.id, "L0:DIAGNOSTIC", "practice"))) === "SUBMITTED");
    const p0 = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId: u.id, taskId: await T("L0:DIAGNOSTIC") } } });
    check("মূল্যায়নের স্কোর সংরক্ষিত (প্রতিবেদনে তুলনার জন্য)", Math.round(p0?.bestScore ?? -1) === 30, p0?.bestScore);

    // ── বারবার আসা প্রশ্ন: ধাপে ধাপে খোলা
    const r0 = await openRepeatFamilies(db, u.id);
    check("শুরুতে কোনো পুনরাবৃত্ত প্রশ্ন খোলা নয়", r0.open?.size === 0);
    const l1 = await db.learningTask.findMany({ where: { kind: "L1_EXAM" }, orderBy: { order: "asc" }, include: { exam: true } });
    for (const t of l1.slice(0, 20)) await completeTask(db, u.id, t.id);
    const r20 = await openRepeatFamilies(db, u.id);
    const fams = await db.repeatFamily.findMany({ where: { id: { in: [...(r20.open ?? [])] } }, select: { members: { select: { question: { select: { exam: { select: { bcsNo: true } } } } } } } });
    const done20 = new Set(l1.slice(0, 20).map((t) => t.exam!.bcsNo));
    check("২০টি BCS শেষে: শুধু সেগুলোর পুনরাবৃত্ত প্রশ্ন খোলা", (r20.open?.size ?? 0) > 0 && fams.every((f) => f.members.every((m) => done20.has(m.question.exam!.bcsNo))), r20.open?.size);
    check("অ্যাডমিনের জন্য সব খোলা", (await openRepeatFamilies(db, u.id, true)).open === null);
    for (const t of l1.slice(20)) await completeTask(db, u.id, t.id);
    check("সব BCS শেষ → Repeat Mastery খোলে, Final তালাবন্ধ", (await state(u.id, "L1:REPEAT")) === "AVAILABLE" && (await state(u.id, "L1:FINAL")) === "LOCKED");
    check("Repeat Mastery খুললে সব পুনরাবৃত্ত প্রশ্ন খোলা", (await openRepeatFamilies(db, u.id)).open === null);

    // ── Repeat Mastery
    const grades = rules.get<string[]>("l1.repeat.grades");
    const pool = await poolRepeat(db, grades);
    const famCount = await db.repeatFamily.count({ where: { grade: { in: grades as ("A" | "B" | "C" | "D")[] } } });
    check(`Repeat Mastery: Priority ${grades.join(",")}-র প্রতিটি পরিবার থেকে একটি (${famCount})`, pool.length === famCount && new Set(pool.map((c) => c.id)).size === pool.length, { pool: pool.length, famCount });
    const rp1 = await startStep(db, u.id, "L1:REPEAT");
    const ra = await db.testAttempt.findUniqueOrThrow({ where: { id: rp1 } });
    check("Repeat Mastery-র Threshold নিয়ম অনুযায়ী", ra.kind === "REPEAT" && ra.threshold === rules.get<number>("l1.threshold.repeat") && ra.questionIds.length === famCount);
    await answer(u.id, rp1, 0.85);
    const rr1 = await submitAttempt(db, u.id, rp1);
    check("৮৫% → পাস নয়, Final তালাবন্ধ", rr1.passed === false && (await state(u.id, "L1:FINAL")) === "LOCKED");
    const pr = await startStep(db, u.id, "L1:REPEAT", "practice");
    const pa = await db.testAttempt.findUniqueOrThrow({ where: { id: pr } });
    check("অনুশীলন: ২০টি পুনরাবৃত্ত প্রশ্ন, ধাপ বদলায় না", pa.kind === "PRACTICE" && pa.questionIds.length === 20);
    const rp2 = await startStep(db, u.id, "L1:REPEAT");
    await answer(u.id, rp2, 1);
    const rr2 = await submitAttempt(db, u.id, rp2);
    check("১০০% → Repeat Mastery সম্পন্ন, Level 1 Final খোলে", rr2.completed && (await state(u.id, "L1:FINAL")) === "AVAILABLE");

    // ── সাম্প্রতিক বিষয়াবলির শর্ত → Level 3
    await completeTask(db, u.id, await T("L1:FINAL"));
    for (const t of await db.learningTask.findMany({ where: { levelId: (await db.learningLevel.findUniqueOrThrow({ where: { no: 2 } })).id }, orderBy: { order: "asc" } })) {
      if ((await state(u.id, (await db.learningTask.findUniqueOrThrow({ where: { id: t.id } })).key)) !== "LOCKED") await completeTask(db, u.id, t.id);
    }
    check("Level 2 শেষ হলেও সাম্প্রতিক বিষয়াবলির শর্ত ছাড়া Model Test ১ তালাবন্ধ", (await state(u.id, "L2:FINAL")) === "COMPLETED" && (await state(u.id, "L3:MT:001")) === "LOCKED");
    const ca = await db.caQuestion.findMany({ where: { active: true }, select: { id: true, bankKey: true, correctIndex: true }, orderBy: [{ bankKey: "asc" }, { no: "asc" }] });
    const banks = [...new Set(ca.map((q) => q.bankKey))];
    const first = ca.filter((q) => q.bankKey === banks[0]);
    for (const q of first) await answerQuestion(db, u.id, q.id, q.correctIndex);
    const st1 = await caGateStatus(db, u.id);
    check(banks.length > 1 ? "একটি প্রশ্নব্যাংক শেষ — শর্ত এখনও অপূর্ণ" : "একমাত্র প্রশ্নব্যাংক শেষ", banks.length > 1 ? !st1.met && st1.banks[0].met && (await state(u.id, "CA:GATE")) === "AVAILABLE" : st1.met);
    const rest = ca.filter((q) => q.bankKey !== banks[0]);
    // ৬০% সঠিক → শর্ত অপূর্ণ
    for (const [i, q] of rest.entries()) await answerQuestion(db, u.id, q.id, i < rest.length * 0.6 ? q.correctIndex : (q.correctIndex + 1) % 4);
    check(`সব প্রশ্ন দেওয়া কিন্তু ৬০% সঠিক → শর্ত অপূর্ণ (${rules.get<number>("ca.gate.min_pct")}% লাগে)`, banks.length < 2 || (!(await caGateStatus(db, u.id)).met && (await state(u.id, "L3:MT:001")) === "LOCKED"));
    for (const q of rest) await answerQuestion(db, u.id, q.id, q.correctIndex); // ভুলগুলো আবার — এবার সঠিক
    check("সব প্রশ্নব্যাংক আয়ত্ত → শর্ত পূরণ, Model Test ১ খোলে", (await state(u.id, "CA:GATE")) === "COMPLETED" && (await state(u.id, "L3:MT:001")) === "AVAILABLE");
    check("শর্ত পূরণের পর আবার যাচাইয়ে কিছু বদলায় না", (await evaluateCaGate(db, u.id)) === true);

    // ── পুরোনো শিক্ষার্থী (ধাপ ০ যোগ হওয়ার আগে শুরু করেছেন)
    await db.studentTaskProgress.createMany({
      data: [
        { userId: legacy.id, taskId: await T("L1:EXAM:10"), state: "COMPLETED", step: "DONE" },
        { userId: legacy.id, taskId: await T("L1:EXAM:11"), state: "IN_PROGRESS", step: "REVISION" },
      ],
    });
    await ensureStarted(db, legacy.id);
    check("পুরোনো শিক্ষার্থী: ধাপ ০ নিজে থেকে সম্পন্ন, সাম্প্রতিক বিষয়াবলি খোলা, অগ্রগতি অক্ষত",
      (await state(legacy.id, "L0:ORIENT")) === "COMPLETED" && (await state(legacy.id, "L0:DIAGNOSTIC")) === "COMPLETED" && (await state(legacy.id, "CA:GATE")) === "AVAILABLE" && (await state(legacy.id, "L1:EXAM:11")) === "IN_PROGRESS");
    await db.studentTaskProgress.createMany({
      data: [
        { userId: late.id, taskId: await T("L1:EXAM:50"), state: "COMPLETED", step: "DONE" },
        { userId: late.id, taskId: await T("L1:FINAL"), state: "AVAILABLE" },
      ],
    });
    await ensureStarted(db, late.id);
    check("যাঁর Level 1 Final আগেই খোলা, তাঁর Repeat Mastery সম্পন্ন ধরা হয় (আটকে যান না)", (await state(late.id, "L1:REPEAT")) === "COMPLETED" && (await state(late.id, "L1:FINAL")) === "AVAILABLE");
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\n${fails}টি পরীক্ষা ব্যর্থ` : "\nসব পরীক্ষা সফল");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
