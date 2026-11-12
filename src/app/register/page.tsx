import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { SignedOutOnly } from "@/components/auth/redirect-if-signed-in";
import { RegisterForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "অ্যাকাউন্ট খুলুন" };

export default function RegisterPage() {
  // পুরো পাতাটিই শুধু লগইন ছাড়া ব্যবহারকারীর জন্য — লগইন করা থাকলে শিরোনামও না দেখিয়ে Dashboard-এ
  return (
    <Suspense>
      <SignedOutOnly>
        <AuthShell title="৫২তম BCS-এর প্রস্তুতি শুরু করুন" lead="একটি অ্যাকাউন্টে আপনার প্রতিটি পরীক্ষা, ভুল ও অগ্রগতি সংরক্ষিত থাকবে।">
          <Suspense>
            <RegisterForm />
          </Suspense>
        </AuthShell>
      </SignedOutOnly>
    </Suspense>
  );
}
