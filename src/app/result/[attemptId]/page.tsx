import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ExamError, getResultView, revisionStatus } from "@/lib/exam/service";
import { startRevisionAction, startStepAction } from "@/lib/exam/actions";
import { taskHref } from "@/lib/progress/dashboard";
import { bn, bnNum } from "@/lib/bn";
import { ResultBody } from "@/components/exam/result-body";

export const metadata: Metadata = { title: "ফলাফল", robots: { index: false } };

const KIND_BN: Record<string, string> = { SOLVE: "প্রশ্ন সমাধান", REVISION: "Revision Test", MASTERY: "Mastery Test", CUMULATIVE: "Cumulative Revision Test", LEVEL_FINAL: "Final Assessment", PRACTICE: "অনুশীলন", CHECKPOINT: "Checkpoint Test", SRS_REVIEW: "দৈনিক Revision", MISTAKE_PRACTICE: "ভুলের অনুশীলন" };

export default function ResultPage({ params }: PageProps<"/result/[attemptId]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Suspense fallback={<p className="text-ink-2">ফলাফল লোড হচ্ছে…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

function StartButton({ taskKey, label, mode = "step", primary = true }: { taskKey: string; label: string; mode?: "step" | "practice"; primary?: boolean }) {
  return (
    <form action={startStepAction}>
      <input type="hidden" name="taskKey" value={taskKey} />
      <input type="hidden" name="mode" value={mode} />
      <button className={primary ? "rounded-lg bg-green px-5 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper" : "rounded-lg border-2 border-green px-5 py-2.5 font-semibold text-green hover:bg-green-wash"}>
        {label}
      </button>
    </form>
  );
}

async function Content({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser(`/result/${attemptId}`);
  let r;
  try {
    r = await getResultView(prisma, user.id, [attemptId]);
  } catch (e) {
    if (e instanceof ExamError && e.code === "NOT_READY") redirect(`/test/${attemptId}`);
    if (e instanceof ExamError) notFound();
    throw e;
  }
  const taskKey = r.taskKey ?? "";
  const task = taskKey ? await prisma.learningTask.findUnique({ where: { key: taskKey }, include: { exam: true, subtopic: { select: { code: true } } } }) : null;
  const progress = task ? await prisma.studentTaskProgress.findUnique({ where: { userId_taskId: { userId: user.id, taskId: task.id } } }) : null;
  const href = task ? taskHref({ kind: task.kind, key: task.key, bcsNo: task.exam?.bcsNo, subtopicCode: task.subtopic?.code }) : "/dashboard";
  const thr = r.threshold;

  // ── পরের করণীয়
  let headline = "";
  let next: React.ReactNode = null;
  if (r.kind === "SRS_REVIEW") {
    const st = await revisionStatus(prisma, user.id);
    headline = st.remaining > 0
      ? `এই সেট শেষ। আজ আরও ${bn(st.remaining)}টি প্রশ্ন Revision বাকি।`
      : "আজকের Revision শেষ। ঠিক উত্তর দেওয়া প্রশ্ন পরের বার আসবে আরও দেরিতে; ভুলগুলো আগামীকাল আবার।";
    next = st.remaining > 0
      ? <form action={startRevisionAction}><button className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">পরের সেট শুরু করো</button></form>
      : <Link href="/dashboard" className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">Dashboard-এ যাও</Link>;
  } else if (r.kind === "MISTAKE_PRACTICE") {
    headline = "ভুলের অনুশীলন শেষ। যেগুলো এবার ঠিক হয়েছে, সেগুলো ভুলের ভান্ডার থেকে সরে গেছে।";
    next = <Link href="/mistakes" className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">ভুলের ভান্ডারে ফিরে যাও</Link>;
  } else if (r.kind === "PRACTICE") {
    headline = "অনুশীলন শেষ। এটি ধাপের অগ্রগতিতে গোনা হয় না, তবে ভুলগুলো Revision-সারিতে যুক্ত হয়েছে।";
    next = <Link href={href} className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">ধাপে ফিরে যাও</Link>;
  } else if (progress?.state === "COMPLETED" && (r.kind === "MASTERY" || r.kind === "CUMULATIVE" || r.kind === "LEVEL_FINAL" || r.kind === "CHECKPOINT") && r.passed) {
    const opened = await prisma.taskPrerequisite.findMany({ where: { requiresId: task!.id }, include: { task: { select: { titleBn: true } } }, take: 3 });
    headline = `অভিনন্দন! তুমি ${r.taskTitle} সম্পন্ন করেছ।${opened.length ? ` ${opened.map((o) => o.task.titleBn).join(", ")}${opened.length >= 3 ? " ইত্যাদি" : ""} এখন খোলা।` : ""}`;
    next = <Link href="/dashboard" className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">পরবর্তী কাজে যাও</Link>;
  } else if (r.kind === "SOLVE") {
    if (progress?.step === "SOLVE") {
      headline = "এই ভাগ জমা হয়েছে। পরের ভাগ সমাধান করো; সব ভাগ শেষ হলে সম্মিলিত পর্যালোচনা।";
      next = <StartButton taskKey={taskKey} label="পরের ভাগ শুরু করো" />;
    } else {
      headline = `অভিনন্দন! তুমি ${r.taskTitle}-এর প্রথম সমাধান শেষ করেছ। এখন সব ভাগের উত্তর ও ব্যাখ্যা একসঙ্গে পর্যালোচনা করো।`;
      next = <Link href={`${href}/review`} className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">সম্মিলিত পর্যালোচনায় যাও</Link>;
    }
  } else if (r.kind === "REVISION") {
    headline = "Revision Test শেষ। এখন Mastery Test দাও।";
    next = <StartButton taskKey={taskKey} label="Mastery Test শুরু করো" />;
  } else if (r.passed === false) {
    headline = `তোমার ${KIND_BN[r.kind]} স্কোর ${bnNum(r.scorePct, 0)}%। পরবর্তী ধাপ Unlock করতে ${bn(thr ?? 80)}% প্রয়োজন। আবার অনুশীলন করো।`;
    next = (
      <div className="flex flex-wrap gap-3">
        <StartButton taskKey={taskKey} label="ভুলগুলো অনুশীলন করো" mode="practice" primary={false} />
        <StartButton taskKey={taskKey} label={`আবার ${KIND_BN[r.kind]} দাও`} />
      </div>
    );
  } else if (r.kind === "MASTERY" && progress?.step === "CUMULATIVE") {
    headline = `Mastery অর্জিত (${bnNum(r.scorePct, 0)}%)! শেষ ধাপ: ১০ম থেকে ${r.bcsNo ? bn(r.bcsNo) + "তম" : ""} পর্যন্ত Cumulative Revision Test।`;
    next = <StartButton taskKey={taskKey} label="Cumulative Test শুরু করো" />;
  } else {
    next = <Link href="/dashboard" className="rounded-lg bg-green px-5 py-3 font-semibold text-white dark:text-paper">Dashboard-এ যাও</Link>;
  }

  return (
    <>
      <p className="text-sm text-muted">{r.taskKey ? `${r.taskTitle}: ${KIND_BN[r.kind]}` : KIND_BN[r.kind]}</p>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="font-display text-[56px] font-extrabold leading-none tabular" style={{ fontStretch: "105%" }}>
          {bnNum(r.scorePct, 0)}%
        </h1>
        <p className="pb-1.5 text-lg text-ink-2">
          {bn(r.total)}টির মধ্যে {bn(r.correct)}টি সঠিক
          {thr != null && (
            <span className={`ml-2 font-semibold ${r.passed ? "text-green" : "text-danger"}`}>
              ({r.passed ? "পাস" : "পাস হয়নি"}, লাগবে {bn(thr)}%)
            </span>
          )}
        </p>
      </div>
      <div className="mt-6 rounded-xl border-2 border-green bg-surface p-5 sm:p-6">
        <p className="text-lg leading-relaxed">{headline}</p>
        <div className="mt-4">{next}</div>
      </div>
      <ResultBody r={r} />
    </>
  );
}
