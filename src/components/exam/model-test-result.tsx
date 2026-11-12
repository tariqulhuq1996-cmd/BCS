import Link from "next/link";
import { prisma } from "@/lib/db";
import { getModelTestAnalysis } from "@/lib/exam/analysis";
import type { getResultView } from "@/lib/exam/service";
import { acknowledgeModelTestAction } from "@/lib/exam/actions";
import { bn, bnNum } from "@/lib/bn";
import { QuestionReview } from "./question-review";

type R = Awaited<ReturnType<typeof getResultView>>;

const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${bnNum(Math.abs(v), d)}`;

/** Model Test-এর ফলাফল: নেট নম্বর, নেগেটিভ, বিষয়ভিত্তিক, দুর্বল টপিক, সময়, আগের টেস্টের সঙ্গে তুলনা, প্রশ্নভিত্তিক পর্যালোচনা। */
export async function ModelTestResult({ attemptId, userId, r }: { attemptId: string; userId: string; r: R }) {
  const an = await getModelTestAnalysis(prisma, userId, attemptId);
  const usedMin = Math.min(an.usedMs, an.durationMin * 60e3) / 60e3;
  const nextTask = an.reviewed && an.taskKey ? await prisma.taskPrerequisite.findFirst({ where: { requires: { key: an.taskKey }, task: { kind: "L3_MODEL_TEST" } }, include: { task: { select: { key: true, titleBn: true } } } }) : null;

  return (
    <>
      <p className="text-sm text-muted">{an.title}</p>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="font-display text-[56px] font-extrabold leading-none tabular" style={{ fontStretch: "105%" }}>{bnNum(an.net, 1)}</h1>
        <p className="pb-1.5 text-lg text-ink-2">
          নেট নম্বর, ২০০-এর মধ্যে
          {an.prev && <span className={`ml-2 font-semibold ${an.net >= an.prev.net ? "text-green" : "text-danger"}`}>(আগের টেস্টের তুলনায় {signed(an.net - an.prev.net)})</span>}
        </p>
      </div>

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

      <section aria-label="সারাংশ" className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        {[
          { k: "সঠিক", v: bn(an.correct), c: "text-green" },
          { k: "ভুল", v: bn(an.wrong), c: "text-danger" },
          { k: "অনুত্তরিত", v: bn(an.unanswered), c: "" },
          { k: "নেগেটিভে কাটা", v: `−${bnNum(an.deduction, 1)}`, c: "text-danger" },
          { k: "ব্যবহৃত সময়", v: `${bnNum(usedMin, 0)}/${bn(an.durationMin)} মি.`, c: "" },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-4">
            <p className="text-sm text-muted">{x.k}</p>
            <p className={`mt-1 font-display text-[26px] font-bold leading-none tabular ${x.c}`}>{x.v}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="subj" className="mt-10">
        <h2 id="subj" className="text-xl font-bold">বিষয়ভিত্তিক ফল</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-left text-[15px] tabular">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">বিষয়</th>
                <th className="px-3 py-2 text-right font-medium">সঠিক/মোট</th>
                <th className="px-3 py-2 text-right font-medium">ভুল</th>
                <th className="px-3 py-2 text-right font-medium">নেট</th>
                <th className="px-3 py-2 text-right font-medium">আগের তুলনায়</th>
                <th className="px-3 py-2 text-right font-medium">সময় (মি.)</th>
              </tr>
            </thead>
            <tbody>
              {an.subjects.map((s) => (
                <tr key={s.code} className="border-b border-line">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-right">{bn(s.correct)}/{bn(s.total)}</td>
                  <td className="px-3 py-2 text-right text-danger">{bn(s.wrong)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{bnNum(s.net, 1)}</td>
                  <td className={`px-3 py-2 text-right ${s.prevNet == null ? "text-muted" : s.net >= s.prevNet ? "text-green" : "text-danger"}`}>{s.prevNet == null ? "—" : signed(s.net - s.prevNet)}</td>
                  <td className="px-3 py-2 text-right text-ink-2">{s.timeMin ? bnNum(s.timeMin, 1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-muted">নেট = সঠিক − {bn(an.negativeMark)} × ভুল। অনুত্তরিত প্রশ্নে নম্বর কাটে না।</p>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="weak">
          <h2 id="weak" className="text-xl font-bold">যেসব টপিকে সবচেয়ে বেশি নম্বর পাওনি</h2>
          <p className="mt-1 text-sm text-muted">ভুল ও অনুত্তরিত মিলিয়ে, টপিকের মোট প্রশ্নের মধ্যে</p>
          {an.weakTopics.length ? (
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {an.weakTopics.map((w) => (
                <li key={w.topic + w.subject} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="text-[15px] leading-snug">{w.topic}<span className="block text-xs text-muted">{w.subject}</span></span>
                  <span className="whitespace-nowrap text-sm text-danger tabular">{bn(w.miss)}/{bn(w.total)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-ink-2">কোনো টপিকে ভুল নেই।</p>}
        </section>
        <section aria-labelledby="time">
          <h2 id="time" className="text-xl font-bold">সময়ের ব্যবহার</h2>
          <p className="mt-3 text-[15px] text-ink-2">
            মোট {bnNum(usedMin, 0)} মিনিট ব্যবহার করেছেন{an.avgSecPerAnswered ? `; উত্তর দেওয়া প্রতিটি প্রশ্নে গড়ে ${bnNum(an.avgSecPerAnswered, 0)} সেকেন্ড` : ""}।
            ১২০ মিনিটে ২০০ প্রশ্ন মানে প্রশ্নপ্রতি গড়ে ৩৬ সেকেন্ড।
          </p>
          {an.slow.length > 0 && (
            <>
              <p className="mt-3 text-sm font-semibold">সবচেয়ে বেশি সময় নেওয়া প্রশ্ন</p>
              <ul className="mt-1 grid gap-1.5 text-sm text-ink-2">
                {an.slow.map((s, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="line-clamp-1">{s.text}</span>
                    <span className={`whitespace-nowrap tabular ${s.correct ? "text-green" : "text-danger"}`}>{bnNum(s.sec, 0)} সে.</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="review" className="mt-12">
        <h2 id="review" className="text-xl font-bold">প্রশ্নভিত্তিক পর্যালোচনা</h2>
        <div className="mt-4"><QuestionReview items={r.items} /></div>
      </section>
    </>
  );
}
