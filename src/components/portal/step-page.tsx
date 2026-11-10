import Link from "next/link";
import type { ReactNode } from "react";
import { bn } from "@/lib/bn";
import { LOCKED_MESSAGE, type StepKey } from "@/lib/progress/cycle";
import type { TaskView } from "@/lib/progress/dashboard";

const ORDER: StepKey[] = ["SOLVE", "REVIEW", "REVISION", "MASTERY", "CUMULATIVE", "DONE"];

/** তালাবন্ধ ধাপে প্রবেশের চেষ্টা: প্রশ্ন বা বিষয়বস্তু নয়, শুধু বার্তা ও বর্তমান কাজের লিংক। */
export function LockedNotice({ title, current }: { title: string; current: TaskView | null }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-16 text-center sm:px-6">
      <span className="mx-auto grid size-14 place-items-center rounded-full border-2 border-dashed border-line-strong text-2xl text-muted" aria-hidden="true">
        ⊘
      </span>
      <h1 className="mt-5 text-[28px] font-extrabold">{title}</h1>
      <p className="mt-3 text-lg text-ink-2">{LOCKED_MESSAGE}</p>
      {current && (
        <Link href={current.href} className="mt-8 inline-block rounded-lg bg-green px-6 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper">
          বর্তমান কাজে যাও: {current.title}
        </Link>
      )}
    </section>
  );
}

/** একটি খোলা কাজের পাতা: Learning Cycle-এর ধাপগুলো, কোনটি শেষ/চলছে/বাকি। */
export function StepPage({
  task, levelLabel, steps, facts, children,
}: {
  task: TaskView;
  levelLabel: string;
  steps: readonly { key: string; label: string; desc: string }[];
  facts: { k: string; v: string }[];
  children?: ReactNode;
}) {
  const curIdx = task.state === "COMPLETED" ? Infinity : ORDER.indexOf(task.step);
  return (
    <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <p className="text-sm text-muted">{levelLabel}</p>
      <h1 className="mt-1 text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>
        {task.title}
      </h1>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
        {facts.map((f) => (
          <div key={f.k}>
            <dt className="text-sm text-muted">{f.k}</dt>
            <dd className="font-semibold">{f.v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-xl font-bold">Learning Cycle</h2>
      <ol className="mt-4 grid gap-0">
        {steps.map((s, i) => {
          const idx = ORDER.indexOf(s.key as StepKey);
          const status = idx < curIdx ? "done" : idx === curIdx ? "current" : "todo";
          return (
            <li key={s.key} className="relative grid grid-cols-[2.5rem_1fr] gap-4 pb-6 last:pb-0">
              {i < steps.length - 1 && <span className="absolute left-5 top-10 bottom-0 w-px bg-line-strong" aria-hidden="true" />}
              <span
                className={`relative z-10 grid size-10 place-items-center rounded-full border-2 text-sm font-semibold ${
                  status === "done" ? "border-green bg-green text-white dark:text-paper" : status === "current" ? "border-omr bg-omr-wash text-omr" : "border-line-strong bg-surface text-muted"
                }`}
                aria-hidden="true"
              >
                {bn(i + 1)}
              </span>
              <div className="pt-1.5">
                <p className="font-semibold">
                  {s.label}
                  <span className="ml-2 text-sm font-normal text-muted">{status === "done" ? "সম্পন্ন" : status === "current" ? "এখন" : "বাকি"}</span>
                </p>
                <p className="text-[15px] text-ink-2">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {children}
    </section>
  );
}

/** Phase 05-এর আগে: পরীক্ষা-ইঞ্জিন এখনও যুক্ত হয়নি — সৎভাবে জানানো। */
export function EngineComingNotice() {
  return (
    <p className="mt-10 rounded-lg border border-line bg-surface px-4 py-3 text-[15px] text-ink-2">
      প্রশ্ন সমাধানের পরীক্ষা-পর্দা পরের ধাপে (Phase 05) যুক্ত হচ্ছে। তখন এখান থেকেই প্রশ্ন সমাধান শুরু করা যাবে, আর তোমার অগ্রগতি স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।
    </p>
  );
}
