import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { getDashboard } from "@/lib/progress/dashboard";
import { ATTEMPT_KIND_BN } from "@/lib/progress/cycle";
import { bn, bnNum } from "@/lib/bn";
import { ExamBubbles } from "@/components/portal/exam-bubbles";
import { ProgressBar } from "@/components/portal/progress-bar";

export const metadata: Metadata = { title: "আমার Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <Suspense fallback={<p className="pt-8 text-ink-2">তোমার অগ্রগতি লোড হচ্ছে…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

const LEVEL_NAME = ["", "বিগত BCS-এর প্রশ্ন", "টপিকভিত্তিক প্রশ্ন", "পূর্ণাঙ্গ Model Test"];

async function Dashboard() {
  const user = await requireUser("/dashboard");
  const d = await getDashboard(user.id);
  const curLevel = d.current?.levelNo ?? 1;

  return (
    <>
      <p className="text-ink-2">স্বাগতম, {user.name}</p>

      {/* ── আজ তোমার করণীয় */}
      <section aria-labelledby="today" className="mt-3 grid gap-6 rounded-2xl border-2 border-green bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h1 id="today" className="text-[30px] font-extrabold sm:text-[36px]" style={{ fontStretch: "110%" }}>
            আজ তোমার করণীয়
          </h1>
          {d.action ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Level {bn(curLevel)}, {d.current?.title}
                {d.action.stepLabel && ` — ধাপ: ${d.action.stepLabel}`}
              </p>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed">{d.action.text}</p>
              {d.nextUnlock && (
                <p className="mt-3 text-[15px] text-ink-2">
                  পরবর্তী Unlock: <span className="font-semibold text-ink">{d.nextUnlock.title}</span> — {d.nextUnlock.condition}।
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-lg">সব খোলা কাজ সম্পন্ন। নতুন ধাপ যুক্ত হলে এখানে দেখাবে।</p>
          )}
        </div>
        {d.action && (
          <Link href={d.action.href} className="inline-block rounded-lg bg-green px-7 py-3.5 text-center text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
            {d.action.button}
          </Link>
        )}
      </section>

      {/* ── আজকের Revision-স্মারক */}
      {d.revision.dueToday > 0 && (
        <section aria-label="আজকের Revision" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-omr bg-omr-wash px-5 py-4">
          <p className="text-[16px]">
            আজ <span className="font-bold">{bn(d.revision.dueToday)}টি</span> প্রশ্ন Revision-এর জন্য অপেক্ষা করছে। ভুলগুলো ভুলে যাওয়ার আগেই আরেকবার দেখে নাও।
          </p>
          <Link href="/revision" className="rounded-lg border-2 border-omr bg-surface px-4 py-2 font-semibold text-omr hover:bg-omr hover:text-white">Revision শুরু করো</Link>
        </section>
      )}

      {/* ── সংখ্যায় অগ্রগতি */}
      <section aria-label="সংক্ষেপে অগ্রগতি" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        {[
          { k: "মোট অগ্রগতি", v: `${bnNum(d.overallPct, d.overallPct > 0 && d.overallPct < 1 ? 1 : 0)}%`, s: "তিন Level সমান ভারে" },
          { k: "সম্পন্ন কাজ", v: bnNum(d.completedTasks), s: "ধাপ" },
          { k: "বাকি কাজ", v: bnNum(d.remainingTasks), s: "Level ৩-এর ১৫০ টেস্টসহ" },
          { k: "আজকের Revision", v: bn(d.revision.dueToday), s: `ভুলের ভান্ডারে ${bn(d.revision.wrongBank)}টি` },
          { k: "গড় Mastery", v: d.avgMastery != null ? `${bnNum(d.avgMastery, 0)}%` : "—", s: d.avgMastery != null ? "সব Mastery Test" : "এখনও কোনো টেস্ট নেই" },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-4">
            <p className="text-sm text-muted">{x.k}</p>
            <p className="mt-1 font-display text-[28px] font-bold leading-none tabular">{x.v}</p>
            <p className="mt-1.5 text-xs text-muted">{x.s}</p>
            {x.k === "আজকের Revision" && (
              <p className="mt-1 flex gap-3 text-xs">
                <Link href="/revision" className="text-green underline underline-offset-2">Revision</Link>
                <Link href="/mistakes" className="text-green underline underline-offset-2">ভুলের ভান্ডার</Link>
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ── সাম্প্রতিক বিষয়াবলি (Roadmap-এর বাইরে, যেকোনো সময়) */}
      <section aria-labelledby="ca" className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5">
        <div>
          <h2 id="ca" className="text-lg font-bold">সাম্প্রতিক বিষয়াবলি (Current Affairs)</h2>
          <p className="text-[15px] text-ink-2">প্রতিদিন ২০টি স্মার্ট প্রশ্ন — ভুল আর পুরোনো প্রশ্ন নিজে থেকে ফিরে আসে। যেকোনো Level-এ থাকা অবস্থায় করা যায়।</p>
        </div>
        <Link href="/current-affairs" className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">অনুশীলন করো</Link>
      </section>

      {/* ── তিন Level */}
      <section aria-labelledby="levels" className="mt-12">
        <h2 id="levels" className="text-2xl font-bold">তোমার Roadmap</h2>
        <ol className="mt-5 grid gap-5">
          {d.levels.map((l) => {
            const status = l.completed === l.total && l.total > 0 ? "সম্পন্ন" : l.open > 0 ? "চলছে" : !l.built ? "তালাবন্ধ (প্রস্তুত হচ্ছে)" : "তালাবন্ধ";
            return (
              <li key={l.no} className="grid gap-2 sm:grid-cols-[14rem_1fr_9rem] sm:items-center sm:gap-6">
                <Link href={`/level-${l.no}`} className="font-semibold hover:text-green">
                  Level {bn(l.no)}: {LEVEL_NAME[l.no]}
                </Link>
                <ProgressBar pct={l.pct} label={`Level ${bn(l.no)}-এর অগ্রগতি`} />
                <p className="text-sm text-ink-2 sm:text-right">
                  {bn(l.completed)}/{bn(l.total)} ধাপ, <span className={status === "চলছে" ? "font-semibold text-green" : "text-muted"}>{status}</span>
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 rounded-xl border border-line bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Level ১: ১০ম থেকে ৫০তম BCS</h3>
            <Link href="/level-1" className="text-sm text-green underline underline-offset-4">বিস্তারিত দেখো</Link>
          </div>
          <ExamBubbles
            items={d.l1.map((t) => ({ key: t.key, bcsNo: t.bcsNo, title: t.title, state: t.state, href: t.href, special: t.special, partial: t.partial, bestScore: t.bestScore }))}
          />
        </div>
      </section>

      {/* ── ফলাফল ও দুর্বলতা */}
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="results">
          <h2 id="results" className="text-2xl font-bold">সাম্প্রতিক ফলাফল</h2>
          {d.results.length ? (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {d.results.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span>
                    {r.title} <span className="text-sm text-muted">({ATTEMPT_KIND_BN[r.kind]})</span>
                  </span>
                  <span className={`whitespace-nowrap font-semibold tabular ${r.passed === false ? "text-danger" : "text-green"}`}>
                    {r.scorePct != null ? `${bnNum(r.scorePct, 0)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-ink-2">এখনও কোনো পরীক্ষা দাওনি। ১০ম BCS-এর প্রশ্নপত্র দিয়ে শুরু করো — ফলাফল এখানে জমা হবে।</p>
          )}
        </section>

        <section aria-labelledby="weak">
          <h2 id="weak" className="text-2xl font-bold">দুর্বলতা বিশ্লেষণ</h2>
          {d.weakSubjects.length || d.weakSubtopics.length ? (
            <>
              <ul className="mt-4 grid gap-3">
                {d.weakSubjects.map((w) => (
                  <li key={w.subject}>
                    <div className="flex justify-between text-[15px]">
                      <span>{w.subject}</span>
                      <span className="tabular text-ink-2">{bnNum(w.accuracy, 0)}% সঠিক</span>
                    </div>
                    <ProgressBar pct={w.accuracy} label={`${w.subject}: সঠিক উত্তরের হার`} />
                  </li>
                ))}
              </ul>
              {d.weakSubtopics.length > 0 && (
                <p className="mt-4 text-[15px] text-ink-2">
                  সবচেয়ে বেশি ভুল: {d.weakSubtopics.map((s) => `${s.name} (${bn(s.wrong)})`).join(", ")}। এগুলোর ভুল প্রশ্ন Revision-এ বারবার ফিরে আসবে।
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-ink-2">কোন বিষয়ে ও টপিকে তোমার ভুল বেশি, তা এখানে দেখাবে — প্রথম পরীক্ষার পর থেকেই।</p>
          )}
        </section>
      </div>

      {/* ── অর্জন */}
      <section aria-labelledby="ach" className="mt-12">
        <h2 id="ach" className="text-2xl font-bold">অর্জন</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {d.achievements.map((a) => (
            <li key={a.key} className={`rounded-lg border px-4 py-3 ${a.earned ? "border-green bg-green-wash" : "border-dashed border-line-strong"}`}>
              <p className={`font-semibold ${a.earned ? "" : "text-muted"}`}>{a.nameBn}</p>
              <p className="text-sm text-muted">{a.descBn}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
