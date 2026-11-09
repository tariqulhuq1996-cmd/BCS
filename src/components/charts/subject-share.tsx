"use client";

import { useState } from "react";
import { bn, bnNum } from "@/lib/bn";
import type { ResearchData } from "@/lib/research/data";

const TAB_LABEL: Record<string, string> = { GENERAL_100: "১০০ নম্বরের পরীক্ষা", GENERAL_200: "২০০ নম্বরের পরীক্ষা", SPECIAL: "বিশেষ বিসিএস" };

/** বিষয়ভিত্তিক গড় প্রশ্ন (পরীক্ষাপ্রতি), তিন ধরনের পরীক্ষা আলাদা ট্যাবে। ২০০-ট্যাবে ৫১তম থেকে নতুন মানবণ্টনের দাগ। */
export function SubjectShare({ data, marks200 }: { data: ResearchData["subjectByType"]; marks200: Record<string, number> }) {
  const [tab, setTab] = useState(1);
  const [table, setTable] = useState(false);
  const cur = data[tab];
  const showMarks = cur.type === "GENERAL_200";
  const rows = [...cur.rows].sort((a, b) => b.perExam - a.perExam);
  const max = Math.max(...rows.map((r) => Math.max(r.perExam, showMarks ? marks200[r.code] ?? 0 : 0)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="পরীক্ষার ধরন">
        {data.map((d, i) => (
          <button
            key={d.type}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${i === tab ? "border-green bg-green text-white dark:text-paper" : "border-line text-ink-2 hover:border-green"}`}
          >
            {TAB_LABEL[d.type]} ({bn(d.examCount)}টি)
          </button>
        ))}
        <button onClick={() => setTable((t) => !t)} className="ml-auto text-sm text-green underline underline-offset-4">
          {table ? "চার্ট দেখুন" : "সারণি দেখুন"}
        </button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {cur.examNos.map((n) => bn(n)).join(", ")} বিসিএসের গড়
      </p>

      {table ? (
        <table className="mt-3 w-full max-w-2xl text-left text-[15px] tabular">
          <thead className="text-sm text-muted">
            <tr className="border-b border-line">
              <th className="py-2 font-medium">বিষয়</th>
              <th className="py-2 text-right font-medium">প্রশ্ন / পরীক্ষা</th>
              <th className="py-2 text-right font-medium">অংশ</th>
              {showMarks && <th className="py-2 text-right font-medium">৫১তম থেকে নম্বর</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-line">
                <td className="py-2">{r.nameBn}</td>
                <td className="py-2 text-right">{bnNum(r.perExam, 1)}</td>
                <td className="py-2 text-right">{bnNum(r.share, 1)}%</td>
                {showMarks && <td className="py-2 text-right">{bn(marks200[r.code])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="mt-3 grid gap-2.5" aria-label={`${TAB_LABEL[cur.type]}: বিষয়ভিত্তিক গড় প্রশ্ন`}>
          {rows.map((r) => (
            <li key={r.code} className="group grid grid-cols-[minmax(7.5rem,13rem)_1fr] items-center gap-3 sm:grid-cols-[15rem_1fr]">
              <span className="text-[15px] leading-snug">{r.nameBn}</span>
              <span className="relative flex h-7 items-center">
                <span
                  className="h-full rounded-r-[4px] bg-green transition-[width] duration-500 group-hover:bg-green-strong"
                  style={{ width: `${(r.perExam / max) * 100}%`, minWidth: 2 }}
                />
                {showMarks && marks200[r.code] != null && (
                  <span
                    className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded bg-omr"
                    style={{ left: `calc(${(marks200[r.code] / max) * 100}% - 1.5px)` }}
                    title={`৫১তম থেকে নির্ধারিত: ${bn(marks200[r.code])} নম্বর`}
                  />
                )}
                <span className="ml-2 whitespace-nowrap text-sm tabular text-ink-2">
                  {bnNum(r.perExam, 1)}টি
                  <span className="hidden text-muted group-hover:inline"> (মোটের {bnNum(r.share, 1)}%)</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showMarks && !table && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-4 w-[3px] rounded bg-omr" aria-hidden="true" />
          ৫১তম বিসিএস থেকে প্রতিটি বিষয়ের নির্ধারিত নম্বর (২০০-এর মধ্যে)
        </p>
      )}
    </div>
  );
}
