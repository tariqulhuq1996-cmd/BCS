/**
 * Current Affairs প্রশ্নব্যাংক (.docx) ডেটাবেসে আনা।
 *   npx tsx scripts/import-current-affairs.ts <ফাইল.docx> [--bank <key>] [--dry-run]
 * key না দিলে ফাইলের নাম থেকে (BCS52_BNP_Govt_Political_Question_Bank.docx → bnp-govt-political)।
 * বারবার চালানো নিরাপদ (প্রশ্ন-নম্বর দিয়ে হালনাগাদ)। অ্যাডমিন প্যানেল → Current Affairs থেকেও একই কাজ করা যায়।
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { bankKeyFromFilename, parseCurrentAffairsDocx } from "../src/lib/current-affairs/parse";
import { importCurrentAffairs } from "../src/lib/current-affairs/import";

const [file, ...flags] = process.argv.slice(2);
const db = new PrismaClient();

async function main() {
  if (!file) throw new Error("ব্যবহার: npx tsx scripts/import-current-affairs.ts <ফাইল.docx> [--dry-run]");
  const p = await parseCurrentAffairsDocx(readFileSync(file));
  const by = (k: string) => p.questions.filter((q) => q.priority === k).length;
  const bi = flags.indexOf("--bank");
  const bankKey = bi >= 0 ? flags[bi + 1] : bankKeyFromFilename(path.basename(file));
  console.log(`প্রশ্নব্যাংক: ${bankKey}`);
  console.log(`শিরোনাম: ${p.title}\nসংস্করণ: ${p.version ?? "—"} · যাচাই: ${p.verifiedBn ?? "—"}`);
  console.log(`অধ্যায় ${p.chapters.length}, প্রশ্ন ${p.questions.length} (A ${by("A")}, B ${by("B")}, C ${by("C")}), পরিবর্তনশীল ${p.questions.filter((q) => q.volatile).length}, Quick Revision ${p.revision.length}, উৎস ${p.sources.length}`);
  for (const w of p.warnings) console.log("সতর্কতা:", w);
  for (const e of p.errors) console.log("ত্রুটি:", e);
  if (p.errors.length) process.exit(1);
  if (flags.includes("--dry-run")) return console.log("(--dry-run: কিছু লেখা হয়নি)");
  console.log(await importCurrentAffairs(db, p, bankKey, "script"));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
