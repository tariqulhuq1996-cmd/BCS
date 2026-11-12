import type { Metadata } from "next";
import Link from "next/link";
import { getResearch } from "@/lib/research/data";
import { bn } from "@/lib/bn";
import { RepeatList } from "@/components/home/repeat-list";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { openRepeatFamilies } from "@/lib/progress/journey";

export const metadata: Metadata = { title: "বারবার আসা প্রশ্ন" };

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
  const user = await requireUser("/repeated-questions");
  return <RepeatedQuestionsPageContent user={user} />;
}

/**
 * ধাপে ধাপে খোলে: যে BCS-গুলোর প্রথম সমাধান শেষ, কোনো প্রশ্নের সব রূপ সেগুলোর মধ্যে থাকলে প্রশ্নটি খোলা —
 * নতুন প্রশ্ন আগে চোখে পড়ে না। Repeat Mastery ধাপ খুললে (Level ১-এর শেষে) সবই খোলা।
 */
async function RepeatedQuestionsPageContent({ user }: { user: CurrentUser }) {
  const [r, access] = await Promise.all([getResearch(), openRepeatFamilies(prisma, user.id, user.role === "ADMIN")]);
  const families = access.open ? r.families.filter((f) => access.open!.has(f.id)) : r.families;
  const hidden = r.families.length - families.length;
  const groups = [...new Set(families.map((f) => f.occurrences))].sort((a, b) => b - a);

  return (
    <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
      <h1 className="text-[36px] font-extrabold sm:text-[46px]" style={{ fontStretch: "112%" }}>
        যে {bn(r.totals.families)}টি প্রশ্ন একাধিক BCS-এ এসেছে
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        হুবহু একই প্রশ্ন, অথবা একই তথ্য ভিন্নভাবে জিজ্ঞাসা। যতগুলো পরীক্ষায় এসেছে সেই অনুযায়ী সাজানো; প্রতিটির পাশে কোন কোন BCS-এ এসেছে।
      </p>
      {hidden > 0 && (
        <div role="status" className="mt-6 rounded-xl border-2 border-omr bg-surface px-5 py-4">
          <p className="font-semibold">আপনার জন্য খোলা {bn(families.length)}টি, বাকি {bn(hidden)}টি ধাপে ধাপে খুলবে</p>
          <p className="mt-1 text-[15px] text-ink-2">
            Level ১-এ যে BCS-গুলোর প্রশ্নপত্র সমাধান করবেন, সেগুলোর পুনরাবৃত্ত প্রশ্ন এখানে যোগ হবে — যাতে নতুন প্রশ্ন আগে চোখে না পড়ে। সব BCS শেষে Repeat Mastery-তে পুরো তালিকা খুলবে।
            {access.solvedExams.length > 0 && ` এ পর্যন্ত সমাধান: ${bn(access.solvedExams.length)}টি BCS।`}
          </p>
          <Link href="/level-1" className="mt-3 inline-block font-semibold text-green underline underline-offset-4">Level ১-এ যান</Link>
        </div>
      )}
      <nav aria-label="কতবার এসেছে" className="mt-6 flex flex-wrap gap-2">
        {groups.map((g) => (
          <a key={g} href={`#x${g}`} className="rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-green">
            {bn(g)}টি পরীক্ষায় ({bn(families.filter((f) => f.occurrences === g).length)})
          </a>
        ))}
      </nav>
      {groups.map((g) => (
        <div key={g} id={`x${g}`} className="scroll-mt-24 pt-12">
          <h2 className="mb-4 text-2xl font-bold">{bn(g)}টি পরীক্ষায় এসেছে</h2>
          <RepeatList families={families.filter((f) => f.occurrences === g)} />
        </div>
      ))}
      <p className="mt-12">
        <Link href="/dashboard" className="inline-block rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
          Dashboard-এ যান
        </Link>
      </p>
    </section>
  );
}
