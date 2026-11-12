/**
 * স্বাধীন যাচাই: উৎস-ফাইল থেকে আলাদাভাবে গুনে ডেটাবেসের সঙ্গে মেলানো।
 * কোনো অমিল থাকলে exit code 1।
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const src = JSON.parse(readFileSync(path.resolve(__dirname, "..", "data", "source", "research_questions.json"), "utf8"));
let fails = 0;
function check(name: string, expected: unknown, actual: unknown) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  প্রত্যাশিত ${JSON.stringify(expected)}  পাওয়া ${JSON.stringify(actual)}`}`);
}

async function main() {
  const q = src.q as any[];
  const ok = (r: any) => typeof r[4] === "number" && r[4] >= 0 && ["V", "C", "J", "S"].includes(r[5]) && r[3].length === 4 && r[3].every((o: string) => String(o).trim());

  check("মোট প্রশ্ন", q.length, await prisma.question.count({ where: { kind: "HISTORICAL" } }));
  check("প্রকাশিত", q.filter(ok).length, await prisma.question.count({ where: { kind: "HISTORICAL", status: "PUBLISHED" } }));
  check("বাতিল (RETIRED)", q.filter((r) => !ok(r)).length, await prisma.question.count({ where: { kind: "HISTORICAL", status: "RETIRED" } }));
  check("বাধ্যতামূলক পথযোগ্য (V+C, প্রকাশিত)", q.filter((r) => ok(r) && ["V", "C"].includes(r[5])).length,
    await prisma.question.count({ where: { status: "PUBLISHED", verifyClass: { in: ["V", "C"] } } }));
  check("ব্যাখ্যাসহ", q.filter((r) => r[11]?.trim()).length, await prisma.question.count({ where: { explanation: { not: null } } }));

  // পরীক্ষাভিত্তিক
  const perExam: Record<number, number> = {};
  for (const r of q) perExam[r[0]] = (perExam[r[0]] ?? 0) + 1;
  const dbExam = await prisma.exam.findMany({ orderBy: { bcsNo: "asc" } });
  check("পরীক্ষার সংখ্যা", Object.keys(src.types).length, dbExam.length);
  check("পরীক্ষাভিত্তিক প্রশ্নসংখ্যা", perExam, Object.fromEntries(dbExam.map((e) => [e.bcsNo, e.questionCount])));
  const actualPerExam = await prisma.question.groupBy({ by: ["examId"], _count: true });
  const idToNo = Object.fromEntries(dbExam.map((e) => [e.id, e.bcsNo]));
  check("প্রশ্ন-টেবিলে পরীক্ষাভিত্তিক গণনা", perExam, Object.fromEntries(actualPerExam.map((g) => [idToNo[g.examId!], g._count]).sort((a, b) => a[0] - b[0])));
  check("বিশেষ BCS", Object.entries(src.types).filter(([, t]) => t === "বিশেষ").map(([n]) => +n),
    dbExam.filter((e) => e.type === "SPECIAL").map((e) => e.bcsNo));

  // বিষয়ভিত্তিক
  const perSubj: Record<string, number> = {};
  for (const r of q) perSubj[r[10].split(".")[0]] = (perSubj[r[10].split(".")[0]] ?? 0) + 1;
  const qs = await prisma.question.findMany({ select: { subtopic: { select: { code: true } } } });
  const dbSubj: Record<string, number> = {};
  for (const x of qs) dbSubj[x.subtopic.code.split(".")[0]] = (dbSubj[x.subtopic.code.split(".")[0]] ?? 0) + 1;
  check("বিষয়ভিত্তিক প্রশ্নসংখ্যা", Object.fromEntries(Object.entries(perSubj).sort()), Object.fromEntries(Object.entries(dbSubj).sort()));

  // উপবিষয় ও Priority
  const grades: Record<string, number> = {};
  for (const p of Object.values<any>(src.pri)) grades[p.g] = (grades[p.g] ?? 0) + 1;
  check("উপবিষয় (Priority List)", Object.keys(src.pri).length, await prisma.subtopic.count());
  const dbGrades = await prisma.subtopic.groupBy({ by: ["priorityGrade"], _count: true });
  check("Priority শ্রেণি বণ্টন", Object.fromEntries(Object.entries(grades).sort()), Object.fromEntries(dbGrades.map((g) => [g.priorityGrade, g._count]).sort()));
  check("টপিক", new Set([...q.map((r) => r[10]), ...Object.keys(src.pri)].map((c: string) => c.split(".").slice(0, 2).join("."))).size, await prisma.topic.count());

  // প্রতিটি প্রশ্নের উত্তর ও অপশন হুবহু
  const dbQ = new Map((await prisma.question.findMany({ select: { uid: true, correctIndex: true, options: true, text: true } })).map((x) => [x.uid, x]));
  let mism = 0;
  for (const r of q) {
    const d = dbQ.get(`H-${r[0]}-${r[1]}`);
    const ans = typeof r[4] === "number" && r[4] >= 0 ? r[4] : null;
    if (!d || d.correctIndex !== ans || d.text !== r[2] || JSON.stringify(d.options) !== JSON.stringify(r[3].map(String))) mism++;
  }
  check("প্রতিটি প্রশ্নের লেখা/অপশন/উত্তর হুবহু", 0, mism);

  check("পুনরাবৃত্তি-পরিবার", src.rep.length, await prisma.repeatFamily.count());
  const orphan = await prisma.repeatFamily.count({ where: { members: { none: {} } } });
  check("সংযোগহীন পুনরাবৃত্তি-পরিবার", 0, orphan);

  // Roadmap
  check("Level 1 কাজ (পরীক্ষা + Repeat Mastery + Final)", dbExam.length + 2, await prisma.learningTask.count({ where: { level: { no: 1 } } }));
  check("Level 2 উপবিষয়-কাজ", Object.keys(src.pri).length, await prisma.learningTask.count({ where: { kind: "L2_SUBTOPIC" } }));
  const l1 = await prisma.learningTask.findMany({ where: { kind: "L1_EXAM" }, orderBy: { order: "asc" }, include: { prerequisites: true, exam: true } });
  const diag = await prisma.learningTask.findUnique({ where: { key: "L0:DIAGNOSTIC" } });
  // ১০ম BCS খোলে শুরুর মূল্যায়নের পরে; তারপর একটির পর একটি
  const chainOk = l1.every((t, i) => t.prerequisites.length === 1 && t.prerequisites[0].requiresId === (i === 0 ? diag?.id : l1[i - 1].id));
  check("Level 1 ক্রমিক শৃঙ্খল (শুরুর মূল্যায়ন → ১০ম → ৫০তম)", true, chainOk && l1[0].exam?.bcsNo === 10 && l1.at(-1)?.exam?.bcsNo === 50);
  const noRoot = await prisma.learningTask.count({ where: { prerequisites: { none: {} } } });
  check("পূর্বশর্তহীন কাজ শুধু ১টি (ধাপ ০: প্রশ্ন-বিশ্লেষণ)", 1, noRoot);

  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
