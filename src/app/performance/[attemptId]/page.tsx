import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ExamError } from "@/lib/exam/service";
import { getExamReport, type ExamReport } from "@/lib/exam/performance";
import { bn } from "@/lib/bn";
import { BackLink } from "@/components/site/back-link";
import { bnDate } from "@/components/performance/ui";
import { ExamAnalysis } from "@/components/performance/exam-analysis";

export const metadata: Metadata = { title: "পরীক্ষা-পরবর্তী বিশ্লেষণ", robots: { index: false } };

export default function ExamAnalysisPage({ params }: PageProps<"/performance/[attemptId]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <BackLink href="/performance" label="Performance Dashboard" />
      <Suspense fallback={<p className="text-ink-2">বিশ্লেষণ লোড হচ্ছে…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser(`/performance/${attemptId}`);
  let r: ExamReport;
  try {
    r = await getExamReport(prisma, user.id, attemptId);
  } catch (e) {
    if (e instanceof ExamError && e.code === "NOT_READY") redirect(`/test/${attemptId}`);
    if (e instanceof ExamError) notFound();
    throw e;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold sm:text-[36px]" style={{ fontStretch: "110%" }}>পরীক্ষা-পরবর্তী বিশ্লেষণ</h1>
          <p className="mt-1 text-ink-2">{r.title} · {bn(r.snapshot.total)}টি প্রশ্ন · জমা {bnDate(r.date)}</p>
        </div>
        <Link href={`/result/${r.id}`} className="rounded-lg border-2 border-green px-4 py-2 font-semibold text-green hover:bg-green-wash">প্রশ্নভিত্তিক উত্তর ও ব্যাখ্যা</Link>
      </div>
      <ExamAnalysis r={r} />
    </>
  );
}
