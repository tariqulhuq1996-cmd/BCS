import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { isStale, listBanks, STALE_DAYS } from "@/lib/current-affairs/service";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Notice, Stat, StatGrid, btn, input } from "@/components/admin/ui";
import { renameCaBankAction } from "@/lib/admin/actions";
import { CaImportForm } from "@/components/admin/ca-import-form";

export const metadata: Metadata = { title: "Current Affairs — অ্যাডমিন", robots: { index: false } };

export default function AdminCaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/current-affairs");
  const sp = await searchParams;
  const [banks, perBank, retired, students, answers, chapters, latest] = await Promise.all([
    listBanks(prisma),
    prisma.caQuestion.groupBy({ by: ["bankKey"], where: { active: true }, _count: true }),
    prisma.caQuestion.count({ where: { active: false } }),
    prisma.caAnswer.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.caAnswer.aggregate({ _sum: { seen: true, correct: true } }),
    prisma.caChapter.findMany({ orderBy: [{ bankKey: "asc" }, { no: "asc" }], select: { bankKey: true, no: true, nameBn: true } }),
    prisma.caBank.findMany({ orderBy: { importedAt: "desc" }, select: { bankKey: true, title: true } }),
  ]);
  const titleOf = (k: string) => latest.find((b) => b.bankKey === k)?.title ?? "";
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
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}
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
      {banks.length > 0 && (
        <section aria-labelledby="rename" className="mt-8 max-w-3xl">
          <h2 id="rename" className="text-lg font-bold">নাম বদলান</h2>
          <p className="mt-1 text-sm text-ink-2">শিক্ষার্থীর পাতায় যে নাম দেখায়। এখানে বদলালে নথি আবার Import করলেও এই নামই থাকবে।</p>
          <div className="mt-3 grid gap-3">
            {banks.map((b) => (
              <details key={b.key} className="rounded-lg border border-line bg-surface px-4 py-3">
                <summary className="cursor-pointer font-medium">{b.name} <span className="font-mono text-sm text-muted">({b.key})</span></summary>
                <form action={renameCaBankAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="bank" value={b.key} />
                  <label className="grid gap-1.5">
                    <span className="font-medium">প্রশ্নব্যাংকের নাম<span className="text-danger" aria-hidden="true"> *</span></span>
                    <input name="name" defaultValue={b.name} required minLength={2} maxLength={120} className={input} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="font-medium">পূর্ণ শিরোনাম<span className="text-danger" aria-hidden="true"> *</span></span>
                    <input name="title" defaultValue={titleOf(b.key)} required minLength={2} maxLength={300} className={input} />
                  </label>
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 font-medium">অধ্যায়ের নাম</legend>
                    {chapters.filter((c) => c.bankKey === b.key).map((c) => (
                      <label key={c.no} className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
                        <span className="text-sm tabular text-muted">{bn(c.no)}.</span>
                        <input name={`ch_${c.no}`} defaultValue={c.nameBn} maxLength={160} className={input} aria-label={`অধ্যায় ${bn(c.no)}-এর নাম`} />
                      </label>
                    ))}
                  </fieldset>
                  <div><button className={btn}>নাম সংরক্ষণ করুন</button></div>
                </form>
              </details>
            ))}
          </div>
        </section>
      )}
      <CaImportForm banks={banks.map((b) => ({ key: b.key, name: b.name, questions: count(b.key) }))} />
    </>
  );
}
