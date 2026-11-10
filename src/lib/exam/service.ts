/**
 * পরীক্ষা-ইঞ্জিন (Level 1): Attempt তৈরি, উত্তর সংরক্ষণ, গ্রেডিং, Learning Cycle-এর ধাপ বদল, Unlock।
 *
 * নিরাপত্তা:
 *  - প্রতিটি ফাংশন userId নেয় এবং Attempt/কাজের মালিকানা ও প্রবেশাধিকার যাচাই করে।
 *  - জমা দেওয়ার আগে ক্লায়েন্টে সঠিক উত্তর বা ব্যাখ্যা যায় না।
 *  - একই Attempt দুবার জমা দেওয়া যায় না (ডেটাবেস-স্তরে শর্তসাপেক্ষ হালনাগাদ)।
 * এই ফাইল "server-only" নয়, যাতে স্বয়ংক্রিয় পরীক্ষা সরাসরি চালাতে পারে; ডেটাবেস-ক্লায়েন্ট প্যারামিটারে আসে।
 */
import type { AttemptKind, PrismaClient, Prisma } from "@prisma/client";
import { loadRules, type Rules } from "@/lib/rules";
import { OPEN_STATES, completeTask, markStarted } from "@/lib/progress/engine";
import { pickCumulative, pickProportional, rank, optionPerm, revisionSize, shuffleArr, splitParts, type Candidate, type Stat, type Weights } from "./select";

export class ExamError extends Error {
  constructor(public code: "LOCKED" | "NOT_FOUND" | "FORBIDDEN" | "SUBMITTED" | "NEED_REVIEW" | "NOT_READY" | "BAD_INPUT", message: string) {
    super(message);
  }
}

type Db = PrismaClient;
const MASTERY_KINDS: AttemptKind[] = ["MASTERY", "CUMULATIVE", "LEVEL_FINAL"];
const GRACE_MS = 60_000;

const qNoNum = (s: string | null) => parseInt(s ?? "0", 10) || 0;

async function loadTask(db: Db, userId: string, taskKey: string) {
  const task = await db.learningTask.findUnique({ where: { key: taskKey }, include: { exam: true } });
  if (!task) throw new ExamError("NOT_FOUND", "কাজটি পাওয়া যায়নি।");
  const progress = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId: task.id } } });
  if (!progress || !OPEN_STATES.includes(progress.state)) throw new ExamError("LOCKED", "এই ধাপটি Unlock করতে আগের ধাপের নির্ধারিত কাজ সম্পন্ন করুন।");
  return { task, progress };
}

/** Level 1-এর যোগ্য প্রশ্ন (প্রকাশিত + নির্ধারিত যাচাই-শ্রেণি), নির্দিষ্ট পরীক্ষাগুলো থেকে। */
async function pool(db: Db, rules: Rules, examNos: number[]) {
  const rows = await db.question.findMany({
    where: { kind: "HISTORICAL", status: "PUBLISHED", verifyClass: { in: rules.get<string[]>("path.eligible_classes") }, exam: { bcsNo: { in: examNos } } },
    select: { id: true, examQNo: true, options: true, exam: { select: { bcsNo: true } }, subtopic: { select: { priorityGrade: true } } },
  });
  return rows.map((r) => ({ id: r.id, examNo: r.exam!.bcsNo, qNo: qNoNum(r.examQNo), grade: r.subtopic.priorityGrade as string | null, options: r.options }));
}

async function statsFor(db: Db, userId: string, ids: string[]): Promise<Map<string, Stat>> {
  const rows = await db.questionStat.findMany({ where: { userId, questionId: { in: ids } } });
  return new Map(rows.map((r) => [r.questionId, { wrong: r.wrong, lastCorrect: r.lastCorrect, lowConfCorrect: r.lowConfCorrect, marked: r.marked, lastSeenAt: r.lastSeenAt }]));
}

