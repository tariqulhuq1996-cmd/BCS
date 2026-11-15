/**
 * Pre BCS Writing Practice-এর কার্ড বসানো — content/written-cards/BCS_Written_Info_Cards.xlsx থেকে।
 *   npx tsx scripts/import-writing-cards.ts [--dry-run]
 * - প্রতিটি বিষয়ের শিট (নাম "BN …", "EN …" ইত্যাদি) পড়ে কার্ড আইডি ধরে নতুন বসায় বা হালনাগাদ করে।
 * - শিরোনাম, সিলেবাস-অংশ, তথ্য, উৎস ও নোট Excel-এর মতোই হয় — Excel-ই মূল উৎস। "অবস্থা" কলাম ব্যক্তিগত, পড়া হয় না।
 * - Excel থেকে মুছে ফেলা কার্ড সাইট থেকেও মোছে (সেই কার্ডের পড়ার হিসাবসহ)।
 * - content/written-cards/lessons/<কার্ড আইডি>.json থাকলে সেটি কার্ডের সাজানো পাঠ (lesson) হিসেবে বসে।
 * - বারবার চালানো নিরাপদ; deploy-setup প্রতি Deploy-এ এটি চালায়।
 */
import { Prisma, PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const FILE = path.resolve(__dirname, "..", "content", "written-cards", "BCS_Written_Info_Cards.xlsx");
const LESSONS = path.resolve(__dirname, "..", "content", "written-cards", "lessons");
const NAMES: Record<string, string> = {
  BN: "বাংলা", EN: "ইংরেজি", BD: "বাংলাদেশ বিষয়াবলি", IA: "আন্তর্জাতিক বিষয়াবলি",
  MM: "গাণিতিক যুক্তি ও মানসিক দক্ষতা", SC: "সাধারণ বিজ্ঞান ও প্রযুক্তি",
};

type Row = { lesson: Prisma.InputJsonValue | null; code: string; subject: string; subjectName: string; order: number; paper: string | null; section: string; marks: number | null; title: string; kind: string | null; info: string | null; ref: string | null; note: string | null };

const text = (c: ExcelJS.Cell): string => {
  const v = c.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  if (typeof v === "object" && "text" in v) return String(v.text).trim();
  return String(v).trim();
};
const opt = (s: string) => (s && s !== "—" ? s : null);

async function main() {
  if (!existsSync(FILE)) return console.log("[writing-cards] কার্ডের Excel ফাইল নেই — বাদ।");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const rows: Row[] = [];
  for (const ws of wb.worksheets) {
    const subject = ws.name.split(" ")[0];
    if (!NAMES[subject]) continue;
    let order = 0;
    ws.eachRow((r, i) => {
      if (i === 1) return;
      const code = text(r.getCell(1)), title = text(r.getCell(5));
      if (!code || !title) return;
      const marks = Number(text(r.getCell(4)));
      rows.push({
        lesson: null, code, subject, subjectName: NAMES[subject], order: ++order,
        paper: opt(text(r.getCell(2))), section: text(r.getCell(3)) || "—", marks: Number.isFinite(marks) && marks > 0 ? marks : null,
        title, kind: opt(text(r.getCell(6))), info: opt(text(r.getCell(7))), ref: opt(text(r.getCell(8))), note: opt(text(r.getCell(9))),
      });
    });
  }
  // সাজানো পাঠ
  const lessons = new Map<string, Prisma.InputJsonValue>();
  if (existsSync(LESSONS)) for (const f of readdirSync(LESSONS).filter((n) => /^[A-Z]{2}-\d{3}\.json$/.test(n))) {
    const j = JSON.parse(readFileSync(path.join(LESSONS, f), "utf8"));
    if (typeof j?.topic !== "string") throw new Error(`${f}: topic নেই`);
    lessons.set(f.slice(0, -5), j);
  }
  for (const r of rows) r.lesson = lessons.get(r.code) ?? null;
  const orphan = [...lessons.keys()].filter((k) => !rows.some((r) => r.code === k));
  if (orphan.length) console.warn(`[writing-cards] Excel-এ নেই এমন কার্ডের পাঠ: ${orphan.join(", ")}`);

  const dup = rows.map((r) => r.code).filter((c, i, a) => a.indexOf(c) !== i);
  if (dup.length) throw new Error(`একই কার্ড আইডি একাধিকবার: ${[...new Set(dup)].join(", ")}`);

  const existing = await db.writingCard.findMany({ select: { code: true, title: true, info: true, ref: true, note: true, section: true, order: true, subject: true, lesson: true } });
  const byCode = new Map(existing.map((c) => [c.code, c]));
  const keep = new Set(rows.map((r) => r.code));
  const added = rows.filter((r) => !byCode.has(r.code)).length;
  const changed = rows.filter((r) => { const e = byCode.get(r.code); return e && (e.title !== r.title || e.info !== r.info || e.ref !== r.ref || e.note !== r.note || e.section !== r.section || e.order !== r.order || e.subject !== r.subject || JSON.stringify(e.lesson ?? null) !== JSON.stringify(r.lesson)); }).length;
  const removed = existing.filter((e) => !keep.has(e.code)).map((e) => e.code);
  const withInfo = rows.filter((r) => r.info).length;
  console.log(`${dryRun ? "[পরীক্ষামূলক] " : ""}[writing-cards] Excel-এ ${rows.length}টি কার্ড (তথ্যসহ ${withInfo}টি, সাজানো পাঠ ${lessons.size}টি) · নতুন ${added} · বদলেছে ${changed} · মুছবে ${removed.length}`);
  if (dryRun || (!added && !changed && !removed.length)) return;

  await db.$transaction(async (tx) => {
    if (removed.length) await tx.writingCard.deleteMany({ where: { code: { in: removed } } });
    // ক্রম বদলালে (subject, order) অনন্যতায় সংঘাত এড়াতে আগে সবার ক্রম ঋণাত্মক করে রাখা
    await tx.$executeRaw`UPDATE WritingCard SET \`order\` = -id`;
    for (const r of rows) {
      const { code, lesson, ...data } = r;
      const l = lesson ?? Prisma.DbNull;
      await tx.writingCard.upsert({ where: { code }, create: { code, ...data, lesson: l }, update: { ...data, lesson: l } });
    }
  }, { timeout: 120_000 });
  const counts = await db.writingCard.groupBy({ by: ["subject"], _count: true });
  console.log("[writing-cards] বিষয়ভিত্তিক:", counts.map((c) => `${c.subject} ${c._count}`).join(", "));
}

main().catch((e) => { console.error("[writing-cards] ব্যর্থ:", e); process.exitCode = 1; }).finally(() => db.$disconnect());
