import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { AdminTitle } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Backup ও Export — অ্যাডমিন", robots: { index: false } };

const ITEMS = [
  { kind: "questions.csv", label: "সব প্রশ্ন (CSV)", desc: "Excel-এ খোলা যায়; Import-এর একই কলাম, তাই সম্পাদনা করে আবার Import করা যায় (নতুন uid ছাড়া)।" },
  { kind: "questions.json", label: "সব প্রশ্ন (JSON)", desc: "অন্য সফটওয়্যারে ব্যবহারের জন্য।" },
  { kind: "progress.csv", label: "শিক্ষার্থীর অগ্রগতি (CSV)", desc: "প্রত্যেক শিক্ষার্থীর Level-ভিত্তিক সম্পন্ন ধাপ, পরীক্ষার সংখ্যা ও শেষ লগইন।" },
  { kind: "backup.json", label: "পূর্ণ Backup (JSON)", desc: "সব টেবিল। সক্রিয় সেশন ও রিসেট-টোকেন বাদ; পাসওয়ার্ড শুধু হ্যাশ। নিরাপদ জায়গায় রাখুন।" },
];

export default function BackupPage() {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAdmin("/admin/backup");
  const last = await prisma.auditLog.findMany({ where: { action: "export" }, orderBy: { at: "desc" }, take: 5 });
  return (
    <>
      <AdminTitle title="Backup ও Export" lead="প্রতিটি ডাউনলোড Audit Log-এ থাকে। সার্ভার থেকে স্বয়ংক্রিয় Backup: npm run backup (backups/ ফোল্ডারে)।" />
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {ITEMS.map((i) => (
          <li key={i.kind} className="rounded-xl border border-line bg-surface p-5">
            <a href={`/admin/export/${i.kind}`} className="font-semibold text-green underline underline-offset-4" download>{i.label}</a>
            <p className="mt-1 text-sm text-ink-2">{i.desc}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-3xl rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-2">
        প্রোডাকশনে (Phase 10) হোস্টেড PostgreSQL-এর দৈনিক স্বয়ংক্রিয় Backup চালু করা হবে; এখানকার ডাউনলোড তার অতিরিক্ত নিরাপত্তা।
      </p>
      {last.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">সাম্প্রতিক ডাউনলোড</h2>
          <ul className="mt-2 text-sm text-ink-2">{last.map((l) => <li key={String(l.id)}>{l.at.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}: {l.entityId}</li>)}</ul>
        </section>
      )}
    </>
  );
}
