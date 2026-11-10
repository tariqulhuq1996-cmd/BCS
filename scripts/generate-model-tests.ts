/**
 * Model Test তৈরি (খসড়া) ও অনুমোদন।
 *   npx tsx scripts/generate-model-tests.ts --from 1 --to 50 [--seed 52]      খসড়া তৈরি/নতুন করে তৈরি
 *   npx tsx scripts/generate-model-tests.ts --approve --from 1 --to 50        অনুমোদন (প্রকাশ)
 * Level 2-এর প্রশ্নভান্ডার Import হওয়ার পরে চালানো উচিত — নইলে শুধু বিগত বিসিএসের প্রশ্ন থেকে তৈরি হবে।
 */
import { PrismaClient } from "@prisma/client";
import { approveModelTests, generateModelTests } from "../src/lib/exam/model-tests";

const db = new PrismaClient();
const a = process.argv.slice(2);
const num = (k: string, d: number) => (a.includes(k) ? Number(a[a.indexOf(k) + 1]) : d);

(async () => {
  const from = num("--from", 1), to = num("--to", 150);
  if (a.includes("--approve")) {
    console.log(`প্রকাশিত: ${await approveModelTests(db, from, to)}টি Model Test (${from}–${to})`);
  } else {
    const s = await generateModelTests(db, { from, to, seed: num("--seed", 52) });
    console.log(`প্রশ্নভান্ডার ${s.poolSize}টি; তৈরি ${s.generated.length}টি খসড়া; প্রকাশিত বলে অপরিবর্তিত ${s.skippedPublished.length}টি; সতর্কতা ${s.warnings.length}টি`);
    for (const w of s.warnings.slice(0, 20)) console.log(`  টেস্ট ${w.no}: ${w.message}`);
  }
  await db.$disconnect();
})();
