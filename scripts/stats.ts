/** ডেটাবেসের সংক্ষিপ্ত পরিসংখ্যান:  npx tsx scripts/stats.ts */
import { PrismaClient } from "@prisma/client";
import { numify } from "../src/lib/sql";
const p = new PrismaClient();
(async () => {
  const by = await p.question.groupBy({ by: ["status", "verifyClass"], _count: true, orderBy: [{ status: "asc" }, { verifyClass: "asc" }] });
  console.log(by.map((b) => `${b.status}/${b.verifyClass}: ${b._count}`).join("  "));
  const ex = await p.exam.findMany({ where: { NOT: { notesBn: null } }, select: { bcsNo: true, notesBn: true }, orderBy: { bcsNo: "asc" } });
  console.log(ex.map((e) => `${e.bcsNo}: ${e.notesBn}`).join("\n"));
  const dup = await p.$queryRaw<{ groups: number; questions: number }[]>`
    select count(*) as groups, coalesce(sum(n),0) as questions
    from (select textHash, count(*) n from Question group by 1 having count(*) > 1) t`.then((r) => numify(r));
  console.log("একই লেখার প্রশ্ন (হুবহু পুনরাবৃত্তি):", dup[0]);
  await p.$disconnect();
})();
