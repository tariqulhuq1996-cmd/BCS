import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { solvePlan } from "@/lib/exam/service";
import { startStepAction } from "@/lib/exam/actions";
import { ATTEMPT_KIND_BN } from "@/lib/progress/cycle";
import type { TaskView } from "@/lib/progress/dashboard";
import { bn, bnNum } from "@/lib/bn";

const ERR: Record<string, string> = {
  LOCKED: "এই ধাপটি Unlock করতে আগের ধাপের নির্ধারিত কাজ সম্পন্ন করুন।",
  NEED_REVIEW: "আগে প্রথম সমাধানের উত্তর পর্যালোচনা শেষ করো।",
  SUBMITTED: "এই ধাপ আগেই সম্পন্ন হয়েছে।",
  NOT_READY: "এই ধাপের প্রশ্ন এখনও প্রস্তুত নয়।",
};

function Start({ taskKey, label, mode = "step", primary = true }: { taskKey: string; label: string; mode?: "step" | "practice"; primary?: boolean }) {
  return (
    <form action={startStepAction} className="inline-block">
      <input type="hidden" name="taskKey" value={taskKey} />
      <input type="hidden" name="mode" value={mode} />
      <button className={primary ? "rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper" : "rounded-lg border-2 border-green px-5 py-2.5 font-semibold text-green hover:bg-green-wash"}>
        {label}
      </button>
    </form>
  );
}

