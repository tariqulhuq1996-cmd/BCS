import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadTaskForPage } from "@/lib/progress/access";
import { getResultView } from "@/lib/exam/service";
import { acknowledgeReviewAction } from "@/lib/exam/actions";
import { bn, bnNum } from "@/lib/bn";
import { ResultBody } from "./result-body";
import { LockedNotice } from "@/components/portal/step-page";

/** প্রথম সমাধানের সব ভাগ মিলিয়ে পর্যালোচনা ও ভুলের বিশ্লেষণ; শেষে Revision-ধাপে যাওয়া (Level 1 ও 2)। */
export async function ReviewContent({ taskKey, path }: { taskKey: string; path: string }) {
  const { task, locked, current } = await loadTaskForPage(taskKey, path);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const user = await requireUser();
  const solved = await prisma.testAttempt.findMany({ where: { userId: user.id, taskId: task.id, kind: "SOLVE", submittedAt: { not: null } }, orderBy: { partNo: "asc" } });
  if (!solved.length) return <p className="text-ink-2">এখনও প্রথম সমাধান হয়নি। আগে প্রশ্নগুলো সমাধান করো।</p>;
  const r = await getResultView(prisma, user.id, solved.map((s) => s.id));
  return (
    <>
      <p className="text-sm text-muted">{task.title}: প্রথম সমাধানের পর্যালোচনা{solved.length > 1 ? ` (${bn(solved.length)}টি ভাগ মিলিয়ে)` : ""}</p>
      <h1 className="mt-2 font-display text-[48px] font-extrabold leading-none tabular">{bnNum(r.scorePct, 0)}%</h1>
      <p className="mt-2 text-lg text-ink-2">{bn(r.total)}টির মধ্যে {bn(r.correct)}টি সঠিক</p>
      {task.step === "REVIEW" && task.state !== "COMPLETED" && (
        <form action={acknowledgeReviewAction} className="mt-6 rounded-xl border-2 border-green bg-surface p-5 sm:p-6">
          <input type="hidden" name="taskKey" value={taskKey} />
          <p className="text-lg">নিচে প্রতিটি ভুল প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা পড়ো। পড়া শেষ হলে Revision Test-এ যাও; সেখানে এই ভুলগুলোই আগে আসবে।</p>
          <button className="mt-4 rounded-lg bg-green px-5 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper">পর্যালোচনা শেষ, Revision-এ যাও</button>
        </form>
      )}
      <ResultBody r={r} />
    </>
  );
}
