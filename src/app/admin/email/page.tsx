import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { mailStatus, verificationRequired } from "@/lib/auth/mailer";
import { testEmailAction } from "@/lib/admin/actions";
import { bn } from "@/lib/bn";
import { AdminTitle, Notice, btn, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "ইমেইল-সেবা — অ্যাডমিন", robots: { index: false } };

export default function EmailAdmin({ searchParams }: PageProps<"/admin/email">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("/admin/email");
  const sp = await searchParams;
  const s = mailStatus();
  const pending = await prisma.user.count({ where: { emailVerifiedAt: null, role: "STUDENT" } });

  return (
    <>
      <AdminTitle title="ইমেইল-সেবা" lead="যাচাই কোড ও পাসওয়ার্ড রিসেটের ইমেইল কোন সেটিং দিয়ে যাচ্ছে, আর আসলেই যাচ্ছে কি না, এখানে পরীক্ষা করুন।" />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}

      <dl className="mt-6 grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border border-line bg-surface p-5 text-[15px]">
        <dt className="text-muted">অবস্থা</dt>
        <dd className={s.configured ? "font-semibold text-green" : "font-semibold text-danger"}>
          {s.configured ? "SMTP কনফিগার করা আছে" : `SMTP কনফিগার করা নেই — অনুপস্থিত: ${s.missing.join(", ")}`}
        </dd>
        <dt className="text-muted">নতুন অ্যাকাউন্টে যাচাই</dt>
        <dd>{verificationRequired() ? "চালু (কোড না দিলে অ্যাকাউন্ট খোলে না)" : "বন্ধ (SMTP না থাকায়)"}</dd>
        {s.configured && (
          <>
            <dt className="text-muted">SMTP_HOST</dt>
            <dd className="break-all font-mono text-sm">{s.host}</dd>
            <dt className="text-muted">SMTP_PORT</dt>
            <dd className="font-mono text-sm">{s.port}{s.port !== 465 && s.port !== 587 ? " — সাধারণত 465 বা 587 হয়" : ""}</dd>
            <dt className="text-muted">SMTP_USER</dt>
            <dd className="break-all font-mono text-sm">{s.user}</dd>
            <dt className="text-muted">SMTP_PASS</dt>
            <dd>{bn(s.passLength)} অক্ষর (পাসওয়ার্ড দেখানো হয় না)</dd>
            <dt className="text-muted">MAIL_FROM</dt>
            <dd className="break-all font-mono text-sm">
              {s.from}
              {!s.fromMatchesUser && <span className="mt-1 block font-sans text-danger">প্রেরকের ঠিকানা SMTP_USER-এর সঙ্গে মেলে না — Hostinger এমন ইমেইল ফেরত দেয়।</span>}
            </dd>
          </>
        )}
        <dt className="text-muted">যাচাই-বাকি অ্যাকাউন্ট</dt>
        <dd>{bn(pending)}টি</dd>
      </dl>

      <form action={testEmailAction} className="mt-6 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[15px]">
          <span>কোন ঠিকানায় পরীক্ষামূলক ইমেইল যাবে</span>
          <input name="to" type="email" defaultValue={me.email} className={`${input} w-80 max-w-full`} />
        </label>
        <button className={btn} disabled={!s.configured}>পরীক্ষামূলক ইমেইল পাঠান</button>
      </form>
      <p className="mt-3 text-sm text-muted">
        hPanel-এ Environment Variables বদলালে Redeploy না করা পর্যন্ত এখানে পুরোনো মান দেখাবে। মান বসানোর সময় দুই পাশে উদ্ধৃতিচিহ্ন (&quot;) লাগবে না।
      </p>
    </>
  );
}
