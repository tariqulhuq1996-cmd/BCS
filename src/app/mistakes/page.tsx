import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { startMistakeAction } from "@/lib/exam/actions";
import { bn } from "@/lib/bn";
import { numify } from "@/lib/sql";

export const metadata: Metadata = { title: "ভুলের ভান্ডার" };
const LETTERS = ["ক", "খ", "গ", "ঘ"];

export default function MistakesPage({ searchParams }: PageProps<"/mistakes">) {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>ভুলের ভান্ডার</h1>
      <p className="mt-2 max-w-2xl text-ink-2">শেষবার যেসব প্রশ্নে ভুল করেছ বা উত্তর দাওনি, সেগুলো এখানে জমা থাকে। ঠিক উত্তর দিলে তালিকা থেকে সরে যায়।</p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

function PracticeButton({ subject, label, primary }: { subject?: string; label: string; primary?: boolean }) {
  return (
    <form action={startMistakeAction} className="inline-block">
      <input type="hidden" name="subject" value={subject ?? ""} />
      <button className={primary ? "rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper" : "text-sm font-semibold text-green underline underline-offset-4"}>{label}</button>
    </form>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/mistakes");
  const [bySubject, top] = await Promise.all([
    prisma.$queryRaw<{ code: string; name: string; n: number }[]>`
      select sj.code, sj.nameBn as name, count(*) as n
      from QuestionStat qs join Question q on q.id = qs.questionId
      join Subtopic st on st.id = q.subtopicId join Topic tp on tp.id = st.topicId join Subject sj on sj.id = tp.subjectId
      where qs.userId = ${user.id} and qs.wrong > 0 and qs.lastCorrect = false and q.status = 'PUBLISHED'
      group by sj.code, sj.nameBn, sj.order order by sj.order`.then((r) => numify(r)),
    prisma.questionStat.findMany({
      where: { userId: user.id, wrong: { gt: 0 }, lastCorrect: false, question: { status: "PUBLISHED" } },
      orderBy: [{ wrong: "desc" }, { lastWrongAt: "desc" }],
      take: 30,
      include: { question: { select: { text: true, options: true, correctIndex: true, subtopic: { select: { nameBn: true } } } } },
    }),
  ]);
  const total = bySubject.reduce((a, s) => a + s.n, 0);
  if (!total)
    return <p className="mt-8 text-lg text-ink-2">ভুলের ভান্ডার খালি। পরীক্ষায় ভুল করা প্রশ্ন এখানে জমা হবে, যাতে আলাদা করে অনুশীলন করতে পারো।</p>;

  return (
    <>
      {sp.e === "EMPTY" && <p role="alert" className="mt-6 rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">এই বিষয়ে এখন কোনো ভুল প্রশ্ন নেই।</p>}
      <div className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border-2 border-green bg-surface p-6">
        <p className="text-lg">মোট <span className="font-bold">{bn(total)}টি</span> প্রশ্ন। প্রতিবার সবচেয়ে বেশি ভুল করা ২০টি দিয়ে অনুশীলন।</p>
        <PracticeButton label="সব বিষয় থেকে অনুশীলন করো" primary />
      </div>
      <section aria-labelledby="bysub" className="mt-10">
        <h2 id="bysub" className="text-xl font-bold">বিষয় অনুযায়ী</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {bySubject.map((s) => (
            <li key={s.code} className="flex items-baseline justify-between gap-4 py-2.5">
              <span>{s.name} <span className="text-sm text-muted">({bn(s.n)}টি)</span></span>
              <PracticeButton subject={s.code} label="এই বিষয়ের অনুশীলন" />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="top" className="mt-10">
        <h2 id="top" className="text-xl font-bold">সবচেয়ে বেশিবার ভুল</h2>
        <ol className="mt-3 grid gap-3">
          {top.map((t) => (
            <li key={t.questionId} className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="font-medium">{t.question.text}</p>
              <p className="mt-1 text-[15px] text-ink-2">
                সঠিক: <span className="font-semibold text-green">{t.question.correctIndex != null ? `${LETTERS[t.question.correctIndex]}) ${t.question.options[t.question.correctIndex]}` : "—"}</span>
                <span className="ml-3 text-sm text-muted">{t.question.subtopic.nameBn}, ভুল {bn(t.wrong)} বার</span>
              </p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
