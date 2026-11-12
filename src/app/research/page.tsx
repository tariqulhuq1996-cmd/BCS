import type { Metadata } from "next";
import Link from "next/link";
import { getResearch } from "@/lib/research/data";
import { bn, bnNum, bnOrdinal } from "@/lib/bn";
import { Section, SourceNote } from "@/components/ui/section";
import { SubtopicTable } from "@/components/research/subtopic-table";
import { HeatmapExplorer } from "@/components/research/heatmap-explorer";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ORIENT_ITEMS, orientationStatus } from "@/lib/progress/journey";
import { ensureStarted } from "@/lib/progress/engine";
import { OrientBanner, OrientProvider, ReadCheck } from "@/components/research/read-check";
import { TrendChange } from "@/components/home/trend-change";
import { RepeatList } from "@/components/home/repeat-list";
import { RoadmapPreview } from "@/components/home/roadmap-preview";

export const metadata: Metadata = { title: "প্রশ্ন-বিশ্লেষণ: ১০ম–৫০তম BCS" };

const TYPE_BN = { GENERAL_100: "১০০ নম্বর", GENERAL_200: "২০০ নম্বর", SPECIAL: "বিশেষ" } as const;

/**
 * গবেষণার ডেটা ডেটাবেস থেকে আসে, তাই পাতাটি বিল্ডের সময় নয়, প্রথম অনুরোধে তৈরি হয় (তারপর "use cache"-এ কয়েক ঘণ্টা থাকে)।
 * এতে বিল্ড (GitHub Actions) ডেটাবেস ছোঁয় না — Hostinger-এর ডেটাবেস বাইরে খোলা রাখতে হয় না।
 */
export default function ResearchPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 pt-10 text-ink-2 sm:px-6">লোড হচ্ছে…</p>}>
      <Deferred />
    </Suspense>
  );
}

async function Deferred() {
  await connection();
  // পূর্ণ তালিকা শুধু লগইন করা ব্যবহারকারীর জন্য (হোমপেজে নমুনা খোলা থাকে)
  const user = await requireUser("/research");
  return <ResearchPageContent user={user} />;
}

const label = (id: string) => ORIENT_ITEMS.find((i) => i.id === id)!.label;

