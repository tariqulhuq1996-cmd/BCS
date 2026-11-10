/**
 * গবেষণা-ডেটা (ধাপ ০৪–০৯) ডেটাবেসে আনা।
 *   উৎস ১: data/source/research_questions.json — ৫,৩৫২ প্রশ্ন, উত্তর, যাচাই-শ্রেণি, ব্যাখ্যা,
 *          ২৬৮ উপবিষয়ের Priority তথ্য, ১৭১ পুনরাবৃত্ত প্রশ্ন-পরিবার
 *   উৎস ২: data/source/dataset_step04.tsv — পৃষ্ঠা, গৌণ ট্যাগ, শ্রেণিবিন্যাসের আস্থা
 *
 * বারবার চালানো নিরাপদ (idempotent): uid দিয়ে upsert; শিক্ষার্থীর কোনো তথ্য মোছে না।
 * কোনো সংখ্যা অনুমান করে বসানো হয় না — উৎসে না থাকলে ফাঁকা (null) থাকে।
 */
import { PrismaClient, Prisma, ExamType, PriorityGrade, QuestionStatus, ExplanationStatus } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { questionHash } from "../src/lib/questions/hash";

const prisma = new PrismaClient();
const SRC = path.resolve(__dirname, "..", "data", "source");

// research_questions.json-এর প্রতিটি প্রশ্ন-সারির কলাম-ক্রম
type QRow = [
  number, // 0 বিসিএস নং
  string, // 1 প্রশ্ন নং
  string, // 2 প্রশ্ন
  string[], // 3 চারটি অপশন
  number | null, // 4 সঠিক অপশন (০–৩, -১ = নেই)
  string, // 5 যাচাই-শ্রেণি V C J S D X N
  string, // 6 যাচাই-অবস্থা (বিবরণ)
  string, // 7 উত্তর-টীকা
  number, // 8 বিষয়-সূচক
  string, // 9 মূল টপিক
  string, // 10 উপবিষয় কোড
  string, // 11 ব্যাখ্যা
];
type Pri = { s: string; t: string; n: string; g: string; sc: number; tot: string; era: string; r200: string; rec: string; tr: string; why: string; tip: string };
type Rep = [string, string, string, string, string, string, string, string];

const SUBJECT_CODES = ["BN", "EN", "BD", "IA", "GE", "SC", "IT", "MA", "MN", "ET"];
const MARKS_200: Record<string, number> = { BN: 30, EN: 30, BD: 25, IA: 25, GE: 10, SC: 15, IT: 15, MA: 20, MN: 15, ET: 15 };
const PATH_OK = new Set(["V", "C", "J", "S"]); // প্রকাশযোগ্য; D X N বাতিল

const bnDigits = "০১২৩৪৫৬৭৮৯";
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
const intOrNull = (s: string | undefined) => {
  if (s == null) return null;
  const n = parseInt(toAscii(String(s)), 10);
  return Number.isFinite(n) ? n : null;
};

function readTsv() {
  const lines = readFileSync(path.join(SRC, "dataset_step04.tsv"), "utf8").replace(/^﻿/, "").split(/\r?\n/);
  const head = lines[0].split("\t");
  const col = (name: string) => head.indexOf(name);
  const iE = col("পরীক্ষা"), iN = col("প্রশ্ন নং"), iP = col("পৃষ্ঠা"), iT = col("ধরন"), iG = col("গৌণ ট্যাগ"), iC = col("আস্থা");
  const map = new Map<string, { page: number | null; section: string; tag: string; conf: string }>();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const c = line.split("\t");
    map.set(`${c[iE]}-${c[iN]}`, { page: intOrNull(c[iP]), section: c[iT] ?? "", tag: c[iG] ?? "", conf: c[iC] ?? "" });
  }
  return map;
}

