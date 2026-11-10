/**
 * পরীক্ষা-ইঞ্জিন (Level 1 ও Level 2) এবং Smart Revision:
 * Attempt তৈরি, উত্তর সংরক্ষণ, গ্রেডিং, Learning Cycle-এর ধাপ বদল, Unlock, দৈনিক Revision-সারি, ভুলের অনুশীলন।
 *
 * নিরাপত্তা:
 *  - প্রতিটি ফাংশন userId নেয় এবং Attempt/কাজের মালিকানা ও প্রবেশাধিকার যাচাই করে।
 *  - জমা দেওয়ার আগে ক্লায়েন্টে সঠিক উত্তর বা ব্যাখ্যা যায় না।
 *  - একই Attempt দুবার জমা দেওয়া যায় না (ডেটাবেস-স্তরে শর্তসাপেক্ষ হালনাগাদ)।
 * এই ফাইল "server-only" নয়, যাতে স্বয়ংক্রিয় পরীক্ষা সরাসরি চালাতে পারে; ডেটাবেস-ক্লায়েন্ট প্যারামিটারে আসে।
 */
import type { AttemptKind, LearningTask, Exam, PrismaClient, Prisma } from "@prisma/client";
import { loadRules, type Rules } from "@/lib/rules";
import { OPEN_STATES, completeTask, markStarted } from "@/lib/progress/engine";
import { pickCumulative, pickProportional, rank, optionPerm, revisionSize, shuffleArr, splitParts, type Candidate, type Stat, type Weights } from "./select";

export class ExamError extends Error {
  constructor(
    public code: "LOCKED" | "NOT_FOUND" | "FORBIDDEN" | "SUBMITTED" | "NEED_REVIEW" | "NOT_READY" | "BAD_INPUT" | "BLOCKED" | "EMPTY",
    message: string,
  ) {
    super(message);
  }
}

type Db = PrismaClient;
type Task = LearningTask & { exam: Exam | null };
const GRACE_MS = 60_000;
const bnD = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const qNoNum = (s: string | null) => parseInt(s ?? "0", 10) || 0;

/** বাংলাদেশ সময়ে (UTC+৬) আজকের দিনের শুরু। */
export function dhakaDayStart(now = new Date(), offsetDays = 0): Date {
  const local = new Date(now.getTime() + 6 * 3600e3);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offsetDays) - 6 * 3600e3);
}

async function loadTask(db: Db, userId: string, taskKey: string) {
  const task = await db.learningTask.findUnique({ where: { key: taskKey }, include: { exam: true } });
  if (!task) throw new ExamError("NOT_FOUND", "কাজটি পাওয়া যায়নি।");
  const progress = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId: task.id } } });
  if (!progress || !OPEN_STATES.includes(progress.state)) throw new ExamError("LOCKED", "এই ধাপটি Unlock করতে আগের ধাপের নির্ধারিত কাজ সম্পন্ন করুন।");
  return { task, progress };
}

type Cand = Candidate & { qNo: number; uid: string; subject: string; options: string[] };

/** Level 1-এর যোগ্য প্রশ্ন: প্রকাশিত ঐতিহাসিক প্রশ্ন, নির্ধারিত যাচাই-শ্রেণি, নির্দিষ্ট পরীক্ষাগুলো থেকে। */
async function poolHistorical(db: Db, rules: Rules, examNos: number[]): Promise<Cand[]> {
  const rows = await db.question.findMany({
    where: { kind: "HISTORICAL", status: "PUBLISHED", verifyClass: { in: rules.get<string[]>("path.eligible_classes") }, exam: { bcsNo: { in: examNos } } },
    select: { id: true, uid: true, examQNo: true, options: true, exam: { select: { bcsNo: true } }, subtopic: { select: { priorityGrade: true, topic: { select: { subject: { select: { code: true } } } } } } },
  });
  return rows.map((r) => ({ id: r.id, uid: r.uid, examNo: r.exam!.bcsNo, qNo: qNoNum(r.examQNo), grade: r.subtopic.priorityGrade, subject: r.subtopic.topic.subject.code, options: r.options }));
}

