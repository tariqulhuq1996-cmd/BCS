import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReviewContent } from "@/components/exam/review-content";

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

async function Content({ params }: { params: Promise<{ bcsNo: string }> }) {
  const { bcsNo } = await params;
  if (!/^\d{2}$/.test(bcsNo)) notFound();
  return <ReviewContent taskKey={`L1:EXAM:${bcsNo}`} path={`/level-1/${bcsNo}/review`} />;
}