async function main() {
  const data = JSON.parse(readFileSync(path.join(SRC, "research_questions.json"), "utf8")) as {
    subjects: string[];
    types: Record<string, string>;
    pri: Record<string, Pri>;
    q: QRow[];
    rep: Rep[];
  };
  const tsv = readTsv();

  // ── ১. বিষয়
  const subjectId: Record<string, number> = {};
  for (const [i, nameBn] of data.subjects.entries()) {
    const code = SUBJECT_CODES[i];
    const s = await prisma.subject.upsert({
      where: { code },
      update: { nameBn, order: i + 1, marks200: MARKS_200[code] },
      create: { code, nameBn, order: i + 1, marks200: MARKS_200[code] },
    });
    subjectId[code] = s.id;
  }

  // ── ২. টপিক (প্রশ্ন-সারি থেকে নাম; Priority List-এ থাকা উপবিষয়ের টপিকও)
  const topicName = new Map<string, string>();
  for (const r of data.q) topicName.set(r[10].split(".").slice(0, 2).join("."), r[9]);
  for (const [code, p] of Object.entries(data.pri)) {
    const tc = code.split(".").slice(0, 2).join(".");
    if (!topicName.has(tc)) topicName.set(tc, p.t);
  }
  const topicId: Record<string, number> = {};
  const topicCodes = [...topicName.keys()].sort();
  for (const [i, code] of topicCodes.entries()) {
    const nameBn = topicName.get(code)!;
    const subj = code.split(".")[0];
    const t = await prisma.topic.upsert({
      where: { code },
      update: { nameBn, subjectId: subjectId[subj] },
      create: { code, nameBn, subjectId: subjectId[subj], order: i + 1 },
    });
    topicId[code] = t.id;
  }

  // ── ৩. উপবিষয় (Priority List)
  const subCodes = new Set<string>([...Object.keys(data.pri), ...data.q.map((r) => r[10])]);
  const subtopicId: Record<string, number> = {};
  const sorted = [...subCodes].sort((a, b) => (data.pri[b]?.sc ?? -1) - (data.pri[a]?.sc ?? -1));
  for (const [i, code] of sorted.entries()) {
    const p = data.pri[code];
    const tc = code.split(".").slice(0, 2).join(".");
    const nameBn = p?.n ?? data.q.find((r) => r[10] === code)?.[9] ?? code;
    const fields = {
      topicId: topicId[tc],
      nameBn,
      order: i + 1,
      priorityGrade: p && ["A", "B", "C", "D"].includes(p.g) ? (p.g as PriorityGrade) : null,
      priorityScore: p?.sc ?? null,
      histTotal: intOrNull(p?.tot),
      presenceAll: p?.era || null,
      presence200: p?.r200 || null,
      recentCount: intOrNull(p?.rec),
      trend: p?.tr || null,
      whyBn: p?.why || null,
      tipBn: p?.tip || null,
    };
    const s = await prisma.subtopic.upsert({ where: { code }, update: fields, create: { code, ...fields } });
    subtopicId[code] = s.id;
  }

  // ── ৪. পরীক্ষা
  const counts = new Map<number, number>();
  for (const r of data.q) counts.set(r[0], (counts.get(r[0]) ?? 0) + 1);
  const examId: Record<number, number> = {};
  for (const [noStr, typeBn] of Object.entries(data.types)) {
    const bcsNo = Number(noStr);
    const n = counts.get(bcsNo) ?? 0;
    const type: ExamType = typeBn === "বিশেষ" ? "SPECIAL" : typeBn === "২০০ নম্বর" ? "GENERAL_200" : "GENERAL_100";
    // প্রত্যাশিত প্রশ্নসংখ্যা: ২০০ নম্বর = ২০০; ১০০ নম্বর = ১০০; বিশেষ = ডেটায় ১৫০-এর বেশি হলে ২০০, নইলে ১০০
    const expected = type === "GENERAL_200" ? 200 : type === "GENERAL_100" ? 100 : n > 150 ? 200 : 100;
    const completeness = n < expected ? "PARTIAL" : "COMPLETE";
    const b = (x: number) => String(x).replace(/\d/g, (d) => bnDigits[+d]);
    const notesBn = n < expected ? `ডেটাসেটে ${b(n)}টি প্রশ্ন (প্রত্যাশিত ${b(expected)})` : n > expected ? `ডেটাসেটে ${b(n)}টি প্রশ্ন (প্রত্যাশিত ${b(expected)}; উৎসে অতিরিক্ত)` : null;
    const e = await prisma.exam.upsert({
      where: { bcsNo },
      update: { type, expectedCount: expected, questionCount: n, completeness, notesBn },
      create: { bcsNo, type, expectedCount: expected, questionCount: n, completeness, notesBn },
    });
    examId[bcsNo] = e.id;
  }

  // ── ৫. প্রশ্ন
  const batch = await prisma.importBatch.create({
    data: { source: "research_questions.json + dataset_step04.tsv", format: "json", rows: data.q.length, inserted: 0, duplicates: 0 },
  });
  const existing = new Set((await prisma.question.findMany({ select: { uid: true } })).map((q) => q.uid));
  let inserted = 0, updated = 0;
  const problems: string[] = [];
  const CHUNK = 250;
  for (let i = 0; i < data.q.length; i += CHUNK) {
    const newRows: Prisma.QuestionCreateManyInput[] = [];
    const ops = data.q.slice(i, i + CHUNK).flatMap((r) => {
      const [bcs, no, text, opts, ans, cls, verifyNote, answerNote, , , code, expl] = r;
      const uid = `H-${bcs}-${no}`;
      const t = tsv.get(`${bcs}-${no}`);
      const hasAnswer = typeof ans === "number" && ans >= 0 && ans <= 3;
      const optsOk = Array.isArray(opts) && opts.length === 4 && opts.every((o) => String(o).trim() !== "");
      if (!optsOk) problems.push(`${uid}: অপশন অসম্পূর্ণ`);
      const status: QuestionStatus = hasAnswer && optsOk && PATH_OK.has(cls) ? "PUBLISHED" : "RETIRED";
      const explanation = expl?.trim() || null;
      const fields = {
        kind: "HISTORICAL" as const,
        text,
        options: opts.map(String),
        correctIndex: hasAnswer ? ans : null,
        explanation,
        explanationStatus: (explanation ? "DRAFT" : "NONE") as ExplanationStatus,
        subtopicId: subtopicId[code],
        source: `${bcs}তম বিসিএস প্রিলিমিনারি, প্রশ্ন ${no}`,
        examId: examId[bcs],
        examQNo: String(no),
        examPage: t?.page ?? null,
        examSection: t?.section || null,
        verifyClass: cls || null,
        verifyNote: verifyNote || null,
        answerNote: answerNote || null,
        classConfidence: t?.conf || null,
        secondaryTag: t?.tag || null,
        status,
        textHash: questionHash(text, opts.map(String)),
      };
      // নতুন প্রশ্ন একসঙ্গে (createMany — দূরের ডেটাবেসে দ্রুত); আগে থেকে থাকা প্রশ্ন আলাদাভাবে হালনাগাদ
      if (!existing.has(uid)) {
        inserted++;
        newRows.push({ uid, ...fields, importBatchId: batch.id });
        return [];
      }
      updated++;
      return [prisma.question.update({ where: { uid }, data: fields })];
    });
    if (newRows.length) await prisma.question.createMany({ data: newRows, skipDuplicates: true });
    if (ops.length) await prisma.$transaction(ops);
    process.stdout.write(`\rপ্রশ্ন: ${Math.min(i + CHUNK, data.q.length)}/${data.q.length}`);
  }
  console.log();

  // ── ৬. পুনরাবৃত্ত প্রশ্ন-পরিবার (প্রতিবার নতুন করে তৈরি)
  await prisma.repeatFamily.deleteMany();
  const uidToId = new Map((await prisma.question.findMany({ select: { uid: true, id: true } })).map((q) => [q.uid, q.id]));
  let linked = 0;
  for (const r of data.rep) {
    const [group, text, opts, subBn, grade, occ, match, refs] = r;
    const fam = await prisma.repeatFamily.create({
      data: {
        groupLabel: group || null,
        sampleText: text,
        sampleOpts: opts,
        subtopicBn: subBn,
        grade: ["A", "B", "C", "D"].includes(grade) ? (grade as PriorityGrade) : null,
        occurrences: intOrNull(occ) ?? 0,
        matchType: match,
        refs,
      },
    });
    const ids = refs
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => uidToId.get(`H-${toAscii(x)}`))
      .filter((x): x is string => !!x);
    if (ids.length) {
      await prisma.questionFamily.createMany({ data: [...new Set(ids)].map((questionId) => ({ familyId: fam.id, questionId })), skipDuplicates: true });
      linked += ids.length;
    } else problems.push(`পুনরাবৃত্তি-পরিবার "${text.slice(0, 30)}…": কোনো রেফারেন্স মেলেনি`);
  }

  // ── ৭. টপিক-স্তরের Priority Score (ধাপ ০৯ HTML-এর "টপিক-স্তর:" লাইন)
  const html = readFileSync(path.join(SRC, "step09_priority.html"), "utf8")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
  const topicByName = new Map((await prisma.topic.findMany()).map((t) => [t.nameBn, t.id]));
  let topicScored = 0;
  for (const line of html.matchAll(/টপিক-স্তর:([^\n]*?)(?=Priority A|\n)/g)) {
    for (const m of line[1].matchAll(/([^;—]+?)\s+—\s+([০-৯.]+)\s+\(([A-D])\)/g)) {
      const name = m[1].trim();
      const id = topicByName.get(name);
      if (!id) {
        problems.push(`টপিক-স্কোর: "${name}" নামের টপিক ডেটাবেসে নেই`);
        continue;
      }
      await prisma.topic.update({
        where: { id },
        data: { priorityScore: parseFloat(toAscii(m[2])), priorityGrade: m[3] as PriorityGrade },
      });
      topicScored++;
    }
  }
  console.log(`টপিক-স্তরের Priority Score: ${topicScored}/${topicByName.size}`);

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { inserted, updated, duplicates: 0, errors: problems.length ? problems : undefined },
  });

  console.log(`সম্পন্ন — বিষয় ${SUBJECT_CODES.length}, টপিক ${topicCodes.length}, উপবিষয় ${sorted.length}, পরীক্ষা ${Object.keys(examId).length}`);
  console.log(`প্রশ্ন: নতুন ${inserted}, হালনাগাদ ${updated}; পুনরাবৃত্তি-পরিবার ${data.rep.length} (প্রশ্ন-সংযোগ ${linked})`);
  if (problems.length) console.log(`সতর্কতা ${problems.length}টি:\n  ` + problems.slice(0, 20).join("\n  "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