/** প্রথম সমাধানের সম্মিলিত স্কোর (সব ভাগ মিলিয়ে)। */
export async function firstSolveScore(db: Db, userId: string, taskId: number): Promise<number | null> {
  const a = await db.testAttempt.findMany({ where: { userId, taskId, kind: "SOLVE", submittedAt: { not: null } }, select: { correct: true, questionIds: true } });
  const total = a.reduce((s, x) => s + x.questionIds.length, 0);
  return total ? (a.reduce((s, x) => s + (x.correct ?? 0), 0) / total) * 100 : null;
}

export async function solvePlan(db: Db, userId: string, taskId: number, bcsNo: number, rules: Rules) {
  const qs = (await pool(db, rules, [bcsNo])).sort((a, b) => a.qNo - b.qNo);
  const parts = splitParts(qs, rules.get<number>("l1.solve.part_size"));
  const attempts = await db.testAttempt.findMany({ where: { userId, taskId, kind: "SOLVE" }, select: { id: true, partNo: true, submittedAt: true, scorePct: true } });
  return parts.map((p, i) => {
    const a = attempts.filter((x) => x.partNo === i + 1);
    const done = a.find((x) => x.submittedAt);
    const open = a.find((x) => !x.submittedAt);
    return { partNo: i + 1, size: p.length, from: p[0]?.qNo, to: p.at(-1)?.qNo, questionIds: p.map((q) => q.id), doneAttemptId: done?.id ?? null, openAttemptId: open?.id ?? null, scorePct: done?.scorePct ?? null };
  });
}

/**
 * বর্তমান ধাপের পরীক্ষা শুরু (অথবা অসমাপ্ত থাকলে সেটিই ফেরত)।
 * mode "practice": ধাপ না বদলিয়ে ভুল/অনিশ্চিত প্রশ্নের অতিরিক্ত অনুশীলন।
 */
