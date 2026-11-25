/**
 * Performance Dashboard (সব পরীক্ষা) ও পরীক্ষা-পরবর্তী বিশ্লেষণ (একটি পরীক্ষা) — সব Level-এর সব ধরনের পরীক্ষার জন্য।
 *
 * নীতি:
 *  - শুধু জমা দেওয়া (সম্পন্ন) পরীক্ষা গোনা হয়; চলমান/অসম্পূর্ণ পরীক্ষা বাদ।
 *  - বিভিন্ন আকারের পরীক্ষা তুলনীয় করতে নম্বর ২০০-এর অনুপাতে রূপান্তর: নেট × ২০০ ÷ প্রশ্নসংখ্যা
 *    (যেমন ৫০ প্রশ্নে ৩৮ নেট → ১৫২/২০০)। বরাদ্দ সময়ও একই অনুপাতে: প্রশ্নসংখ্যা × (১০৫ মিনিট ÷ ২০০)।
 *  - নেট = সঠিক − নেগেটিভ × ভুল। Model Test-এ ইঞ্জিনের সংরক্ষিত netScore; অন্য পরীক্ষায় একই নিয়মে হিসাব
 *    (সেগুলোতে আসলে নম্বর কাটে না, তবে বাস্তব Preliminary-র সঙ্গে তুলনার জন্য একই নিয়ম)।
 *  - বিষয়ভিত্তিক নেট ধরা হয় বিষয়ের ২০০-নম্বরের মানবণ্টন (Subject.marks200) অনুযায়ী।
 *  - তথ্য না থাকা মানে শূন্য নয় — null; UI "তথ্য নেই" দেখায়।
 *  - প্রতিটি গড়ের সঙ্গে কতটি পরীক্ষা (n) আর গড়ের ধরন: প্রতি-পরীক্ষার গড় ("per_exam") নাকি সব প্রশ্ন মিলিয়ে ভারযুক্ত ("weighted")।
 *  - উন্নতি/অবনতি বলা হয় কেবল analysis.min_exams_trend টি পরীক্ষা হলে; একটি পরীক্ষা থেকে কখনো নয়।
 *  - OMR পূরণের সময় কোনো সমাধান-সময়ে যোগ হয় না; আলাদা দেখানো হয়।
 *  - নম্বর আসে বিদ্যমান ইঞ্জিন থেকে: TestAttempt (submitAttempt), বিষয়ভিত্তিক হিসাব perSubject, প্রশ্নভিত্তিক analyzeTiming (getResultView)।
 */
import type { PrismaClient } from "@prisma/client";
import { loadRules, type Rules } from "@/lib/rules";
import { bn } from "@/lib/bn";
import { numify } from "../sql";
import { perSubject } from "./analysis";
import { ExamError, KIND_TITLE, attemptTitle, getResultView } from "./service";

type Db = PrismaClient;

/** সব পরীক্ষা এই পূর্ণমানে রূপান্তরিত হয়। */
export const FULL_MARKS = 200;

export type Benchmarks = { strongNet: number; goodNet: number; accHigh: number; accLow: number; attemptHigh: number; attemptLow: number; stableSd: number; unstableSd: number };
export type AnalysisConfig = {
  targetNet: number | null;
  solveMin: number;
  omrMin: number;
  negativeMark: number;
  minTrend: number;
  minConsistency: number;
  smallExam: number;
  bench: Benchmarks;
};

export function analysisConfig(rules: Rules): AnalysisConfig {
  const t = rules.get<number>("analysis.target_net");
  return {
    targetNet: t > 0 ? t : null,
    solveMin: rules.get<number>("analysis.solve_minutes"),
    omrMin: rules.get<number>("analysis.omr_minutes"),
    negativeMark: rules.get<number>("l3.negative_mark"),
    minTrend: Math.max(2, rules.get<number>("analysis.min_exams_trend")),
    minConsistency: Math.max(2, rules.get<number>("analysis.min_exams_consistency")),
    smallExam: rules.get<number>("analysis.small_exam_questions"),
    bench: rules.get<Benchmarks>("analysis.benchmarks"),
  };
}

// ───────────────────────────────────────── সাধারণ হিসাব

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return m == null ? null : Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** নম্বরকে ২০০-এর অনুপাতে: ৫০ প্রশ্নে ৩৮ → ১৫২। */
export const toFull = (value: number, total: number) => (total > 0 ? (value * FULL_MARKS) / total : 0);

/** একটি গড় এবং কতটি পরীক্ষা থেকে, কোন ধরনের গড়। */
export type Avg = { value: number | null; n: number; kind: "per_exam" | "weighted" };
const perExam = (xs: (number | null)[]): Avg => {
  const v = xs.filter((x): x is number => x != null);
  return { value: mean(v), n: v.length, kind: "per_exam" };
};

export type SubjectStatus = "strong" | "ok" | "weak" | "nodata";
export function subjectStatus(accuracy: number | null, attemptRate: number | null, b: Benchmarks): SubjectStatus {
  if (accuracy == null) return "nodata";
  if (accuracy >= b.accHigh && (attemptRate ?? 0) >= b.attemptLow) return "strong";
  if (accuracy < b.accLow) return "weak";
  return "ok";
}

