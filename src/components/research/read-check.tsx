"use client";

import Link from "next/link";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setOrientAction } from "@/lib/progress/journey-actions";
import { bn } from "@/lib/bn";

type Ctx = { checked: string[]; done: boolean; total: number; toggle: (id: string) => void; pending: string | null };
const OrientCtx = createContext<Ctx | null>(null);

/** ধাপ ০-এর অবস্থা পুরো পাতায় ভাগ করে রাখে — প্রতিটি অংশের বোতাম আর ওপরের অগ্রগতি একসঙ্গে বদলায়। */
export function OrientProvider({ initial, done: initialDone, total, children }: { initial: string[]; done: boolean; total: number; children: ReactNode }) {
  const [checked, setChecked] = useState(initial);
  const [done, setDone] = useState(initialDone);
  const [pending, setPending] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const toggle = (id: string) => {
    const on = !checked.includes(id);
    setChecked((c) => (on ? [...c, id] : c.filter((x) => x !== id))); // সঙ্গে সঙ্গে দেখায়; সার্ভারের উত্তরে মিলিয়ে নেয়
    setPending(id);
    start(async () => {
      const r = await setOrientAction(id, on);
      setPending(null);
      if (!r) return;
      setChecked(r.checked);
      if (r.done && !done) {
        setDone(true);
        router.refresh();
      }
    });
  };
  return <OrientCtx.Provider value={{ checked, done, total, toggle, pending }}>{children}</OrientCtx.Provider>;
}

/** একটি অংশের শেষে: "পড়েছি" বোতাম (চাপলে ✓ চিহ্ন; আবার চাপলে তুলে নেওয়া যায়)। */
export function ReadCheck({ id, label }: { id: string; label: string }) {
  const ctx = useContext(OrientCtx);
  if (!ctx) return null;
  const on = ctx.checked.includes(id);
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <button
        type="button"
        onClick={() => ctx.toggle(id)}
        aria-pressed={on}
        disabled={ctx.pending === id}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border-2 px-5 py-2 font-semibold ${on ? "border-green bg-green text-white dark:text-paper" : "border-green text-green hover:bg-green-wash"}`}
      >
        <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border-2 ${on ? "border-white" : "border-green"}`}>{on ? "✓" : ""}</span>
        {on ? "পড়েছি" : "পড়া শেষ? “পড়েছি” চিহ্ন দিন"}
      </button>
      <span className="text-sm text-muted">ধাপ ০: {label}</span>
    </div>
  );
}

/** পাতার ওপরে: ধাপ ০-এর অগ্রগতি, আর সব অংশ পড়া হলে পরের কাজ (শুরুর মূল্যায়ন)। */
export function OrientBanner({ items }: { items: readonly { id: string; label: string }[] }) {
  const ctx = useContext(OrientCtx);
  if (!ctx) return null;
  const n = ctx.checked.length;
  return (
    <div role="status" className={`mt-6 rounded-xl border-2 px-5 py-4 ${ctx.done ? "border-green bg-green-wash" : "border-omr bg-surface"}`}>
      {ctx.done ? (
        <>
          <p className="text-lg font-semibold">ধাপ ০-এর প্রথম অংশ শেষ। এবার শুরুর মূল্যায়ন।</p>
          <p className="mt-1 text-ink-2">৫০টি প্রশ্ন, ৩০ মিনিট — পাস-ফেল নেই; দিলেই Level ১ খুলবে। সাম্প্রতিক বিষয়াবলিও এখন খোলা।</p>
          <Link href="/start" className="mt-3 inline-block rounded-lg bg-green px-5 py-2.5 font-semibold text-white hover:bg-green-strong dark:text-paper">শুরুর মূল্যায়নে যান</Link>
        </>
      ) : (
        <>
          <p className="font-semibold">যাত্রার প্রথম ধাপ: প্রশ্ন-বিশ্লেষণ পড়া ({bn(n)}/{bn(ctx.total)})</p>
          <p className="mt-1 text-sm text-ink-2">নিচের পাঁচটি অংশ পড়ে প্রতিটির শেষে &ldquo;পড়েছি&rdquo; চিহ্ন দিন। সব হলে শুরুর মূল্যায়ন আর সাম্প্রতিক বিষয়াবলি খুলবে।</p>
          <ol className="mt-3 flex flex-wrap gap-2 text-sm">
            {items.map((it, i) => (
              <li key={it.id}>
                <a href={`#${it.id}`} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${ctx.checked.includes(it.id) ? "border-green bg-green-wash text-ink" : "border-line-strong text-ink-2 hover:border-green"}`}>
                  <span aria-hidden="true">{ctx.checked.includes(it.id) ? "✓" : bn(i + 1)}</span>
                  {it.label}
                  {ctx.checked.includes(it.id) && <span className="sr-only"> (পড়া হয়েছে)</span>}
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