/** Level 1-এর একটি ধাপ-পাতার কাজের অংশ: বর্তমান ধাপের বাটন, ভাগের অবস্থা, আগের পরীক্ষার ইতিহাস। */
export async function L1StepActions({ task, userId, error }: { task: TaskView; userId: string; error?: string }) {
  const rules = await loadRules(prisma);
  const [open, history] = await Promise.all([
    prisma.testAttempt.findFirst({ where: { userId, taskId: task.id, submittedAt: null, kind: { not: "SOLVE" } }, orderBy: { startedAt: "desc" } }),
    prisma.testAttempt.findMany({ where: { userId, taskId: task.id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 12 }),
  ]);
  const plan = task.kind === "L1_EXAM" && task.step === "SOLVE" && task.state !== "COMPLETED" ? await solvePlan(prisma, userId, task.id, task.bcsNo!, rules) : null;
  const thrKey = task.step === "CUMULATIVE" ? "l1.threshold.cumulative" : task.kind === "L1_FINAL" ? "l1.threshold.final" : "l1.threshold.mastery";
  const failedLast = task.lastScore != null && task.lastScore < rules.get<number>(thrKey);
  const isFinal = task.kind === "L1_FINAL";

  let body: React.ReactNode;
  if (task.state === "COMPLETED") {
    body = (
      <>
        <p className="text-lg">এই ধাপ সম্পন্ন{task.bestScore != null ? `, সেরা স্কোর ${bnNum(task.bestScore, 0)}%` : ""}। চাইলে ভুলগুলো আবার অনুশীলন করতে পারো; এতে অগ্রগতি বদলাবে না।</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white dark:text-paper">পরবর্তী কাজে যাও</Link>
          <Start taskKey={task.key} label="অনুশীলন করো" mode="practice" primary={false} />
        </div>
      </>
    );
  } else if (isFinal) {
    body = (
      <>
        <p className="text-lg">{failedLast ? `আগের চেষ্টায় ${bnNum(task.lastScore!, 0)}%। ` : ""}সব বিসিএস থেকে {bn(rules.get<number>("l1.final.size"))}টি প্রশ্ন; পাস করতে {bn(rules.get<number>(thrKey))}%।</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Start taskKey={task.key} label={open ? "Final Assessment চালিয়ে যাও" : "Final Assessment শুরু করো"} />
          {failedLast && <Start taskKey={task.key} label="ভুলগুলো অনুশীলন করো" mode="practice" primary={false} />}
        </div>
      </>
    );
  } else if (task.step === "SOLVE" && plan) {
    const next = plan.find((p) => !p.doneAttemptId);
    body = (
      <>
        <p className="text-lg">প্রশ্নপত্রটি {bn(plan.length)}টি ভাগে। প্রতিটি ভাগ জমা দিলে ফল দেখাবে; সব ভাগ শেষে সম্মিলিত পর্যালোচনা।</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          {plan.map((p) => (
            <li key={p.partNo} className={`rounded-lg border px-4 py-3 ${p.doneAttemptId ? "border-green bg-green-wash" : p === next ? "border-omr" : "border-line"}`}>
              <p className="font-semibold">ভাগ {bn(p.partNo)}</p>
              <p className="text-sm text-ink-2">প্রশ্ন {bn(p.from ?? 0)}–{bn(p.to ?? 0)} ({bn(p.size)}টি)</p>
              <p className="text-sm">
                {p.doneAttemptId ? (
                  <Link href={`/result/${p.doneAttemptId}`} className="text-green underline">সম্পন্ন, {bnNum(p.scorePct ?? 0, 0)}%</Link>
                ) : p.openAttemptId ? "চলছে" : "বাকি"}
              </p>
            </li>
          ))}
        </ol>
        {next && <div className="mt-5"><Start taskKey={task.key} label={next.openAttemptId ? `ভাগ ${bn(next.partNo)} চালিয়ে যাও` : `ভাগ ${bn(next.partNo)} শুরু করো`} /></div>}
      </>
    );
  } else if (task.step === "REVIEW") {
    body = (
      <>
        <p className="text-lg">প্রথম সমাধান শেষ। এখন সঠিক ও ভুল উত্তর এবং ব্যাখ্যাগুলো পর্যালোচনা করো।</p>
        <Link href={`${task.href}/review`} className="mt-4 inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white dark:text-paper">উত্তর পর্যালোচনা করো</Link>
      </>
    );
  } else {
    const label = { REVISION: "Revision Test", MASTERY: "Mastery Test", CUMULATIVE: "Cumulative Test" }[task.step as "REVISION" | "MASTERY" | "CUMULATIVE"];
    const msg =
      task.step === "REVISION"
        ? "তোমার ভুল ও অনিশ্চিত প্রশ্ন নিয়ে Revision Test। এটি শেষ করলেই Mastery Test খুলবে।"
        : failedLast
          ? `তোমার শেষ স্কোর ${bnNum(task.lastScore!, 0)}%। পরবর্তী ধাপ Unlock করতে ${bn(rules.get<number>(thrKey))}% প্রয়োজন। আবার অনুশীলন করো।`
          : `পাস করতে ${bn(rules.get<number>(thrKey))}% লাগবে। যতবার দরকার দিতে পারো।`;
    body = (
      <>
        <p className="text-lg">{msg}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Start taskKey={task.key} label={open ? `${label} চালিয়ে যাও` : `${label} শুরু করো`} />
          {task.step !== "REVISION" && <Start taskKey={task.key} label="ভুলগুলো অনুশীলন করো" mode="practice" primary={false} />}
        </div>
      </>
    );
  }

  return (
    <>
      <section aria-label="এখনকার কাজ" className="mt-10 rounded-xl border-2 border-green bg-surface p-5 sm:p-6">
        {error && ERR[error] && <p role="alert" className="mb-4 rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">{ERR[error]}</p>}
        {body}
      </section>
      {history.length > 0 && (
        <section aria-labelledby="hist" className="mt-10">
          <h2 id="hist" className="text-xl font-bold">আগের পরীক্ষা</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <span>
                  {ATTEMPT_KIND_BN[h.kind]}
                  {h.kind === "SOLVE" && `, ভাগ ${bn(h.partNo)}`}
                  <span className="ml-2 text-sm text-muted">{h.submittedAt!.toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}</span>
                </span>
                <Link href={`/result/${h.id}`} className={`font-semibold tabular underline-offset-4 hover:underline ${h.passed === false ? "text-danger" : "text-green"}`}>
                  {bnNum(h.scorePct ?? 0, 0)}%{h.passed === false ? " (পাস হয়নি)" : h.passed ? " (পাস)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
