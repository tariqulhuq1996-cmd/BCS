/**
 * টপিকভিত্তিক প্রশ্নের Bulk Import (কমান্ড লাইন)।
 *   npx tsx scripts/import-questions.ts <ফাইল.csv|ফাইল.json> [--status DRAFT|VERIFIED|PUBLISHED] [--dry-run]
 * ফাইলের গঠন: docs/QUESTION_IMPORT.md
 */
import { PrismaClient, type QuestionStatus } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { importQuestions, parseCsv } from "../src/lib/questions/import";

const db = new PrismaClient();
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const status = (args[args.indexOf("--status") + 1] ?? "DRAFT") as QuestionStatus;
const dryRun = args.includes("--dry-run");

async function main() {
  if (!file) throw new Error("ব্যবহার: npx tsx scripts/import-questions.ts <ফাইল.csv|.json> [--status DRAFT|VERIFIED|PUBLISHED] [--dry-run]");
  if (!["DRAFT", "VERIFIED", "PUBLISHED"].includes(status)) throw new Error(`অবস্থা "${status}" গ্রহণযোগ্য নয়`);
  const raw = readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  const records = ext === ".json" ? (JSON.parse(raw) as Record<string, unknown>[]) : parseCsv(raw);
  const r = await importQuestions(db, records, { source: path.basename(file), format: ext.slice(1), status, dryRun });
  console.log(`${dryRun ? "[পরীক্ষামূলক, কিছু লেখা হয়নি] " : ""}সারি ${r.rows}: যোগ ${r.inserted}, হুবহু-পুনরাবৃত্তি বাদ ${r.duplicates.length}, প্রায়-একই (খসড়া) ${r.nearDuplicates.length}, ত্রুটি ${r.errors.length}`);
  for (const e of r.errors.slice(0, 30)) console.log(`  ত্রুটি, সারি ${e.row}: ${e.message}`);
  for (const d of r.duplicates.slice(0, 15)) console.log(`  বাদ, সারি ${d.row}: ${d.matches}-এর হুবহু পুনরাবৃত্তি`);
  for (const n of r.nearDuplicates.slice(0, 15)) console.log(`  খসড়া, সারি ${n.row} (${n.uid}): ${n.matches}-এর সঙ্গে ${n.similarity}% মিল`);
  if (r.errors.length) process.exitCode = 2;
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => db.$disconnect());