/** Level 2-এর যোগ্য প্রশ্ন: প্রকাশিত (যাচাইকৃত) নতুন টপিকভিত্তিক প্রশ্ন। */
async function poolTopic(db: Db, subtopicIds?: number[]): Promise<Cand[]> {
  const rows = await db.question.findMany({
    where: { kind: "TOPIC", status: "PUBLISHED", ...(subtopicIds ? { subtopicId: { in: subtopicIds } } : {}) },
    select: { id: true, uid: true, options: true, subtopicId: true, subtopic: { select: { priorityGrade: true, topic: { select: { subject: { select: { code: true } } } } } } },
    orderBy: { uid: "asc" },
  });
  return rows.map((r, i) => ({ id: r.id, uid: r.uid, examNo: r.subtopicId, qNo: i, grade: r.subtopic.priorityGrade, subject: r.subtopic.topic.subject.code, options: r.options }));
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

/** প্রথম সমাধানের প্রশ্ন ও ভাগ (Level 1: প্রশ্নপত্রের ক্রমে; Level 2: উপবিষয়ের প্রশ্ন, স্থির ক্রমে)। */
async function solveParts(db: Db, task: Task, rules: Rules): Promise<Cand[][]> {
  if (task.kind === "L1_EXAM") {
    const qs = (await poolHistorical(db, rules, [task.exam!.bcsNo])).sort((a, b) => a.qNo - b.qNo);
    return splitParts(qs, rules.get<number>("l1.solve.part_size"));
  }
  if (task.kind === "L2_SUBTOPIC") return splitParts(await poolTopic(db, [task.subtopicId!]), rules.get<number>("l2.solve.chunk_size"));
  return [];
}

export async function solvePlan(db: Db, userId: string, task: Task, rules: Rules) {
  const parts = await solveParts(db, task, rules);
  const attempts = await db.testAttempt.findMany({ where: { userId, taskId: task.id, kind: "SOLVE" }, select: { id: true, partNo: true, submittedAt: true, scorePct: true } });
  return parts.map((p, i) => {
    const a = attempts.filter((x) => x.partNo === i + 1);
    const done = a.find((x) => x.submittedAt);
    const open = a.find((x) => !x.submittedAt);
    return {
      partNo: i + 1, size: p.length,
      from: task.kind === "L1_EXAM" ? p[0]?.qNo : (p[0]?.qNo ?? 0) + 1,
      to: task.kind === "L1_EXAM" ? p.at(-1)?.qNo : (p.at(-1)?.qNo ?? 0) + 1,
      questionIds: p.map((q) => q.id), doneAttemptId: done?.id ?? null, openAttemptId: open?.id ?? null, scorePct: done?.scorePct ?? null,
    };
  });
}

export async function plannedParts(db: Db, task: Task): Promise<number> {
  return Math.max(1, (await solveParts(db, task, await loadRules(db))).length);
}

// ─────────────────────────────────────────── Smart Revision: অবস্থা

/** আজকের Revision-এর অবস্থা ও আগামী ১৪ দিনের ক্যালেন্ডার। */
export async function revisionStatus(db: Db, userId: string, now = new Date()) {
  const rules = await loadRules(db);
  const cap = rules.get<number>("srs.daily_cap");
  const today = dhakaDayStart(now);
  const [dueNow, doneToday, upcoming, wrongBank] = await Promise.all([
    db.questionStat.count({ where: { userId, leitnerBox: { gt: 0 }, dueAt: { lte: now } } }),
    db.attemptAnswer.count({ where: { attempt: { userId, kind: "SRS_REVIEW", submittedAt: { gte: today } } } }),
    db.questionStat.findMany({ where: { userId, leitnerBox: { gt: 0 }, dueAt: { gt: now, lt: dhakaDayStart(now, 14) } }, select: { dueAt: true } }),
    db.questionStat.count({ where: { userId, wrong: { gt: 0 }, lastCorrect: false } }),
  ]);
  const remaining = Math.max(0, Math.min(dueNow, cap - doneToday));
  const calendar = Array.from({ length: 14 }, (_, i) => {
    const from = dhakaDayStart(now, i);
    const to = dhakaDayStart(now, i + 1);
    const n = upcoming.filter((u) => u.dueAt! >= from && u.dueAt! < to).length + (i === 0 ? dueNow : 0);
    return { day: from.toISOString(), n };
  });
  return { dueNow, doneToday, cap, remaining, blocked: rules.get<boolean>("srs.block_new_when_due") && remaining > 0, calendar, wrongBank };
}

// ─────────────────────────────────────────── পরীক্ষা শুরু

async function createAttempt(db: Db, userId: string, taskId: number | null, kind: AttemptKind, questionIds: string[], opts: { partNo?: number; threshold?: number | null; keepOrder?: boolean; rules: Rules }) {
  if (!questionIds.length) throw new ExamError("EMPTY", "এই ধাপের জন্য এখনও কোনো যাচাইকৃত প্রশ্ন নেই।");
  const shuffle = opts.rules.get<boolean>("shuffle.options") && !opts.keepOrder;
  const qs = await db.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, options: true } });
  const perms: Record<string, number[]> = {};
  for (const o of qs) perms[o.id] = optionPerm(o.options, shuffle, Math.random);
  if (taskId) await markStarted(db, userId, taskId);
  const a = await db.testAttempt.create({ data: { userId, taskId, kind, partNo: opts.partNo ?? 1, questionIds, optionPerms: perms, threshold: opts.threshold ?? null } });
  return a.id;
}

