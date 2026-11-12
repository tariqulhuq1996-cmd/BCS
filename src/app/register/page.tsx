import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { RegisterForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "অ্যাকাউন্ট খুলুন" };

export default function RegisterPage() {
  return (
    <AuthShell title="৫২তম BCS-এর প্রস্তুতি শুরু করুন" lead="একটি অ্যাকাউন্টে আপনার প্রতিটি পরীক্ষা, ভুল ও অগ্রগতি সংরক্ষিত থাকবে।">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
