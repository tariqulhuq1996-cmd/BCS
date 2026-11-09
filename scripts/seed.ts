/**
 * Learning Roadmap ও নিয়মের বীজ-ডেটা। import-research.ts চালানোর পরে চালাতে হবে।
 *  - ৩টি Level
 *  - RuleSetting: শুধু অনুপস্থিত key যোগ হয় (অ্যাডমিনের বদলানো মান অক্ষত থাকে)
 *  - Level 1: ৪১টি পরীক্ষা কালানুক্রমে + Final Assessment, শৃঙ্খলিত পূর্বশর্ত
 *  - Level 2: ২৬৮ উপবিষয় চারটি Priority Phase-এ (A→D) + প্রতিটি Phase-এর Checkpoint + Final
 *  - Level 3-এর কাজগুলো Model Test তৈরি হলে (Phase 07) যোগ হবে
 */
import { PrismaClient, Prisma, TaskKind } from "@prisma/client";
import { DEFAULT_RULES } from "../src/lib/rules/defaults";

const prisma = new PrismaClient();
const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

async function upsertTask(t: {
  key: string; levelId: number; kind: TaskKind; order: number; titleBn: string;
  phase?: number; examId?: number; subtopicId?: number;
}) {
  return prisma.learningTask.upsert({
    where: { key: t.key },
    update: { order: t.order, titleBn: t.titleBn, phase: t.phase ?? null, kind: t.kind, levelId: t.levelId },
    create: { ...t, phase: t.phase ?? null },
  });
}

async function setPrereqs(taskId: number, requires: number[]) {
  await prisma.taskPrerequisite.deleteMany({ where: { taskId } });
  if (requires.length)
    await prisma.taskPrerequisite.createMany({ data: requires.map((requiresId) => ({ taskId, requiresId })) });
}

