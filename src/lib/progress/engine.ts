import type { Prisma, PrismaClient, TaskState } from "@prisma/client";
import { withWriteRetry } from "@/lib/db-retry";

/**
 * Unlock-ইঞ্জিন — সব সিদ্ধান্ত সার্ভারে, ডেটাবেসের ওপর।
 *
 * নিয়ম:
 *  - কোনো কাজের অবস্থা-সারি না থাকলে সেটি LOCKED।
 *  - পূর্বশর্তহীন কাজ (১০ম BCS) শিক্ষার্থীর জন্য প্রথমেই AVAILABLE।
 *  - একটি কাজ COMPLETED হলে, যেসব কাজের সব পূর্বশর্ত এখন COMPLETED, সেগুলো AVAILABLE হয় — একই Transaction-এ।
 *  - অ্যাডমিন হাতে Unlock করলে overrideBy/overrideAt-সহ AVAILABLE হয়।
 *
 * ফাংশনগুলো PrismaClient বা Transaction-ক্লায়েন্ট নেয়, যাতে স্বয়ংক্রিয় পরীক্ষায় আলাদা করে চালানো যায়।
 */
type Db = PrismaClient | Prisma.TransactionClient;

export const OPEN_STATES: TaskState[] = ["AVAILABLE", "IN_PROGRESS", "COMPLETED"];

/**
 * শিক্ষার্থীর যাত্রা শুরু: পূর্বশর্তহীন সব সক্রিয় কাজ (ধাপ ০: প্রশ্ন-বিশ্লেষণ) AVAILABLE। বারবার ডাকা নিরাপদ।
 * পুরোনো শিক্ষার্থী (ধাপ ০ যোগ হওয়ার আগে যারা শুরু করেছে) আটকে যান না: তাঁদের ধাপ ০ সম্পন্ন ধরা হয়,
 * আর যাঁদের Level 1 Final আগেই খোলা, তাঁদের Repeat Mastery-ও সম্পন্ন ধরা হয়।
 */
export async function ensureStarted(db: Db, userId: string) {
  const [roots, rows] = await Promise.all([
    db.learningTask.findMany({ where: { active: true, prerequisites: { none: {} } }, select: { id: true, kind: true } }),
    db.studentTaskProgress.findMany({ where: { userId }, select: { taskId: true, state: true, task: { select: { key: true } } } }),
  ]);
  const has = new Set(rows.map((r) => r.taskId));
  const now = new Date();
  const put = (taskId: number, state: TaskState) =>
    withWriteRetry(() =>
      db.studentTaskProgress.upsert({
        where: { userId_taskId: { userId, taskId } },
        update: {},
        create: { userId, taskId, state, unlockedAt: now, ...(state === "COMPLETED" ? { step: "DONE" as const, completedAt: now } : {}) },
      }),
    );
  const legacy = rows.some((r) => !/^(L0:|CA:)/.test(r.task.key));
  const byKey = async (keys: string[]) => db.learningTask.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });

  for (const r of roots) {
    if (has.has(r.id)) continue;
    if (legacy && r.kind === "L0_ORIENTATION") {
      await put(r.id, "COMPLETED");
      for (const t of await byKey(["L0:DIAGNOSTIC", "CA:GATE"])) if (!has.has(t.id)) await put(t.id, t.key === "CA:GATE" ? "AVAILABLE" : "COMPLETED");
    } else await put(r.id, "AVAILABLE");
  }
  // Repeat Mastery যোগ হওয়ার আগেই যাঁদের Level 1 Final খুলেছে
  const final = rows.find((r) => r.task.key === "L1:FINAL" && r.state !== "LOCKED");
  if (final) for (const t of await byKey(["L1:REPEAT"])) if (!has.has(t.id)) await put(t.id, "COMPLETED");
}

/** একটি কাজ শিক্ষার্থী খুলতে পারবে কি না (সার্ভার-সাইড প্রবেশ-যাচাই)। */
export async function canAccess(db: Db, userId: string, taskId: number): Promise<boolean> {
  const p = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId } }, select: { state: true } });
  return !!p && OPEN_STATES.includes(p.state);
}

/** কাজ শুরু হলে AVAILABLE → IN_PROGRESS। */
export async function markStarted(db: Db, userId: string, taskId: number) {
  await db.studentTaskProgress.updateMany({
    where: { userId, taskId, state: "AVAILABLE" },
    data: { state: "IN_PROGRESS", startedAt: new Date() },
  });
}

/**
 * কাজ সম্পন্ন করা এবং পরের কাজ খোলা। প্রবেশাধিকার না থাকলে ত্রুটি।
 * ফেরত দেয়: নতুন খোলা কাজের id-তালিকা।
 */
