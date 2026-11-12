"use client";

import Link from "next/link";
import { useState } from "react";
import { bn, bnOrdinal } from "@/lib/bn";
import { GradeBadge } from "@/components/ui/grade";

type Row = { code: string; nameBn: string; grade: string | null; counts: number[] };

const level = (n: number) => (n <= 0 ? 0 : n >= 5 ? 5 : n);
const LEGEND = ["০", "১", "২", "৩", "৪", "৫+"];
/** শুরুতে শুধু ২০০ নম্বরের যুগ (৩৫তম–৫০তম); বাকিগুলো চাইলে দেখা যায় */
export const HEAT_DEFAULT_FROM = 35;

/**
 * উপবিষয় × সাধারণ বিসিএস: কোন পরীক্ষায় কতটি প্রশ্ন। একটিমাত্র রঙের ধাপ (কম → হালকা, বেশি → গাঢ়)।
 * উপবিষয়ের পুরো নাম দেখায় (প্রয়োজনে একাধিক লাইনে)। শুরুতে ৩৫তম–৫০তম; "সব বিসিএস" লগইন করা থাকলে খোলে,
 * নইলে লগইন-পাতায় নিয়ে যায় (loginHref)।
 */
export function Heatmap({
  rows,
  exams,
  caption,
  canShowAll = true,
  loginHref = "/login",
}: {
  rows: Row[];
  exams: number[];
  caption: string;
  canShowAll?: boolean;
  loginHref?: string;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [all, setAll] = useState(false);
  // দেখানো কলামগুলোর মূল সূচক
  const cols = exams.map((e, i) => ({ e, i })).filter(({ e }) => all || e >= HEAT_DEFAULT_FROM);
  const hidden = exams.length - cols.length;
  const h = hover ? { row: rows[hover.r], exam: cols[hover.c].e, n: rows[hover.r].counts[cols[hover.c].i] } : null;
  const first = exams[0];
  const last = exams[exams.length - 1];

  const toggle = all ? (
    <button type="button" onClick={() => { setAll(false); setHover(null); }} className="text-sm font-semibold text-green underline underline-offset-4">
      শুধু {bnOrdinal(HEAT_DEFAULT_FROM)}–{bnOrdinal(last)} বিসিএস দেখুন
    </button>
  ) : hidden > 0 ? (
    canShowAll ? (
      <button type="button" onClick={() => { setAll(true); setHover(null); }} className="text-sm font-semibold text-green underline underline-offset-4">
        সব বিসিএস দেখুন ({bnOrdinal(first)}–{bnOrdinal(last)})
      </button>
    ) : (
      <Link href={loginHref} className="text-sm font-semibold text-green underline underline-offset-4">
        সব বিসিএস ({bnOrdinal(first)}–{bnOrdinal(last)}) দেখতে লগইন করুন
      </Link>
    )
  ) : null;

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

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          দেখানো হচ্ছে: {bnOrdinal(cols[0]?.e ?? first)}–{bnOrdinal(last)} বিসিএস ({bn(cols.length)}টি সাধারণ বিসিএস)
        </span>
        {toggle}
      </div>

      <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface" onMouseLeave={() => setHover(null)}>
        <table className="border-separate border-spacing-[2px] text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface px-2 text-left font-medium text-muted">উপবিষয়</th>
              {cols.map(({ e }, c) => (
                <th key={e} scope="col" className={`w-6 min-w-6 text-center font-normal tabular ${hover?.c === c ? "text-ink" : "text-muted"}`}>
                  {bn(e)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.code}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 w-[11rem] min-w-[11rem] bg-surface px-2 py-1 text-left align-middle text-[13px] font-normal leading-snug sm:w-[22rem] sm:min-w-[22rem] ${hover?.r === r ? "text-ink" : "text-ink-2"}`}
                >
                  <span className="flex items-start gap-1.5">
                    <span className="shrink-0">
                      <GradeBadge grade={row.grade} />
                    </span>
                    <span className="whitespace-normal break-words">{row.nameBn}</span>
                  </span>
                </th>
                {cols.map(({ i }, c) => {
                  const n = row.counts[i];
                  return (
                    <td
                      key={i}
                      tabIndex={-1}
                      onMouseEnter={() => setHover({ r, c })}
                      onClick={() => setHover({ r, c })}
                      className={`size-6 min-w-6 rounded-[3px] ${hover?.r === r && hover?.c === c ? "outline-2 outline-ink" : ""}`}
                      style={{ background: `var(--heat-${level(n)})` }}
                      aria-label={`${row.nameBn}, ${bnOrdinal(exams[i])}: ${bn(n)}টি`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
