import { bn, bnNum } from "@/lib/bn";
import type { Avg, SubjectStatus } from "@/lib/exam/performance";

/** null মানে "তথ্য নেই" — কখনো শূন্য নয়। */
export const fmt = (x: number | null | undefined, d = 1, unit = "") => (x == null ? "—" : `${bnNum(x, d)}${unit}`);
export const signed = (x: number, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${bnNum(Math.abs(x), d)}`;
export const bnDate = (iso: string) =>
  bn(new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Dhaka" }));

/** গড়ের ধরন ও কতটি পরীক্ষা থেকে — প্রতিটি গড়ের নিচে ছোট লেখায়। */
export function avgNote(a: Avg) {
  if (!a.n) return "তথ্য নেই";
  return a.kind === "per_exam" ? `${bn(a.n)}টি পরীক্ষার গড়` : `${bn(a.n)}টি পরীক্ষার সব প্রশ্ন মিলিয়ে`;
}

export function Card({ title, id, children, className = "", aside }: { title: string; id: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg font-bold">{title}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "green" | "danger" | "muted" }) {
  const c = tone === "green" ? "text-green" : tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "";
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3.5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 font-display text-[28px] font-bold leading-none tabular ${c}`}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

const STATUS: Record<SubjectStatus, { label: string; icon: string; cls: string }> = {
  strong: { label: "শক্তিশালী", icon: "✓", cls: "bg-green-wash text-green" },
  ok: { label: "মোটামুটি", icon: "•", cls: "bg-paper text-ink-2" },
  weak: { label: "দুর্বল", icon: "!", cls: "bg-danger-wash text-danger" },
  nodata: { label: "তথ্য নেই", icon: "–", cls: "bg-paper text-muted" },
};
/** রঙের সঙ্গে চিহ্ন ও লেখা — শুধু রঙের ওপর নির্ভর নয়। */
export function StatusChip({ s }: { s: SubjectStatus }) {
  const x = STATUS[s];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${x.cls}`}>
      <span aria-hidden="true">{x.icon}</span>
      {x.label}
    </span>
  );
}

/** অনুভূমিক মিটার: role="progressbar" + লেখায় মান। */
export function Meter({ pct, label, valueText, tone = "green", thick = false }: { pct: number | null; label: string; valueText: string; tone?: "green" | "omr" | "danger"; thick?: boolean }) {
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const bg = tone === "danger" ? "bg-danger" : tone === "omr" ? "bg-omr" : "bg-green";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct == null ? undefined : Math.round(v)} aria-valuetext={valueText} className={`${thick ? "h-4" : "h-2"} w-full overflow-hidden rounded-full bg-line`}>
      {pct != null && <div className={`h-full rounded-full ${bg}`} style={{ width: `${v}%`, minWidth: v > 0 ? 6 : 0 }} />}
    </div>
  );
}

export function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong bg-paper px-3 py-2.5 text-[15px] text-ink-2">
      <span className="font-semibold">তথ্য নেই — </span>
      {children}
    </p>
  );
}

type Pt = { i: number; label: string; y: number | null };
/**
 * সার্ভারে আঁকা SVG লাইন-চার্ট। role="img" + বর্ণনামূলক aria-label; প্রতিটি বিন্দুর মান লেখার টেবিলে (details) পাওয়া যায়,
 * তাই কীবোর্ড ও স্ক্রিন-রিডার ব্যবহারকারী চার্ট না দেখেও সব সংখ্যা পান। সর্বশেষ বিন্দু বড় ও লেবেলযুক্ত।
 */
type ChartProps = {
  points: Pt[]; min: number; max: number; ariaLabel: string; unit?: string; target?: number | null; targetLabel?: string; dashed?: boolean; decimals?: number; width?: number;
};
/** ফোনে সরু (৩৬০) আর বড় পর্দায় চওড়া চার্ট — যাতে লেখা ছোট না হয়ে যায়। */
export function LineChart(props: ChartProps) {
  return (
    <>
      <div className="sm:hidden"><ChartSvg {...props} width={360} /></div>
      <div className="hidden sm:block"><ChartSvg {...props} /></div>
    </>
  );
}

function ChartSvg({ points, min, max, ariaLabel, unit = "", target, targetLabel, dashed = false, decimals = 1, width = 640 }: ChartProps) {
  const W = width, H = 200, L = 40, R = 16, T = 34, B = 26;
  const xs = (i: number) => (points.length <= 1 ? L + (W - L - R) / 2 : L + ((i - points[0].i) / (points.at(-1)!.i - points[0].i)) * (W - L - R));
  const ys = (v: number) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  const valid = points.filter((p) => p.y != null) as { i: number; label: string; y: number }[];
  const path = valid.map((p, k) => `${k ? "L" : "M"}${xs(p.i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(" ");
  // গোল সংখ্যায় দাগ (যেমন ৬০, ৭০, ৮০ …)
  const raw = (max - min) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const stepV = ([1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  const ticks: number[] = [];
  for (let v = Math.ceil(min / stepV) * stepV; v <= max + 1e-9; v += stepV) ticks.push(v);
  const last = valid.at(-1);
  const step = Math.max(1, Math.ceil(points.length / 10));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={L - 6} y={ys(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{bn(Math.round(t))}</text>
        </g>
      ))}
      {target != null && target >= min && target <= max && (
        <g>
          <line x1={L} x2={W - R} y1={ys(target)} y2={ys(target)} stroke="var(--omr)" strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={L + 4} y={ys(target) - 5} textAnchor="start" fontSize={11} fill="var(--omr)">{targetLabel}</text>
        </g>
      )}
      {points.map((p, k) => (k % step === 0 || k === points.length - 1) && (
        <text key={p.i} x={xs(p.i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{p.label}</text>
      ))}
      <path d={path} fill="none" stroke="var(--green)" strokeWidth={2.25} strokeDasharray={dashed ? "5 4" : undefined} strokeLinejoin="round" />
      {valid.map((p) => (
        <g key={p.i}>
          {dashed
            ? <rect x={xs(p.i) - 3.5} y={ys(p.y) - 3.5} width={7} height={7} fill="var(--surface)" stroke="var(--green)" strokeWidth={2} />
            : <circle cx={xs(p.i)} cy={ys(p.y)} r={p === last ? 6 : 3.5} fill={p === last ? "var(--green)" : "var(--surface)"} stroke="var(--green)" strokeWidth={2} />}
          <title>{`${p.label}: ${bnNum(p.y, decimals)}${unit}`}</title>
        </g>
      ))}
      {last && (
        <g>
          <rect x={Math.min(xs(last.i) - 26, W - R - 56)} y={ys(last.y) - 30} width={56} height={20} rx={4} fill="var(--green)" />
          <text x={Math.min(xs(last.i), W - R - 28)} y={ys(last.y) - 16} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--surface)">{bnNum(last.y, decimals)}{unit}</text>
        </g>
      )}
    </svg>
  );
}
