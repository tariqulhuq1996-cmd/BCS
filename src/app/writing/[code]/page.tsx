import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { bn } from "@/lib/bn";
import { getCard, subjectOf } from "@/lib/writing/service";
import { markCardRead } from "@/lib/writing/actions";
import { Icon } from "@/components/site/icons";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `কার্ড ${code} — Pre BCS Writing Practice` };
}

export default function CardPage({ params }: Props) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
        <Content params={params} />
      </Suspense>
    </section>
  );
}

const linkCls = "inline-flex items-center gap-1 text-[15px] font-semibold text-green underline-offset-4 hover:underline";

async function Content({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).toUpperCase();
  const user = await requireUser(`/writing/${code}`);
  if (!/^[A-Z]{2}-\d{3}$/.test(code)) notFound();
  const c = await getCard(prisma, user.id, code, user.role === "ADMIN");
  if (!c) notFound();
  const s = subjectOf(c.card.subject)!;
  const back = `/writing?s=${s.code}`;

  return (
    <>
      <Link href={back} className={linkCls}>
        <Icon name="chevron" className="size-4 rotate-90" /> {s.name}-এর সব কার্ড
      </Link>

      <header className={`relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br ${s.band} px-6 py-8 text-white`}>
        <span aria-hidden className="absolute -right-12 -top-16 size-56 rotate-[24deg] rounded-[3rem] bg-white/10" />
        <p className="relative text-sm font-semibold text-white/85">
          {s.short} · কার্ড {bn(c.card.order)}/{bn(c.total)}{c.card.kind ? ` · ${c.card.kind}` : ""}
        </p>
        <h1 className="relative mt-2 text-[26px] font-extrabold leading-snug sm:text-[30px]">{c.card.title}</h1>
        <p className="relative mt-2 text-white/85">
          {c.card.section}{c.card.paper && c.card.paper !== "—" ? ` · ${c.card.paper}` : ""}{c.card.marks ? ` · অংশের নম্বর ${bn(c.card.marks)}` : ""}
        </p>
      </header>

      {c.state === "locked" ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <p className="flex items-center gap-2 text-lg font-semibold"><Icon name="lock" className="size-5" /> এই কার্ডটি এখনো লক করা</p>
          <p className="mt-2 text-ink-2">আগের কার্ডগুলো পড়া শেষ করলে এটি খুলবে।</p>
          {c.firstOpen && (
            <Link href={`/writing/${c.firstOpen.code}`} className="mt-4 inline-block rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">
              পরের খোলা কার্ডে যান: কার্ড {bn(c.firstOpen.order)}
            </Link>
          )}
        </div>
      ) : (
        <>
          <article className="mt-6 rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-sm font-semibold text-muted">তথ্য</h2>
            {c.card.info ? (
              <div className="mt-2 whitespace-pre-line text-[17px] leading-relaxed">{c.card.info}</div>
            ) : (
              <p className="mt-2 text-ink-2">এই কার্ডের তথ্য শিগগিরই যোগ করা হবে।</p>
            )}
            {c.card.note && (
              <div className="mt-5 rounded-lg bg-omr-wash px-4 py-3">
                <p className="text-sm font-semibold">মনে রাখার সূত্র</p>
                <p className="mt-1 whitespace-pre-line">{c.card.note}</p>
              </div>
            )}
            {c.card.ref && <p className="mt-5 text-sm text-muted">উৎস: {c.card.ref}</p>}
          </article>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {c.state === "open" ? (
              <form action={markCardRead}>
                <input type="hidden" name="code" value={c.card.code} />
                <button type="submit" className="rounded-lg bg-green px-6 py-3 text-lg font-semibold text-white hover:bg-green-strong dark:text-paper">
                  {c.next ? "পড়া শেষ — পরের কার্ড খুলুন" : "পড়া শেষ"}
                </button>
              </form>
            ) : (
              <p className="flex items-center gap-1.5 font-semibold text-green"><Icon name="check" className="size-5" /> পড়া হয়েছে</p>
            )}
            <p className="text-sm text-muted">{s.name}: পড়া {bn(c.readCount)}/{bn(c.total)}</p>
          </div>
        </>
      )}

      <nav aria-label="কার্ড পরিবর্তন" className="mt-8 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
        {c.prev ? (
          <Link href={`/writing/${c.prev.code}`} className={linkCls}><Icon name="chevron" className="size-4 rotate-90" /> আগের কার্ড ({bn(c.prev.order)})</Link>
        ) : <span />}
        {c.next && c.next.state !== "locked" ? (
          <Link href={`/writing/${c.next.code}`} className={linkCls}>পরের কার্ড ({bn(c.next.order)}) <Icon name="chevron" className="size-4 -rotate-90" /></Link>
        ) : c.next ? (
          <span className="flex items-center gap-1.5 text-sm text-muted"><Icon name="lock" className="size-4" /> পরের কার্ড: এটি পড়া শেষ করলে খুলবে</span>
        ) : null}
      </nav>
    </>
  );
}
