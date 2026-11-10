import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ExamError, getAttemptView } from "@/lib/exam/service";
import { TestRunner } from "@/components/exam/test-runner";

export const metadata: Metadata = { title: "পরীক্ষা চলছে", robots: { index: false } };

export default function TestPage({ params }: PageProps<"/test/[attemptId]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-ink-2">প্রশ্ন লোড হচ্ছে…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireUser(`/test/${attemptId}`);
  let view;
  try {
    view = await getAttemptView(prisma, user.id, attemptId);
  } catch (e) {
    if (e instanceof ExamError) notFound(); // অন্যের বা অস্তিত্বহীন পরীক্ষা
    throw e;
  }
  if (view.submitted) redirect(`/result/${attemptId}`);
  return <TestRunner attemptId={view.id} title={view.title} questions={view.questions} deadlineAt={view.deadlineAt} />;
}
