"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addTimeAction, saveAnswerAction, submitAttemptAction } from "@/lib/exam/actions";
import { bn, bnNum } from "@/lib/bn";

const LETTERS = ["ক", "খ", "গ", "ঘ"];
type Mode = "DIRECT" | "GUESS" | "SKIP" | null;
type Q = { qid: string; text: string; options: string[]; selected: number | null; marked: boolean; unsure: boolean; mode: Mode; eliminated: number[]; timeMs: number };
type Ans = { selected: number | null; marked: boolean; mode: Mode; eliminated: number[] };

/**
 * বাস্তব BCS Preliminary-র আদলে পরীক্ষার পর্দা:
 * - পুরো পরীক্ষার সময়সীমা (প্রশ্ন × বরাদ্দ সেকেন্ড), শেষ হলে স্বয়ংক্রিয় জমা।
 * - প্রতিটি প্রশ্নের আলাদা টাইমার; প্রশ্ন বদলালে সময় সার্ভারে যোগ হয়।
 * - উত্তরের তিন পদ্ধতি: Direct (সরাসরি), Intelligent Guess (দুটি অপশন বাদ দিয়ে বাকি দুটির একটি), Skip।
 * - উত্তর দিলে পরের প্রশ্নে চলে যায়; পরীক্ষার মাঝে সঠিক উত্তর বা ব্যাখ্যা দেখানো হয় না।
 */
