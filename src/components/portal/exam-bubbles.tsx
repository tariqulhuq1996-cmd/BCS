"use client";

import Link from "next/link";
import { useState } from "react";
import { bn, bnOrdinal } from "@/lib/bn";
import { LOCKED_MESSAGE } from "@/lib/progress/cycle";

type Item = { key: string; bcsNo?: number; title: string; state: string; href: string; special?: boolean; partial?: boolean; bestScore: number | null };

const STATE_BN: Record<string, string> = { COMPLETED: "সম্পন্ন", IN_PROGRESS: "চলছে", AVAILABLE: "খোলা", LOCKED: "তালাবন্ধ" };

/**
 * Level 1-এর রাস্তা: প্রতিটি বিসিএস একটি OMR-বৃত্ত।
 * ভরাট সবুজ = সম্পন্ন, গোলাপি বৃত্ত = খোলা/চলছে, ড্যাশ-রেখা = তালাবন্ধ। বিশেষ বিসিএসের নিচে ছোট বিন্দু।
 */
export function ExamBubbles({ items }: { items: Item[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <ol className="flex flex-wrap gap-x-2 gap-y-3" aria-label="Level ১: ১০ম থেকে ৫০তম বিসিএস">
        {items.map((it) => {
          const label = it.bcsNo ? bn(it.bcsNo) : "শেষ";
          const name = it.bcsNo ? `${bnOrdinal(it.bcsNo)} বিসিএস${it.special ? " (বিশেষ)" : ""}` : it.title;
          const aria = `${name}: ${STATE_BN[it.state]}${it.bestScore != null ? `, সেরা ${bn(Math.round(it.bestScore))}%` : ""}`;
          const cls = {
            COMPLETED: "border-green bg-green text-white dark:text-paper",
            IN_PROGRESS: "border-omr bg-omr-wash text-omr ring-4 ring-omr/20",
            AVAILABLE: "border-omr bg-surface text-omr ring-4 ring-omr/20",
            LOCKED: "border-dashed border-line-strong bg-transparent text-muted",
          }[it.state];
          const bubble = (
            <span className={`grid size-10 place-items-center rounded-full border-2 text-[13px] font-semibold tabular ${cls}`}>{label}</span>
          );
          return (
            <li key={it.key} className="flex flex-col items-center gap-1">
              {it.state === "LOCKED" ? (
                <button type="button" aria-label={aria} title={aria} onClick={() => setMsg(`${name} — ${LOCKED_MESSAGE}`)}>
                  {bubble}
                </button>
              ) : (
                <Link href={it.href} aria-label={aria} title={aria}>
                  {bubble}
                </Link>
              )}
              <span className={`size-1.5 rounded-full ${it.special ? "bg-omr" : "bg-transparent"}`} aria-hidden="true" />
            </li>
          );
        })}
      </ol>
      <p className="mt-3 min-h-6 text-sm text-ink-2" role="status">
        {msg ?? (
          <span className="flex flex-wrap gap-x-5 gap-y-1 text-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-green" />সম্পন্ন</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-omr" />খোলা</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-dashed border-line-strong" />তালাবন্ধ</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-omr" />বিশেষ বিসিএস</span>
          </span>
        )}
      </p>
    </div>
  );
}
