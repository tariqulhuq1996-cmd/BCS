import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/session";

const NAV = [
  { href: "/admin", label: "সারসংক্ষেপ" },
  { href: "/admin/questions", label: "প্রশ্ন" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/current-affairs", label: "Current Affairs" },
  { href: "/admin/rules", label: "নিয়ম ও Threshold" },
  { href: "/admin/roadmap", label: "Roadmap" },
  { href: "/admin/model-tests", label: "Model Test" },
  { href: "/admin/students", label: "শিক্ষার্থী" },
  { href: "/admin/reports", label: "রিপোর্ট" },
  { href: "/admin/backup", label: "Backup ও Export" },
];

/**
 * অ্যাডমিন অংশের কাঠামো। অ্যাডমিন না হলে মেনুসহ কিছুই দেখানো হয় না (৪০৪)।
 * এর পাশাপাশি প্রতিটি পাতা ও প্রতিটি কাজ (Server Action) আলাদাভাবে প্রবেশাধিকার যাচাই করে।
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 pt-6 text-ink-2 sm:px-6">লোড হচ্ছে…</p>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: ReactNode }) {
  await requireAdmin("/admin");
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label="অ্যাডমিন" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-sm font-semibold text-omr">অ্যাডমিন প্যানেল</p>
        <ul className="flex gap-1 overflow-x-auto pb-2 text-[15px] lg:flex-col lg:overflow-visible">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="block whitespace-nowrap rounded-md px-3 py-1.5 text-ink-2 hover:bg-surface hover:text-ink">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
