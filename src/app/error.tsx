"use client";

import Link from "next/link";
import { useEffect } from "react";

/** কোনো পাতায় অপ্রত্যাশিত ত্রুটি হলে। বিস্তারিত (stack) শিক্ষার্থীকে দেখানো হয় না; সার্ভার-লগে থাকে। */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto max-w-2xl px-4 pt-20 text-center sm:px-6">
      <h1 className="text-[30px] font-extrabold">কিছু একটা ঠিকমতো কাজ করেনি</h1>
      <p className="mt-3 text-lg text-ink-2">আপনার উত্তর ও অগ্রগতি সংরক্ষিত আছে। আবার চেষ্টা করুন; সমস্যা থাকলে কিছুক্ষণ পরে আবার এসো।</p>
      {error.digest && <p className="mt-2 text-sm text-muted">ত্রুটির সূত্র: {error.digest}</p>}
      <div className="mt-8 flex justify-center gap-4">
        <button onClick={reset} className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white dark:text-paper">আবার চেষ্টা করুন</button>
        <Link href="/dashboard" className="px-2 py-2.5 text-green underline underline-offset-4">Dashboard</Link>
      </div>
    </section>
  );
}