export function TestRunner({ attemptId, title, questions, deadlineAt, startedAt, secPerQ, markSec }: {
  attemptId: string; title: string; questions: Q[]; deadlineAt: string | null; startedAt: string; secPerQ: number; markSec: number;
}) {
  const [i, setI] = useState(() => Math.max(0, questions.findIndex((q) => q.selected == null && q.mode !== "SKIP")));
  const [ans, setAns] = useState<Record<string, Ans>>(() => Object.fromEntries(questions.map((q) => [q.qid, { selected: q.selected, marked: q.marked, mode: q.mode, eliminated: q.eliminated }])));
  const [spent, setSpent] = useState<Record<string, number>>(() => Object.fromEntries(questions.map((q) => [q.qid, q.timeMs ?? 0])));
  const [guessing, setGuessing] = useState(false);
  const [elim, setElim] = useState<number[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [enteredAt, setEnteredAt] = useState(() => Date.now()); // বর্তমান প্রশ্নে ঢোকার সময় (পর্দার টাইমারের জন্য)
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = questions[i];
  const a = ans[q.qid];
  const answered = useMemo(() => questions.filter((x) => ans[x.qid].selected != null).length, [ans, questions]);
  const markedCount = useMemo(() => questions.filter((x) => ans[x.qid].marked).length, [ans, questions]);
  const counts = useMemo(() => {
    let d = 0, g = 0, s = 0;
    for (const x of questions) {
      const v = ans[x.qid];
      if (v.selected != null) {
        if (v.mode === "GUESS") g++;
        else d++;
      }
      else if (v.mode === "SKIP") s++;
    }
    return { d, g, s };
  }, [ans, questions]);

  const persist = useCallback(
    (qid: string, next: Ans) => {
      setAns((s) => ({ ...s, [qid]: next }));
      setSaveState("saving");
      pending.current++;
      chain.current = chain.current.then(async () => {
        try {
          const r = await saveAnswerAction(attemptId, qid, next.selected, next.marked, false, next.mode, next.mode === "GUESS" ? next.eliminated : []);
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

  // ── প্রতিটি প্রশ্নে কাটানো সময়: প্রশ্ন বদলালে আগেরটির সময় সার্ভারে যোগ হয় ও পর্দার হিসাবে জমা থাকে
  const enter = useRef<{ qid: string; t: number } | null>(null);
  useEffect(() => {
    const t = Date.now();
    const prev = enter.current;
    if (prev && prev.qid !== q.qid) {
      const ms = t - prev.t;
      void addTimeAction(attemptId, prev.qid, ms);
      setSpent((s) => ({ ...s, [prev.qid]: (s[prev.qid] ?? 0) + ms }));
    }
    enter.current = { qid: q.qid, t };
    setEnteredAt(t);
    setGuessing(false);
    setElim([]);
  }, [q.qid, attemptId]);

  const go = useCallback((k: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setI(Math.max(0, Math.min(questions.length - 1, k)));
  }, [questions.length]);
  /** উত্তরের পর পরের প্রশ্নে (শেষ প্রশ্নে থাকলে সেখানেই) — সংক্ষিপ্ত বিরতিতে, যাতে নির্বাচন চোখে পড়ে */
  const advance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (i >= questions.length - 1) return;
    advanceTimer.current = setTimeout(() => setI((x) => Math.min(questions.length - 1, x + 1)), 300);
  }, [i, questions.length]);

  const choose = useCallback((k: number) => {
    if (guessing) {
      if (elim.includes(k)) return setElim(elim.filter((x) => x !== k)); // বাদ দেওয়া ফেরত
      if (elim.length < 2) return setElim([...elim, k]);
      persist(q.qid, { ...a, selected: k, mode: "GUESS", eliminated: elim });
      setGuessing(false);
      setElim([]);
      advance();
      return;
    }
    persist(q.qid, { ...a, selected: k, mode: "DIRECT", eliminated: [] });
    advance();
  }, [guessing, elim, persist, q.qid, a, advance]);

  const skip = useCallback(() => {
    persist(q.qid, { ...a, selected: null, mode: "SKIP", eliminated: [] });
    setGuessing(false);
    setElim([]);
    advance();
  }, [persist, q.qid, a, advance]);

  const submit = useCallback(() => {
    startSubmit(async () => {
      const cur = enter.current;
      if (cur) await addTimeAction(attemptId, cur.qid, Date.now() - cur.t);
      await chain.current;
      await submitAttemptAction(attemptId);
    });
  }, [attemptId]);

  // ── ঘড়ি: প্রতি সেকেন্ডে; সময়সীমা শেষ হলে স্বয়ংক্রিয় জমা
  const autoSubmitted = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (deadlineAt && !autoSubmitted.current && new Date(deadlineAt).getTime() - n <= 0) {
        autoSubmitted.current = true;
        submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineAt, submit]);
  const left = deadlineAt ? new Date(deadlineAt).getTime() - now : null;
  const elapsed = now - new Date(startedAt).getTime();
  const curMs = (spent[q.qid] ?? 0) + Math.max(0, now - enteredAt);
  const curSec = curMs / 1000;
  const solveTarget = secPerQ - markSec;
  const answeredMs = questions.reduce((s, x) => (ans[x.qid].selected != null ? s + (spent[x.qid] ?? 0) : s), 0);
  const avgSec = answered ? answeredMs / 1000 / answered : null;

  // ── কীবোর্ড: ১–৪ উত্তর, G = Guess, S = Skip, ←/→ প্রশ্ন বদল
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select')) return;
      if (t instanceof Element && t.closest("button, a") && (e.key === "Enter" || e.key === " ")) return;
      const n = "1234১২৩৪".indexOf(e.key);
      if (n >= 0) choose(n % 4);
      else if (e.key === "g" || e.key === "G") setGuessing((x) => !x);
      else if (e.key === "s" || e.key === "S") skip();
      else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, skip, go, i, confirming]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pending.current > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    return bn(`${h ? `${h}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
  };
  const timerTone = curSec + markSec > secPerQ ? "text-danger" : curSec > solveTarget * 0.75 ? "text-omr" : "text-green";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      {/* ── মাথার সারি */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold sm:text-xl">{title}</h1>
        <div className="flex items-center gap-4 text-sm">
          {left != null && (
            <span className={`rounded-md px-2.5 py-1 font-semibold tabular ${left < 5 * 60e3 ? "bg-danger-wash text-danger" : "bg-paper text-ink"}`} aria-live="off">
              সময় বাকি {fmt(left)}
            </span>
          )}
          <span className="text-muted" aria-live="polite">{saveState === "saving" ? "সংরক্ষণ হচ্ছে…" : saveState === "saved" ? "সংরক্ষিত" : ""}</span>
        </div>
      </div>

      {/* ── অগ্রগতি ও সময়ের তথ্য */}
      <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center text-[13px] sm:grid-cols-5 lg:grid-cols-9">
        {[
          ["প্রশ্ন", `${bn(i + 1)}/${bn(questions.length)}`],
          ["উত্তর", bn(answered)],
          ["বাকি", bn(questions.length - answered)],
          ["সময় বাকি", left != null ? fmt(left) : "—"],
          ["অতিবাহিত", fmt(elapsed)],
          ["গড়/প্রশ্ন", avgSec == null ? "—" : `${bnNum(avgSec, 1)} সে.`],
          ["Direct", bn(counts.d)],
          ["Guess", bn(counts.g)],
          ["Skip", bn(counts.s)],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-2 py-2">
            <dt className="text-muted">{k}</dt>
            <dd className="mt-0.5 font-semibold tabular text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {saveState === "error" && <p role="alert" className="mt-3 rounded-md border border-danger bg-danger-wash px-3 py-2 text-sm">{saveError}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_17rem]">
        {/* ── প্রশ্ন */}
        <section aria-labelledby="qtext" className="rounded-xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">প্রশ্ন {bn(i + 1)} / {bn(questions.length)}</p>
            <p className={`text-sm font-semibold tabular ${timerTone}`} aria-label="এই প্রশ্নে কাটানো সময়">
              এই প্রশ্নে {fmt(curMs)} <span className="font-normal text-muted">· লক্ষ্য {bn(solveTarget)} সে. + চিহ্নিত {bn(markSec)} সে.</span>
            </p>
          </div>
          <p id="qtext" className="mt-2 text-[19px] font-semibold leading-relaxed">{q.text}</p>

          {guessing && (
            <p role="status" className="mt-3 rounded-lg bg-omr-wash px-3 py-2 text-[15px]">
              {elim.length < 2 ? `Intelligent Guess: যে দুটি অপশন ভুল মনে হয় সেগুলো বাদ দিন (${bn(elim.length)}/২)।` : "এবার অবশিষ্ট দুটি অপশন থেকে একটি বাছাই করুন।"}
            </p>
          )}

          <fieldset className="mt-5">
            <legend className="sr-only">উত্তর বাছাই করুন</legend>
            <ul className="grid gap-2.5">
              {q.options.map((o, k) => {
                const on = a.selected === k && !guessing;
                const out = guessing ? elim.includes(k) : a.mode === "GUESS" && a.eliminated.includes(k);
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => choose(k)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${on ? "border-green bg-green-wash" : out ? "border-line bg-paper opacity-60" : "border-line hover:border-omr"}`}
                    >
                      <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] font-semibold ${on ? "border-green bg-green text-white dark:text-paper" : out ? "border-line-strong text-muted" : "border-omr text-omr"}`}>
                        {out ? "✕" : LETTERS[k]}
                      </span>
                      <span className={`text-[16px] ${out ? "line-through" : ""}`}>{o}</span>
                      {out && <span className="sr-only">(বাদ দেওয়া)</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { setGuessing((x) => !x); setElim([]); }}
              aria-pressed={guessing}
              className={`rounded-lg border-2 px-4 py-2 font-semibold ${guessing ? "border-omr bg-omr text-white" : "border-omr text-omr hover:bg-omr-wash"}`}
            >
              {guessing ? "Guess বাতিল" : "Intelligent Guess"}
            </button>
            <button type="button" onClick={skip} className="rounded-lg border-2 border-line-strong px-4 py-2 font-semibold text-ink-2 hover:border-ink">
              Skip
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-[15px]">
              <input type="checkbox" className="size-4 accent-[var(--omr)]" checked={a.marked} onChange={(e) => persist(q.qid, { ...a, marked: e.target.checked })} />
              পরে দেখার জন্য চিহ্নিত
            </label>
            {(a.selected != null || a.mode === "SKIP") && (
              <button type="button" onClick={() => persist(q.qid, { ...a, selected: null, mode: null, eliminated: [] })} className="text-[15px] text-ink-2 underline underline-offset-4">
                উত্তর মুছুন
              </button>
            )}
          </div>
          {a.mode && !guessing && (
            <p className="mt-3 text-sm text-muted">
              {a.mode === "SKIP" ? "এই প্রশ্নটি Skip করা হয়েছে।" : a.mode === "GUESS" ? "এই উত্তরটি Intelligent Guess হিসেবে সংরক্ষিত।" : "Direct Answer হিসেবে সংরক্ষিত।"}
            </p>
          )}

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
            <button type="button" disabled={i === 0} onClick={() => go(i - 1)} className="rounded-lg border border-line-strong px-4 py-2.5 font-medium disabled:opacity-40">
              আগের প্রশ্ন
            </button>
            {i < questions.length - 1 ? (
              <button type="button" onClick={() => go(i + 1)} className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">
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
              const tone = s.selected != null ? (s.mode === "GUESS" ? "border-omr bg-omr text-white" : "border-green bg-green text-white dark:text-paper") : s.mode === "SKIP" ? "border-line-strong bg-paper text-muted line-through" : "border-line-strong bg-surface text-ink-2";
              return (
                <li key={x.qid}>
                  <button
                    type="button"
                    onClick={() => go(k)}
                    aria-current={k === i ? "step" : undefined}
                    aria-label={`প্রশ্ন ${bn(k + 1)}${s.selected != null ? (s.mode === "GUESS" ? ", Guess" : ", উত্তর দেওয়া") : s.mode === "SKIP" ? ", Skip" : ", উত্তর বাকি"}${s.marked ? ", চিহ্নিত" : ""}`}
                    className={`relative grid h-9 w-full place-items-center rounded-md border text-[13px] tabular ${tone} ${k === i ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : ""}`}
                  >
                    {bn(k + 1)}
                    {s.marked && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-paper bg-omr" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted">সবুজ: Direct; কমলা: Guess; কাটা দাগ: Skip; বিন্দু: চিহ্নিত। কীবোর্ড: ১–৪ উত্তর, G = Guess, S = Skip, ← → প্রশ্ন বদল।</p>
          <button type="button" onClick={() => setConfirming(true)} className="mt-5 w-full rounded-lg border-2 border-green px-4 py-2.5 font-semibold text-green hover:bg-green-wash">
            উত্তর জমা দিন
          </button>
        </aside>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h2 id="confirm-title" className="text-xl font-bold">উত্তর জমা দেবেন?</h2>
            <p className="mt-3 text-ink-2">
              {bn(answered)}টি প্রশ্নের উত্তর দিয়েছেন (Direct {bn(counts.d)}, Guess {bn(counts.g)})
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
