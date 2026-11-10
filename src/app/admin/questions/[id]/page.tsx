import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { bn } from "@/lib/bn";
import { AdminTitle } from "@/components/admin/ui";
import { QuestionForm } from "@/components/admin/question-form";

export const metadata: Metadata = { title: "প্রশ্ন সম্পাদনা — অ্যাডমিন", robots: { index: false } };

export default function EditQuestionPage({ params }: PageProps<"/admin/questions/[id]">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/admin/questions");
  const { id } = await params;
  const q = await prisma.question.findUnique({ where: { id }, include: { subtopic: true, exam: true, families: { include: { family: true } } } });
  if (!q) notFound();
  const [stats, history] = await Promise.all([
    prisma.questionStat.aggregate({ where: { questionId: id }, _sum: { seen: true, correct: true, wrong: true } }),
    prisma.auditLog.findMany({ where: { entity: "Question", entityId: q.uid }, orderBy: { at: "desc" }, take: 5 }),
  ]);
  const seen = stats._sum.seen ?? 0;
  return (
    <>
      <p className="text-sm"><Link href="/admin/questions" className="text-green underline">প্রশ্নের তালিকা</Link></p>
      <AdminTitle title={q.uid} lead={`${q.kind === "HISTORICAL" ? `বিগত বিসিএস${q.exam ? ` (${bn(q.exam.bcsNo)}তম, প্রশ্ন ${bn(q.examQNo ?? "")})` : ""}` : "Level ২ প্রশ্ন"}। শিক্ষার্থীরা ${bn(seen)} বার উত্তর দিয়েছে${seen ? `, সঠিক ${bn(Math.round(((stats._sum.correct ?? 0) / seen) * 100))}%` : ""}।`} />
      {q.families.length > 0 && <p className="mt-2 text-sm text-ink-2">পুনরাবৃত্ত প্রশ্ন-পরিবারের অংশ ({q.families[0].family.refs})।</p>}
      <QuestionForm
        q={{
          id: q.id, uid: q.uid, text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, explanationStatus: q.explanationStatus,
          status: q.status, difficulty: q.difficulty, source: q.source, verifyNote: q.verifyNote, subtopicCode: q.subtopic.code,
        }}
      />
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">সম্পাদনার ইতিহাস</h2>
          <ul className="mt-2 text-sm text-ink-2">{history.map((h) => <li key={String(h.id)}>{h.at.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}: {h.action}</li>)}</ul>
        </section>
      )}
    </>
  );
}
