import type { PrismaClient } from "@prisma/client";
import { asLesson } from "./lesson";

/** Pre BCS Writing Practice — বিষয়ের ক্রম ও কার্ডের রং (শিরোনাম-ব্যান্ড)। */
export const WRITING_SUBJECTS = [
  { code: "BN", name: "বাংলা", short: "বাংলা", marks: 200, band: "from-[#4a1f7a] to-[#7a3fb3]" },
  { code: "EN", name: "ইংরেজি", short: "English", marks: 200, band: "from-[#1638a8] to-[#2f5be0]" },
  { code: "BD", name: "বাংলাদেশ বিষয়াবলি", short: "বাংলাদেশ", marks: 200, band: "from-[#0d5c45] to-[#1f8a63]" },
  { code: "IA", name: "আন্তর্জাতিক বিষয়াবলি", short: "আন্তর্জাতিক", marks: 100, band: "from-[#6b2fa0] to-[#9a5cd6]" },
  { code: "MM", name: "গাণিতিক যুক্তি ও মানসিক দক্ষতা", short: "গণিত ও মানসিক", marks: 100, band: "from-[#8a3a12] to-[#c8651f]" },
  { code: "SC", name: "সাধারণ বিজ্ঞান ও প্রযুক্তি", short: "বিজ্ঞান ও প্রযুক্তি", marks: 100, band: "from-[#0b5a7a] to-[#1d8fb8]" },
] as const;
export type WritingSubjectCode = (typeof WRITING_SUBJECTS)[number]["code"];
export const subjectOf = (code: string) => WRITING_SUBJECTS.find((s) => s.code === code);

export type CardState = "read" | "open" | "locked";
export type CardSummary = { code: string; order: number; title: string; section: string; paper: string | null; kind: string | null; hasInfo: boolean; lessonTheme: string | null; lessonTopic: string | null; state: CardState };

/** দৈনিক লেখার পাঠের বিষয় (ইংরেজি): টাইল ও পাতায় "Day 02" ধাঁচ */
export const LESSON_SUBJECTS = new Set(["EN"]);
export const dayLabel = (order: number) => `Day ${String(order).padStart(2, "0")}`;

/**
 * ক্রমানুসারে খোলা: বিষয়ের প্রথম কার্ড সবসময় খোলা; কোনো কার্ড খোলে যখন তার আগের কার্ড পড়া শেষ।
 * অ্যাডমিনের জন্য সব কার্ড খোলা।
 */
function states<T extends { id: number }>(cards: T[], read: Set<number>, admin: boolean): CardState[] {
  return cards.map((c, i) => (read.has(c.id) ? "read" : admin || i === 0 || read.has(cards[i - 1].id) ? "open" : "locked"));
}

export async function getOverview(db: PrismaClient, userId: string) {
  const [counts, reads] = await Promise.all([
    db.writingCard.groupBy({ by: ["subject"], _count: true }),
    db.writingCardRead.findMany({ where: { userId }, select: { card: { select: { subject: true } } } }),
  ]);
  const total = new Map(counts.map((c) => [c.subject, c._count]));
  const done = new Map<string, number>();
  for (const r of reads) done.set(r.card.subject, (done.get(r.card.subject) ?? 0) + 1);
  return WRITING_SUBJECTS.map((s) => ({ ...s, total: total.get(s.code) ?? 0, read: done.get(s.code) ?? 0 }));
}

export async function getSubjectCards(db: PrismaClient, userId: string, subject: string, admin: boolean): Promise<CardSummary[]> {
  const cards = await db.writingCard.findMany({
    where: { subject },
    orderBy: { order: "asc" },
    select: { id: true, code: true, order: true, title: true, section: true, paper: true, kind: true, info: true, lesson: true },
  });
  const read = new Set((await db.writingCardRead.findMany({ where: { userId, cardId: { in: cards.map((c) => c.id) } }, select: { cardId: true } })).map((r) => r.cardId));
  const st = states(cards, read, admin);
  return cards.map((c, i) => ({ code: c.code, order: c.order, title: c.title, section: c.section, paper: c.paper, kind: c.kind, hasInfo: !!c.info || !!c.lesson, lessonTheme: asLesson(c.lesson)?.theme ?? null, lessonTopic: asLesson(c.lesson)?.topic ?? null, state: st[i] }));
}

/** একটি কার্ড, তার অবস্থা এবং আগের/পরের কার্ড। কার্ড না থাকলে null। */
export async function getCard(db: PrismaClient, userId: string, code: string, admin: boolean) {
  const card = await db.writingCard.findUnique({ where: { code } });
  if (!card) return null;
  const list = await getSubjectCards(db, userId, card.subject, admin);
  const i = list.findIndex((c) => c.code === code);
  const firstOpen = list.find((c) => c.state === "open") ?? null;
  return { card, state: list[i].state, prev: list[i - 1] ?? null, next: list[i + 1] ?? null, firstOpen, position: i + 1, total: list.length, readCount: list.filter((c) => c.state === "read").length };
}

/** পড়া শেষ চিহ্নিত করা — কেবল খোলা কার্ডে। ফেরত: পরের কার্ডের কোড (থাকলে)। */
export async function markRead(db: PrismaClient, userId: string, code: string, admin: boolean): Promise<{ ok: boolean; next: string | null }> {
  const c = await getCard(db, userId, code, admin);
  if (!c || c.state === "locked") return { ok: false, next: null };
  if (c.state === "open") await db.writingCardRead.upsert({ where: { userId_cardId: { userId, cardId: c.card.id } }, create: { userId, cardId: c.card.id }, update: {} });
  return { ok: true, next: c.next?.code ?? null };
}
