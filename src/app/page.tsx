import Link from "next/link";
import { getResearch } from "@/lib/research/data";
import { bn, bnNum } from "@/lib/bn";
import { OmrQuestion } from "@/components/home/omr-question";
import { Section, SourceNote } from "@/components/ui/section";
import { Heatmap } from "@/components/charts/heatmap";
import { TrendChange } from "@/components/home/trend-change";
import { RepeatList } from "@/components/home/repeat-list";
import { RoadmapPreview } from "@/components/home/roadmap-preview";
import { Suspense } from "react";
import { connection } from "next/server";

/**
 * গবেষণার ডেটা ডেটাবেস থেকে আসে, তাই পাতাটি বিল্ডের সময় নয়, প্রথম অনুরোধে তৈরি হয় (তারপর "use cache"-এ কয়েক ঘণ্টা থাকে)।
 * এতে বিল্ড (GitHub Actions) ডেটাবেস ছোঁয় না — Hostinger-এর ডেটাবেস বাইরে খোলা রাখতে হয় না।
 */
export default function Home() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 pt-10 text-ink-2 sm:px-6">লোড হচ্ছে…</p>}>
      <Deferred />
    </Suspense>
  );
}

async function Deferred() {
  await connection();
  return <HomeContent />;
}

async function HomeContent() {
  const r = await getResearch();
  const t = r.totals;
  const priorityA = r.subtopics.filter((s) => s.grade === "A");

  return (
    <>
      {/* ── Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.15] sm:text-[56px]" style={{ fontStretch: "112%" }}>
            ৫২তম BCS Preliminary — গবেষণাভিত্তিক স্মার্ট প্রস্তুতি
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            বিগত BCS পরীক্ষার প্রশ্ন বিশ্লেষণ থেকে শুরু করে বিষয়ভিত্তিক অনুশীলন, Revision এবং পূর্ণাঙ্গ Model Test — সম্পূর্ণ প্রস্তুতি একটি নির্দিষ্ট
            Learning Roadmap অনুসরণ করে।
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/register" className="rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
              ৫২তম BCS প্রস্তুতি শুরু করুন
            </Link>
            <Link href="/login" className="text-ink-2 underline underline-offset-4 hover:text-ink">
              আগে থেকে অ্যাকাউন্ট আছে? লগইন করুন
            </Link>
          </div>
          <p className="mt-10 max-w-xl text-[15px] text-ink-2">
            ভিত্তি: {bn(t.exams)}টি বিসিএস প্রিলিমিনারির {bnNum(t.questions)}টি প্রশ্ন, {bn(t.subjects)}টি বিষয়, {bn(t.topics)}টি টপিক ও {bn(t.subtopics)}টি উপবিষয়ে
            ভাগ করে গোনা। এর মধ্যে {bn(t.families)}টি প্রশ্ন একাধিক পরীক্ষায় ফিরে এসেছে।
          </p>
        </div>
        <OmrQuestion
          text={r.hero.text}
          options={r.hero.options}
          correctIndex={r.hero.correctIndex!}
          examNos={r.hero.examNos}
          explanation={r.hero.explanation}
          explanationVerified={r.hero.explanationVerified}
        />
      </section>

      {/* ── Heatmap */}
      <Section
        id="heatmap"
        title="কোন উপবিষয় বারবার আসে"
        lead={`Priority Score অনুযায়ী শীর্ষ ২৫টি উপবিষয়, প্রতিটি সাধারণ বিসিএসে কতটি প্রশ্ন এসেছে। গাঢ় ঘর মানে বেশি প্রশ্ন; টানা গাঢ় সারি মানে ধারাবাহিকভাবে গুরুত্বপূর্ণ।`}
        aside={<Link href="/research#heatmap" className="text-sm text-green underline underline-offset-4">সব {bn(t.subtopics)}টি উপবিষয় দেখুন</Link>}
      >
        <Heatmap rows={r.heat.rows.slice(0, 25)} exams={r.heat.exams} caption="শীর্ষ ২৫টি উপবিষয়ে প্রতিটি সাধারণ বিসিএসের প্রশ্নসংখ্যা" />
      </Section>

      {/* ── সাম্প্রতিক প্রবণতা */}
      <Section
        id="trend"
        title="৪০তম–৫০তম বিসিএসে কী বদলেছে"
        lead={`২০০ নম্বরের প্রথম চারটি পরীক্ষার (৩৫–৩৮তম) সঙ্গে সাম্প্রতিক আটটি সাধারণ পরীক্ষার তুলনা, টপিকে পরীক্ষাপ্রতি গড় প্রশ্ন ধরে। উপবিষয়-স্তরে ${bn(r.trendCounts["বেড়েছে"] ?? 0)}টির গুরুত্ব বেড়েছে, ${bn(r.trendCounts["কমেছে"] ?? 0)}টির কমেছে।`}
      >
        <TrendChange topics={r.topics} periods={r.periods} />
      </Section>

      {/* ── পুনরাবৃত্ত প্রশ্ন */}
      <Section
        id="repeats"
        title="যে প্রশ্ন বারবার ফিরে আসে"
        lead={`${bn(t.families)}টি প্রশ্ন অন্তত দুটি বিসিএসে এসেছে; এর মধ্যে ${bn(t.families3)}টি এসেছে তিন বা তার বেশি পরীক্ষায়। সেগুলো এখানে।`}
        aside={<Link href="/repeated-questions" className="text-sm text-green underline underline-offset-4">সব {bn(t.families)}টি প্রশ্ন দেখুন</Link>}
      >
        <RepeatList families={r.families.filter((f) => f.occurrences >= 3)} />
      </Section>

      {/* ── Priority A */}
      <Section
        id="priority"
        title="৫২তম বিসিএসের সর্বোচ্চ অগ্রাধিকার"
        lead={`${bn(t.subtopics)}টি উপবিষয়ের মধ্যে Priority A পেয়েছে ${bn(priorityA.length)}টি: এগুলো প্রথমে, গভীরভাবে পড়ার এবং প্রতি সপ্তাহে Revision দেওয়ার মতো।`}
        aside={<Link href="/research#priority" className="text-sm text-green underline underline-offset-4">পূর্ণ Priority List দেখুন</Link>}
      >
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {priorityA.map((s) => (
            <li key={s.code} className="flex items-baseline gap-3 border-b border-line py-2.5">
              <span className="w-10 shrink-0 text-sm tabular text-muted">{bnNum(s.score ?? 0, 1)}</span>
              <span className="text-[15px] leading-snug">
                {s.nameBn}
                <span className="block text-xs text-muted">{s.subjectBn}</span>
              </span>
            </li>
          ))}
        </ul>
        <SourceNote>
          বাকি: {r.totals.gradeCounts.filter((g) => g.grade !== "A").map((g) => `Priority ${g.grade} ${bn(g.n)}টি`).join(", ")}।
        </SourceNote>
      </Section>

      {/* ── Roadmap */}
      <Section
        id="roadmap"
        title="প্রস্তুতি এগোবে তিনটি Level-এ"
        lead="প্রতিটি ধাপ শেষ করে নির্ধারিত নম্বর পেলে তবেই পরের ধাপ খোলে। কী পড়তে হবে খুঁজতে হবে না: Dashboard প্রতিদিন বলে দেবে আজকের কাজ।"
      >
        <RoadmapPreview exams={t.exams} specialExams={t.specialExams} subtopics={t.subtopics} gradeCounts={t.gradeCounts} />
      </Section>

      {/* ── CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="flex flex-col items-start gap-5 rounded-2xl border border-green bg-green-wash px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-[26px] font-bold sm:text-[32px]" style={{ fontStretch: "110%" }}>
              প্রথম কাজ: ১০ম বিসিএসের প্রশ্নপত্র
            </h2>
            <p className="mt-2 text-ink-2">অ্যাকাউন্ট খুললেই Level 1 শুরু। আপনার অগ্রগতি সংরক্ষিত থাকবে, অন্য দিন লগইন করে সেখান থেকেই চালিয়ে যেতে পারবেন।</p>
          </div>
          <Link href="/register" className="rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
            আমি ৫২তম BCS-এর প্রস্তুতি শুরু করতে চাই
          </Link>
        </div>
      </section>
    </>
  );
}
