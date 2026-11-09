import type { ReactNode } from "react";

/** হোমপেজের একটি অংশ: বাঁ-দিকে সারিবদ্ধ শিরোনাম + সংক্ষিপ্ত ব্যাখ্যা, নিচে বিষয়বস্তু। */
export function Section({ id, title, lead, children, aside }: { id?: string; title: string; lead?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold sm:text-[34px]" style={{ fontStretch: "110%" }}>
            {title}
          </h2>
          {lead && <p className="mt-2 text-ink-2">{lead}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm text-muted">{children}</p>;
}
