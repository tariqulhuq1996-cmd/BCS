import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";

const NAV = [
  { href: "/research", label: "গবেষণা" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/repeated-questions", label: "পুনরাবৃত্ত প্রশ্ন" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold" style={{ fontStretch: "115%" }}>
          <Bubbles />
          <span>বিসিএস ৫২ প্রস্তুতি</span>
        </Link>
        <nav aria-label="প্রধান" className="hidden md:flex items-center gap-5 text-[15px] text-ink-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<AuthLinks />}>
            <UserArea />
          </Suspense>
        </div>
      </div>
      <nav aria-label="প্রধান (মোবাইল)" className="md:hidden border-t border-line">
        <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 py-2 text-sm text-ink-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-ink">
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

/** লোগো: OMR উত্তরপত্রের চারটি বৃত্ত, একটি ভরাট। */
function Bubbles() {
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={6 + i * 7.33} cy="6" r="4.5" fill={i === 1 ? "var(--green)" : "none"} stroke={i === 1 ? "var(--green)" : "var(--omr)"} strokeWidth="1.4" />
      ))}
    </svg>
  );
}

function AuthLinks() {
  return (
    <>
      <Link href="/login" className="rounded-md px-3 py-1.5 text-[15px] text-ink-2 hover:text-ink">
        লগইন
      </Link>
      <Link href="/register" className="rounded-md bg-green px-3.5 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong dark:text-paper">
        শুরু করুন
      </Link>
    </>
  );
}

async function UserArea() {
  const user = await getCurrentUser();
  if (!user) return <AuthLinks />;
  return (
    <>
      <Link href="/dashboard" className="rounded-md bg-green px-3.5 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong dark:text-paper">
        আমার Dashboard
      </Link>
      <form action={logout}>
        <button className="rounded-md px-3 py-1.5 text-[15px] text-ink-2 hover:text-ink">লগআউট</button>
      </form>
    </>
  );
}