async function main() {
  // ── Level
  const levels = [
    { no: 1, nameBn: "Historical BCS Question Mastery", descriptionBn: "১০ম–৫০তম বিসিএসের প্রশ্ন সমাধান, Revision ও Mastery — পরীক্ষার ধরন ও পুনরাবৃত্ত ধারণার শক্ত ভিত্তি।" },
    { no: 2, nameBn: "৯,০০০+ Topic-wise Question Mastery", descriptionBn: "বিষয় → টপিক → উপবিষয় অনুযায়ী বৃহৎ প্রশ্নভান্ডার, ৫২তম Priority List-এর ক্রমে।" },
    { no: 3, nameBn: "Full-length Model Test Mastery", descriptionBn: "২০০ নম্বরের ১৫০টি পূর্ণাঙ্গ Model Test — চূড়ান্ত প্রস্তুতি।" },
  ];
  const levelId: Record<number, number> = {};
  for (const l of levels) {
    const r = await prisma.learningLevel.upsert({ where: { no: l.no }, update: l, create: l });
    levelId[l.no] = r.id;
  }

  // ── নিয়ম (শুধু অনুপস্থিত)
  let newRules = 0;
  for (const [key, { value, noteBn }] of Object.entries(DEFAULT_RULES)) {
    const exists = await prisma.ruleSetting.findUnique({ where: { key_scope: { key, scope: "global" } } });
    if (!exists) {
      await prisma.ruleSetting.create({ data: { key, scope: "global", value: value as Prisma.InputJsonValue, noteBn } });
      newRules++;
    }
  }

  // ── Level 1
  const exams = await prisma.exam.findMany({ orderBy: { bcsNo: "asc" } });
  let prev: number | null = null;
  const l1Ids: number[] = [];
  for (const [i, e] of exams.entries()) {
    const tag = e.type === "SPECIAL" ? " (বিশেষ)" : "";
    const t = await upsertTask({ key: `L1:EXAM:${e.bcsNo}`, levelId: levelId[1], kind: "L1_EXAM", order: i + 1, titleBn: `${bn(e.bcsNo)}তম বিসিএস${tag}`, examId: e.id });
    await setPrereqs(t.id, prev ? [prev] : []);
    prev = t.id;
    l1Ids.push(t.id);
  }
  const l1Final = await upsertTask({ key: "L1:FINAL", levelId: levelId[1], kind: "L1_FINAL", order: exams.length + 1, titleBn: "Level 1 Final Assessment" });
  await setPrereqs(l1Final.id, prev ? [prev] : []);

  // ── Level 2
  const subs = await prisma.subtopic.findMany({ orderBy: [{ priorityScore: "desc" }, { code: "asc" }] });
  const phases: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  let order = 1;
  let gate = l1Final.id; // প্রথম Phase খোলে Level 1 শেষ হলে
  const phaseCounts: Record<string, number> = {};
  for (const [pi, g] of phases.entries()) {
    // শ্রেণিহীন উপবিষয় (থাকলে) শেষ Phase-এ
    const inPhase = subs.filter((s) => (s.priorityGrade ?? "D") === g);
    phaseCounts[g] = inPhase.length;
    const ids: number[] = [];
    for (const s of inPhase) {
      const t = await upsertTask({ key: `L2:SUB:${s.code}`, levelId: levelId[2], kind: "L2_SUBTOPIC", order: order++, phase: pi + 1, titleBn: s.nameBn, subtopicId: s.id });
      await setPrereqs(t.id, [gate]); // Phase-এর ভেতরে সব উপবিষয় একসঙ্গে খোলা
      ids.push(t.id);
    }
    const cp = await upsertTask({ key: `L2:CHECKPOINT:${g}`, levelId: levelId[2], kind: "L2_CHECKPOINT", order: order++, phase: pi + 1, titleBn: `Priority ${g} Phase Checkpoint` });
    await setPrereqs(cp.id, ids);
    gate = cp.id;
  }
  const l2Final = await upsertTask({ key: "L2:FINAL", levelId: levelId[2], kind: "L2_FINAL", order: order++, titleBn: "Level 2 Final Assessment" });
  await setPrereqs(l2Final.id, [gate]);

  // ── অর্জন (Achievement)
  const ach = [
    { key: "first_exam", nameBn: "প্রথম পদক্ষেপ", descBn: "প্রথম বিসিএস প্রশ্নপত্র সমাধান", icon: "flag" },
    { key: "l1_10", nameBn: "দশে দশ", descBn: "Level 1-এর ১০টি পরীক্ষায় Mastery", icon: "medal" },
    { key: "l1_done", nameBn: "ইতিহাসের কারিগর", descBn: "Level 1 সম্পন্ন", icon: "trophy" },
    { key: "streak_7", nameBn: "সাত দিনের ধারা", descBn: "টানা ৭ দিন Revision", icon: "flame" },
    { key: "phase_a", nameBn: "অগ্রাধিকার A জয়", descBn: "Priority A Phase সম্পন্ন", icon: "star" },
    { key: "l2_done", nameBn: "টপিক-মাস্টার", descBn: "Level 2 সম্পন্ন", icon: "trophy" },
    { key: "mt_160", nameBn: "১৬০+", descBn: "কোনো Model Test-এ নেট ১৬০ বা তার বেশি", icon: "target" },
    { key: "l3_done", nameBn: "পূর্ণ প্রস্তুতি", descBn: "১৫০টি Model Test সম্পন্ন", icon: "crown" },
  ];
  for (const a of ach) await prisma.achievement.upsert({ where: { key: a.key }, update: a, create: a });

  const taskCount = await prisma.learningTask.count();
  console.log(`নিয়ম: নতুন ${newRules} (মোট ${Object.keys(DEFAULT_RULES).length})`);
  console.log(`Level 1: ${l1Ids.length}টি পরীক্ষা + Final; Level 2: Phase A ${phaseCounts.A}, B ${phaseCounts.B}, C ${phaseCounts.C}, D ${phaseCounts.D} উপবিষয় + ৪ Checkpoint + Final`);
  console.log(`মোট কাজ: ${taskCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
