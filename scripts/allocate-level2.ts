/**
 * Level 2-এর নতুন প্রশ্নের লক্ষ্য — প্রতিটি উপবিষয়ে কতটি (প্রস্তাব; আপনার অনুমোদনের পর চূড়ান্ত)।
 *
 * উৎস (সবই গবেষণা থেকে):
 *  ১. বিষয়ভিত্তিক মোট: ধাপ ০৯ "কতগুলো MCQ পড়বেন" সারণির "বাড়তি অনুশীলন (আনুমানিক)" কলাম (মোট ১০,৪০০)।
 *  ২. বিষয় → টপিক: ধাপ ০৯ "টপিকভিত্তিক আনুমানিক প্রশ্ন (নতুন মানবণ্টনে)" অনুপাতে।
 *  ৩. টপিক → উপবিষয়: ২০০ নম্বরের ১২টি সাধারণ বিসিএসে (৩৫–৫০তম) টপিকের ভেতরে উপবিষয়ের অংশ অনুযায়ী
 *     (গবেষণার "আনুমানিক প্রশ্ন"-এর একই পদ্ধতি)।
 *  ৪. প্রতিটি উপবিষয়ে ন্যূনতম FLOOR টি — পুরো সিলেবাস যেন কভার হয় (এটিই একমাত্র নিজস্ব প্যারামিটার)।
 *
 *   npx tsx scripts/allocate-level2.ts [--floor 10] [--write]
 *   --write ছাড়া শুধু হিসাব দেখায় ও docs/LEVEL2_ALLOCATION.md লেখে; --write দিলে ডেটাবেসে targetQuestions বসায়।
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const db = new PrismaClient();
const args = process.argv.slice(2);
const FLOOR = Number(args[args.indexOf("--floor") + 1]) || 10;
const WRITE = args.includes("--write");
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/,/g, "");
const bn = (v: number | string) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

function tables(html: string) {
  const unesc = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) =>
    [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => unesc(c[1]))),
  );
}

async function main() {
  const html = readFileSync(path.resolve(__dirname, "..", "data", "source", "step09_priority.html"), "utf8");
  const all = tables(html);
  const subjTable = all.find((t) => t[0]?.some((h) => h.includes("বাড়তি অনুশীলন")))!;
  const topicTable = all.find((t) => t[0]?.includes("টপিক") && t[0]?.includes("আনুমানিক প্রশ্ন"))!;

  const subjects = await db.subject.findMany();
  const subjTarget = new Map<string, number>();
  for (const r of subjTable.slice(1)) {
    const s = subjects.find((x) => x.nameBn === r[0]);
    if (s) subjTarget.set(s.code, Number(toAscii(r[2])));
  }
  if (subjTarget.size !== subjects.length) throw new Error(`বিষয় মেলেনি: ${subjTarget.size}/${subjects.length}`);

  const topics = await db.topic.findMany({ include: { subject: true, subtopics: true } });
  const ti = topicTable[0].indexOf("টপিক");
  const ei = topicTable[0].indexOf("আনুমানিক প্রশ্ন");
  const topicEst = new Map<number, number>();
  for (const r of topicTable.slice(1)) {
    const t = topics.find((x) => x.nameBn === r[ti]);
    if (t) topicEst.set(t.id, Number(toAscii(r[ei])));
  }
  const missingT = topics.filter((t) => !topicEst.has(t.id)).map((t) => t.nameBn);
  if (missingT.length) console.log("সতর্কতা: আনুমানিক প্রশ্ন নেই এমন টপিক:", missingT.join(", "));

  // ২০০ নম্বরের সাধারণ বিসিএসে উপবিষয়ভিত্তিক প্রশ্ন
  const counts = await db.$queryRaw<{ id: number; n: number }[]>`
    select st.id, count(q.id)::int as n from "Subtopic" st
    left join "Question" q on q."subtopicId" = st.id and q.kind = 'HISTORICAL'
      and q."examId" in (select id from "Exam" where type = 'GENERAL_200')
    group by st.id`;
  const n200 = new Map(counts.map((c) => [c.id, c.n]));

  type Row = { code: string; name: string; topic: string; subject: string; grade: string | null; hist200: number; target: number };
  const rows: Row[] = [];
  for (const s of subjects.sort((a, b) => a.order - b.order)) {
    const sTopics = topics.filter((t) => t.subjectId === s.id);
    const estSum = sTopics.reduce((a, t) => a + (topicEst.get(t.id) ?? 0), 0);
    const subs = sTopics.flatMap((t) => t.subtopics.map((st) => ({ st, t })));
    const budget = subjTarget.get(s.code)! - FLOOR * subs.length; // ন্যূনতমের পর বাকি
    if (budget < 0) throw new Error(`${s.nameBn}: ন্যূনতম ${FLOOR} ধরলে লক্ষ্য ছাড়িয়ে যায়`);
    const raw: { st: (typeof subs)[number]["st"]; t: (typeof subs)[number]["t"]; extra: number }[] = [];
    for (const t of sTopics) {
      const tShare = estSum ? (topicEst.get(t.id) ?? 0) / estSum : 1 / sTopics.length;
      const inT = t.subtopics;
      const tHist = inT.reduce((a, x) => a + (n200.get(x.id) ?? 0), 0);
      for (const st of inT) raw.push({ st, t, extra: budget * tShare * (tHist ? (n200.get(st.id) ?? 0) / tHist : 1 / inT.length) });
    }
    // সর্বোচ্চ-অবশিষ্ট পদ্ধতিতে পূর্ণসংখ্যা, যাতে বিষয়ের মোট হুবহু মেলে
    const floored = raw.map((r) => ({ ...r, n: Math.floor(r.extra) }));
    let left = budget - floored.reduce((a, r) => a + r.n, 0);
    [...floored].sort((a, b) => (b.extra - Math.floor(b.extra)) - (a.extra - Math.floor(a.extra))).forEach((r) => { if (left-- > 0) r.n++; });
    for (const r of floored)
      rows.push({ code: r.st.code, name: r.st.nameBn, topic: r.t.nameBn, subject: s.nameBn, grade: r.st.priorityGrade, hist200: n200.get(r.st.id) ?? 0, target: FLOOR + r.n });
  }

  const total = rows.reduce((a, r) => a + r.target, 0);
  const byGrade = ["A", "B", "C", "D"].map((g) => `${g}: ${bn(rows.filter((r) => r.grade === g).reduce((a, r) => a + r.target, 0).toLocaleString("en-IN"))}`);
  console.log(`মোট লক্ষ্য: ${total} (ন্যূনতম ${FLOOR}/উপবিষয়), উপবিষয় ${rows.length}`);
  console.log("শ্রেণিভিত্তিক:", byGrade.join(", "));

  // ── প্রতিবেদন
  const lines = [
    "# Level 2: উপবিষয়ভিত্তিক নতুন প্রশ্নের লক্ষ্য (প্রস্তাব — অনুমোদন বাকি)",
    "",
    `মোট **${bn(total.toLocaleString("en-IN"))}টি** নতুন প্রশ্ন, ${bn(rows.length)}টি উপবিষয়ে। প্রতিটি উপবিষয়ে ন্যূনতম ${bn(FLOOR)}টি।`,
    "",
    "পদ্ধতি: বিষয়ের মোট = ধাপ ০৯-এর \"বাড়তি অনুশীলন (আনুমানিক)\"; বিষয় → টপিক = ধাপ ০৯-এর টপিকভিত্তিক আনুমানিক প্রশ্নের অনুপাত;",
    "টপিক → উপবিষয় = ২০০ নম্বরের ১২টি সাধারণ বিসিএসে উপবিষয়ের অংশ; তারপর প্রতিটিতে ন্যূনতম সংখ্যা।",
    "",
    `শ্রেণিভিত্তিক মোট: ${byGrade.join("; ")}`,
    "",
    "| বিষয় | টপিক | উপবিষয় | Priority | ২০০-যুগে বিগত প্রশ্ন | নতুন প্রশ্নের লক্ষ্য |",
    "|---|---|---|---|---:|---:|",
    ...rows.map((r) => `| ${r.subject} | ${r.topic} | ${r.name} | ${r.grade ?? "—"} | ${bn(r.hist200)} | ${bn(r.target)} |`),
  ];
  writeFileSync(path.resolve(__dirname, "..", "docs", "LEVEL2_ALLOCATION.md"), lines.join("\n") + "\n");
  console.log("লেখা হয়েছে: docs/LEVEL2_ALLOCATION.md");

  if (WRITE) {
    for (const r of rows) await db.subtopic.update({ where: { code: r.code }, data: { targetQuestions: r.target } });
    console.log("ডেটাবেসে targetQuestions বসানো হয়েছে।");
  }
}

main().finally(() => db.$disconnect());
