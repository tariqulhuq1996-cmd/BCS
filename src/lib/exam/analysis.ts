/**
 * Level 3 বিশ্লেষণ: একটি Model Test-এর বিস্তারিত ফল এবং সব টেস্ট মিলিয়ে Final Readiness Report।
 * কোনো স্কোরকে পাশের নিশ্চয়তা হিসেবে দেখানো হয় না — শুধু তোমার নিজের ফলের হিসাব।
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { numify } from "../sql";
import { ExamError } from "./service";

type Db = PrismaClient;

async function perSubject(db: Db, attemptIds: string[]) {
  const rows = await db.$queryRaw<{ attemptId: string; code: string; name: string; ord: number; total: number; correct: number; wrong: number; timeMs: number }[]>`
    select aa.attemptId, sj.code, sj.nameBn as name, sj.order as ord,
      count(*) as total,
      sum(case when aa.isCorrect then 1 else 0 end) as correct,
      sum(case when aa.selected is not null and not aa.isCorrect then 1 else 0 end) as wrong,
      coalesce(sum(aa.timeMs), 0) as timeMs
    from AttemptAnswer aa join Question q on q.id = aa.questionId
    join Subtopic st on st.id = q.subtopicId join Topic tp on tp.id = st.topicId join Subject sj on sj.id = tp.subjectId
    where aa.attemptId in (${Prisma.join(attemptIds)})
    group by aa.attemptId, sj.code, sj.nameBn, sj.order order by sj.order`;
  return numify(rows);
}

/** একটি Model Test-এর বিশ্লেষণ: নেট নম্বর, নেগেটিভ, বিষয়ভিত্তিক, দুর্বল টপিক, সময়, আগের টেস্টের সঙ্গে তুলনা। */
export async function getModelTestAnalysis(db: Db, userId: string, attemptId: string) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { task: { include: { modelTest: true } } } });
  if (!a || a.userId !== userId) throw new ExamError("FORBIDDEN", "এই ফলাফল তোমার নয়।");
  if (a.kind !== "MODEL_TEST" || !a.submittedAt) throw new ExamError("NOT_READY", "জমা দেওয়া Model Test নয়।");
  const prev = await db.testAttempt.findFirst({
    where: { userId, kind: "MODEL_TEST", submittedAt: { not: null, lt: a.submittedAt } },
    orderBy: { submittedAt: "desc" },
    include: { task: { select: { titleBn: true } } },
  });
  const subj = await perSubject(db, prev ? [a.id, prev.id] : [a.id]);
  const mine = subj.filter((s) => s.attemptId === a.id);
  const before = new Map(subj.filter((s) => s.attemptId === prev?.id).map((s) => [s.code, s]));
  const neg = a.task?.modelTest?.negativeMark ?? 0.5;

  const weakTopics = await db.$queryRaw<{ topic: string; subject: string; miss: number; total: number }[]>`
    select tp.nameBn as topic, sj.nameBn as subject,
      sum(case when aa.isCorrect then 0 else 1 end) as miss, count(*) as total
    from AttemptAnswer aa join Question q on q.id = aa.questionId
    join Subtopic st on st.id = q.subtopicId join Topic tp on tp.id = st.topicId join Subject sj on sj.id = tp.subjectId
    where aa.attemptId = ${a.id}
    group by tp.nameBn, sj.nameBn having sum(case when aa.isCorrect then 0 else 1 end) > 0
    order by miss desc, total desc limit 8`.then((r) => numify(r));

  const slow = await db.attemptAnswer.findMany({
    where: { attemptId: a.id, timeMs: { gt: 0 } },
    orderBy: { timeMs: "desc" },
    take: 5,
    select: { timeMs: true, isCorrect: true, question: { select: { text: true } } },
  });
  const usedMs = a.submittedAt.getTime() - a.startedAt.getTime();
  const trackedMs = mine.reduce((s, x) => s + x.timeMs, 0);
  const total = a.questionIds.length;
  return {
    title: a.task?.titleBn ?? "Model Test",
    taskKey: a.task?.key ?? null,
    reviewed: !!a.reviewedAt,
    total,
    correct: a.correct ?? 0,
    wrong: a.wrong ?? 0,
    unanswered: a.unanswered ?? 0,
    negativeMark: neg,
    deduction: neg * (a.wrong ?? 0),
    net: a.netScore ?? 0,
    durationMin: a.task?.modelTest?.durationMin ?? 120,
    usedMs,
    avgSecPerAnswered: trackedMs && total - (a.unanswered ?? 0) > 0 ? trackedMs / 1000 / (total - (a.unanswered ?? 0)) : null,
    subjects: mine.map((s) => {
      const b = before.get(s.code);
      const net = s.correct - neg * s.wrong;
      return {
        code: s.code, name: s.name, total: s.total, correct: s.correct, wrong: s.wrong, net,
        timeMin: s.timeMs / 60e3,
        prevNet: b ? b.correct - neg * b.wrong : null,
      };
    }),
    weakTopics,
    slow: slow.map((x) => ({ sec: x.timeMs! / 1000, correct: x.isCorrect, text: x.question.text })),
    prev: prev ? { title: prev.task?.titleBn ?? "", net: prev.netScore ?? 0 } : null,
  };
}