export async function startStep(db: Db, userId: string, taskKey: string, mode: "step" | "practice" = "step"): Promise<string> {
  const { task, progress } = await loadTask(db, userId, taskKey);
  if (task.kind !== "L1_EXAM" && task.kind !== "L1_FINAL") throw new ExamError("NOT_READY", "এই ধাপের পরীক্ষা পরের Phase-এ যুক্ত হবে।");
  const rules = await loadRules(db);
  const w = rules.get<Weights>("select.weights");
  const now = new Date();
  const rnd = Math.random;
  const shuffle = rules.get<boolean>("shuffle.options");
  const bcsNo = task.exam?.bcsNo ?? 50;

  let kind: AttemptKind;
  let questionIds: string[] = [];
  let partNo = 1;
  let threshold: number | null = null;
  let keepOrder = false;

  if (mode === "practice") {
    kind = "PRACTICE";
  } else if (progress.state === "COMPLETED") {
    throw new ExamError("SUBMITTED", "এই ধাপ আগেই সম্পন্ন। চাইলে অনুশীলন করতে পারো।");
  } else if (task.kind === "L1_FINAL") {
    kind = "LEVEL_FINAL";
  } else {
    const step = progress.step;
    if (step === "REVIEW") throw new ExamError("NEED_REVIEW", "আগে প্রথম সমাধানের উত্তর পর্যালোচনা শেষ করো।");
    kind = step === "SOLVE" ? "SOLVE" : step === "REVISION" ? "REVISION" : step === "MASTERY" ? "MASTERY" : "CUMULATIVE";
  }

  // অসমাপ্ত Attempt থাকলে সেটিই চালিয়ে যাওয়া
  if (kind !== "SOLVE") {
    const open = await db.testAttempt.findFirst({ where: { userId, taskId: task.id, kind, submittedAt: null }, orderBy: { startedAt: "desc" } });
    if (open) return open.id;
  }

  if (kind === "SOLVE") {
    const plan = await solvePlan(db, userId, task.id, bcsNo, rules);
    const next = plan.find((p) => !p.doneAttemptId);
    if (!next) throw new ExamError("NEED_REVIEW", "সব ভাগ সমাধান হয়েছে। এখন পর্যালোচনা করো।");
    if (next.openAttemptId) return next.openAttemptId;
    partNo = next.partNo;
    questionIds = next.questionIds;
    keepOrder = true; // মূল প্রশ্নপত্রের ক্রম ও অপশন অপরিবর্তিত
  } else {
    const examNos = kind === "LEVEL_FINAL" || kind === "CUMULATIVE"
      ? (await db.exam.findMany({ where: kind === "CUMULATIVE" ? { bcsNo: { lte: bcsNo } } : {}, select: { bcsNo: true } })).map((e) => e.bcsNo)
      : [bcsNo];
    const cands = await pool(db, rules, examNos);
    const stats = await statsFor(db, userId, cands.map((c) => c.id));
    const ranked = rank(cands as Candidate[], stats, w, now, rnd);

    if (kind === "REVISION") {
      const first = (await firstSolveScore(db, userId, task.id)) ?? 0;
      questionIds = ranked.slice(0, revisionSize(rules.get<Record<string, number>>("l1.revision.bands"), first)).map((c) => c.id);
    } else if (kind === "MASTERY") {
      questionIds = ranked.slice(0, rules.get<number>("l1.mastery.size")).map((c) => c.id);
      threshold = rules.get<number>("l1.threshold.mastery", [`task:${task.key}`, "level:1"]);
    } else if (kind === "CUMULATIVE") {
      const done = examNos.length; // ১০ম থেকে বর্তমান পর্যন্ত পরীক্ষার সংখ্যা
      const size = Math.min(rules.get<number>("l1.cumulative.max"), rules.get<number>("l1.cumulative.base") + rules.get<number>("l1.cumulative.step") * (done - 1));
      questionIds = pickCumulative(ranked, size, rules.get<number>("l1.cumulative.min_per_exam"));
      threshold = rules.get<number>("l1.threshold.cumulative", [`task:${task.key}`, "level:1"]);
    } else if (kind === "LEVEL_FINAL") {
      questionIds = pickProportional(ranked, rules.get<number>("l1.final.size"));
      threshold = rules.get<number>("l1.threshold.final", ["level:1"]);
    } else {
      // PRACTICE: ভুল/অনিশ্চিত প্রশ্ন আগে, ২০টি
      const examScope = task.kind === "L1_FINAL" ? ranked : ranked.filter((c) => c.examNo === bcsNo);
      questionIds = examScope.slice(0, 20).map((c) => c.id);
    }
    questionIds = shuffleArr(questionIds, rnd);
  }
  if (!questionIds.length) throw new ExamError("NOT_READY", "এই ধাপের জন্য কোনো যাচাইকৃত প্রশ্ন পাওয়া যায়নি।");

  const opts = await db.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, options: true } });
  const perms: Record<string, number[]> = {};
  for (const o of opts) perms[o.id] = optionPerm(o.options, shuffle && !keepOrder, rnd);

  await markStarted(db, userId, task.id);
  const a = await db.testAttempt.create({
    data: { userId, taskId: task.id, kind, partNo, questionIds, optionPerms: perms, threshold },
  });
  return a.id;
}

// ─────────────────────────────────────────── পরীক্ষা চলাকালীন

async function ownAttempt(db: Db, userId: string, attemptId: string) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { task: { include: { exam: true } } } });
  if (!a) throw new ExamError("NOT_FOUND", "পরীক্ষাটি পাওয়া যায়নি।");
  if (a.userId !== userId) throw new ExamError("FORBIDDEN", "এই পরীক্ষাটি তোমার নয়।");
  return a;
}

const KIND_TITLE: Record<string, string> = { SOLVE: "প্রশ্ন সমাধান", REVISION: "Revision Test", MASTERY: "Mastery Test", CUMULATIVE: "Cumulative Revision Test", LEVEL_FINAL: "Final Assessment", PRACTICE: "অনুশীলন", CHECKPOINT: "Checkpoint", MODEL_TEST: "Model Test", SRS_REVIEW: "দৈনিক Revision", MISTAKE_PRACTICE: "ভুলের অনুশীলন" };