/** শেষ k টি বনাম তার আগের k টি — n ≥ minTrend হলেই, নইলে null। */
export function splitTrend(values: number[], minTrend: number) {
  if (values.length < minTrend) return null;
  const k = Math.min(5, Math.floor(values.length / 2));
  const recent = mean(values.slice(-k))!;
  const before = mean(values.slice(-2 * k, -k))!;
  return { k, recent, before, delta: recent - before };
}

/** ভারযুক্ত প্রবণতা (%): শেষ k পরীক্ষার Σলব ÷ Σহর বনাম আগের k — ছোট নমুনার পরীক্ষা যেন বেশি দোলা না দেয়। */
export function splitTrendWeighted(items: { num: number; den: number }[], minTrend: number) {
  if (items.length < minTrend) return null;
  const k = Math.min(5, Math.floor(items.length / 2));
  const agg = (xs: typeof items) => {
    const d = xs.reduce((a, x) => a + x.den, 0);
    return d ? (xs.reduce((a, x) => a + x.num, 0) / d) * 100 : 0;
  };
  const recent = agg(items.slice(-k));
  const before = agg(items.slice(-2 * k, -k));
  return { k, recent, before, delta: recent - before };
}

// ───────────────────────────────────────── কোন পরীক্ষা কোন Level-এর

export type Scope = "all" | "0" | "1" | "2" | "3" | "other";
export const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "সব পরীক্ষা" },
  { key: "0", label: "ধাপ ০" },
  { key: "1", label: "Level ১" },
  { key: "2", label: "Level ২" },
  { key: "3", label: "Level ৩" },
  { key: "other", label: "Revision ও অনুশীলন" },
];
export const parseScope = (v: unknown): Scope => (SCOPES.some((s) => s.key === v) ? (v as Scope) : "all");

/** কাজের ধরন (L0_/L1_/L2_/L3_) থেকে Level; কাজ ছাড়া Model Test → ৩; দৈনিক Revision/ভুলের অনুশীলন ইত্যাদি → "other"। */
export function levelOf(a: { kind: string; task: { kind: string } | null }): Exclude<Scope, "all"> {
  const m = a.task?.kind.match(/^L([0-3])_/);
  if (m) return m[1] as "0" | "1" | "2" | "3";
  if (a.kind === "MODEL_TEST") return "3";
  if (a.kind === "DIAGNOSTIC") return "0";
  return "other";
}

// ───────────────────────────────────────── সম্পন্ন পরীক্ষা

async function completedExams(db: Db, userId: string, opts: { before?: Date; kind?: string } = {}) {
  const rows = await db.testAttempt.findMany({
    where: { userId, submittedAt: { not: null, ...(opts.before ? { lt: opts.before } : {}) }, ...(opts.kind ? { kind: opts.kind as never } : {}) },
    orderBy: { submittedAt: "asc" },
    select: { id: true, kind: true, partNo: true, startedAt: true, submittedAt: true, correct: true, wrong: true, unanswered: true, netScore: true, questionIds: true, task: { select: { titleBn: true, kind: true } } },
  });
  return rows.filter((a) => a.questionIds.length > 0 && a.correct != null);
}
type Attempt = Awaited<ReturnType<typeof completedExams>>[number];

export type ExamRow = {
  id: string; i: number; title: string; kind: string; kindLabel: string; level: Exclude<Scope, "all">; date: string;
  total: number; correct: number; wrong: number; unanswered: number; attempted: number;
  /** আসল নেট (এই পরীক্ষার প্রশ্নসংখ্যায়) ও ২০০-এর অনুপাতে */
  net: number; net200: number; gross200: number;
  /** নেগেটিভ মার্কিং কি পরীক্ষাতেই ছিল (Model Test), নাকি তুলনার জন্য হিসাব করা */
  negativeInExam: boolean;
  small: boolean;
  accuracy: number | null; attemptRate: number;
  solveSec: number | null; budgetSec: number; utilization: number | null; avgSecPerAttempted: number | null;
};

function toRow(a: Attempt, idx: number, rows: Awaited<ReturnType<typeof perSubject>>, cfg: AnalysisConfig): ExamRow {
  const total = a.questionIds.length;
  const correct = a.correct ?? 0, wrong = a.wrong ?? 0;
  const unanswered = a.unanswered ?? total - correct - wrong;
  const attempted = correct + wrong;
  const net = a.netScore ?? correct - cfg.negativeMark * wrong;
  const timed = rows.reduce((x, r) => x + r.timed, 0);
  const solveSec = timed ? rows.reduce((x, r) => x + r.timeMs, 0) / 1000 : null;
  const budgetSec = (total * cfg.solveMin * 60) / FULL_MARKS;
  return {
    id: a.id, i: idx + 1, title: attemptTitle(a), kind: a.kind, kindLabel: KIND_TITLE[a.kind] ?? a.kind, level: levelOf(a), date: a.submittedAt!.toISOString(),
    total, correct, wrong, unanswered, attempted,
    net, net200: toFull(net, total), gross200: toFull(correct, total),
    negativeInExam: a.netScore != null,
    small: total < cfg.smallExam,
    accuracy: ratio(correct, attempted), attemptRate: ratio(attempted, total) ?? 0,
    solveSec, budgetSec, utilization: solveSec != null ? (solveSec / budgetSec) * 100 : null,
    avgSecPerAttempted: timed && attempted ? rows.reduce((x, r) => x + r.attemptedMs, 0) / 1000 / attempted : null,
  };
}

// ───────────────────────────────────────── ১. Performance Dashboard

