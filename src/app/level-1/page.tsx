import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { getStudentTasks } from "@/lib/progress/dashboard";
import { bn, bnOrdinal } from "@/lib/bn";
import { ExamBubbles } from "@/components/portal/exam-bubbles";
import { ProgressBar } from "@/components/portal/progress-bar";

export const metadata: Metadata = { title: "Level ১: বিগত BCS-এর প্রশ্ন" };

const STATE_BN: Record<string, string> = { COMPLETED: "সম্পন্ন", IN_PROGRESS: "চলছে", AVAILABLE: "খোলা", LOCKED: "তালাবন্ধ" };
const STEP_BN: Record<string, string> = { SOLVE: "প্রশ্ন সমাধান", REVIEW: "পর্যালোচনা", REVISION: "Revision", MASTERY: "Mastery Test", CUMULATIVE: "Cumulative Test", DONE: "সম্পন্ন" };

export default function Level1Page() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>Level ১: বিগত BCS-এর প্রশ্ন আয়ত্ত</h1>
      <p className="mt-2 max-w-2xl text-ink-2">১০ম থেকে ৫০তম BCS, একটির পর একটি। প্রতিটির Learning Cycle শেষ করে নির্ধারিত নম্বর পেলে পরেরটি খোলে।</p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  const user = await requireUser("/level-1");
  const tasks = (await getStudentTasks(user.id)).filter((t) => t.levelNo === 1);
  const done = tasks.filter((t) => t.state === "COMPLETED").length;
  return (
    <>
      <div className="mt-6 max-w-xl">
        <ProgressBar pct={(done / tasks.length) * 100} label="Level ১-এর অগ্রগতি" />
        <p className="mt-2 text-sm text-ink-2">{bn(done)}/{bn(tasks.length)} ধাপ সম্পন্ন</p>
      </div>
      <div className="mt-8">
        <ExamBubbles items={tasks.map((t) => ({ key: t.key, bcsNo: t.bcsNo, title: t.title, state: t.state, href: t.href, special: t.special, partial: t.partial, bestScore: t.bestScore }))} />
      </div>
      <ol className="mt-8 divide-y divide-line border-y border-line">
        {tasks.map((t) => (
          <li key={t.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
            <span className="font-medium">
              {t.bcsNo ? `${bnOrdinal(t.bcsNo)} BCS` : t.title}
              {t.special && <span className="ml-2 rounded-full border border-omr px-2 text-xs text-omr">বিশেষ</span>}
              {t.partial && <span className="ml-2 rounded-full border border-danger px-2 text-xs text-danger">আংশিক</span>}
            </span>
            <span className="flex items-center gap-4 text-sm">
              <span className="text-ink-2">
                {STATE_BN[t.state]}
                {(t.state === "IN_PROGRESS" || t.state === "AVAILABLE") && `, ধাপ: ${STEP_BN[t.step]}`}
                {t.bestScore != null && `, সেরা ${bn(Math.round(t.bestScore))}%`}
              </span>
              {t.state !== "LOCKED" && (
                <Link href={t.href} className="text-green underline underline-offset-4">{t.state === "COMPLETED" ? "দেখো" : "খোলো"}</Link>
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
