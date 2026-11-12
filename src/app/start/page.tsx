import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { loadRules } from "@/lib/rules";
import { requireUser } from "@/lib/auth/session";
import { getStudentTasks } from "@/lib/progress/dashboard";
import { ORIENT_ITEMS, orientationStatus } from "@/lib/progress/journey";
import { startStepAction } from "@/lib/exam/actions";
import { bn, bnNum } from "@/lib/bn";

export const metadata: Metadata = { title: "যাত্রার শুরু" };

const ERR: Record<string, string> = {
  LOCKED: "আগে প্রশ্ন-বিশ্লেষণের পাঁচটি অংশে “পড়েছি” চিহ্ন দিন।",
  SUBMITTED: "শুরুর মূল্যায়ন আগেই দেওয়া হয়েছে।",
  EMPTY: "মূল্যায়নের প্রশ্ন এখনও প্রস্তুত নয়।",
};

/** ধাপ ০: প্রশ্ন-বিশ্লেষণ → শুরুর মূল্যায়ন; সঙ্গে সাম্প্রতিক বিষয়াবলি খোলার অবস্থা। */
export default function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
      <p className="text-sm font-semibold text-muted">ধাপ ০</p>
      <h1 className="mt-1 text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>যাত্রার শুরু</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        আগে জানুন কী আর কতটা পড়বেন, তারপর একটি ছোট মূল্যায়নে নিজের শুরুর অবস্থা মাপুন। এরপর Level ১ খুলবে, আর সাম্প্রতিক বিষয়াবলি চলবে পাশাপাশি।
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-2">লোড হচ্ছে…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/start");
  const [tasks, orient, rules] = await Promise.all([getStudentTasks(user.id), orientationStatus(prisma, user.id), loadRules(prisma)]);
  const diag = tasks.find((t) => t.key === "L0:DIAGNOSTIC");
  const ca = tasks.find((t) => t.key === "CA:GATE");
  const l1 = tasks.find((t) => t.key.startsWith("L1:EXAM:"));
  const [last, open] = diag
    ? await Promise.all([
        prisma.testAttempt.findFirst({ where: { userId: user.id, taskId: diag.id, kind: "DIAGNOSTIC", submittedAt: { not: null } }, orderBy: { submittedAt: "desc" } }),
        prisma.testAttempt.findFirst({ where: { userId: user.id, taskId: diag.id, kind: "DIAGNOSTIC", submittedAt: null } }),
      ])
    : [null, null];
  const error = typeof sp.e === "string" ? ERR[sp.e] : undefined;
  const size = rules.get<number>("l0.diagnostic.size");
  const minutes = rules.get<number>("l0.diagnostic.minutes");

  const card = (done: boolean, active: boolean) =>
    `rounded-xl border-2 p-5 sm:p-6 ${done ? "border-green bg-green-wash" : active ? "border-green bg-surface" : "border-dashed border-line-strong bg-surface"}`;
  const mark = (done: boolean, n: string) => (
    <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full border-2 font-bold ${done ? "border-green bg-green text-white dark:text-paper" : "border-omr text-omr"}`}>
      {done ? "✓" : n}
    </span>
  );
  const btn = "inline-block rounded-lg bg-green px-6 py-3 font-semibold text-white hover:bg-green-strong dark:text-paper";

  return (
    <ol className="mt-8 grid gap-5">
      {error && <p role="alert" className="rounded-md border border-danger bg-danger-wash px-3 py-2 text-[15px]">{error}</p>}
      <li className={card(orient.done, !orient.done)}>
        <div className="flex gap-4">
          {mark(orient.done, "১")}
          <div>
            <h2 className="text-xl font-bold">প্রশ্ন-বিশ্লেষণ পড়া</h2>
            <p className="mt-1 text-ink-2">
              {orient.done
                ? "সম্পন্ন — পাঁচটি অংশই পড়েছেন।"
                : `পাঁচটি অংশ: ${ORIENT_ITEMS.map((i) => i.label).join(", ")}। প্রতিটির শেষে “পড়েছি” চিহ্ন দিন (${bn(orient.checked.length)}/${bn(ORIENT_ITEMS.length)})।`}
            </p>
            <Link href="/research" className={orient.done ? "mt-3 inline-block text-green underline underline-offset-4" : `mt-4 ${btn}`}>
              {orient.done ? "আবার দেখুন" : orient.checked.length ? "পড়া চালিয়ে যান" : "প্রশ্ন-বিশ্লেষণ পড়া শুরু করুন"}
            </Link>
          </div>
        </div>
      </li>

      <li className={card(diag?.state === "COMPLETED", diag?.state === "AVAILABLE" || diag?.state === "IN_PROGRESS")}>
        <div className="flex gap-4">
          {mark(diag?.state === "COMPLETED", "২")}
          <div>
            <h2 className="text-xl font-bold">শুরুর মূল্যায়ন</h2>
            <p className="mt-1 text-ink-2">
              {bn(size)}টি প্রশ্ন, {bn(minutes)} মিনিট; ৩৫তম–৫০তম BCS থেকে, প্রিলিমিনারির মানবণ্টন অনুযায়ী বিষয়ভিত্তিক। পাস-ফেল নেই, একবারই দেওয়া যায়।
              ভয় নেই, এটি শুধু আপনার যাত্রার শুরুবিন্দু; শেষে প্রস্তুতির প্রতিবেদনে দেখবেন কতটা এগিয়েছেন।
            </p>
            {diag?.state === "COMPLETED" && last ? (
              <p className="mt-3 text-lg">
                আপনার শুরুর স্কোর: <span className="font-bold tabular">{bnNum(last.scorePct ?? 0, 0)}%</span> ({bn(last.correct ?? 0)}/{bn(size)}টি সঠিক)।{" "}
                <Link href={`/result/${last.id}`} className="text-green underline underline-offset-4">ফল ও ব্যাখ্যা দেখুন</Link>
              </p>
            ) : diag && diag.state !== "LOCKED" ? (
              <form action={startStepAction} className="mt-4">
                <input type="hidden" name="taskKey" value="L0:DIAGNOSTIC" />
                <input type="hidden" name="mode" value="step" />
                <button className={btn}>{open ? "মূল্যায়ন চালিয়ে যান" : "শুরুর মূল্যায়ন দিন"}</button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted">প্রশ্ন-বিশ্লেষণ পড়া শেষ হলে খুলবে।</p>
            )}
          </div>
        </div>
      </li>

      <li className={card(!!l1 && l1.state !== "LOCKED", false)}>
        <div className="flex gap-4">
          {mark(!!l1 && l1.state !== "LOCKED", "৩")}
          <div>
            <h2 className="text-xl font-bold">Level ১ শুরু</h2>
            <p className="mt-1 text-ink-2">মূল্যায়ন দিলেই ১০ম BCS-এর প্রশ্নপত্র খুলবে। এরপর প্রতিদিনের করণীয় Dashboard-এ পাবেন।</p>
            {l1 && l1.state !== "LOCKED" && <Link href="/dashboard" className={`mt-4 ${btn}`}>Dashboard-এ যান</Link>}
          </div>
        </div>
      </li>

      <li className="rounded-xl border border-omr bg-omr-wash p-5 sm:p-6">
        <h2 className="text-lg font-bold">পাশাপাশি: সাম্প্রতিক বিষয়াবলি</h2>
        <p className="mt-1 text-ink-2">
          {ca && ca.state !== "LOCKED"
            ? "খোলা — প্রতিদিন ২০টি প্রশ্নের স্মার্ট সেট দিন। Level ৩-এর আগে প্রতিটি প্রশ্নব্যাংক আয়ত্ত করতে হবে।"
            : "প্রশ্ন-বিশ্লেষণ পড়া শেষ হলেই খুলবে, চলবে পরীক্ষার দিন পর্যন্ত।"}
        </p>
        {ca && ca.state !== "LOCKED" && <Link href="/current-affairs" className="mt-3 inline-block font-semibold text-omr underline underline-offset-4">সাম্প্রতিক বিষয়াবলিতে যান</Link>}
      </li>
    </ol>
  );
}
