/**
 * Level 2-এর তৈরি প্রশ্নব্যাংক বসানো — data/source/level2/<বিষয়>.json (যেমন bangla.json: ৫২তম BCS-এর জন্য নতুন ১৫০০ বাংলা MCQ)।
 *   npx tsx scripts/import-level2-bank.ts [--dry-run]
 * - যে uid ডেটাবেসে আগে থেকেই আছে সেটি বাদ (বারবার চালানো নিরাপদ; deploy-setup প্রতি Deploy-এ এটি চালায়)।
 * - নতুনগুলো PUBLISHED অবস্থায় বসে (যাচাই শেষ করেই ফাইলে রাখা হয়েছে), ব্যাখ্যা VERIFIED।
 *   বিগত প্রশ্নের সঙ্গে ≥৮০% মিল পেলে importQuestions নিজেই সেটিকে DRAFT রাখে — অ্যাডমিন দেখে প্রকাশ করবেন।
 * - ফাইলের উপবিষয়গুলোর targetQuestions = সেই উপবিষয়ে ফাইলের প্রশ্নসংখ্যা (অগ্রগতির "x/y প্রকাশিত" হিসাব মেলাতে)।
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { importQuestions } from "../src/lib/questions/import";

const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const dir = path.resolve(__dirname, "..", "data", "source", "level2");

const REVIEWED = ["T-BN.BH.SMS-0045"];
type Rec ={ uid: string; subtopic_code: string } & Record<string, unknown>;

async function main() {
  if (!existsSync(dir)) return console.log("[level2-bank] data/source/level2 নেই — বাদ।");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const all = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Rec[];
    const have = new Set((await db.question.findMany({ where: { uid: { in: all.map((r) => r.uid) } }, select: { uid: true } })).map((q) => q.uid));
    const todo = all.filter((r) => !have.has(r.uid));
    if (!todo.length) {
      console.log(`[level2-bank] ${file}: ${all.length}টি প্রশ্নই আগে থেকে আছে — কিছু বদলায়নি।`);
      continue;
    }
    const r = await importQuestions(db, todo, { source: `level2/${file}`, format: "json", status: "PUBLISHED", dryRun, createdBy: "level2-bank" });
    console.log(`${dryRun ? "[পরীক্ষামূলক] " : ""}[level2-bank] ${file}: নতুন ${todo.length} → যোগ ${r.inserted}, হুবহু-পুনরাবৃত্তি বাদ ${r.duplicates.length}, প্রায়-একই (খসড়া) ${r.nearDuplicates.length}, ত্রুটি ${r.errors.length}`);
    for (const e of r.errors.slice(0, 20)) console.log(`  ত্রুটি, সারি ${e.row}: ${e.message}`);
    for (const d of r.duplicates.slice(0, 20)) console.log(`  বাদ, সারি ${d.row}: ${d.matches}-এর হুবহু পুনরাবৃত্তি`);
    for (const n of r.nearDuplicates.slice(0, 20)) console.log(`  খসড়া, ${n.uid}: ${n.matches}-এর সঙ্গে ${n.similarity}% মিল`);
    if (dryRun || !r.batchId) continue;
    await db.question.updateMany({ where: { importBatchId: r.batchId }, data: { explanationStatus: "VERIFIED" } });
    // হাতে দেখা: অপশন-সেট এক হওয়ায় মিল বেশি দেখায়, প্রশ্ন ভিন্ন (শতাব্দী বনাম দম্পতি) — প্রকাশযোগ্য
    await db.question.updateMany({ where: { importBatchId: r.batchId, uid: { in: REVIEWED } }, data: { status: "PUBLISHED", verifyNote: null } });
    const per = new Map<string, number>();
    for (const q of all) per.set(q.subtopic_code, (per.get(q.subtopic_code) ?? 0) + 1);
    for (const [code, n] of per) await db.subtopic.update({ where: { code }, data: { targetQuestions: n } });
    console.log(`[level2-bank] ${per.size}টি উপবিষয়ের লক্ষ্য হালনাগাদ।`);
  }
}

main().catch((e) => { console.error("[level2-bank] ব্যর্থ:", e); process.exitCode = 1; }).finally(() => db.$disconnect());
