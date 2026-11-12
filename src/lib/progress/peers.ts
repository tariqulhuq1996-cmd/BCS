import type { PrismaClient } from "@prisma/client";
import { numify } from "../sql";

/**
 * অন্যদের তুলনায় অবস্থান — নাম ছাড়া, শুধু "শীর্ষ কত %"।
 * অন্তত MIN_PEERS জন তুলনীয় শিক্ষার্থী না থাকলে কিছুই দেখানো হয় না (কাউকে চেনা না যায়, আর অর্থবহ হয়)।
 */
export const MIN_PEERS = 5;

/** "শীর্ষ x%": আমার চেয়ে ভালো কতজন, তার ভিত্তিতে (সমান হলে সুবিধা আমার)। বিশুদ্ধ হিসাব। */
export function topPercent(mine: number, all: number[]): number | null {
  if (all.length < MIN_PEERS) return null;
  const better = all.filter((v) => v > mine).length;
  return Math.max(1, Math.ceil(((better + 1) / all.length) * 100));
}

/** মূল পথে কতগুলো ধাপ সম্পন্ন — সক্রিয় শিক্ষার্থীদের (অন্তত একটি ধাপ শেষ) মধ্যে অবস্থান। */
export async function progressRank(db: PrismaClient, userId: string) {
  const rows = numify(
    await db.$queryRaw<{ userId: string; n: number }[]>`
      select p.userId, count(*) as n
      from StudentTaskProgress p join User u on u.id = p.userId
      where p.state = 'COMPLETED' and u.role = 'STUDENT' and u.disabled = false
      group by p.userId`,
  );
  const mine = rows.find((r) => r.userId === userId)?.n ?? 0;
  if (!mine) return null;
  const top = topPercent(mine, rows.map((r) => r.n));
  return top == null ? null : { top, peers: rows.length };
}

/** একটি Model Test-এ নেট নম্বরে অবস্থান — প্রত্যেকের প্রথম জমা দেওয়া চেষ্টা ধরে। */
export async function modelTestRank(db: PrismaClient, userId: string, taskId: number) {
  const rows = numify(
    await db.$queryRaw<{ userId: string; net: number }[]>`
      select t.userId, t.netScore as net
      from TestAttempt t
      join (
        select userId, min(submittedAt) as first from TestAttempt
        where taskId = ${taskId} and kind = 'MODEL_TEST' and submittedAt is not null
        group by userId
      ) f on f.userId = t.userId and f.first = t.submittedAt
      join User u on u.id = t.userId
      where t.taskId = ${taskId} and t.kind = 'MODEL_TEST' and u.role = 'STUDENT'`,
  );
  const me = rows.find((r) => r.userId === userId);
  if (!me) return null;
  const top = topPercent(me.net ?? 0, rows.map((r) => r.net ?? 0));
  return top == null ? null : { top, peers: rows.length };
}
