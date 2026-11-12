"use client";

import { useState } from "react";
import { bn, bnNum } from "@/lib/bn";
import { GradeBadge } from "@/components/ui/grade";
import type { ResearchData } from "@/lib/research/data";

/** টপিক-স্তরের ৫২তম Priority Score (ধাপ ০৯), বিষয় অনুযায়ী ছাঁকা যায়। */
export function TopicRanking({ topics, subjects }: { topics: ResearchData["topics"]; subjects: { code: string; nameBn: string }[] }) {
  const [subj, setSubj] = useState<string>("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const rows = (subj === "ALL" ? topics.slice(0, 15) : topics.filter((t) => t.subjectCode === subj)).filter((t) => t.score != null);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="বিষয় অনুযায়ী ছাঁকুন">
        {[{ code: "ALL", nameBn: "সব বিষয় (শীর্ষ ১৫)" }, ...subjects].map((s) => (
          <button
            key={s.code}
            aria-pressed={subj === s.code}
            onClick={() => setSubj(s.code)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${subj === s.code ? "border-green bg-green text-white dark:text-paper" : "border-line text-ink-2 hover:border-green"}`}
          >
            {s.nameBn}
          </button>
        ))}
      </div>

      <ol className="mt-6 grid gap-1">
        {rows.map((t, i) => {
          const isOpen = open === t.code;
          const delta = t.recentPerExam - t.prevPerExam;
          return (
            <li key={t.code}>
              <button
                onClick={() => setOpen(isOpen ? null : t.code)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[1.75rem_1fr] items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left hover:bg-surface sm:grid-cols-[1.75rem_minmax(12rem,20rem)_1fr]"
              >
                <span className="text-sm tabular text-muted">{bn(i + 1)}</span>
                <span className="flex items-center gap-2 text-[15px] leading-snug">
                  <GradeBadge grade={t.grade} />
                  {t.nameBn}
                  {subj === "ALL" && <span className="hidden text-xs text-muted lg:inline">{t.subjectBn}</span>}
                </span>
                <span className="col-start-2 flex items-center sm:col-start-3">
                  <span className="h-3 rounded-r-[4px] bg-green" style={{ width: `${t.score!}%` }} />
                  <span className="ml-2 text-sm tabular text-ink-2">{bnNum(t.score!, 1)}</span>
                </span>
              </button>
              {isOpen && (
                <div className="mb-2 ml-12 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink-2">
                  সাধারণ BCS-এ মোট {bn(t.totalGeneral)}টি প্রশ্ন। পরীক্ষাপ্রতি গড়: আগের পর্বে {bnNum(t.prevPerExam, 1)}টি, সাম্প্রতিক পর্বে{" "}
                  {bnNum(t.recentPerExam, 1)}টি ({delta >= 0 ? "বেড়েছে" : "কমেছে"} {bnNum(Math.abs(delta), 1)})।
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
