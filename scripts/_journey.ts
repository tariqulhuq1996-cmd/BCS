/**
 * পরীক্ষার সহায়ক: নতুন শিক্ষার্থীকে ধাপ ০ (প্রশ্ন-বিশ্লেষণ ও শুরুর মূল্যায়ন) পার করিয়ে Level 1-এর শুরুতে আনা —
 * যেসব পরীক্ষা Level 1 থেকে শুরু হয়, সেগুলোর জন্য। ধাপ ০-এর নিজস্ব পরীক্ষা test-journey.ts-এ।
 */
import type { PrismaClient } from "@prisma/client";
import { completeTask, ensureStarted } from "../src/lib/progress/engine";

export async function startAtLevel1(db: PrismaClient, userId: string) {
  await ensureStarted(db, userId);
  for (const key of ["L0:ORIENT", "L0:DIAGNOSTIC"]) {
    const t = await db.learningTask.findUniqueOrThrow({ where: { key } });
    await completeTask(db, userId, t.id);
  }
}
