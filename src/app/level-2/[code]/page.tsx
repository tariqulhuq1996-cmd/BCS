import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { requireUser } from "@/lib/auth/session";
import { loadTaskForPage } from "@/lib/progress/access";
import { L2_STEPS } from "@/lib/progress/cycle";
import { bn, bnNum, bnOrdinal } from "@/lib/bn";
import { LockedNotice, StepPage } from "@/components/portal/step-page";
import { StepActions } from "@/components/exam/step-actions";

export const metadata: Metadata = { title: "প্রস্তুতির ধাপ" };
const LETTERS = ["ক", "খ", "গ", "ঘ"];

export default function L2TaskPage({ params, searchParams }: PageProps<"/level-2/[code]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const error = typeof sp.e === "string" ? sp.e : undefined;
  const isFinal = code === "final";
  if (!isFinal && !/^[A-Z]{2}\.[A-Z]{2}\.[A-Z0-9]{3}$/.test(code)) notFound();
  const { task, locked, current } = await loadTaskForPage(isFinal ? "L2:FINAL" : `L2:SUB:${code}`, `/level-2/${code}`);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const user = await requireUser();
  const rules = await loadRules(prisma);

  if (isFinal)
    return (
      <StepPage
        task={task}
        levelLabel="Level ২: টপিকভিত্তিক প্রশ্ন আয়ত্ত"
        steps={[{ key: "SOLVE", label: "Final Assessment", desc: `নতুন মানবণ্টন অনুযায়ী সব বিষয় থেকে ${bn(rules.get<number>("l2.final.size"))}টি প্রশ্ন।` }]}
        facts={[{ k: "পাস করতে", v: `${bn(rules.get<number>("l2.threshold.final"))}%` }, { k: "পাস করলে", v: "Level ৩ খুলবে" }]}
      >
        <StepActions task={task} userId={user.id} error={error} />
      </StepPage>
    );

  const st = await prisma.subtopic.findUnique({
    where: { code },
    include: {
      topic: { include: { subject: true } },
      _count: { select: { questions: { where: { kind: "TOPIC", status: "PUBLISHED" } } } },
      questions: {
        where: { kind: "HISTORICAL", status: "PUBLISHED" },
        select: { id: true, text: true, options: true, correctIndex: true, exam: { select: { bcsNo: true } } },
        orderBy: { exam: { bcsNo: "desc" } },
        take: 12,
      },
    },
  });
  if (!st) notFound();
  return (
    <StepPage
      task={task}
      levelLabel={`Level ২, Priority ${st.priorityGrade ?? "—"}: ${st.topic.subject.nameBn} › ${st.topic.nameBn}`}
      steps={L2_STEPS}
      facts={[
        { k: "Priority Score", v: st.priorityScore != null ? bnNum(st.priorityScore, 1) : "—" },
        { k: "বিগত বিসিএসে প্রশ্ন", v: st.histTotal != null ? `${bn(st.histTotal)}টি` : "—" },
        { k: "অনুশীলনের প্রশ্ন", v: st.targetQuestions ? `${bn(st._count.questions)}/${bn(st.targetQuestions)}টি প্রকাশিত` : `${bn(st._count.questions)}টি` },
        { k: "Mastery-তে লাগবে", v: `${bn(rules.get<number>("l2.threshold.mastery"))}%` },
      ]}
    >
      {/* ── Topic Introduction */}
      <section aria-labelledby="intro" className="mt-10">
        <h2 id="intro" className="text-xl font-bold">উপবিষয়ের পরিচিতি</h2>
        {st.introBn && <p className="mt-3 max-w-3xl leading-relaxed">{st.introBn}</p>}
        <dl className="mt-3 grid max-w-3xl gap-2 text-[15px]">
          {st.whyBn && <div><dt className="inline font-semibold">কেন গুরুত্বপূর্ণ: </dt><dd className="inline text-ink-2">{st.whyBn}</dd></div>}
          {st.tipBn && <div><dt className="inline font-semibold">কীভাবে পড়বে: </dt><dd className="inline text-ink-2">{st.tipBn}</dd></div>}
          {st.trend && <div><dt className="inline font-semibold">সাম্প্রতিক প্রবণতা: </dt><dd className="inline text-ink-2">{st.trend}</dd></div>}
        </dl>
        {st.questions.length > 0 && (
          <details className="mt-5 rounded-xl border border-line bg-surface">
            <summary className="cursor-pointer px-5 py-3 font-semibold">এই উপবিষয়ে বিগত বিসিএসের প্রশ্ন ({bn(st.questions.length)}টি সাম্প্রতিক)</summary>
            <ol className="divide-y divide-line border-t border-line">
              {st.questions.map((q) => (
                <li key={q.id} className="px-5 py-3 text-[15px]">
                  <p className="font-medium">{q.text}</p>
                  <p className="mt-1 text-ink-2">
                    উত্তর: <span className="font-semibold text-green">{q.correctIndex != null ? `${LETTERS[q.correctIndex]}) ${q.options[q.correctIndex]}` : "—"}</span>
                    <span className="ml-2 text-sm text-muted">{q.exam ? `${bnOrdinal(q.exam.bcsNo)} বিসিএস` : ""}</span>
                  </p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>
      <StepActions task={task} userId={user.id} error={error} />
    </StepPage>
  );
}
