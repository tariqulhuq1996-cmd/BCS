import Link from "next/link";
import { bn } from "@/lib/bn";

/**
 * ২০০ নম্বরের প্রিলিমিনারি: পুরোনো (৩৫তম–৫০তম) বনাম নতুন (৫১তম থেকে) মানবণ্টন, সঙ্গে ৫০তম BCS-এ আসলে কত প্রশ্ন এসেছিল।
 * পুরোনো মানবণ্টন ও ৫০তম-এর সংখ্যা গবেষণার ধাপ ০৯ থেকে; নতুন মানবণ্টন অ্যাডমিন-নিয়ম `exam.marks_distribution` থেকে।
 */
export const OLD_MARKS: Record<string, number> = { BN: 35, EN: 35, BD: 30, IA: 20, GE: 10, SC: 15, IT: 15, MA: 15, MN: 15, ET: 10 };
/** ৫০তম BCS-এ বিষয়বস্তু অনুযায়ী প্রশ্ন (গবেষণা থেকে) — নতুন কাঠামোর সঙ্গে প্রায় মেলে */
export const EXAM50: Record<string, number> = { BN: 31, EN: 30, BD: 24, IA: 19, GE: 13, SC: 17, IT: 16, MA: 22, MN: 11, ET: 17 };

type Row = { code: string; nameBn: string; old: number; now: number; e50?: number };

const SHORT: Record<string, string> = { BN: "বাংলা", EN: "ইংরেজি", BD: "বাংলাদেশ বিষয়াবলি", IA: "আন্তর্জাতিক বিষয়াবলি", GE: "ভূগোল", SC: "বিজ্ঞান", IT: "কম্পিউটার", MA: "গণিত", MN: "মানসিক দক্ষতা", ET: "নৈতিকতা" };
const list = (codes: string[]) => {
  const n = codes.map((c) => SHORT[c] ?? c);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} ও ${n.at(-1)}` : n[0] ?? "";
};

export function MarksShift({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => b.now - a.now || b.old - a.old);
  const max = Math.max(...sorted.flatMap((r) => [r.old, r.now]));
  const down = sorted.filter((r) => r.now < r.old);
  const up = sorted.filter((r) => r.now > r.old);
  const moved = down.reduce((a, r) => a + (r.old - r.now), 0);
  const lang = sorted.filter((r) => r.code === "BN" || r.code === "EN").reduce((a, r) => a + r.now, 0);
  const ia = sorted.find((r) => r.code === "IA");
  const proof = ["ET", "MA", "BD"].map((c) => sorted.find((r) => r.code === c)).filter((r): r is Row => !!r && r.e50 != null);

  const insights = [
    moved > 0 && {
      t: "ভারসাম্যে পরিবর্তন",
      d: `${list(down.map((r) => r.code))} থেকে ${bn(moved)} নম্বর কমিয়ে ${list(up.map((r) => r.code))} — এই ${["", "এক", "দুই", "তিন", "চার", "পাঁচ"][up.length] ?? bn(up.length)} বিষয়ে যুক্ত হয়েছে। মুখস্থনির্ভর অংশের গুরুত্ব তুলনামূলক কমেছে, যুক্তি ও বিশ্লেষণের গুরুত্ব বেড়েছে।`,
    },
    proof.length > 0 && {
      t: "৫০তম BCS-এ প্রতিফলন",
      d: `${proof.map((r) => `${SHORT[r.code]} ${bn(r.e50!)}`).join(", ")}টি প্রশ্ন — নতুন কাঠামোর সঙ্গে প্রায় সামঞ্জস্যপূর্ণ। এটি প্রবণতা নয়, মানবণ্টনের পরিবর্তন।`,
    },
    {
      t: "ভাষাই ভিত্তি",
      d: `বাংলা ও ইংরেজি মিলে এখনো ${bn(lang)} নম্বর (${bn(Math.round((lang / 200) * 100))}%) — প্রস্তুতির সবচেয়ে বড় অংশ।`,
    },
    ia && ia.now > ia.old && {
      t: "আন্তর্জাতিক বিষয়াবলিতে বাড়তি মনোযোগ",
      d: `নম্বর এখন ${bn(ia.now)}। ভূগোলের সঙ্গে মিলিয়ে পড়ুন এবং`,
      link: { href: "/current-affairs", label: "সাম্প্রতিক বিষয়াবলি", after: " নিয়মিত অনুশীলন করুন।" },
    },
  ].filter(Boolean) as { t: string; d: string; link?: { href: string; label: string; after?: string } }[];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted" aria-hidden="true">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-line-strong" />পুরোনো (৩৫তম–৫০তম)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-green" />নতুন (৫১তম থেকে)</span>
        </div>
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">বিষয়ভিত্তিক নম্বর: পুরোনো ও নতুন মানবণ্টন, পরিবর্তন এবং ৫০তম BCS-এ আসা প্রশ্ন</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">বিষয়</th>
              <th scope="col">পুরোনো → নতুন নম্বর</th>
              <th scope="col">পরিবর্তন</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const d = r.now - r.old;
              return (
                <tr key={r.code} className="border-b border-line align-middle">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <span className="block leading-snug">{r.nameBn}</span>
                    <span className="mt-1.5 grid gap-1" aria-hidden="true">
                      <span className="block h-1.5 rounded-full bg-line-strong" style={{ width: `${(r.old / max) * 100}%` }} />
                      <span className="block h-2 rounded-full bg-green" style={{ width: `${(r.now / max) * 100}%` }} />
                    </span>
                  </th>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular">
                    <span className="text-muted">{bn(r.old)}</span>
                    <span className="mx-1 text-muted" aria-hidden="true">→</span>
                    <span className="sr-only"> থেকে </span>
                    <span className="font-bold">{bn(r.now)}</span>
                  </td>
                  <td className="w-14 py-2.5 text-right">
                    <span
                      className={`inline-block min-w-11 rounded-full px-2 py-0.5 text-center text-sm font-semibold tabular ${
                        d > 0 ? "bg-green-wash text-green" : d < 0 ? "bg-danger-wash text-danger" : "text-muted"
                      }`}
                    >
                      {d > 0 ? `+${bn(d)}` : d < 0 ? `−${bn(-d)}` : "—"}
                      <span className="sr-only">{d > 0 ? " বেড়েছে" : d < 0 ? " কমেছে" : " অপরিবর্তিত"}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-lg font-bold">এক নজরে</h3>
        <ol className="mt-3 grid gap-3">
          {insights.map((x, i) => (
            <li key={x.t} className="rounded-xl border border-line bg-surface px-4 py-3.5">
              <p className="flex items-baseline gap-2 font-semibold">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-green text-xs text-white dark:text-paper" aria-hidden="true">{bn(i + 1)}</span>
                {x.t}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
                {x.d}
                {x.link && (
                  <>
                    {" "}
                    <Link href={x.link.href} className="text-green underline underline-offset-4">{x.link.label}</Link>
                    {x.link.after}
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-2">Level ২-এর Final ও সব Model Test নতুন মানবণ্টন অনুযায়ী সাজানো।</p>
      </div>
    </div>
  );
}
