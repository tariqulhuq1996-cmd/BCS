import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { bn } from "@/lib/bn";
import { QuestionTools } from "@/components/exam/question-tools";

export const metadata: Metadata = { title: "সংরক্ষিত প্রশ্ন", robots: { index: false } };

export default function SavedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
      <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const LETTERS = ["ক", "খ", "গ", "ঘ"];

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/saved");
  const sp = await searchParams;
  const subject = typeof sp.subject === "string" ? sp.subject : "";
  const notesOnly = sp.notes === "1";
  const all = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      question: {
        select: {
          id: true, text: true, options: true, correctIndex: true, explanation: true, examQNo: true,
          exam: { select: { bcsNo: true } },
          subtopic: { select: { nameBn: true, topic: { select: { subject: { select: { code: true, nameBn: true, order: true } } } } } },
        },
      },
    },
  });
  const subjects = [...new Map(all.map((b) => [b.question.subtopic.topic.subject.code, b.question.subtopic.topic.subject])).values()].sort((a, b) => a.order - b.order);
  const shown = all.filter((b) => (!subject || b.question.subtopic.topic.subject.code === subject) && (!notesOnly || !!b.note));
  const href = (s: string, n = notesOnly) => `/saved?${new URLSearchParams({ ...(s ? { subject: s } : {}), ...(n ? { notes: "1" } : {}) })}`;
  const pill = (on: boolean) => `rounded-full border px-3.5 py-1 text-sm ${on ? "border-green bg-green text-white dark:text-paper" : "border-line text-ink-2 hover:border-green"}`;

  return (
    <>
      <h1 className="text-[30px] font-extrabold sm:text-[36px]" style={{ fontStretch: "110%" }}>সংরক্ষিত প্রশ্ন</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        ফলাফলের পাতায় ☆ চাপলে প্রশ্ন এখানে জমা হয়, নিজের নোটসহ। পরীক্ষার আগে এক নজরে পড়ে নিন।
      </p>

      {all.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line-strong p-6 text-ink-2">
          এখনো কোনো প্রশ্ন সংরক্ষণ করেননি। যেকোনো পরীক্ষার ফলাফলে প্রশ্নের নিচে <span className="font-semibold text-ink">☆ সংরক্ষণ করুন</span> চাপুন।{" "}
          <Link href="/dashboard" className="text-green underline underline-offset-4">Dashboard-এ যান</Link>
        </div>
      ) : (
        <>
          <nav aria-label="ছাঁকুন" className="mt-6 flex flex-wrap gap-2">
            <Link href={href("")} aria-current={!subject ? "page" : undefined} className={pill(!subject)}>সব ({bn(all.length)})</Link>
            {subjects.map((s) => (
              <Link key={s.code} href={href(s.code)} aria-current={subject === s.code ? "page" : undefined} className={pill(subject === s.code)}>
                {s.nameBn} ({bn(all.filter((b) => b.question.subtopic.topic.subject.code === s.code).length)})
              </Link>
            ))}
            <Link href={href(subject, !notesOnly)} aria-current={notesOnly ? "page" : undefined} className={pill(notesOnly)}>শুধু নোটসহ</Link>
          </nav>
          {shown.length === 0 && <p className="mt-6 text-ink-2">এই তালিকায় কোনো প্রশ্ন নেই।</p>}
          <ol className="mt-5 grid gap-4">
            {shown.map((b) => {
              const q = b.question;
              return (
                <li key={q.id} className="rounded-xl border border-line bg-surface p-5">
                  <p className="text-sm text-muted">
                    {q.subtopic.topic.subject.nameBn} › {q.subtopic.nameBn}
                    {q.exam && ` · ${bn(q.exam.bcsNo)}তম BCS, প্রশ্ন ${bn(q.examQNo ?? "")}`}
                  </p>
                  <p className="mt-2 text-[17px] font-semibold leading-relaxed">{q.text}</p>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((o, k) => (
                      <li key={k} className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[15px] ${k === q.correctIndex ? "border-green bg-green-wash" : "border-line"}`}>
                        <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${k === q.correctIndex ? "border-green bg-green text-white dark:text-paper" : "border-line-strong text-muted"}`}>{LETTERS[k]}</span>
                        {o}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <p className="mt-3 text-[15px] text-ink-2">
                      <span className="font-semibold text-ink">ব্যাখ্যা: </span>
                      {q.explanation}
                    </p>
                  )}
                  <QuestionTools qid={q.id} saved note={b.note ?? ""} />
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}
