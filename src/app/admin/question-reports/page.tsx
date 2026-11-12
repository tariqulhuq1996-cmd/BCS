import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { resolveReportAction } from "@/lib/admin/actions";
import { REPORT_REASONS, type ReportReason } from "@/lib/student/reasons";
import { bn } from "@/lib/bn";
import { AdminTitle, Notice, btnGhost, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "প্রশ্নে অভিযোগ — অ্যাডমিন", robots: { index: false } };

const TABS = [
  { k: "OPEN", label: "খোলা" },
  { k: "FIXED", label: "ঠিক করা হয়েছে" },
  { k: "DISMISSED", label: "বাতিল" },
] as const;

export default function QuestionReportsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

const when = (d: Date) => d.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/question-reports");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === sp.status)?.k ?? "OPEN";
  const [counts, reports] = await Promise.all([
    prisma.questionReport.groupBy({ by: ["status"], _count: true }),
    prisma.questionReport.findMany({
      where: { status: tab },
      orderBy: { createdAt: tab === "OPEN" ? "asc" : "desc" },
      take: 100,
      include: {
        user: { select: { email: true, profile: { select: { name: true } } } },
        question: { select: { id: true, uid: true, text: true, options: true, correctIndex: true, _count: { select: { reports: { where: { status: "OPEN" } } } } } },
      },
    }),
  ]);
  const count = (k: string) => counts.find((c) => c.status === k)?._count ?? 0;

  return (
    <>
      <AdminTitle title="প্রশ্নে অভিযোগ" lead="শিক্ষার্থীরা ফলাফলের পাতা থেকে যেসব প্রশ্নে ভুল জানিয়েছেন। প্রশ্নটি সম্পাদনা করে ঠিক করুন, তারপর এখানে চিহ্নিত করুন।" />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}
      <nav aria-label="অবস্থা" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={`/admin/question-reports?status=${t.k}`}
            aria-current={tab === t.k ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1 text-sm ${tab === t.k ? "border-green bg-green text-white dark:text-paper" : "border-line text-ink-2 hover:border-green"}`}
          >
            {t.label} ({bn(count(t.k))})
          </Link>
        ))}
      </nav>
      {reports.length === 0 && <p className="mt-6 text-ink-2">এই তালিকায় কোনো অভিযোগ নেই।</p>}
      <ul className="mt-5 grid gap-4">
        {reports.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted">
              <span>
                <span className="font-semibold text-danger">{REPORT_REASONS[r.reason as ReportReason] ?? r.reason}</span> · {r.user.profile?.name ?? r.user.email} · {when(r.createdAt)}
              </span>
              <span>
                {r.question.uid}
                {r.question._count.reports > 1 && tab === "OPEN" && <span className="ml-2 font-semibold text-danger">এই প্রশ্নে মোট {bn(r.question._count.reports)}টি খোলা অভিযোগ</span>}
              </span>
            </div>
            <p className="mt-2 font-semibold leading-relaxed">{r.question.text}</p>
            <ol className="mt-2 grid gap-1 text-[15px] sm:grid-cols-2">
              {r.question.options.map((o, k) => (
                <li key={k} className={k === r.question.correctIndex ? "font-semibold text-green" : "text-ink-2"}>
                  {["ক", "খ", "গ", "ঘ"][k]}. {o}
                  {k === r.question.correctIndex && " (বর্তমান সঠিক উত্তর)"}
                </li>
              ))}
            </ol>
            {r.note && <p className="mt-3 whitespace-pre-line rounded-md bg-paper px-3 py-2 text-[15px]"><span className="font-semibold">শিক্ষার্থীর বিবরণ: </span>{r.note}</p>}
            {r.adminNote && <p className="mt-2 text-[15px] text-ink-2"><span className="font-semibold">অ্যাডমিনের নোট: </span>{r.adminNote}</p>}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Link href={`/admin/questions/${r.question.id}`} className={btnGhost}>প্রশ্নটি সম্পাদনা করুন</Link>
              {tab === "OPEN" && (
                <form action={resolveReportAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="adminNote" placeholder="নোট (ঐচ্ছিক)" aria-label="অ্যাডমিনের নোট" className={`${input} w-56`} />
                  <button name="status" value="FIXED" className="rounded-md bg-green px-3 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong dark:text-paper">ঠিক করা হয়েছে</button>
                  <button name="status" value="DISMISSED" className={btnGhost}>ভুল পাওয়া যায়নি</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
