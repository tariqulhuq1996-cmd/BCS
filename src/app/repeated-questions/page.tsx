import type { Metadata } from "next";
import Link from "next/link";
import { getResearch } from "@/lib/research/data";
import { bn } from "@/lib/bn";
import { RepeatList } from "@/components/home/repeat-list";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "পুনরাবৃত্ত প্রশ্ন" };

/**
 * গবেষণার ডেটা ডেটাবেস থেকে আসে, তাই পাতাটি বিল্ডের সময় নয়, প্রথম অনুরোধে তৈরি হয় (তারপর "use cache"-এ কয়েক ঘণ্টা থাকে)।
 * এতে বিল্ড (GitHub Actions) ডেটাবেস ছোঁয় না — Hostinger-এর ডেটাবেস বাইরে খোলা রাখতে হয় না।
 */
export default function RepeatedQuestionsPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 pt-10 text-ink-2 sm:px-6">লোড হচ্ছে…</p>}>
      <Deferred />
    </Suspense>
  );
}

async function Deferred() {
  await connection();
  // পূর্ণ তালিকা শুধু লগইন করা ব্যবহারকারীর জন্য (হোমপেজে নমুনা খোলা থাকে)
  await requireUser("/repeated-questions");
  return <RepeatedQuestionsPageContent />;
}

async function RepeatedQuestionsPageContent() {
  const r = await getResearch();
  const groups = [...new Set(r.families.map((f) => f.occurrences))].sort((a, b) => b - a);

  return (
    <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
      <h1 className="text-[36px] font-extrabold sm:text-[46px]" style={{ fontStretch: "112%" }}>
        যে {bn(r.totals.families)}টি প্রশ্ন একাধিক বিসিএসে এসেছে
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        হুবহু একই প্রশ্ন, অথবা একই তথ্য ভিন্নভাবে জিজ্ঞাসা। যতগুলো পরীক্ষায় এসেছে সেই অনুযায়ী সাজানো; প্রতিটির পাশে কোন কোন বিসিএসে এসেছে।
      </p>
      <nav aria-label="কতবার এসেছে" className="mt-6 flex flex-wrap gap-2">
        {groups.map((g) => (
          <a key={g} href={`#x${g}`} className="rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-green">
            {bn(g)}টি পরীক্ষায় ({bn(r.families.filter((f) => f.occurrences === g).length)})
          </a>
        ))}
      </nav>
      {groups.map((g) => (
        <div key={g} id={`x${g}`} className="scroll-mt-24 pt-12">
          <h2 className="mb-4 text-2xl font-bold">{bn(g)}টি পরীক্ষায় এসেছে</h2>
          <RepeatList families={r.families.filter((f) => f.occurrences === g)} />
        </div>
      ))}
      <p className="mt-12">
        <Link href="/register" className="inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
          আমি ৫২তম BCS-এর প্রস্তুতি শুরু করতে চাই
        </Link>
      </p>
    </section>
  );
}
