"use client";

import { useState } from "react";
import { bnOrdinal } from "@/lib/bn";

const LETTERS = ["ক", "খ", "গ", "ঘ"];

type Props = {
  text: string;
  options: string[];
  correctIndex: number;
  examNos: number[];
  explanation: string | null;
  explanationVerified: boolean;
};

/** হিরো: গবেষণায় সবচেয়ে বেশিবার ফিরে আসা প্রশ্ন, OMR উত্তরপত্রের মতো বৃত্ত ভরাট করে উত্তর দেওয়া যায়। */
export function OmrQuestion({ text, options, correctIndex, examNos, explanation, explanationVerified }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const right = picked === correctIndex;
  const examsText = examNos.map(bnOrdinal).join(", ").replace(/, ([^,]*)$/, " ও $1");

  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6 shadow-[0_1px_0_var(--line)]">
      <p className="text-sm text-muted">
        এই প্রশ্নটি এসেছে {examsText} BCS-এ। উত্তর দিয়ে দেখুন।
      </p>
      <p className="mt-3 text-lg font-semibold leading-relaxed text-ink">{text}</p>
      <fieldset className="mt-4" disabled={done}>
        <legend className="sr-only">উত্তর বাছাই করুন</legend>
        <ul className="grid gap-2">
          {options.map((o, i) => {
            const isCorrect = done && i === correctIndex;
            const isWrongPick = done && i === picked && !right;
            return (
              <li key={i}>
                <label
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isCorrect ? "border-green bg-green-wash" : isWrongPick ? "border-danger bg-danger-wash" : "border-line hover:border-omr",
                    done ? "cursor-default" : "",
                  ].join(" ")}
                >
                  <input type="radio" name="hero-q" className="peer sr-only" checked={picked === i} onChange={() => setPicked(i)} />
                  <span
                    aria-hidden="true"
                    className={[
                      "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-green",
                      isCorrect ? "border-green bg-green text-white dark:text-paper" : isWrongPick ? "border-danger bg-danger text-white" : "border-omr text-omr",
                    ].join(" ")}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="text-[15px]">{o}</span>
                  {isCorrect && <span className="ml-auto text-sm font-semibold text-green">সঠিক উত্তর</span>}
                  {isWrongPick && <span className="ml-auto text-sm font-semibold text-danger">আপনার উত্তর</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div aria-live="polite">
        {done && (
          <div className="mt-4 border-t border-line pt-4 text-[15px] text-ink-2">
            <p className="font-semibold text-ink">{right ? "ঠিক হয়েছে।" : `সঠিক উত্তর: ${LETTERS[correctIndex]}) ${options[correctIndex]}`}</p>
            {explanation && (
              <p className="mt-1">
                {explanation}
                {!explanationVerified && <span className="ml-1 text-xs text-muted">(ব্যাখ্যা যাচাই চলছে)</span>}
              </p>
            )}
            <button type="button" onClick={() => setPicked(null)} className="mt-3 text-sm text-green underline underline-offset-4">
              আবার চেষ্টা করুন
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