export async function completeTask(db: PrismaClient, userId: string, taskId: number): Promise<number[]> {
  // একযোগে একই কাজ সম্পন্ন হলে MariaDB লেনদেন বাতিল করে — পুরো লেনদেন আবার (দ্বিতীয়বার "আগেই সম্পন্ন" দেখে কিছু বদলায় না)
  return withWriteRetry(() => db.$transaction(async (tx) => {
    const cur = await tx.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId } } });
    if (!cur || !OPEN_STATES.includes(cur.state)) throw new Error("LOCKED_TASK");
    if (cur.state !== "COMPLETED") {
      await tx.studentTaskProgress.update({
        where: { userId_taskId: { userId, taskId } },
        data: { state: "COMPLETED", step: "DONE", completedAt: new Date() },
      });
    }
    return unlockReady(tx, userId, taskId);
  }));
}

/** taskId-এর ওপর নির্ভরশীল যেসব কাজের সব পূর্বশর্ত শেষ, সেগুলো খোলা। */
async function unlockReady(tx: Db, userId: string, taskId: number): Promise<number[]> {
  const dependents = await tx.taskPrerequisite.findMany({
    where: { requiresId: taskId, task: { active: true } },
    select: { taskId: true, task: { select: { prerequisites: { select: { requiresId: true, requires: { select: { active: true } } } } } } },
  });
  if (!dependents.length) return [];
  const needed = [...new Set(dependents.flatMap((d) => d.task.prerequisites.map((p) => p.requiresId)))];
  const done = new Set(
    (await tx.studentTaskProgress.findMany({ where: { userId, taskId: { in: needed }, state: "COMPLETED" }, select: { taskId: true } })).map((x) => x.taskId),
  );
  const opened: number[] = [];
  for (const d of dependents) {
    // নিষ্ক্রিয় (অ্যাডমিন বন্ধ করেছেন) পূর্বশর্ত পূরণ হয়েছে বলে ধরা হয়
    if (!d.task.prerequisites.every((p) => done.has(p.requiresId) || !p.requires.active || p.requiresId === taskId)) continue;
    const existing = await tx.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId: d.taskId } } });
    if (existing && existing.state !== "LOCKED") continue;
    await tx.studentTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId: d.taskId } },
      update: { state: "AVAILABLE", unlockedAt: new Date() },
      create: { userId, taskId: d.taskId, state: "AVAILABLE", unlockedAt: new Date() },
    });
    opened.push(d.taskId);
  }
  return opened;
}

/**
 * অ্যাডমিন কোনো ধাপ নিষ্ক্রিয় করলে: যেসব শিক্ষার্থী ঐ ধাপে আছে বা যাদের জন্য ধাপটি খোলা,
 * তাদের পরের ধাপ খুলে দেওয়া (নিষ্ক্রিয় ধাপ যেন কাউকে আটকে না রাখে)। ফেরত: কতজনের জন্য কিছু খুলেছে।
 */
export async function reconcileDeactivated(db: PrismaClient, taskId: number): Promise<number> {
  const rows = await db.studentTaskProgress.findMany({ where: { taskId, state: { in: ["AVAILABLE", "IN_PROGRESS"] } }, select: { userId: true } });
  let n = 0;
  for (const r of rows) {
    const opened = await db.$transaction((tx) => unlockReady(tx, r.userId, taskId));
    if (opened.length) n++;
  }
  return n;
}

/**
 * অ্যাডমিন হিসেবে লগইন করলে কোনো ধাপ তালাবন্ধ থাকে না: সব সক্রিয় কাজ (পরে যোগ হওয়া কাজসহ) AVAILABLE।
 * সম্পন্ন/চলমান কাজের অবস্থা বদলায় না। অ্যাডমিন না হলে কিছু করে না। ফেরত: অ্যাডমিন কি না।
 */
export async function unlockAllForAdmin(db: Db, userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "ADMIN") return false;
  const [tasks, rows] = await Promise.all([
    db.learningTask.findMany({ where: { active: true }, select: { id: true } }),
    db.studentTaskProgress.findMany({ where: { userId }, select: { taskId: true, state: true } }),
  ]);
  const has = new Set(rows.map((r) => r.taskId));
  const now = new Date();
  const missing = tasks.filter((t) => !has.has(t.id));
  if (missing.length) await db.studentTaskProgress.createMany({ data: missing.map((t) => ({ userId, taskId: t.id, state: "AVAILABLE" as const, unlockedAt: now })), skipDuplicates: true });
  if (rows.some((r) => r.state === "LOCKED")) await db.studentTaskProgress.updateMany({ where: { userId, state: "LOCKED" }, data: { state: "AVAILABLE", unlockedAt: now } });
  return true;
}

/** অ্যাডমিনের হাতে Unlock (বিশেষ পরিস্থিতি) — Audit Log-সহ। */
export async function manualUnlock(db: PrismaClient, userId: string, taskId: number, adminId: string) {
  await db.$transaction([
    db.studentTaskProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      update: { state: "AVAILABLE", overrideBy: adminId, overrideAt: new Date(), unlockedAt: new Date() },
      create: { userId, taskId, state: "AVAILABLE", overrideBy: adminId, overrideAt: new Date(), unlockedAt: new Date() },
    }),
    db.auditLog.create({ data: { actorId: adminId, action: "manual_unlock", entity: "StudentTaskProgress", entityId: `${userId}:${taskId}` } }),
  ]);
}