/** Level 2 Final: ২০০ নম্বরের মানবণ্টন অনুযায়ী বিষয়ভিত্তিক কোটা, প্রতিটির ভেতরে অগ্রাধিকার-ক্রমে। */
function pickBlueprint(ranked: Cand[], marks: Record<string, number>, size: number): string[] {
  const total = Object.values(marks).reduce((a, b) => a + b, 0);
  const chosen = new Set<string>();
  for (const [code, m] of Object.entries(marks)) {
    const q = Math.round((m / total) * size);
    for (const c of ranked.filter((x) => x.subject === code).slice(0, q)) chosen.add(c.id);
  }
  for (const c of ranked) {
    if (chosen.size >= size) break;
    chosen.add(c.id);
  }
  return [...chosen].slice(0, size);
}

/**
 * বর্তমান ধাপের পরীক্ষা শুরু (অথবা অসমাপ্ত থাকলে সেটিই ফেরত)।
 * mode "practice": ধাপ না বদলিয়ে ভুল/অনিশ্চিত প্রশ্নের অতিরিক্ত অনুশীলন।
 */
export async function startStep(db: Db, userId: string, taskKey: string, mode: "step" | "practice" = "step"): Promise<string> {
  const { task, progress } = await loadTask(db, userId, taskKey);
  const rules = await loadRules(db);
  const w = rules.get<Weights>("select.weights");
  const now = new Date();
  const rnd = Math.random;
  const isL2 = task.kind.startsWith("L2_");
  if (task.kind.startsWith("L3_")) throw new ExamError("NOT_READY", "Model Test পরের Phase-এ যুক্ত হবে।");

  let kind: AttemptKind;
  if (mode === "practice") kind = "PRACTICE";
  else if (progress.state === "COMPLETED") throw new ExamError("SUBMITTED", "এই ধাপ আগেই সম্পন্ন। চাইলে অনুশীলন করতে পারো।");
  else if (task.kind === "L1_FINAL" || task.kind === "L2_FINAL") kind = "LEVEL_FINAL";
  else if (task.kind === "L2_CHECKPOINT") kind = "CHECKPOINT";
  else {
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
    const plan = await solvePlan(db, userId, task, rules);
    if (!plan.length) throw new ExamError("EMPTY", "এই উপবিষয়ের প্রশ্ন এখনও প্রকাশিত হয়নি। প্রশ্ন যুক্ত হলে এখান থেকেই শুরু করা যাবে।");
    const next = plan.find((p) => !p.doneAttemptId);
    if (!next) throw new ExamError("NEED_REVIEW", "সব ভাগ সমাধান হয়েছে। এখন পর্যালোচনা করো।");
    if (next.openAttemptId) return next.openAttemptId;
    // Level 2: আজকের Revision বাকি থাকলে নতুন উপবিষয় শুরু নয়
    if (isL2 && next.partNo === 1) {
      const rs = await revisionStatus(db, userId, now);
      if (rs.blocked) throw new ExamError("BLOCKED", `নতুন উপবিষয় শুরুর আগে আজকের Revision শেষ করো (${bnD(rs.remaining)}টি প্রশ্ন বাকি)।`);
    }
    return createAttempt(db, userId, task.id, "SOLVE", next.questionIds, { partNo: next.partNo, keepOrder: !isL2, rules });
  }

  // ── প্রার্থী-প্রশ্ন
  let cands: Cand[];
  if (!isL2) {
    const bcsNo = task.exam?.bcsNo ?? 50;
    const examNos =
      kind === "LEVEL_FINAL" || kind === "CUMULATIVE"
        ? (await db.exam.findMany({ where: kind === "CUMULATIVE" ? { bcsNo: { lte: bcsNo } } : {}, select: { bcsNo: true } })).map((e) => e.bcsNo)
        : [bcsNo];
    cands = await poolHistorical(db, rules, examNos);
    if (kind === "PRACTICE" && task.kind === "L1_EXAM") cands = cands.filter((c) => c.examNo === bcsNo);
  } else if (task.kind === "L2_SUBTOPIC") {
    cands = await poolTopic(db, [task.subtopicId!]);
  } else if (task.kind === "L2_CHECKPOINT") {
    const subs = await db.learningTask.findMany({ where: { kind: "L2_SUBTOPIC", phase: task.phase }, select: { subtopicId: true } });
    cands = await poolTopic(db, subs.map((s) => s.subtopicId!));
  } else {
    cands = await poolTopic(db);
  }
  const ranked = rank(cands, await statsFor(db, userId, cands.map((c) => c.id)), w, now, rnd) as Cand[];
  const scopes = [`task:${task.key}`, `level:${isL2 ? 2 : 1}`];

  let ids: string[];
  let threshold: number | null = null;
  if (kind === "PRACTICE") ids = ranked.slice(0, 20).map((c) => c.id);
  else if (kind === "REVISION") {
    if (isL2) {
      const st = await statsFor(db, userId, ranked.map((c) => c.id));
      const weak = ranked.filter((c) => { const s = st.get(c.id); return s && (s.lastCorrect === false || s.lowConfCorrect > 0 || s.marked); }).length;
      const size = Math.min(ranked.length, Math.max(rules.get<number>("l2.revision.min"), Math.min(weak, rules.get<number>("l2.revision.max"))));
      ids = ranked.slice(0, size).map((c) => c.id);
    } else {
      const first = (await firstSolveScore(db, userId, task.id)) ?? 0;
      ids = ranked.slice(0, revisionSize(rules.get<Record<string, number>>("l1.revision.bands"), first)).map((c) => c.id);
    }
  } else if (kind === "MASTERY") {
    ids = ranked.slice(0, rules.get<number>(isL2 ? "l2.mastery.size" : "l1.mastery.size")).map((c) => c.id);
    threshold = rules.get<number>(isL2 ? "l2.threshold.mastery" : "l1.threshold.mastery", scopes);
  } else if (kind === "CUMULATIVE") {
    const examCount = new Set(cands.map((c) => c.examNo)).size;
    const size = Math.min(rules.get<number>("l1.cumulative.max"), rules.get<number>("l1.cumulative.base") + rules.get<number>("l1.cumulative.step") * (examCount - 1));
    ids = pickCumulative(ranked, size, rules.get<number>("l1.cumulative.min_per_exam"));
    threshold = rules.get<number>("l1.threshold.cumulative", scopes);
  } else if (kind === "CHECKPOINT") {
    ids = pickCumulative(ranked, rules.get<number>("l2.checkpoint.size"), 1); // প্রতিটি উপবিষয় থেকে অন্তত ১টি
    threshold = rules.get<number>("l2.threshold.checkpoint", scopes);
  } else if (isL2) {
    ids = pickBlueprint(ranked, rules.get<Record<string, number>>("exam.marks_distribution"), rules.get<number>("l2.final.size"));
    threshold = rules.get<number>("l2.threshold.final", scopes);
  } else {
    ids = pickProportional(ranked, rules.get<number>("l1.final.size"));
    threshold = rules.get<number>("l1.threshold.final", scopes);
  }
  return createAttempt(db, userId, task.id, kind, shuffleArr(ids, rnd), { threshold, rules });
}

