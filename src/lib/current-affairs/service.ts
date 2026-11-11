/**
 * Current Affairs-এর স্মার্ট অনুশীলন। "server-only" নয় (স্বয়ংক্রিয় পরীক্ষার জন্য); ডেটাবেস-ক্লায়েন্ট প্যারামিটারে আসে।
 */
import type { PriorityGrade, PrismaClient } from "@prisma/client";
import { withWriteRetry } from "../db-retry";

/** Leitner-বাক্স অনুযায়ী পরের পুনরাবৃত্তি (দিন): ঠিক হলে বাক্স বাড়ে, ভুল হলে ১-এ ফেরে */
const BOX_DAYS = [1, 3, 7, 14, 30];
export const MASTERED_BOX = 3; // পরপর অন্তত দুবার ঠিক
export const SET_SIZE = 20;
/** প্রশ্নব্যাংকের যাচাই এর চেয়ে পুরোনো হলে সতর্কতা */
export const STALE_DAYS = 45;

export type CaMode = "smart" | "wrong" | "new" | "all";
export const MODES: Record<CaMode, string> = {
  smart: "স্মার্ট অনুশীলন",
  wrong: "ভুলগুলো আবার",
  new: "নতুন প্রশ্ন",
  all: "সব প্রশ্ন",
};

export type CaPublicQuestion = {
  id: string;
  no: number;
  bank: string;
  chapter: string;
  priority: PriorityGrade;
  text: string;
  statements: string[];
  stemTail: string | null;
  options: string[];
  volatile: boolean;
  /** উপস্থাপনের ক্রম → মূল অপশন-সূচক (i/ii/iii ও "সবগুলো"-ধরনের প্রশ্নে এলোমেলো করা হয় না) */
  order: number[];
};

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const NO_SHUFFLE = /সবগুলো|সবকটি|সব কটি|সবই|কোনোটিই|কোনটিই|উভয়|উপরের|ওপরের/;

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type CaBankInfo = { key: string; name: string; title: string; version: string | null; verifiedBn: string | null; verifiedOn: Date | null; importedAt: Date };

/** সব প্রশ্নব্যাংক (প্রতিটির সর্বশেষ Import-এর তথ্য) — প্রথম যুক্ত হওয়ার ক্রমে */
export async function listBanks(db: PrismaClient): Promise<CaBankInfo[]> {
  const rows = await db.caBank.findMany({ orderBy: { importedAt: "asc" } });
  const by = new Map<string, CaBankInfo>();
  for (const r of rows) by.set(r.bankKey, { key: r.bankKey, name: r.name ?? r.title, title: r.title, version: r.version, verifiedBn: r.verifiedBn, verifiedOn: r.verifiedOn, importedAt: r.importedAt });
  return [...by.values()];
}

export async function latestBank(db: PrismaClient, bankKey?: string) {
  return db.caBank.findFirst({ where: bankKey ? { bankKey } : {}, orderBy: { importedAt: "desc" } });
}

export function isStale(verifiedOn: Date | null | undefined, now = new Date()) {
  return !!verifiedOn && now.getTime() - verifiedOn.getTime() > STALE_DAYS * 864e5;
}

/** সারসংক্ষেপ: অধ্যায়ভিত্তিক মোট/দেখা/আয়ত্ত, আর স্মার্ট সেটে কী আছে */
export async function getOverview(db: PrismaClient, userId: string) {
  const now = new Date();
  const [banks, chapters, answers] = await Promise.all([
    listBanks(db),
    db.caChapter.findMany({ orderBy: [{ bankKey: "asc" }, { no: "asc" }], include: { questions: { where: { active: true }, select: { id: true, priority: true, volatile: true } } } }),
    db.caAnswer.findMany({ where: { userId, question: { active: true } }, select: { questionId: true, box: true, lastCorrect: true, dueAt: true } }),
  ]);
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const rows = chapters
    .filter((c) => c.questions.length)
    .map((c) => {
      const qs = c.questions;
      const seen = qs.filter((q) => byQ.has(q.id)).length;
      const mastered = qs.filter((q) => (byQ.get(q.id)?.box ?? 0) >= MASTERED_BOX).length;
      const wrong = qs.filter((q) => byQ.get(q.id)?.lastCorrect === false).length;
      const pr = (g: PriorityGrade) => qs.filter((q) => q.priority === g).length;
      return { bank: c.bankKey, no: c.no, name: c.nameBn, total: qs.length, seen, mastered, wrong, a: pr("A"), b: pr("B"), c: pr("C") };
    });
  const bankRows = banks
    .map((b) => {
      const ch = rows.filter((r) => r.bank === b.key);
      const sum = (k: "total" | "seen" | "mastered" | "wrong") => ch.reduce((a, r) => a + r[k], 0);
      return { ...b, stale: isStale(b.verifiedOn, now), chapters: ch, total: sum("total"), seen: sum("seen"), mastered: sum("mastered"), wrong: sum("wrong") };
    })
    .filter((b) => b.total > 0);
  const all = chapters.flatMap((c) => c.questions);
  const unseenA = all.filter((q) => q.priority === "A" && !byQ.has(q.id)).length;
  return {
    banks: bankRows,
    stale: bankRows.some((b) => b.stale),
    total: all.length,
    seen: answers.length,
    mastered: answers.filter((a) => a.box >= MASTERED_BOX).length,
    wrong: answers.filter((a) => !a.lastCorrect).length,
    due: answers.filter((a) => a.lastCorrect && a.dueAt <= now).length,
    unseen: all.length - answers.length,
    unseenA,
    volatile: all.filter((q) => q.volatile).length,
    priority: { A: all.filter((q) => q.priority === "A").length, B: all.filter((q) => q.priority === "B").length, C: all.filter((q) => q.priority === "C").length },
  };
}

