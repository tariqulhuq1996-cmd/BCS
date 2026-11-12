import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getPendingSignup, getPendingUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { Icon } from "./icons";
import { ExploreMenu, NavLink, UserMenu, type MenuItem } from "./menus";

/** সাধারণ পাতা — লগইন ছাড়া header-এ সরাসরি, লগইন থাকলে "এক্সপ্লোর"-এর ভেতরে। */
const EXPLORE: MenuItem[] = [
  { href: "/research", label: "প্রশ্ন-বিশ্লেষণ", icon: "research", tone: "green", note: "কোন বিষয় থেকে কত প্রশ্ন আসে" },
  { href: "/#roadmap", label: "Roadmap", icon: "roadmap", tone: "green", note: "শুরু থেকে পরীক্ষা পর্যন্ত পুরো পথ" },
  { href: "/repeated-questions", label: "বারবার আসা প্রশ্ন", icon: "repeat", tone: "omr", note: "একাধিক BCS-এ আসা প্রশ্ন" },
  { href: "/current-affairs", label: "সাম্প্রতিক বিষয়াবলি", icon: "news", tone: "omr", note: "Current Affairs প্রশ্নব্যাংক" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label="BCS ৫২ প্রস্তুতি — হোমপেজ" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base font-bold sm:text-lg" style={{ fontStretch: "115%" }}>
          <Bubbles />
          <span className="max-[359px]:hidden">BCS ৫২ প্রস্তুতি</span>
        </Link>
        {/* লোড হওয়ার সময় ফাঁকা জায়গা — লগইন করা ব্যবহারকারীর কাছে "লগইন"/"শুরু করুন" এক ঝলকও না দেখায় */}
        <Suspense fallback={<span className="ml-auto block h-9 w-28" aria-hidden="true" />}>
          <TopBar />
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-[45px] border-t border-line md:hidden" aria-hidden="true" />}>
        <MobileBar />
      </Suspense>
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

const primaryBtn = "whitespace-nowrap rounded-md bg-green px-3 py-1.5 text-[15px] font-semibold text-white hover:bg-green-strong sm:px-3.5 dark:text-paper";
const quietBtn = "whitespace-nowrap rounded-md px-2 py-1.5 text-[15px] text-ink-2 hover:text-ink sm:px-3";

async function TopBar() {
  const user = await getCurrentUser();

  if (!user) {
    const pendingUser = await getPendingUser();
    const verifying = !pendingUser && !!(await getPendingSignup());
    return (
      <>
        <nav aria-label="প্রধান" className="hidden items-center gap-0.5 md:flex">
          {EXPLORE.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {pendingUser ? (
            <>
              <Link href="/verify-email" className={primaryBtn}>ইমেইল যাচাই</Link>
              <form action={logout}>
                <button className={quietBtn}>লগআউট</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={quietBtn}>লগইন</Link>
              {/* নিবন্ধনের কোড বাকি থাকলে "শুরু করুন"-এর জায়গায় যাচাই-পাতা */}
              <Link href={verifying ? "/verify-email" : "/register"} className={primaryBtn}>
                {verifying ? "ইমেইল যাচাই" : "শুরু করুন"}
              </Link>
            </>
          )}
        </div>
      </>
    );
  }

  const left: MenuItem[] = [
    { href: "/profile", label: "প্রোফাইল", icon: "user", tone: "green" },
    { href: "/profile#password", label: "পাসওয়ার্ড পরিবর্তন", icon: "key", tone: "green" },
    { href: "/dashboard", label: "Dashboard", icon: "dashboard", tone: "plain" },
    { href: "/mistakes", label: "ভুলের তালিকা", icon: "mistakes", tone: "omr" },
    { href: "/saved", label: "সংরক্ষিত প্রশ্ন", icon: "star", tone: "green" },
  ];
  const right: MenuItem[] = [
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "অ্যাডমিন প্যানেল", icon: "admin", tone: "omr" } satisfies MenuItem] : []),
    { href: "/readiness-report", label: "প্রস্তুতি রিপোর্ট", icon: "report", tone: "green" },
    { href: "/revision", label: "Revision", icon: "revision", tone: "plain" },
    { href: "/#roadmap", label: "Roadmap", icon: "roadmap", tone: "plain" },
  ];

  return (
    <>
      <nav aria-label="প্রধান" className="hidden items-center gap-0.5 md:flex">
        <NavLink href="/dashboard" label="Dashboard" icon="dashboard" />
        <NavLink href="/revision" label="Revision" icon="revision" />
        <ExploreMenu items={EXPLORE} />
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <Link href="/search" aria-label="প্রশ্ন খুঁজুন" title="প্রশ্ন খুঁজুন" className="hidden size-10 place-items-center rounded-full text-ink-2 hover:bg-paper hover:text-ink md:grid">
          <Icon name="search" />
        </Link>
        <UserMenu
          name={user.name}
          email={user.email}
          left={left}
          right={right}
          logout={
            <form action={logout}>
              <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[15px] font-medium text-danger hover:bg-danger-wash">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger-wash">
                  <Icon name="logout" />
                </span>
                লগআউট
              </button>
            </form>
          }
        />
      </div>
    </>
  );
}

/** মোবাইলে দ্বিতীয় সারি: পাশাপাশি সরানো যায় এমন আইকনসহ লিংক। */
async function MobileBar() {
  const user = await getCurrentUser();
  const items: MenuItem[] = user
    ? [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/revision", label: "Revision", icon: "revision" },
        { href: "/search", label: "খুঁজুন", icon: "search" },
        { href: "/saved", label: "সংরক্ষিত", icon: "star" },
        { href: "/mistakes", label: "ভুলের তালিকা", icon: "mistakes" },
        ...EXPLORE,
      ]
    : EXPLORE;
  return (
    <nav aria-label="প্রধান (মোবাইল)" className="border-t border-line md:hidden">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} compact />
        ))}
      </div>
    </nav>
  );
}
