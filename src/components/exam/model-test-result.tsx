import Link from "next/link";
import { prisma } from "@/lib/db";
import { getModelTestAnalysis } from "@/lib/exam/analysis";
import type { getResultView } from "@/lib/exam/service";
import { tryExamReport } from "@/lib/exam/performance";
import { acknowledgeModelTestAction } from "@/lib/exam/actions";
import { bn, bnNum } from "@/lib/bn";
import { QuestionReview } from "./question-review";
import { TimingReportView } from "./timing-report";
import { PostExamAnalysis } from "./result-body";
import { modelTestRank } from "@/lib/progress/peers";
import { BackLink } from "@/components/site/back-link";

type R = Awaited<ReturnType<typeof getResultView>>;

const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${bnNum(Math.abs(v), d)}`;

/** Model Test-এর ফলাফল: নেট নম্বর, র‍্যাংক, পর্যালোচনার ধাপ, পরীক্ষা-পরবর্তী বিশ্লেষণ, দুর্বল টপিক ও প্রশ্নভিত্তিক উত্তর-ব্যাখ্যা। */
export async function ModelTestResult({ attemptId, userId, r }: { attemptId: string; userId: string; r: R }) {
  const an = await getModelTestAnalysis(prisma, userId, attemptId);
  const analysis = await tryExamReport(prisma, userId, attemptId);
  const att = await prisma.testAttempt.findUnique({ where: { id: attemptId }, select: { taskId: true } });
  const rank = att?.taskId ? await modelTestRank(prisma, userId, att.taskId) : null;
  const nextTask = an.reviewed && an.taskKey ? await prisma.taskPrerequisite.findFirst({ where: { requires: { key: an.taskKey }, task: { kind: "L3_MODEL_TEST" } }, include: { task: { select: { key: true, titleBn: true } } } }) : null;

  return (
    <>
      <BackLink href="/level-3" label="Level ৩-এর সব টেস্ট" />
      <p className="text-sm text-muted">{an.title}</p>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="font-display text-[56px] font-extrabold leading-none tabular" style={{ fontStretch: "105%" }}>{bnNum(an.net, 1)}</h1>
        <p className="pb-1.5 text-lg text-ink-2">
          নেট নম্বর, ২০০-এর মধ্যে
          {an.prev && <span className={`ml-2 font-semibold ${an.net >= an.prev.net ? "text-green" : "text-danger"}`}>(আগের টেস্টের তুলনায় {signed(an.net - an.prev.net)})</span>}
        </p>
      </div>
      {rank && (
        <p className="mt-2 text-[15px] text-ink-2">
          এই টেস্টে যারা দিয়েছেন ({bn(rank.peers)} জন, প্রত্যেকের প্রথম চেষ্টা), তাদের মধ্যে আপনি <span className="font-semibold text-ink">শীর্ষ {bn(rank.top)}%</span>-এ। কারো নাম দেখানো হয় না।
        </p>
      )}

      <section aria-label="এখনকার কাজ" className="mt-6 rounded-xl border-2 border-green bg-surface p-5 sm:p-6">
        {an.reviewed ? (
          <>
            <p className="text-lg">পর্যালোচনা সম্পন্ন।{nextTask ? ` ${nextTask.task.titleBn} এখন খোলা।` : ""}</p>
            <div className="mt-4"><Link href="/dashboard" className="inline-block rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">পরবর্তী কাজে যান</Link></div>
          </>
        ) : (
          <form action={acknowledgeModelTestAction}>
            <input type="hidden" name="attemptId" value={attemptId} />
            <p className="text-lg">নিচে প্রতিটি ভুল ও অনুত্তরিত প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা দেখুন। পর্যালোচনা শেষ হলে পরের টেস্ট খুলবে।</p>
            <button className="mt-4 rounded-lg bg-green px-5 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper">ভুলগুলো দেখেছি, পরের টেস্ট খুলুন</button>
          </form>
        )}
      </section>

      {analysis ? <PostExamAnalysis analysis={analysis} /> : <TimingReportView t={r.timing} />}

      <section aria-labelledby="weak" className="mt-10">
        <h2 id="weak" className="text-xl font-bold">যেসব টপিকে সবচেয়ে বেশি নম্বর পাওনি</h2>
        <p className="mt-1 text-sm text-muted">ভুল ও অনুত্তরিত মিলিয়ে, টপিকের মোট প্রশ্নের মধ্যে</p>
        {an.weakTopics.length ? (
          <ol className="mt-3 grid gap-x-8 divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-y-0">
            {an.weakTopics.map((w) => (
              <li key={w.topic + w.subject} className="flex items-baseline justify-between gap-3 py-2.5 sm:border-b sm:border-line">
                <span className="text-[15px] leading-snug">{w.topic}<span className="block text-xs text-muted">{w.subject}</span></span>
                <span className="whitespace-nowrap text-sm text-danger tabular">{bn(w.miss)}/{bn(w.total)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-ink-2">কোনো টপিকে ভুল নেই।</p>}
      </section>

      <section aria-labelledby="review" className="mt-12">
        <h2 id="review" className="text-xl font-bold">প্রশ্নভিত্তিক উত্তর ও ব্যাখ্যা</h2>
        <div className="mt-4"><QuestionReview items={r.items} /></div>
      </section>
    </>
  );
}
