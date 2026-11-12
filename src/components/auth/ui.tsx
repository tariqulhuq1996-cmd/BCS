import type { ReactNode } from "react";

/** অ্যাকাউন্ট-পাতার কাঠামো: বাঁয়ে ফর্ম, ডানে (বড় পর্দায়) সংক্ষিপ্ত Roadmap-স্মারক। */
export function AuthShell({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto grid max-w-5xl gap-12 px-4 pt-12 sm:px-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div>
        <h1 className="text-[32px] font-extrabold sm:text-[38px]" style={{ fontStretch: "110%" }}>
          {title}
        </h1>
        {lead && <p className="mt-2 text-ink-2">{lead}</p>}
        <div className="mt-8">{children}</div>
      </div>
      <aside className="hidden self-start rounded-xl border border-line bg-surface p-6 lg:block" aria-label="প্রস্তুতির ধাপ">
        <p className="font-semibold">অ্যাকাউন্ট খোলার পর যা হবে</p>
        <ol className="mt-4 grid gap-4 text-[15px] text-ink-2">
          {[
            ["১", "Level ১ শুরু হবে ১০ম বিসিএসের প্রশ্নপত্র দিয়ে।"],
            ["২", "প্রতিটি পরীক্ষার পর ভুলগুলোর Revision ও Mastery Test।"],
            ["৩", "৮০% পেলে পরের বিসিএস খুলবে; অগ্রগতি সার্ভারে সংরক্ষিত থাকবে।"],
          ].map(([n, t]) => (
            <li key={n} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="grid size-8 place-items-center rounded-full border-[1.5px] border-omr text-sm font-semibold text-omr">{n}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

// ফর্ম-ঘর: ./field.tsx (ক্লায়েন্ট কম্পোনেন্ট — পাসওয়ার্ড দেখানোর বোতামসহ)

export function FormMessage({ text, ok }: { text?: string; ok?: boolean }) {
  if (!text) return null;
  return (
    <p role={ok ? "status" : "alert"} className={`rounded-md border px-3 py-2.5 text-[15px] ${ok ? "border-green bg-green-wash text-ink" : "border-danger bg-danger-wash text-ink"}`}>
      {text}
    </p>
  );
}

export function SubmitButton({ pending, children, pendingText }: { pending: boolean; children: ReactNode; pendingText: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-green px-5 py-3 text-[17px] font-semibold text-white hover:bg-green-strong disabled:opacity-60 dark:text-paper"
    >
      {pending ? pendingText : children}
    </button>
  );
}
