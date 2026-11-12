import type { PrismaClient } from "@prisma/client";
import { loadRules } from "@/lib/rules";
import { withWriteRetry } from "@/lib/db-retry";
import { OPEN_STATES, completeTask } from "./engine";

/**
 * শিক্ষার্থীর পূর্ণ যাত্রার পাশের নিয়মগুলো:
 *  - ধাপ ০: প্রশ্ন-বিশ্লেষণের ৫টি অংশে "পড়েছি" → সব হলে ধাপটি সম্পন্ন (শুরুর মূল্যায়ন ও সাম্প্রতিক বিষয়াবলি খোলে)
 *  - সাম্প্রতিক বিষয়াবলির শর্ত (CA:GATE): প্রতিটি প্রশ্নব্যাংকের সব প্রশ্ন অন্তত একবার, আর সর্বশেষ উত্তর সঠিক ≥ নির্ধারিত %
 *  - বারবার আসা প্রশ্ন: যে প্রশ্নের সব রূপ শিক্ষার্থী Level 1-এ সমাধান করেছেন, শুধু সেগুলো খোলা
 * এই ফাইল "server-only" নয় — স্বয়ংক্রিয় পরীক্ষা সরাসরি চালায়; ডেটাবেস-ক্লায়েন্ট প্যারামিটারে আসে।
 */
type Db = PrismaClient;

export const ORIENT_ITEMS = [
  { id: "heatmap", label: "কোন উপবিষয় প্রায় প্রতিবার আসে" },
  { id: "trend", label: "সাম্প্রতিক BCS-এ প্রশ্নের ধারা" },
  { id: "repeats", label: "বারবার আসা প্রশ্ন" },
  { id: "priority", label: "Priority List" },
  { id: "roadmap", label: "পুরো যাত্রার পথ" },
] as const;
export type OrientItem = (typeof ORIENT_ITEMS)[number]["id"];
const ITEM_KEY = (id: string) => `orient:${id}`;

async function taskProgress(db: Db, userId: string, key: string) {
  const task = await db.learningTask.findUnique({ where: { key }, select: { id: true, active: true } });
  if (!task) return null;
  const p = await db.studentTaskProgress.findUnique({ where: { userId_taskId: { userId, taskId: task.id } }, select: { state: true } });
  return { taskId: task.id, active: task.active, state: p?.state ?? "LOCKED" };
}

/** ধাপ ০-এর অবস্থা: কোন অংশ পড়া হয়েছে, ধাপটি সম্পন্ন কি না। */
export async function orientationStatus(db: Db, userId: string) {
  const [rows, tp] = await Promise.all([
    db.studentChecklist.findMany({ where: { userId, item: { startsWith: "orient:" } }, select: { item: true } }),
    taskProgress(db, userId, "L0:ORIENT"),
  ]);
  const checked = new Set(rows.map((r) => r.item.slice("orient:".length)));
  return { checked: ORIENT_ITEMS.filter((i) => checked.has(i.id)).map((i) => i.id) as OrientItem[], done: tp?.state === "COMPLETED" };
}

/** একটি অংশে "পড়েছি" (বা চিহ্ন তুলে নেওয়া)। সব অংশ হলে ধাপ ০ সম্পন্ন; ফেরত: ধাপটি এখন সম্পন্ন কি না। */
export async function setOrientItem(db: Db, userId: string, item: string, on: boolean): Promise<boolean> {
  if (!ORIENT_ITEMS.some((i) => i.id === item)) throw new Error("BAD_ITEM");
  const key = ITEM_KEY(item);
  if (on) await withWriteRetry(() => db.studentChecklist.upsert({ where: { userId_item: { userId, item: key } }, update: {}, create: { userId, item: key } }));
  else await db.studentChecklist.deleteMany({ where: { userId, item: key } });
  const st = await orientationStatus(db, userId);
  if (st.done) return true;
  if (st.checked.length < ORIENT_ITEMS.length) return false;
  const tp = await taskProgress(db, userId, "L0:ORIENT");
  if (!tp || !OPEN_STATES.includes(tp.state)) return false;
  await completeTask(db, userId, tp.taskId);
  return true;
}

export type CaBankGate = { bankKey: string; title: string; total: number; answered: number; correctNow: number; pct: number; met: boolean };

