import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadRules } from "@/lib/rules";
import { LOCKED_MESSAGE } from "@/lib/progress/cycle";
import { bn } from "@/lib/bn";

export const metadata: Metadata = { title: "Level ৩: Model Test" };

export default function Level3Page() {
  return (
    <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <h1 className="text-[32px] font-extrabold sm:text-[40px]" style={{ fontStretch: "110%" }}>Level ৩: পূর্ণাঙ্গ Model Test</h1>
      <Suspense fallback={<p className="mt-6 text-ink-2">লোড হচ্ছে…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  const user = await requireUser("/level-3");
  const [rules, l2Final] = await Promise.all([
    loadRules(prisma),
    prisma.studentTaskProgress.findFirst({ where: { userId: user.id, task: { key: "L2:FINAL" }, state: "COMPLETED" } }),
  ]);
  const tiers = [
    { n: 1, range: "০১–৫০", name: "প্রাথমিক থেকে মাঝারি", gate: `শেষ ${bn(rules.get<number>("l3.gate.window"))}টি টেস্টের গড় নেট নম্বর ${bn(rules.get<number>("l3.gate.tier1_net"))} হলে স্তর ২ খোলে` },
    { n: 2, range: "৫১–১০০", name: "মাঝারি থেকে উচ্চতর", gate: `গড় নেট ${bn(rules.get<number>("l3.gate.tier2_net"))} হলে স্তর ৩ খোলে` },
    { n: 3, range: "১০১–১৫০", name: "উচ্চতর ও প্রতিযোগিতামূলক", gate: "শেষে Final Readiness Report" },
  ];
  return (
    <>
      {!l2Final && (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-3 text-ink-2">
          Level ৩ তালাবন্ধ। {LOCKED_MESSAGE} Level ১ ও Level ২ সম্পন্ন হলে খুলবে।
        </p>
      )}
      <p className="mt-6 max-w-2xl text-ink-2">
        ২০০ নম্বরের ১৫০টি টেস্ট, প্রতিটি {bn(rules.get<number>("l3.duration_min"))} মিনিট, প্রতিটি ভুলে {bn(rules.get<number>("l3.negative_mark"))} নম্বর কাটা। প্রতিটি টেস্টের পর ভুলগুলো পর্যালোচনা করলে পরের টেস্ট খোলে।
      </p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {tiers.map((t) => (
          <li key={t.n} className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">স্তর {bn(t.n)}: Model Test {t.range}</p>
            <p className="mt-1 font-semibold">{t.name}</p>
            <p className="mt-2 text-sm text-ink-2">{t.gate}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
