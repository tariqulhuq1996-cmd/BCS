import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { getStudentTasks, pickCurrent } from "@/lib/progress/dashboard";
import { manualUnlockAction, sendResetAction, setDisabledAction } from "@/lib/admin/actions";
import { ATTEMPT_KIND_BN } from "@/lib/progress/cycle";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Notice, btn, btnGhost, input } from "@/components/admin/ui";
import { ProgressBar } from "@/components/portal/progress-bar";

export const metadata: Metadata = { title: "শিক্ষার্থী — অ্যাডমিন", robots: { index: false } };

export default function StudentAdmin({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("/admin/students");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const u = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
  if (!u) notFound();
  const [tasks, attempts, overrides, wrongBank] = await Promise.all([
    getStudentTasks(id),
    prisma.testAttempt.findMany({ where: { userId: id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 15, include: { task: { select: { titleBn: true } } } }),
    prisma.studentTaskProgress.findMany({ where: { userId: id, overrideBy: { not: null } }, include: { task: { select: { key: true, titleBn: true } } } }),
    prisma.questionStat.count({ where: { userId: id, wrong: { gt: 0 }, lastCorrect: false } }),
  ]);
  const current = pickCurrent(tasks);
  const levels = [1, 2, 3].map((no) => {
    const lt = tasks.filter((t) => t.levelNo === no);
    return { no, total: lt.length, done: lt.filter((t) => t.state === "COMPLETED").length };
  });

  return (
    <>
      <p className="text-sm"><Link href="/admin/students" className="text-green underline">শিক্ষার্থীর তালিকা</Link></p>
      <AdminTitle title={u.profile?.name ?? u.email} lead={`${u.email}${u.profile?.phone ? `, ${u.profile.phone}` : ""}। অ্যাকাউন্ট ${u.createdAt.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}${u.disabled ? " — বন্ধ" : ""}।`} />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {levels.map((l) => (
          <div key={l.no} className="rounded-lg border border-line bg-surface p-4">
            <p className="font-semibold">Level {bn(l.no)}</p>
            <ProgressBar pct={l.total ? (l.done / l.total) * 100 : 0} label={`Level ${bn(l.no)}`} />
            <p className="mt-1 text-sm text-ink-2">{bn(l.done)}/{bn(l.total)} ধাপ</p>
          </div>
        ))}
      </section>
      <p className="mt-4 text-[15px]">বর্তমান কাজ: <b>{current?.title ?? "—"}</b>{current && <span className="text-ink-2"> (ধাপ: {current.step}, শেষ স্কোর {current.lastScore != null ? `${bnNum(current.lastScore, 0)}%` : "—"})</span>}। ভুলের ভান্ডারে {bnNum(wrongBank)}টি প্রশ্ন।</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <form action={manualUnlockAction} className="grid gap-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-bold">হাতে Unlock (বিশেষ পরিস্থিতি)</h2>
          <input type="hidden" name="userId" value={u.id} />
          <label className="grid gap-1 text-sm">কাজের key<input name="taskKey" placeholder="L1:EXAM:15" className={`${input} font-mono`} required /></label>
          <p className="text-xs text-muted">শুধু ঐ ধাপ খোলে; আগের ধাপগুলো সম্পন্ন দেখায় না। Audit Log-এ আপনার নামসহ থাকে।</p>
          <div><button className={btn}>Unlock করুন</button></div>
        </form>
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-bold">অ্যাকাউন্ট</h2>
          <form action={sendResetAction}><input type="hidden" name="userId" value={u.id} /><button className={btnGhost}>পাসওয়ার্ড রিসেটের লিংক পাঠান</button></form>
          {u.id !== me.id && (
            <form action={setDisabledAction}>
              <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="disabled" value={u.disabled ? "0" : "1"} />
              <button className={`${btnGhost} ${u.disabled ? "" : "text-danger"}`}>{u.disabled ? "অ্যাকাউন্ট আবার চালু করুন" : "অ্যাকাউন্ট বন্ধ করুন (সব ডিভাইস থেকে লগআউট)"}</button>
            </form>
          )}
        </div>
      </div>

      {overrides.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">হাতে খোলা ধাপ</h2>
          <ul className="mt-2 text-[15px]">{overrides.map((o) => <li key={o.taskId}>{o.task.titleBn} <span className="font-mono text-xs text-muted">{o.task.key}</span> — {o.overrideAt?.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</li>)}</ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold">সাম্প্রতিক পরীক্ষা</h2>
        {attempts.length ? (
          <ul className="mt-2 divide-y divide-line border-y border-line text-[15px]">
            {attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>{a.task?.titleBn ?? ""} ({ATTEMPT_KIND_BN[a.kind]})</span>
                <span className="tabular text-ink-2">{a.kind === "MODEL_TEST" ? `নেট ${bnNum(a.netScore ?? 0, 1)}` : `${bnNum(a.scorePct ?? 0, 0)}%`}{a.passed === false ? " (পাস হয়নি)" : ""} — {a.submittedAt!.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-ink-2">এখনও কোনো পরীক্ষা নেই।</p>}
      </section>
    </>
  );
}
