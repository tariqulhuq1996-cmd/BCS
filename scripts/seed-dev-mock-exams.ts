/**
 * শুধু স্থানীয় ডেভেলপমেন্টের জন্য: একটি পরীক্ষামূলক শিক্ষার্থী-অ্যাকাউন্টে কয়েকটি সম্পূর্ণ Model Test (২০০ প্রশ্ন) তৈরি করে,
 * যাতে Performance Dashboard (/performance) ও পরীক্ষা-পরবর্তী বিশ্লেষণ ব্রাউজারে যাচাই করা যায়।
 *
 *   npx tsx scripts/seed-dev-mock-exams.ts            (১২টি Model Test + একটি ৫০ প্রশ্নের শুরুর মূল্যায়ন + ৩টি ২০ প্রশ্নের ভুলের অনুশীলন)
 *   npx tsx scripts/seed-dev-mock-exams.ts --exams 5
 *
 * - উত্তর ও সময় একটি নির্ধারিত (seed-যুক্ত) সিমুলেশন থেকে আসে; গ্রেডিং ও নেট নম্বর হয় আসল ইঞ্জিনে
 *   (saveAnswer → addTime → submitAttempt), তাই হিসাবগুলো বাস্তব পথেই তৈরি।
 * - বারবার চালালে এই অ্যাকাউন্টের আগের সব পরীক্ষা মুছে নতুন করে তৈরি হয় (শুধু এই অ্যাকাউন্টের)।
 * - localhost/127.0.0.1 ছাড়া অন্য ডেটাবেসে চলে না।
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addTime, saveAnswer, submitAttempt } from "../src/lib/exam/service";

const EMAIL = "analytics.demo@bcs52.test";
const PASSWORD = "Analytics-Demo-2026";
const MARKS: Record<string, number> = { BN: 30, EN: 30, BD: 25, IA: 25, GE: 10, SC: 15, IT: 15, MA: 20, MN: 15, ET: 15 };

const db = new PrismaClient();

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) throw new Error("শুধু স্থানীয় ডেটাবেসে চালানো যায়।");
  const examsArg = process.argv.indexOf("--exams");
  const N = examsArg > 0 ? Number(process.argv[examsArg + 1]) : 12;

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, disabled: false },
    create: { email: EMAIL, passwordHash, role: "STUDENT", profile: { create: { name: "বিশ্লেষণ পরীক্ষার্থী" } } },
  });
  const old = await db.testAttempt.findMany({ where: { userId: user.id }, select: { id: true } });
  await db.testAttempt.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  await db.questionStat.deleteMany({ where: { userId: user.id } });

  const pool = await db.question.findMany({
    where: { status: "PUBLISHED", correctIndex: { not: null } },
    select: { id: true, correctIndex: true, difficulty: true, subtopic: { select: { topic: { select: { subject: { select: { code: true } } } } } } },
    orderBy: { uid: "asc" },
  });
  const bySubj = new Map<string, typeof pool>();
  for (const q of pool) {
    const c = q.subtopic.topic.subject.code;
    (bySubj.get(c) ?? bySubj.set(c, []).get(c)!).push(q);
  }

  // শিক্ষার্থীর প্রোফাইল: বিষয়ভিত্তিক দক্ষতা (০–১) ও প্রশ্নপ্রতি স্বাভাবিক সময় (সেকেন্ড)
  const skill: Record<string, number> = { BN: 0.72, EN: 0.6, BD: 0.82, IA: 0.76, GE: 0.7, SC: 0.74, IT: 0.73, MA: 0.58, MN: 0.66, ET: 0.8 };
  const baseSec: Record<string, number> = { BN: 22, EN: 28, BD: 20, IA: 21, GE: 24, SC: 25, IT: 23, MA: 62, MN: 48, ET: 19 };
  const diffK = { EASY: { p: 0.12, t: 0.8 }, MEDIUM: { p: 0, t: 1 }, HARD: { p: -0.18, t: 1.35 } } as const;
  const day0 = Date.now() - (N * 4 + 8) * 864e5;

  // শুরুতে ৫০ প্রশ্নের শুরুর মূল্যায়ন, প্রতি ৪টি Model Test-এর পর ২০ প্রশ্নের ভুলের অনুশীলন — বিভিন্ন আকারের পরীক্ষা (২০০-এর অনুপাত যাচাই)
  const plan: { kind: "MODEL_TEST" | "DIAGNOSTIC" | "MISTAKE_PRACTICE"; size: number }[] = [{ kind: "DIAGNOSTIC", size: 50 }];
  for (let k = 0; k < N; k++) {
    plan.push({ kind: "MODEL_TEST", size: 200 });
    if (k % 4 === 3) plan.push({ kind: "MISTAKE_PRACTICE", size: 20 });
  }
  for (let e = 0; e < plan.length; e++) {
    const spec = plan[e];
    const r = rng(1000 + e);
    const growth = e * 0.01; // ধীরে উন্নতি
    const qs: typeof pool = [];
    for (const [code, m] of Object.entries(MARKS)) {
      const list = [...(bySubj.get(code) ?? [])];
      const want = Math.max(1, Math.round((m * spec.size) / 200));
      for (let i = 0; i < want && list.length; i++) qs.push(list.splice(Math.floor(r() * list.length), 1)[0]);
    }
    const ids = qs.map((q) => q.id);
    const a = await db.testAttempt.create({
      data: { userId: user.id, kind: spec.kind, questionIds: ids, optionPerms: Object.fromEntries(ids.map((id) => [id, [0, 1, 2, 3]])), deadlineAt: new Date(Date.now() + 2 * 3600e3) },
    });
    let totalMs = 0;
    for (const q of qs) {
      const code = q.subtopic.topic.subject.code;
      const dk = diffK[q.difficulty ?? "MEDIUM"];
      const p = Math.min(0.97, Math.max(0.15, skill[code] + growth + dk.p + (r() - 0.5) * 0.1));
      const knows = r() < p;
      let sec = baseSec[code] * dk.t * (0.6 + r() * 0.8);
      if (r() < 0.03) sec *= 3 + r() * 2; // মাঝে মাঝে আটকে যাওয়া
      const correct = q.correctIndex!;
      const wrongOf = (k: number) => (correct + 1 + Math.floor(k * 3)) % 4;
      let display: number | null = null;
      let mode: "DIRECT" | "GUESS" | null = null;
      let elim: number[] = [];
      if (knows) { display = r() < 0.94 ? correct : wrongOf(r()); mode = "DIRECT"; }
      else if (r() < 0.45) {
        // Guess: দুটি অপশন বাদ — বেশিরভাগ সময় ঠিকঠাক
        const others = [0, 1, 2, 3].filter((x) => x !== correct);
        const keepCorrect = r() < 0.8;
        const remaining = keepCorrect ? [correct, others[Math.floor(r() * 3)]] : others.slice(0, 2);
        elim = [0, 1, 2, 3].filter((x) => !remaining.includes(x)).slice(0, 2);
        display = remaining[Math.floor(r() * 2)];
        mode = "GUESS";
        sec *= 1.2;
      } else if (r() < 0.35) { display = wrongOf(r()); mode = "DIRECT"; }
      if (display != null) await saveAnswer(db, user.id, a.id, q.id, display, false, false, mode, elim);
      const ms = Math.round(sec * 1000);
      totalMs += ms;
      await addTime(db, user.id, a.id, q.id, ms);
    }
    await submitAttempt(db, user.id, a.id);
    const startedAt = new Date(day0 + e * 3 * 864e5 + 10 * 3600e3);
    const submittedAt = new Date(startedAt.getTime() + totalMs + 4 * 60e3);
    await db.testAttempt.update({ where: { id: a.id }, data: { startedAt, submittedAt, deadlineAt: new Date(startedAt.getTime() + spec.size * 36e3) } });
    const done = await db.testAttempt.findUniqueOrThrow({ where: { id: a.id }, select: { correct: true, wrong: true, netScore: true } });
    console.log(`${spec.kind} ${spec.size}: সঠিক ${done.correct}, ভুল ${done.wrong}, নেট ${done.netScore}, সমাধান ${(totalMs / 60e3).toFixed(1)} মি.`);
  }
  console.log(`\nঅ্যাকাউন্ট: ${EMAIL} (পাসওয়ার্ড data/dev-test-accounts.example.json-এ)`);
}

main().finally(() => db.$disconnect());
