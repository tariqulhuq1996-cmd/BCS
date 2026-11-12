import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_RULES } from "@/lib/rules/defaults";
import { deleteRuleOverrideAction, updateRuleAction } from "@/lib/admin/actions";
import { AdminTitle, Notice, btn, btnGhost, input } from "@/components/admin/ui";

export const metadata: Metadata = { title: "নিয়ম ও Threshold — অ্যাডমিন", robots: { index: false } };

const GROUPS: [string, string][] = [
  ["l1.", "Level ১"],
  ["l2.", "Level ২"],
  ["srs.", "Smart Revision"],
  ["l3.", "Level ৩"],
  ["", "সাধারণ"],
];

export default function RulesPage({ searchParams }: PageProps<"/admin/rules">) {
  return (
    <Suspense fallback={<p className="text-ink-2">লোড হচ্ছে…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/rules");
  const sp = await searchParams;
  const rows = await prisma.ruleSetting.findMany({ orderBy: [{ key: "asc" }, { scope: "asc" }] });
  const globalOf = new Map(rows.filter((r) => r.scope === "global").map((r) => [r.key, r]));
  const overrides = rows.filter((r) => r.scope !== "global");
  const keys = Object.keys(DEFAULT_RULES);
  const used = new Set<string>();

  return (
    <>
      <AdminTitle
        title="নিয়ম ও Threshold"
        lead="এখানে বদলানো মান সঙ্গে সঙ্গে প্রযোজ্য হয় (নতুন পরীক্ষা থেকে)। প্রতিটি বদল Audit Log-এ থাকে। মান JSON আকারে: সংখ্যা (80), সত্য/মিথ্যা (true), তালিকা ([1,3,7])।"
      />
      {typeof sp.ok === "string" && <Notice>{sp.ok}</Notice>}
      {typeof sp.err === "string" && <Notice kind="error">{sp.err}</Notice>}

      {GROUPS.map(([prefix, label]) => {
        const ks = keys.filter((k) => !used.has(k) && (prefix ? k.startsWith(prefix) : true));
        ks.forEach((k) => used.add(k));
        if (!ks.length) return null;
        return (
          <section key={label} className="mt-8">
            <h2 className="text-xl font-bold">{label}</h2>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
              {ks.map((k) => {
                const cur = globalOf.get(k)?.value ?? DEFAULT_RULES[k].value;
                const isDefault = JSON.stringify(cur) === JSON.stringify(DEFAULT_RULES[k].value);
                return (
                  <li key={k} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_minmax(12rem,18rem)] md:items-center">
                    <div>
                      <p className="text-[15px]">{DEFAULT_RULES[k].noteBn}</p>
                      <p className="font-mono text-xs text-muted">{k}{!isDefault && <span className="ml-2 text-omr">(প্রাথমিক মান: {JSON.stringify(DEFAULT_RULES[k].value)})</span>}</p>
                    </div>
                    <form action={updateRuleAction} className="flex gap-2">
                      <input type="hidden" name="key" value={k} />
                      <input type="hidden" name="scope" value="global" />
                      <input name="value" defaultValue={JSON.stringify(cur)} aria-label={`${k}-এর মান`} className={`${input} w-full font-mono text-sm`} />
                      <button className={btnGhost}>সংরক্ষণ</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="mt-10">
        <h2 className="text-xl font-bold">নির্দিষ্ট ধাপের ব্যতিক্রম</h2>
        <p className="mt-1 text-[15px] text-ink-2">
          যেমন শুধু ৩৯তম BCS-এ Mastery-র Threshold ৭৫% করতে: নিয়ম <code>l1.threshold.mastery</code>, পরিসর <code>task:L1:EXAM:39</code>, মান <code>75</code>।
          পরিসর হতে পারে <code>task:&lt;কাজের key&gt;</code> বা <code>level:1</code>/<code>level:2</code>।
        </p>
        {overrides.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface text-[15px]">
            {overrides.map((o) => (
              <li key={o.key + o.scope} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-mono text-sm">{o.key} @ {o.scope} = {JSON.stringify(o.value)}</span>
                <form action={deleteRuleOverrideAction}>
                  <input type="hidden" name="key" value={o.key} /><input type="hidden" name="scope" value={o.scope} />
                  <button className="text-sm text-danger underline">মুছুন</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={updateRuleAction} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">নিয়ম
            <select name="key" className={input}>{keys.filter((k) => k.includes("threshold")).map((k) => <option key={k} value={k}>{k}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm"><span>পরিসর<span className="text-danger" aria-hidden="true"> *</span></span><input name="scope" placeholder="task:L1:EXAM:39" className={`${input} font-mono`} required aria-required="true" /></label>
          <label className="grid gap-1 text-sm"><span>মান<span className="text-danger" aria-hidden="true"> *</span></span><input name="value" placeholder="75" inputMode="decimal" className={`${input} w-24 font-mono`} required aria-required="true" /></label>
          <button className={btn}>ব্যতিক্রম যোগ করুন</button>
        </form>
      </section>
    </>
  );
}