/** দৈনিক Revision-এর পরের সেট (Spaced Repetition-এর সারি থেকে, যার সময় হয়েছে)। */
export async function startRevision(db: Db, userId: string): Promise<string> {
  const open = await db.testAttempt.findFirst({ where: { userId, kind: "SRS_REVIEW", submittedAt: null }, orderBy: { startedAt: "desc" } });
  if (open) return open.id;
  const rules = await loadRules(db);
  const st = await revisionStatus(db, userId);
  if (st.remaining <= 0) throw new ExamError("EMPTY", st.dueNow > 0 ? "আজকের Revision-এর সীমা পূর্ণ হয়েছে। বাকিগুলো আগামীকাল।" : "এখন Revision-এর কোনো প্রশ্ন বাকি নেই।");
  const due = await db.questionStat.findMany({
    where: { userId, leitnerBox: { gt: 0 }, dueAt: { lte: new Date() }, question: { status: "PUBLISHED" } },
    orderBy: [{ dueAt: "asc" }, { leitnerBox: "asc" }],
    take: Math.min(rules.get<number>("srs.session_size"), st.remaining),
    select: { questionId: true },
  });
  return createAttempt(db, userId, null, "SRS_REVIEW", shuffleArr(due.map((d) => d.questionId), Math.random), { rules });
}

