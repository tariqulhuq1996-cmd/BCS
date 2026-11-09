import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "লগইন" };

export default function LoginPage() {
  return (
    <AuthShell title="লগইন করুন" lead="যেখানে থেমেছিলেন, সেখান থেকেই প্রস্তুতি চালিয়ে যান।">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