export async function getPerformanceDashboard(db: Db, userId: string, scope: Scope = "all") {
  const cfg = analysisConfig(await loadRules(db));
  const all = await completedExams(db, userId);
  const counts = Object.fromEntries(SCOPES.map((s) => [s.key, s.key === "all" ? all.length : all.filter((a) => levelOf(a) === s.key).length])) as Record<Scope, number>;
  const attempts = scope === "all" ? all : all.filter((a) => levelOf(a) === scope);
  const [subj, subjectMeta] = await Promise.all([
    perSubject(db, attempts.map((a) => a.id)),
    db.subject.findMany({ select: { code: true, marks200: true } }),
  ]);
  const marks200 = new Map(subjectMeta.map((s) => [s.code, s.marks200]));
  const byAttempt = new Map<string, typeof subj>();
  for (const s of subj) (byAttempt.get(s.attemptId) ?? byAttempt.set(s.attemptId, []).get(s.attemptId)!).push(s);

  const exams = attempts.map((a, idx) => toRow(a, idx, byAttempt.get(a.id) ?? [], cfg));
  const n = exams.length;
  const nets = exams.map((e) => e.net200);
  const kinds = new Set(exams.map((e) => e.kind));

  // ── KPI (২০০-এর অনুপাতে; প্রতিটি পরীক্ষার মান সমান ওজনে গড়)
  const kpi = {
    total: n,
    questions: exams.reduce((a, e) => a + e.total, 0),
    small: exams.filter((e) => e.small).length,
    mixedKinds: kinds.size > 1,
    avgNet: perExam(nets),
    avgGross: perExam(exams.map((e) => e.gross200)),
    avgAccuracy: perExam(exams.map((e) => e.accuracy)),
    avgAttemptRate: perExam(exams.map((e) => e.attemptRate)),
    weightedAccuracy: { value: ratio(exams.reduce((a, e) => a + e.correct, 0), exams.reduce((a, e) => a + e.attempted, 0)), n, kind: "weighted" } as Avg,
    latest: exams.at(-1) ?? null,
  };

  const progress = cfg.targetNet && kpi.avgNet.value != null
    ? { target: cfg.targetNet, pct: Math.max(0, Math.min(100, (kpi.avgNet.value / cfg.targetNet) * 100)), rawPct: (kpi.avgNet.value / cfg.targetNet) * 100, gap: cfg.targetNet - kpi.avgNet.value }
    : null;
  const netTrend = splitTrend(nets, cfg.minTrend);
  const accTrend = splitTrend(exams.map((e) => e.accuracy).filter((x): x is number => x != null), cfg.minTrend);

  // ── বিষয়ভিত্তিক (সব পরীক্ষা মিলিয়ে, ভারযুক্ত; নেট বিষয়ের ২০০-নম্বরের ভাগে)
  const examIndex = new Map(exams.map((e) => [e.id, e.i]));
  const sAgg = new Map<string, { code: string; name: string; ord: number; exams: Set<string>; total: number; correct: number; wrong: number; perExam: { i: number; num: number; den: number }[]; ms: number; timed: number }>();
  for (const s of subj) {
    const x = sAgg.get(s.code) ?? { code: s.code, name: s.name, ord: s.ord, exams: new Set(), total: 0, correct: 0, wrong: 0, perExam: [], ms: 0, timed: 0 };
    x.exams.add(s.attemptId);
    x.total += s.total; x.correct += s.correct; x.wrong += s.wrong; x.ms += s.attemptedMs; x.timed += s.timed;
    x.perExam.push({ i: examIndex.get(s.attemptId) ?? 0, num: s.correct - cfg.negativeMark * s.wrong, den: s.total });
    sAgg.set(s.code, x);
  }
  const subjects = [...sAgg.values()].sort((a, b) => a.ord - b.ord).map((x) => {
    const attempted = x.correct + x.wrong;
    const accuracy = ratio(x.correct, attempted);
    const attemptRate = ratio(attempted, x.total);
    const netPct = x.total ? ((x.correct - cfg.negativeMark * x.wrong) / x.total) * 100 : null;
    const fullMarks = marks200.get(x.code) ?? null;
    return {
      code: x.code, name: x.name,
      examsCount: x.exams.size,
      questions: x.total,
      fullMarks,
      /** বিষয়ের ২০০-নম্বরের মানবণ্টনে নেট (যেমন বাংলা ৩০-এর মধ্যে) — সব প্রশ্ন মিলিয়ে */
      net: { value: netPct != null && fullMarks != null ? (netPct / 100) * fullMarks : null, n: x.exams.size, kind: "weighted" } as Avg,
      accuracy: { value: accuracy, n: x.exams.size, kind: "weighted" } as Avg,
      attemptRate: { value: attemptRate, n: x.exams.size, kind: "weighted" } as Avg,
      netPct,
      avgSec: x.timed && attempted ? x.ms / 1000 / attempted : null,
      status: subjectStatus(accuracy, attemptRate, cfg.bench),
      trend: splitTrendWeighted(x.perExam.sort((a, b) => a.i - b.i), cfg.minTrend),
    };
  });
  const ranked = subjects.filter((s) => s.netPct != null).sort((a, b) => b.netPct! - a.netPct!);
  const improved = subjects.filter((s) => s.trend && s.trend.delta > 0).sort((a, b) => b.trend!.delta - a.trend!.delta)[0] ?? null;
  const highlights = {
    strongest: ranked[0] ?? null,
    weakest: ranked.length > 1 ? ranked.at(-1)! : null,
    mostImproved: improved,
    trendReady: n >= cfg.minTrend,
  };

  // ── সময় (শুধু যেসব পরীক্ষায় সময় মাপা হয়েছে; ২০০ প্রশ্নের সমতুল্যে)
  const timedExams = exams.filter((e) => e.solveSec != null);
  const time = {
    n: timedExams.length,
    solveMin200: perExam(timedExams.map((e) => toFull(e.solveSec!, e.total) / 60)),
    avgSec: perExam(timedExams.map((e) => e.avgSecPerAttempted)),
    utilization: perExam(timedExams.map((e) => e.utilization)),
    overBudget: timedExams.filter((e) => (e.utilization ?? 0) > 100).length,
    trend: splitTrend(timedExams.map((e) => e.avgSecPerAttempted).filter((x): x is number => x != null), cfg.minTrend),
    budgetSecPerQ: (cfg.solveMin * 60) / FULL_MARKS,
  };

  // ── স্থিতিশীলতা (উন্নতি থেকে আলাদা; ২০০-এর অনুপাতে)
  const netSd = n >= cfg.minConsistency ? sd(nets) : null;
  const consistency = netSd == null
    ? null
    : {
        n,
        sd: netSd,
        range: Math.max(...nets) - Math.min(...nets),
        accSd: sd(exams.map((e) => e.accuracy).filter((x): x is number => x != null)),
        level: (netSd <= cfg.bench.stableSd ? "stable" : netSd <= cfg.bench.unstableSd ? "moderate" : "unstable") as "stable" | "moderate" | "unstable",
      };

  return { cfg, scope, counts, exams, kpi, progress, netTrend, accTrend, subjects, highlights, time, consistency };
}
export type PerformanceDashboard = Awaited<ReturnType<typeof getPerformanceDashboard>>;

