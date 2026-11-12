import type { PrismaClient } from "@prisma/client";
import { numify } from "../sql";

/**
 * পড়ার ধারাবাহিকতা (ঢাকার সময়ে দিন ধরে):
 *  - "পড়ার দিন" = সেদিন অন্তত একটি পরীক্ষা/অনুশীলন জমা দেওয়া বা সাম্প্রতিক বিষয়াবলির প্রশ্নের উত্তর
 *  - টানা দিন: আজ থেকে পেছনে; আজ এখনো না পড়লেও গতকাল পর্যন্ত টানা থাকলে ধারা ভাঙে না
 *  - আজকের মিনিট: আজ শুরু করা পরীক্ষাগুলোর প্রশ্নে কাটানো সময়ের যোগফল
 */
const DHAKA_MS = 6 * 3600e3;
export const dhakaDayKey = (d: Date) => new Date(d.getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** ঢাকার আজকের দিনের শুরু (UTC সময়-বিন্দু)। */
export function dhakaDayStart(now = new Date()) {
  const k = dhakaDayKey(now);
  return new Date(new Date(`${k}T00:00:00Z`).getTime() - DHAKA_MS);
}

/** দিনের তালিকা থেকে টানা দিন ও সবচেয়ে দীর্ঘ ধারা (বিশুদ্ধ হিসাব — পরীক্ষাযোগ্য)। */
export function computeStreak(dayKeys: Iterable<string>, today: string) {
  const days = new Set(dayKeys);
  const prev = (k: string) => new Date(new Date(`${k}T00:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10);
  let cur = 0;
  let k = days.has(today) ? today : prev(today);
  while (days.has(k)) {
    cur++;
    k = prev(k);
  }
  let best = 0;
  const sorted = [...days].sort();
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && prev(sorted[i]) === sorted[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current: cur, best, studiedToday: days.has(today) };
}

export async function getStudyStats(db: PrismaClient, userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 400 * 864e5);
  const start = dhakaDayStart(now);
  const [testDays, caDays, todayMs, profile] = await Promise.all([
    db.$queryRaw<{ d: string }[]>`
      select distinct date_format(submittedAt + interval 6 hour, '%Y-%m-%d') as d
      from TestAttempt where userId = ${userId} and submittedAt >= ${since}`,
    db.$queryRaw<{ d: string }[]>`
      select distinct date_format(lastAt + interval 6 hour, '%Y-%m-%d') as d
      from CaAnswer where userId = ${userId} and lastAt >= ${since}`,
    db.$queryRaw<{ ms: number | null }[]>`
      select coalesce(sum(aa.timeMs), 0) as ms
      from AttemptAnswer aa join TestAttempt ta on ta.id = aa.attemptId
      where ta.userId = ${userId} and ta.startedAt >= ${start}`.then((r) => numify(r)),
    db.studentProfile.findUnique({ where: { userId }, select: { dailyGoalMin: true } }),
  ]);
  const s = computeStreak([...testDays, ...caDays].map((r) => r.d), dhakaDayKey(now));
  const minutesToday = Math.round((todayMs[0]?.ms ?? 0) / 60e3);
  const goal = profile?.dailyGoalMin ?? 120;
  return { ...s, minutesToday, goal, goalPct: Math.min(100, (minutesToday / Math.max(1, goal)) * 100) };
}
