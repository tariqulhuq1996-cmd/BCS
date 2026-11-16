import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { bn } from "@/lib/bn";
import { getOverview, getSubjectCards, LESSON_SUBJECTS, subjectOf } from "@/lib/writing/service";
import { CardTile } from "@/components/writing/card-tile";
import { ProgressBar } from "@/components/portal/progress-bar";

export const metadata: Metadata = { title: "Pre BCS Writing Practice" };

type Props = { searchParams: Promise<{ s?: string; done?: string }> };

export default function WritingPage({ searchParams }: Props) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
      <p className="text-sm font-semibold text-omr">Pre BCS Writing Practice</p>
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>লিখিত পরীক্ষার তথ্য-কার্ড</h1>
      <p className="mt-2 max-w-3xl text-ink-2">
        বিসিএস লিখিত (সাধারণ ক্যাডার, ৯০০ নম্বর) সিলেবাস মাথায় রেখে সাজানো কার্ড। প্রতিটি বিষয়ে কার্ডগুলো ক্রমানুসারে খোলে — একটি পড়া শেষ করলে পরেরটি খুলবে।
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Content({ searchParams }: Props) {
  const { s, done } = await searchParams;
  const user = await requireUser("/writing");
  const overview = await getOverview(prisma, user.id);
  if (!overview.some((o) => o.total)) return <p className="mt-8 text-lg text-ink-2">কার্ড এখনও যুক্ত হয়নি। শিগগিরই আসছে।</p>;
  // বেছে নেওয়া বিষয়; না থাকলে প্রথম অসম্পূর্ণ বিষয়
  const current = subjectOf(s ?? "") ?? subjectOf(overview.find((o) => o.total && o.read < o.total)?.code ?? "BN")!;
  const cur = overview.find((o) => o.code === current.code)!;
  const cards = await getSubjectCards(prisma, user.id, current.code, user.role === "ADMIN");
  const nextOpen = cards.find((c) => c.state === "open");

  return (
    <>
      <nav aria-label="বিষয়" className="mt-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {overview.map((o) => {
          const active = o.code === current.code;
          return (
            <Link
              key={o.code}
              href={`/writing?s=${o.code}`}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-[15px] ${active ? "border-green bg-green text-white dark:text-paper" : "border-line-strong hover:border-green"}`}
            >
              {o.name} <span className={`tabular ${active ? "text-white/85 dark:text-paper/80" : "text-muted"}`}>{bn(o.read)}/{bn(o.total)}</span>
            </Link>
          );
        })}
      </nav>

      {done && cur.read >= cur.total && cur.total > 0 && (
        <p role="status" className="mt-5 rounded-lg border border-green bg-green-wash px-4 py-3 font-semibold">
          অভিনন্দন! {current.name}-এর সব কার্ড পড়া শেষ। অন্য বিষয় বেছে নিন বা যেকোনো কার্ড আবার পড়ুন।
        </p>
      )}

      <div className="mt-6 grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="text-xl font-bold">{current.name} <span className="text-base font-normal text-muted">· লিখিত {bn(current.marks)} নম্বর</span></h2>
          <p className="mt-1 text-ink-2">পড়া হয়েছে {bn(cur.read)}টি, মোট {bn(cur.total)}টি কার্ড</p>
          <div className="mt-2 max-w-md">
            <ProgressBar pct={cur.total ? Math.round((cur.read / cur.total) * 100) : 0} label={`${current.name}-এর অগ্রগতি`} />
          </div>
        </div>
        {nextOpen && (
          <Link href={`/writing/${nextOpen.code}`} className="rounded-lg bg-green px-6 py-3 text-center text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
            {cur.read ? "পরের কার্ড" : "শুরু করুন"}: {LESSON_SUBJECTS.has(current.code) || nextOpen.lessonTheme ? `Day ${String(nextOpen.order).padStart(2, "0")}` : `কার্ড ${bn(nextOpen.order)}`}
          </Link>
        )}
      </div>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <CardTile key={c.code} card={c} band={current.band} short={current.short} lessonMode={LESSON_SUBJECTS.has(current.code) || !!c.lessonTheme} lessonLabel={current.code === "EN" ? "Daily English Writing" : current.code === "BN" ? "Daily Bangla Written" : current.short} />
        ))}
      </ul>
    </>
  );
}