/** যাত্রার প্রথম ধাপ (ধাপ ০): পাঁচটি অংশ, প্রতিটির শেষে "পড়েছি"। পরিশিষ্টে বিশেষ BCS ও পরীক্ষার তালিকা। */
async function ResearchPageContent({ user }: { user: CurrentUser }) {
  await ensureStarted(prisma, user.id);
  const [r, orient] = await Promise.all([getResearch(), orientationStatus(prisma, user.id)]);
  const trendUp = r.topics.filter((x) => x.recentPerExam > x.prevPerExam).length;
  const trendDown = r.topics.filter((x) => x.recentPerExam < x.prevPerExam).length;
  const repeatsA = r.families.filter((f) => f.grade === "A").sort((a, b) => b.occurrences - a.occurrences).slice(0, 5);
  const special = r.subjectByType.find((s) => s.type === "SPECIAL")!;
  const g200 = r.subjectByType.find((s) => s.type === "GENERAL_200")!;

  return (
    <OrientProvider initial={orient.checked} done={orient.done} total={ORIENT_ITEMS.length}>
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <h1 className="text-[36px] font-extrabold sm:text-[46px]" style={{ fontStretch: "112%" }}>
          প্রশ্ন-বিশ্লেষণ: ১০ম–৫০তম BCS
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">
          {bn(r.totals.exams)}টি প্রিলিমিনারি পরীক্ষার {bnNum(r.totals.questions)}টি প্রশ্ন, {bn(r.totals.subtopics)}টি উপবিষয়ে ভাগ করা। নিচের প্রতিটি সারণি ও চার্ট
          সরাসরি এই প্রশ্নগুলো থেকে তৈরি।
        </p>
        <OrientBanner items={ORIENT_ITEMS} />
      </section>

      <Section id="heatmap" title={`১. ${label("heatmap")}`} lead={`প্রতিটি উপবিষয়ে ${bn(r.heat.exams.length)}টি সাধারণ BCS-এর প্রতিটিতে কতটি প্রশ্ন এসেছে। পুরো সারি গাঢ় হলে বুঝবেন, অংশটি প্রায় প্রতিটি পরীক্ষায় এসেছে, তাই অবশ্যপাঠ্য।`}>
        <HeatmapExplorer rows={r.heat.rows} exams={r.heat.exams} subjects={r.subjects} />
        <ReadCheck id="heatmap" label={label("heatmap")} />
      </Section>

      <Section
        id="trend"
        title={`২. ${label("trend")}`}
        lead={`আগের ${bn(r.periods.prev.length)}টি (${bn(r.periods.prev[0])}–${bnOrdinal(r.periods.prev.at(-1)!)}) আর সর্বশেষ ${bn(r.periods.recent.length)}টি (${bn(r.periods.recent[0])}–${bnOrdinal(r.periods.recent.at(-1)!)}) BCS-এর তুলনা: ${bn(trendUp)}টি টপিকে প্রশ্ন বেড়েছে, ${bn(trendDown)}টিতে কমেছে।`}
      >
        <TrendChange topics={r.topics} periods={r.periods} />
        <ReadCheck id="trend" label={label("trend")} />
      </Section>

      <Section
        id="repeats"
        title={`৩. ${label("repeats")}`}
        lead={`${bn(r.totals.families)}টি প্রশ্ন একাধিক BCS-এ এসেছে, ${bn(r.totals.families3)}টি তিনবার বা তার বেশি। নিচে Priority A-র সবচেয়ে বেশিবার আসা ${bn(repeatsA.length)}টি। পুরো তালিকা খুলবে ধাপে ধাপে — যে BCS-গুলো সমাধান করবেন, সেগুলোর পুনরাবৃত্ত প্রশ্ন; Level ১-এর শেষে Repeat Mastery-তে Priority A-র সবগুলো।`}
        aside={<Link href="/repeated-questions" className="text-sm text-green underline underline-offset-4">বারবার আসা প্রশ্ন</Link>}
      >
        <RepeatList families={repeatsA} />
        <ReadCheck id="repeats" label={label("repeats")} />
      </Section>

      <Section id="priority" title={`৪. ৫২তম BCS ${label("priority")}`} lead="সব উপবিষয়ের Priority Score (১০০-এর মধ্যে) ও A–D শ্রেণি, কারণ ও পড়ার পরামর্শসহ। Level ২ এই ক্রমেই চলে: আগে A, তারপর B, C, D।">
        <SubtopicTable rows={r.subtopics} subjects={r.subjects} />
        <SourceNote>উৎস: গবেষণার ধাপ ০৯। &ldquo;মোট প্রশ্ন&rdquo; সব সাধারণ BCS-এ (১৯তমসহ)।</SourceNote>
        <ReadCheck id="priority" label={label("priority")} />
      </Section>

      <Section id="roadmap" title={`৫. ${label("roadmap")}`} lead="প্রতিটি ধাপে নির্ধারিত নম্বর অর্জন করলেই পরের ধাপ উন্মুক্ত হয়, ফলে প্রস্তুতির কোনো অংশ অসম্পূর্ণ থাকে না। প্রতিদিনের করণীয় — মূল পথের কাজ, রিভিশন ও সাম্প্রতিক বিষয়াবলি — Dashboard-এ নির্দিষ্ট করে দেওয়া থাকে।">
        <RoadmapPreview exams={r.totals.exams} specialExams={r.totals.specialExams} subtopics={r.totals.subtopics} gradeCounts={r.totals.gradeCounts} />
        <ReadCheck id="roadmap" label={label("roadmap")} />
      </Section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">পরিশিষ্ট</h2>
      </section>

      <Section
        id="special"
        title="বিশেষ BCS আলাদা কেন"
        lead={`${special.examNos.map(bnOrdinal).join(", ")} BCS বিশেষ পরীক্ষা হিসেবে চিহ্নিত। এগুলোতে বিষয়ভিত্তিক প্রশ্নের অনুপাত সাধারণ পরীক্ষা থেকে আলাদা, তাই প্রবণতার হিসাবে মেশানো হয়নি।`}
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
        <SourceNote>পার্থক্য শতাংশ-বিন্দুতে; ৩ বা তার বেশি পার্থক্য গাঢ় করে দেখানো।</SourceNote>
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
        <Link href="/dashboard" className="inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
          Dashboard-এ যান
        </Link>
      </section>
    </OrientProvider>
  );
}
