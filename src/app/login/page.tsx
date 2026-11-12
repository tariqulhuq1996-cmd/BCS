import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "লগইন" };

export default function LoginPage() {
  return (
    <AuthShell title="লগইন করুন" lead="আবার স্বাগতম। যেখানে থেমেছিলেন, সেখান থেকেই শুরু করুন।">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
