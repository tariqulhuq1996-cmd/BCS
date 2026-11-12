import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { getStudentTasks } from "@/lib/progress/dashboard";
import { LOCKED_MESSAGE } from "@/lib/progress/cycle";
import { bn, bnNum } from "@/lib/bn";
import { prisma } from "@/lib/db";
import { GradeBadge } from "@/components/ui/grade";
import { ProgressBar } from "@/components/portal/progress-bar";
import { numify } from "@/lib/sql";

export const metadata: Metadata = { title: "Level ২: টপিকভিত্তিক প্রশ্ন" };
const GRADES = ["A", "B", "C", "D"];

export default function Level2Page() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>Level ২: টপিকভিত্তিক প্রশ্ন আয়ত্ত</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        ৫২তম Priority List-এর ক্রমে চারটি ধাপ: A → B → C → D। একটি ধাপের সব উপবিষয় একসঙ্গে খোলে; যেকোনো ক্রমে পড়তে পারেন। সব শেষ হলে Checkpoint, তারপর পরের ধাপ।
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  const user = await requireUser("/level-2");
  const tasks = (await getStudentTasks(user.id)).filter((t) => t.levelNo === 2);
  const done = tasks.filter((t) => t.state === "COMPLETED").length;
  const levelLocked = tasks.every((t) => t.state === "LOCKED");
  // প্রতিটি Priority ধাপে প্রশ্নের লক্ষ্য বনাম প্রকাশিত
  const content = await prisma.$queryRaw<{ grade: string; target: number; published: number }[]>`
    select st.priorityGrade as grade, sum(st.targetQuestions) as target,
      (select count(*) from Question q join Subtopic s2 on s2.id = q.subtopicId
        where q.kind = 'TOPIC' and q.status = 'PUBLISHED' and s2.priorityGrade = st.priorityGrade) as published
    from Subtopic st where st.priorityGrade is not null group by st.priorityGrade`.then((r) => numify(r));
  const cBy = new Map(content.map((c) => [c.grade, c]));
  const totTarget = content.reduce((a, c) => a + (c.target ?? 0), 0);
  const totPub = content.reduce((a, c) => a + c.published, 0);

  return (
    <>
      <div className="mt-6 max-w-xl">
        <ProgressBar pct={(done / tasks.length) * 100} label="Level ২-এর অগ্রগতি" />
        <p className="mt-2 text-sm text-ink-2">{bn(done)}/{bn(tasks.length)} ধাপ সম্পন্ন</p>
        <p className="mt-1 text-sm text-muted">প্রশ্নভান্ডার: লক্ষ্য {bnNum(totTarget)}টির মধ্যে {bnNum(totPub)}টি যাচাই করে প্রকাশিত</p>
      </div>
      {levelLocked && (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-3 text-ink-2">
          Level ২ তালাবন্ধ। {LOCKED_MESSAGE} Level ১-এর Final Assessment পাস করলে Priority A-র উপবিষয়গুলো খুলবে। নিচে কী কী আছে দেখে রাখতে পারেন।
        </p>
      )}
      {GRADES.map((g, i) => {
        const subs = tasks.filter((t) => t.kind === "L2_SUBTOPIC" && t.phase === i + 1);
        const cp = tasks.find((t) => t.key === `L2:CHECKPOINT:${g}`);
        const phaseDone = subs.filter((t) => t.state === "COMPLETED").length;
        const open = subs.some((t) => t.state !== "LOCKED");
        return (
          <details key={g} open={open || (levelLocked && i === 0)} className="mt-8 rounded-xl border border-line bg-surface">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
              <GradeBadge grade={g} />
              <span className="text-lg font-bold">Priority {g}</span>
              <span className="text-sm text-ink-2">
                {bn(subs.length)}টি উপবিষয়, {bn(phaseDone)}টি সম্পন্ন; প্রশ্ন {bnNum(cBy.get(g)?.published ?? 0)}/{bnNum(cBy.get(g)?.target ?? 0)}
              </span>
              <span className="ml-auto text-sm text-muted">{open ? "খোলা" : "তালাবন্ধ"}</span>
            </summary>
            <ul className="grid gap-x-8 border-t border-line px-5 py-3 sm:grid-cols-2">
              {subs.map((t) => (
                <li key={t.key} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
                  {t.state === "LOCKED" ? (
                    <span className="text-[15px] text-ink-2">{t.title}</span>
                  ) : (
                    <Link href={t.href} className="text-[15px] hover:text-green">{t.title}</Link>
                  )}
                  <span className="shrink-0 text-xs text-muted">{t.state === "COMPLETED" ? "সম্পন্ন" : t.state === "LOCKED" ? "" : "খোলা"}</span>
                </li>
              ))}
            </ul>
            {cp && (
              <p className="border-t border-line px-5 py-3 text-sm text-ink-2">
                শেষে: {cp.title} {cp.state === "LOCKED" ? "(সব উপবিষয় শেষ হলে খুলবে)" : <Link href={cp.href} className="text-green underline">খুলুন</Link>}
              </p>
            )}
          </details>
        );
      })}
    </>
  );
}
