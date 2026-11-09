"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bn, bnNum, bnOrdinal } from "@/lib/bn";

type Point = { bcsNo: number; shares: Record<string, number>; counts: Record<string, number>; total: number; partial: boolean };

/** একটি বিষয়ের অংশ (%) সব সাধারণ বিসিএসে — গুরুত্ব কখন বেড়েছে/কমেছে। */
export function SubjectTimeline({ points, subjects }: { points: Point[]; subjects: { code: string; nameBn: string }[] }) {
  const [code, setCode] = useState(subjects[2]?.code ?? subjects[0].code);
  const data = useMemo(() => points.map((p) => ({ x: p.bcsNo, v: p.shares[code] ?? 0, c: p.counts[code] ?? 0, t: p.total, partial: p.partial })), [points, code]);
  const partials = points.filter((p) => p.partial).map((p) => bnOrdinal(p.bcsNo));
  const first200 = points.find((p) => p.total >= 150)?.bcsNo;
  const subjectName = subjects.find((s) => s.code === code)?.nameBn;

  return (
    <div>
      <label className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        বিষয় বাছাই করুন
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-[15px] text-ink"
        >
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.nameBn}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 h-72 w-full" role="img" aria-label={`${subjectName}: প্রতিটি সাধারণ বিসিএসে প্রশ্নের অংশ`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            {first200 && (
              <ReferenceArea
                x1={first200}
                x2={data.at(-1)!.x}
                fill="var(--green-wash)"
                fillOpacity={0.6}
                ifOverflow="extendDomain"
                label={{ value: "২০০ নম্বরের যুগ", position: "insideTopLeft", fill: "var(--muted)", fontSize: 12 }}
              />
            )}
            <XAxis dataKey="x" tickFormatter={(v) => bn(v)} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tickFormatter={(v) => `${bn(v)}%`} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--line)", fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-sm">
                    <p className="font-semibold">{bnOrdinal(d.x)} বিসিএস</p>
                    <p className="text-ink-2">
                      {bn(d.t)}টির মধ্যে {bn(d.c)}টি প্রশ্ন ({bnNum(d.v, 1)}%)
                    </p>
                    {d.partial && <p className="text-xs text-danger">আংশিক প্রশ্নপত্র — তুলনায় সাবধান</p>}
                  </div>
                );
              }}
            />
            <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.x} fill={d.partial ? "var(--before)" : "var(--green)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {partials.length > 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <span className="inline-block size-3 rounded-[3px] bg-[var(--before)]" aria-hidden="true" />
          ধূসর: আংশিক প্রশ্নপত্র ({partials.join(", ")} বিসিএস) — ডেটাসেটে সব প্রশ্ন নেই
        </p>
      )}
    </div>
  );
}
