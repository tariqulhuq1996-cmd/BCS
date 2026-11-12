import "server-only";
import type { TaskKind, TaskState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { bn, bnOrdinal } from "@/lib/bn";
import { ensureStarted } from "./engine";
import { L1_STEPS, L2_STEPS, type StepKey } from "./cycle";
import { numify } from "@/lib/sql";
import { caGateStatus, evaluateCaGate, finalStretch, orientationStatus, ORIENT_ITEMS } from "./journey";

/** Level 3-এর পরিকল্পিত টেস্ট (কাজগুলো Phase 07-এ তৈরি হবে)। */
const L3_PLANNED = 150;

export type TaskView = {
  id: number;
  key: string;
  kind: TaskKind;
  levelNo: number;
  order: number;
  phase: number | null;
  title: string;
  state: TaskState;
  step: StepKey;
  bestScore: number | null;
  lastScore: number | null;
  href: string;
  bcsNo?: number;
  special?: boolean;
  partial?: boolean;
  subtopicCode?: string;
  grade?: string | null;
  subjectBn?: string;
};

export function taskHref(t: { kind: TaskKind; key: string; bcsNo?: number; subtopicCode?: string }): string {
  switch (t.kind) {
    case "L1_EXAM": return `/level-1/${t.bcsNo}`;
    case "L0_ORIENTATION": return "/research";
    case "L0_DIAGNOSTIC": return "/start";
    case "CA_GATE": return "/current-affairs";
    case "L1_REPEAT": return "/level-1/repeat";
    case "L1_FINAL": return "/level-1/final";
    case "L2_SUBTOPIC": return `/level-2/${t.subtopicCode}`;
    case "L2_CHECKPOINT": return `/level-2/checkpoint/${t.key.split(":").at(-1)}`;
    case "L2_FINAL": return "/level-2/final";
    case "L3_MODEL_TEST": return `/level-3/${Number(t.key.split(":")[2])}`;
    default: return "/level-3";
  }
}

/** একজন শিক্ষার্থীর সব কাজ, অবস্থাসহ (Level ও ক্রম অনুযায়ী)। */
export async function getStudentTasks(userId: string): Promise<TaskView[]> {
  await ensureStarted(prisma, userId);
  const [tasks, rows] = await Promise.all([
    prisma.learningTask.findMany({
      where: { active: true },
      orderBy: [{ level: { no: "asc" } }, { order: "asc" }],
      include: {
        level: { select: { no: true } },
        exam: { select: { bcsNo: true, type: true, completeness: true } },
        subtopic: { select: { code: true, priorityGrade: true, topic: { select: { subject: { select: { nameBn: true } } } } } },
      },
    }),
    prisma.studentTaskProgress.findMany({ where: { userId } }),
  ]);
  const byTask = new Map(rows.map((r) => [r.taskId, r]));
  return tasks.map((t) => {
    const p = byTask.get(t.id);
    const base = {
      kind: t.kind,
      key: t.key,
      bcsNo: t.exam?.bcsNo,
      subtopicCode: t.subtopic?.code,
    };
    return {
      id: t.id,
      key: t.key,
      kind: t.kind,
      levelNo: t.level.no,
      order: t.order,
      phase: t.phase,
      title: t.titleBn,
      state: p?.state ?? "LOCKED",
      step: (p?.step ?? "SOLVE") as StepKey,
      bestScore: p?.bestScore ?? null,
      lastScore: p?.lastScore ?? null,
      href: taskHref(base),
      bcsNo: t.exam?.bcsNo,
      special: t.exam?.type === "SPECIAL",
      partial: t.exam?.completeness === "PARTIAL",
      subtopicCode: t.subtopic?.code,
      grade: t.subtopic?.priorityGrade ?? null,
      subjectBn: t.subtopic?.topic.subject.nameBn,
    };
  });
}

/** বর্তমান কাজ: চলমান কাজ আগে, নইলে ক্রমের প্রথম খোলা কাজ। সাম্প্রতিক বিষয়াবলির শর্ত পাশের পথ — মূল কাজ নয়। */
export function pickCurrent(tasks: TaskView[]): TaskView | null {
  const main = tasks.filter((t) => t.kind !== "CA_GATE");
  return main.find((t) => t.state === "IN_PROGRESS") ?? main.find((t) => t.state === "AVAILABLE") ?? null;
}

export type JourneyStage = { key: string; label: string; href: string; state: "done" | "current" | "locked" | "open" };

/** যাত্রার ধাপ-রেখা: ধাপ ০ → Level ১ → Repeat Mastery → Level ২ → Level ৩। */
export function journeyStages(tasks: TaskView[], current: TaskView | null): JourneyStage[] {
  const groups: { key: string; label: string; href: string; match: (t: TaskView) => boolean }[] = [
    { key: "L0", label: "ধাপ ০: প্রশ্ন-বিশ্লেষণ", href: "/start", match: (t) => t.levelNo === 0 && t.kind !== "CA_GATE" },
    { key: "L1", label: "Level ১: বিগত BCS", href: "/level-1", match: (t) => t.kind === "L1_EXAM" },
    { key: "REPEAT", label: "Repeat Mastery ও Final", href: "/level-1/repeat", match: (t) => t.kind === "L1_REPEAT" || t.kind === "L1_FINAL" },
    { key: "L2", label: "Level ২: টপিকভিত্তিক", href: "/level-2", match: (t) => t.levelNo === 2 },
    { key: "L3", label: "Level ৩: Model Test", href: "/level-3", match: (t) => t.levelNo === 3 },
  ];
  return groups.map((g) => {
    const ts = tasks.filter(g.match);
    const done = ts.length > 0 && ts.every((t) => t.state === "COMPLETED");
    const isCur = !!current && g.match(current);
    const open = ts.some((t) => t.state !== "LOCKED");
    return { key: g.key, label: g.label, href: g.href, state: done ? "done" : isCur ? "current" : open ? "open" : "locked" };
  });
}

export async function getDashboard(userId: string) {
  await evaluateCaGate(prisma, userId); // আগে থেকে শর্ত পূরণ হয়ে থাকলে Level 3-এর পথ খোলা
  const tasks = await getStudentTasks(userId);
  const rules = await loadRules(prisma);
  const current = pickCurrent(tasks);

  // ── Level-সারসংক্ষেপ
  const levels = [1, 2, 3].map((no) => {
    const lt = tasks.filter((t) => t.levelNo === no);
    const total = no === 3 && lt.length === 0 ? L3_PLANNED : lt.length;
    const completed = lt.filter((t) => t.state === "COMPLETED").length;
    const open = lt.filter((t) => t.state === "AVAILABLE" || t.state === "IN_PROGRESS").length;
    return { no, total, completed, open, pct: total ? (completed / total) * 100 : 0, built: lt.length > 0, locked: completed === 0 && open === 0 };
  });
  const overallPct = levels.reduce((a, l) => a + l.pct, 0) / levels.length;
  const completedTasks = levels.reduce((a, l) => a + l.completed, 0);
  const totalTasks = levels.reduce((a, l) => a + l.total, 0);

  // ── আজকের করণীয়
  const action = current ? await describeAction(current, tasks, rules) : null;

  // ── পরবর্তী Unlock লক্ষ্য
  let nextUnlock: { title: string; condition: string } | null = null;
  if (current) {
    const dep = await prisma.taskPrerequisite.findFirst({
      where: { requiresId: current.id },
      orderBy: { task: { order: "asc" } },
      include: { task: { select: { titleBn: true } } },
    });
    if (dep) {
      const thr = (k: string) => bn(rules.get<number>(k));
      const caGate = tasks.find((t) => t.kind === "CA_GATE");
      const condition =
        current.kind === "L0_ORIENTATION"
          ? `প্রশ্ন-বিশ্লেষণের ${bn(ORIENT_ITEMS.length)}টি অংশে "পড়েছি" চিহ্ন দিলে`
          : current.kind === "L0_DIAGNOSTIC"
            ? "শুরুর মূল্যায়ন জমা দিলেই"
            : current.kind === "L1_REPEAT"
              ? `Repeat Mastery Test-এ ${thr("l1.threshold.repeat")}% পেলে`
              : current.kind === "L2_FINAL"
                ? `Level ২ Final-এ ${thr("l2.threshold.final")}% পেলে${caGate && caGate.state !== "COMPLETED" ? `, আর সাম্প্রতিক বিষয়াবলির প্রতিটি প্রশ্নব্যাংকে ${thr("ca.gate.min_pct")}% হলে` : ""}`
                : current.kind === "L1_EXAM"
          ? `${current.title}-এর Mastery Test-এ ${thr("l1.threshold.mastery")}%${current.bcsNo! > 10 ? ` ও Cumulative Test-এ ${thr("l1.threshold.cumulative")}%` : ""} পেলে`
          : current.kind === "L2_SUBTOPIC"
            ? `এই Priority ধাপের সব উপবিষয়ে Mastery (${thr("l2.threshold.mastery")}%) অর্জন করলে`
            : `${current.title}-এ নির্ধারিত নম্বর পেলে`;
      nextUnlock = { title: dep.task.titleBn, condition };
    }
  }

  // ── Revision, ফলাফল, দুর্বলতা, অর্জন
  const now = new Date();
  const [dueToday, wrongBank, attempts, mastery, achievements, earned, weakSubjects, weakSubtopics] = await Promise.all([
    prisma.questionStat.count({ where: { userId, leitnerBox: { gt: 0 }, dueAt: { lte: now } } }),
    prisma.questionStat.count({ where: { userId, wrong: { gt: 0 }, lastCorrect: false } }),
    prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: { task: { select: { titleBn: true } } },
    }),
    prisma.masteryRecord.aggregate({ where: { userId }, _avg: { scorePct: true }, _count: true }),
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({ where: { userId } }),
    prisma.$queryRaw<{ subject: string; correct: number; wrong: number }[]>`
      select sj.nameBn as subject, sum(qs.correct) as correct, sum(qs.wrong) as wrong
      from QuestionStat qs
      join Question q on q.id = qs.questionId
      join Subtopic st on st.id = q.subtopicId
      join Topic tp on tp.id = st.topicId
      join Subject sj on sj.id = tp.subjectId
      where qs.userId = ${userId}
      group by sj.nameBn
      having sum(qs.correct + qs.wrong) >= 5
      order by sum(qs.correct) / nullif(sum(qs.correct + qs.wrong), 0) asc
      limit 5`.then((r) => numify(r)),
    prisma.$queryRaw<{ name: string; code: string; wrong: number; seen: number }[]>`
      select st.nameBn as name, st.code, sum(qs.wrong) as wrong, sum(qs.seen) as seen
      from QuestionStat qs
      join Question q on q.id = qs.questionId
      join Subtopic st on st.id = q.subtopicId
      where qs.userId = ${userId} and qs.wrong > 0
      group by st.nameBn, st.code
      order by sum(qs.wrong) desc
      limit 5`.then((r) => numify(r)),
  ]);
  const earnedSet = new Set(earned.map((e) => e.achievementKey));
  const [ca, caDue, stretch, orient] = await Promise.all([
    caGateStatus(prisma, userId),
    prisma.caAnswer.count({ where: { userId, dueAt: { lte: now }, question: { active: true } } }),
    finalStretch(prisma, now),
    current?.kind === "L0_ORIENTATION" ? orientationStatus(prisma, userId) : null,
  ]);

  return {
    current,
    action,
    nextUnlock,
    levels,
    overallPct,
    completedTasks,
    remainingTasks: totalTasks - completedTasks,
    revision: { dueToday, wrongBank },
    results: attempts.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.task?.titleBn ?? "",
      scorePct: a.scorePct,
      passed: a.passed,
      threshold: a.threshold,
      at: a.submittedAt!,
    })),
    avgMastery: mastery._count ? mastery._avg.scorePct : null,
    weakSubjects: weakSubjects.map((w) => ({ ...w, accuracy: (w.correct / Math.max(1, w.correct + w.wrong)) * 100 })),
    weakSubtopics,
    achievements: achievements.map((a) => ({ ...a, earned: earnedSet.has(a.key) })),
    l1: tasks.filter((t) => t.levelNo === 1),
    stages: journeyStages(tasks, current),
    ca: { ...ca, due: caDue, total: ca.banks.reduce((a, b) => a + b.total, 0), answered: ca.banks.reduce((a, b) => a + b.answered, 0) },
    stretch,
    orient,
    l3Open: tasks.some((t) => t.kind === "L3_MODEL_TEST" && t.state !== "LOCKED"),
  };
}

