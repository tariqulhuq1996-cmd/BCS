/**
 * ডেটার অখণ্ডতা যাচাই — যেসব শর্ত সবসময় সত্য থাকা উচিত (যেকোনো সময় চালানো নিরাপদ, কিছু লেখে না)।
 *   npx tsx scripts/check-integrity.ts
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES } from "../src/lib/rules/defaults";
import { questionHash } from "../src/lib/questions/hash";
import { numify } from "../src/lib/sql";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info).slice(0, 400)}`);
};

async function main() {
  // ── প্রশ্ন
  const pub = await db.question.findMany({ where: { status: "PUBLISHED" }, select: { uid: true, kind: true, text: true, options: true, correctIndex: true, verifyClass: true, textHash: true } });
  const badShape = pub.filter((q) => q.options.length !== 4 || q.options.some((o) => !o.trim()) || q.correctIndex == null || q.correctIndex < 0 || q.correctIndex > 3 || !q.text.trim());
  check("প্রতিটি প্রকাশিত প্রশ্নে লেখা, ৪টি অপশন ও সঠিক উত্তর আছে", badShape.length === 0, badShape.slice(0, 5).map((q) => q.uid));
  const badCls = pub.filter((q) => q.kind === "HISTORICAL" && !["V", "C", "J", "S"].includes(q.verifyClass ?? ""));
  check("কোনো ত্রুটিপূর্ণ-শ্রেণির (D/X/N) বিগত প্রশ্ন প্রকাশিত নয়", badCls.length === 0, badCls.map((q) => q.uid));
  const all = await db.question.findMany({ select: { uid: true, text: true, options: true, textHash: true } });
  const stale = all.filter((q) => questionHash(q.text, q.options) !== q.textHash);
  check("প্রতিটি প্রশ্নের duplicate-হ্যাশ হালনাগাদ", stale.length === 0, { n: stale.length, e: stale.slice(0, 3).map((q) => q.uid) });
  const topicDup = await db.$queryRaw<{ n: number }[]>`select count(*) n from (select textHash from Question where kind='TOPIC' group by 1 having count(*)>1) t`.then((r) => numify(r));
  check("Level ২-এ হুবহু একই প্রশ্ন দুবার নেই", topicDup[0].n === 0, topicDup[0]);

  // ── শ্রেণিবিন্যাস ও লক্ষ্য
  const target = await db.subtopic.aggregate({ _sum: { targetQuestions: true }, _count: { targetQuestions: true } });
  check("Level ২-এর অনুমোদিত লক্ষ্য ১০,৪০০, ২৬৮টি উপবিষয়ে", target._sum.targetQuestions === 10400 && target._count.targetQuestions === 268, target);
  check("সব টপিকে Model Test-এর ভার (estQuestions) আছে", (await db.topic.count({ where: { estQuestions: null } })) === 0);

  // ── Roadmap-গ্রাফ
  const tasks = await db.learningTask.findMany({ include: { prerequisites: true, exam: true, subtopic: true, level: true } });
  const roots = tasks.filter((t) => t.prerequisites.length === 0);
  check("Roadmap-এর শুরু একটিই (১০ম বিসিএস)", roots.length === 1 && roots[0].key === "L1:EXAM:10", roots.map((r) => r.key));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<number>();
  const order: number[] = [];
  const visiting = new Set<number>();
  let cycle = false;
  const dfs = (id: number) => {
    if (visiting.has(id)) { cycle = true; return; }
    if (seen.has(id)) return;
    visiting.add(id);
    for (const p of byId.get(id)!.prerequisites) dfs(p.requiresId);
    visiting.delete(id);
    seen.add(id);
    order.push(id);
  };
  tasks.forEach((t) => dfs(t.id));
  check("Roadmap-এ কোনো চক্র নেই", !cycle);
  const children = new Map<number, number[]>();
  for (const t of tasks) for (const p of t.prerequisites) (children.get(p.requiresId) ?? children.set(p.requiresId, []).get(p.requiresId)!).push(t.id);
  const reach = new Set<number>([roots[0]?.id]);
  const stack = [roots[0]?.id];
  while (stack.length) for (const c of children.get(stack.pop()!) ?? []) if (!reach.has(c)) { reach.add(c); stack.push(c); }
  check("প্রতিটি ধাপে শুরু থেকে পৌঁছানো যায়", reach.size === tasks.length, { reach: reach.size, total: tasks.length });
  check("কাজ: Level ১ = ৪২, Level ২ = ২৭৩, Level ৩ = ১৫২", [1, 2, 3].map((n) => tasks.filter((t) => t.level.no === n).length).join() === "42,273,152");
  check("প্রতিটি বিসিএস-ধাপের সঙ্গে পরীক্ষা, উপবিষয়-ধাপের সঙ্গে উপবিষয়", tasks.every((t) => (t.kind !== "L1_EXAM" || t.exam) && (t.kind !== "L2_SUBTOPIC" || t.subtopic)));

  // ── নিয়ম
  const rules = await db.ruleSetting.findMany({ where: { scope: "global" } });
  const missing = Object.keys(DEFAULT_RULES).filter((k) => !rules.some((r) => r.key === k));
  const typeBad = rules.filter((r) => r.key in DEFAULT_RULES && (Array.isArray(r.value) ? "array" : typeof r.value) !== (Array.isArray(DEFAULT_RULES[r.key].value) ? "array" : typeof DEFAULT_RULES[r.key].value));
  check("সব নিয়ম ডেটাবেসে আছে এবং মানের ধরন ঠিক", missing.length === 0 && typeBad.length === 0, { missing, typeBad: typeBad.map((r) => r.key) });
  const thr = rules.filter((r) => r.key.includes("threshold") && (typeof r.value !== "number" || r.value < 0 || r.value > 100));
  check("সব Threshold ০–১০০-এর মধ্যে", thr.length === 0, thr.map((r) => r.key));

  // ── শিক্ষার্থীর তথ্য
  const subNoScore = await db.testAttempt.count({ where: { submittedAt: { not: null }, OR: [{ correct: null }, { scorePct: null }] } });
  check("জমা দেওয়া প্রতিটি পরীক্ষায় স্কোর আছে", subNoScore === 0, subNoScore);
  const mtNoNet = await db.testAttempt.count({ where: { kind: "MODEL_TEST", submittedAt: { not: null }, netScore: null } });
  check("জমা দেওয়া প্রতিটি Model Test-এ নেট নম্বর আছে", mtNoNet === 0, mtNoNet);
  const boxNoDue = await db.questionStat.count({ where: { leitnerBox: { gt: 0 }, dueAt: null } });
  check("Revision-সারির প্রতিটি প্রশ্নের পরের তারিখ আছে", boxNoDue === 0, boxNoDue);
  const done = await db.studentTaskProgress.findMany({ where: { state: "COMPLETED", overrideBy: null }, include: { task: { include: { prerequisites: { include: { requires: { select: { active: true } } } } } } } });
  const doneSet = new Set((await db.studentTaskProgress.findMany({ where: { state: "COMPLETED" }, select: { userId: true, taskId: true } })).map((x) => `${x.userId}|${x.taskId}`));
  const overridden = new Set((await db.studentTaskProgress.findMany({ where: { overrideBy: { not: null } }, select: { userId: true, taskId: true } })).map((x) => `${x.userId}|${x.taskId}`));
  const jumped = done.filter((p) => p.task.prerequisites.some((q) => q.requires.active && !doneSet.has(`${p.userId}|${q.requiresId}`) && !overridden.has(`${p.userId}|${p.taskId}`)));
  check("কেউ পূর্বশর্ত ডিঙিয়ে ধাপ সম্পন্ন করেনি (হাতে Unlock বাদে)", jumped.length === 0, jumped.slice(0, 3).map((j) => j.task.key));
  const pubMt = await db.modelTest.findMany({ where: { status: "PUBLISHED" }, include: { _count: { select: { questions: true } } } });
  check("প্রতিটি প্রকাশিত Model Test-এ ২০০টি প্রশ্ন", pubMt.every((m) => m._count.questions === 200), pubMt.filter((m) => m._count.questions !== 200).map((m) => m.no));
}

main().finally(async () => {
  await db.$disconnect();
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
});
