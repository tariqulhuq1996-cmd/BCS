import type { ReactNode } from "react";

export function AdminTitle({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold sm:text-[32px]" style={{ fontStretch: "108%" }}>{title}</h1>
        {lead && <p className="mt-1 max-w-3xl text-ink-2">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="text-sm text-muted">{k}</p>
      <p className="mt-1 font-display text-[26px] font-bold leading-none tabular">{v}</p>
      {s && <p className="mt-1.5 text-xs text-muted">{s}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">{children}</section>;
}

export function Notice({ kind = "ok", children }: { kind?: "ok" | "error"; children: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`mt-4 rounded-md border px-3 py-2 text-[15px] ${kind === "error" ? "border-danger bg-danger-wash" : "border-green bg-green-wash"}`}>
      {children}
    </p>
  );
}

export const btn = "rounded-md bg-green px-4 py-2 font-semibold text-white hover:bg-green-strong disabled:opacity-60 dark:text-paper";
export const btnGhost = "rounded-md border border-line-strong px-3 py-1.5 text-[15px] hover:border-green";
export const input = "rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]";

export const STATUS_BN: Record<string, string> = { DRAFT: "খসড়া", VERIFIED: "যাচাইকৃত", PUBLISHED: "প্রকাশিত", RETIRED: "বাতিল", APPROVED: "অনুমোদিত" };
