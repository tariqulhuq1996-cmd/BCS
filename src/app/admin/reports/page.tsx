import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { daysAgo } from "@/lib/time";
import { requireAdmin } from "@/lib/auth/session";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Stat, StatGrid } from "@/components/admin/ui";

export const metadata: Metadata = { title: "রিপোর্ট — অ্যাডমিন", robots: { index: false } };

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAdmin("/admin/reports");
  const since = daysAgo(14);
  const [students, perDay, current, hardest, masteryAvg, mtAvg] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.$queryRaw<{ day: string; n: number }[]>`
      select to_char(("submittedAt" at time zone 'Asia/Dhaka')::date, 'YYYY-MM-DD') as day, count(*)::int as n
      from "TestAttempt" where "submittedAt" >= ${since} group by 1 order by 1`,
    // প্রত্যেক শিক্ষার্থীর বর্তমান (ক্রমের প্রথম খোলা) কাজ কোন Level-এ
    prisma.$queryRaw<{ level: number; n: number }[]>`
      select lvl as level, count(*)::int as n from (
        select distinct on (p."userId") p."userId", l.no as lvl
        from "StudentTaskProgress" p join "LearningTask" t on t.id = p."taskId" join "LearningLevel" l on l.id = t."levelId"
        where p.state in ('AVAILABLE','IN_PROGRESS') order by p."userId", l.no, t."order") x group by lvl order by lvl`,
    prisma.$queryRaw<{ id: string; uid: string; text: string; seen: number; wrong: number }[]>`
      select q.id, q.uid, q.text, sum(s.seen)::int as seen, sum(s.wrong)::int as wrong
      from "QuestionStat" s join "Question" q on q.id = s."questionId"
      group by q.id having sum(s.seen) >= 5 order by sum(s.wrong)::float / sum(s.seen) desc, sum(s.seen) desc limit 15`,
    prisma.masteryRecord.aggregate({ _avg: { scorePct: true }, _count: true }),
    prisma.testAttempt.aggregate({ where: { kind: "MODEL_TEST", submittedAt: { not: null } }, _avg: { netScore: true }, _count: true }),
  ]);
  const maxDay = Math.max(1, ...perDay.map((d) => d.n));

  return (
    <>
      <AdminTitle title="রিপোর্ট" lead="শিক্ষার্থীরা কোথায় আছে, কতটা অনুশীলন হচ্ছে, কোন প্রশ্ন সবচেয়ে কঠিন প্রমাণিত।" />
      <StatGrid>
        <Stat k="শিক্ষার্থী" v={bnNum(students)} />
        {[1, 2, 3].map((l) => <Stat key={l} k={`এখন Level ${bn(l)}-এ`} v={bnNum(current.find((c) => c.level === l)?.n ?? 0)} s="জন" />)}
      </StatGrid>
      <StatGrid>
        <Stat k="Mastery/Final গড়" v={masteryAvg._count ? `${bnNum(masteryAvg._avg.scorePct ?? 0, 0)}%` : "—"} s={`${bnNum(masteryAvg._count)}টি পরীক্ষা`} />
        <Stat k="Model Test গড় নেট" v={mtAvg._count ? bnNum(mtAvg._avg.netScore ?? 0, 1) : "—"} s={`${bnNum(mtAvg._count)}টি চেষ্টা`} />
        <Stat k="গত ১৪ দিনে পরীক্ষা" v={bnNum(perDay.reduce((a, d) => a + d.n, 0))} />
        <Stat k="দৈনিক গড়" v={bnNum(perDay.reduce((a, d) => a + d.n, 0) / 14, 1)} />
      </StatGrid>

      <section className="mt-10">
        <h2 className="text-xl font-bold">গত ১৪ দিনে জমা দেওয়া পরীক্ষা</h2>
        {perDay.length ? (
          <ol className="mt-3 flex h-36 items-end gap-1 rounded-lg border border-line bg-surface p-3">
            {perDay.map((d) => (
              <li key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.n}`}>
                <span className="w-full rounded-t-[3px] bg-green" style={{ height: `${(d.n / maxDay) * 100}%` }} />
                <span className="text-[10px] text-muted">{bn(d.day.slice(8))}</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-ink-2">এই সময়ে কোনো পরীক্ষা জমা হয়নি।</p>}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">সবচেয়ে বেশি ভুল হওয়া প্রশ্ন</h2>
        <p className="mt-1 text-sm text-muted">অন্তত ৫ বার উত্তর দেওয়া প্রশ্নের মধ্যে। খুব বেশি ভুল মানে প্রশ্ন বা উত্তর যাচাই করে দেখা দরকার হতে পারে।</p>
        {hardest.length ? (
          <ol className="mt-3 divide-y divide-line border-y border-line text-[15px]">
            {hardest.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-4 py-2">
                <Link href={`/admin/questions/${h.id}`} className="line-clamp-1 hover:text-green">{h.text}</Link>
                <span className="whitespace-nowrap text-sm tabular text-danger">{bnNum((h.wrong / h.seen) * 100, 0)}% ভুল ({bn(h.seen)} বার)</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-ink-2">এখনও যথেষ্ট তথ্য নেই।</p>}
      </section>
    </>
  );
}
