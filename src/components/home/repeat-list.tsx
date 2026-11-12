import { bn, bnOrdinal } from "@/lib/bn";
import { GradeBadge } from "@/components/ui/grade";
import type { ResearchData } from "@/lib/research/data";

const LETTERS = ["ক", "খ", "গ", "ঘ"];

/** পুনরাবৃত্ত প্রশ্ন-পরিবার: প্রশ্ন, সঠিক উত্তর, কোন কোন BCS-এ এসেছে। */
export function RepeatList({ families }: { families: ResearchData["families"] }) {
  return (
    <ol className="divide-y divide-line border-y border-line">
      {families.map((f) => (
        <li key={f.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-6">
          <div>
            <p className="text-[16px] font-medium leading-relaxed">{f.text}</p>
            {f.correctIndex != null ? (
              <p className="mt-1 text-[15px] text-ink-2">
                উত্তর: <span className="font-semibold text-green">{LETTERS[f.correctIndex]}) {f.options[f.correctIndex]}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">অপশন: {f.options.join(" / ")}</p>
            )}
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <GradeBadge grade={f.grade} /> {f.subtopicBn} ({f.matchType})
            </p>
          </div>
          <div className="flex flex-wrap content-start gap-1.5 sm:max-w-[14rem] sm:justify-end" aria-label={`${bn(f.occurrences)}টি পরীক্ষায় এসেছে`}>
            {f.examNos.map((n) => (
              <span key={n} className="rounded-full border border-omr px-2 py-0.5 text-xs tabular text-omr">
                {bnOrdinal(n)}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
