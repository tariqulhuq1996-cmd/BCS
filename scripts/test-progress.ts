/**
 * Unlock-ইঞ্জিনের স্বয়ংক্রিয় পরীক্ষা (আসল ডেটাবেসে, অস্থায়ী পরীক্ষার্থী দিয়ে; শেষে মুছে ফেলা হয়)।
 *   npm run test:progress
 */
import { PrismaClient } from "@prisma/client";
import { canAccess, completeTask, ensureStarted, manualUnlock } from "../src/lib/progress/engine";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + info}`);
};

async function main() {
  const tag = `t${Date.now()}`;
  const mk = (n: string) => db.user.create({ data: { email: `${tag}-${n}@progress.test`, passwordHash: "x", profile: { create: { name: n } } } });
  const a = await mk("a");
  const b = await mk("b");
  const admin = await db.user.create({ data: { email: `${tag}-admin@progress.test`, passwordHash: "x", role: "ADMIN" } });
  const T = async (key: string) => (await db.learningTask.findUniqueOrThrow({ where: { key } })).id;
  const state = async (u: string, key: string) =>
    (await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId: u, taskId: await T(key) } } }))?.state ?? "LOCKED";

  try {
    await ensureStarted(db, a.id);
    await ensureStarted(db, a.id); // দ্বিতীয়বার ডাকলেও কিছু বদলাবে না
    const open = await db.studentTaskProgress.findMany({ where: { userId: a.id }, include: { task: true } });
    check("শুরুতে শুধু ধাপ ০ (প্রশ্ন-বিশ্লেষণ) খোলা", open.length === 1 && open[0].task.key === "L0:ORIENT", JSON.stringify(open.map((o) => o.task.key)));
    check("১০ম BCS তালাবন্ধ (ধাপ ০ বাকি)", !(await canAccess(db, a.id, await T("L1:EXAM:10"))));
    await completeTask(db, a.id, await T("L0:ORIENT"));
    check("প্রশ্ন-বিশ্লেষণ শেষ → শুরুর মূল্যায়ন ও সাম্প্রতিক বিষয়াবলি খোলে", (await state(a.id, "L0:DIAGNOSTIC")) === "AVAILABLE" && (await state(a.id, "CA:GATE")) === "AVAILABLE");
    check("মূল্যায়নের আগে ১০ম BCS তালাবন্ধ", (await state(a.id, "L1:EXAM:10")) === "LOCKED");
    await completeTask(db, a.id, await T("L0:DIAGNOSTIC"));
    check("মূল্যায়ন শেষ → ১০ম BCS খোলে", (await state(a.id, "L1:EXAM:10")) === "AVAILABLE");
    check("১১তম BCS তালাবন্ধ", !(await canAccess(db, a.id, await T("L1:EXAM:11"))));
    check("Level 2 তালাবন্ধ", !(await canAccess(db, a.id, await T("L2:SUB:BN.BH.SHD"))));

    let threw = false;
    try { await completeTask(db, a.id, await T("L1:EXAM:12")); } catch { threw = true; }
    check("তালাবন্ধ কাজ সম্পন্ন করা যায় না", threw && (await state(a.id, "L1:EXAM:12")) === "LOCKED");

    const opened = await completeTask(db, a.id, await T("L1:EXAM:10"));
    check("১০ম শেষ → ১১তম খোলে", (await state(a.id, "L1:EXAM:11")) === "AVAILABLE" && opened.length === 1);
    check("১০ম শেষ → ১২তম এখনও তালাবন্ধ", (await state(a.id, "L1:EXAM:12")) === "LOCKED");
    const again = await completeTask(db, a.id, await T("L1:EXAM:10"));
    check("একই কাজ আবার সম্পন্ন করলে নতুন কিছু খোলে না", again.length === 0);

    await ensureStarted(db, b.id);
    check("অন্য শিক্ষার্থীর অগ্রগতি আলাদা", (await state(b.id, "L1:EXAM:11")) === "LOCKED" && (await state(b.id, "L1:EXAM:10")) === "LOCKED");

    // ১১তম–৫০তম শেষ
    const exams = await db.learningTask.findMany({ where: { kind: "L1_EXAM" }, orderBy: { order: "asc" } });
    for (const e of exams.slice(1, -1)) await completeTask(db, a.id, e.id);
    check("৪৯তম শেষ হলেও Final তালাবন্ধ (৫০তম বাকি)", (await state(a.id, "L1:FINAL")) === "LOCKED");
    await completeTask(db, a.id, exams.at(-1)!.id);
    check("৫০তম শেষ → Repeat Mastery খোলে, Final তখনও তালাবন্ধ", (await state(a.id, "L1:REPEAT")) === "AVAILABLE" && (await state(a.id, "L1:FINAL")) === "LOCKED");
    await completeTask(db, a.id, await T("L1:REPEAT"));
    check("Repeat Mastery শেষ → Level 1 Final খোলে", (await state(a.id, "L1:FINAL")) === "AVAILABLE");
    check("Final-এর আগে Level 2 তালাবন্ধ", (await state(a.id, "L2:SUB:BN.BH.SHD")) === "LOCKED");

    await completeTask(db, a.id, await T("L1:FINAL"));
    const phaseA = await db.learningTask.findMany({ where: { kind: "L2_SUBTOPIC", phase: 1 } });
    const phaseB = await db.learningTask.findMany({ where: { kind: "L2_SUBTOPIC", phase: 2 } });
    const openA = await db.studentTaskProgress.count({ where: { userId: a.id, taskId: { in: phaseA.map((t) => t.id) }, state: "AVAILABLE" } });
    check(`Level 1 শেষ → Priority A-র ${phaseA.length}টি উপবিষয় একসঙ্গে খোলে`, openA === phaseA.length, `${openA}`);
    check("Priority B তালাবন্ধ", (await db.studentTaskProgress.count({ where: { userId: a.id, taskId: { in: phaseB.map((t) => t.id) } } })) === 0);

    for (const t of phaseA.slice(0, -1)) await completeTask(db, a.id, t.id);
    check("A-র একটি বাকি থাকলে Checkpoint তালাবন্ধ", (await state(a.id, "L2:CHECKPOINT:A")) === "LOCKED");
    await completeTask(db, a.id, phaseA.at(-1)!.id);
    check("A-র সব শেষ → Checkpoint A খোলে", (await state(a.id, "L2:CHECKPOINT:A")) === "AVAILABLE");
    await completeTask(db, a.id, await T("L2:CHECKPOINT:A"));
    const openB = await db.studentTaskProgress.count({ where: { userId: a.id, taskId: { in: phaseB.map((t) => t.id) }, state: "AVAILABLE" } });
    check("Checkpoint A পাস → Priority B খোলে", openB === phaseB.length, `${openB}`);

    await manualUnlock(db, b.id, await T("L1:EXAM:15"), admin.id);
    const ov = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId: b.id, taskId: await T("L1:EXAM:15") } } });
    check("অ্যাডমিনের হাতে Unlock কাজ করে ও রেকর্ড থাকে", ov?.state === "AVAILABLE" && ov.overrideBy === admin.id);
    check("হাতে Unlock অন্য ধাপ খোলে না", (await state(b.id, "L1:EXAM:11")) === "LOCKED");
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: admin.id } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
