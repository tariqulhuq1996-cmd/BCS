"use client";

import { useState } from "react";
import { bn } from "@/lib/bn";
import { QuestionTools } from "./question-tools";

const LETTERS = ["ক", "খ", "গ", "ঘ"];
type Item = {
  qid: string; text: string; options: string[]; selected: number | null; correct: number | null;
  status: "correct" | "wrong" | "unanswered"; unsure: boolean; explanation: string | null; explanationVerified: boolean;
  source: string | null; subject: string; subtopic: string; saved?: boolean; note?: string;
};
const FILTERS = [
  { k: "wrong", label: "ভুল" },
  { k: "unanswered", label: "অনুত্তরিত" },
  { k: "unsure", label: "অনিশ্চিত" },
  { k: "correct", label: "সঠিক" },
  { k: "all", label: "সব" },
] as const;

/** প্রশ্নভিত্তিক পর্যালোচনা: তোমার উত্তর, সঠিক উত্তর, ব্যাখ্যা — ভুলগুলো আগে। */
export function QuestionReview({ items }: { items: Item[] }) {
  const counts = {
    wrong: items.filter((i) => i.status === "wrong").length,
    unanswered: items.filter((i) => i.status === "unanswered").length,
    unsure: items.filter((i) => i.unsure).length,
    correct: items.filter((i) => i.status === "correct").length,
    all: items.length,
  };
  const [f, setF] = useState<(typeof FILTERS)[number]["k"]>(counts.wrong ? "wrong" : counts.unanswered ? "unanswered" : "all");
  const shown = items.map((it, n) => ({ it, n })).filter(({ it }) => (f === "all" ? true : f === "unsure" ? it.unsure : it.status === f));

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="প্রশ্ন ছাঁকুন">
        {FILTERS.map((x) => (
          <button
            key={x.k}
            aria-pressed={f === x.k}
            onClick={() => setF(x.k)}
            className={`rounded-full border px-3.5 py-1 text-sm ${f === x.k ? "border-green bg-green text-white dark:text-paper" : "border-line text-ink-2 hover:border-green"}`}
          >
            {x.label} ({bn(counts[x.k])})
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="mt-6 text-ink-2">এই তালিকায় কোনো প্রশ্ন নেই।</p>}
      <ol className="mt-5 grid gap-4">
        {shown.map(({ it, n }) => (
          <li key={it.qid + n} className={`rounded-xl border bg-surface p-5 ${it.status === "correct" ? "border-line" : "border-danger/50"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted">
                প্রশ্ন {bn(n + 1)}, {it.subject} › {it.subtopic}
              </p>
              <span className={`text-sm font-semibold ${it.status === "correct" ? "text-green" : "text-danger"}`}>
                {it.status === "correct" ? "সঠিক" : it.status === "wrong" ? "ভুল" : "উত্তর দেওয়া হয়নি"}
                {it.unsure && <span className="ml-1 font-normal text-muted">(নিশ্চিত ছিলে না)</span>}
              </span>
            </div>
            <p className="mt-2 text-[17px] font-semibold leading-relaxed">{it.text}</p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {it.options.map((o, k) => {
                const isRight = k === it.correct;
                const isMine = k === it.selected;
                return (
                  <li
                    key={k}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[15px] ${isRight ? "border-green bg-green-wash" : isMine ? "border-danger bg-danger-wash" : "border-line"}`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${isRight ? "border-green bg-green text-white dark:text-paper" : isMine ? "border-danger bg-danger text-white" : "border-line-strong text-muted"}`}>
                      {LETTERS[k]}
                    </span>
                    <span>{o}</span>
                    {isMine && <span className="ml-auto text-xs text-ink-2">আপনার উত্তর</span>}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 border-t border-line pt-3 text-[15px] text-ink-2">
              {it.explanation ? (
                <p>
                  <span className="font-semibold text-ink">ব্যাখ্যা: </span>
                  {it.explanation}
                  {!it.explanationVerified && <span className="ml-1 text-xs text-muted">(যাচাই চলছে)</span>}
                </p>
              ) : (
                <p className="text-muted">এই প্রশ্নের ব্যাখ্যা এখনও যুক্ত হয়নি।</p>
              )}
              {it.source && <p className="mt-1 text-xs text-muted">উৎস: {bn(it.source)}</p>}
            </div>
            <QuestionTools qid={it.qid} saved={!!it.saved} note={it.note ?? ""} />
          </li>
        ))}
      </ol>
    </div>
  );
}
