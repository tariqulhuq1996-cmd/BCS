import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";

const NAV = [
  { href: "/research", label: "গবেষণা" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/repeated-questions", label: "পুনরাবৃত্ত প্রশ্ন" },
  { href: "/current-affairs", label: "সাম্প্রতিক বিষয়াবলি" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="বিসিএস ৫২ প্রস্তুতি — হোমপেজ" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base font-bold sm:text-lg" style={{ fontStretch: "115%" }}>
          <Bubbles />
          <span className="max-[359px]:hidden">বিসিএস ৫২ প্রস্তুতি</span>
        </Link>
        <nav aria-label="প্রধান" className="hidden md:flex items-center gap-5 text-[15px] text-ink-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 whitespace-nowrap sm:gap-2">
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
      <Link href="/login" className="rounded-md px-2 py-1.5 text-[15px] text-ink-2 hover:text-ink sm:px-3">
        লগইন
      </Link>
      <Link href="/register" className="rounded-md bg-green px-3 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong sm:px-3.5 dark:text-paper">
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
      {user.role === "ADMIN" && (
        <Link href="/admin" className="rounded-md px-2 py-1.5 text-[15px] font-semibold text-omr hover:underline sm:px-3">
          অ্যাডমিন
        </Link>
      )}
      <Link href="/dashboard" className="rounded-md bg-green px-3 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong sm:px-3.5 dark:text-paper">
        Dashboard
      </Link>
      <Link href="/profile" className="hidden rounded-md px-2 py-1.5 text-[15px] text-ink-2 hover:text-ink sm:inline-block sm:px-3" title={user.email}>
        প্রোফাইল
      </Link>
      <form action={logout}>
        <button className="rounded-md px-2 py-1.5 text-[15px] text-ink-2 hover:text-ink sm:px-3">লগআউট</button>
      </form>
    </>
  );
}