export function attemptTitle(a: { kind: string; partNo: number; task: { titleBn: string } | null }, parts?: number) {
  const base = a.task?.titleBn ?? "";
  const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
  return `${base}: ${KIND_TITLE[a.kind]}${a.kind === "SOLVE" && parts && parts > 1 ? `, ভাগ ${bn(a.partNo)}/${bn(parts)}` : ""}`;
}

export async function plannedParts(db: Db, bcsNo: number): Promise<number> {
  const rules = await loadRules(db);
  const n = await db.question.count({ where: { kind: "HISTORICAL", status: "PUBLISHED", verifyClass: { in: rules.get<string[]>("path.eligible_classes") }, exam: { bcsNo } } });
  return Math.max(1, Math.ceil(n / rules.get<number>("l1.solve.part_size")));
}

/** পরীক্ষার পর্দার জন্য: প্রশ্ন ও (বিন্যস্ত) অপশন, সংরক্ষিত উত্তর — সঠিক উত্তর ছাড়া। */
export async function getAttemptView(db: Db, userId: string, attemptId: string) {
  const a = await ownAttempt(db, userId, attemptId);
  const perms = a.optionPerms as Record<string, number[]>;
  const [qs, answers] = await Promise.all([
    db.question.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, text: true, options: true } }),
    db.attemptAnswer.findMany({ where: { attemptId } }),
  ]);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ansBy = new Map(answers.map((x) => [x.questionId, x]));
  let parts: number | undefined;
  if (a.kind === "SOLVE" && a.task?.exam) parts = await plannedParts(db, a.task.exam.bcsNo);
  return {
    id: a.id,
    kind: a.kind,
    title: attemptTitle(a, parts),
    submitted: !!a.submittedAt,
    deadlineAt: a.deadlineAt?.toISOString() ?? null,
    threshold: a.threshold,
    taskKey: a.task?.key ?? null,
    questions: a.questionIds.map((qid) => {
      const q = byId.get(qid)!;
      const perm = perms[qid] ?? [0, 1, 2, 3];
      const saved = ansBy.get(qid);
      return {
        qid,
        text: q.text,
        options: perm.map((i) => q.options[i]),
        selected: saved?.selected != null ? perm.indexOf(saved.selected) : null,
        marked: saved?.marked ?? false,
        unsure: saved?.confidence === "UNSURE",
      };
    }),
  };
}

/** একটি উত্তর সংরক্ষণ (প্রতিবার বদলালে)। display = পর্দায় দেখানো অপশনের ক্রম (০–৩)। */
export async function saveAnswer(db: Db, userId: string, attemptId: string, qid: string, display: number | null, marked: boolean, unsure: boolean) {
  const a = await ownAttempt(db, userId, attemptId);
  if (a.submittedAt) throw new ExamError("SUBMITTED", "পরীক্ষাটি আগেই জমা হয়েছে।");
  if (a.deadlineAt && Date.now() > a.deadlineAt.getTime() + GRACE_MS) throw new ExamError("SUBMITTED", "সময় শেষ।");
  if (!a.questionIds.includes(qid)) throw new ExamError("BAD_INPUT", "প্রশ্নটি এই পরীক্ষার নয়।");
  if (display != null && (!Number.isInteger(display) || display < 0 || display > 3)) throw new ExamError("BAD_INPUT", "অপশন সঠিক নয়।");
  const perm = (a.optionPerms as Record<string, number[]>)[qid] ?? [0, 1, 2, 3];
  const selected = display == null ? null : perm[display];
  await db.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId: qid } },
    update: { selected, marked, confidence: unsure ? "UNSURE" : "SURE" },
    create: { attemptId, questionId: qid, selected, marked, confidence: unsure ? "UNSURE" : "SURE" },
  });
}

// ─────────────────────────────────────────── জমা ও গ্রেডিং

async function award(db: Db, userId: string, key: string) {
  await db.userAchievement.createMany({ data: [{ userId, achievementKey: key }], skipDuplicates: true });
}

export type SubmitResult = { scorePct: number; passed: boolean | null; opened: number[]; completed: boolean };