/**
 * অনুশীলনের সেট বাছাই। স্মার্ট ক্রম:
 *  ১. শেষবার ভুল হয়েছে  ২. পুনরাবৃত্তির সময় হয়েছে  ৩. নতুন — Priority A → B → C  ৪. বাকিগুলো (সবচেয়ে আগে যার সময় আসবে)
 */
export async function pickSet(db: PrismaClient, userId: string, opts: { mode: CaMode; bank?: string; chapter?: number; priority?: PriorityGrade }): Promise<CaPublicQuestion[]> {
  const now = new Date();
  const qs = await db.caQuestion.findMany({
    where: {
      active: true,
      ...(opts.bank ? { bankKey: opts.bank } : {}),
      ...(opts.chapter ? { chapter: { no: opts.chapter } } : {}),
      ...(opts.priority ? { priority: opts.priority } : {}),
    },
    include: { chapter: { select: { nameBn: true } }, answers: { where: { userId }, select: { box: true, lastCorrect: true, dueAt: true } } },
    orderBy: [{ bankKey: "asc" }, { no: "asc" }],
  });
  const bankNames = new Map((await listBanks(db)).map((b) => [b.key, b.name]));
  const pRank = { A: 0, B: 1, C: 2, D: 3 } as const;
  const rank = (q: (typeof qs)[number]) => {
    const a = q.answers[0];
    if (!a) return [2, pRank[q.priority], q.no];
    if (!a.lastCorrect) return [0, a.dueAt.getTime(), q.no];
    if (a.dueAt <= now) return [1, a.dueAt.getTime(), q.no];
    return [3, a.dueAt.getTime(), q.no];
  };
  let pool = qs;
  if (opts.mode === "wrong") pool = qs.filter((q) => q.answers[0] && !q.answers[0].lastCorrect);
  if (opts.mode === "new") pool = qs.filter((q) => !q.answers[0]);
  const sorted =
    opts.mode === "all"
      ? pool
      : [...pool].sort((x, y) => {
          const a = rank(x), b = rank(y);
          return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
        });
  return sorted.slice(0, opts.mode === "all" ? undefined : SET_SIZE).map((q) => {
    const options = asStrings(q.options);
    const statements = asStrings(q.statements);
    const fixed = statements.length > 0 || options.some((o) => NO_SHUFFLE.test(o));
    return {
      id: q.id,
      no: q.no,
      bank: bankNames.get(q.bankKey) ?? q.bankKey,
      chapter: q.chapter.nameBn,
      priority: q.priority,
      text: q.text,
      statements,
      stemTail: q.stemTail,
      volatile: q.volatile,
      order: fixed ? options.map((_, i) => i) : shuffled(options.length),
      options,
    };
  });
}

export type CaFeedback = {
  correct: boolean;
  correctIndex: number;
  explanation: string | null;
  remember: string | null;
  sourceText: string | null;
  eventDate: string | null;
  verifiedBn: string | null;
  volatileReason: string | null;
  box: number;
  nextInDays: number;
};

/** উত্তর যাচাই ও হিসাব হালনাগাদ (সঠিক উত্তর ক্লায়েন্টে আগে পাঠানো হয় না) */
export async function answerQuestion(db: PrismaClient, userId: string, questionId: string, choice: number): Promise<CaFeedback | null> {
  const q = await db.caQuestion.findFirst({ where: { id: questionId, active: true } });
  if (!q || !Number.isInteger(choice) || choice < 0 || choice > 3) return null;
  const correct = choice === q.correctIndex;
  let box = 1;
  await withWriteRetry(async () => {
    const prev = await db.caAnswer.findUnique({ where: { userId_questionId: { userId, questionId } } });
    box = correct ? Math.min((prev?.box ?? 0) + 1, BOX_DAYS.length) : 1;
  // ভুল হলে আজই আবার (১০ মিনিট পরে স্মার্ট সেটে আগে আসবে)
    const dueAt = new Date(Date.now() + (correct ? BOX_DAYS[box - 1] * 864e5 : 10 * 60e3));
    await db.caAnswer.upsert({
    where: { userId_questionId: { userId, questionId } },
    update: { seen: { increment: 1 }, correct: { increment: correct ? 1 : 0 }, lastCorrect: correct, box, dueAt, lastAt: new Date() },
    create: { userId, questionId, seen: 1, correct: correct ? 1 : 0, lastCorrect: correct, box, dueAt },
  });
  });
  return {
    correct,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    remember: q.remember,
    sourceText: q.sourceText,
    eventDate: q.eventDate,
    verifiedBn: q.verifiedBn,
    volatileReason: q.volatile ? q.volatileReason ?? "তথ্যটি সময়ের সঙ্গে বদলাতে পারে" : null,
    box,
    nextInDays: correct ? BOX_DAYS[box - 1] : 0,
  };
}
