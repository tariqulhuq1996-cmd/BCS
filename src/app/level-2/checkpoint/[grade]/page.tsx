import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { requireUser } from "@/lib/auth/session";
import { loadTaskForPage } from "@/lib/progress/access";
import { bn } from "@/lib/bn";
import { LockedNotice, StepPage } from "@/components/portal/step-page";
import { StepActions } from "@/components/exam/step-actions";

export const metadata: Metadata = { title: "প্রস্তুতির ধাপ" };

export default function CheckpointPage({ params, searchParams }: PageProps<"/level-2/checkpoint/[grade]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ grade: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ grade }, sp] = await Promise.all([params, searchParams]);
  if (!["A", "B", "C", "D"].includes(grade)) notFound();
  const { task, locked, current } = await loadTaskForPage(`L2:CHECKPOINT:${grade}`, `/level-2/checkpoint/${grade}`);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const user = await requireUser();
  const rules = await loadRules(prisma);
  return (
    <StepPage
      task={task}
      levelLabel="Level ২: টপিকভিত্তিক প্রশ্ন আয়ত্ত"
      steps={[{ key: "SOLVE", label: "Checkpoint Test", desc: `Priority ${grade}-এর সব উপবিষয় থেকে মিশ্র ${bn(rules.get<number>("l2.checkpoint.size"))}টি প্রশ্ন, প্রতিটি উপবিষয় থেকে অন্তত একটি।` }]}
      facts={[{ k: "পাস করতে", v: `${bn(rules.get<number>("l2.threshold.checkpoint"))}%` }, { k: "পাস করলে", v: grade === "D" ? "Level ২ Final খুলবে" : "পরের Priority ধাপ খুলবে" }]}
    >
      <StepActions task={task} userId={user.id} error={typeof sp.e === "string" ? sp.e : undefined} />
    </StepPage>
  );
}
