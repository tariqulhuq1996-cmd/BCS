import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadTaskForPage } from "@/lib/progress/access";
import { getResultView } from "@/lib/exam/service";
import { acknowledgeReviewAction } from "@/lib/exam/actions";
import { requireUser } from "@/lib/auth/session";
import { bn, bnNum } from "@/lib/bn";
import { ResultBody } from "@/components/exam/result-body";
import { LockedNotice } from "@/components/portal/step-page";

export const metadata: Metadata = { title: "উত্তর পর্যালোচনা" };

export default function ReviewPage({ params }: PageProps<"/level-1/[bcsNo]/review">) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

/** প্রথম সমাধানের সব ভাগ মিলিয়ে পর্যালোচনা ও ভুলের বিশ্লেষণ; শেষে Revision-ধাপে যাওয়া। */
async function Content({ params }: { params: Promise<{ bcsNo: string }> }) {
  const { bcsNo } = await params;
  if (!/^\d{2}$/.test(bcsNo)) notFound();
  const key = `L1:EXAM:${bcsNo}`;
  const { task, locked, current } = await loadTaskForPage(key, `/level-1/${bcsNo}/review`);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const user = await requireUser();
  const solved = await prisma.testAttempt.findMany({ where: { userId: user.id, taskId: task.id, kind: "SOLVE", submittedAt: { not: null } }, orderBy: { partNo: "asc" }, distinct: ["partNo"] });
  if (!solved.length)
    return <p className="text-ink-2">এখনও প্রথম সমাধান হয়নি। আগে প্রশ্নগুলো সমাধান করো।</p>;
  const r = await getResultView(prisma, user.id, solved.map((s) => s.id));

  return (
    <>
      <p className="text-sm text-muted">{task.title}: প্রথম সমাধানের পর্যালোচনা ({bn(solved.length)}টি ভাগ মিলিয়ে)</p>
      <h1 className="mt-2 font-display text-[48px] font-extrabold leading-none tabular">{bnNum(r.scorePct, 0)}%</h1>
      <p className="mt-2 text-lg text-ink-2">{bn(r.total)}টির মধ্যে {bn(r.correct)}টি সঠিক</p>
      {task.step === "REVIEW" && (
        <form action={acknowledgeReviewAction} className="mt-6 rounded-xl border-2 border-green bg-surface p-5 sm:p-6">
          <input type="hidden" name="taskKey" value={key} />
          <p className="text-lg">নিচে প্রতিটি ভুল প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা পড়ো। পড়া শেষ হলে Revision Test-এ যাও; সেখানে এই ভুলগুলোই আগে আসবে।</p>
          <button className="mt-4 rounded-lg bg-green px-5 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper">পর্যালোচনা শেষ, Revision-এ যাও</button>
        </form>
      )}
      <ResultBody r={r} />
    </>
  );
}