/** ভুলের ভান্ডার থেকে অনুশীলন (সবচেয়ে বেশি ভুল করা আগে), চাইলে নির্দিষ্ট বিষয়ের। */
export async function startMistakePractice(db: Db, userId: string, subjectCode?: string): Promise<string> {
  const rules = await loadRules(db);
  const wrong = await db.questionStat.findMany({
    where: { userId, wrong: { gt: 0 }, lastCorrect: false, question: { status: "PUBLISHED", ...(subjectCode ? { subtopic: { topic: { subject: { code: subjectCode } } } } : {}) } },
    orderBy: [{ wrong: "desc" }, { lastWrongAt: "desc" }],
    take: 20,
    select: { questionId: true },
  });
  return createAttempt(db, userId, null, "MISTAKE_PRACTICE", shuffleArr(wrong.map((d) => d.questionId), Math.random), { rules });
}

// ─────────────────────────────────────────── পরীক্ষা চলাকালীন

async function ownAttempt(db: Db, userId: string, attemptId: string) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { task: { include: { exam: true } } } });
  if (!a) throw new ExamError("NOT_FOUND", "পরীক্ষাটি পাওয়া যায়নি।");
  if (a.userId !== userId) throw new ExamError("FORBIDDEN", "এই পরীক্ষাটি তোমার নয়।");
  return a;
}

export const KIND_TITLE: Record<string, string> = { SOLVE: "প্রশ্ন সমাধান", REVISION: "Revision Test", MASTERY: "Mastery Test", CUMULATIVE: "Cumulative Revision Test", LEVEL_FINAL: "Final Assessment", PRACTICE: "অনুশীলন", CHECKPOINT: "Checkpoint Test", MODEL_TEST: "Model Test", SRS_REVIEW: "দৈনিক Revision", MISTAKE_PRACTICE: "ভুলের অনুশীলন" };

