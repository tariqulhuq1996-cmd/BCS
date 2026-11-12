import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { lockedBy } from "@/lib/progress/access";
import { CaLocked } from "@/components/current-affairs/locked";
import { MODES, latestBank, pickSet, type CaMode } from "@/lib/current-affairs/service";
import { CaPractice } from "@/components/current-affairs/practice";
import { prisma } from "@/lib/db";
import { bn } from "@/lib/bn";

export const metadata: Metadata = { title: "Current Affairs অনুশীলন" };

export default function CaPracticePage({ searchParams }: PageProps<"/current-affairs/practice">) {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <Link href="/current-affairs" className="text-sm text-green underline underline-offset-4">← সাম্প্রতিক বিষয়াবলি</Link>
      <Suspense fallback={<p className="mt-8 text-ink-2">প্রশ্ন সাজানো হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/current-affairs/practice");
  const locked = await lockedBy(user, "CA:GATE");
  if (locked) return <CaLocked current={locked.current} />;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const mode = (Object.keys(MODES).includes(one("mode") ?? "") ? one("mode") : "smart") as CaMode;
  const bank = /^[a-z0-9-]{2,60}$/.test(one("bank") ?? "") ? one("bank") : undefined;
  const chapter = bank ? Number(one("chapter")) || undefined : undefined;
  const priority = (["A", "B", "C"] as const).find((g) => g === one("priority"));
  const [questions, ch, bk] = await Promise.all([
    pickSet(prisma, user.id, { mode, bank, chapter, priority }),
    bank && chapter ? prisma.caChapter.findUnique({ where: { bankKey_no: { bankKey: bank, no: chapter } }, select: { nameBn: true } }) : null,
    bank ? latestBank(prisma, bank) : null,
  ]);
  const title = [MODES[mode], bk && !ch && (bk.name ?? bk.title), ch && `অধ্যায় ${bn(chapter!)}: ${ch.nameBn}`, priority && `Priority ${priority}`].filter(Boolean).join(" · ");
  return (
    <>
      <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl" style={{ fontStretch: "110%" }}>{title}</h1>
      <CaPractice key={`${mode}-${bank}-${chapter}-${priority}`} questions={questions} title={title} backHref="/current-affairs" />
    </>
  );
}
