/**
 * Level 2 ইঞ্জিন, Smart Revision ও প্রশ্ন-Import-এর স্বয়ংক্রিয় পরীক্ষা।
 * অস্থায়ী প্রশ্ন (Import দিয়ে) ও অস্থায়ী পরীক্ষার্থী তৈরি হয়; শেষে সব মুছে ফেলা হয়।
 *   npm run test:level2
 */
import { PrismaClient } from "@prisma/client";
import { manualUnlock } from "../src/lib/progress/engine";
import { importQuestions, parseCsv } from "../src/lib/questions/import";
import { ExamError, acknowledgeReview, dhakaDayStart, revisionStatus, saveAnswer, startMistakePractice, startRevision, startStep, submitAttempt } from "../src/lib/exam/service";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
const code = async (fn: () => Promise<unknown>) => {
  try { await fn(); return "OK"; } catch (e) { return e instanceof ExamError ? e.code : String(e); }
};
const ALPHA = "অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ";
const word = (n: number) => Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

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
const state = (u: string, key: string) => db.studentTaskProgress.findFirst({ where: { userId: u, task: { key } } });

async function main() {
  const tag = `l2t${Date.now()}`;
  const batches: number[] = [];
  const u = await db.user.create({ data: { email: `${tag}@exam.test`, passwordHash: "x" } });
  const admin = await db.user.create({ data: { email: `${tag}-a@exam.test`, passwordHash: "x", role: "ADMIN" } });
  try {
    // ── দুটি Priority A উপবিষয়, ভিন্ন বিষয় থেকে
    const phaseA = await db.learningTask.findMany({ where: { kind: "L2_SUBTOPIC", phase: 1 }, include: { subtopic: { include: { topic: true } } }, orderBy: { order: "asc" } });
    const subA = phaseA[0];
    const subB = phaseA.find((t) => t.subtopic!.topic.subjectId !== subA.subtopic!.topic.subjectId)!;
    const codeA = subA.subtopic!.code, codeB = subB.subtopic!.code;

    // ── Import
    const mk = (codeX: string) => ({ subtopic_code: codeX, question: `${word(6)} ${word(8)} ${word(5)} কোনটি?`, option_a: word(5), option_b: word(5), option_c: word(5), option_d: word(5), answer: "খ", explanation: word(20) });
    const rows: Record<string, unknown>[] = [...Array(30)].map(() => mk(codeA)).concat([...Array(30)].map(() => mk(codeB)));
    const first = rows[0] as Record<string, string>;
    const h1 = await db.question.findUniqueOrThrow({ where: { uid: "H-10-1" } });
    rows.push(
      { ...first, option_a: first.option_d, option_d: first.option_a, answer: "খ" }, // ৬১: অপশনের ক্রম বদলে হুবহু একই → বাদ
      { ...first, question: first.question.replace("কোনটি?", "কোনটি ?") + "ক" }, // ৬২: প্রায়-একই → খসড়া
      { subtopic_code: codeA, question: "তিন অপশন", option_a: "১", option_b: "২", option_c: "৩", answer: "ক" }, // ৬৩: ত্রুটি
      { ...mk("XX.YY.ZZZ") }, // ৬৪: অজানা কোড
      { ...mk(codeA), answer: "চ" }, // ৬৫: উত্তর বোঝা যায় না
      { subtopic_code: codeA, question: h1.text, options: h1.options, answer: "ক" }, // ৬৬: ঐতিহাসিক প্রশ্নের হুবহু কপি → বাদ
    );
    const textAns = mk(codeB);
    rows.push({ ...textAns, answer: textAns.option_c }); // ৬৭: উত্তর অপশনের লেখায় → গ্রহণযোগ্য

    const dry = await importQuestions(db, rows, { source: tag, format: "json", status: "PUBLISHED", dryRun: true });
    check("Dry-run: কিছু লেখে না", dry.inserted === 62 && (await db.importBatch.count({ where: { source: tag } })) === 0, dry);
    const rep = await importQuestions(db, rows, { source: tag, format: "json", status: "PUBLISHED" });
    batches.push(rep.batchId!);
    check("Import: ৬২টি যোগ (৬০ + প্রায়-একই + লেখায় উত্তর)", rep.inserted === 62, rep.inserted);
    check("Import: হুবহু পুনরাবৃত্তি (অপশন-ক্রম বদলানো ও ঐতিহাসিক কপি) বাদ", rep.duplicates.length === 2 && rep.duplicates.some((d) => d.matches === "H-10-1"), rep.duplicates);
    check("Import: প্রায়-একই প্রশ্ন খসড়া হিসেবে চিহ্নিত", rep.nearDuplicates.length === 1 && rep.nearDuplicates[0].row === 63, rep.nearDuplicates);
    const nearQ = await db.question.findUnique({ where: { uid: rep.nearDuplicates[0]?.uid ?? "" } });
    check("প্রায়-একই প্রশ্ন DRAFT, টীকাসহ", nearQ?.status === "DRAFT" && !!nearQ.verifyNote?.includes("প্রায়-একই"));
    check("Import: ৩টি ত্রুটিপূর্ণ সারি সারি-নম্বরসহ", rep.errors.length === 3 && rep.errors.map((e) => e.row).join() === "64,65,66", rep.errors);
    const ta = await db.question.findFirst({ where: { importBatchId: rep.batchId, text: textAns.question } });
    check("উত্তর অপশনের লেখা দিয়ে দিলেও ঠিক সূচক", ta?.correctIndex === 2);
    const again = await importQuestions(db, rows.slice(0, 5), { source: tag, format: "json", dryRun: true });
    check("একই ফাইল আবার Import করলে সব বাদ", again.duplicates.length === 5 && again.inserted === 0);
    const csv = parseCsv('subtopic_code,question,option_a,option_b,option_c,option_d,answer\nBN.BH.SHD,"কমা, ও ""উদ্ধৃতি""\nনতুন লাইন",ক,খ,গ,ঘ,ক\n');
    check("CSV: উদ্ধৃতির ভেতরে কমা, উদ্ধৃতিচিহ্ন ও নতুন লাইন", csv.length === 1 && csv[0].question === 'কমা, ও "উদ্ধৃতি"\nনতুন লাইন');

    // ── Revision-বাধা: আজকের Revision বাকি থাকলে নতুন উপবিষয় নয়
    await manualUnlock(db, u.id, subA.id, admin.id);
    const hist = await db.question.findMany({ where: { kind: "HISTORICAL", status: "PUBLISHED" }, take: 70, select: { id: true } });
    const past = new Date(Date.now() - 3600e3);
    await db.questionStat.createMany({ data: hist.map((h) => ({ userId: u.id, questionId: h.id, seen: 1, wrong: 1, lastCorrect: false, leitnerBox: 1, dueAt: past, lastSeenAt: past })) });
    const rs0 = await revisionStatus(db, u.id);
    check("দৈনিক সীমা: ৭০টি বাকি থাকলেও আজ ৬০টি", rs0.dueNow === 70 && rs0.remaining === 60 && rs0.blocked, rs0);
    check("Revision বাকি থাকলে নতুন উপবিষয় শুরু করা যায় না", (await code(() => startStep(db, u.id, `L2:SUB:${codeA}`))) === "BLOCKED");

    for (let s = 0; s < 3; s++) {
      const r = await startRevision(db, u.id);
      const ra = await db.testAttempt.findUniqueOrThrow({ where: { id: r } });
      if (s === 0) check("Revision-সেটে ২০টি প্রশ্ন, সব সময়-হওয়া সারি থেকে", ra.questionIds.length === 20 && ra.questionIds.every((q) => hist.some((h) => h.id === q)));
      await answer(u.id, r, 1);
      await submitAttempt(db, u.id, r);
    }
    const rs1 = await revisionStatus(db, u.id);
    check("৬০টি শেষে আজকের কাজ শেষ, ১০টি আগামীকালের জন্য", rs1.doneToday === 60 && rs1.remaining === 0 && rs1.dueNow === 10 && !rs1.blocked, rs1);
    check("সীমা পূর্ণ হলে আর Revision-সেট নয়", (await code(() => startRevision(db, u.id))) === "EMPTY");
    const boxed = await db.questionStat.findFirst({ where: { userId: u.id, leitnerBox: 2 } });
    check("সঠিক উত্তরে পরের বাক্স (২), ৩ দিন পর", !!boxed && Math.abs(boxed.dueAt!.getTime() - Date.now() - 3 * 864e5) < 3600e3);
    check("দিনের Revision রেকর্ড", (await db.revisionSession.findFirst({ where: { userId: u.id } }))?.doneCount === 60);

    // ── Level 2 উপবিষয়ের Cycle
    const s1 = await startStep(db, u.id, `L2:SUB:${codeA}`);
    const s1a = await db.testAttempt.findUniqueOrThrow({ where: { id: s1 } });
    check("প্রথম সমাধান: ৩০টি প্রশ্ন ২৫-এর ভাগে → ১৫+১৫ (খসড়া বাদ)", s1a.questionIds.length === 15, s1a.questionIds.length);
    await answer(u.id, s1, 0.6); await submitAttempt(db, u.id, s1);
    const s2 = await startStep(db, u.id, `L2:SUB:${codeA}`);
    await answer(u.id, s2, 0.6); await submitAttempt(db, u.id, s2);
    check("সব ভাগ শেষে পর্যালোচনা-ধাপ", (await state(u.id, `L2:SUB:${codeA}`))?.step === "REVIEW");
    await acknowledgeReview(db, u.id, `L2:SUB:${codeA}`);
    const rv = await startStep(db, u.id, `L2:SUB:${codeA}`);
    const rva = await db.testAttempt.findUniqueOrThrow({ where: { id: rv } });
    check("উপবিষয়ের Revision: ভুলের সংখ্যা (১২), ন্যূনতম ১০ ও সর্বোচ্চ ২৫-এর মধ্যে", rva.questionIds.length === 12, rva.questionIds.length);
    await answer(u.id, rv, 1); await submitAttempt(db, u.id, rv);
    const m1 = await startStep(db, u.id, `L2:SUB:${codeA}`);
    check("Mastery Test-এ ২০টি প্রশ্ন", (await db.testAttempt.findUniqueOrThrow({ where: { id: m1 } })).questionIds.length === 20);
    await answer(u.id, m1, 0.5);
    check("৫০% → ব্যর্থ, উপবিষয় খোলা থাকে", (await submitAttempt(db, u.id, m1)).passed === false && (await state(u.id, `L2:SUB:${codeA}`))?.state !== "COMPLETED");
    const m2 = await startStep(db, u.id, `L2:SUB:${codeA}`);
    await answer(u.id, m2, 0.85);
    const mr = await submitAttempt(db, u.id, m2);
    check("৮৫% → উপবিষয় সম্পন্ন (Level 2-এ Cumulative নেই)", mr.passed === true && mr.completed && (await state(u.id, `L2:SUB:${codeA}`))?.state === "COMPLETED");
    check("উপবিষয়ের Mastery রেকর্ড", !!(await db.masteryRecord.findFirst({ where: { userId: u.id, scope: "SUBTOPIC", scopeRef: codeA } })));

    // ── ভুলের অনুশীলন
    const mp = await startMistakePractice(db, u.id);
    const mpa = await db.testAttempt.findUniqueOrThrow({ where: { id: mp } });
    const mpStats = await db.questionStat.findMany({ where: { userId: u.id, questionId: { in: mpa.questionIds } } });
    check("ভুলের অনুশীলনে শুধু শেষবার ভুল প্রশ্ন", mpa.questionIds.length > 0 && mpStats.every((s) => s.lastCorrect === false));

    // ── প্রশ্ন নেই এমন উপবিষয়
    const empty = phaseA.find((t) => ![codeA, codeB].includes(t.subtopic!.code))!;
    await manualUnlock(db, u.id, empty.id, admin.id);
    check("প্রশ্ন প্রকাশিত হয়নি এমন উপবিষয়: পরিষ্কার বার্তা", (await code(() => startStep(db, u.id, empty.key))) === "EMPTY");

    // ── Checkpoint
    await manualUnlock(db, u.id, (await db.learningTask.findUniqueOrThrow({ where: { key: "L2:CHECKPOINT:A" } })).id, admin.id);
    const cp = await startStep(db, u.id, "L2:CHECKPOINT:A");
    const cpa = await db.testAttempt.findUniqueOrThrow({ where: { id: cp } });
    const cpSubs = new Set((await db.question.findMany({ where: { id: { in: cpa.questionIds } }, select: { subtopic: { select: { code: true } } } })).map((q) => q.subtopic.code));
    check("Checkpoint: Priority A-র প্রশ্ন, দুটো উপবিষয় থেকেই, থ্রেশহোল্ড ৮০", cpa.kind === "CHECKPOINT" && cpSubs.has(codeA) && cpSubs.has(codeB) && cpa.threshold === 80, { n: cpa.questionIds.length, subs: [...cpSubs] });
    await answer(u.id, cp, 0.9);
    await submitAttempt(db, u.id, cp);
    const openB = await db.studentTaskProgress.count({ where: { userId: u.id, state: "AVAILABLE", task: { kind: "L2_SUBTOPIC", phase: 2 } } });
    check("Checkpoint পাস → Priority B খোলে ও অর্জন", openB === 51 && !!(await db.userAchievement.findFirst({ where: { userId: u.id, achievementKey: "phase_a" } })), openB);

    // ── সময়
    check("বাংলাদেশ সময়ে দিনের শুরু", dhakaDayStart(new Date("2026-11-10T20:00:00Z")).toISOString() === "2026-11-10T18:00:00.000Z");
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: admin.id } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.question.deleteMany({ where: { importBatchId: { in: batches } } });
    await db.importBatch.deleteMany({ where: { source: tag } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