// ───────────────────────────────────────── ২. পরীক্ষা-পরবর্তী বিশ্লেষণ

export type Diagnosis = { key: "strong" | "balanced" | "reckless" | "cautious" | "foundation" | "developing"; label: string; detail: string };

/** বেঞ্চমার্ক অনুযায়ী এক লাইনের রোগনির্ণয় (নেট নম্বর ২০০-এর অনুপাতে); প্রমাণ (নেট, Accuracy, Attempt) লেখায় থাকে। */
export function diagnose(net: number, accuracy: number | null, attemptRate: number, b: Benchmarks): Diagnosis {
  const acc = accuracy ?? 0;
  const f = (x: number) => x.toFixed(1).replace(/^-/, "−");
  const ev = `২০০-এ নেট ${f(net)}, Accuracy ${f(acc)}%, Attempt ${f(attemptRate)}%`;
  if (net >= b.strongNet && acc >= b.accHigh) return { key: "strong", label: "শক্তিশালী প্রস্তুতি", detail: `${ev} — নম্বর ও নির্ভুলতা দুটোই মানদণ্ডের ওপরে।` };
  if (attemptRate >= b.attemptHigh && acc < b.accLow) return { key: "reckless", label: "ঝুঁকিপূর্ণ উত্তরদান", detail: `${ev} — প্রায় সব প্রশ্নে উত্তর দিলেও নির্ভুলতা কম; নেগেটিভ মার্কিংয়ে নম্বর হারাচ্ছে।` };
  if (acc >= b.accHigh && attemptRate < b.attemptLow) return { key: "cautious", label: "অতি সতর্ক", detail: `${ev} — যা দিয়েছেন তা মূলত সঠিক, কিন্তু অনেক প্রশ্ন ছেড়ে দেওয়ায় নম্বর কম আসছে।` };
  if (acc < b.accLow && attemptRate < b.attemptLow) return { key: "foundation", label: "ভিত্তি দুর্বল", detail: `${ev} — উত্তরের সংখ্যা ও নির্ভুলতা দুটোই কম; মূল বিষয়গুলো আবার পড়া দরকার।` };
  if (net >= b.goodNet) return { key: "balanced", label: "ভালো, তবে উন্নতির সুযোগ আছে", detail: `${ev} — ভারসাম্য ঠিক আছে; দুর্বল বিষয়ে কাজ করলে লক্ষ্যে পৌঁছানো সম্ভব।` };
  return { key: "developing", label: "উন্নয়নশীল", detail: `${ev} — নেট নম্বর মানদণ্ডের (${f(b.goodNet)}) নিচে।` };
}

type Item = Awaited<ReturnType<typeof getResultView>>["items"][number];

/** আগের সব জমা দেওয়া পরীক্ষার সঠিক উত্তরে শিক্ষার্থীর নিজের গড় সময় — বিষয় × কঠিনতা, আর শুধু বিষয়। */
async function ownTimeBaseline(db: Db, userId: string, before: Date) {
  const rows = numify(
    await db.$queryRaw<{ code: string; diff: string | null; n: number; ms: number }[]>`
      select sj.code, q.difficulty as diff, count(*) as n, sum(aa.timeMs) as ms
      from AttemptAnswer aa join TestAttempt ta on ta.id = aa.attemptId
      join Question q on q.id = aa.questionId
      join Subtopic st on st.id = q.subtopicId join Topic tp on tp.id = st.topicId join Subject sj on sj.id = tp.subjectId
      where ta.userId = ${userId} and ta.submittedAt is not null and ta.submittedAt < ${before}
        and aa.isCorrect = true and aa.timeMs > 0
      group by sj.code, q.difficulty`,
  );
  const byDiff = new Map<string, { n: number; sec: number }>();
  const bySubj = new Map<string, { n: number; ms: number }>();
  for (const r of rows) {
    byDiff.set(`${r.code}|${r.diff ?? "?"}`, { n: r.n, sec: r.ms / r.n / 1000 });
    const s = bySubj.get(r.code) ?? { n: 0, ms: 0 };
    s.n += r.n; s.ms += r.ms;
    bySubj.set(r.code, s);
  }
  return { byDiff, bySubj: new Map([...bySubj].map(([k, v]) => [k, { n: v.n, sec: v.ms / v.n / 1000 }])) };
}

