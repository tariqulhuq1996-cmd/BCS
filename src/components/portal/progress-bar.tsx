import { bnNum } from "@/lib/bn";

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${bnNum(v, 0)}%`} className="h-2.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-green" style={{ width: `${v}%`, minWidth: v > 0 ? 6 : 0 }} />
    </div>
  );
}
