import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { bn } from "@/lib/bn";
import { QuestionTools } from "@/components/exam/question-tools";

export const metadata: Metadata = { title: "প্রশ্ন খুঁজুন", robots: { index: false } };

const LIMIT = 30;
const LETTERS = ["ক", "খ", "গ", "ঘ"];

export default function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
      <h1 className="text-[30px] font-extrabold sm:text-[36px]" style={{ fontStretch: "110%" }}>প্রশ্ন খুঁজুন</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        বিগত BCS, টপিকভিত্তিক আর সাম্প্রতিক বিষয়াবলির সব প্রশ্নে একটি শব্দ বা বাক্যাংশ লিখে খুঁজুন। যে প্রশ্ন আগে সমাধান করেছেন, তার সঠিক উত্তর ও ব্যাখ্যাও দেখাবে।
      </p>
      <Suspense fallback={<p className="mt-6 text-ink-2">খোঁজা হচ্ছে…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** মিলে যাওয়া অংশ চিহ্নিত করা (বড়-ছোট হাতের অক্ষর না মেনে)। */
function Mark({ text, q }: { text: string; q: string }) {
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  for (let at = lower.indexOf(needle); at >= 0 && needle; at = lower.indexOf(needle, i)) {
    parts.push(text.slice(i, at), <mark key={at} className="rounded bg-omr-wash px-0.5 text-ink">{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

function Options({ options, correct }: { options: string[]; correct: number | null }) {
  return (
    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {options.map((o, k) => (
        <li key={k} className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[15px] ${k === correct ? "border-green bg-green-wash" : "border-line"}`}>
          <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${k === correct ? "border-green bg-green text-white dark:text-paper" : "border-line-strong text-muted"}`}>{LETTERS[k]}</span>
          {o}
        </li>
      ))}
    </ul>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/search");
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").replace(/\s+/g, " ").trim().slice(0, 100);

  const form = (
    <form role="search" className="mt-6 flex gap-2">
      <label htmlFor="q" className="sr-only">যা খুঁজবেন</label>
      <input id="q" name="q" type="search" defaultValue={q} minLength={2} required autoFocus={!q} placeholder="যেমন: পদ্মা সেতু, মুক্তিযুদ্ধ, ক্ষেত্রফল" className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-[16px]" />
      <button className="rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">খুঁজুন</button>
    </form>
  );
  if (q.length < 2) return form;

  const [qs, cas] = await Promise.all([
    prisma.question.findMany({
      where: { status: "PUBLISHED", text: { contains: q } },
      take: LIMIT,
      orderBy: [{ kind: "asc" }, { uid: "asc" }],
      select: {
        id: true, kind: true, text: true, options: true, correctIndex: true, explanation: true, examQNo: true,
        exam: { select: { bcsNo: true } },
        subtopic: { select: { nameBn: true, topic: { select: { subject: { select: { nameBn: true } } } } } },
      },
    }),
    prisma.caQuestion.findMany({
      where: { active: true, text: { contains: q } },
      take: LIMIT,
      orderBy: [{ bankKey: "asc" }, { no: "asc" }],
      select: { id: true, text: true, options: true, correctIndex: true, explanation: true, chapter: { select: { nameBn: true } } },
    }),
  ]);
  const ids = qs.map((x) => x.id);
  const [seenRows, caSeen, marks] = await Promise.all([
    prisma.attemptAnswer.findMany({ where: { questionId: { in: ids }, attempt: { userId: user.id, submittedAt: { not: null } } }, select: { questionId: true }, distinct: ["questionId"] }),
    prisma.caAnswer.findMany({ where: { userId: user.id, questionId: { in: cas.map((c) => c.id) } }, select: { questionId: true } }),
    prisma.bookmark.findMany({ where: { userId: user.id, questionId: { in: ids } }, select: { questionId: true, note: true } }),
  ]);
  const seen = new Set(seenRows.map((r) => r.questionId));
  const caOk = new Set(caSeen.map((r) => r.questionId));
  const noteBy = new Map(marks.map((m) => [m.questionId, m.note ?? ""]));
  const total = qs.length + cas.length;

  return (
    <>
      {form}
      <p className="mt-5 text-[15px] text-ink-2" role="status">
        “{q}” লিখে {total ? `${bn(total)}টি প্রশ্ন পাওয়া গেছে` : "কোনো প্রশ্ন পাওয়া যায়নি"}
        {(qs.length === LIMIT || cas.length === LIMIT) && "; আরও আছে, শব্দটি আরও নির্দিষ্ট করে লিখুন"}।
      </p>
      <ol className="mt-4 grid gap-4">
        {qs.map((x) => {
          const ok = seen.has(x.id);
          return (
            <li key={x.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm text-muted">
                {x.exam ? `${bn(x.exam.bcsNo)}তম BCS, প্রশ্ন ${bn(x.examQNo ?? "")}` : "টপিকভিত্তিক প্রশ্ন"} · {x.subtopic.topic.subject.nameBn} › {x.subtopic.nameBn}
              </p>
              <p className="mt-2 text-[17px] font-semibold leading-relaxed"><Mark text={x.text} q={q} /></p>
              <Options options={x.options} correct={ok ? x.correctIndex : null} />
              {ok ? (
                <>
                  {x.explanation && <p className="mt-3 text-[15px] text-ink-2"><span className="font-semibold text-ink">ব্যাখ্যা: </span>{x.explanation}</p>}
                  <QuestionTools qid={x.id} saved={noteBy.has(x.id)} note={noteBy.get(x.id) ?? ""} />
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  এখনো সমাধান করেননি; উত্তর দেখা যাবে {x.kind === "HISTORICAL" ? `Level ১-এ ${x.exam ? `${bn(x.exam.bcsNo)}তম BCS` : "এই পরীক্ষা"} সমাধানের পর` : "Level ২-এ এই উপবিষয় সমাধানের পর"}।
                </p>
              )}
            </li>
          );
        })}
        {cas.map((x) => {
          const ok = caOk.has(x.id);
          return (
            <li key={x.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm text-muted">সাম্প্রতিক বিষয়াবলি · {x.chapter.nameBn}</p>
              <p className="mt-2 text-[17px] font-semibold leading-relaxed"><Mark text={x.text} q={q} /></p>
              <Options options={x.options} correct={ok ? x.correctIndex : null} />
              {ok ? (
                x.explanation && <p className="mt-3 text-[15px] text-ink-2"><span className="font-semibold text-ink">ব্যাখ্যা: </span>{x.explanation}</p>
              ) : (
                <p className="mt-3 text-sm text-muted">এখনো উত্তর দেননি; সাম্প্রতিক বিষয়াবলির দৈনিক প্রশ্নে এলে উত্তর দেখা যাবে।</p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
