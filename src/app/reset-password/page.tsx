import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/ui";
import { ResetRequestForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "পাসওয়ার্ড রিসেট" };

export default function ResetRequestPage() {
  return (
    <AuthShell title="পাসওয়ার্ড রিসেট" lead="অ্যাকাউন্টের ইমেইল দিন। নতুন পাসওয়ার্ড ঠিক করার একটি লিংক পাঠানো হবে।">
      <ResetRequestForm />
    </AuthShell>
  );
}
