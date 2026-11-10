import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { daysAgo } from "@/lib/time";
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
  const [students, active, byStatus, explNone, explDraft, mts, imports, attempts7, target] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", lastLoginAt: { gte: weekAgo } } }),
    prisma.question.groupBy({ by: ["kind", "status"], _count: true }),
    prisma.question.count({ where: { kind: "HISTORICAL", status: "PUBLISHED", explanationStatus: "NONE" } }),
    prisma.question.count({ where: { status: "PUBLISHED", explanationStatus: "DRAFT" } }),
    prisma.modelTest.groupBy({ by: ["status"], _count: true }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.testAttempt.count({ where: { submittedAt: { gte: weekAgo } } }),
    prisma.subtopic.aggregate({ _sum: { targetQuestions: true } }),
  ]);
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
