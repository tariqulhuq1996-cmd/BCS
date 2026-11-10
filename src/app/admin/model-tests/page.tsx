import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { approveModelTestsAction, generateModelTestsAction } from "@/lib/admin/actions";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Notice, STATUS_BN, btn, btnGhost, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Model Test — অ্যাডমিন", robots: { index: false } };

export default function ModelTestsAdmin({ searchParams }: PageProps<"/admin/model-tests">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

type BP = { subjects?: Record<string, number>; target?: Record<string, number>; difficulty?: Record<string, number>; warnings?: string[] };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/model-tests");
  const sp = await searchParams;
  const view = Number(sp.view) || 0;
  const [tests, topicPub, detail] = await Promise.all([
    prisma.modelTest.findMany({ orderBy: { no: "asc" }, select: { no: true, tier: true, status: true, blueprint: true, publishedAt: true, _count: { select: { questions: true } } } }),
    prisma.question.count({ where: { kind: "TOPIC", status: "PUBLISHED" } }),
    view ? prisma.modelTest.findUnique({ where: { no: view }, include: { questions: { orderBy: { position: "asc" }, include: { question: { select: { uid: true, text: true, kind: true, difficulty: true, subtopic: { select: { topic: { select: { subject: { select: { nameBn: true } } } } } } } } } } } }) : null,
  ]);
  const byNo = new Map(tests.map((t) => [t.no, t]));

  return (
    <>
      <AdminTitle title="Model Test" lead="খসড়া তৈরি → দেখে নিন → অনুমোদন (প্রকাশ)। প্রকাশিত টেস্ট আর বদলায় না, তাই Level ২-এর প্রশ্নভান্ডার যুক্ত ও প্রকাশ করার পরে তৈরি করুন।" />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}
      {topicPub === 0 && <Notice kind="error">Level ২-এর কোনো প্রশ্ন এখনও প্রকাশিত হয়নি। এখন তৈরি করলে টেস্টগুলো শুধু বিগত বিসিএসের প্রশ্ন থেকে আসবে।</Notice>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <form action={generateModelTestsAction} className="grid gap-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-bold">খসড়া তৈরি / নতুন করে তৈরি</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">শুরু<input name="from" type="number" min={1} max={150} defaultValue={1} className={`${input} w-24`} /></label>
            <label className="grid gap-1 text-sm">শেষ<input name="to" type="number" min={1} max={150} defaultValue={50} className={`${input} w-24`} /></label>
            <label className="grid gap-1 text-sm">বীজ<input name="seed" type="number" defaultValue={52} className={`${input} w-24`} /></label>
            <button className={btnGhost}>তৈরি করুন</button>
          </div>
          <p className="text-xs text-muted">একই বীজে একই টেস্ট। প্রকাশিত টেস্ট বাদ থাকে; শুধু খসড়াগুলো নতুন করে তৈরি হয়।</p>
        </form>
        <form action={approveModelTestsAction} className="grid gap-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-bold">অনুমোদন ও প্রকাশ</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">শুরু<input name="from" type="number" min={1} max={150} defaultValue={1} className={`${input} w-24`} /></label>
            <label className="grid gap-1 text-sm">শেষ<input name="to" type="number" min={1} max={150} defaultValue={50} className={`${input} w-24`} /></label>
            <button className={btn}>প্রকাশ করুন</button>
          </div>
          <p className="text-xs text-muted">প্রকাশের পর শিক্ষার্থীরা টেস্টটি দিতে পারবে এবং এটি আর বদলানো যাবে না।</p>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold">১৫০টি টেস্ট</h2>
        <ol className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10 lg:grid-cols-15">
          {Array.from({ length: 150 }, (_, i) => i + 1).map((no) => {
            const t = byNo.get(no);
            const warn = ((t?.blueprint as BP | undefined)?.warnings ?? []).length;
            return (
              <li key={no}>
                <Link
                  href={t ? `/admin/model-tests?view=${no}` : "#"}
                  title={t ? `${STATUS_BN[t.status]}${warn ? `, সতর্কতা ${warn}` : ""}` : "তৈরি হয়নি"}
                  className={`relative grid h-9 place-items-center rounded-md border text-xs tabular ${!t ? "border-dashed border-line-strong text-muted" : t.status === "PUBLISHED" ? "border-green bg-green text-white dark:text-paper" : "border-omr text-omr"} ${view === no ? "ring-2 ring-ink" : ""}`}
                >
                  {bn(no)}
                  {warn > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger" />}
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-muted">সবুজ: প্রকাশিত; গোলাপি: খসড়া; ড্যাশ: তৈরি হয়নি; লাল বিন্দু: প্রশ্ন-ঘাটতির সতর্কতা।</p>
      </section>

      {detail && (
        <section className="mt-8 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-xl font-bold">Model Test {bn(detail.no)} ({STATUS_BN[detail.status]}, স্তর {bn(detail.tier)})</h2>
          {(() => {
            const bp = detail.blueprint as BP;
            return (
              <>
                <p className="mt-2 text-[15px] text-ink-2">
                  বিষয়ভিত্তিক: {Object.entries(bp.subjects ?? {}).map(([c, n]) => `${c} ${bn(n)}/${bn(bp.target?.[c] ?? 0)}`).join(", ")}
                </p>
                <p className="mt-1 text-[15px] text-ink-2">কঠিনতা: সহজ {bn(bp.difficulty?.EASY ?? 0)}, মাঝারি {bn(bp.difficulty?.MEDIUM ?? 0)}, কঠিন {bn(bp.difficulty?.HARD ?? 0)}</p>
                <p className="mt-1 text-[15px] text-ink-2">উৎস: বিগত বিসিএস {bnNum(detail.questions.filter((q) => q.question.kind === "HISTORICAL").length)}টি, Level ২ {bnNum(detail.questions.filter((q) => q.question.kind === "TOPIC").length)}টি</p>
                {(bp.warnings ?? []).length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-danger">{bp.warnings!.map((w) => <li key={w}>{w}</li>)}</ul>}
              </>
            );
          })()}
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">সব ২০০টি প্রশ্ন</summary>
            <ol className="mt-2 grid gap-1 text-sm">
              {detail.questions.map((q) => (
                <li key={q.position} className="flex gap-2"><span className="w-8 shrink-0 text-right tabular text-muted">{bn(q.position)}</span><span className="line-clamp-1">{q.question.text}</span><span className="shrink-0 font-mono text-xs text-muted">{q.question.uid}</span></li>
              ))}
            </ol>
          </details>
        </section>
      )}
    </>
  );
}
