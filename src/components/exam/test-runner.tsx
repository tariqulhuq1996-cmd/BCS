"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveAnswerAction, submitAttemptAction } from "@/lib/exam/actions";
import { bn } from "@/lib/bn";

const LETTERS = ["ক", "খ", "গ", "ঘ"];
type Q = { qid: string; text: string; options: string[]; selected: number | null; marked: boolean; unsure: boolean };
type Ans = { selected: number | null; marked: boolean; unsure: boolean };

/**
 * পরীক্ষার পর্দা: একবারে একটি প্রশ্ন, OMR-বৃত্তে উত্তর, Review-চিহ্ন, "নিশ্চিত নই",
 * আগের/পরের প্রশ্ন, প্রশ্ন-তালিকা, প্রতিটি উত্তর সঙ্গে সঙ্গে সার্ভারে সংরক্ষণ, সময়সীমা থাকলে স্বয়ংক্রিয় জমা।
 */
export function TestRunner({ attemptId, title, questions, deadlineAt }: { attemptId: string; title: string; questions: Q[]; deadlineAt: string | null }) {
  const [i, setI] = useState(() => Math.max(0, questions.findIndex((q) => q.selected == null)));
  const [ans, setAns] = useState<Record<string, Ans>>(() => Object.fromEntries(questions.map((q) => [q.qid, { selected: q.selected, marked: q.marked, unsure: q.unsure }])));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  const q = questions[i];
  const a = ans[q.qid];
  const answered = useMemo(() => questions.filter((x) => ans[x.qid].selected != null).length, [ans, questions]);
  const markedCount = useMemo(() => questions.filter((x) => ans[x.qid].marked).length, [ans, questions]);

  const persist = useCallback(
    (qid: string, next: Ans) => {
      setAns((s) => ({ ...s, [qid]: next }));
      setSaveState("saving");
      pending.current++;
      // ক্রম রক্ষা: আগের সংরক্ষণ শেষ হলে পরেরটি
      chain.current = chain.current.then(async () => {
        try {
          const r = await saveAnswerAction(attemptId, qid, next.selected, next.marked, next.unsure);
          if (!r.ok) {
            setSaveState("error");
            setSaveError(r.error ?? "সংরক্ষণ করা যায়নি।");
          } else if (--pending.current === 0) setSaveState("saved");
        } catch {
          setSaveState("error");
          setSaveError("ইন্টারনেট সংযোগ পরীক্ষা করুন; উত্তরটি সংরক্ষণ হয়নি।");
        }
      });
    },
    [attemptId],
  );

  const submit = useCallback(() => {
    startSubmit(async () => {
      await chain.current; // সব উত্তর সংরক্ষণের পর জমা
      await submitAttemptAction(attemptId);
    });
  }, [attemptId]);

  // ── সময়সীমা (Level 3-এ ব্যবহৃত হবে)
  const [left, setLeft] = useState<number | null>(null); // প্রথম টিকে হিসাব হয়
  useEffect(() => {
    if (!deadlineAt) return;
    const t = setInterval(() => {
      const ms = new Date(deadlineAt).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(t);
        submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineAt, submit]);

  // ── কীবোর্ড: ১–৪ বা 1–4 দিয়ে উত্তর, ←/→ দিয়ে প্রশ্ন বদল
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input:not([type="checkbox"]):not([type="radio"]), textarea, select, button, a')) {
        if (!(t instanceof HTMLInputElement) && (e.key === "Enter" || e.key === " ")) return; // বাটন/লিংকের নিজস্ব কাজ
        if (t.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select')) return;
      }
      const n = "1234১২৩৪".indexOf(e.key);
      if (n >= 0) persist(q.qid, { ...a, selected: n % 4 });
      if (e.key === "ArrowRight") setI((x) => Math.min(questions.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, a, persist, questions.length, confirming]);

  // অসংরক্ষিত পরিবর্তন থাকলে পাতা ছাড়ার আগে সতর্কতা
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pending.current > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return bn(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      {/* ── মাথার সারি */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold sm:text-xl">{title}</h1>
        <div className="flex items-center gap-4 text-sm">
          {left != null && (
            <span className={`font-semibold tabular ${left < 5 * 60e3 ? "text-danger" : "text-ink"}`} aria-live="off">
              সময় বাকি {fmt(left)}
            </span>
          )}
          <span className="text-muted" aria-live="polite">
            {saveState === "saving" ? "সংরক্ষণ হচ্ছে…" : saveState === "saved" ? "সংরক্ষিত" : saveState === "error" ? "" : ""}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="উত্তর দেওয়া প্রশ্ন" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}>
          <div className="h-full bg-green" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular text-ink-2">{bn(answered)}/{bn(questions.length)} উত্তর</span>
      </div>
      {saveState === "error" && <p role="alert" className="mt-3 rounded-md border border-danger bg-danger-wash px-3 py-2 text-sm">{saveError}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_17rem]">
        {/* ── প্রশ্ন */}
        <section aria-labelledby="qtext" className="rounded-xl border border-line bg-surface p-5 sm:p-7">
          <p className="text-sm text-muted">প্রশ্ন {bn(i + 1)} / {bn(questions.length)}</p>
          <p id="qtext" className="mt-2 text-[19px] font-semibold leading-relaxed">{q.text}</p>
          <fieldset className="mt-5">
            <legend className="sr-only">উত্তর বাছাই করুন</legend>
            <ul className="grid gap-2.5">
              {q.options.map((o, k) => {
                const on = a.selected === k;
                return (
                  <li key={k}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${on ? "border-green bg-green-wash" : "border-line hover:border-omr"}`}>
                      <input type="radio" name={`q-${q.qid}`} className="peer sr-only" checked={on} onChange={() => persist(q.qid, { ...a, selected: k })} />
                      <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-green ${on ? "border-green bg-green text-white dark:text-paper" : "border-omr text-omr"}`}>
                        {LETTERS[k]}
                      </span>
                      <span className="text-[16px]">{o}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-[var(--omr)]" checked={a.marked} onChange={(e) => persist(q.qid, { ...a, marked: e.target.checked })} />
              পরে দেখার জন্য চিহ্নিত করুন
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-[var(--omr)]" checked={a.unsure} onChange={(e) => persist(q.qid, { ...a, unsure: e.target.checked })} />
              নিশ্চিত নই
            </label>
            {a.selected != null && (
              <button type="button" onClick={() => persist(q.qid, { ...a, selected: null })} className="text-ink-2 underline underline-offset-4">
                উত্তর মুছুন
              </button>
            )}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
            <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-lg border border-line-strong px-4 py-2.5 font-medium disabled:opacity-40">
              আগের প্রশ্ন
            </button>
            {i < questions.length - 1 ? (
              <button type="button" onClick={() => setI(i + 1)} className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">
                পরের প্রশ্ন
              </button>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">
                উত্তর জমা দিন
              </button>
            )}
          </div>
        </section>

        {/* ── প্রশ্ন-তালিকা */}
        <aside aria-label="প্রশ্ন-তালিকা">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">সব প্রশ্ন</h2>
            <span className="text-xs text-muted">চিহ্নিত {bn(markedCount)}টি</span>
          </div>
          <ol className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
            {questions.map((x, k) => {
              const s = ans[x.qid];
              return (
                <li key={x.qid}>
                  <button
                    type="button"
                    onClick={() => setI(k)}
                    aria-current={k === i ? "step" : undefined}
                    aria-label={`প্রশ্ন ${bn(k + 1)}${s.selected != null ? ", উত্তর দেওয়া" : ", উত্তর বাকি"}${s.marked ? ", চিহ্নিত" : ""}`}
                    className={`relative grid h-9 w-full place-items-center rounded-md border text-[13px] tabular ${
                      s.selected != null ? "border-green bg-green text-white dark:text-paper" : "border-line-strong bg-surface text-ink-2"
                    } ${k === i ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : ""}`}
                  >
                    {bn(k + 1)}
                    {s.marked && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-paper bg-omr" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted">সবুজ: উত্তর দেওয়া; গোলাপি বিন্দু: চিহ্নিত। কীবোর্ডে ১–৪ চেপে উত্তর, ← → চেপে প্রশ্ন বদল।</p>
          <button type="button" onClick={() => setConfirming(true)} className="mt-5 w-full rounded-lg border-2 border-green px-4 py-2.5 font-semibold text-green hover:bg-green-wash">
            উত্তর জমা দিন
          </button>
        </aside>
      </div>

      {/* ── জমার আগে নিশ্চিতকরণ */}
      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h2 id="confirm-title" className="text-xl font-bold">উত্তর জমা দেবেন?</h2>
            <p className="mt-3 text-ink-2">
              {bn(answered)}টি প্রশ্নের উত্তর দিয়েছেন
              {questions.length - answered > 0 && <>, <span className="font-semibold text-danger">{bn(questions.length - answered)}টি বাকি</span></>}
              {markedCount > 0 && <>, {bn(markedCount)}টি চিহ্নিত</>}। জমা দেওয়ার পর উত্তর আর বদলানো যাবে না।
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="rounded-lg border border-line-strong px-4 py-2.5">
                ফিরে যান
              </button>
              <button type="button" onClick={submit} disabled={submitting} autoFocus className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white disabled:opacity-60 dark:text-paper">
                {submitting ? "জমা হচ্ছে…" : "হ্যাঁ, জমা দিন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
