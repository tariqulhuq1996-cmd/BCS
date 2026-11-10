import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReviewContent } from "@/components/exam/review-content";

export const metadata: Metadata = { title: "উত্তর পর্যালোচনা" };

export default function ReviewPage({ params }: PageProps<"/level-2/[code]/review">) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Z]{2}\.[A-Z]{2}\.[A-Z0-9]{3}$/.test(code)) notFound();
  return <ReviewContent taskKey={`L2:SUB:${code}`} path={`/level-2/${code}/review`} />;
}
