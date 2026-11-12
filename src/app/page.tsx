import Link from "next/link";
import { getResearch } from "@/lib/research/data";
import { bn, bnNum, bnOrdinal } from "@/lib/bn";
import { OmrQuestion } from "@/components/home/omr-question";
import { Section, SourceNote } from "@/components/ui/section";
import { Heatmap } from "@/components/charts/heatmap";
import { TrendChange } from "@/components/home/trend-change";
import { RepeatList } from "@/components/home/repeat-list";
import { RoadmapPreview } from "@/components/home/roadmap-preview";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { EXAM50, MarksShift, OLD_MARKS } from "@/components/home/marks-shift";

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
  const [r, user, rules] = await Promise.all([getResearch(), getCurrentUser(), loadRules(prisma)]);
  // নতুন মানবণ্টন অ্যাডমিন-নিয়ম থেকে (না থাকলে বিষয়-তালিকার marks200), পুরোনোটি ৩৫তম–৫০তম-এর
  const newMarks = rules.get<Record<string, number>>("exam.marks_distribution") ?? {};
  const marksRows = r.subjects
    .filter((s) => OLD_MARKS[s.code] != null)
    .map((s) => ({ code: s.code, nameBn: s.nameBn, old: OLD_MARKS[s.code], now: newMarks[s.code] ?? s.marks200 ?? OLD_MARKS[s.code], e50: EXAM50[s.code] }));
  const marksChanged = marksRows.filter((m) => m.old !== m.now).length;
  const t = r.totals;
  const priorityA = r.subtopics.filter((s) => s.grade === "A");
  const trendUp = r.topics.filter((x) => x.recentPerExam > x.prevPerExam).length;
  const trendDown = r.topics.filter((x) => x.recentPerExam < x.prevPerExam).length;
  // হোমপেজে নমুনা: Priority A-র সবচেয়ে বেশিবার আসা ৫টি প্রশ্ন, আর শীর্ষ ১০টি উপবিষয় (পুরোটা লগইন করে)
  const repeatsA = r.families
    .filter((f) => f.grade === "A")
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);
  const topA = [...priorityA].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);

  return (
    <>
      {/* ── Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.15] sm:text-[56px]" style={{ fontStretch: "112%" }}>
            ৫২তম BCS Preliminary: ডেটা দেখে প্রস্তুতি, অনুমানে নয়
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            {bn(t.exams)}টি BCS-এর {bnNum(t.questions)}টি প্রশ্ন বিশ্লেষণ করে সাজানো একটি পূর্ণ পথ — বিগত প্রশ্ন, টপিকভিত্তিক অনুশীলন, Revision আর
            Model Test। কী এবং কতটা পড়বেন, তার সুনির্দিষ্ট নির্দেশনা এখানেই পাবেন।
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/register" className="rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
              প্রস্তুতি শুরু করুন
            </Link>
            <Link href="/login" className="text-ink-2 underline underline-offset-4 hover:text-ink">
              অ্যাকাউন্ট আছে? লগইন করুন
            </Link>
          </div>
          <p className="mt-10 max-w-xl text-[15px] text-ink-2">
            ১০ম–৫০তম BCS-এর প্রতিটি প্রশ্ন {bn(t.subjects)}টি বিষয়, {bn(t.topics)}টি টপিক ও {bn(t.subtopics)}টি উপবিষয়ে শ্রেণিবদ্ধ।{" "}
            {bn(t.families)}টি প্রশ্ন একাধিকবার ফিরে এসেছে।
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

      {/* ── নতুন মানবণ্টন */}
      <Section
        id="marks"
        title="৫১তম থেকে নতুন মানবণ্টন: কী বদলেছে"
        lead={`২০০ নম্বরের প্রিলিমিনারিতে ${bn(marksChanged)}টি বিষয়ের নম্বর বদলেছে, বাকি ${bn(marksRows.length - marksChanged)}টি অপরিবর্তিত। প্রস্তুতির সময় ভাগ করুন নতুন নম্বর অনুযায়ী।`}
      >
        <MarksShift rows={marksRows} />
        <SourceNote>পুরোনো মানবণ্টন ৩৫তম–৫০তম BCS-এর, নতুনটি ৫১তম থেকে প্রযোজ্য। পিএসসির সর্বশেষ বিজ্ঞপ্তির সঙ্গে মিলিয়ে নিন।</SourceNote>
      </Section>

      {/* ── Heatmap */}
      <Section
        id="heatmap"
        title="যে উপবিষয়গুলো প্রায় প্রতিবার আসে"
        lead="সবচেয়ে গুরুত্বপূর্ণ ২৫টি উপবিষয়ে প্রতিটি BCS-এ কত প্রশ্ন এসেছে। রং যত গাঢ়, প্রশ্ন তত বেশি — পুরো সারি গাঢ় হলে বুঝবেন, অংশটি প্রায় প্রতিটি পরীক্ষায় এসেছে, তাই অবশ্যপাঠ্য।"
        aside={<Link href="/research#heatmap" className="text-sm text-green underline underline-offset-4">সব {bn(t.subtopics)}টি উপবিষয় দেখুন</Link>}
      >
        <Heatmap rows={r.heat.rows.slice(0, 25)} exams={r.heat.exams} canShowAll={!!user} loginHref="/login?next=/%23heatmap" caption="শীর্ষ ২৫টি উপবিষয়ে প্রতিটি সাধারণ BCS-এর প্রশ্নসংখ্যা" />
      </Section>

      {/* ── সাম্প্রতিক প্রবণতা */}
      <Section
        id="trend"
        title="সাম্প্রতিক BCS-এ প্রশ্নের ধারা যেভাবে বদলেছে"
        lead={`আগের ${bn(r.periods.prev.length)}টি (${bn(r.periods.prev[0])}–${bnOrdinal(r.periods.prev.at(-1)!)}) আর সর্বশেষ ${bn(r.periods.recent.length)}টি (${bn(r.periods.recent[0])}–${bnOrdinal(r.periods.recent.at(-1)!)}) BCS-এর তুলনা: ${bn(trendUp)}টি টপিকে প্রশ্ন বেড়েছে, ${bn(trendDown)}টিতে কমেছে। পুরোনো অভ্যাসে নয়, সাম্প্রতিক ধারা মেনে পড়ুন।`}
      >
        <TrendChange topics={r.topics} periods={r.periods} />
      </Section>

      {/* ── পুনরাবৃত্ত প্রশ্ন */}
      <Section
        id="repeats"
        title="যে প্রশ্ন আবার আসতে পারে"
        lead={`${bn(t.families)}টি প্রশ্ন একাধিক BCS-এ হুবহু বা প্রায় একইভাবে এসেছে, ${bn(t.families3)}টি এসেছে তিনবার বা তার বেশি। নিচে সবচেয়ে গুরুত্বপূর্ণ ${bn(repeatsA.length)}টি।`}
        aside={<Link href="/repeated-questions" className="text-sm text-green underline underline-offset-4">সব {bn(t.families)}টি প্রশ্ন দেখুন</Link>}
      >
        <RepeatList families={repeatsA} />
      </Section>

      {/* ── Priority A */}
      <Section
        id="priority"
        title="৫২তম BCS-এ প্রথমে যা পড়বেন"
        lead={`${bn(t.subtopics)}টি উপবিষয়ের মধ্যে ${bn(priorityA.length)}টি Priority A — নম্বর তোলার সবচেয়ে নিশ্চিত জায়গা। নিচে Score অনুযায়ী শীর্ষ ${bn(topA.length)}টি।`}
        aside={<Link href="/research#priority" className="text-sm text-green underline underline-offset-4">পূর্ণ Priority List দেখুন</Link>}
      >
        {/* বাঁ কলামে ১–৫, ডান কলামে ৬–১০ */}
        <ul className="grid gap-x-10 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5">
          {topA.map((s) => (
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
        title="শুরু থেকে শেষ: প্রস্তুতি থেকে সাফল্য"
        lead="প্রশ্ন-বিশ্লেষণ দিয়ে শুরু, তারপর তিনটি Level — প্রতিটি ধাপে নির্ধারিত নম্বর অর্জন করলেই পরের ধাপ উন্মুক্ত হয়, ফলে প্রস্তুতির কোনো অংশ অসম্পূর্ণ থাকে না। প্রতিদিনের করণীয় Dashboard-এ নির্দিষ্ট করে দেওয়া থাকে।"
      >
        <RoadmapPreview exams={t.exams} specialExams={t.specialExams} subtopics={t.subtopics} gradeCounts={t.gradeCounts} />
      </Section>

      {/* ── CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="flex flex-col items-start gap-5 rounded-2xl border border-green bg-green-wash px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            {/* প্রস্থ অনুযায়ী অক্ষরের মাপ, যাতে শিরোনাম এক লাইনে থাকে (লেখাটি ~১৭.৫em চওড়া) */}
            <h2 className="text-[length:clamp(16px,calc((100vw_-_90px)/18),26px)] font-bold text-balance sm:text-[length:clamp(16px,calc((100vw_-_136px)/18),32px)]" style={{ fontStretch: "110%" }}>
              আজই প্রথম ধাপ: প্রশ্ন-বিশ্লেষণ
            </h2>
            <p className="mt-2 max-w-xl text-ink-2">অ্যাকাউন্ট খুললেই শুরু। প্রতিটি উত্তর, ভুল আর অগ্রগতি সংরক্ষিত থাকে — যেকোনো দিন, যেকোনো ডিভাইস থেকে ঠিক সেখান থেকে চালিয়ে যান।</p>
          </div>
          <Link href="/register" className="shrink-0 rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
            প্রস্তুতি শুরু করুন
          </Link>
        </div>
      </section>
    </>
  );
}
