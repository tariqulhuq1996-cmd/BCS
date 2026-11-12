import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { lockedBy } from "@/lib/progress/access";
import { CaLocked } from "@/components/current-affairs/locked";
import { listBanks } from "@/lib/current-affairs/service";
import { bn } from "@/lib/bn";

export const metadata: Metadata = { title: "Current Affairs — Quick Revision" };

export default function CaRevisionPage({ searchParams }: PageProps<"/current-affairs/revision">) {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Link href="/current-affairs" className="text-sm text-green underline underline-offset-4">← সাম্প্রতিক বিষয়াবলি</Link>
      <h1 className="mt-3 text-[32px] font-extrabold" style={{ fontStretch: "110%" }}>Quick Revision</h1>
      <nav aria-label="এই পাতায়" className="mt-3 flex flex-wrap gap-4 text-[15px]">
        <a href="#facts" className="text-green underline underline-offset-4">এক নজরে তথ্য</a>
        <a href="#volatile" className="text-green underline underline-offset-4">পরিবর্তনশীল তথ্য</a>
        <a href="#sources" className="text-green underline underline-offset-4">তথ্যসূত্র</a>
      </nav>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/current-affairs/revision");
  const locked = await lockedBy(user, "CA:GATE");
  if (locked) return <CaLocked current={locked.current} />;
  const banks = await listBanks(prisma);
  if (!banks.length) return <p className="mt-8 text-lg text-ink-2">প্রশ্নব্যাংক এখনও যুক্ত হয়নি।</p>;
  const bank = banks.find((b) => b.key === sp.bank) ?? banks[0];
  const [items, volatile, sources] = await Promise.all([
    prisma.caRevisionItem.findMany({ where: { bankKey: bank.key }, orderBy: { order: "asc" } }),
    prisma.caQuestion.findMany({ where: { bankKey: bank.key, active: true, volatile: true }, orderBy: { no: "asc" }, select: { no: true, text: true, volatileReason: true, eventDate: true } }),
    prisma.caSource.findMany({ where: { bankKey: bank.key }, orderBy: { no: "asc" } }),
  ]);
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <>
      {banks.length > 1 && (
        <nav aria-label="প্রশ্নব্যাংক" className="mt-5 flex flex-wrap gap-2">
          {banks.map((b) => (
            <Link
              key={b.key}
              href={`/current-affairs/revision?bank=${b.key}`}
              aria-current={b.key === bank.key ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-[15px] ${b.key === bank.key ? "border-green bg-green-wash font-semibold" : "border-line-strong hover:border-green"}`}
            >
              {b.name}
            </Link>
          ))}
        </nav>
      )}
      <p className="mt-3 text-sm text-muted">{bank.name} · সব তথ্য যাচাই: {bank.verifiedBn ?? "—"}। সাম্প্রতিক তথ্য দ্রুত বদলায় — পরীক্ষার আগে আবার মিলিয়ে নিন।</p>

      <section id="facts" aria-labelledby="facts-h" className="mt-8 scroll-mt-24">
        <h2 id="facts-h" className="text-xl font-bold">এক নজরে গুরুত্বপূর্ণ তথ্য</h2>
        {groups.map((g) => (
          <div key={g} className="mt-5">
            <h3 className="font-semibold text-omr">{g}</h3>
            <table className="mt-2 w-full text-left text-[15px]">
              <thead className="sr-only"><tr><th>বিষয়</th><th>মনে রাখার তথ্য</th></tr></thead>
              <tbody>
                {items.filter((i) => i.group === g).map((i) => (
                  <tr key={i.id} className="border-b border-line align-top">
                    {i.topic ? (
                      <>
                        <th scope="row" className="w-1/3 py-2 pr-4 font-semibold">{i.topic}</th>
                        <td className="py-2 text-ink-2">{i.fact}</td>
                      </>
                    ) : (
                      <td colSpan={2} className="py-2 text-ink-2">• {i.fact}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section id="volatile" aria-labelledby="vol-h" className="mt-12 scroll-mt-24">
        <h2 id="vol-h" className="text-xl font-bold">⚠ পরীক্ষার আগে আবার যাচাই করুন ({bn(volatile.length)}টি)</h2>
        <p className="mt-1 text-ink-2">এই প্রশ্নগুলোর তথ্য পরীক্ষার আগে বদলে যেতে পারে — পরীক্ষার ২–৩ সপ্তাহ আগে সংশ্লিষ্ট উৎসে মিলিয়ে নিন।</p>
        <ul className="mt-3 divide-y divide-line border-y border-line text-[15px]">
          {volatile.map((v) => (
            <li key={v.no} className="py-2.5">
              <p>{bn(v.no)}. {v.text}</p>
              <p className="text-sm text-muted">{v.volatileReason ?? "তথ্যটি বদলাতে পারে"}{v.eventDate ? ` · ঘটনার তারিখ: ${v.eventDate}` : ""}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="sources" aria-labelledby="src-h" className="mt-12 scroll-mt-24">
        <h2 id="src-h" className="text-xl font-bold">তথ্যসূত্র ({bn(sources.length)}টি)</h2>
        <ol className="mt-3 grid gap-1.5 text-[15px] sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s.id} className="min-w-0">
              <span className="tabular text-muted">{bn(s.no)}.</span>{" "}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-green underline underline-offset-4">{s.name}</a>
              ) : (
                s.name
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
