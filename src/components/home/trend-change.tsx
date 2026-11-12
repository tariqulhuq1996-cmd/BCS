import { bn, bnNum } from "@/lib/bn";
import type { ResearchData } from "@/lib/research/data";

/** ডাম্বেল: টপিকে পরীক্ষাপ্রতি গড় প্রশ্ন, আগের পর্ব বনাম সাম্প্রতিক পর্ব (৬টি করে সাধারণ বিসিএস)। ধূসর বিন্দু = আগে, সবুজ = এখন। */
export function TrendChange({ topics, periods, take = 7 }: { topics: ResearchData["topics"]; periods: ResearchData["periods"]; take?: number }) {
  const withDelta = topics.map((t) => ({ ...t, d: t.recentPerExam - t.prevPerExam }));
  const up = withDelta.filter((t) => t.d > 0).sort((a, b) => b.d - a.d).slice(0, take);
  const down = withDelta.filter((t) => t.d < 0).sort((a, b) => a.d - b.d).slice(0, take);
  const max = Math.ceil(Math.max(...[...up, ...down].flatMap((t) => [t.prevPerExam, t.recentPerExam])));
  const prevLabel = `${bn(periods.prev[0])}–${bn(periods.prev.at(-1)!)}তম`;
  const recentLabel = `${bn(periods.recent[0])}–${bn(periods.recent.at(-1)!)}তম`;

  return (
    <div>
      <div className="flex flex-wrap gap-5 text-sm text-ink-2" aria-label="চিহ্নের অর্থ">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full border-2 border-[var(--before)] bg-surface" /> {prevLabel} ({bn(periods.prev.length)}টি পরীক্ষা)
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-green" /> {recentLabel} ({bn(periods.recent.length)}টি পরীক্ষা)
        </span>
      </div>
      <div className="mt-5 grid gap-10 lg:grid-cols-2">
        <Group title="যেসব টপিকে প্রশ্ন বেড়েছে" rows={up} max={max} />
        <Group title="যেসব টপিকে প্রশ্ন কমেছে" rows={down} max={max} />
      </div>
    </div>
  );
}

function Group({ title, rows, max }: { title: string; rows: (ResearchData["topics"][number] & { d: number })[]; max: number }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <ul className="mt-3 grid gap-3">
        {rows.map((t) => {
          const a = (t.prevPerExam / max) * 100;
          const b = (t.recentPerExam / max) * 100;
          return (
            <li key={t.code} title={`${t.nameBn}: ${bnNum(t.prevPerExam, 1)} → ${bnNum(t.recentPerExam, 1)} প্রশ্ন/পরীক্ষা`}>
              <div className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="leading-snug">{t.nameBn}</span>
                <span className="whitespace-nowrap text-sm tabular text-ink-2">
                  {bnNum(t.prevPerExam, 1)} → <span className="font-semibold text-ink">{bnNum(t.recentPerExam, 1)}</span>
                </span>
              </div>
              <div className="relative mt-1.5 h-3">
                <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-line-strong" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} />
                <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--before)] bg-surface" style={{ left: `${a}%` }} />
                <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green ring-2 ring-surface" style={{ left: `${b}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">মান: পরীক্ষাপ্রতি গড় প্রশ্ন, ০ থেকে {bn(max)}</p>
    </div>
  );
}
