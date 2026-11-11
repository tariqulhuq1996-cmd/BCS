import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { isStale, listBanks, STALE_DAYS } from "@/lib/current-affairs/service";
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
  const [banks, perBank, retired, students, answers] = await Promise.all([
    listBanks(prisma),
    prisma.caQuestion.groupBy({ by: ["bankKey"], where: { active: true }, _count: true }),
    prisma.caQuestion.count({ where: { active: false } }),
    prisma.caAnswer.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.caAnswer.aggregate({ _sum: { seen: true, correct: true } }),
  ]);
  const count = (k: string) => perBank.find((p) => p.bankKey === k)?._count ?? 0;
  const active = perBank.reduce((a, p) => a + p._count, 0);
  const seen = answers._sum.seen ?? 0;
  const stale = banks.filter((b) => isStale(b.verifiedOn));
  return (
    <>
      <AdminTitle
        title="Current Affairs"
        lead={<>সাম্প্রতিক বিষয়াবলির প্রশ্নব্যাংকগুলো। নতুন সংস্করণের .docx দিলে শুধু সেই ব্যাংকের প্রশ্ন, Quick Revision ও তথ্যসূত্র হালনাগাদ হয়; নতুন বিষয়ের .docx নতুন ব্যাংক হিসেবে যোগ হয় — <Link href="/current-affairs" className="text-green underline underline-offset-4">শিক্ষার্থীর পাতা দেখুন</Link>।</>}
      />
      {stale.length > 0 && <Notice kind="error">{stale.map((b) => `${b.name} (${b.verifiedBn})`).join(", ")} — তথ্য যাচাই {bn(STALE_DAYS)} দিনেরও বেশি পুরোনো; শিক্ষার্থীরা সতর্কবার্তা দেখছে। নতুন সংস্করণ Import করুন।</Notice>}
      <StatGrid>
        <Stat k="সক্রিয় প্রশ্ন" v={bnNum(active)} s={retired ? `নিষ্ক্রিয় ${bnNum(retired)}` : "নিষ্ক্রিয় নেই"} />
        <Stat k="প্রশ্নব্যাংক" v={bnNum(banks.length)} s="পাশাপাশি" />
        <Stat k="অনুশীলনকারী" v={bnNum(students)} s="অন্তত একটি উত্তর" />
        <Stat k="মোট উত্তর" v={bnNum(seen)} s={seen ? `ঠিক ${bnNum(Math.round(((answers._sum.correct ?? 0) / seen) * 100))}%` : "—"} />
      </StatGrid>
      {banks.length > 0 && (
        <table className="mt-6 w-full max-w-3xl text-left text-[15px]">
          <thead className="text-sm text-muted">
            <tr className="border-b border-line"><th className="py-2 font-medium">প্রশ্নব্যাংক</th><th className="py-2 font-medium">key</th><th className="py-2 text-right font-medium">প্রশ্ন</th><th className="py-2 text-right font-medium">সংস্করণ · যাচাই</th></tr>
          </thead>
          <tbody>
            {banks.map((b) => (
              <tr key={b.key} className="border-b border-line align-top">
                <td className="py-2 pr-3">{b.name}</td>
                <td className="py-2 pr-3 font-mono text-sm text-muted">{b.key}</td>
                <td className="py-2 text-right tabular">{bnNum(count(b.key))}</td>
                <td className="py-2 text-right text-sm text-muted">{b.version ?? "—"} · {b.verifiedBn ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <CaImportForm banks={banks.map((b) => ({ key: b.key, name: b.name, questions: count(b.key) }))} />
    </>
  );
}