/** "আজ তোমার করণীয়" — বর্তমান কাজ ও ধাপ থেকে তৈরি নির্দেশনা। */
async function describeAction(t: TaskView, tasks: TaskView[], rules: Awaited<ReturnType<typeof loadRules>>) {
  const pct = (k: string) => bn(rules.get<number>(k));
  const prevDone = [...tasks].filter((x) => x.state === "COMPLETED").sort((a, b) => b.levelNo - a.levelNo || b.order - a.order)[0];
  const congrats = prevDone && t.step === "SOLVE" && t.state === "AVAILABLE" ? `অভিনন্দন! তুমি ${prevDone.title} সম্পন্ন করেছ। ` : "";

  if (t.kind === "L1_EXAM") {
    const eligible = rules.get<string[]>("path.eligible_classes");
    const n = await prisma.question.count({ where: { exam: { bcsNo: t.bcsNo }, status: "PUBLISHED", verifyClass: { in: eligible } } });
    const parts = Math.ceil(n / rules.get<number>("l1.solve.part_size"));
    const where = `তুমি বর্তমানে Level ১-এর ${bnOrdinal(t.bcsNo!)} BCS পর্যায়ে আছো।`;
    const thr = pct("l1.threshold.mastery");
    const byStep: Record<StepKey, string> = {
      SOLVE: `${congrats}${where} প্রথমে নির্ধারিত ${bn(n)}টি প্রশ্ন সমাধান করো${parts > 1 ? ` (${bn(parts)}টি ভাগে)` : ""}। এরপর উত্তর পর্যালোচনা ও Revision Test।`,
      REVIEW: `${where} প্রথম সমাধান শেষ। এখন সঠিক ও ভুল উত্তর এবং ব্যাখ্যাগুলো পর্যালোচনা করো।`,
      REVISION: `${where} এখন তোমার ভুল প্রশ্নগুলোর Revision Test দাও।`,
      MASTERY:
        t.lastScore != null && t.lastScore < rules.get<number>("l1.threshold.mastery")
          ? `তোমার Mastery Score ${bn(Math.round(t.lastScore))}%। পরবর্তী ধাপ Unlock করতে ${thr}% প্রয়োজন। আবার অনুশীলন করো।`
          : `${where} এখন Mastery Test দাও; পরের ধাপে যেতে ${thr}% লাগবে।`,
      CUMULATIVE: `${where} এখন ১০ম থেকে ${bnOrdinal(t.bcsNo!)} পর্যন্ত Cumulative Revision Test দাও; ${pct("l1.threshold.cumulative")}% লাগবে।`,
      DONE: `${t.title} সম্পন্ন।`,
    };
    const stepLabel = L1_STEPS.find((s) => s.key === t.step)?.label ?? "";
    return { text: byStep[t.step], button: t.step === "SOLVE" && t.state === "AVAILABLE" ? "পরবর্তী কাজ শুরু করো" : "কাজ চালিয়ে যাও", stepLabel, href: t.href };
  }
  if (t.kind === "L0_ORIENTATION")
    return {
      text: `স্বাগতম! যাত্রার প্রথম ধাপ প্রশ্ন-বিশ্লেষণ: কোন উপবিষয় প্রায় প্রতিবার আসে, সাম্প্রতিক ধারা, বারবার আসা প্রশ্ন, Priority List আর পুরো পথ। পাঁচটি অংশ পড়ে প্রতিটির শেষে "পড়েছি" চিহ্ন দাও — তারপর শুরুর মূল্যায়ন।`,
      button: "প্রশ্ন-বিশ্লেষণ পড়ো", stepLabel: "প্রশ্ন-বিশ্লেষণ", href: "/research",
    };
  if (t.kind === "L0_DIAGNOSTIC")
    return {
      text: `${congrats}এবার শুরুর মূল্যায়ন: ${bn(rules.get<number>("l0.diagnostic.size"))}টি প্রশ্ন, ${bn(rules.get<number>("l0.diagnostic.minutes"))} মিনিট। পাস-ফেল নেই — জমা দিলেই Level ১ খুলবে, আর শেষে দেখবে শুরু থেকে কতটা এগোলে।`,
      button: t.state === "IN_PROGRESS" ? "মূল্যায়ন চালিয়ে যাও" : "শুরুর মূল্যায়ন দাও", stepLabel: "শুরুর মূল্যায়ন", href: "/start",
    };
  if (t.kind === "L1_REPEAT")
    return {
      text: `${congrats}১০ম–৫০তম সব BCS শেষ! Level ১ Final-এর আগে বারবার আসা প্রশ্ন পাকা করো: Priority ${rules.get<string[]>("l1.repeat.grades").join(", ")}-এর প্রতিটি পুনরাবৃত্ত প্রশ্ন থেকে একটি করে — পাস করতে ${pct("l1.threshold.repeat")}% লাগবে।`,
      button: "Repeat Mastery শুরু করো", stepLabel: "Repeat Mastery", href: t.href,
    };
  if (t.kind === "L1_FINAL")
    return {
      text: `${congrats}১০ম–৫০তম সব BCS-এর Learning Cycle শেষ। এখন সব পরীক্ষা থেকে ${bn(rules.get<number>("l1.final.size"))}টি প্রশ্নের Level ১ Final Assessment দাও; পাস করতে ${pct("l1.threshold.final")}% লাগবে।`,
      button: "Final Assessment শুরু করো", stepLabel: "Final Assessment", href: t.href,
    };
  if (t.kind === "L2_SUBTOPIC") {
    const open = tasks.filter((x) => x.kind === "L2_SUBTOPIC" && x.phase === t.phase);
    const done = open.filter((x) => x.state === "COMPLETED").length;
    const stepLabel = L2_STEPS.find((s) => s.key === t.step)?.label ?? "";
    return {
      text: `${congrats}তুমি Level ২-এর Priority ${t.grade ?? ""} ধাপে আছো (${bn(done)}/${bn(open.length)} উপবিষয় সম্পন্ন)। পরের উপবিষয়: ${t.title} (${t.subjectBn})। পরিচিতি পড়ে প্রশ্ন সমাধান শুরু করো।`,
      button: "পরবর্তী কাজ শুরু করো", stepLabel, href: t.href,
    };
  }
  if (t.kind === "L3_MODEL_TEST") {
    const no = Number(t.key.split(":")[2]);
    return {
      text: `${congrats}তুমি Level ৩-এর স্তর ${bn(t.phase ?? 1)}-এ আছো। এখন ${t.title} দাও: ২০০টি প্রশ্ন, ${bn(rules.get<number>("l3.duration_min"))} মিনিট, প্রতিটি ভুলে ${bn(rules.get<number>("l3.negative_mark"))} নম্বর কাটা। জমা দেওয়ার পর ভুলগুলো পর্যালোচনা করলে পরের টেস্ট খুলবে।`,
      button: t.state === "IN_PROGRESS" ? "টেস্ট চালিয়ে যাও" : "পরবর্তী কাজ শুরু করো",
      stepLabel: `Model Test ${bn(no)}/১৫০`,
      href: t.href,
    };
  }
  if (t.kind === "L3_TIER_GATE")
    return { text: `স্তর ${bn(t.phase ?? 1)}-এর সব টেস্ট শেষ। পরের স্তর খুলতে শেষ ${bn(rules.get<number>("l3.gate.window"))}টি টেস্টের গড় নেট নম্বর লাগবে; আগের টেস্টগুলো আবার দিয়ে গড় বাড়াতে পারো।`, button: "অবস্থা দেখো", stepLabel: t.title, href: "/level-3" };
  if (t.kind === "L2_CHECKPOINT")
    return { text: `${congrats}এই Priority ধাপের সব উপবিষয় শেষ। এখন ${t.title} দাও; ${pct("l2.threshold.checkpoint")}% পেলে পরের ধাপ খুলবে।`, button: "Checkpoint শুরু করো", stepLabel: "Checkpoint", href: t.href };
  return { text: `${congrats}${t.title} দাও।`, button: "শুরু করো", stepLabel: "", href: t.href };
}
