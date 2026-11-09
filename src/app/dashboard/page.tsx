import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "আমার Dashboard" };

/** Phase 03-এর অস্থায়ী পাতা: লগইন যাচাই করে। পূর্ণ Dashboard তৈরি হবে Phase 04-এ। */
export default function DashboardPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
        <Welcome />
      </Suspense>
    </section>
  );
}

async function Welcome() {
  const user = await requireUser("/dashboard");
  return (
    <div>
      <h1 className="text-[32px] font-extrabold" style={{ fontStretch: "110%" }}>
        স্বাগতম, {user.name}
      </h1>
      <p className="mt-3 text-ink-2">
        আপনার অ্যাকাউন্ট তৈরি হয়েছে। প্রতিদিনের কাজ, অগ্রগতি ও Level 1-এর প্রথম প্রশ্নপত্র এই পাতায় আসবে (Phase 04 ও 05)।
      </p>
      <Link href="/" className="mt-6 inline-block text-green underline underline-offset-4">হোমপেজে ফিরুন</Link>
    </div>
  );
}