/** সাম্প্রতিক বিষয়াবলির শর্তের অবস্থা — প্রতিটি প্রশ্নব্যাংক আলাদা। */
export async function caGateStatus(db: Db, userId: string) {
  const rules = await loadRules(db);
  const min = rules.get<number>("ca.gate.min_pct");
  const [counts, answers, banks, tp] = await Promise.all([
    db.caQuestion.groupBy({ by: ["bankKey"], where: { active: true }, _count: { _all: true } }),
    db.caAnswer.findMany({ where: { userId, question: { active: true } }, select: { lastCorrect: true, question: { select: { bankKey: true } } } }),
    db.caBank.findMany({ orderBy: { importedAt: "desc" }, select: { bankKey: true, name: true, title: true } }),
    taskProgress(db, userId, "CA:GATE"),
  ]);
  const banksOut: CaBankGate[] = counts
    .map((c) => {
      const mine = answers.filter((a) => a.question.bankKey === c.bankKey);
      const correctNow = mine.filter((a) => a.lastCorrect).length;
      const total = c._count._all;
      const pct = total ? (correctNow / total) * 100 : 0;
      const b = banks.find((x) => x.bankKey === c.bankKey);
      return { bankKey: c.bankKey, title: b?.name || b?.title || c.bankKey, total, answered: mine.length, correctNow, pct, met: total > 0 && mine.length >= total && pct >= min };
    })
    .sort((a, b) => a.bankKey.localeCompare(b.bankKey));
  return { min, banks: banksOut, met: banksOut.length > 0 && banksOut.every((b) => b.met), state: tp?.state ?? "LOCKED" };
}

/**
 * শর্ত পূরণ হলে CA:GATE সম্পন্ন (Level 3-এর প্রথম Model Test-এর একটি পূর্বশর্ত)। সাম্প্রতিক বিষয়াবলির প্রতিটি উত্তরের পর
 * ও Dashboard খুললে ডাকা হয়। একবার সম্পন্ন হলে পরে নতুন প্রশ্নব্যাংক এলেও আর তালাবন্ধ হয় না।
 */
export async function evaluateCaGate(db: Db, userId: string): Promise<boolean> {
  const tp = await taskProgress(db, userId, "CA:GATE");
  if (!tp || tp.state === "COMPLETED") return tp?.state === "COMPLETED";
  if (!OPEN_STATES.includes(tp.state)) return false;
  const st = await caGateStatus(db, userId);
  if (!st.met) return false;
  await completeTask(db, userId, tp.taskId);
  return true;
}

/**
 * বারবার আসা প্রশ্নের কোনগুলো শিক্ষার্থীর জন্য খোলা: যে BCS-গুলোর প্রথম সমাধান শেষ, কোনো প্রশ্ন-পরিবারের সব রূপ
 * সেগুলোর মধ্যে থাকলে খোলা। Repeat Mastery ধাপ খুললে (বা অ্যাডমিন হলে) সবই খোলা। ফেরত: null = সব খোলা।
 */
export async function openRepeatFamilies(db: Db, userId: string, isAdmin = false): Promise<{ open: Set<number> | null; solvedExams: number[] }> {
  if (isAdmin) return { open: null, solvedExams: [] };
  const [repeat, rows] = await Promise.all([
    taskProgress(db, userId, "L1:REPEAT"),
    db.studentTaskProgress.findMany({
      where: { userId, task: { kind: "L1_EXAM" }, OR: [{ state: "COMPLETED" }, { step: { not: "SOLVE" } }] },
      select: { task: { select: { exam: { select: { bcsNo: true } } } } },
    }),
  ]);
  if (repeat && OPEN_STATES.includes(repeat.state)) return { open: null, solvedExams: [] };
  const solved = new Set(rows.map((r) => r.task.exam?.bcsNo).filter((n): n is number => !!n));
  const fams = await db.repeatFamily.findMany({ select: { id: true, members: { select: { question: { select: { exam: { select: { bcsNo: true } } } } } } } });
  const open = new Set<number>();
  for (const f of fams) {
    const nos = f.members.map((m) => m.question.exam?.bcsNo).filter((n): n is number => !!n);
    if (nos.length && nos.every((n) => solved.has(n))) open.add(f.id);
  }
  return { open, solvedExams: [...solved].sort((a, b) => a - b) };
}

/** শেষ দিনগুলোর চূড়ান্ত রিভিশন: পরীক্ষার তারিখ নির্ধারিত থাকলে কত দিন বাকি, আর এখন সেই পর্বে কি না। */
export async function finalStretch(db: Db, now = new Date()) {
  const rules = await loadRules(db);
  const raw = rules.get<string>("journey.exam_date");
  const days = rules.get<number>("journey.final_days");
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { examDate: null, daysLeft: null, active: false, days };
  const exam = new Date(`${raw}T00:00:00+06:00`);
  const daysLeft = Math.ceil((exam.getTime() - now.getTime()) / 864e5);
  return { examDate: raw, daysLeft, active: daysLeft >= 0 && daysLeft <= days, days };
}
