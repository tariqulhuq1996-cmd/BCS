import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { SignedOutOnly } from "@/components/auth/redirect-if-signed-in";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "লগইন" };

export default function LoginPage() {
  // পুরো পাতাটিই শুধু লগইন ছাড়া ব্যবহারকারীর জন্য — লগইন করা থাকলে শিরোনামও না দেখিয়ে Dashboard-এ
  return (
    <Suspense>
      <SignedOutOnly>
        <AuthShell title="লগইন করুন" lead="আবার স্বাগতম। যেখানে থেমেছিলেন, সেখান থেকেই শুরু করুন।">
          <Suspense>
            <LoginForm />
          </Suspense>
        </AuthShell>
      </SignedOutOnly>
    </Suspense>
  );
}
