"use client";

import { useActionState, useState, useTransition } from "react";
import { importCurrentAffairsAction } from "@/lib/admin/actions";
import { bnNum } from "@/lib/bn";
import { bankKeyFromFilename } from "@/lib/current-affairs/bank-key";
import { Notice, btn, btnGhost } from "./ui";

/** .docx বাছাই → পূর্বরূপ (কিছু লেখা হয় না) → নিশ্চিত করলে Import */
export function CaImportForm({ banks }: { banks: { key: string; name: string; questions: number }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const fromName = file ? bankKeyFromFilename(file.name) : "";
  const isNew = !!file && !banks.some((b) => b.key === bank);
  const pick = (f: File | null) => {
    setFile(f);
    // একই নামের ফাইল (নতুন সংস্করণ) হলে সেই ব্যাংক; নইলে ফাইলের নাম থেকে নতুন ব্যাংক
    setBank(f ? bankKeyFromFilename(f.name) : "");
  };
  const [state, action] = useActionState(importCurrentAffairsAction, undefined);
  const [pending, start] = useTransition();
  const run = (confirm: boolean) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("bank", bank);
    if (confirm) fd.set("confirm", "1");
    start(() => action(fd));
  };
  const s = state?.summary;
  const blocked = !!state?.problems?.length;

  return (
    <div className="mt-6 grid max-w-3xl gap-5">
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-5">
        <label className="grid gap-1.5">
          <span className="font-medium">প্রশ্নব্যাংক (.docx — বর্তমান নথির কাঠামোয়)</span>
          <input type="file" accept=".docx" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="text-[15px]" />
        </label>
        {file && (
          <label className="grid gap-1.5">
            <span className="font-medium">কোন প্রশ্নব্যাংকে বসবে</span>
            <select value={bank} onChange={(e) => setBank(e.target.value)} className="rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]">
              {banks.map((b) => (
                <option key={b.key} value={b.key}>
                  হালনাগাদ: {b.name} ({bnNum(b.questions)}টি প্রশ্ন)
                </option>
              ))}
              {!banks.some((b) => b.key === fromName) && <option value={fromName}>নতুন প্রশ্নব্যাংক যোগ করুন ({fromName})</option>}
            </select>
            <span className="text-sm text-muted">
              {isNew ? "নতুন ব্যাংক হিসেবে আগেরগুলোর পাশে যোগ হবে — আগের কোনো প্রশ্ন বদলাবে না।" : "এই ব্যাংকের প্রশ্নই শুধু হালনাগাদ হবে; অন্য ব্যাংক অপরিবর্তিত থাকবে। ভুল ব্যাংক বাছলে সেটির প্রশ্ন নিষ্ক্রিয় হয়ে যেতে পারে — নাম মিলিয়ে নিন।"}
            </span>
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!file || pending} onClick={() => run(false)} className={btnGhost}>{pending && !state?.confirmed ? "পড়া হচ্ছে…" : "পূর্বরূপ দেখুন"}</button>
          <button type="button" disabled={!file || pending || !s || blocked || state?.confirmed} onClick={() => run(true)} className={btn}>Import করুন</button>
        </div>
        <p className="text-sm text-muted">একই নম্বরের প্রশ্ন হালনাগাদ হয় (শিক্ষার্থীর অগ্রগতি থাকে; প্রশ্ন বা উত্তর বদলালে সেই প্রশ্নের অগ্রগতি মুছে যায়)। নথিতে নেই এমন পুরোনো প্রশ্ন নিষ্ক্রিয় হয়। Quick Revision ও তথ্যসূত্র নতুন করে বসে।</p>
      </div>

      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {s && (
        <section aria-live="polite" className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-bold">{state?.confirmed ? "Import সম্পন্ন" : "পূর্বরূপ (এখনও কিছু লেখা হয়নি)"}</h2>
          <p className="mt-1 text-sm text-muted">{s.title}</p>
          <ul className="mt-3 grid gap-1 text-[15px]">
            <li>সংস্করণ {s.version ?? "—"} · তথ্য যাচাই: {s.verifiedBn ?? "—"}</li>
            <li>অধ্যায় <b>{bnNum(s.chapters)}</b> · প্রশ্ন <b>{bnNum(s.questions)}</b> (A {bnNum(s.a)}, B {bnNum(s.b)}, C {bnNum(s.c)}) · পরিবর্তনশীল {bnNum(s.volatile)}</li>
            <li>Quick Revision {bnNum(s.revision)}টি তথ্য · তথ্যসূত্র {bnNum(s.sources)}টি</li>
            {state?.result && (
              <li className="text-green">নতুন {bnNum(state.result.added)}, হালনাগাদ {bnNum(state.result.updated)}, অগ্রগতি-মোছা {bnNum(state.result.reset)}, নিষ্ক্রিয় {bnNum(state.result.retired)}</li>
            )}
          </ul>
          {blocked && (
            <div className="mt-3">
              <p className="font-semibold text-danger">ত্রুটি থাকায় Import করা যাবে না:</p>
              <ul className="mt-1 max-h-60 list-disc overflow-auto pl-5 text-sm">{state!.problems!.slice(0, 100).map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {!!state?.warnings?.length && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">সতর্কতা ({bnNum(state.warnings.length)})</summary>
              <ul className="mt-1 max-h-60 list-disc overflow-auto pl-5 text-sm">{state.warnings.slice(0, 100).map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
