import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { bulkQuestionsAction } from "@/lib/admin/actions";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Notice, STATUS_BN, btn, btnGhost, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "প্রশ্ন — অ্যাডমিন", robots: { index: false } };
const PAGE = 50;
const LETTERS = ["ক", "খ", "গ", "ঘ"];
type SP = Record<string, string | string[] | undefined>;

export default function QuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin("/admin/questions");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const page = Math.max(1, Number(s("page")) || 1);
  const where: Prisma.QuestionWhereInput = {};
  if (s("q")) where.OR = [{ text: { contains: s("q") } }, { uid: { contains: s("q").toUpperCase() } }];
  if (s("kind")) where.kind = s("kind") as "HISTORICAL" | "TOPIC";
  if (s("status")) where.status = s("status") as "DRAFT";
  if (s("expl")) where.explanationStatus = s("expl") as "NONE";
  if (s("cls")) where.verifyClass = s("cls");
  if (s("near") === "1") where.verifyNote = { contains: "প্রায়-একই" };
  if (s("subject")) where.subtopic = { topic: { subject: { code: s("subject") } } };
  if (s("sub")) where.subtopic = { code: s("sub").toUpperCase() };

  const [total, rows, subjects] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where, orderBy: [{ kind: "asc" }, { uid: "asc" }], skip: (page - 1) * PAGE, take: PAGE,
      select: { id: true, uid: true, kind: true, text: true, options: true, correctIndex: true, status: true, explanationStatus: true, verifyClass: true, verifyNote: true, difficulty: true, subtopic: { select: { code: true, nameBn: true } } },
    }),
    prisma.subject.findMany({ orderBy: { order: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && !["page", "ok", "err"].includes(k)) as [string, string][]);
  const here = `/admin/questions${qs.toString() ? `?${qs}` : ""}`;
  const pageHref = (p: number) => `/admin/questions?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(p) })}`;

  return (
    <>
      <AdminTitle title="প্রশ্ন" lead="খুঁজুন, ছাঁকুন, সম্পাদনা করুন, এবং একসঙ্গে অনেক প্রশ্ন যাচাই বা প্রকাশ করুন। প্রকাশিত প্রশ্নই শুধু শিক্ষার্থীর পথে আসে।" />
      {s("ok") && <Notice>{s("ok")}</Notice>}
      {s("err") && <Notice kind="error">{s("err")}</Notice>}

      <form className="mt-6 flex flex-wrap items-end gap-2" role="search">
        <input name="q" defaultValue={s("q")} placeholder="লেখা বা uid" aria-label="খুঁজুন" className={`${input} w-56`} />
        <select name="kind" defaultValue={s("kind")} aria-label="ধরন" className={input}><option value="">সব ধরন</option><option value="HISTORICAL">বিগত বিসিএস</option><option value="TOPIC">Level ২</option></select>
        <select name="status" defaultValue={s("status")} aria-label="অবস্থা" className={input}><option value="">সব অবস্থা</option>{Object.entries(STATUS_BN).filter(([k]) => k !== "APPROVED").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="expl" defaultValue={s("expl")} aria-label="ব্যাখ্যা" className={input}><option value="">সব ব্যাখ্যা</option><option value="NONE">ব্যাখ্যা নেই</option><option value="DRAFT">ব্যাখ্যা খসড়া</option><option value="VERIFIED">ব্যাখ্যা যাচাইকৃত</option></select>
        <select name="subject" defaultValue={s("subject")} aria-label="বিষয়" className={input}><option value="">সব বিষয়</option>{subjects.map((x) => <option key={x.code} value={x.code}>{x.nameBn}</option>)}</select>
        <input name="sub" defaultValue={s("sub")} placeholder="উপবিষয় কোড" aria-label="উপবিষয় কোড" className={`${input} w-36`} />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="near" value="1" defaultChecked={s("near") === "1"} />প্রায়-একই</label>
        <button className={btnGhost}>ছাঁকুন</button>
        <Link href="/admin/questions" className="px-2 text-sm text-ink-2 underline">সব মুছুন</Link>
      </form>

      <form action={bulkQuestionsAction} className="mt-5">
        <input type="hidden" name="return" value={here} />
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <span className="text-sm text-ink-2">{bnNum(total)}টি প্রশ্ন; বাছাই করাগুলোকে</span>
          <select name="op" aria-label="একসঙ্গে কাজ" className={input}>
            <option value="publish">প্রকাশ করুন</option>
            <option value="verify">যাচাইকৃত চিহ্নিত করুন</option>
            <option value="explVerify">ব্যাখ্যা যাচাইকৃত চিহ্নিত করুন</option>
            <option value="draft">খসড়ায় ফেরত</option>
            <option value="retire">বাতিল করুন</option>
          </select>
          <button className={btn}>প্রয়োগ</button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-left text-[14px]">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="w-8 px-2 py-2"><span className="sr-only">বাছাই</span></th>
                <th className="px-2 py-2 font-medium">uid</th>
                <th className="px-2 py-2 font-medium">প্রশ্ন ও উত্তর</th>
                <th className="px-2 py-2 font-medium">উপবিষয়</th>
                <th className="px-2 py-2 font-medium">অবস্থা</th>
                <th className="px-2 py-2 font-medium">ব্যাখ্যা</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-b border-line align-top">
                  <td className="px-2 py-2"><input type="checkbox" name="ids" value={q.id} aria-label={`${q.uid} বাছাই`} /></td>
                  <td className="px-2 py-2 font-mono text-xs"><Link href={`/admin/questions/${q.id}`} className="text-green underline">{q.uid}</Link></td>
                  <td className="max-w-md px-2 py-2">
                    <p className="line-clamp-2">{q.text}</p>
                    <p className="text-xs text-ink-2">উত্তর: {q.correctIndex != null ? `${LETTERS[q.correctIndex]}) ${q.options[q.correctIndex]}` : <span className="text-danger">নেই</span>}</p>
                    {q.verifyNote && <p className="text-xs text-omr">{q.verifyNote}</p>}
                  </td>
                  <td className="px-2 py-2 text-xs">{q.subtopic.nameBn}<span className="block font-mono text-muted">{q.subtopic.code}</span></td>
                  <td className="px-2 py-2 text-xs">{STATUS_BN[q.status]}{q.verifyClass && <span className="block text-muted">শ্রেণি {q.verifyClass}</span>}</td>
                  <td className="px-2 py-2 text-xs">{q.explanationStatus === "NONE" ? <span className="text-danger">নেই</span> : q.explanationStatus === "DRAFT" ? "খসড়া" : "যাচাইকৃত"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
      <nav aria-label="পাতা" className="mt-4 flex items-center gap-4 text-sm">
        {page > 1 && <Link href={pageHref(page - 1)} className="text-green underline">আগের পাতা</Link>}
        <span className="text-muted">পাতা {bn(page)} / {bn(Math.max(1, Math.ceil(total / PAGE)))}</span>
        {page * PAGE < total && <Link href={pageHref(page + 1)} className="text-green underline">পরের পাতা</Link>}
      </nav>
    </>
  );
}