export type TimeWaster = {
  no: number; text: string; subject: string; difficulty: string | null; sec: number;
  baselineSec: number; baselineSource: "own_diff" | "own_subject" | "exam_subject" | "budget";
  status: Item["status"]; excess: number;
};

const MIN_BASE_N = 5;
/** আগের পরীক্ষার সঙ্গে বিষয়ভিত্তিক তুলনায় ন্যূনতম প্রশ্ন। */
const MIN_SUBJECT_Q = 5;

/**
 * সময় নষ্ট হওয়া প্রশ্ন: শুধু "৩১.৫ সেকেন্ডের বেশি" নয় — প্রত্যাশিত সময় ধরা হয় শিক্ষার্থীর নিজের ইতিহাস থেকে
 * (একই বিষয় ও কঠিনতার সঠিক উত্তরে গড় সময়), না থাকলে বিষয়ের গড়, তাও না থাকলে এই পরীক্ষায় বিষয়ের মধ্যমা, শেষে বরাদ্দ সময়।
 * প্রত্যাশার ১.৫ গুণ ও অন্তত ১০ সেকেন্ড বেশি হলে তবেই গণ্য; ভুল/অনুত্তরিত হলে (সময় গেল, নম্বর এল না) অগ্রাধিকার বেশি।
 */
export function findTimeWasters(
  items: { no: number; text: string; subject: string; code: string; difficulty: string | null; sec: number | null; status: Item["status"] }[],
  base: Awaited<ReturnType<typeof ownTimeBaseline>>,
  budgetSecPerQ: number,
  limit = 5,
): TimeWaster[] {
  const examMed = new Map<string, number>();
  const bySubject = new Map<string, number[]>();
  for (const it of items) if (it.sec != null && it.status === "correct") bySubject.set(it.code, [...(bySubject.get(it.code) ?? []), it.sec]);
  for (const [k, xs] of bySubject) if (xs.length >= MIN_BASE_N) examMed.set(k, median(xs)!);

  const out: (TimeWaster & { weight: number })[] = [];
  for (const it of items) {
    if (it.sec == null) continue;
    const d = base.byDiff.get(`${it.code}|${it.difficulty ?? "?"}`);
    const s = base.bySubj.get(it.code);
    const [baselineSec, baselineSource]: [number, TimeWaster["baselineSource"]] =
      d && d.n >= MIN_BASE_N ? [d.sec, "own_diff"]
      : s && s.n >= MIN_BASE_N ? [s.sec, "own_subject"]
      : examMed.has(it.code) ? [examMed.get(it.code)!, "exam_subject"]
      : [budgetSecPerQ, "budget"];
    const excess = it.sec - baselineSec;
    if (it.sec < baselineSec * 1.5 || excess < 10) continue;
    const weight = excess * (it.status === "correct" ? 1 : 1.5) * (it.difficulty === "EASY" ? 1.2 : 1);
    out.push({ no: it.no, text: it.text, subject: it.subject, difficulty: it.difficulty, sec: it.sec, baselineSec, baselineSource, status: it.status, excess, weight });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, limit).map((x) => ({ no: x.no, text: x.text, subject: x.subject, difficulty: x.difficulty, sec: x.sec, baselineSec: x.baselineSec, baselineSource: x.baselineSource, status: x.status, excess: x.excess }));
}

