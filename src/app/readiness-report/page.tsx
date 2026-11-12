import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getReadiness } from "@/lib/exam/analysis";
import { bn, bnNum } from "@/lib/bn";
import { ProgressBar } from "@/components/portal/progress-bar";

export const metadata: Metadata = { title: "প্রস্তুতির প্রতিবেদন" };

export default function ReadinessPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>প্রস্তুতির প্রতিবেদন</h1>
      <Suspense fallback={<p className="mt-6 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

/**
 * শুরু থেকে কতটা এগোলে: শুরুর মূল্যায়নের স্কোর বনাম এখনকার স্কোর — Model Test থাকলে শেষ ৫টির গড় সঠিকের হার,
 * নইলে শেষ ৫টি মূল্যায়ন-পরীক্ষার (Mastery, Cumulative, Checkpoint, Final, Repeat) গড়।
 */
async function Baseline({ userId }: { userId: string }) {
  const diag = await prisma.testAttempt.findFirst({ where: { userId, kind: "DIAGNOSTIC", submittedAt: { not: null } }, orderBy: { submittedAt: "asc" }, select: { scorePct: true, submittedAt: true } });
  if (!diag) return null;
  const mts = await prisma.testAttempt.findMany({ where: { userId, kind: "MODEL_TEST", submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 5, select: { scorePct: true } });
  const recent = mts.length
    ? mts
    : await prisma.testAttempt.findMany({ where: { userId, kind: { in: ["MASTERY", "CUMULATIVE", "CHECKPOINT", "LEVEL_FINAL", "REPEAT"] }, submittedAt: { gt: diag.submittedAt! } }, orderBy: { submittedAt: "desc" }, take: 5, select: { scorePct: true } });
  const start = diag.scorePct ?? 0;
  const now = recent.length ? recent.reduce((a, x) => a + (x.scorePct ?? 0), 0) / recent.length : null;
  return (
    <section aria-labelledby="baseline" className="mt-8 rounded-xl border-2 border-green bg-green-wash p-5 sm:p-6">
      <h2 id="baseline" className="text-xl font-bold">শুরু থেকে কতটা এগোলে</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted">শুরুর মূল্যায়নে</p>
          <p className="font-display text-[32px] font-bold leading-none tabular">{bnNum(start, 0)}%</p>
        </div>
        <div>
          <p className="text-sm text-muted">এখন ({mts.length ? `শেষ ${bn(mts.length)}টি Model Test` : `শেষ ${bn(recent.length)}টি মূল্যায়ন-পরীক্ষা`})</p>
          <p className="font-display text-[32px] font-bold leading-none tabular">{now == null ? "—" : `${bnNum(now, 0)}%`}</p>
        </div>
        <div>
          <p className="text-sm text-muted">পার্থক্য</p>
          <p className={`font-display text-[32px] font-bold leading-none tabular ${now != null && now < start ? "text-danger" : "text-green"}`}>
            {now == null ? "—" : `${now >= start ? "+" : "−"}${bnNum(Math.abs(now - start), 0)}`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-2">সঠিক উত্তরের হার (%)। {now == null ? "প্রথম Mastery Test দিলেই এখানে তুলনা দেখাবে।" : "মূল্যায়ন-পরীক্ষাগুলো তোমার দুর্বল প্রশ্ন বেশি দেয়, তাই এই হার আসল পরীক্ষার চেয়ে কিছুটা কম দেখাতে পারে।"}</p>
    </section>
  );
}

async function Content() {
  const user = await requireUser("/readiness-report");
  const r = await getReadiness(prisma, user.id);
  if (r.empty)
    return (
      <>
        <Baseline userId={user.id} />
        <p className="mt-6 text-lg text-ink-2">এখনও কোনো Model Test দাওনি। Level ৩-এ টেস্ট দিলে এখানে তোমার পূর্ণ প্রতিবেদন তৈরি হবে।</p>
      </>
    );
  const final = r.completedTests >= 150;
  const max = Math.max(200 * 0.1, ...r.series.map((s) => s.net));
  const trend = r.early != null && r.late != null ? r.late - r.early : null;

  return (
    <>
      <p className="mt-2 max-w-2xl text-ink-2">
        {final ? "১৫০টি Model Test সম্পন্ন — এটি তোমার চূড়ান্ত প্রতিবেদন।" : `এখন পর্যন্ত ${bn(r.completedTests)}টি টেস্ট সম্পন্ন (মোট চেষ্টা ${bn(r.count)}টি); ১৫০টি শেষে এটিই চূড়ান্ত প্রতিবেদন হবে।`}
      </p>

      <Baseline userId={user.id} />

      <section aria-label="সারাংশ" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          { k: "গড় নেট নম্বর", v: bnNum(r.avg, 1), s: `ওঠানামা ±${bnNum(r.sd, 1)}` },
          { k: "সর্বোচ্চ", v: bnNum(r.highest.net, 1), s: r.highest.title },
          { k: "সর্বনিম্ন", v: bnNum(r.lowest.net, 1), s: r.lowest.title },
          { k: "অগ্রগতি", v: trend == null ? "—" : `${trend >= 0 ? "+" : "−"}${bnNum(Math.abs(trend), 1)}`, s: r.k ? `প্রথম ${bn(r.k)}টি বনাম শেষ ${bn(r.k)}টির গড়` : "আরও টেস্ট লাগবে" },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-4">
            <p className="text-sm text-muted">{x.k}</p>
            <p className="mt-1 font-display text-[28px] font-bold leading-none tabular">{x.v}</p>
            <p className="mt-1.5 text-xs text-muted">{x.s}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="series" className="mt-10">
        <h2 id="series" className="text-xl font-bold">প্রতিটি টেস্টের নেট নম্বর</h2>
        <ol className="mt-4 flex h-40 items-end gap-[2px] overflow-x-auto rounded-lg border border-line bg-surface p-3" aria-label="টেস্টভিত্তিক নেট নম্বর">
          {r.series.map((s) => (
            <li key={s.i} title={`${s.title}: ${bnNum(s.net, 1)}`} className="flex h-full min-w-2 flex-1 items-end">
              <span className={`w-full rounded-t-[3px] ${s.tier === 1 ? "bg-green/60" : s.tier === 2 ? "bg-green/80" : "bg-green"}`} style={{ height: `${Math.max(2, (Math.max(0, s.net) / max) * 100)}%` }} />
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted">বাঁ থেকে ডানে সময়ের ক্রমে; গাঢ় রং = উচ্চতর স্তর। কলামের ওপর রাখলে নম্বর দেখাবে।</p>
      </section>

      <section aria-labelledby="subjects" className="mt-10">
        <h2 id="subjects" className="text-xl font-bold">বিষয়ভিত্তিক সঠিকের হার</h2>
        <ul className="mt-4 grid gap-3">
          {r.subjects.map((s) => (
            <li key={s.code}>
              <div className="flex justify-between gap-3 text-[15px]"><span>{s.name}</span><span className="tabular text-ink-2">{bnNum(s.accuracy, 0)}% সঠিক, {bnNum(s.wrongShare, 0)}% ভুল</span></div>
              <ProgressBar pct={s.accuracy} label={`${s.name}: সঠিকের হার`} />
            </li>
          ))}
        </ul>
      </section>

      {r.count < 3 ? (
        <p className="mt-10 text-[15px] text-ink-2">শক্তি ও দুর্বলতার নির্ভরযোগ্য হিসাব দিতে অন্তত ৩টি টেস্ট লাগবে। আরও টেস্ট দিলে এখানে দেখাবে।</p>
      ) : (
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="strong">
          <h2 id="strong" className="text-xl font-bold">শক্তির জায়গা</h2>
          <ul className="mt-3 list-disc pl-5 text-[15px]">{r.strong.map((s) => <li key={s.code}>{s.name} ({bnNum(s.accuracy, 0)}%)</li>)}</ul>
        </section>
        <section aria-labelledby="weak">
          <h2 id="weak" className="text-xl font-bold">যেখানে আরও Revision দরকার</h2>
          <ul className="mt-3 list-disc pl-5 text-[15px]">{r.weak.map((s) => <li key={s.code}>{s.name} ({bnNum(s.accuracy, 0)}%)</li>)}</ul>
          <p className="mt-3 text-[15px] text-ink-2">
            পরামর্শ: এই বিষয়গুলোর <Link href="/mistakes" className="text-green underline underline-offset-4">ভুলের ভান্ডার</Link> থেকে নিয়মিত অনুশীলন করো, প্রতিদিনের{" "}
            <Link href="/revision" className="text-green underline underline-offset-4">Revision</Link> বাদ দিয়ো না, এবং বেশি ভুল হচ্ছে এমন প্রশ্নে নিশ্চিত না হলে উত্তর না দেওয়ার কৌশল বিবেচনা করো (প্রতিটি ভুলে ০.৫ কাটা যায়)।
          </p>
        </section>
      </div>
      )}

      <p className="mt-12 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
        এই প্রতিবেদন শুধু তোমার নিজের Model Test-এর ফল থেকে তৈরি। কোনো নম্বরই BCS Preliminary-তে পাশের নিশ্চয়তা নয়; প্রকৃত পরীক্ষার কাট-মার্ক প্রতি বছর বদলায়।
      </p>
    </>
  );
}
