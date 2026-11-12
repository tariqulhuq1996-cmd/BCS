import { bn, bnNum } from "@/lib/bn";

type Props = { exams: number; specialExams: number; subtopics: number; gradeCounts: { grade: string; n: number }[] };

/** তিনটি Level — এগুলো সত্যিই ক্রমিক, তাই নম্বরযুক্ত। প্রতিটির পাশের বৃত্ত: প্রথমটি খোলা, বাকি তালাবন্ধ। */
export function RoadmapPreview({ exams, specialExams, subtopics, gradeCounts }: Props) {
  const levels = [
    {
      n: 1,
      name: "বিগত BCS-এর প্রশ্ন আয়ত্ত",
      body: `১০ম থেকে ৫০তম — ${bn(exams)}টি প্রশ্নপত্র (${bn(specialExams)}টি বিশেষ BCS-সহ) একটির পর একটি। প্রতিটিতে সমাধান, উত্তর পর্যালোচনা, ভুলের Revision, Mastery Test, আর আগের সব পরীক্ষা মিলিয়ে Cumulative Test।`,
      gate: "প্রতিটি ধাপে ৮০% পেলে পরের BCS খোলে; শেষে Level ১ Final Assessment।",
    },
    {
      n: 2,
      name: "৯,০০০+ টপিকভিত্তিক প্রশ্ন আয়ত্ত",
      body: `${bn(subtopics)}টি উপবিষয়, ৫২তম Priority List-এর ক্রমে: আগে A (${bn(gradeCounts[0]?.n ?? 0)}টি), তারপর B, C, D। প্রতিটি উপবিষয়ে পরিচিতি, অনুশীলন, ভুলের Revision ও Mastery Test; ভুল প্রশ্ন নির্দিষ্ট দিন পরপর ফিরে আসে।`,
      gate: "প্রতিটি Priority ধাপ শেষে Checkpoint; শেষে Level ২ Final Assessment।",
    },
    {
      n: 3,
      name: "পূর্ণাঙ্গ Model Test",
      body: `২০০ নম্বরের ${bnNum(150)}টি Model Test, ১২০ মিনিট, ভুলে ০.৫ নম্বর কাটা। তিন স্তরে কঠিনতা বাড়ে; প্রতিটির পর বিষয়ভিত্তিক বিশ্লেষণ ও আগের পরীক্ষার সঙ্গে তুলনা।`,
      gate: "শেষে আপনার প্রস্তুতির পূর্ণ প্রতিবেদন।",
    },
  ];

  return (
    <ol className="relative grid gap-0">
      {levels.map((l, i) => (
        <li key={l.n} className="relative grid grid-cols-[3rem_1fr] gap-4 pb-10 last:pb-0">
          {i < levels.length - 1 && <span className="absolute left-6 top-12 bottom-0 w-px bg-line-strong" aria-hidden="true" />}
          <span
            className={`relative z-10 grid size-12 place-items-center rounded-full border-2 font-display text-xl font-bold ${i === 0 ? "border-green bg-green text-white dark:text-paper" : "border-omr bg-surface text-omr"}`}
            aria-hidden="true"
          >
            {bn(l.n)}
          </span>
          <div className="pt-1.5">
            <h3 className="text-xl font-bold sm:text-2xl">
              Level {bn(l.n)}: {l.name}
            </h3>
            <p className="mt-2 max-w-3xl text-ink-2">{l.body}</p>
            <p className="mt-2 text-sm text-muted">{l.gate}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
