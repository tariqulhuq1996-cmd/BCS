import type { Metadata } from "next";
import Link from "next/link";
import { getResearch } from "@/lib/research/data";
import { bn, bnNum, bnOrdinal } from "@/lib/bn";
import { Section, SourceNote } from "@/components/ui/section";
import { SubtopicTable } from "@/components/research/subtopic-table";
import { HeatmapExplorer } from "@/components/research/heatmap-explorer";

export const metadata: Metadata = { title: "গবেষণা: ১০ম–৫০তম বিসিএস" };

const TYPE_BN = { GENERAL_100: "১০০ নম্বর", GENERAL_200: "২০০ নম্বর", SPECIAL: "বিশেষ" } as const;

export default async function ResearchPage() {
  const r = await getResearch();
  const special = r.subjectByType.find((s) => s.type === "SPECIAL")!;
  const g200 = r.subjectByType.find((s) => s.type === "GENERAL_200")!;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <h1 className="text-[36px] font-extrabold sm:text-[46px]" style={{ fontStretch: "112%" }}>
          ১০ম–৫০তম বিসিএস: পূর্ণ গবেষণা
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">
          {bn(r.totals.exams)}টি প্রিলিমিনারি পরীক্ষার {bnNum(r.totals.questions)}টি প্রশ্ন, {bn(r.totals.subtopics)}টি উপবিষয়ে ভাগ করা। নিচের প্রতিটি সারণি ও চার্ট
          সরাসরি এই প্রশ্নগুলো থেকে তৈরি।
        </p>
        <nav aria-label="এই পাতায়" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-green">
          <a href="#priority" className="underline underline-offset-4">Priority List</a>
          <a href="#heatmap" className="underline underline-offset-4">উপবিষয় × পরীক্ষা</a>
          <a href="#special" className="underline underline-offset-4">বিশেষ বিসিএস</a>
          <a href="#exams" className="underline underline-offset-4">পরীক্ষার তালিকা</a>
        </nav>
      </section>

      <Section id="priority" title="৫২তম বিসিএস Priority List" lead="সব উপবিষয়ের Priority Score (১০০-এর মধ্যে) ও A–D শ্রেণি, কারণ ও পড়ার পরামর্শসহ।">
        <SubtopicTable rows={r.subtopics} subjects={r.subjects} />
        <SourceNote>উৎস: গবেষণার ধাপ ০৯। &ldquo;মোট প্রশ্ন&rdquo; সব সাধারণ বিসিএসে (১৯তমসহ)।</SourceNote>
      </Section>

      <Section id="heatmap" title="উপবিষয় × সাধারণ বিসিএস" lead={`প্রতিটি উপবিষয়ে ${bn(r.heat.exams.length)}টি সাধারণ বিসিএসের প্রতিটিতে কতটি প্রশ্ন এসেছে।`}>
        <HeatmapExplorer rows={r.heat.rows} exams={r.heat.exams} subjects={r.subjects} />
      </Section>

      <Section
        id="special"
        title="বিশেষ বিসিএস আলাদা কেন"
        lead={`${special.examNos.map(bnOrdinal).join(", ")} বিসিএস বিশেষ পরীক্ষা হিসেবে চিহ্নিত। এগুলোতে বিষয়ের ভার সাধারণ পরীক্ষা থেকে আলাদা, তাই প্রবণতার হিসাবে মেশানো হয়নি।`}
      >
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-left text-[15px] tabular">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">বিষয়</th>
                <th className="px-3 py-2 text-right font-medium">বিশেষ: মোটের অংশ</th>
                <th className="px-3 py-2 text-right font-medium">২০০ নম্বরের সাধারণ: মোটের অংশ</th>
                <th className="px-3 py-2 text-right font-medium">পার্থক্য</th>
              </tr>
            </thead>
            <tbody>
              {special.rows.map((s) => {
                const g = g200.rows.find((x) => x.code === s.code)!;
                const d = s.share - g.share;
                return (
                  <tr key={s.code} className="border-b border-line">
                    <td className="px-3 py-2">{s.nameBn}</td>
                    <td className="px-3 py-2 text-right">{bnNum(s.share, 1)}%</td>
                    <td className="px-3 py-2 text-right">{bnNum(g.share, 1)}%</td>
                    <td className={`px-3 py-2 text-right ${Math.abs(d) >= 3 ? "font-semibold" : "text-ink-2"}`}>
                      {d > 0 ? "+" : d < 0 ? "−" : ""}
                      {bnNum(Math.abs(d), 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SourceNote>পার্থক্য শতাংশ-বিন্দুতে; ৩-এর বেশি পার্থক্য গাঢ় করে দেখানো।</SourceNote>
      </Section>

      <Section id="exams" title="পরীক্ষার তালিকা" lead="কোন পরীক্ষার কতটি প্রশ্ন ডেটাসেটে আছে। আংশিক প্রশ্নপত্র আলাদা করে চিহ্নিত।">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {r.exams.map((e) => (
            <li key={e.bcsNo} className={`rounded-lg border px-3 py-2 ${e.partial ? "border-danger" : "border-line"} bg-surface`}>
              <p className="font-semibold">{bnOrdinal(e.bcsNo)}</p>
              <p className="text-sm text-ink-2">{TYPE_BN[e.type]}, {bn(e.count)}টি প্রশ্ন</p>
              {e.notesBn && <p className={`text-xs ${e.partial ? "text-danger" : "text-muted"}`}>{e.notesBn}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <Link href="/register" className="inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
          আমি ৫২তম BCS-এর প্রস্তুতি শুরু করতে চাই
        </Link>
      </section>
    </>
  );
}
