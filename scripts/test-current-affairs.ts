/**
 * Current Affairs: নথি পড়া, স্মার্ট ক্রম, Leitner-হিসাব, Import-এ অগ্রগতি রক্ষা।
 *   npx tsx scripts/test-current-affairs.ts
 * (প্রশ্নব্যাংক ডেটাবেসে আগে থেকে থাকতে হবে: scripts/import-current-affairs.ts)
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { bankKeyFromFilename, parseCurrentAffairsDocx, parseBnDate } from "../src/lib/current-affairs/parse";
import { importCurrentAffairs } from "../src/lib/current-affairs/import";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};

async function main() {
  const { pickSet, answerQuestion, getOverview } = await import("../src/lib/current-affairs/service");
  const docx = path.resolve(__dirname, "..", "data", "source", "current-affairs", "current-affairs.docx");
  if (existsSync(docx)) {
    const p = await parseCurrentAffairsDocx(readFileSync(docx));
    const n = (g: string) => p.questions.filter((q) => q.priority === g).length;
    check("নথি: ১৩৮ প্রশ্ন, A/B/C = ৬২/৬০/১৬, ১৫ অধ্যায়, ৩৮ পরিবর্তনশীল", p.questions.length === 138 && n("A") === 62 && n("B") === 60 && n("C") === 16 && p.chapters.length === 15 && p.questions.filter((q) => q.volatile).length === 38, { q: p.questions.length });
    check("নথি: ত্রুটি নেই, প্রতিটি প্রশ্নে ৪ অপশন ও সঠিক উত্তর", !p.errors.length && p.questions.every((q) => q.options.length === 4 && q.correctIndex >= 0), p.errors.slice(0, 3));
    check("নথি: i/ii/iii বিবৃতি আলাদা", p.questions.some((q) => q.statements.length === 3 && q.stemTail));
  } else console.log("SKIP  নথি পাওয়া যায়নি");
  const bnpDocx = path.resolve(__dirname, "..", "data", "source", "current-affairs", "bnp-govt-political.docx");
  if (existsSync(bnpDocx)) {
    const p = await parseCurrentAffairsDocx(readFileSync(bnpDocx));
    const n = (g: string) => p.questions.filter((q) => q.priority === g).length;
    check("নথি-২ (উত্তর প্রশ্নের নিচে): ৭৮ প্রশ্ন, A/B/C = ৪২/২৯/৭, ৬ অধ্যায়, ৮ পরিবর্তনশীল, ত্রুটি নেই", p.questions.length === 78 && n("A") === 42 && n("B") === 29 && n("C") === 7 && p.chapters.length === 6 && p.questions.filter((q) => q.volatile).length === 8 && !p.errors.length, { q: p.questions.length, e: p.errors.slice(0, 2) });
    check("নথি-২: প্রতিটি প্রশ্নে ব্যাখ্যা ও উৎস; অধ্যায়-সারসংক্ষেপ ও তারিখ-তালিকা Quick Revision-এ", p.questions.every((q) => q.explanation && q.sourceText) && p.revision.some((r) => r.group === "কালানুক্রমিক তারিখ") && p.revision.some((r) => r.topic === "ফ্যামিলি কার্ড"));
  }
  check("ফাইলের নাম থেকে ব্যাংক-key", bankKeyFromFilename("BCS52_BNP_Govt_Political_Question_Bank.docx") === "bnp-govt-political" && bankKeyFromFilename("BCS52_Current_Affairs_Question_Bank.docx") === "current-affairs");
  check("বাংলা তারিখ পড়া", parseBnDate("১১ নভেম্বর ২০২৬")?.toISOString() === "2026-11-10T18:00:00.000Z");

  const total = await db.caQuestion.count({ where: { active: true } });
  if (!total) return console.log("SKIP  ডেটাবেসে প্রশ্নব্যাংক নেই");
  const u = await db.user.create({ data: { email: `ca${Date.now()}@ca.test`, passwordHash: "x" } });
  try {
    const s1 = await pickSet(db, u.id, { mode: "smart" });
    check("নতুন শিক্ষার্থী: স্মার্ট সেটে ২০টি, প্রথমে Priority A", s1.length === 20 && s1.every((q) => q.priority === "A"));
    check("সঠিক উত্তর ক্লায়েন্টে যায় না", s1.every((q) => !("correctIndex" in q)));
    check("অপশনের ক্রম বৈধ বিন্যাস", s1.every((q) => [...q.order].sort().join() === "0,1,2,3"));
    const stmt = (await pickSet(db, u.id, { mode: "all" })).filter((q) => q.statements.length);
    check("বিবৃতি-প্রশ্নে অপশন এলোমেলো হয় না", stmt.every((q) => q.order.join() === "0,1,2,3"));

    const q = await db.caQuestion.findFirstOrThrow({ where: { no: s1[5].no } });
    const wrong = await answerQuestion(db, u.id, q.id, (q.correctIndex + 1) % 4);
    check("ভুল উত্তর: বাক্স ১, ব্যাখ্যা ফেরত", wrong?.correct === false && wrong.box === 1 && wrong.correctIndex === q.correctIndex && !!wrong.explanation);
    const s2 = await pickSet(db, u.id, { mode: "smart" });
    check("ভুল প্রশ্ন পরের স্মার্ট সেটে প্রথমে", s2[0].id === q.id);
    const r1 = await answerQuestion(db, u.id, q.id, q.correctIndex);
    const r2 = await answerQuestion(db, u.id, q.id, q.correctIndex);
    check("পরপর ঠিক: বাক্স ২ → ৩, পুনরাবৃত্তি ৩ → ৭ দিন", r1?.box === 2 && r1.nextInDays === 3 && r2?.box === 3 && r2.nextInDays === 7);
    check("ভুলের তালিকা খালি হলে 'ভুলগুলো আবার'-এ কিছু নেই", (await pickSet(db, u.id, { mode: "wrong" })).length === 0);
    const ov = await getOverview(db, u.id);
    check("সারসংক্ষেপ: দেখা ১, আয়ত্তে ১", ov.seen === 1 && ov.mastered === 1 && ov.total === total);
    check("অবৈধ উত্তর-সূচক গ্রহণ হয় না", (await answerQuestion(db, u.id, q.id, 7)) === null);

    // ── একাধিক প্রশ্নব্যাংক: একটির Import অন্যটিকে ছোঁয় না
    const tKey = `test-bank-${Date.now()}`;
    const mini = { name: "পরীক্ষার ব্যাংক", title: "পরীক্ষা", version: "০.১", verifiedBn: null, verifiedOn: null, howToUse: [], chapters: [{ no: 1, nameBn: "অধ্যায় এক" }],
      questions: [{ no: 1, chapterNo: 1, priority: "A" as const, text: "পরীক্ষার প্রশ্ন?", statements: [], stemTail: null, options: ["ক১", "খ১", "গ১", "ঘ১"], correctIndex: 2, explanation: "কারণ", remember: null, sourceText: null, eventDate: null, verifiedBn: null, volatile: false, volatileReason: null }],
      revision: [], sources: [], errors: [], warnings: [] };
    const before = await db.caQuestion.count({ where: { active: true, bankKey: { not: tKey } } });
    try {
      const r = await importCurrentAffairs(db, mini, tKey, "test");
      const after = await db.caQuestion.count({ where: { active: true, bankKey: { not: tKey } } });
      check("নতুন ব্যাংক Import: ১টি যোগ, অন্য ব্যাংকের সক্রিয় প্রশ্ন অপরিবর্তিত", r.added === 1 && r.retired === 0 && after === before, { r, before, after });
      const only = await pickSet(db, u.id, { mode: "all", bank: tKey });
      check("ব্যাংক বেছে অনুশীলন: শুধু সেই ব্যাংকের প্রশ্ন", only.length === 1 && only[0].bank === "পরীক্ষার ব্যাংক");
      const ov2 = await getOverview(db, u.id);
      check("সারসংক্ষেপে প্রতিটি ব্যাংক আলাদা", ov2.banks.some((b) => b.key === tKey && b.total === 1) && ov2.banks.length >= 2);
    } finally {
      await db.caQuestion.deleteMany({ where: { bankKey: tKey } });
      await db.caChapter.deleteMany({ where: { bankKey: tKey } });
      await db.caBank.deleteMany({ where: { bankKey: tKey } });
    }
  } finally {
    await db.user.delete({ where: { id: u.id } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    fails++;
  })
  .finally(async () => {
    await db.$disconnect();
    console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
    if (fails) process.exitCode = 1;
  });
