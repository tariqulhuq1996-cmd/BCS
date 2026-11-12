/**
 * শিক্ষার্থীর নতুন সুবিধার পরীক্ষা: টানা পড়ার হিসাব, অন্যদের তুলনায় অবস্থান (নামহীন), আর
 * সংরক্ষণ/অভিযোগে "নিজে সমাধান করা প্রশ্নই" শর্ত।
 * অস্থায়ী ব্যবহারকারী দিয়ে; শেষে মুছে ফেলা হয়।   npm run test:features
 */
import { PrismaClient } from "@prisma/client";
import { computeStreak, dhakaDayKey, dhakaDayStart } from "../src/lib/progress/streak";
import { MIN_PEERS, topPercent } from "../src/lib/progress/peers";
import { answeredBy } from "../src/lib/student/access";

const db = new PrismaClient();
let fails = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + JSON.stringify(info)}`);
};

async function main() {
  // ── টানা পড়া (বিশুদ্ধ হিসাব)
  const today = "2026-11-13";
  check("আজসহ ৩ দিন টানা", computeStreak(["2026-11-11", "2026-11-12", "2026-11-13"], today).current === 3);
  const y = computeStreak(["2026-11-10", "2026-11-11", "2026-11-12"], today);
  check("আজ এখনো না পড়লেও গতকাল পর্যন্ত টানা থাকলে ধারা ভাঙে না", y.current === 3 && !y.studiedToday, y);
  check("মাঝে একদিন বাদ গেলে ধারা নতুন করে", computeStreak(["2026-11-09", "2026-11-11", "2026-11-13"], today).current === 1);
  check("দুই দিন না পড়লে ধারা শূন্য", computeStreak(["2026-11-10"], today).current === 0);
  check("সবচেয়ে দীর্ঘ ধারা আলাদা মনে থাকে", computeStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-13"], today).best === 4);
  check("মাস পেরোনো টানা দিন", computeStreak(["2026-10-31", "2026-11-01"], "2026-11-01").current === 2);
  // ঢাকার দিন: রাত ১১টা (UTC ১৭:০০) আর পরদিন রাত ১টা (UTC ১৯:০০) আলাদা দিন
  check("ঢাকার সময়ে দিন গোনা", dhakaDayKey(new Date("2026-11-12T17:30:00Z")) === "2026-11-12" && dhakaDayKey(new Date("2026-11-12T18:30:00Z")) === "2026-11-13");
  check("ঢাকার দিনের শুরু = আগের দিন UTC ১৮:০০", dhakaDayStart(new Date("2026-11-13T05:00:00Z")).toISOString() === "2026-11-12T18:00:00.000Z");

  // ── নামহীন অবস্থান
  check(`${MIN_PEERS} জনের কম হলে কিছুই দেখায় না`, topPercent(10, [1, 2, 3, 10]) === null);
  check("সবার চেয়ে ভালো হলে শীর্ষ ১০% (১০ জনে)", topPercent(100, [100, 1, 2, 3, 4, 5, 6, 7, 8, 9]) === 10);
  check("সবার চেয়ে খারাপ হলে শীর্ষ ১০০%", topPercent(0, [0, 1, 2, 3, 4]) === 100);
  check("সমান হলে সুবিধা নিজের", topPercent(5, [5, 5, 5, 5, 5]) === 20);

  const tag = `ft${Date.now()}`;
  try {
    // ── সংরক্ষণ/অভিযোগ: শুধু নিজে জমা দেওয়া পরীক্ষার প্রশ্ন
    const q = await db.question.findFirstOrThrow({ where: { status: "PUBLISHED" }, select: { id: true } });
    const stu = await db.user.create({ data: { email: `${tag}-s@features.test`, passwordHash: "x" } });
    check("না দেখা প্রশ্নে সংরক্ষণ/অভিযোগ চলে না", !(await answeredBy(db, stu.id, q.id)));
    const open = await db.testAttempt.create({ data: { userId: stu.id, kind: "PRACTICE", questionIds: [q.id], optionPerms: {}, answers: { create: { questionId: q.id, selected: 0 } } } });
    check("চলমান (জমা না দেওয়া) পরীক্ষার প্রশ্নেও নয়", !(await answeredBy(db, stu.id, q.id)));
    await db.testAttempt.update({ where: { id: open.id }, data: { submittedAt: new Date() } });
    check("জমা দেওয়ার পর সেই প্রশ্নে চলে", await answeredBy(db, stu.id, q.id));
    const other = await db.user.create({ data: { email: `${tag}-o@features.test`, passwordHash: "x" } });
    check("অন্যের জমা দেওয়া প্রশ্ন নিজের হিসেবে ধরা হয় না", !(await answeredBy(db, other.id, q.id)));
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.pendingSignup.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  }
  console.log(fails ? `\n${fails}টি পরীক্ষা ব্যর্থ` : "\nসব পরীক্ষা সফল");
  process.exit(fails ? 1 : 0);
}
main();