export async function submitAttempt(db: Db, userId: string, attemptId: string): Promise<SubmitResult> {
  const a = await ownAttempt(db, userId, attemptId);
  if (a.submittedAt) throw new ExamError("SUBMITTED", "পরীক্ষাটি আগেই জমা হয়েছে।");
  const rules = await loadRules(db);
  const intervals = rules.get<number[]>("srs.intervals_days");
  const [qs, answers] = await Promise.all([
    db.question.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, correctIndex: true } }),
    db.attemptAnswer.findMany({ where: { attemptId } }),
  ]);
  const correctOf = new Map(qs.map((q) => [q.id, q.correctIndex]));
  const ansBy = new Map(answers.map((x) => [x.questionId, x]));
  const now = new Date();
  let correct = 0, wrong = 0, unanswered = 0;
  const graded = a.questionIds.map((qid) => {
    const ans = ansBy.get(qid);
    const sel = ans?.selected ?? null;
    const ok = sel != null && sel === correctOf.get(qid);
    if (sel == null) unanswered++;
    else if (ok) correct++;
    else wrong++;
    return { qid, sel, ok, unsure: ans?.confidence === "UNSURE", marked: ans?.marked ?? false };
  });
  const total = a.questionIds.length;
  const scorePct = (correct / total) * 100;
  const passed = a.threshold != null ? scorePct >= a.threshold : null;

  await db.$transaction(async (tx) => {
    const res = await tx.testAttempt.updateMany({
      where: { id: attemptId, submittedAt: null },
      data: { submittedAt: now, correct, wrong, unanswered, scorePct, passed },
    });
    if (res.count !== 1) throw new ExamError("SUBMITTED", "পরীক্ষাটি আগেই জমা হয়েছে।");

    for (const g of graded) {
      await tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: g.qid } },
        update: { isCorrect: g.ok },
        create: { attemptId, questionId: g.qid, selected: null, isCorrect: false },
      });
      const prev = await tx.questionStat.findUnique({ where: { userId_questionId: { userId, questionId: g.qid } } });
      const box = prev?.leitnerBox ?? 0;
      let nextBox = box;
      if (!g.ok) nextBox = 1; // ভুল বা অনুত্তরিত → আগামীকাল আবার
      else if (g.unsure) nextBox = Math.max(1, box); // কম আত্মবিশ্বাসে সঠিক → একই বাক্সে
      else if (box > 0) nextBox = Math.min(5, box + 1);
      const dueAt = nextBox > 0 ? new Date(now.getTime() + intervals[nextBox - 1] * 864e5) : null;
      const data = {
        seen: { increment: 1 },
        correct: { increment: g.ok ? 1 : 0 },
        wrong: { increment: g.ok ? 0 : 1 },
        lastCorrect: g.ok,
        lowConfCorrect: { increment: g.ok && g.unsure ? 1 : 0 },
        lastSeenAt: now,
        ...(g.ok ? {} : { lastWrongAt: now }),
        leitnerBox: nextBox,
        dueAt,
        marked: g.marked,
      };
      await tx.questionStat.upsert({
        where: { userId_questionId: { userId, questionId: g.qid } },
        update: data,
        create: {
          userId, questionId: g.qid, seen: 1, correct: g.ok ? 1 : 0, wrong: g.ok ? 0 : 1, lastCorrect: g.ok,
          lowConfCorrect: g.ok && g.unsure ? 1 : 0, lastSeenAt: now, lastWrongAt: g.ok ? null : now, leitnerBox: nextBox, dueAt, marked: g.marked,
        },
      });
    }

    if (a.taskId && MASTERY_KINDS.includes(a.kind)) {
      await tx.masteryRecord.create({
        data: { userId, scope: a.kind === "LEVEL_FINAL" ? "LEVEL" : "EXAM", scopeRef: a.task?.exam ? String(a.task.exam.bcsNo) : "1", scorePct, attemptId },
      });
    }
    if (a.taskId) await advanceCycle(tx, userId, a, scorePct, passed);
  });

  // ধাপ সম্পন্ন হলে পরের কাজ খোলা (নিজস্ব Transaction)
  let opened: number[] = [];
  let completed = false;
  if (a.taskId && passed && (a.kind === "LEVEL_FINAL" || a.kind === "CUMULATIVE" || (a.kind === "MASTERY" && a.task?.exam?.bcsNo === 10))) {
    opened = await completeTask(db, userId, a.taskId);
    completed = true;
    const doneExams = await db.studentTaskProgress.count({ where: { userId, state: "COMPLETED", task: { kind: "L1_EXAM" } } });
    if (doneExams >= 10) await award(db, userId, "l1_10");
    if (a.kind === "LEVEL_FINAL") await award(db, userId, "l1_done");
  }
  if (a.kind === "SOLVE" && a.taskId) {
    const p = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId: a.taskId } } });
    if (p?.step === "REVIEW") await award(db, userId, "first_exam"); // পুরো প্রশ্নপত্র (সব ভাগ) সমাধানের পর
  }
  return { scorePct, passed, opened, completed };
}

