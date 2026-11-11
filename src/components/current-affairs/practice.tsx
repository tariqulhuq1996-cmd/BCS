"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { answerCaAction } from "@/lib/current-affairs/actions";
import type { CaFeedback, CaPublicQuestion } from "@/lib/current-affairs/service";
import { bn } from "@/lib/bn";

const LETTERS = ["ক", "খ", "গ", "ঘ"];
const PR_LABEL = { A: "অত্যন্ত গুরুত্বপূর্ণ", B: "গুরুত্বপূর্ণ", C: "অতিরিক্ত প্রস্তুতি", D: "" } as const;

/** একটি করে প্রশ্ন; উত্তর দিলেই সার্ভার যাচাই করে ব্যাখ্যা, "মনে রাখুন", উৎস ও পরবর্তী পুনরাবৃত্তি দেখায় */
export function CaPractice({ questions, title, backHref }: { questions: CaPublicQuestion[]; title: string; backHref: string }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // মূল সূচক
  const [fb, setFb] = useState<CaFeedback | null>(null);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<{ q: CaPublicQuestion; correct: boolean }[]>([]);
  const [pending, start] = useTransition();
  const nextRef = useRef<HTMLButtonElement>(null);
  const q = questions[i];

  const choose = (orig: number) => {
    if (fb || pending || !q) return;
    setPicked(orig);
    setError(false);
    start(async () => {
      const r = await answerCaAction(q.id, orig).catch(() => null);
      if (!r) {
        setError(true);
        setPicked(null);
        return;
      }
      setFb(r);
      setResults((rs) => [...rs, { q, correct: r.correct }]);
    });
  };
  const next = () => {
    setI((n) => n + 1);
    setPicked(null);
    setFb(null);
  };

  useEffect(() => {
    if (fb) nextRef.current?.focus();
  }, [fb]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      const k = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : LETTERS.indexOf(e.key);
      if (k >= 0 && q && !fb) choose(q.order[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!questions.length)
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface p-6">
        <p className="text-lg">এই অংশে এখন অনুশীলনের মতো কোনো প্রশ্ন নেই।</p>
        <Link href={backHref} className="mt-3 inline-block font-semibold text-green underline underline-offset-4">Current Affairs-এ ফিরে যাও</Link>
      </div>
    );

  if (!q) {
    const right = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="mt-8 grid gap-6">
        <div className="rounded-2xl border-2 border-green bg-surface p-6">
          <p className="text-sm text-muted">{title} — শেষ</p>
          <p className="mt-1 text-[40px] font-extrabold tabular" style={{ fontStretch: "110%" }}>
            {bn(right)}/{bn(results.length)}
          </p>
          <p className="text-ink-2">{wrong.length ? `${bn(wrong.length)}টি ভুল — এগুলো স্মার্ট অনুশীলনে আগে আসবে।` : "সবগুলো ঠিক! ঠিক হওয়া প্রশ্ন কয়েক দিন পরে আবার আসবে, যাতে মনে থাকে।"}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {wrong.length > 0 && <a href="/current-affairs/practice?mode=wrong" className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white dark:text-paper">ভুলগুলো আবার</a>}
            <a href="/current-affairs/practice" className="rounded-lg border border-line-strong px-5 py-2.5 font-semibold">পরের স্মার্ট সেট</a>
            <Link href={backHref} className="px-2 py-2.5 font-semibold text-green underline underline-offset-4">সারসংক্ষেপ</Link>
          </div>
        </div>
        {wrong.length > 0 && (
          <section>
            <h2 className="text-lg font-bold">যেগুলো ভুল হয়েছে</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line text-[15px]">
              {wrong.map((r) => <li key={r.q.id} className="py-2">{bn(r.q.no)}. {r.q.text}</li>)}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const done = !!fb;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="tabular">প্রশ্ন {bn(i + 1)}/{bn(questions.length)}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-green transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
        </div>
        <span className="tabular">ঠিক {bn(results.filter((r) => r.correct).length)}</span>
      </div>

      <article className="mt-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded px-2 py-0.5 font-semibold ${q.priority === "A" ? "bg-omr-wash text-omr" : "bg-paper text-ink-2 border border-line"}`}>Priority {q.priority} · {PR_LABEL[q.priority]}</span>
          <span className="text-muted">{q.chapter}</span>
          {q.volatile && <span className="rounded bg-danger-wash px-2 py-0.5 text-danger" title="তথ্যটি সময়ের সঙ্গে বদলাতে পারে">⚠ পরিবর্তনশীল তথ্য</span>}
        </p>
        <h2 className="mt-3 text-lg font-semibold leading-relaxed">{bn(q.no)}. {q.text}</h2>
        {q.statements.length > 0 && (
          <ul className="mt-2 grid gap-1 pl-1 text-[15px]">
            {q.statements.map((s) => <li key={s}>{s}</li>)}
          </ul>
        )}
        {q.stemTail && <p className="mt-2 font-medium">{q.stemTail}</p>}

        <fieldset className="mt-4" disabled={done || pending}>
          <legend className="sr-only">উত্তর বাছাই করো (কিবোর্ডে ১–৪)</legend>
          <ul className="grid gap-2">
            {q.order.map((orig, pos) => {
              const isCorrect = done && orig === fb.correctIndex;
              const isWrongPick = done && orig === picked && !fb.correct;
              return (
                <li key={orig}>
                  <button
                    type="button"
                    onClick={() => choose(orig)}
                    aria-pressed={picked === orig}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      isCorrect ? "border-green bg-green-wash" : isWrongPick ? "border-danger bg-danger-wash" : picked === orig ? "border-omr" : "border-line hover:border-omr",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className={[
                        "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-semibold",
                        isCorrect ? "border-green bg-green text-white dark:text-paper" : isWrongPick ? "border-danger bg-danger text-white" : "border-omr text-omr",
                      ].join(" ")}
                    >
                      {LETTERS[pos]}
                    </span>
                    <span className="text-[15px]">{q.options[orig]}</span>
                    {isCorrect && <span className="ml-auto text-sm font-semibold text-green">সঠিক</span>}
                    {isWrongPick && <span className="ml-auto text-sm font-semibold text-danger">তোমার উত্তর</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div aria-live="polite">
          {pending && <p className="mt-3 text-sm text-muted">যাচাই হচ্ছে…</p>}
          {error && <p role="alert" className="mt-3 text-sm text-danger">উত্তর জমা হয়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করো।</p>}
          {fb && (
            <div className="mt-4 grid gap-2 border-t border-line pt-4 text-[15px] text-ink-2">
              <p className={`font-semibold ${fb.correct ? "text-green" : "text-danger"}`}>
                {fb.correct ? "ঠিক হয়েছে!" : `সঠিক উত্তর: ${LETTERS[q.order.indexOf(fb.correctIndex)]}) ${q.options[fb.correctIndex]}`}
              </p>
              {fb.explanation && <p><b className="text-ink">ব্যাখ্যা:</b> {fb.explanation}</p>}
              {fb.remember && <p className="rounded-md bg-green-wash px-3 py-2"><b className="text-ink">মনে রাখুন:</b> {fb.remember}</p>}
              {fb.volatileReason && <p className="rounded-md bg-danger-wash px-3 py-2"><b>⚠ পরিবর্তনশীল:</b> {fb.volatileReason} — পরীক্ষার আগে আবার যাচাই করো।</p>}
              {(fb.sourceText || fb.eventDate || fb.verifiedBn) && (
                <p className="text-sm text-muted">
                  {fb.sourceText && <>উৎস: {fb.sourceText}</>}
                  {fb.eventDate && <> · ঘটনার তারিখ: {fb.eventDate}</>}
                  {fb.verifiedBn && <> · যাচাই: {fb.verifiedBn}</>}
                </p>
              )}
              <p className="text-sm text-muted">{fb.correct ? `আবার আসবে ${bn(fb.nextInDays)} দিন পরে।` : "এটি পরের স্মার্ট সেটে আগে আসবে।"}</p>
              <button ref={nextRef} type="button" onClick={next} className="mt-2 justify-self-start rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">
                {i + 1 < questions.length ? "পরের প্রশ্ন →" : "ফলাফল দেখো"}
              </button>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
