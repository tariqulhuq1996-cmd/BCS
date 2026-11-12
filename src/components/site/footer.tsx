import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-[2fr_1fr] sm:px-6">
        <p className="max-w-prose">
          এই সাইটের প্রতিটি সংখ্যা ১০ম–৫০তম বিসিএস প্রিলিমিনারির প্রকৃত প্রশ্ন থেকে গোনা। এগুলো অতীতের হিসাব, ৫২তম বিসিএসের প্রশ্নের পূর্বাভাস নয়;
          কোনো স্কোরকে পাশের নিশ্চয়তা হিসেবে দেখানো হয় না।
        </p>
        <nav aria-label="ফুটার" className="flex flex-wrap gap-x-5 gap-y-1 sm:justify-end">
          <Link href="/research" className="hover:text-ink">প্রশ্ন-বিশ্লেষণ</Link>
          <Link href="/repeated-questions" className="hover:text-ink">বারবার আসা প্রশ্ন</Link>
          <Link href="/login" className="hover:text-ink">লগইন</Link>
        </nav>
      </div>
    </footer>
  );
}
