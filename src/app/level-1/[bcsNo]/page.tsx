import type { Metadata } from "next";
export const metadata: Metadata = { title: "প্রস্তুতির ধাপ" };
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { loadTaskForPage } from "@/lib/progress/access";
import { L1_STEPS } from "@/lib/progress/cycle";
import { bn, bnOrdinal } from "@/lib/bn";
import { EngineComingNotice, LockedNotice, StepPage } from "@/components/portal/step-page";

export default function L1TaskPage({ params }: PageProps<"/level-1/[bcsNo]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ bcsNo: string }> }) {
  const { bcsNo } = await params;
  const isFinal = bcsNo === "final";
  if (!isFinal && !/^\d{2}$/.test(bcsNo)) notFound();
  const key = isFinal ? "L1:FINAL" : `L1:EXAM:${bcsNo}`;
  const { task, locked, current } = await loadTaskForPage(key, `/level-1/${bcsNo}`);
  if (locked) return <LockedNotice title={task.title} current={current} />;

  const rules = await loadRules(prisma);
  if (isFinal) {
    return (
      <StepPage
        task={task}
        levelLabel="Level ১: বিগত বিসিএসের প্রশ্ন আয়ত্ত"
        steps={[{ key: "SOLVE", label: "Final Assessment", desc: `১০ম–৫০তম সব বিসিএস থেকে ${bn(rules.get<number>("l1.final.size"))}টি প্রশ্ন।` }]}
        facts={[{ k: "পাস করতে", v: `${bn(rules.get<number>("l1.threshold.final"))}%` }, { k: "পাস করলে", v: "Level ২ খুলবে" }]}
      >
        <EngineComingNotice />
      </StepPage>
    );
  }

  const no = Number(bcsNo);
  const eligible = rules.get<string[]>("path.eligible_classes");
  const [exam, n] = await Promise.all([
    prisma.exam.findUnique({ where: { bcsNo: no } }),
    prisma.question.count({ where: { exam: { bcsNo: no }, status: "PUBLISHED", verifyClass: { in: eligible } } }),
  ]);
  const steps = no === 10 ? L1_STEPS.filter((s) => s.key !== "CUMULATIVE") : L1_STEPS;
  return (
    <StepPage
      task={task}
      levelLabel="Level ১: বিগত বিসিএসের প্রশ্ন আয়ত্ত"
      steps={steps}
      facts={[
        { k: "পরীক্ষার ধরন", v: exam?.type === "SPECIAL" ? "বিশেষ বিসিএস" : exam?.type === "GENERAL_200" ? "২০০ নম্বর" : "১০০ নম্বর" },
        { k: "বাধ্যতামূলক প্রশ্ন", v: `${bn(n)}টি (যাচাইকৃত)` },
        { k: "Mastery-তে লাগবে", v: `${bn(rules.get<number>("l1.threshold.mastery"))}%` },
        ...(no > 10 ? [{ k: "Cumulative-এ লাগবে", v: `${bn(rules.get<number>("l1.threshold.cumulative"))}%` }] : []),
        ...(task.bestScore != null ? [{ k: "তোমার সেরা স্কোর", v: `${bn(Math.round(task.bestScore))}%` }] : []),
      ]}
    >
      {exam?.notesBn && <p className="mt-6 text-sm text-danger">{bnOrdinal(no)} বিসিএস: {exam.notesBn}</p>}
      <EngineComingNotice />
    </StepPage>
  );
}
