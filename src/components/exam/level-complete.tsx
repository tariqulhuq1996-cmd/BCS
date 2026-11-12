import Link from "next/link";
import { prisma } from "@/lib/db";
import { numify } from "@/lib/sql";
import { bn, bnNum } from "@/lib/bn";

const LEVEL_HREF: Record<number, string> = { 1: "/level-1", 2: "/level-2", 3: "/level-3" };

/** একটি Level-এর Final পাস করলে: অভিনন্দন, এই Level-এর হিসাব, আর পরের Level-এর পরিচয়। */
export async function LevelComplete({ userId, levelId }: { userId: string; levelId: number }) {
  const level = await prisma.learningLevel.findUnique({ where: { id: levelId } });
  if (!level) return null;
  const [next, done, stats] = await Promise.all([
    prisma.learningLevel.findFirst({ where: { no: { gt: level.no }, active: true }, orderBy: { no: "asc" } }),
    prisma.studentTaskProgress.count({ where: { userId, state: "COMPLETED", task: { levelId } } }),
    prisma.$queryRaw<{ n: number; correct: number }[]>`
      select count(*) as n, sum(case when aa.isCorrect then 1 else 0 end) as correct
      from AttemptAnswer aa join TestAttempt ta on ta.id = aa.attemptId join LearningTask t on t.id = ta.taskId
      where ta.userId = ${userId} and ta.submittedAt is not null and t.levelId = ${levelId}`.then((r) => numify(r)[0]),
  ]);
  const n = stats?.n ?? 0;
  return (
    <section aria-labelledby="level-done" className="mt-6 overflow-hidden rounded-2xl border-2 border-green bg-green-wash">
      <div className="p-6 sm:p-8">
        <div aria-hidden="true" className="flex gap-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="size-4 rounded-full border-2 border-green bg-green" style={{ opacity: 0.35 + (i % 4) * 0.2 }} />
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-green">অভিনন্দন!</p>
        <h2 id="level-done" className="mt-1 text-[28px] font-extrabold leading-tight sm:text-[34px]" style={{ fontStretch: "110%" }}>
          Level {bn(level.no)} সম্পন্ন: {level.nameBn}
        </h2>
        <dl className="mt-5 grid max-w-xl grid-cols-3 gap-4">
          <div>
            <dt className="text-sm text-muted">সম্পন্ন ধাপ</dt>
            <dd className="font-display text-[28px] font-bold leading-none tabular">{bn(done)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">উত্তর দিয়েছেন</dt>
            <dd className="font-display text-[28px] font-bold leading-none tabular">{bnNum(n)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">সঠিকের হার</dt>
            <dd className="font-display text-[28px] font-bold leading-none tabular">{n ? `${bnNum(((stats?.correct ?? 0) / n) * 100, 0)}%` : "—"}</dd>
          </div>
        </dl>
      </div>
      {next && (
        <div className="border-t border-green/40 bg-surface p-6 sm:p-8">
          <p className="text-sm font-semibold text-green">এরপর: Level {bn(next.no)}</p>
          <h3 className="mt-1 text-xl font-bold">{next.nameBn}</h3>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-2">{next.descriptionBn}</p>
          <Link href={LEVEL_HREF[next.no] ?? "/dashboard"} className="mt-4 inline-block rounded-lg bg-green px-6 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper">
            Level {bn(next.no)} শুরু করুন
          </Link>
        </div>
      )}
    </section>
  );
}
