import type { Metadata } from "next";
export const metadata: Metadata = { title: "প্রস্তুতির ধাপ" };
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { loadTaskForPage } from "@/lib/progress/access";
import { L2_STEPS } from "@/lib/progress/cycle";
import { bn, bnNum } from "@/lib/bn";
import { EngineComingNotice, LockedNotice, StepPage } from "@/components/portal/step-page";

export default function L2TaskPage({ params }: PageProps<"/level-2/[code]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const isFinal = code === "final";
  if (!isFinal && !/^[A-Z]{2}\.[A-Z]{2}\.[A-Z0-9]{3}$/.test(code)) notFound();
  const { task, locked, current } = await loadTaskForPage(isFinal ? "L2:FINAL" : `L2:SUB:${code}`, `/level-2/${code}`);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const rules = await loadRules(prisma);

  if (isFinal)
    return (
      <StepPage
        task={task}
        levelLabel="Level ২: টপিকভিত্তিক প্রশ্ন আয়ত্ত"
        steps={[{ key: "SOLVE", label: "Final Assessment", desc: `নতুন মানবণ্টনে ${bn(rules.get<number>("l2.final.size"))}টি প্রশ্ন।` }]}
        facts={[{ k: "পাস করতে", v: `${bn(rules.get<number>("l2.threshold.final"))}%` }, { k: "পাস করলে", v: "Level ৩ খুলবে" }]}
      >
        <EngineComingNotice />
      </StepPage>
    );

  const st = await prisma.subtopic.findUnique({ where: { code }, include: { topic: { include: { subject: true } }, _count: { select: { questions: { where: { kind: "TOPIC", status: "PUBLISHED" } } } } } });
  if (!st) notFound();
  return (
    <StepPage
      task={task}
      levelLabel={`Level ২, Priority ${st.priorityGrade ?? "—"}: ${st.topic.subject.nameBn} › ${st.topic.nameBn}`}
      steps={L2_STEPS}
      facts={[
        { k: "Priority Score", v: st.priorityScore != null ? bnNum(st.priorityScore, 1) : "—" },
        { k: "বিগত বিসিএসে প্রশ্ন", v: st.histTotal != null ? `${bn(st.histTotal)}টি` : "—" },
        { k: "নতুন প্রশ্ন (প্রকাশিত)", v: `${bn(st._count.questions)}টি` },
        { k: "Mastery-তে লাগবে", v: `${bn(rules.get<number>("l2.threshold.mastery"))}%` },
      ]}
    >
      {st.tipBn && <p className="mt-8 text-[15px] text-ink-2"><span className="font-semibold text-ink">পড়ার পরামর্শ:</span> {st.tipBn}</p>}
      <EngineComingNotice />
    </StepPage>
  );
}