export async function getExamReport(db: Db, userId: string, attemptId: string) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, select: { userId: true, kind: true, partNo: true, submittedAt: true, startedAt: true, netScore: true, task: { select: { titleBn: true, kind: true } } } });
  if (!a || a.userId !== userId) throw new ExamError("FORBIDDEN", "এই ফলাফল আপনার নয়।");
  if (!a.submittedAt) throw new ExamError("NOT_READY", "পরীক্ষাটি এখনও জমা হয়নি।");

  const rules = await loadRules(db);
  const cfg = analysisConfig(rules);
  const r = await getResultView(db, userId, [attemptId]); // বিদ্যমান ইঞ্জিন: প্রশ্নভিত্তিক অবস্থা + analyzeTiming
  if (!r.total) throw new ExamError("EMPTY", "এই পরীক্ষায় কোনো প্রশ্ন নেই।");
  const t = r.timing;
  const [meta, rawModes, subjectMeta] = await Promise.all([
    db.question.findMany({
      where: { id: { in: r.items.map((i) => i.qid) } },
      select: { id: true, difficulty: true, subtopic: { select: { topic: { select: { subject: { select: { code: true } } } } } } },
    }),
    db.attemptAnswer.findMany({ where: { attemptId, selected: { not: null } }, select: { mode: true } }),
    db.subject.findMany({ select: { code: true, marks200: true } }),
  ]);
  const metaBy = new Map(meta.map((m) => [m.id, { diff: m.difficulty as string | null, code: m.subtopic.topic.subject.code }]));
  const marks200 = new Map(subjectMeta.map((s) => [s.code, s.marks200]));

  const total = r.total, correct = r.correct, wrong = r.wrong, unanswered = r.unanswered;
  const attempted = correct + wrong;
  const negativeInExam = a.netScore != null;
  const net = a.netScore ?? correct - cfg.negativeMark * wrong;
  const net200 = toFull(net, total);
  const accuracy = ratio(correct, attempted);
  const attemptRate = ratio(attempted, total) ?? 0;
  const small = total < cfg.smallExam;
  const diagnosis = diagnose(net200, accuracy, attemptRate, cfg.bench);

  // ── বিষয়ভিত্তিক
  const subjCode = new Map<string, string>();
  for (const it of r.items) subjCode.set(it.subject, metaBy.get(it.qid)?.code ?? it.subject);
  const subjects = t.subjects
    .map((s) => {
      const att = s.correct + s.wrong;
      const acc = ratio(s.correct, att);
      const ar = ratio(att, s.total);
      const sNet = s.correct - cfg.negativeMark * s.wrong;
      const timeSec = s.secs.length ? s.secs.reduce((x, y) => x + y, 0) : null;
      const code = subjCode.get(s.subject) ?? s.subject;
      const fullMarks = marks200.get(code) ?? null;
      return {
        code, name: s.subject, total: s.total, correct: s.correct, wrong: s.wrong, unanswered: s.total - att,
        net: sNet, netPct: (sNet / s.total) * 100,
        /** বিষয়ের ২০০-নম্বরের মানবণ্টনে সমতুল্য নেট (যেমন ৩০-এর মধ্যে) */
        netFull: fullMarks != null ? (sNet / s.total) * fullMarks : null, fullMarks,
        accuracy: acc, attemptRate: ar, guess: s.guess,
        timeSec, avgSec: timeSec != null && s.secs.length ? timeSec / s.secs.length : null,
        status: subjectStatus(acc, ar, cfg.bench),
        lost: cfg.negativeMark * s.wrong,
      };
    });
  const subjectLine = (s: (typeof subjects)[number]) => {
    const f = (x: number | null) => (x == null ? "—" : x.toFixed(0).replace(/^-/, "−"));
    if (s.status === "strong") return `শক্তির জায়গা — ${s.total}টির ${s.correct}টি সঠিক, Accuracy ${f(s.accuracy)}%।`;
    if (s.accuracy != null && s.accuracy < cfg.bench.accLow && s.wrong > 0) return `${s.wrong}টি ভুলে ${s.lost.toFixed(1)} নম্বর কাটা ${negativeInExam ? "গেছে" : "যেত (বাস্তব পরীক্ষায়)"}; Accuracy ${f(s.accuracy)}% — নিশ্চিত না হলে উত্তর না দেওয়াই ভালো।`;
    if (s.attemptRate != null && s.attemptRate < cfg.bench.attemptLow) return `${s.unanswered}টি প্রশ্ন ছেড়ে দিয়েছেন (Attempt ${f(s.attemptRate)}%) — এখানে নম্বর বাড়ানোর সুযোগ।`;
    return `মোটামুটি — নেট ${s.net.toFixed(1)}/${s.total}, Accuracy ${f(s.accuracy)}%।`;
  };
  const subjectsWithLine = subjects.map((s) => ({ ...s, line: bn(subjectLine(s)) }));

  // ── সময় (বরাদ্দ সময় প্রশ্নসংখ্যার অনুপাতে)
  const timedItems = r.items.filter((i) => i.timeMs != null && i.timeMs > 0);
  const hasTime = timedItems.length > 0;
  const secOf = (i: Item) => (i.timeMs != null && i.timeMs > 0 ? i.timeMs / 1000 : null);
  const attemptedTimed = timedItems.filter((i) => i.status !== "unanswered");
  const solveSec = hasTime ? t.solveSec : null; // শুধু প্রশ্নে কাটানো মাপা সময় — OMR যোগ হয় না
  const slowestSubject = [...subjectsWithLine].filter((s) => s.avgSec != null).sort((x, y) => y.avgSec! - x.avgSec!)[0] ?? null;
  const budgetSecPerQ = (cfg.solveMin * 60) / FULL_MARKS;
  const solveBudgetMin = (cfg.solveMin * total) / FULL_MARKS;
  const time = {
    hasTime,
    timedCount: timedItems.length,
    total,
    solveSec,
    avgPerAttempted: attemptedTimed.length ? attemptedTimed.reduce((x, i) => x + secOf(i)!, 0) / attemptedTimed.length : null,
    // প্রতিটি সঠিক উত্তরের "খরচ": মোট সমাধান-সময় ÷ সঠিক উত্তর
    perCorrect: solveSec != null && correct ? solveSec / correct : null,
    slowestSubject: slowestSubject && { name: slowestSubject.name, avgSec: slowestSubject.avgSec!, timeSec: slowestSubject.timeSec! },
    utilization: solveSec != null ? (solveSec / 60 / solveBudgetMin) * 100 : null,
    solveMin: solveBudgetMin,
    omrMin: (cfg.omrMin * total) / FULL_MARKS,
    scaled: total !== FULL_MARKS,
    budgetSecPerQ,
    wallMin: (a.submittedAt.getTime() - a.startedAt.getTime()) / 60e3,
  };

  const base = await ownTimeBaseline(db, userId, a.submittedAt);
  const wasters = hasTime
    ? findTimeWasters(
        r.items.map((it, idx) => ({ no: idx + 1, text: it.text, subject: it.subject, code: metaBy.get(it.qid)?.code ?? it.subject, difficulty: metaBy.get(it.qid)?.diff ?? null, sec: secOf(it), status: it.status })),
        base, budgetSecPerQ,
      )
    : [];
  const diffKnown = meta.filter((m) => m.difficulty != null).length;

  // ── Guessing: AttemptAnswer.mode রেকর্ড থাকলেই
  const modeRecorded = rawModes.length > 0 && rawModes.some((m) => m.mode != null);
  const guessing = modeRecorded
    ? {
        total: t.guessTotal, right: t.guessRight, wrong: t.guessWrong, accuracy: t.guessAcc,
        net: t.guessRight - cfg.negativeMark * t.guessWrong,
        elimBoth: t.elimBoth, elimLost: t.elimLost, pickAcc: t.pickAcc,
        unsureDirect: r.items.filter((i) => i.unsure && i.mode === "DIRECT").length,
      }
    : null;

  // ── আগের একই ধরনের পরীক্ষা (ঐচ্ছিক তুলনা; ২০০-এর অনুপাতে)
  const prevList = await completedExams(db, userId, { before: a.submittedAt, kind: a.kind });
  const prevA = prevList.at(-1) ?? null;
  let previous = null as null | { id: string; title: string; net200: number; accuracy: number | null; attemptRate: number; utilization: number | null; subjects: Map<string, { pct: number; n: number }> };
  if (prevA) {
    const ps = await perSubject(db, [prevA.id]);
    const row = toRow(prevA, 0, ps, cfg);
    previous = {
      id: prevA.id, title: row.title, net200: row.net200, accuracy: row.accuracy, attemptRate: row.attemptRate, utilization: row.utilization,
      subjects: new Map(ps.map((s) => [s.code, { pct: ((s.correct - cfg.negativeMark * s.wrong) / s.total) * 100, n: s.total }])),
    };
  }

  // ── অন্তর্দৃষ্টি ও করণীয় (শুধু পাওয়া তথ্য থেকে)
  const f1 = (x: number) => x.toFixed(1).replace(/^-/, "−");
  const insights: string[] = [];
  const actions: { weakness: string; action: string }[] = [];
  const byNetPct = [...subjectsWithLine].sort((x, y) => x.netPct - y.netPct);
  const weakest = byNetPct[0];
  const strongest = byNetPct.at(-1);
  if (total !== FULL_MARKS) insights.push(`${total} প্রশ্নের পরীক্ষায় নেট ${f1(net)} — ২০০-এর অনুপাতে ${f1(net200)}।`);
  if (strongest && strongest !== weakest) insights.push(`সবচেয়ে ভালো ${strongest.name}: ${strongest.total}টির ${strongest.correct}টি সঠিক, নেট ${f1(strongest.net)}।`);
  if (weakest && byNetPct.length > 1) {
    insights.push(`সবচেয়ে দুর্বল ${weakest.name}: নেট ${f1(weakest.net)}/${weakest.total} (Accuracy ${weakest.accuracy == null ? "—" : f1(weakest.accuracy) + "%"})।`);
    actions.push({ weakness: `${weakest.name}-এ নেট ${f1(weakest.net)}/${weakest.total}`, action: `${weakest.name}-এর ভুল প্রশ্নগুলো ভুলের ভান্ডার থেকে অনুশীলন করুন; পরের পরীক্ষার আগে এই বিষয়ের অন্তত একটি পূর্ণ সেট দিন।` });
  } else if (weakest && weakest.status !== "strong") {
    actions.push({ weakness: `${weakest.name}-এ নেট ${f1(weakest.net)}/${weakest.total}`, action: `${weakest.name}-এর ভুল প্রশ্নগুলো ব্যাখ্যাসহ আবার পড়ুন এবং Revision-এ অনুশীলন করুন।` });
  }
  const totalLost = cfg.negativeMark * wrong;
  const mostLost = [...subjectsWithLine].sort((x, y) => y.lost - x.lost)[0];
  if (wrong > 0) insights.push(`${wrong}টি ভুলে মোট ${f1(totalLost)} নম্বর ${negativeInExam ? "কাটা গেছে" : "কাটা যেত বাস্তব Preliminary-তে"}${mostLost && mostLost.lost > 0 && subjectsWithLine.length > 1 ? `, সবচেয়ে বেশি ${mostLost.name}-এ (${f1(mostLost.lost)})` : ""}।`);
  if (accuracy != null && accuracy < cfg.bench.accLow && mostLost && mostLost !== weakest)
    actions.push({ weakness: `Accuracy ${f1(accuracy)}% — ${mostLost.name}-এ ${mostLost.wrong}টি ভুল`, action: `${mostLost.name}-এ নিশ্চিত না হলে উত্তর দেবেন না; অন্তত দুটি অপশন বাদ দিতে পারলে তবেই Guess করুন।` });
  const lowAttempt = [...subjectsWithLine].filter((s) => s.attemptRate != null && s.attemptRate < cfg.bench.attemptLow).sort((x, y) => (x.attemptRate ?? 0) - (y.attemptRate ?? 0))[0];
  if (lowAttempt) {
    insights.push(`${lowAttempt.name}-এ ${lowAttempt.unanswered}টি প্রশ্ন অনুত্তরিত (Attempt ${f1(lowAttempt.attemptRate!)}%)।`);
    actions.push({ weakness: `${lowAttempt.name}-এ Attempt ${f1(lowAttempt.attemptRate!)}%`, action: `${lowAttempt.name}-এর মূল টপিকগুলো আবার Revision করুন, যাতে আরও প্রশ্নে আত্মবিশ্বাসের সঙ্গে উত্তর দিতে পারেন।` });
  }
  if (hasTime && time.utilization != null) {
    if (time.utilization > 100) {
      insights.push(`প্রশ্ন সমাধানে ${f1(solveSec! / 60)} মিনিট লেগেছে — ${total}টি প্রশ্নে বরাদ্দ ${f1(solveBudgetMin)} মিনিটের চেয়ে বেশি।`);
      actions.push({ weakness: `সমাধানে ${f1(solveSec! / 60)} মিনিট (বরাদ্দ ${f1(solveBudgetMin)})`, action: `প্রতি প্রশ্নে ${f1(budgetSecPerQ)} সেকেন্ডের সীমা মেনে অনুশীলন করুন; আটকে গেলে চিহ্ন দিয়ে পরের প্রশ্নে যান।` });
    } else if (slowestSubject && slowestSubject.avgSec! > budgetSecPerQ * 1.3) {
      insights.push(`${slowestSubject.name}-এ প্রশ্নপ্রতি গড়ে ${f1(slowestSubject.avgSec!)} সেকেন্ড — বরাদ্দ ${f1(budgetSecPerQ)} সেকেন্ডের চেয়ে অনেক বেশি।`);
    }
  }
  if (wasters.length >= 2) {
    const lostW = wasters.filter((w) => w.status !== "correct");
    const sumExcess = wasters.reduce((x, w) => x + w.excess, 0);
    actions.push({ weakness: `${wasters.length}টি প্রশ্নে প্রত্যাশার চেয়ে মোট ${f1(sumExcess)} সেকেন্ড বেশি${lostW.length ? `, যার ${lostW.length}টিতে নম্বর আসেনি` : ""}`, action: "কোনো প্রশ্নে নিজের সাধারণ সময়ের দেড় গুণ পেরোলে সেটি ছেড়ে দিন বা চিহ্ন দিয়ে শেষে ফিরুন।" });
  }
  if (guessing && guessing.total >= 3) {
    insights.push(`${guessing.total}টি Guess-এর ${guessing.right}টি সঠিক — Guess থেকে নিট ${guessing.net >= 0 ? "+" : ""}${f1(guessing.net)} নম্বর।`);
    if (guessing.net < 0) actions.push({ weakness: `Guess থেকে নিট ${f1(guessing.net)} নম্বর`, action: "দুটি অপশন নিশ্চিতভাবে বাদ দিতে না পারলে Guess করবেন না।" });
  }
  if (previous) {
    const d = net200 - previous.net200;
    insights.push(`আগের ${KIND_TITLE[a.kind] ?? "পরীক্ষা"}-এর তুলনায় ২০০-এর অনুপাতে নেট ${d >= 0 ? "+" : ""}${f1(d)} — এটি একটি পরীক্ষার পার্থক্য, প্রবণতা নয়।`);
  }

  return {
    id: attemptId,
    title: attemptTitle(a),
    kind: a.kind,
    kindLabel: KIND_TITLE[a.kind] ?? a.kind,
    level: levelOf(a),
    date: a.submittedAt.toISOString(),
    cfg,
    snapshot: { total, correct, wrong, unanswered, attempted, net, net200, scaled: total !== FULL_MARKS, negativeInExam, small, accuracy, attemptRate, deduction: cfg.negativeMark * wrong },
    diagnosis: { ...diagnosis, detail: bn(diagnosis.detail) },
    subjects: subjectsWithLine,
    time,
    wasters,
    difficultyCoverage: { known: diffKnown, total },
    guessing,
    insights: insights.slice(0, 5).map(bn),
    actions: actions.slice(0, 5).map((x) => ({ weakness: bn(x.weakness), action: bn(x.action) })),
    previous: previous && {
      id: previous.id, title: previous.title,
      deltaNet200: net200 - previous.net200,
      deltaAccuracy: accuracy != null && previous.accuracy != null ? accuracy - previous.accuracy : null,
      deltaAttempt: attemptRate - previous.attemptRate,
      deltaUtilization: time.utilization != null && previous.utilization != null ? time.utilization - previous.utilization : null,
      /** বিষয়ভিত্তিক নেট % (প্রশ্নসংখ্যা আলাদা হলেও তুলনীয়) */
      // বিষয়ভিত্তিক নেট % — দুই পরীক্ষাতেই বিষয়টিতে অন্তত MIN_SUBJECT_Q টি প্রশ্ন থাকলে তবেই (নইলে ছোট নমুনায় ±১০০% দোলে)
      subjectDelta: subjectsWithLine.map((s) => {
        const p = previous!.subjects.get(s.code);
        return { code: s.code, name: s.name, delta: p && p.n >= MIN_SUBJECT_Q && s.total >= MIN_SUBJECT_Q ? s.netPct - p.pct : null };
      }),
    },
  };
}
export type ExamReport = Awaited<ReturnType<typeof getExamReport>>;
