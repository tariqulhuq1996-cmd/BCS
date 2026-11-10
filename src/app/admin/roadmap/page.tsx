import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { updateTaskAction } from "@/lib/admin/actions";
import { bn } from "@/lib/bn";
import { AdminTitle, Notice, btnGhost, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Roadmap — অ্যাডমিন", robots: { index: false } };

export default function RoadmapAdmin({ searchParams }: PageProps<"/admin/roadmap">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/roadmap");
  const sp = await searchParams;
  const level = Number(sp.level) || 1;
  const [levels, tasks, progress] = await Promise.all([
    prisma.learningLevel.findMany({ orderBy: { no: "asc" }, include: { _count: { select: { tasks: true } } } }),
    prisma.learningTask.findMany({ where: { level: { no: level } }, orderBy: { order: "asc" }, include: { prerequisites: { include: { requires: { select: { key: true } } } } } }),
    prisma.studentTaskProgress.groupBy({ by: ["taskId", "state"], where: { task: { level: { no: level } } }, _count: true }),
  ]);
  const cnt = (taskId: number, state: string) => progress.find((p) => p.taskId === taskId && p.state === state)?._count ?? 0;

  return (
    <>
      <AdminTitle title="Learning Roadmap" lead="প্রতিটি ধাপের নাম, সক্রিয়/নিষ্ক্রিয় অবস্থা ও পূর্বশর্ত। নিষ্ক্রিয় ধাপ শিক্ষার্থীর পথে আসে না এবং পরের ধাপ খোলায় বাধা দেয় না। Threshold বদলাতে নিয়ম-পাতা ব্যবহার করুন; কোনো শিক্ষার্থীর জন্য হাতে Unlock শিক্ষার্থীর পাতা থেকে।" />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Level">
        {levels.map((l) => (
          <Link key={l.no} href={`/admin/roadmap?level=${l.no}`} aria-current={l.no === level ? "page" : undefined} className={`rounded-full border px-3.5 py-1 text-sm ${l.no === level ? "border-green bg-green text-white dark:text-paper" : "border-line text-ink-2"}`}>
            Level {bn(l.no)}: {l.nameBn} ({bn(l._count.tasks)})
          </Link>
        ))}
      </nav>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[50rem] text-left text-[14px]">
          <thead className="border-b border-line text-sm text-muted">
            <tr><th className="px-3 py-2 font-medium">key</th><th className="px-3 py-2 font-medium">নাম ও সক্রিয়তা</th><th className="px-3 py-2 font-medium">পূর্বশর্ত</th><th className="px-3 py-2 text-right font-medium">খোলা / চলছে / সম্পন্ন</th></tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={`border-b border-line ${t.active ? "" : "opacity-60"}`}>
                <td className="px-3 py-2 font-mono text-xs">{t.key}</td>
                <td className="px-3 py-2">
                  <form action={updateTaskAction} className="flex items-center gap-2">
                    <input type="hidden" name="key" value={t.key} /><input type="hidden" name="level" value={level} />
                    <input name="title" defaultValue={t.titleBn} aria-label={`${t.key}-এর নাম`} className={`${input} w-64 py-1 text-sm`} />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={t.active} />সক্রিয়</label>
                    <button className={`${btnGhost} py-1 text-xs`}>সংরক্ষণ</button>
                  </form>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{t.prerequisites.length > 3 ? `${bn(t.prerequisites.length)}টি ধাপ` : t.prerequisites.map((p) => p.requires.key).join(", ") || "—"}</td>
                <td className="px-3 py-2 text-right tabular">{bn(cnt(t.id, "AVAILABLE"))} / {bn(cnt(t.id, "IN_PROGRESS"))} / {bn(cnt(t.id, "COMPLETED"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
