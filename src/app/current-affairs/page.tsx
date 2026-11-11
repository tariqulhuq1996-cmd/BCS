import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOverview, SET_SIZE, STALE_DAYS } from "@/lib/current-affairs/service";
import { bn } from "@/lib/bn";

export const metadata: Metadata = { title: "সাম্প্রতিক বিষয়াবলি (Current Affairs)" };

export default function CurrentAffairsPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <p className="text-sm font-semibold text-omr">Current Affairs</p>
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>সাম্প্রতিক বিষয়াবলি</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        বিগত পরীক্ষার বিশ্লেষণ থেকে বাছাই করা সাম্প্রতিক ঘটনার প্রশ্ন। স্মার্ট অনুশীলন প্রথমে ভুল আর সময় হয়ে যাওয়া প্রশ্ন, তারপর না-দেখা Priority A প্রশ্ন দেয়;
        ঠিক হওয়া প্রশ্ন কয়েক দিন পরে আবার আসে, যাতে মনে থাকে।
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

const btn = "rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper";
const chip = "rounded-full border border-line-strong px-3.5 py-1.5 text-[15px] hover:border-green";

async function Content() {
  const user = await requireUser("/current-affairs");
  const o = await getOverview(prisma, user.id);
  if (!o.total)
    return <p className="mt-8 text-lg text-ink-2">প্রশ্নব্যাংক এখনও যুক্ত হয়নি। শিগগিরই আসছে।</p>;

  const smartParts = [
    o.wrong && `${bn(o.wrong)}টি ভুল`,
    o.due && `${bn(o.due)}টি পুনরাবৃত্তি`,
    o.unseen && `${bn(o.unseen)}টি নতুন${o.unseenA ? ` (A ${bn(o.unseenA)}টি)` : ""}`,
  ].filter(Boolean);
  const pct = (n: number) => Math.round((n / Math.max(o.total, 1)) * 100);

  return (
    <>
      {o.bank && (
        <p className="mt-4 text-sm text-muted">
          সংস্করণ {o.bank.version ?? "—"} · তথ্য যাচাই: {o.bank.verifiedBn ?? "—"} · মোট {bn(o.total)}টি প্রশ্ন, {bn(o.chapters.length)}টি অধ্যায়
        </p>
      )}
      {o.stale && (
        <p role="note" className="mt-3 rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">
          প্রশ্নব্যাংকের তথ্য যাচাই করা হয়েছে {bn(STALE_DAYS)} দিনেরও আগে। সাম্প্রতিক তথ্য দ্রুত বদলায় — ⚠ চিহ্নিত প্রশ্নগুলো পত্রিকা/সরকারি উৎসে মিলিয়ে নাও।
        </p>
      )}

      <div className="mt-6 grid gap-5 rounded-2xl border-2 border-green bg-surface p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="text-xl font-bold">আজকের স্মার্ট সেট</h2>
          <p className="mt-1 text-ink-2">{bn(SET_SIZE)}টি প্রশ্ন — {smartParts.length ? smartParts.join(", ") + " থেকে অগ্রাধিকার অনুযায়ী" : "সব প্রশ্ন আয়ত্তে; সবচেয়ে আগে যেগুলোর পুনরাবৃত্তি আসবে"}।</p>
        </div>
        <Link href="/current-affairs/practice" className={btn}>শুরু করো</Link>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          ["দেখা হয়েছে", `${bn(o.seen)}/${bn(o.total)}`, `${bn(pct(o.seen))}%`],
          ["আয়ত্তে", bn(o.mastered), "পরপর অন্তত দুবার ঠিক"],
          ["ভুলের তালিকায়", bn(o.wrong), "শেষবার ভুল"],
          ["পরিবর্তনশীল তথ্য", bn(o.volatile), "পরীক্ষার আগে যাচাই"],
        ].map(([k, v, s]) => (
          <div key={k} className="bg-surface p-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-2xl font-bold tabular">{v}</dd>
            <dd className="text-xs text-muted">{s}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        {o.wrong > 0 && <Link href="/current-affairs/practice?mode=wrong" className={chip}>ভুলগুলো আবার ({bn(o.wrong)})</Link>}
        {o.unseen > 0 && <Link href="/current-affairs/practice?mode=new" className={chip}>শুধু নতুন ({bn(o.unseen)})</Link>}
        {(["A", "B", "C"] as const).map((g) => (
          <Link key={g} href={`/current-affairs/practice?priority=${g}`} className={chip}>Priority {g} ({bn(o.priority[g])})</Link>
        ))}
        <Link href="/current-affairs/revision" className={chip}>Quick Revision ও উৎস</Link>
      </div>

      <section aria-labelledby="ch" className="mt-10">
        <h2 id="ch" className="text-xl font-bold">অধ্যায়ভিত্তিক</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {o.chapters.map((c) => (
            <li key={c.no} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{bn(c.no)}. {c.name}</h3>
                <span className="shrink-0 text-sm text-muted tabular">{bn(c.total)}টি</span>
              </div>
              <p className="mt-1 text-xs text-muted">A {bn(c.a)} · B {bn(c.b)} · C {bn(c.c)}{c.wrong ? ` · ভুল ${bn(c.wrong)}` : ""}</p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`আয়ত্তে ${bn(c.mastered)}, দেখা ${bn(c.seen)}, মোট ${bn(c.total)}`}>
                <span className="bg-green" style={{ width: `${(c.mastered / c.total) * 100}%` }} />
                <span className="bg-omr/50" style={{ width: `${((c.seen - c.mastered) / c.total) * 100}%` }} />
              </div>
              <Link href={`/current-affairs/practice?chapter=${c.no}`} className="mt-3 inline-block text-[15px] font-semibold text-green underline underline-offset-4">
                {c.seen < c.total ? "অনুশীলন করো" : "আবার ঝালাই করো"}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">সবুজ: আয়ত্তে · হালকা: দেখা হয়েছে</p>
      </section>

      {(
        <section className="mt-10">
          <h2 className="text-xl font-bold">কীভাবে ব্যবহার করবে</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
            <li>প্রতিদিন একটি স্মার্ট সেট — ভুল আর পুরোনো প্রশ্ন নিজে থেকেই ফিরে আসবে।</li>
            <li>সময় কম থাকলে আগে Priority A, তারপর B ও C।</li>
            <li>পরীক্ষার আগের সপ্তাহে Quick Revision বারবার পড়ো; ⚠ চিহ্নিত তথ্য নতুন করে যাচাই করো।</li>
          </ul>
        </section>
      )}
    </>
  );
}
