"use client";

import { useMemo, useState } from "react";
import { bn, bnNum } from "@/lib/bn";
import { GradeBadge } from "@/components/ui/grade";
import type { ResearchData } from "@/lib/research/data";

type Row = ResearchData["subtopics"][number];
type SortKey = "score" | "histTotal" | "recentCount";

/** পূর্ণ ৫২তম Priority List: খোঁজা, বিষয়/শ্রেণি অনুযায়ী ছাঁকা, কলাম অনুযায়ী সাজানো। */
export function SubtopicTable({ rows, subjects }: { rows: Row[]; subjects: { code: string; nameBn: string }[] }) {
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("ALL");
  const [grade, setGrade] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("score");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (subj === "ALL" || r.subjectCode === subj) && (grade === "ALL" || r.grade === grade))
      .filter((r) => !needle || `${r.nameBn} ${r.topicBn} ${r.code}`.toLowerCase().includes(needle))
      .sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  }, [rows, q, subj, grade, sort]);

  const th = (k: SortKey, label: string) => (
    <th scope="col" className="px-2 py-2 text-right font-medium" aria-sort={sort === k ? "descending" : "none"}>
      <button onClick={() => setSort(k)} className={sort === k ? "text-ink underline underline-offset-4" : "hover:text-ink"}>
        {label}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="উপবিষয় বা টপিক খুঁজুন"
          aria-label="উপবিষয় খুঁজুন"
          className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-[15px]"
        />
        <select value={subj} onChange={(e) => setSubj(e.target.value)} aria-label="বিষয়" className="rounded-md border border-line bg-surface px-3 py-2 text-[15px]">
          <option value="ALL">সব বিষয়</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>{s.nameBn}</option>
          ))}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Priority শ্রেণি" className="rounded-md border border-line bg-surface px-3 py-2 text-[15px]">
          <option value="ALL">সব শ্রেণি</option>
          {["A", "B", "C", "D"].map((g) => (
            <option key={g} value={g}>Priority {g}</option>
          ))}
        </select>
        <span className="text-sm text-muted" aria-live="polite">{bn(list.length)}টি উপবিষয়</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left text-[15px] tabular">
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">উপবিষয়</th>
              {th("score", "Score")}
              {th("histTotal", "মোট প্রশ্ন")}
              <th scope="col" className="px-2 py-2 text-right font-medium">উপস্থিতি</th>
              {th("recentCount", "৪০–৫০তম")}
              <th scope="col" className="px-3 py-2 font-medium">প্রবণতা</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <FragmentRow key={r.code} r={r} open={open === r.code} onToggle={() => setOpen(open === r.code ? null : r.code)} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        উপস্থিতি: সিলেবাস-যুগের পূর্ণ সাধারণ পরীক্ষার কতটিতে এসেছে, এবং ২০০ নম্বরের ১২টি পরীক্ষার কতটিতে। সারিতে চাপ দিলে কারণ ও পরামর্শ দেখাবে।
      </p>
    </div>
  );
}

function FragmentRow({ r, open, onToggle }: { r: Row; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="cursor-pointer border-b border-line hover:bg-paper" onClick={onToggle}>
        <td className="px-3 py-2">
          <button aria-expanded={open} className="flex items-start gap-2 text-left" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            <GradeBadge grade={r.grade} />
            <span className="leading-snug">
              {r.nameBn}
              <span className="block text-xs text-muted">{r.subjectBn} › {r.topicBn}</span>
            </span>
          </button>
        </td>
        <td className="px-2 py-2 text-right">{r.score != null ? bnNum(r.score, 1) : "—"}</td>
        <td className="px-2 py-2 text-right">{r.histTotal != null ? bn(r.histTotal) : "—"}</td>
        <td className="px-2 py-2 text-right text-ink-2">
          {r.presenceAll ? bn(r.presenceAll) : "—"}
          <span className="block text-xs text-muted">২০০ নম্বরে {r.presence200 ? bn(r.presence200) : "—"}</span>
        </td>
        <td className="px-2 py-2 text-right">{r.recentCount != null ? bn(r.recentCount) : "—"}</td>
        <td className="px-3 py-2 text-ink-2">{r.trend ?? "—"}</td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-paper">
          <td colSpan={6} className="px-4 py-3 text-sm text-ink-2">
            {r.whyBn && <p><span className="font-semibold text-ink">কেন এই অগ্রাধিকার:</span> {r.whyBn}</p>}
            {r.tipBn && <p className="mt-1"><span className="font-semibold text-ink">পরামর্শ:</span> {r.tipBn}</p>}
            {!r.whyBn && !r.tipBn && <p>এই উপবিষয়ে বিগত বিসিএসে প্রশ্ন আসেনি।</p>}
          </td>
        </tr>
      )}
    </>
  );
}
