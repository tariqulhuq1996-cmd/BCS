"use client";

import { useState } from "react";
import { Heatmap } from "@/components/charts/heatmap";
import { bn } from "@/lib/bn";

type Row = { code: string; nameBn: string; subjectCode: string; grade: string | null; counts: number[] };

/** সব উপবিষয়ের Heatmap, বিষয় অনুযায়ী ভাগ করে (একসঙ্গে ২৬৮ সারি পড়া কঠিন)। */
export function HeatmapExplorer({ rows, exams, subjects }: { rows: Row[]; exams: number[]; subjects: { code: string; nameBn: string }[] }) {
  const [subj, setSubj] = useState(subjects[0].code);
  const shown = rows.filter((r) => r.subjectCode === subj);
  const name = subjects.find((s) => s.code === subj)?.nameBn;
  return (
    <div>
      <label className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        বিষয়
        <select value={subj} onChange={(e) => setSubj(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[15px] text-ink">
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>{s.nameBn} ({bn(rows.filter((r) => r.subjectCode === s.code).length)})</option>
          ))}
        </select>
      </label>
      <div className="mt-4">
        <Heatmap rows={shown} exams={exams} caption={`${name}: প্রতিটি উপবিষয়ে প্রতিটি সাধারণ বিসিএসের প্রশ্নসংখ্যা`} />
      </div>
    </div>
  );
}
