import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadRules } from "@/lib/rules";
import { getStudentTasks } from "@/lib/progress/dashboard";
import { tierGateStatus } from "@/lib/exam/service";
import { LOCKED_MESSAGE } from "@/lib/progress/cycle";
import { bn, bnNum } from "@/lib/bn";
import { ExamBubbles } from "@/components/portal/exam-bubbles";
import { ProgressBar } from "@/components/portal/progress-bar";

export const metadata: Metadata = { title: "Level ৩: Model Test" };
const TIER = [
  { n: 1, range: "০১–৫০", name: "প্রাথমিক থেকে মাঝারি" },
  { n: 2, range: "৫১–১০০", name: "মাঝারি থেকে উচ্চতর" },
  { n: 3, range: "১০১–১৫০", name: "উচ্চতর ও প্রতিযোগিতামূলক" },
];

export default function Level3Page() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>Level ৩: পূর্ণাঙ্গ Model Test</h1>
      <Suspense fallback={<p className="mt-6 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  const user = await requireUser("/level-3");
  const [rules, tasks, gates, published, best] = await Promise.all([
    loadRules(prisma),
    getStudentTasks(user.id),
    tierGateStatus(prisma, user.id),
    prisma.modelTest.count({ where: { status: "PUBLISHED" } }),
    prisma.testAttempt.groupBy({ by: ["taskId"], where: { userId: user.id, kind: "MODEL_TEST", submittedAt: { not: null } }, _max: { netScore: true } }),
  ]);
  const mts = tasks.filter((t) => t.kind === "L3_MODEL_TEST");
  const bestBy = new Map(best.map((b) => [b.taskId, b._max.netScore]));
  const locked = mts.every((t) => t.state === "LOCKED");
  const done = mts.filter((t) => t.state === "COMPLETED").length;
  const mix = rules.get<Record<string, number[]>>("l3.difficulty_mix");

  return (
    <>
      <p className="mt-2 max-w-2xl text-ink-2">
        ২০০ নম্বরের ১৫০টি টেস্ট, প্রতিটি {bn(rules.get<number>("l3.duration_min"))} মিনিট, প্রতিটি ভুলে {bn(rules.get<number>("l3.negative_mark"))} নম্বর কাটা।
        প্রতিটি টেস্টের পর ভুলগুলো পর্যালোচনা করলে পরেরটি খোলে।
      </p>
      <div className="mt-6 max-w-xl">
        <ProgressBar pct={(done / 150) * 100} label="Level ৩-এর অগ্রগতি" />
        <p className="mt-2 text-sm text-ink-2">{bn(done)}/১৫০ টেস্ট সম্পন্ন</p>
        <p className="mt-1 text-sm text-muted">প্রকাশিত Model Test: {bn(published)}/১৫০ (Level ২-এর প্রশ্নভান্ডার যুক্ত হওয়ার পর বাকিগুলো তৈরি হবে)</p>
      </div>
      {locked && (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-3 text-ink-2">Level ৩ তালাবন্ধ। {LOCKED_MESSAGE} Level ১ ও Level ২ সম্পন্ন হলে খুলবে।</p>
      )}
      {done > 0 && (
        <p className="mt-6"><Link href="/readiness-report" className="font-semibold text-green underline underline-offset-4">তোমার প্রস্তুতির প্রতিবেদন দেখো</Link></p>
      )}

      {TIER.map((t) => {
        const items = mts.filter((m) => m.phase === t.n);
        const gate = gates.find((g) => g.tier === t.n);
        const [e, m, h] = mix[String(t.n)];
        return (
          <section key={t.n} aria-labelledby={`tier-${t.n}`} className="mt-10 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`tier-${t.n}`} className="text-lg font-bold">স্তর {bn(t.n)}: Model Test {t.range} <span className="font-normal text-ink-2">({t.name})</span></h2>
              <span className="text-sm text-muted">কঠিনতা: সহজ {bn(e)}%, মাঝারি {bn(m)}%, কঠিন {bn(h)}%</span>
            </div>
            <div className="mt-4">
              <ExamBubbles
                listLabel={`স্তর ${bn(t.n)}-এর Model Test`}
                showLegendSpecial={false}
                items={items.map((x) => {
                  const no = Number(x.key.split(":")[2]);
                  const b = bestBy.get(x.id);
                  return { key: x.key, title: x.title, state: x.state, href: x.href, bestScore: null, label: bn(no), name: x.title, bestText: b != null ? `সেরা নেট ${bnNum(b, 1)}` : undefined };
                })}
              />
            </div>
            {gate && (
              <p className="mt-2 border-t border-line pt-3 text-[15px] text-ink-2">
                পরের স্তর খোলার শর্ত: এই স্তরের শেষ {bn(gate.window)}টি টেস্টের গড় নেট নম্বর অন্তত {bn(gate.need)}।{" "}
                {gate.state === "COMPLETED" ? (
                  <span className="font-semibold text-green">শর্ত পূরণ হয়েছে।</span>
                ) : gate.avg != null ? (
                  <span>এখন শেষ {bn(gate.count)}টির গড় <span className="font-semibold text-ink">{bnNum(gate.avg, 1)}</span>।{gate.state === "AVAILABLE" && " আগের টেস্টগুলো আবার দিয়ে গড় বাড়াতে পারো।"}</span>
                ) : null}
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
