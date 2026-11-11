import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { daysAgo } from "@/lib/time";
import { numify } from "@/lib/sql";
import { requireAdmin } from "@/lib/auth/session";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Stat, StatGrid, STATUS_BN } from "@/components/admin/ui";

export const metadata: Metadata = { title: "অ্যাডমিন", robots: { index: false } };

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAdmin("/admin");
  const weekAgo = daysAgo(7);
  const [students, active, byStatus, explNone, explDraft, mts, imports, attempts7, target, dbSize] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", lastLoginAt: { gte: weekAgo } } }),
    prisma.question.groupBy({ by: ["kind", "status"], _count: true }),
    prisma.question.count({ where: { kind: "HISTORICAL", status: "PUBLISHED", explanationStatus: "NONE" } }),
    prisma.question.count({ where: { status: "PUBLISHED", explanationStatus: "DRAFT" } }),
    prisma.modelTest.groupBy({ by: ["status"], _count: true }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.testAttempt.count({ where: { submittedAt: { gte: weekAgo } } }),
    prisma.subtopic.aggregate({ _sum: { targetQuestions: true } }),
    // ডেটাবেসের আকার (Hostinger-এ প্রতি ডেটাবেসে ৩ GB সীমা)
    prisma.$queryRaw<{ bytes: number | null }[]>`select sum(data_length + index_length) as bytes from information_schema.tables where table_schema = database()`
      .then((r) => numify(r)[0]?.bytes ?? 0)
      .catch(() => null),
  ]);
  const dbMb = dbSize == null ? null : dbSize / 1048576;
  const n = (kind: string, status: string) => byStatus.find((b) => b.kind === kind && b.status === status)?._count ?? 0;
  const topicPublished = n("TOPIC", "PUBLISHED");

  return (
    <>
      <AdminTitle title="সারসংক্ষেপ" lead="প্ল্যাটফর্মের বর্তমান অবস্থা এবং কোন কাজ বাকি।" />
      <StatGrid>
        <Stat k="শিক্ষার্থী" v={bnNum(students)} s={`গত ৭ দিনে সক্রিয় ${bn(active)}`} />
        <Stat k="গত ৭ দিনের পরীক্ষা" v={bnNum(attempts7)} s="জমা দেওয়া" />
        <Stat k="Level ২ প্রশ্ন" v={`${bnNum(topicPublished)}/${bnNum(target._sum.targetQuestions ?? 0)}`} s={`খসড়া ${bnNum(n("TOPIC", "DRAFT"))}, যাচাইকৃত ${bnNum(n("TOPIC", "VERIFIED"))}`} />
        <Stat k="Model Test" v={`${bn(mts.find((m) => m.status === "PUBLISHED")?._count ?? 0)}/১৫০`} s={`খসড়া ${bn(mts.find((m) => m.status === "DRAFT")?._count ?? 0)}`} />
      </StatGrid>
      {dbMb != null && (
        <p className={`mt-3 text-sm ${dbMb > 2560 ? "font-semibold text-danger" : "text-muted"}`}>
          ডেটাবেসের আকার: {bnNum(dbMb, 1)} MB / ৩,০৭২ MB{dbMb > 2560 ? " — সীমার কাছাকাছি! পুরোনো Revision-এর খুঁটিনাটি মুছতে বা বড় প্ল্যানে যেতে হবে।" : ""}
        </p>
      )}

      <LaunchSteps
        topicTotal={n("TOPIC", "DRAFT") + n("TOPIC", "VERIFIED") + topicPublished}
        topicPending={n("TOPIC", "DRAFT") + n("TOPIC", "VERIFIED")}
        topicPublished={topicPublished}
        target={target._sum.targetQuestions ?? 0}
        explPending={explDraft + explNone}
        mtPublished={mts.find((m) => m.status === "PUBLISHED")?._count ?? 0}
        mtDraft={mts.find((m) => m.status === "DRAFT")?._count ?? 0}
      />

      <section className="mt-10">
        <h2 className="text-xl font-bold">যাচাইয়ের অপেক্ষায়</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-[15px]">
          {[
            { k: "খসড়া Level ২ প্রশ্ন (যাচাই করে প্রকাশ করুন)", v: n("TOPIC", "DRAFT") + n("TOPIC", "VERIFIED"), href: "/admin/questions?kind=TOPIC&status=DRAFT" },
            { k: "ব্যাখ্যা যাচাই বাকি (খসড়া ব্যাখ্যা)", v: explDraft, href: "/admin/questions?expl=DRAFT" },
            { k: "বিগত প্রশ্নে ব্যাখ্যা নেই", v: explNone, href: "/admin/questions?kind=HISTORICAL&expl=NONE" },
            { k: "খসড়া Model Test (দেখে অনুমোদন করুন)", v: mts.find((m) => m.status === "DRAFT")?._count ?? 0, href: "/admin/model-tests" },
          ].map((x) => (
            <li key={x.k} className="flex items-baseline justify-between gap-4 py-2.5">
              <span>{x.k}</span>
              <Link href={x.href} className={`font-semibold tabular ${x.v ? "text-green underline underline-offset-4" : "text-muted"}`}>{bnNum(x.v)}টি</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">প্রশ্নভান্ডার</h2>
        <table className="mt-3 w-full max-w-2xl text-left text-[15px] tabular">
          <thead className="text-sm text-muted"><tr className="border-b border-line"><th className="py-2 font-medium">ধরন</th>{["DRAFT", "VERIFIED", "PUBLISHED", "RETIRED"].map((s) => <th key={s} className="py-2 text-right font-medium">{STATUS_BN[s]}</th>)}</tr></thead>
          <tbody>
            {[["HISTORICAL", "বিগত বিসিএস"], ["TOPIC", "Level ২ (নতুন)"]].map(([k, label]) => (
              <tr key={k} className="border-b border-line"><td className="py-2">{label}</td>{["DRAFT", "VERIFIED", "PUBLISHED", "RETIRED"].map((s) => <td key={s} className="py-2 text-right">{bnNum(n(k, s))}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">সাম্প্রতিক Import</h2>
        {imports.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line text-[15px]">
            {imports.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-3 py-2.5">
                <span>{b.source} <span className="text-sm text-muted">({b.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })})</span></span>
                <span className="text-sm text-ink-2">সারি {bnNum(b.rows)}, যোগ {bnNum(b.inserted)}, পুনরাবৃত্তি বাদ {bnNum(b.duplicates)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-ink-2">এখনও কোনো Import হয়নি।</p>}
      </section>
    </>
  );
}

/** নতুন প্রশ্ন শিক্ষার্থীর কাছে পৌঁছানোর ধাপ — প্রতিটির বর্তমান অবস্থাসহ। প্রশ্ন ডেটাবেসে থাকে, তাই এগুলোর জন্য GitHub বা নতুন Deploy লাগে না। */
function LaunchSteps(p: { topicTotal: number; topicPending: number; topicPublished: number; target: number; explPending: number; mtPublished: number; mtDraft: number }) {
  const steps = [
    {
      t: "প্রশ্নভান্ডার Import",
      d: `CSV/Excel ফাইল (প্রতিটি সর্বোচ্চ ৪ MB; বড় হলে বিষয় অনুযায়ী ভাগ করুন) → পূর্বরূপ → Import। এখন পর্যন্ত ${bnNum(p.topicTotal)}/${bnNum(p.target)}টি।`,
      done: p.topicTotal >= p.target && p.target > 0, started: p.topicTotal > 0, href: "/admin/import", cta: "Import করুন",
    },
    {
      t: "যাচাই করে প্রকাশ",
      d: `প্রকাশিত প্রশ্নই শুধু শিক্ষার্থীর Level ২-এ আসে — প্রকাশ করামাত্র। প্রকাশিত ${bnNum(p.topicPublished)}টি, অপেক্ষায় ${bnNum(p.topicPending)}টি।`,
      done: p.topicPublished > 0 && p.topicPending === 0, started: p.topicPublished > 0, href: "/admin/questions?kind=TOPIC&status=DRAFT", cta: "যাচাই ও প্রকাশ",
    },
    {
      t: "ব্যাখ্যা যাচাই",
      d: `খসড়া বা না-থাকা ব্যাখ্যা ${bnNum(p.explPending)}টি। প্রশ্ন খুলে ব্যাখ্যা ঠিক করে "যাচাইকৃত" করুন।`,
      done: p.explPending === 0, started: false, href: "/admin/questions?expl=DRAFT", cta: "ব্যাখ্যা দেখুন",
    },
    {
      t: "১৫০টি Model Test",
      d: `Level ২-এর প্রশ্ন প্রকাশের পরে: খসড়া তৈরি → দেখে অনুমোদন। প্রকাশিত ${bnNum(p.mtPublished)}/১৫০, খসড়া ${bnNum(p.mtDraft)}টি।`,
      done: p.mtPublished >= 150, started: p.mtPublished + p.mtDraft > 0, href: "/admin/model-tests", cta: "Model Test",
    },
  ];
  return (
    <section className="mt-10 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-xl font-bold">নতুন প্রশ্ন কীভাবে live হয়</h2>
      <p className="mt-1 text-[15px] text-ink-2">
        প্রশ্ন থাকে ডেটাবেসে, তাই এখানে Import ও প্রকাশ করলেই সাইটে চলে আসে — <b>GitHub-এ তোলা বা Hostinger-এ নতুন Deploy লাগে না</b>।
        GitHub/Deploy শুধু অ্যাপের কোড বদলালে।
      </p>
      <ol className="mt-4 grid gap-3">
        {steps.map((s, i) => (
          <li key={s.t} className="flex flex-wrap items-start gap-3 border-t border-line pt-3">
            <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-green text-white dark:text-paper" : s.started ? "bg-omr-wash text-omr" : "bg-paper text-muted border border-line"}`}>
              {s.done ? "✓" : bnNum(i + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.t} <span className="text-sm font-normal text-muted">— {s.done ? "সম্পন্ন" : s.started ? "চলছে" : "বাকি"}</span></p>
              <p className="text-[15px] text-ink-2">{s.d}</p>
            </div>
            <Link href={s.href} className="text-[15px] font-semibold text-green underline underline-offset-4">{s.cta}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
