import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { bn, bnNum } from "@/lib/bn";
import { AdminTitle, Notice, btnGhost, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "শিক্ষার্থী — অ্যাডমিন", robots: { index: false } };

export default function StudentsAdmin({ searchParams }: PageProps<"/admin/students">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/students");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { profile: { name: { contains: q } } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { profile: true, _count: { select: { attempts: true } } },
  });
  const done = await prisma.studentTaskProgress.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) }, state: "COMPLETED" }, _count: true });
  const doneBy = new Map(done.map((d) => [d.userId, d._count]));

  return (
    <>
      <AdminTitle title="শিক্ষার্থী" lead="নাম বা ইমেইল দিয়ে খুঁজুন; বিস্তারিত পাতায় অগ্রগতি, পরীক্ষার ইতিহাস, হাতে Unlock ও অ্যাকাউন্টের কাজ।" />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}
      <form className="mt-6 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="নাম বা ইমেইল" aria-label="শিক্ষার্থী খুঁজুন" className={`${input} w-72`} />
        <button className={btnGhost}>খুঁজুন</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left text-[15px]">
          <thead className="border-b border-line text-sm text-muted">
            <tr><th className="px-3 py-2 font-medium">নাম</th><th className="px-3 py-2 font-medium">ইমেইল</th><th className="px-3 py-2 text-right font-medium">সম্পন্ন ধাপ</th><th className="px-3 py-2 text-right font-medium">পরীক্ষা</th><th className="px-3 py-2 font-medium">শেষ লগইন</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line">
                <td className="px-3 py-2"><Link href={`/admin/students/${u.id}`} className="text-green underline">{u.profile?.name ?? "—"}</Link>{u.role === "ADMIN" && <span className="ml-2 text-xs text-omr">অ্যাডমিন</span>}{u.disabled && <span className="ml-2 text-xs text-danger">বন্ধ</span>}</td>
                <td className="px-3 py-2 text-sm">{u.email}</td>
                <td className="px-3 py-2 text-right tabular">{bn(doneBy.get(u.id) ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular">{bnNum(u._count.attempts)}</td>
                <td className="px-3 py-2 text-sm text-ink-2">{u.lastLoginAt?.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" }) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 100 && <p className="mt-2 text-sm text-muted">প্রথম ১০০ জন দেখানো হচ্ছে; নির্দিষ্ট কাউকে খুঁজুন।</p>}
    </>
  );
}
