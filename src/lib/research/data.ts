import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * হোমপেজ ও গবেষণা-পাতার সব পরিসংখ্যান — প্রতিটি সংখ্যা ডেটাবেসের প্রশ্ন থেকে গোনা।
 * পদ্ধতি গবেষণা-রিপোর্টের মতোই: সাধারণ = ১০০ ও ২০০ নম্বরের পরীক্ষা; বিশেষ বিসিএস আলাদা।
 * প্রবণতা: ২০০ নম্বরের যুগের সর্বশেষ ৬টি সাধারণ বিসিএস বনাম তার আগের ৬টি (২০২৬-১১-১২ থেকে; আগে ধাপ ০৯-এর মতো ৩৫–৩৮ বনাম ৪০–৫০ ছিল)।
 * উপবিষয়ের "প্রবণতা" লেবেল (বেড়েছে/কমেছে) এখনও ধাপ ০৯-এর গবেষণা থেকে, অপরিবর্তিত।
 * প্রশ্ন Import হলে `revalidateTag("research")` দিয়ে নতুন করে গোনা হয়।
 */

export type ExamTypeKey = "GENERAL_100" | "GENERAL_200" | "SPECIAL";
export type Grade = "A" | "B" | "C" | "D";

export type ResearchData = Awaited<ReturnType<typeof computeResearch>>;

export async function getResearch() {
  "use cache";
  cacheLife("hours");
  cacheTag("research");
  return computeResearch();
}

// প্রবণতার তুলনা: ২০০ নম্বরের যুগের (৩৫তম থেকে) সাধারণ বিসিএস — সর্বশেষ ৬টি বনাম তার আগের ৬টি
// (এখন: ৩৫, ৩৬, ৩৭, ৩৮, ৪০, ৪১ বনাম ৪৩, ৪৪, ৪৫, ৪৬, ৪৭, ৫০)। নতুন পরীক্ষা যুক্ত হলে নিজে থেকে সরে যায়।
const ERA_FROM = 35;
const TREND_WINDOW = 6;

