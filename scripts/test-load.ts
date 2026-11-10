/**
 * লোড/পারফরম্যান্স পরীক্ষা: অনেক কৃত্রিম শিক্ষার্থী ও তাদের তথ্য তৈরি করে ভারী কাজগুলোর সময় মাপা।
 * শেষে সব কৃত্রিম তথ্য মুছে ফেলা হয়।
 *   npx tsx scripts/test-load.ts [--users 300] [--base http://localhost:3100]
 * --base দিলে চালু অ্যাপে (প্রোডাকশন বিল্ড হলে ভালো) একসঙ্গে ২০টি অনুরোধ পাঠিয়ে পাতার সময়ও মাপে।
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { completeTask, ensureStarted, manualUnlock } from "../src/lib/progress/engine";
import { getResultView, revisionStatus, startRevision, startStep, submitAttempt } from "../src/lib/exam/service";

const db = new PrismaClient();
const args = process.argv.slice(2);
const N = Number(args[args.indexOf("--users") + 1]) || 300;
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};
async function time<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = performance.now();
  const r = await fn();
  return [r, performance.now() - t];
}
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

async function main() {
  const tag = `load${Date.now()}`;
  const t0 = performance.now();
  try {
    // ── কৃত্রিম শিক্ষার্থী
    await db.user.createMany({ data: Array.from({ length: N }, (_, i) => ({ email: `${tag}-${i}@load.test`, passwordHash: "x" })) });
    const users = await db.user.findMany({ where: { email: { startsWith: tag } }, select: { id: true } });
    const exams = await db.learningTask.findMany({ where: { kind: "L1_EXAM" }, orderBy: { order: "asc" } });
    for (const u of users) await ensureStarted(db, u.id);
    // এক-তৃতীয়াংশ ১০ম–২০তম শেষ করেছে
    for (const u of users.slice(0, Math.floor(N / 3))) for (const e of exams.slice(0, 11)) await completeTask(db, u.id, e.id);

    const qs = await db.question.findMany({ where: { status: "PUBLISHED" }, select: { id: true }, take: 3000 });
    const now = Date.now();
    const statRows = users.flatMap((u, ui) => Array.from({ length: 200 }, (_, k) => {
      const q = qs[(ui * 37 + k * 13) % qs.length].id;
      const wrong = k % 3 === 0;
      return { userId: u.id, questionId: q, seen: 2, correct: wrong ? 1 : 2, wrong: wrong ? 1 : 0, lastCorrect: !wrong, leitnerBox: wrong ? 1 : (k % 5) + 1, dueAt: new Date(now + ((k % 20) - 5) * 864e5), lastSeenAt: new Date(now - k * 3600e3) };
    }));
    for (let i = 0; i < statRows.length; i += 5000) await db.questionStat.createMany({ data: statRows.slice(i, i + 5000), skipDuplicates: true });
    const attRows = users.flatMap((u, ui) => Array.from({ length: 10 }, (_, k) => ({
      userId: u.id, taskId: exams[k % exams.length].id, kind: "MASTERY" as const, questionIds: qs.slice((ui + k) % 100, ((ui + k) % 100) + 40).map((q) => q.id), optionPerms: {},
      startedAt: new Date(now - (k + 1) * 864e5), submittedAt: new Date(now - (k + 1) * 864e5 + 1800e3), correct: 30, wrong: 8, unanswered: 2, scorePct: 75, threshold: 80, passed: false,
    })));
    for (let i = 0; i < attRows.length; i += 1000) await db.testAttempt.createMany({ data: attRows.slice(i, i + 1000) });
    const setup = (performance.now() - t0) / 1000;
    console.log(`      প্রস্তুতি: ${N} জন শিক্ষার্থী, ${statRows.length} Revision-সারি, ${attRows.length} পরীক্ষা (${setup.toFixed(0)} সে.)`);
    console.log(`      মোট প্রশ্ন-পরিসংখ্যান সারি এখন: ${await db.questionStat.count()}, পরীক্ষা: ${await db.testAttempt.count()}`);

    // ── ভারী কাজের সময় (একজন শিক্ষার্থী, ভারী অবস্থায়)
    const heavy = users[0];
    const [, tRev] = await time(() => revisionStatus(db, heavy.id));
    check(`দৈনিক Revision-এর অবস্থা < ৩০০ মি.সে. (${tRev.toFixed(0)})`, tRev < 300);
    const [r1, tSrs] = await time(() => startRevision(db, heavy.id));
    check(`Revision-সেট তৈরি < ৫০০ মি.সে. (${tSrs.toFixed(0)})`, tSrs < 500);
    const [, tSub] = await time(() => submitAttempt(db, heavy.id, r1));
    check(`২০ প্রশ্নের জমা ও Leitner হালনাগাদ < ১৫০০ মি.সে. (${tSub.toFixed(0)})`, tSub < 1500);

    // ৫০তম বিসিএসের Cumulative (সবচেয়ে বড় পুল) ও Level ১ Final
    const admin = await db.user.create({ data: { email: `${tag}-admin@load.test`, passwordHash: "x", role: "ADMIN" } });
    const t50 = exams.at(-1)!;
    await manualUnlock(db, heavy.id, t50.id, admin.id);
    await db.studentTaskProgress.update({ where: { userId_taskId: { userId: heavy.id, taskId: t50.id } }, data: { step: "CUMULATIVE" } });
    const [cum, tCum] = await time(() => startStep(db, heavy.id, t50.key));
    const cumN = (await db.testAttempt.findUniqueOrThrow({ where: { id: cum } })).questionIds.length;
    check(`৫০তম-এ Cumulative তৈরি (${cumN}টি প্রশ্ন, প্রায় ৫,২০০-এর পুল থেকে) < ২০০০ মি.সে. (${tCum.toFixed(0)})`, tCum < 2000 && cumN === 100, { tCum, cumN });
    const fin = await db.learningTask.findUniqueOrThrow({ where: { key: "L1:FINAL" } });
    await manualUnlock(db, heavy.id, fin.id, admin.id);
    const [, tFin] = await time(() => startStep(db, heavy.id, "L1:FINAL"));
    check(`Level ১ Final তৈরি < ২০০০ মি.সে. (${tFin.toFixed(0)})`, tFin < 2000);
    const [, tSub100] = await time(() => submitAttempt(db, heavy.id, cum));
    check(`১০০ প্রশ্নের জমা < ৩০০০ মি.সে. (${tSub100.toFixed(0)})`, tSub100 < 3000);
    const [, tRes] = await time(() => getResultView(db, heavy.id, [cum]));
    check(`১০০ প্রশ্নের ফলাফল-পাতার তথ্য < ১০০০ মি.সে. (${tRes.toFixed(0)})`, tRes < 1000);

    // একসঙ্গে ৫০ জন Revision-অবস্থা দেখছে
    const [, tPar] = await time(() => Promise.all(users.slice(0, 50).map((u) => revisionStatus(db, u.id))));
    check(`৫০ জন একসঙ্গে Revision-অবস্থা < ৩০০০ মি.সে. (${tPar.toFixed(0)})`, tPar < 3000);

    // ── HTTP (ঐচ্ছিক)
    if (BASE) {
      const hash = (t: string) => createHash("sha256").update(t).digest("hex");
      const tokens: string[] = [];
      for (const u of users.slice(0, 20)) {
        const t = randomBytes(32).toString("base64url");
        await db.session.create({ data: { id: hash(t), userId: u.id, expiresAt: new Date(now + 3600e3) } });
        tokens.push(t);
      }
      for (const path of ["/", "/dashboard", "/revision", "/level-1"]) {
        await fetch(BASE + path, { headers: { cookie: `bcs_session=${tokens[0]}` } }).then((r) => r.text()); // গরম করা
        const times = await Promise.all(tokens.map(async (t) => {
          const s = performance.now();
          const r = await fetch(BASE + path, { headers: { cookie: `bcs_session=${t}` } });
          await r.text();
          return [performance.now() - s, r.status] as const;
        }));
        const ms = times.map((x) => x[0]);
        check(`HTTP ${path}: ২০টি একসঙ্গে অনুরোধ, p95 < ২৫০০ মি.সে. (p50 ${pct(ms, 0.5).toFixed(0)}, p95 ${pct(ms, 0.95).toFixed(0)})`, pct(ms, 0.95) < 2500 && times.every((x) => x[1] === 200), times.map((x) => x[1]));
      }
    }
  } finally {
    const c0 = performance.now();
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    console.log(`      পরিষ্কার: ${((performance.now() - c0) / 1000).toFixed(0)} সে.`);
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
