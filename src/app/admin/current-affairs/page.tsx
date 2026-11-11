import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { isStale, latestBank, STALE_DAYS } from "@/lib/current-affairs/service";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Notice, Stat, StatGrid } from "@/components/admin/ui";
import { CaImportForm } from "@/components/admin/ca-import-form";

export const metadata: Metadata = { title: "Current Affairs — অ্যাডমিন", robots: { index: false } };

export default function AdminCaPage() {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAdmin("/admin/current-affairs");
  const [bank, active, retired, students, answers] = await Promise.all([
    latestBank(prisma),
    prisma.caQuestion.count({ where: { active: true } }),
    prisma.caQuestion.count({ where: { active: false } }),
    prisma.caAnswer.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.caAnswer.aggregate({ _sum: { seen: true, correct: true } }),
  ]);
  const seen = answers._sum.seen ?? 0;
  return (
    <>
      <AdminTitle
        title="Current Affairs"
        lead={<>সাম্প্রতিক বিষয়াবলির প্রশ্নব্যাংক। নতুন সংস্করণের .docx দিলে প্রশ্ন, Quick Revision ও তথ্যসূত্র হালনাগাদ হয় — <Link href="/current-affairs" className="text-green underline underline-offset-4">শিক্ষার্থীর পাতা দেখুন</Link>।</>}
      />
      {isStale(bank?.verifiedOn) && <Notice kind="error">প্রশ্নব্যাংকের তথ্য যাচাই {bn(STALE_DAYS)} দিনেরও বেশি পুরোনো ({bank?.verifiedBn}) — শিক্ষার্থীরা সতর্কবার্তা দেখছে। নতুন সংস্করণ Import করুন।</Notice>}
      <StatGrid>
        <Stat k="সক্রিয় প্রশ্ন" v={bnNum(active)} s={retired ? `নিষ্ক্রিয় ${bnNum(retired)}` : "নিষ্ক্রিয় নেই"} />
        <Stat k="সংস্করণ" v={bank?.version ?? "—"} s={bank ? `যাচাই: ${bank.verifiedBn ?? "—"}` : "এখনও Import হয়নি"} />
        <Stat k="অনুশীলনকারী" v={bnNum(students)} s="অন্তত একটি উত্তর" />
        <Stat k="মোট উত্তর" v={bnNum(seen)} s={seen ? `ঠিক ${bnNum(Math.round(((answers._sum.correct ?? 0) / seen) * 100))}%` : "—"} />
      </StatGrid>
      <CaImportForm />
    </>
  );
}