/** Learning Cycle-এর ধাপ বদল — একই Transaction-এ। */
async function advanceCycle(
  tx: Prisma.TransactionClient,
  userId: string,
  a: { taskId: number | null; kind: AttemptKind; task: { exam: { bcsNo: number } | null } | null },
  scorePct: number,
  passed: boolean | null,
) {
  const where = { userId_taskId: { userId, taskId: a.taskId! } };
  const p = await tx.studentTaskProgress.findUnique({ where });
  if (!p || p.state === "COMPLETED") return;

  if (a.kind === "SOLVE" && p.step === "SOLVE") {
    // সব ভাগ জমা হলে পর্যালোচনায়
    const rules = await loadRules(tx as unknown as PrismaClient);
    const n = await tx.question.count({ where: { kind: "HISTORICAL", status: "PUBLISHED", verifyClass: { in: rules.get<string[]>("path.eligible_classes") }, exam: { bcsNo: a.task!.exam!.bcsNo } } });
    const parts = Math.max(1, Math.ceil(n / rules.get<number>("l1.solve.part_size")));
    const done = await tx.testAttempt.count({ where: { userId, taskId: a.taskId!, kind: "SOLVE", submittedAt: { not: null } } });
    if (done >= parts) await tx.studentTaskProgress.update({ where, data: { step: "REVIEW" } });
  } else if (a.kind === "REVISION" && p.step === "REVISION") {
    await tx.studentTaskProgress.update({ where, data: { step: "MASTERY" } });
  } else if (a.kind === "MASTERY" && p.step === "MASTERY") {
    const best = Math.max(p.bestScore ?? 0, scorePct);
    const isFirstExam = a.task?.exam?.bcsNo === 10;
    await tx.studentTaskProgress.update({
      where,
      data: { lastScore: scorePct, bestScore: best, ...(passed && !isFirstExam ? { step: "CUMULATIVE" } : {}) },
    });
  } else if (a.kind === "CUMULATIVE" || a.kind === "LEVEL_FINAL") {
    await tx.studentTaskProgress.update({ where, data: { lastScore: scorePct, bestScore: Math.max(p.bestScore ?? 0, scorePct) } });
  }
}

/** প্রথম সমাধানের পর্যালোচনা শেষ → Revision ধাপ। */
export async function acknowledgeReview(db: Db, userId: string, taskKey: string) {
  const { task, progress } = await loadTask(db, userId, taskKey);
  if (progress.step !== "REVIEW") return;
  await db.studentTaskProgress.update({ where: { userId_taskId: { userId, taskId: task.id } }, data: { step: "REVISION" } });
}

// ─────────────────────────────────────────── ফলাফল

