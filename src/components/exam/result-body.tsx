import { bn, bnNum } from "@/lib/bn";
import type { getResultView } from "@/lib/exam/service";
import { ProgressBar } from "@/components/portal/progress-bar";
import { QuestionReview } from "./question-review";

type R = Awaited<ReturnType<typeof getResultView>>;

/** ফলাফলের সারাংশ, বিষয়ভিত্তিক হিসাব, ভুলের বিশ্লেষণ ও প্রশ্নভিত্তিক পর্যালোচনা। */
export function ResultBody({ r }: { r: R }) {
  return (
    <>
      <section aria-label="সারাংশ" className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          { k: "সঠিক", v: bn(r.correct), c: "text-green" },
          { k: "ভুল", v: bn(r.wrong), c: "text-danger" },
          { k: "অনুত্তরিত", v: bn(r.unanswered), c: "text-ink" },
          { k: "অনিশ্চিত হয়েও সঠিক", v: bn(r.unsureCorrect), c: "text-ink" },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-4">
            <p className="text-sm text-muted">{x.k}</p>
            <p className={`mt-1 font-display text-[28px] font-bold leading-none tabular ${x.c}`}>{x.v}</p>
          </div>
        ))}
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="by-subject">
          <h2 id="by-subject" className="text-xl font-bold">বিষয়ভিত্তিক ফলাফল</h2>
          <ul className="mt-4 grid gap-3">
            {r.subjects.map((s) => {
              const pct = (s.correct / s.total) * 100;
              return (
                <li key={s.subject}>
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span>{s.subject}</span>
                    <span className="tabular text-ink-2">
                      {bn(s.correct)}/{bn(s.total)} ({bnNum(pct, 0)}%)
                    </span>
                  </div>
                  <ProgressBar pct={pct} label={`${s.subject}: সঠিকের হার`} />
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="mistakes">
          <h2 id="mistakes" className="text-xl font-bold">ভুলের বিশ্লেষণ</h2>
          {r.weakSubtopics.length ? (
            <>
              <p className="mt-2 text-[15px] text-ink-2">যেসব উপবিষয়ে সবচেয়ে বেশি ভুল বা অনুত্তরিত:</p>
              <ol className="mt-3 divide-y divide-line border-y border-line">
                {r.weakSubtopics.map((w) => (
                  <li key={w.subtopic} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="text-[15px] leading-snug">
                      {w.subtopic}
                      <span className="block text-xs text-muted">{w.subject}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-danger tabular">{bn(w.n)}টি</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm text-muted">এই প্রশ্নগুলো তোমার Revision-সারিতে যুক্ত হয়েছে এবং পরের Revision ও Mastery Test-এ আগে আসবে।</p>
            </>
          ) : (
            <p className="mt-3 text-ink-2">কোনো ভুল নেই। চমৎকার!</p>
          )}
        </section>
      </div>

      <section aria-labelledby="review" className="mt-12">
        <h2 id="review" className="text-xl font-bold">প্রশ্নভিত্তিক পর্যালোচনা</h2>
        <div className="mt-4">
          <QuestionReview items={r.items} />
        </div>
      </section>
    </>
  );
}
