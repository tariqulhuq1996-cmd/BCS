import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadRules } from "@/lib/rules";
import { dhakaDayStart, revisionStatus } from "@/lib/exam/service";
import { startRevisionAction } from "@/lib/exam/actions";
import { bn } from "@/lib/bn";

export const metadata: Metadata = { title: "আজকের Revision" };

const ERR: Record<string, string> = { EMPTY: "এখন Revision-এর কোনো প্রশ্ন বাকি নেই, অথবা আজকের সীমা পূর্ণ।" };

export default function RevisionPage({ searchParams }: PageProps<"/revision">) {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>আজকের Revision</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        ভুল করা বা অনিশ্চিত প্রশ্ন নির্দিষ্ট দিন পরপর ফিরে আসে। ঠিক উত্তর দিলে পরের বার আসে আরও দেরিতে; ভুল হলে আবার পরদিন।
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/revision");
  const [st, rules, boxes, streakDays] = await Promise.all([
    revisionStatus(prisma, user.id),
    loadRules(prisma),
    prisma.questionStat.groupBy({ by: ["leitnerBox"], where: { userId: user.id, leitnerBox: { gt: 0 } }, _count: true }),
    prisma.revisionSession.findMany({ where: { userId: user.id, doneCount: { gt: 0 }, day: { gte: dhakaDayStart(new Date(), -6) } }, select: { day: true } }),
  ]);
  const intervals = rules.get<number[]>("srs.intervals_days");
  const maxCal = Math.max(1, ...st.calendar.map((c) => c.n));
  const err = typeof sp.e === "string" ? ERR[sp.e] : undefined;
  const open = await prisma.testAttempt.findFirst({ where: { userId: user.id, kind: "SRS_REVIEW", submittedAt: null } });

  return (
    <>
      <div className="mt-8 grid gap-6 rounded-2xl border-2 border-green bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          {err && <p role="alert" className="mb-3 rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">{err}</p>}
          {st.remaining > 0 ? (
            <p className="text-lg">
              আজ <span className="font-bold">{bn(st.remaining)}টি</span> প্রশ্ন Revision করতে হবে
              {st.dueNow > st.remaining && <> (মোট সময় হয়েছে {bn(st.dueNow)}টির; দিনে সর্বোচ্চ {bn(st.cap)}টি, বাকিগুলো পরের দিনগুলোতে)</>}।
              {st.blocked && " এগুলো শেষ না করে Level ২-এ নতুন উপবিষয় শুরু করা যাবে না।"}
            </p>
          ) : st.doneToday > 0 ? (
            <p className="text-lg">আজকের Revision শেষ: {bn(st.doneToday)}টি প্রশ্ন। আগামীকাল আবার দেখা হবে।</p>
          ) : (
            <p className="text-lg">আজ Revision-এর কোনো প্রশ্ন নেই। পরীক্ষায় ভুল করা প্রশ্নগুলো এখানে নিয়মিত ফিরে আসবে।</p>
          )}
          <p className="mt-2 text-sm text-muted">আজ শেষ করেছেন {bn(st.doneToday)}টি; প্রতিটি সেটে {bn(rules.get<number>("srs.session_size"))}টি প্রশ্ন।</p>
        </div>
        {(st.remaining > 0 || open) && (
          <form action={startRevisionAction}>
            <button className="rounded-lg bg-green px-7 py-3.5 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
              {open ? "Revision চালিয়ে যান" : "Revision শুরু করুন"}
            </button>
          </form>
        )}
      </div>

      <section aria-labelledby="cal" className="mt-12">
        <h2 id="cal" className="text-xl font-bold">Revision ক্যালেন্ডার: আগামী ১৪ দিন</h2>
        <ol className="mt-4 grid grid-cols-7 gap-2 sm:grid-cols-14">
          {st.calendar.map((c, i) => {
            const d = new Date(new Date(c.day).getTime() + 6 * 3600e3);
            return (
              <li key={c.day} className="flex flex-col items-center gap-1" title={`${bn(c.n)}টি প্রশ্ন`}>
                <span className="text-xs text-muted">{i === 0 ? "আজ" : d.toLocaleDateString("bn-BD", { weekday: "short", timeZone: "UTC" })}</span>
                <span className="flex h-20 w-full items-end overflow-hidden rounded-md bg-line/60">
                  <span className={`w-full rounded-t-[4px] ${i === 0 ? "bg-omr" : "bg-green"}`} style={{ height: `${(c.n / maxCal) * 100}%`, minHeight: c.n ? 4 : 0 }} />
                </span>
                <span className="text-xs tabular text-ink-2">{bn(c.n)}</span>
                <span className="text-[11px] text-muted">{bn(d.getUTCDate())}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-muted">প্রতিটি দিনে কতটি প্রশ্নের Revision-এর সময় হবে (আজকেরটি গোলাপি)।</p>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="boxes">
          <h2 id="boxes" className="text-xl font-bold">কোন প্রশ্ন কত দিন পরপর</h2>
          <ul className="mt-4 grid gap-2">
            {[1, 2, 3, 4, 5].map((b) => (
              <li key={b} className="flex items-baseline justify-between border-b border-line py-2 text-[15px]">
                <span>বাক্স {bn(b)}: {bn(intervals[b - 1])} দিন পরপর</span>
                <span className="font-semibold tabular">{bn(boxes.find((x) => x.leitnerBox === b)?._count ?? 0)}টি</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">ঠিক উত্তরে প্রশ্ন পরের বাক্সে যায়; ভুল হলে আবার বাক্স ১-এ।</p>
        </section>
        <section aria-labelledby="streak">
          <h2 id="streak" className="text-xl font-bold">ধারাবাহিকতা</h2>
          <p className="mt-4 text-[15px]">গত ৭ দিনের {bn(streakDays.length)} দিন Revision দিয়েছেন।{streakDays.length >= 7 && " টানা ৭ দিন: অর্জন পেয়েছেন!"}</p>
          <p className="mt-4 text-[15px]">
            ভুলের ভান্ডারে এখন {bn(st.wrongBank)}টি প্রশ্ন।{" "}
            <Link href="/mistakes" className="text-green underline underline-offset-4">ভুলগুলো অনুশীলন করুন</Link>
          </p>
        </section>
      </div>
    </>
  );
}