export function attemptTitle(a: { kind: string; partNo: number; task: { titleBn: string } | null }, parts?: number) {
  if (!a.task) return KIND_TITLE[a.kind];
  return `${a.task.titleBn}: ${KIND_TITLE[a.kind]}${a.kind === "SOLVE" && parts && parts > 1 ? `, ভাগ ${bnD(a.partNo)}/${bnD(parts)}` : ""}`;
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
  const parts = a.kind === "SOLVE" && a.task ? await plannedParts(db, a.task) : undefined;
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
    db.question.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, correctIndex: true, subtopic: { select: { code: true } } } }),
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
    return { qid, ok, unsure: ans?.confidence === "UNSURE", marked: ans?.marked ?? false };
  });
  const scorePct = (correct / a.questionIds.length) * 100;
  const passed = a.threshold != null ? scorePct >= a.threshold : null;

  await db.$transaction(async (tx) => {
    const res = await tx.testAttempt.updateMany({ where: { id: attemptId, submittedAt: null }, data: { submittedAt: now, correct, wrong, unanswered, scorePct, passed } });
    if (res.count !== 1) throw new ExamError("SUBMITTED", "পরীক্ষাটি আগেই জমা হয়েছে।");

    for (const g of graded) {
      await tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: g.qid } },
        update: { isCorrect: g.ok },
        create: { attemptId, questionId: g.qid, selected: null, isCorrect: false },
      });
      // Leitner: ভুল/অনুত্তরিত → বাক্স ১ (আগামীকাল); নিশ্চিত সঠিক → পরের বাক্স; অনিশ্চিত সঠিক → একই বাক্স (অন্তত ১)
      const prev = await tx.questionStat.findUnique({ where: { userId_questionId: { userId, questionId: g.qid } } });
      const box = prev?.leitnerBox ?? 0;
      const nextBox = !g.ok ? 1 : g.unsure ? Math.max(1, box) : box > 0 ? Math.min(5, box + 1) : 0;
      const dueAt = nextBox > 0 ? new Date(now.getTime() + intervals[nextBox - 1] * 864e5) : null;
      const common = { lastCorrect: g.ok, lastSeenAt: now, leitnerBox: nextBox, dueAt, marked: g.marked };
      await tx.questionStat.upsert({
        where: { userId_questionId: { userId, questionId: g.qid } },
        update: {
          ...common,
          seen: { increment: 1 }, correct: { increment: g.ok ? 1 : 0 }, wrong: { increment: g.ok ? 0 : 1 },
          lowConfCorrect: { increment: g.ok && g.unsure ? 1 : 0 }, ...(g.ok ? {} : { lastWrongAt: now }),
        },
        create: { userId, questionId: g.qid, ...common, seen: 1, correct: g.ok ? 1 : 0, wrong: g.ok ? 0 : 1, lowConfCorrect: g.ok && g.unsure ? 1 : 0, lastWrongAt: g.ok ? null : now },
      });
    }

    if (a.task && ["MASTERY", "CUMULATIVE", "LEVEL_FINAL", "CHECKPOINT"].includes(a.kind)) {
      const t = a.task;
      const scope = t.kind === "L2_SUBTOPIC" ? "SUBTOPIC" : t.kind === "L1_EXAM" ? "EXAM" : "LEVEL";
      const scopeRef = t.kind === "L2_SUBTOPIC" ? t.key.split(":").at(-1)! : t.exam ? String(t.exam.bcsNo) : t.key;
      await tx.masteryRecord.create({ data: { userId, scope, scopeRef, scorePct, attemptId } });
    }
    if (a.task) await advanceCycle(tx, userId, a.task, a.kind, scorePct, passed, rules);
  });

  // ── ধাপ সম্পন্ন হলে পরের কাজ খোলা (নিজস্ব Transaction)
  let opened: number[] = [];
  let completed = false;
  const t = a.task;
  const finishes =
    !!t && passed === true &&
    (a.kind === "LEVEL_FINAL" || a.kind === "CUMULATIVE" || a.kind === "CHECKPOINT" ||
      (a.kind === "MASTERY" && (t.kind === "L2_SUBTOPIC" || t.exam?.bcsNo === 10)));
  if (finishes) {
    opened = await completeTask(db, userId, t!.id);
    completed = true;
    const doneExams = await db.studentTaskProgress.count({ where: { userId, state: "COMPLETED", task: { kind: "L1_EXAM" } } });
    if (doneExams >= 10) await award(db, userId, "l1_10");
    if (t!.key === "L1:FINAL") await award(db, userId, "l1_done");
    if (t!.key === "L2:CHECKPOINT:A") await award(db, userId, "phase_a");
    if (t!.key === "L2:FINAL") await award(db, userId, "l2_done");
  }
  if (a.kind === "SOLVE" && t) {
    const p = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId: t.id } } });
    if (p?.step === "REVIEW" && t.kind === "L1_EXAM") await award(db, userId, "first_exam"); // পুরো প্রশ্নপত্র সমাধানের পর
  }
  if (a.kind === "SRS_REVIEW") await recordRevisionDay(db, userId, attemptId, now);
  return { scorePct, passed, opened, completed };
}