async function computeResearch() {
  const [subjects, topics, subtopics, exams, questions, families] = await Promise.all([
    prisma.subject.findMany({ orderBy: { order: "asc" } }),
    prisma.topic.findMany({ include: { subject: true } }),
    prisma.subtopic.findMany({ include: { topic: { include: { subject: true } } } }),
    prisma.exam.findMany({ orderBy: { bcsNo: "asc" } }),
    prisma.question.findMany({
      where: { kind: "HISTORICAL" },
      select: { examId: true, status: true, subtopicId: true, verifyClass: true },
    }),
    prisma.repeatFamily.findMany({
      orderBy: [{ occurrences: "desc" }, { id: "asc" }],
      include: {
        members: {
          include: {
            question: {
              select: { uid: true, text: true, options: true, correctIndex: true, explanation: true, explanationStatus: true, status: true, exam: { select: { bcsNo: true } } },
            },
          },
        },
      },
    }),
  ]);

  const examById = new Map(exams.map((e) => [e.id, e]));
  const generalExams = exams.filter((e) => e.type !== "SPECIAL").map((e) => e.bcsNo);
  const examsOfType = (t: ExamTypeKey) => exams.filter((e) => e.type === t).map((e) => e.bcsNo);

  // প্রতি (পরীক্ষা × উপবিষয়) গণনা
  const cell = new Map<string, number>(); // `${bcsNo}|${subtopicId}`
  for (const q of questions) {
    const e = examById.get(q.examId!)!;
    const k = `${e.bcsNo}|${q.subtopicId}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }
  const count = (examNos: number[], pred: (s: (typeof subtopics)[number]) => boolean) => {
    let c = 0;
    for (const no of examNos) for (const s of subtopics) if (pred(s)) c += cell.get(`${no}|${s.id}`) ?? 0;
    return c;
  };

  // ── ১. বিষয়ভিত্তিক বণ্টন (পরীক্ষাপ্রতি গড়), তিন ধরনে আলাদা
  const subjectByType = (["GENERAL_100", "GENERAL_200", "SPECIAL"] as ExamTypeKey[]).map((type) => {
    const nos = examsOfType(type);
    const total = count(nos, () => true);
    return {
      type,
      examCount: nos.length,
      examNos: nos,
      rows: subjects.map((s) => {
        const c = count(nos, (x) => x.topic.subject.code === s.code);
        return { code: s.code, nameBn: s.nameBn, perExam: c / nos.length, share: total ? (c / total) * 100 : 0 };
      }),
    };
  });

  // ── ১খ. প্রতিটি সাধারণ বিসিএসে বিষয়ের অংশ (%)
  const timeline = generalExams.map((no) => {
    const counts: Record<string, number> = {};
    for (const s of subtopics) {
      const c = cell.get(`${no}|${s.id}`) ?? 0;
      if (c) counts[s.topic.subject.code] = (counts[s.topic.subject.code] ?? 0) + c;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const shares = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v / total) * 100]));
    const partial = exams.find((e) => e.bcsNo === no)?.completeness === "PARTIAL";
    return { bcsNo: no, counts, shares, total, partial };
  });

  // ── ২. টপিক: Priority Score + সাধারণ পরীক্ষায় মোট প্রশ্ন + পর্বভিত্তিক পরিবর্তন
  const era = generalExams.filter((n) => n >= ERA_FROM).sort((a, b) => a - b);
  const recentNos = era.slice(-TREND_WINDOW);
  const prevNos = era.slice(-2 * TREND_WINDOW, -TREND_WINDOW);
  const topicRows = topics
    .map((t) => {
      const inT = (s: (typeof subtopics)[number]) => s.topicId === t.id;
      return {
        code: t.code,
        nameBn: t.nameBn,
        subjectCode: t.subject.code,
        subjectBn: t.subject.nameBn,
        score: t.priorityScore,
        grade: t.priorityGrade as Grade | null,
        totalGeneral: count(generalExams, inT),
        prevPerExam: count(prevNos, inT) / prevNos.length,
        recentPerExam: count(recentNos, inT) / recentNos.length,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // ── ৩. উপবিষয় (Priority List)
  const subtopicRows = subtopics
    .map((s) => ({
      code: s.code,
      nameBn: s.nameBn,
      topicBn: s.topic.nameBn,
      subjectCode: s.topic.subject.code,
      subjectBn: s.topic.subject.nameBn,
      grade: s.priorityGrade as Grade | null,
      score: s.priorityScore,
      histTotal: s.histTotal,
      presenceAll: s.presenceAll,
      presence200: s.presence200,
      recentCount: s.recentCount,
      trend: s.trend,
      whyBn: s.whyBn,
      tipBn: s.tipBn,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // ── ৪. Heatmap: উপবিষয় × সাধারণ পরীক্ষা
  const heatRows = subtopicRows.map((r) => {
    const s = subtopics.find((x) => x.code === r.code)!;
    return { code: r.code, nameBn: r.nameBn, subjectCode: r.subjectCode, grade: r.grade, counts: generalExams.map((no) => cell.get(`${no}|${s.id}`) ?? 0) };
  });

  // ── ৫. পুনরাবৃত্ত প্রশ্ন-পরিবার
  const familyRows = families.map((f) => {
    const best = f.members
      .map((m) => m.question)
      .filter((q) => q.status === "PUBLISHED" && q.correctIndex != null)
      .sort((a, b) => (a.exam?.bcsNo ?? 0) - (b.exam?.bcsNo ?? 0))
      .at(-1);
    return {
      id: f.id,
      text: best?.text ?? f.sampleText,
      options: best?.options ?? f.sampleOpts.split(" / "),
      correctIndex: best?.correctIndex ?? null,
      explanation: best?.explanation ?? null,
      explanationVerified: best?.explanationStatus === "VERIFIED",
      subtopicBn: f.subtopicBn,
      grade: f.grade as Grade | null,
      occurrences: f.occurrences,
      matchType: f.matchType,
      examNos: [...new Set(f.members.map((m) => m.question.exam?.bcsNo).filter((n): n is number => !!n))].sort((a, b) => a - b),
    };
  });

  // হিরো-প্রশ্ন: সবচেয়ে বেশি পরীক্ষায় আসা, হুবহু পুনরাবৃত্ত, উত্তরসহ পরিবার
  const hero =
    familyRows.find((f) => f.correctIndex != null && f.matchType.includes("হুবহু") && f.options.length === 4) ??
    familyRows.find((f) => f.correctIndex != null && f.options.length === 4)!;

  const trendCounts: Record<string, number> = {};
  for (const s of subtopicRows) if (s.trend) trendCounts[s.trend] = (trendCounts[s.trend] ?? 0) + 1;

  return {
    totals: {
      exams: exams.length,
      generalExams: generalExams.length,
      specialExams: exams.filter((e) => e.type === "SPECIAL").length,
      exams200: examsOfType("GENERAL_200").length,
      questions: questions.length,
      published: questions.filter((q) => q.status === "PUBLISHED").length,
      subjects: subjects.length,
      topics: topics.length,
      subtopics: subtopics.length,
      families: families.length,
      families3: families.filter((f) => f.occurrences >= 3).length,
      gradeCounts: (["A", "B", "C", "D"] as Grade[]).map((g) => ({ grade: g, n: subtopicRows.filter((s) => s.grade === g).length })),
    },
    subjects: subjects.map((s) => ({ code: s.code, nameBn: s.nameBn, marks200: s.marks200 })),
    exams: exams.map((e) => ({ bcsNo: e.bcsNo, type: e.type as ExamTypeKey, count: e.questionCount, partial: e.completeness === "PARTIAL", notesBn: e.notesBn })),
    generalExams,
    periods: { prev: prevNos, recent: recentNos },
    subjectByType,
    timeline,
    topics: topicRows,
    subtopics: subtopicRows,
    heat: { exams: generalExams, rows: heatRows },
    families: familyRows,
    hero,
    trendCounts,
  };
}
