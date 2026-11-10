import type { Metadata } from "next";
export const metadata: Metadata = { title: "প্রস্তুতির ধাপ" };
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { loadTaskForPage } from "@/lib/progress/access";
import { bn } from "@/lib/bn";
import { EngineComingNotice, LockedNotice, StepPage } from "@/components/portal/step-page";

export default function CheckpointPage({ params }: PageProps<"/level-2/checkpoint/[grade]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = await params;
  if (!["A", "B", "C", "D"].includes(grade)) notFound();
  const { task, locked, current } = await loadTaskForPage(`L2:CHECKPOINT:${grade}`, `/level-2/checkpoint/${grade}`);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const rules = await loadRules(prisma);
  return (
    <StepPage
      task={task}
      levelLabel="Level ২: টপিকভিত্তিক প্রশ্ন আয়ত্ত"
      steps={[{ key: "SOLVE", label: "Checkpoint Test", desc: `Priority ${grade}-এর সব উপবিষয় থেকে মিশ্র প্রশ্ন।` }]}
      facts={[{ k: "পাস করতে", v: `${bn(rules.get<number>("l2.threshold.checkpoint"))}%` }]}
    >
      <EngineComingNotice />
    </StepPage>
  );
}