/** Final Readiness Report: সব Model Test মিলিয়ে। */
export async function getReadiness(db: Db, userId: string) {
  const attempts = await db.testAttempt.findMany({
    where: { userId, kind: "MODEL_TEST", submittedAt: { not: null } },
    orderBy: { submittedAt: "asc" },
    include: { task: { select: { titleBn: true, phase: true } } },
  });
  const done = await db.studentTaskProgress.count({ where: { userId, state: "COMPLETED", task: { kind: "L3_MODEL_TEST" } } });
  if (!attempts.length) return { empty: true as const, count: 0, completedTests: done };
  const nets = attempts.map((a) => a.netScore ?? 0);
  const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  const sd = Math.sqrt(nets.reduce((a, b) => a + (b - avg) ** 2, 0) / nets.length);
  const hiI = nets.indexOf(Math.max(...nets));
  const loI = nets.indexOf(Math.min(...nets));
  const k = Math.min(10, Math.floor(nets.length / 2));
  const early = k ? nets.slice(0, k).reduce((a, b) => a + b, 0) / k : null;
  const late = k ? nets.slice(-k).reduce((a, b) => a + b, 0) / k : null;

  const subj = await perSubject(db, attempts.map((a) => a.id));
  const agg = new Map<string, { name: string; ord: number; total: number; correct: number; wrong: number }>();
  for (const s of subj) {
    const x = agg.get(s.code) ?? { name: s.name, ord: s.ord, total: 0, correct: 0, wrong: 0 };
    x.total += s.total; x.correct += s.correct; x.wrong += s.wrong;
    agg.set(s.code, x);
  }
  const subjects = [...agg.entries()]
    .map(([code, x]) => ({ code, ...x, accuracy: (x.correct / x.total) * 100, wrongShare: (x.wrong / x.total) * 100 }))
    .sort((a, b) => a.ord - b.ord);
  const ranked = [...subjects].sort((a, b) => b.accuracy - a.accuracy);
  return {
    empty: false as const,
    count: attempts.length,
    completedTests: done,
    avg, sd,
    highest: { net: nets[hiI], title: attempts[hiI].task?.titleBn ?? "" },
    lowest: { net: nets[loI], title: attempts[loI].task?.titleBn ?? "" },
    early, late, k,
    series: attempts.map((a, i) => ({ i: i + 1, net: a.netScore ?? 0, title: a.task?.titleBn ?? "", tier: a.task?.phase ?? 1 })),
    subjects,
    strong: ranked.slice(0, 3),
    weak: ranked.slice(-3).reverse(),
  } as const;
}
