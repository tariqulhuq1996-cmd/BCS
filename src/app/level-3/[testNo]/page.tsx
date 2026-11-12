import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadRules } from "@/lib/rules";
import { loadTaskForPage } from "@/lib/progress/access";
import { startStepAction } from "@/lib/exam/actions";
import { bn, bnNum } from "@/lib/bn";
import { LockedNotice } from "@/components/portal/step-page";

export const metadata: Metadata = { title: "Model Test" };

const ERR: Record<string, string> = {
  EMPTY: "এই Model Test এখনও প্রকাশিত হয়নি।",
  NEED_REVIEW: "আগের চেষ্টার ভুলগুলো পর্যালোচনা শেষ করুন, তারপর আবার দিন।",
  SUBMITTED: "এই টেস্ট আগেই সম্পন্ন।",
};

export default function ModelTestPage({ params, searchParams }: PageProps<"/level-3/[testNo]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function Start({ taskKey, label, mode = "step", primary = true }: { taskKey: string; label: string; mode?: string; primary?: boolean }) {
  return (
    <form action={startStepAction} className="inline-block">
      <input type="hidden" name="taskKey" value={taskKey} />
      <input type="hidden" name="mode" value={mode} />
      <button className={primary ? "rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper" : "rounded-lg border-2 border-green px-5 py-2.5 font-semibold text-green hover:bg-green-wash"}>{label}</button>
    </form>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ testNo: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ testNo }, sp] = await Promise.all([params, searchParams]);
  const no = Number(testNo);
  if (!Number.isInteger(no) || no < 1 || no > 150) notFound();
  const key = `L3:MT:${String(no).padStart(3, "0")}`;
  const { task, locked, current } = await loadTaskForPage(key, `/level-3/${no}`);
  if (locked) return <LockedNotice title={task.title} current={current} />;
  const user = await requireUser();
  const [rules, dbTask, attempts] = await Promise.all([
    loadRules(prisma),
    prisma.learningTask.findUniqueOrThrow({ where: { key }, include: { modelTest: true } }),
    prisma.testAttempt.findMany({ where: { userId: user.id, taskId: task.id, kind: "MODEL_TEST" }, orderBy: { startedAt: "desc" } }),
  ]);
  const mt = dbTask.modelTest;
  const open = attempts.find((a) => !a.submittedAt);
  const unreviewed = attempts.find((a) => a.submittedAt && !a.reviewedAt);
  const err = typeof sp.e === "string" ? ERR[sp.e] : undefined;
  const mix = rules.get<Record<string, number[]>>("l3.difficulty_mix")[String(task.phase ?? 1)];

  let body: React.ReactNode;
  if (!mt || mt.status !== "PUBLISHED") body = <p className="text-lg">এই Model Test এখনও প্রকাশিত হয়নি। Level ২-এর প্রশ্নভান্ডার যুক্ত হলে তৈরি ও যাচাই করে প্রকাশ করা হবে।</p>;
  else if (open) body = (<><p className="text-lg">টেস্ট চলছে। সময় চলতে থাকে; পাতা বন্ধ করলেও সময়সীমা শেষে সংরক্ষিত উত্তর দিয়ে নিজে থেকে জমা হয়ে যাবে।</p><div className="mt-4"><Link href={`/test/${open.id}`} className="inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white dark:text-paper">টেস্ট চালিয়ে যান</Link></div></>);
  else if (unreviewed && task.state !== "COMPLETED") body = (<><p className="text-lg">জমা হয়েছে। পরের টেস্ট খুলতে আগে ভুলগুলো পর্যালোচনা করুন।</p><div className="mt-4"><Link href={`/result/${unreviewed.id}`} className="inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white dark:text-paper">ফলাফল ও পর্যালোচনা</Link></div></>);
  else if (task.state === "COMPLETED") body = (<><p className="text-lg">এই টেস্ট সম্পন্ন। চাইলে আবার দিতে পারেন; নতুন চেষ্টাও স্তর-গেটের গড়ে গোনা হবে।</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/dashboard" className="rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white dark:text-paper">পরবর্তী কাজে যান</Link><Start taskKey={key} label="আবার দিন" mode="practice" primary={false} /></div></>);
  else body = (<><p className="text-lg">প্রস্তুত হলে শুরু করুন। শুরু করার সঙ্গে সঙ্গে {bn(mt.durationMin)} মিনিটের সময় চালু হবে, আর থামানো যাবে না।</p><div className="mt-4"><Start taskKey={key} label="টেস্ট শুরু করুন" /></div></>);

  return (
    <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <p className="text-sm text-muted">Level ৩, স্তর {bn(task.phase ?? 1)}</p>
      <h1 className="mt-1 text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>{task.title}</h1>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
        {[
          ["প্রশ্ন", "২০০টি (নতুন মানবণ্টনে)"],
          ["সময়", `${bn(mt?.durationMin ?? rules.get<number>("l3.duration_min"))} মিনিট`],
          ["নেগেটিভ মার্কিং", `প্রতিটি ভুলে ${bn(mt?.negativeMark ?? rules.get<number>("l3.negative_mark"))}`],
          ["কঠিনতা", `সহজ ${bn(mix[0])}%, মাঝারি ${bn(mix[1])}%, কঠিন ${bn(mix[2])}%`],
        ].map(([k, v]) => (
          <div key={k}><dt className="text-sm text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      <section aria-label="এখনকার কাজ" className="mt-8 rounded-xl border-2 border-green bg-surface p-5 sm:p-6">
        {err && <p role="alert" className="mb-4 rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">{err}</p>}
        {body}
      </section>
      {attempts.some((a) => a.submittedAt) && (
        <section aria-labelledby="hist" className="mt-10">
          <h2 id="hist" className="text-xl font-bold">আগের চেষ্টা</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {attempts.filter((a) => a.submittedAt).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <span>{a.submittedAt!.toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}<span className="ml-2 text-sm text-muted">{a.reviewedAt ? "পর্যালোচিত" : "পর্যালোচনা বাকি"}</span></span>
                <Link href={`/result/${a.id}`} className="font-semibold tabular text-green underline-offset-4 hover:underline">নেট {bnNum(a.netScore ?? 0, 1)}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
