"use client";

import { useState } from "react";
import { bn, bnOrdinal } from "@/lib/bn";
import { GradeBadge } from "@/components/ui/grade";

type Row = { code: string; nameBn: string; grade: string | null; counts: number[] };

const level = (n: number) => (n <= 0 ? 0 : n >= 5 ? 5 : n);
const LEGEND = ["০", "১", "২", "৩", "৪", "৫+"];

/** উপবিষয় × সাধারণ বিসিএস: কোন পরীক্ষায় কতটি প্রশ্ন। একটিমাত্র রঙের ধাপ (কম → হালকা, বেশি → গাঢ়)। */
export function Heatmap({ rows, exams, caption }: { rows: Row[]; exams: number[]; caption: string }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const h = hover ? { row: rows[hover.r], exam: exams[hover.c], n: rows[hover.r].counts[hover.c] } : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-6 text-sm text-ink-2" aria-live="polite">
          {h ? (
            <>
              <span className="font-semibold text-ink">{h.row.nameBn}</span> — {bnOrdinal(h.exam)} বিসিএসে {bn(h.n)}টি প্রশ্ন
            </>
          ) : (
            "ঘরের ওপর মাউস রাখুন বা ট্যাপ করুন"
          )}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted" aria-label="রঙের মান">
          প্রশ্নসংখ্যা
          {LEGEND.map((l, i) => (
            <span key={l} className="flex flex-col items-center">
              <span className="size-4 rounded-[3px]" style={{ background: `var(--heat-${i})` }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface" onMouseLeave={() => setHover(null)}>
        <table className="border-separate border-spacing-[2px] text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface px-2 text-left font-medium text-muted">উপবিষয়</th>
              {exams.map((e, c) => (
                <th key={e} scope="col" className={`w-6 min-w-6 text-center font-normal tabular ${hover?.c === c ? "text-ink" : "text-muted"}`}>
                  {bn(e)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.code}>
                <th scope="row" className={`sticky left-0 z-10 max-w-[11rem] truncate bg-surface px-2 py-0.5 text-left text-[13px] font-normal sm:max-w-[16rem] ${hover?.r === r ? "text-ink" : "text-ink-2"}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <GradeBadge grade={row.grade} />
                    <span className="truncate" title={row.nameBn}>{row.nameBn}</span>
                  </span>
                </th>
                {row.counts.map((n, c) => (
                  <td
                    key={c}
                    tabIndex={-1}
                    onMouseEnter={() => setHover({ r, c })}
                    onClick={() => setHover({ r, c })}
                    className={`size-6 rounded-[3px] ${hover?.r === r && hover?.c === c ? "outline-2 outline-ink" : ""}`}
                    style={{ background: `var(--heat-${level(n)})` }}
                    aria-label={`${row.nameBn}, ${bnOrdinal(exams[c])}: ${bn(n)}টি`}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
