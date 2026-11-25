import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getPerformanceDashboard } from "@/lib/exam/performance";
import { bn, bnNum } from "@/lib/bn";
import { BackLink } from "@/components/site/back-link";
import { Card, Kpi, LineChart, Meter, StatusChip, Unavailable, avgNote, bnDate, fmt, signed } from "@/components/performance/ui";

export const metadata: Metadata = { title: "Performance Dashboard", robots: { index: false } };

export default function PerformancePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="text-[28px] font-extrabold sm:text-[36px]" style={{ fontStretch: "110%" }}>Performance Dashboard</h1>
      <p className="mt-1 text-ink-2">সব সম্পন্ন Model Test-এর সামগ্রিক ফল ও অগ্রগতি</p>
      <Suspense fallback={<p className="mt-6 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

const CONS = { stable: { label: "স্থিতিশীল", icon: "✓" }, moderate: { label: "মাঝারি ওঠানামা", icon: "≈" }, unstable: { label: "অস্থির", icon: "!" } } as const;

async function Content() {
  const user = await requireUser("/performance");
  const d = await getPerformanceDashboard(prisma, user.id);
  const { kpi, cfg } = d;
  if (!kpi.total)
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface p-6">
        <p className="text-lg">এখনও কোনো Model Test সম্পন্ন হয়নি।</p>
        <p className="mt-1 text-ink-2">Level ৩-এ পূর্ণ ২০০ নম্বরের টেস্ট জমা দিলে এখানে আপনার নম্বর, Accuracy, সময় ও বিষয়ভিত্তিক অগ্রগতি দেখাবে। অসম্পূর্ণ পরীক্ষা গোনা হয় না।</p>
        <Link href="/level-3" className="mt-4 inline-block rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">Level ৩-এ যান</Link>
      </div>
    );
  const latest = kpi.latest!;
  const trendWord = (delta: number) => (delta > 0.5 ? "উন্নতি" : delta < -0.5 ? "অবনতি" : "প্রায় অপরিবর্তিত");

  return (
    <>
      <p className="mt-3 text-sm text-muted">
        শুধু জমা দেওয়া {bn(kpi.total)}টি Model Test ধরা হয়েছে; চলমান বা অসম্পূর্ণ পরীক্ষা বাদ। নম্বর = সঠিক − {bn(String(cfg.negativeMark))} × ভুল, ২০০-এর মধ্যে।
      </p>

      {/* ── KPI */}
      <section aria-label="মূল সংখ্যা" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="মোট পরীক্ষা" value={bn(kpi.total)} sub="সম্পন্ন" />
        <Kpi label="গড় নেট নম্বর" value={fmt(kpi.avgNet.value)} sub={`২০০-এর মধ্যে · ${avgNote(kpi.avgNet)}`} />
        <Kpi label="গড় নম্বর (কাটার আগে)" value={fmt(kpi.avgGross.value)} sub={`সঠিক উত্তর · ${avgNote(kpi.avgGross)}`} />
        <Kpi label="গড় Accuracy" value={fmt(kpi.avgAccuracy.value, 1, "%")} sub={avgNote(kpi.avgAccuracy)} />
        <Kpi label="গড় Attempt" value={fmt(kpi.avgAttemptRate.value, 1, "%")} sub={avgNote(kpi.avgAttemptRate)} />
        <Kpi label="সর্বশেষ নম্বর" value={<>{bnNum(latest.net, 1)}<span className="text-base font-semibold text-muted">/২০০</span></>} sub={bnDate(latest.date)} tone="green" />
      </section>

      {/* ── লক্ষ্যের দিকে অগ্রগতি */}
      <section aria-labelledby="progress-h" className="mt-5 rounded-xl border-2 border-green bg-surface p-4 sm:p-5">
        {d.progress ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="progress-h" className="text-lg font-bold">লক্ষ্যের দিকে অগ্রগতি <span className="text-[15px] font-normal text-ink-2">(লক্ষ্য: {bn(d.progress.target)} নেট নম্বর)</span></h2>
              <p className="font-display text-2xl font-bold tabular">{bnNum(d.progress.rawPct, 1)}%</p>
            </div>
            <div className="mt-3">
              <Meter thick pct={d.progress.pct} label="লক্ষ্যের তুলনায় গড় নেট নম্বর" valueText={`গড় ${bnNum(kpi.avgNet.value!, 1)}, লক্ষ্য ${bn(d.progress.target)}; ${bnNum(d.progress.rawPct, 1)}%`} />
            </div>
            <p className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-ink-2">
              <span>বর্তমান গড়: <b className="text-ink tabular">{bnNum(kpi.avgNet.value!, 1)}</b> ({avgNote(kpi.avgNet)})</span>
              <span>{d.progress.gap > 0 ? <>লক্ষ্যে পৌঁছাতে বাকি: <b className="text-ink tabular">{bnNum(d.progress.gap, 1)}</b></> : <b className="text-green">✓ গড় লক্ষ্য ছুঁয়েছে</b>}</span>
              {d.netTrend
                ? <span>প্রবণতা: শেষ {bn(d.netTrend.k)}টির গড় {bnNum(d.netTrend.recent, 1)}, তার আগের {bn(d.netTrend.k)}টির {bnNum(d.netTrend.before, 1)} → <b className={d.netTrend.delta >= 0 ? "text-green" : "text-danger"}>{d.netTrend.delta >= 0 ? "▲" : "▼"} {signed(d.netTrend.delta)} ({trendWord(d.netTrend.delta)})</b></span>
                : <span>প্রবণতা বলতে অন্তত {bn(cfg.minTrend)}টি পরীক্ষা লাগবে।</span>}
            </p>
          </>
        ) : (
          <>
            <h2 id="progress-h" className="text-lg font-bold">প্রবণতা</h2>
            <p className="mt-1 text-[15px] text-ink-2">কোনো লক্ষ্য নম্বর ঠিক করা নেই, তাই প্রবণতা দেখানো হচ্ছে।</p>
            <p className="mt-2 text-[15px]">
              {d.netTrend ? <>শেষ {bn(d.netTrend.k)}টির গড় {bnNum(d.netTrend.recent, 1)} বনাম আগের {bn(d.netTrend.k)}টির {bnNum(d.netTrend.before, 1)}: <b>{signed(d.netTrend.delta)} ({trendWord(d.netTrend.delta)})</b></> : `প্রবণতা বলতে অন্তত ${bn(cfg.minTrend)}টি পরীক্ষা লাগবে।`}
            </p>
          </>
        )}
      </section>

      {/* ── প্রবণতা চার্ট + সর্বশেষ পরীক্ষা */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card id="trend-h" title="পরীক্ষাভিত্তিক ফলাফল" className="lg:col-span-2" aside={<span className="text-sm text-muted">শেষ {bn(Math.min(10, d.exams.length))}টি পরীক্ষা</span>}>
          {(() => {
            const pts = d.exams.slice(-10);
            const nets = pts.map((e) => e.net);
            const lo = Math.max(-100, Math.floor((Math.min(...nets, d.progress?.target ?? Infinity) - 10) / 20) * 20);
            const hi = Math.min(200, Math.ceil((Math.max(...nets, d.progress?.target ?? -Infinity) + 10) / 20) * 20);
            return (
              <>
                <h3 className="text-sm font-semibold text-ink-2">নেট নম্বর <span className="font-normal">(— রেখা ও বৃত্ত; বড় বৃত্ত = সর্বশেষ)</span></h3>
                <LineChart
                  points={pts.map((e) => ({ i: e.i, label: `প${bn(e.i)}`, y: e.net }))}
                  min={lo} max={hi}
                  target={d.progress?.target} targetLabel={`লক্ষ্য ${bn(d.progress?.target ?? 0)}`}
                  ariaLabel={`শেষ ${bn(pts.length)}টি পরীক্ষার নেট নম্বর: ${pts.map((e) => `পরীক্ষা ${bn(e.i)}: ${bnNum(e.net, 1)}`).join(", ")}। সর্বশেষ ${bnNum(pts.at(-1)!.net, 1)}।`}
                />
                <h3 className="mt-3 text-sm font-semibold text-ink-2">Accuracy % <span className="font-normal">(- - ভাঙা রেখা ও বর্গ)</span></h3>
                <LineChart
                  dashed unit="%"
                  points={pts.map((e) => ({ i: e.i, label: `প${bn(e.i)}`, y: e.accuracy }))}
                  min={Math.max(0, Math.floor((Math.min(...pts.map((e) => e.accuracy ?? 100)) - 5) / 10) * 10)} max={100}
                  ariaLabel={`শেষ ${bn(pts.length)}টি পরীক্ষার Accuracy: ${pts.map((e) => `পরীক্ষা ${bn(e.i)}: ${fmt(e.accuracy, 1, "%")}`).join(", ")}।`}
                />
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold text-green">চার্টের সংখ্যাগুলো টেবিলে দেখুন</summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left tabular">
                      <thead className="border-b border-line text-muted"><tr><th className="py-1.5 pr-3 font-medium">পরীক্ষা</th><th className="py-1.5 pr-3 font-medium">তারিখ</th><th className="py-1.5 pr-3 text-right font-medium">নেট</th><th className="py-1.5 pr-3 text-right font-medium">Accuracy</th><th className="py-1.5 text-right font-medium">Attempt</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {d.exams.map((e) => (
                          <tr key={e.id}><td className="py-1.5 pr-3"><Link href={`/performance/${e.id}`} className="text-green underline-offset-4 hover:underline">{bn(e.i)}. {e.title}</Link></td><td className="py-1.5 pr-3">{bnDate(e.date)}</td><td className="py-1.5 pr-3 text-right">{bnNum(e.net, 1)}</td><td className="py-1.5 pr-3 text-right">{fmt(e.accuracy, 1, "%")}</td><td className="py-1.5 text-right">{bnNum(e.attemptRate, 1)}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            );
          })()}
        </Card>

        <Card id="latest-h" title="সর্বশেষ পরীক্ষা">
          <p className="text-sm text-muted">{latest.title} · {bnDate(latest.date)}</p>
          <p className="mt-2 font-display text-[40px] font-extrabold leading-none tabular">{bnNum(latest.net, 1)}<span className="text-lg font-semibold text-muted">/২০০</span></p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-green-wash py-2"><dt className="text-green">✓ সঠিক</dt><dd className="text-lg font-bold tabular">{bn(latest.correct)}</dd></div>
            <div className="rounded-lg bg-danger-wash py-2"><dt className="text-danger">✗ ভুল</dt><dd className="text-lg font-bold tabular">{bn(latest.wrong)}</dd></div>
            <div className="rounded-lg bg-paper py-2"><dt className="text-ink-2">– উত্তর নয়</dt><dd className="text-lg font-bold tabular">{bn(latest.unanswered)}</dd></div>
          </dl>
          <p className="mt-3 text-[15px] text-ink-2">Accuracy {fmt(latest.accuracy, 1, "%")} · Attempt {bnNum(latest.attemptRate, 1)}%</p>
          <Link href={`/performance/${latest.id}`} className="mt-4 inline-block rounded-lg bg-green px-4 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">বিস্তারিত বিশ্লেষণ দেখুন</Link>
        </Card>
      </div>

      {/* ── বিষয়ভিত্তিক */}
      <Card id="subj-h" title="বিষয়ভিত্তিক গড় ফলাফল" className="mt-5" aside={<span className="text-sm text-muted">নেট: প্রতি পরীক্ষার গড় · Accuracy ও Attempt: সব প্রশ্ন মিলিয়ে</span>}>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-lg border border-line bg-green-wash/60 px-3 py-2.5">
            <p className="text-sm text-ink-2">▲ সবচেয়ে শক্তিশালী</p>
            <p className="font-bold">{d.highlights.strongest ? `${d.highlights.strongest.name} (নেট ${fmt(d.highlights.strongest.netPct, 0, "%")}, Accuracy ${fmt(d.highlights.strongest.accuracy.value, 0, "%")})` : "—"}</p>
          </li>
          <li className="rounded-lg border border-line bg-danger-wash/60 px-3 py-2.5">
            <p className="text-sm text-ink-2">! উন্নতি সবচেয়ে বেশি দরকার</p>
            <p className="font-bold">{d.highlights.weakest ? `${d.highlights.weakest.name} (নেট ${fmt(d.highlights.weakest.netPct, 0, "%")}, Accuracy ${fmt(d.highlights.weakest.accuracy.value, 0, "%")})` : "—"}</p>
          </li>
          <li className="rounded-lg border border-line bg-paper px-3 py-2.5">
            <p className="text-sm text-ink-2">↗ সবচেয়ে বেশি উন্নতি</p>
            <p className="font-bold">
              {!d.highlights.trendReady ? <span className="font-normal text-ink-2">অন্তত {bn(cfg.minTrend)}টি পরীক্ষা লাগবে</span>
                : d.highlights.mostImproved ? `${d.highlights.mostImproved.name} (${signed(d.highlights.mostImproved.trend!.delta)} নেট %)` : <span className="font-normal text-ink-2">কোনো বিষয়ে উন্নতি দেখা যায়নি</span>}
            </p>
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted">শক্তিশালী/দুর্বল: বিষয়ের মোট নম্বরের তুলনায় নেট নম্বরের হার অনুযায়ী। উন্নতি: শেষ কয়েকটি বনাম তার আগের সমসংখ্যক পরীক্ষা।</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[15px] tabular">
            <caption className="sr-only">বিষয়ভিত্তিক গড় নেট নম্বর, Accuracy, Attempt ও অবস্থা</caption>
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">বিষয়</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">গড় নেট (প্রতি পরীক্ষা)</th>
                <th scope="col" className="w-[28%] py-2 pr-3 font-medium">Accuracy</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Attempt</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">পরীক্ষা</th>
                <th scope="col" className="py-2 font-medium">অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.subjects.map((s) => (
                <tr key={s.code}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">{s.name}</th>
                  <td className="py-2 pr-3 text-right">{fmt(s.avgNet.value)} <span className="text-muted">/ {bnNum(s.marksPerExam, 0)}</span></td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><Meter pct={s.accuracy.value} label={`${s.name}: Accuracy`} valueText={fmt(s.accuracy.value, 1, "%")} tone={s.status === "weak" ? "danger" : s.status === "ok" ? "omr" : "green"} /></div>
                      <span className="w-14 text-right">{fmt(s.accuracy.value, 0, "%")}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">{fmt(s.attemptRate.value, 0, "%")}</td>
                  <td className="py-2 pr-3 text-right text-muted">{bn(s.examsCount)}</td>
                  <td className="py-2"><StatusChip s={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">অবস্থা: Accuracy {bn(cfg.bench.accHigh)}%+ ও Attempt {bn(cfg.bench.attemptLow)}%+ হলে শক্তিশালী; Accuracy {bn(cfg.bench.accLow)}%-এর কম হলে দুর্বল।</p>
      </Card>

      {/* ── সময় ও স্থিতিশীলতা */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card id="time-h" title="সময় ব্যবস্থাপনা (গড়)">
          {d.time.n ? (
            <>
              <table className="w-full text-[15px] tabular">
                <tbody className="divide-y divide-line">
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">গড় সমাধান-সময় <span className="text-xs text-muted">({avgNote(d.time.solveMin)})</span></th><td className="py-2 text-right font-semibold">{fmt(d.time.solveMin.value)} / {bn(cfg.solveMin)} মিনিট</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">উত্তর দেওয়া প্রতি প্রশ্নে গড়</th><td className="py-2 text-right font-semibold">{fmt(d.time.avgSec.value)} সেকেন্ড <span className="font-normal text-muted">(বরাদ্দ {bnNum(d.time.budgetSecPerQ, 1)})</span></td></tr>
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">সময়ের ব্যবহার</th><td className="py-2 text-right font-semibold">{fmt(d.time.utilization.value, 0, "%")}</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">বরাদ্দ সময় পেরিয়েছে</th><td className={`py-2 text-right font-semibold ${d.time.overBudget ? "text-danger" : ""}`}>{d.time.overBudget ? "! " : ""}{bn(d.time.overBudget)}/{bn(d.time.n)}টি পরীক্ষায়</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">OMR পূরণ</th><td className="py-2 text-right font-semibold">{bn(cfg.omrMin)} মিনিট <span className="font-normal text-muted">(আলাদা বরাদ্দ, সমাধান-সময়ে যোগ হয়নি)</span></td></tr>
                </tbody>
              </table>
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-ink-2">প্রশ্নপ্রতি গড় সময় (সেকেন্ড), পরীক্ষাভিত্তিক</h3>
                <LineChart
                  decimals={1}
                  width={420}
                  points={d.exams.slice(-10).map((e) => ({ i: e.i, label: `প${bn(e.i)}`, y: e.avgSecPerAttempted }))}
                  min={0} max={Math.max(60, Math.ceil(Math.max(...d.exams.map((e) => e.avgSecPerAttempted ?? 0)) / 10) * 10)}
                  target={d.time.budgetSecPerQ} targetLabel={`বরাদ্দ ${bnNum(d.time.budgetSecPerQ, 1)}`}
                  ariaLabel={`প্রশ্নপ্রতি গড় সময়: ${d.exams.slice(-10).map((e) => `পরীক্ষা ${bn(e.i)}: ${fmt(e.avgSecPerAttempted, 1)} সেকেন্ড`).join(", ")}। বরাদ্দ ${bnNum(d.time.budgetSecPerQ, 1)} সেকেন্ড।`}
                />
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {d.time.trend ? <>শেষ {bn(d.time.trend.k)}টিতে প্রশ্নপ্রতি {bnNum(d.time.trend.recent, 1)} সে., আগের {bn(d.time.trend.k)}টিতে {bnNum(d.time.trend.before, 1)} সে. ({d.time.trend.delta < 0 ? "▼ দ্রুততর" : d.time.trend.delta > 0 ? "▲ ধীরতর" : "অপরিবর্তিত"})।</> : `সময়ের প্রবণতা বলতে অন্তত ${bn(cfg.minTrend)}টি পরীক্ষা লাগবে।`}
                {d.time.n < kpi.total && ` ${bn(kpi.total - d.time.n)}টি পরীক্ষায় প্রশ্নভিত্তিক সময় রেকর্ড নেই — সেগুলো সময়ের হিসাবে ধরা হয়নি।`}
              </p>
            </>
          ) : <Unavailable>কোনো পরীক্ষায় প্রশ্নভিত্তিক সময় রেকর্ড হয়নি।</Unavailable>}
        </Card>

        <Card id="cons-h" title="স্থিতিশীলতা (Consistency)">
          {d.consistency ? (
            <>
              <p className="flex items-center gap-2 text-xl font-bold">
                <span aria-hidden="true" className={d.consistency.level === "stable" ? "text-green" : d.consistency.level === "unstable" ? "text-danger" : "text-omr"}>{CONS[d.consistency.level].icon}</span>
                {CONS[d.consistency.level].label}
              </p>
              <table className="mt-2 w-full text-[15px] tabular">
                <tbody className="divide-y divide-line">
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">নেট নম্বরের আদর্শ বিচ্যুতি</th><td className="py-2 text-right font-semibold">±{bnNum(d.consistency.sd, 1)}</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">সর্বোচ্চ − সর্বনিম্ন</th><td className="py-2 text-right font-semibold">{bnNum(d.consistency.range, 1)}</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">Accuracy-র আদর্শ বিচ্যুতি</th><td className="py-2 text-right font-semibold">±{fmt(d.consistency.accSd, 1)}%</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-sm text-ink-2">{bn(d.consistency.n)}টি পরীক্ষা থেকে। বিচ্যুতি ±{bn(cfg.bench.stableSd)}-এর মধ্যে হলে স্থিতিশীল, ±{bn(cfg.bench.unstableSd)}-এর বেশি হলে অস্থির। এটি উন্নতির মাপ নয় — নম্বর কতটা ওঠানামা করে তা দেখায়।</p>
            </>
          ) : <Unavailable>স্থিতিশীলতা মাপতে অন্তত {bn(cfg.minConsistency)}টি সম্পন্ন পরীক্ষা লাগবে; এখন {bn(kpi.total)}টি।</Unavailable>}
        </Card>
      </div>

      <p className="mt-8 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
        Accuracy = সঠিক ÷ উত্তর দেওয়া প্রশ্ন। Attempt = উত্তর দেওয়া ÷ মোট প্রশ্ন। “পরীক্ষার গড়” মানে প্রতিটি পরীক্ষাকে সমান ধরে গড়; “সব প্রশ্ন মিলিয়ে” মানে সব পরীক্ষার প্রশ্ন একত্র করে হার। কোনো নম্বরই BCS Preliminary-তে পাশের নিশ্চয়তা নয়।
      </p>
    </>
  );
}
