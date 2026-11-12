/**
 * অ্যাডমিন অংশের স্বয়ংক্রিয় পরীক্ষা: Excel Import, Export-এর পুনরায় Import (সব পুনরাবৃত্তি ধরা পড়ে),
 * ধাপ নিষ্ক্রিয় করলে শিক্ষার্থী আটকে না থাকা, পূর্ণ Backup-এ গোপন তথ্য না থাকা।
 *   npm run test:admin
 */
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { ensureStarted, reconcileDeactivated } from "../src/lib/progress/engine";
import { importQuestions, parseCsv, parseXlsx } from "../src/lib/questions/import";
import { fullBackup, progressCsv, questionsCsv } from "../src/lib/admin/export";
import { isCorrectChoice } from "../src/lib/exam/service";
import { normalizeOption } from "../src/lib/questions/hash";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};

async function main() {
  const tag = `adm${Date.now()}`;
  const u = await db.user.create({ data: { email: `${tag}@admin.test`, passwordHash: "x" } });
  const t10 = await db.learningTask.findUniqueOrThrow({ where: { key: "L1:EXAM:10" } });
  try {
    // ── Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("প্রশ্ন");
    ws.addRow(["subtopic_code", "question", "option_a", "option_b", "option_c", "option_d", "answer", "difficulty"]);
    ws.addRow(["BN.BH.SHD", "পরীক্ষামূলক এক্সেল প্রশ্ন ১?", "ক১", "খ১", "গ১", "ঘ১", "গ", "সহজ"]);
    ws.addRow(["EN.GR.PRP", "Excel test question two?", "in", "on", "at", "by", "B", "hard"]);
    ws.addRow([]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const recs = await parseXlsx(buf);
    check("Excel: দুটি সারি, ফাঁকা সারি বাদ, বাংলা লেখা অক্ষুণ্ণ", recs.length === 2 && recs[0].question === "পরীক্ষামূলক এক্সেল প্রশ্ন ১?" && recs[1].answer === "B", recs);
    const rep = await importQuestions(db, recs, { source: tag, format: "xlsx", dryRun: true });
    check("Excel থেকে পূর্বরূপ: ২টি যোগ হবে, ত্রুটি নেই", rep.inserted === 2 && rep.errors.length === 0, rep);

    // ── Export → আবার Import (পূর্বরূপ): সবকিছু পুনরাবৃত্তি হিসেবে ধরা পড়ে
    const csv = await questionsCsv(db);
    const rows = parseCsv(csv);
    const total = await db.question.count();
    check("প্রশ্ন-CSV-তে সব প্রশ্ন", rows.length === total, { rows: rows.length, total });
    const again = await importQuestions(db, rows, { source: tag, format: "csv", dryRun: true });
    check("Export করা প্রশ্ন আবার Import করলে একটিও নতুন যোগ হয় না", again.inserted === 0 && again.duplicates.length + again.errors.length === total, { ins: again.inserted, dup: again.duplicates.length, err: again.errors.length });
    check("Export-এর কলাম Import-এর সঙ্গে মেলে (ত্রুটি শুধু উৎসের: উত্তরহীন, একই বা ফাঁকা অপশন)", again.errors.every((e) => e.message.includes("উত্তর") || e.message.includes("একই") || e.message.includes("৪টি অপশন")), again.errors.filter((e) => !e.message.includes("উত্তর") && !e.message.includes("একই") && !e.message.includes("৪টি অপশন")).slice(0, 3));

    const dupQ = await db.question.findUniqueOrThrow({ where: { uid: "H-23-79" } }); // [২০% | ১৬% | ১৫% | ২০%], উত্তর ক
    check("উৎসে একই লেখার দুটি অপশন: দুটিই সঠিক ধরা হয়, অন্যগুলো নয়", isCorrectChoice(dupQ, 0) && isCorrectChoice(dupQ, 3) && !isCorrectChoice(dupQ, 1), dupQ.options);
    check("অপশন-তুলনায় ফাঁকা জায়গা ও যতিচিহ্ন গুরুত্বপূর্ণ", normalizeOption("some time") !== normalizeOption("sometime") && normalizeOption("sister's") !== normalizeOption("sisters") && normalizeOption("−৫") === normalizeOption("-৫"));

    const prog = await progressCsv(db);
    check("অগ্রগতি-CSV তৈরি হয়", prog.split("\n")[0].includes("level1_done_of_"));

    // ── নিষ্ক্রিয় ধাপ শিক্ষার্থীকে আটকায় না
    await ensureStarted(db, u.id);
    await db.learningTask.update({ where: { id: t10.id }, data: { active: false } });
    const moved = await reconcileDeactivated(db, t10.id);
    const s11 = await db.studentTaskProgress.findFirst({ where: { userId: u.id, task: { key: "L1:EXAM:11" } } });
    check("১০ম BCS নিষ্ক্রিয় করলে ঐ ধাপে থাকা শিক্ষার্থীর ১১তম খোলে", moved >= 1 && s11?.state === "AVAILABLE", { moved, s11: s11?.state });

    // ── Backup
    const b = JSON.parse(await fullBackup(db));
    const tables = Object.keys(b.tables);
    check("পূর্ণ Backup-এ ৩২টি টেবিল (Current Affairs-সহ), প্রশ্ন সব", tables.length === 32 && b.tables.questions.length === total, tables.length);
    check("Backup-এ সেশন বা রিসেট-টোকেন নেই", !("sessions" in b.tables) && !("resetTokens" in b.tables) && !JSON.stringify(b).includes('"expiresAt"'));
  } finally {
    await db.learningTask.update({ where: { id: t10.id }, data: { active: true } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\nব্যর্থ: ${fails}টি` : "\nব্যর্থ: কিছু নয়");
  if (fails) process.exitCode = 1;
}

main();
