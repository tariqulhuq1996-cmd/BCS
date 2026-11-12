import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/ui";
import { ResendForm, VerifyForm } from "@/components/auth/forms";
import { cancelSignup, logout } from "@/lib/auth/actions";
import { getCurrentUser, getPendingSignup, getPendingUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "ইমেইল যাচাই", robots: { index: false } };

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-5xl px-4 pt-12 text-ink-2 sm:px-6">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  // নতুন নিবন্ধন (অ্যাকাউন্ট এখনো খোলা হয়নি) অথবা পুরোনো যাচাই-বাকি অ্যাকাউন্ট
  const signup = await getPendingSignup();
  const user = signup ? null : await getPendingUser();
  if (!signup && !user) redirect((await getCurrentUser()) ? next : `/register`);
  const email = signup?.email ?? user!.email;
  return (
    <AuthShell
      title="ইমেইল যাচাই করুন"
      lead={
        <>
          <span className="font-semibold text-ink">{email}</span> ঠিকানায় একটি ৬ সংখ্যার কোড পাঠানো হয়েছে। কোডটি ১৫ মিনিট কাজ করবে।
          {signup && " কোড মিললে তবেই আপনার অ্যাকাউন্ট খোলা হবে।"}
        </>
      }
    >
      {sp.sent === "0" && (
        <p role="alert" className="mb-4 rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">
          এই মুহূর্তে কোড পাঠানো যায়নি। একটু পরে নিচের &quot;নতুন কোড পাঠান&quot; চাপুন; তাতেও না এলে কর্তৃপক্ষকে জানান।
        </p>
      )}
      <VerifyForm />
      <div className="mt-6 grid gap-4 border-t border-line pt-5">
        <ResendForm />
        {signup ? (
          <form action={cancelSignup} className="text-[15px] text-ink-2">
            ইমেইল ঠিকানা ভুল হয়েছে?{" "}
            <button type="submit" className="text-ink-2 underline underline-offset-4">আবার শুরু করুন</button>
          </form>
        ) : (
          <form action={logout} className="text-[15px] text-ink-2">
            ইমেইল ঠিকানা ভুল হয়েছে?{" "}
            <button type="submit" className="text-ink-2 underline underline-offset-4">লগআউট করে নতুন অ্যাকাউন্ট খুলুন</button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
