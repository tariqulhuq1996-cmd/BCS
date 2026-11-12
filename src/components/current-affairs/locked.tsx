import Link from "next/link";
import type { TaskView } from "@/lib/progress/dashboard";

/** ধাপ ০ (প্রশ্ন-বিশ্লেষণ) শেষ না হলে সাম্প্রতিক বিষয়াবলির জায়গায় এটি দেখায়। */
export function CaLocked({ current }: { current: TaskView | null }) {
  return (
    <div className="mt-8 rounded-xl border-2 border-dashed border-line-strong px-6 py-8 text-center">
      <p className="text-lg font-semibold">সাম্প্রতিক বিষয়াবলি: প্রশ্ন-বিশ্লেষণ পড়া শেষ হলেই খুলবে, চলবে পরীক্ষার দিন পর্যন্ত</p>
      <p className="mx-auto mt-2 max-w-lg text-ink-2">
        যাত্রার প্রথম ধাপ প্রশ্ন-বিশ্লেষণ। এর পাঁচটি অংশে &ldquo;পড়েছি&rdquo; চিহ্ন দিলেই সাম্প্রতিক বিষয়াবলি খুলে যাবে, আর তা চলবে মূল পথের পাশাপাশি প্রতিদিন।
      </p>
      <Link href={current?.href ?? "/research"} className="mt-6 inline-block rounded-lg bg-green px-6 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper">
        {current ? `বর্তমান কাজে যান: ${current.title}` : "প্রশ্ন-বিশ্লেষণে যান"}
      </Link>
    </div>
  );
}