/** দৈনিক Revision-এর দিনভিত্তিক রেকর্ড ও টানা ৭ দিনের অর্জন। */
async function recordRevisionDay(db: Db, userId: string, attemptId: string, now: Date) {
  const day = dhakaDayStart(now);
  const st = await revisionStatus(db, userId, now);
  await db.revisionSession.upsert({
    where: { userId_day: { userId, day } },
    update: { doneCount: st.doneToday, dueCount: st.doneToday + st.remaining, attemptIds: { push: attemptId } },
    create: { userId, day, doneCount: st.doneToday, dueCount: st.doneToday + st.remaining, attemptIds: [attemptId] },
  });
  const days = await db.revisionSession.findMany({ where: { userId, doneCount: { gt: 0 }, day: { gte: dhakaDayStart(now, -6) } }, select: { day: true } });
  if (days.length >= 7) await award(db, userId, "streak_7");
}

/** Learning Cycle-এর ধাপ বদল — একই Transaction-এ। */
async function advanceCycle(tx: Prisma.TransactionClient, userId: string, task: Task, kind: AttemptKind, scorePct: number, passed: boolean | null, rules: Rules) {
  const where = { userId_taskId: { userId, taskId: task.id } };
  const p = await tx.studentTaskProgress.findUnique({ where });
  if (!p || p.state === "COMPLETED") return;
  const scores = { lastScore: scorePct, bestScore: Math.max(p.bestScore ?? 0, scorePct) };

  if (kind === "SOLVE" && p.step === "SOLVE") {
    const parts = (await solveParts(tx as unknown as PrismaClient, task, rules)).length;
    const done = await tx.testAttempt.count({ where: { userId, taskId: task.id, kind: "SOLVE", submittedAt: { not: null } } });
    if (done >= parts) await tx.studentTaskProgress.update({ where, data: { step: "REVIEW" } });
  } else if (kind === "REVISION" && p.step === "REVISION") {
    await tx.studentTaskProgress.update({ where, data: { step: "MASTERY" } });
  } else if (kind === "MASTERY" && p.step === "MASTERY") {
    const toCumulative = passed && task.kind === "L1_EXAM" && task.exam?.bcsNo !== 10;
    await tx.studentTaskProgress.update({ where, data: { ...scores, ...(toCumulative ? { step: "CUMULATIVE" } : {}) } });
  } else if (kind === "CUMULATIVE" || kind === "LEVEL_FINAL" || kind === "CHECKPOINT") {
    await tx.studentTaskProgress.update({ where, data: scores });
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
      select: {
        id: true, text: true, options: true, correctIndex: true, explanation: true, explanationStatus: true, examQNo: true, source: true, kind: true,
        exam: { select: { bcsNo: true } },
        subtopic: { select: { nameBn: true, topic: { select: { nameBn: true, subject: { select: { nameBn: true, order: true } } } } } },
      },
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
          source: q.exam ? `${q.exam.bcsNo === 10 ? "১০ম" : `${q.exam.bcsNo}তম`} বিসিএস, প্রশ্ন ${q.examQNo}` : q.source,
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
    taskKind: first.task?.kind ?? null,
    taskTitle: first.task?.titleBn ?? KIND_TITLE[first.kind],
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
