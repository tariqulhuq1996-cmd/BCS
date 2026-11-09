import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "নতুন পাসওয়ার্ড", robots: { index: false } };

export default function ResetPage({ params }: PageProps<"/reset-password/[token]">) {
  return (
    <AuthShell title="নতুন পাসওয়ার্ড ঠিক করুন" lead="সংরক্ষণের পর অন্য সব ডিভাইস থেকে আপনি লগআউট হয়ে যাবেন।">
      <Suspense>
        <ResetForm params={params} />
      </Suspense>
    </AuthShell>
  );
}