export async function getResultView(db: Db, userId: string, attemptIds: string[]) {
  const attempts = await db.testAttempt.findMany({ where: { id: { in: attemptIds } }, include: { task: { include: { exam: true } } } });
  if (!attempts.length || attempts.some((a) => a.userId !== userId)) throw new ExamError("FORBIDDEN", "এই ফলাফল তোমার নয়।");
  if (attempts.some((a) => !a.submittedAt)) throw new ExamError("NOT_READY", "পরীক্ষাটি এখনও জমা হয়নি।");
  const qids = attempts.flatMap((a) => a.questionIds);
  const [qs, answers] = await Promise.all([
    db.question.findMany({
      where: { id: { in: qids } },
      select: { id: true, text: true, options: true, correctIndex: true, explanation: true, explanationStatus: true, examQNo: true, exam: { select: { bcsNo: true } }, subtopic: { select: { nameBn: true, topic: { select: { nameBn: true, subject: { select: { nameBn: true, order: true } } } } } } },
    }),
    db.attemptAnswer.findMany({ where: { attemptId: { in: attemptIds } } }),
  ]);
  const qBy = new Map(qs.map((q) => [q.id, q]));
  const aBy = new Map(answers.map((x) => [`${x.attemptId}|${x.questionId}`, x]));
  const items = attempts
    .sort((x, y) => x.partNo - y.partNo)
    .flatMap((a) =>
      a.questionIds.map((qid) => {
        const q = qBy.get(qid)!;
        const perm = (a.optionPerms as Record<string, number[]>)[qid] ?? [0, 1, 2, 3];
        const ans = aBy.get(`${a.id}|${qid}`);
        const sel = ans?.selected ?? null;
        const status = sel == null ? "unanswered" : sel === q.correctIndex ? "correct" : "wrong";
        return {
          qid,
          text: q.text,
          options: perm.map((i) => q.options[i]),
          selected: sel == null ? null : perm.indexOf(sel),
          correct: q.correctIndex == null ? null : perm.indexOf(q.correctIndex),
          status: status as "correct" | "wrong" | "unanswered",
          unsure: ans?.confidence === "UNSURE",
          explanation: q.explanation,
          explanationVerified: q.explanationStatus === "VERIFIED",
          source: q.exam ? `${q.exam.bcsNo === 10 ? "১০ম" : `${q.exam.bcsNo}তম`} বিসিএস, প্রশ্ন ${q.examQNo}` : null,
          subject: q.subtopic.topic.subject.nameBn,
          subjectOrder: q.subtopic.topic.subject.order,
          topic: q.subtopic.topic.nameBn,
          subtopic: q.subtopic.nameBn,
        };
      }),
    );

  const bySubject = new Map<string, { subject: string; order: number; total: number; correct: number; wrong: number; unanswered: number }>();
  for (const it of items) {
    const s = bySubject.get(it.subject) ?? { subject: it.subject, order: it.subjectOrder, total: 0, correct: 0, wrong: 0, unanswered: 0 };
    s.total++;
    s[it.status]++;
    bySubject.set(it.subject, s);
  }
  const mistakesBySubtopic = new Map<string, { subtopic: string; subject: string; n: number }>();
  for (const it of items.filter((i) => i.status !== "correct")) {
    const s = mistakesBySubtopic.get(it.subtopic) ?? { subtopic: it.subtopic, subject: it.subject, n: 0 };
    s.n++;
    mistakesBySubtopic.set(it.subtopic, s);
  }
  const total = items.length;
  const correct = items.filter((i) => i.status === "correct").length;
  const first = attempts[0];
  return {
    attempts: attempts.map((a) => ({ id: a.id, kind: a.kind, partNo: a.partNo, threshold: a.threshold, passed: a.passed, scorePct: a.scorePct })),
    kind: first.kind,
    taskKey: first.task?.key ?? null,
    taskTitle: first.task?.titleBn ?? "",
    bcsNo: first.task?.exam?.bcsNo ?? null,
    threshold: first.threshold,
    passed: attempts.length === 1 ? first.passed : null,
    total,
    correct,
    wrong: items.filter((i) => i.status === "wrong").length,
    unanswered: items.filter((i) => i.status === "unanswered").length,
    unsureCorrect: items.filter((i) => i.status === "correct" && i.unsure).length,
    scorePct: total ? (correct / total) * 100 : 0,
    subjects: [...bySubject.values()].sort((x, y) => x.order - y.order),
    weakSubtopics: [...mistakesBySubtopic.values()].sort((x, y) => y.n - x.n).slice(0, 6),
    items,
  };
}
